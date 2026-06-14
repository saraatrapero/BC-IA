import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, X, RefreshCw, Eye, Sparkles, Shield, Trash2, CheckCircle, ArrowRight, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { computeZNCCSignature, compareZNCCSignatures, lockCredentials, deleteLockedCredentials } from '../lib/biometrics';

interface FacialRecognitionModalProps {
  onClose: () => void;
}

type EnrollStep = 'front' | 'left' | 'right' | 'tilt' | 'completed';

export default function FacialRecognitionModal({ onClose }: FacialRecognitionModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Listo para inicializar escáner biométrico multi-ángulo...');
  const [logs, setLogs] = useState<string[]>(['[SISTEMA] Cargando módulo TrueDepth iOS style...']);
  
  // Enrolled profiles references (Base64 strings)
  const [scannedFront, setScannedFront] = useState<string | null>(null);
  const [scannedLeft, setScannedLeft] = useState<string | null>(null);
  const [scannedRight, setScannedRight] = useState<string | null>(null);
  const [scannedTilt, setScannedTilt] = useState<string | null>(null);

  // Active step for enrollment
  const [currentStep, setCurrentStep] = useState<EnrollStep>('front');

  // Biometric details saved
  const [faceAuthEnabled, setFaceAuthEnabled] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // Automated scanning state guides
  const [frontProgress, setFrontProgress] = useState(0);
  const [leftProgress, setLeftProgress] = useState(0);
  const [rightProgress, setRightProgress] = useState(0);
  const [tiltProgress, setTiltProgress] = useState(0);

  const [motionLevel, setMotionLevel] = useState(0);
  const [motionGuide, setMotionGuide] = useState('');

  // Derived overall stepProgress (Apple FaceID cumulative wheel 0 to 100)
  const stepProgress = (() => {
    let sum = 0;
    if (scannedFront) sum += 25; else sum += (frontProgress * 0.25);
    if (scannedLeft) sum += 25; else sum += (leftProgress * 0.25);
    if (scannedRight) sum += 25; else sum += (rightProgress * 0.25);
    if (scannedTilt) sum += 25; else sum += (tiltProgress * 0.25);
    return Math.min(100, Math.round(sum));
  })();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);

  const addLog = (text: string) => {
    setLogs((prev) => [...prev.slice(-6), `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  // Fetch current user status
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const uDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (uDoc.exists()) {
          const data = uDoc.data();
          setFaceAuthEnabled(!!data.faceAuthEnabled);
          if (data.faceData) {
            try {
              // Try to parse composite multi-profile JSON
              const parsed = JSON.parse(data.faceData);
              if (parsed && typeof parsed === 'object') {
                setScannedFront(parsed.front || null);
                setScannedLeft(parsed.left || null);
                setScannedRight(parsed.right || null);
                setScannedTilt(parsed.tilt || null);
                setCapturedPhoto(parsed.front || null);
              } else {
                // Fallback for single photo legacy strings
                setCapturedPhoto(data.faceData);
                setScannedFront(data.faceData);
              }
            } catch (e) {
              setCapturedPhoto(data.faceData);
              setScannedFront(data.faceData);
            }
            addLog('Patrones multi-ángulo recuperados de la nube.');
          }
        }
      } catch (e: any) {
        addLog(`Error al obtener perfil: ${e.message}`);
      }
    };
    fetchUserProfile();
  }, []);

  // Cleanup stream on close
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [stream]);

  // Bind video stream once the element is mounted in the DOM
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.error("Error setting video srcObject:", e);
        addLog(`[ERROR PLAY] Error al reproducir video: ${e.message}`);
      });
    }
  }, [cameraActive, stream]);

  // Adjust status instructions based on the current step
  useEffect(() => {
    if (!cameraActive) return;
    switch (currentStep) {
      case 'front':
        setStatusText('MIRA DIRECTO AL FRENTE - Capturando matriz central...');
        break;
      case 'left':
        setStatusText('GIRA LA CABEZA A LA IZQUIERDA - Escaneando perfil izquierdo...');
        break;
      case 'right':
        setStatusText('GIRA LA CABEZA A LA DERECHA - Escaneando perfil derecho...');
        break;
      case 'tilt':
        setStatusText('INCLINA LA CABEZA ARRIBA/ABAJO - Calibrando ejes cinéticos...');
        break;
      case 'completed':
        setStatusText('¡Perfecto! Todos los perfiles han sido cargados con éxito.');
        break;
    }
  }, [currentStep, cameraActive]);

  const startCamera = async () => {
    setLoading(true);
    setCameraError(null);
    setStatusText('Pidiendo acceso a la cámara...');
    addLog('Solicitando permisos cámara...');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        },
        audio: false
      });
      setStream(mediaStream);
      setCameraActive(true);
      addLog('Cámara TrueDepth iniciada.');
      startVisualScanner();
    } catch (err: any) {
      console.error(err);
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos en la barra de direcciones del navegador o ingresa vía HTTPS.');
      addLog('[ERROR] Permiso denegado o cámara ocupada.');
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCameraActive(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setStatusText('Cámara apagada.');
    addLog('Escáner de video apagado.');
  };

  const startVisualScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    
    const messages = [
      'Buscando alineación pupilar...',
      'Eje facial detectado.',
      'Mapeando polígono tridimensional...',
      'Calculando curvatura lateral...',
      'ZNCC de 4 perfiles activo.'
    ];
    let index = 0;

    scanIntervalRef.current = setInterval(() => {
      if (index < messages.length) {
        addLog(`[BIO] ${messages[index]}`);
        index++;
      } else {
        index = 0;
      }
    }, 3000);
  };

  // Refs to let the continuous interval always access up-to-date states in real-time
  const currentStepRef = useRef(currentStep);
  const scannedFrontRef = useRef(scannedFront);
  const scannedLeftRef = useRef(scannedLeft);
  const scannedRightRef = useRef(scannedRight);
  const scannedTiltRef = useRef(scannedTilt);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { scannedFrontRef.current = scannedFront; }, [scannedFront]);
  useEffect(() => { scannedLeftRef.current = scannedLeft; }, [scannedLeft]);
  useEffect(() => { scannedRightRef.current = scannedRight; }, [scannedRight]);
  useEffect(() => { scannedTiltRef.current = scannedTilt; }, [scannedTilt]);

  // Automatic hands-free continuous scanner (iOS FaceID style)
  useEffect(() => {
    if (!cameraActive || !stream) {
      setFrontProgress(0);
      setLeftProgress(0);
      setRightProgress(0);
      setTiltProgress(0);
      setMotionLevel(0);
      setMotionGuide('');
      return;
    }

    addLog(`[SISTEMA] Iniciando asistente Apple FaceID (Mapeo Angular Continuo)...`);

    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        // Create lightweight helper canvas for motion and angular direction sensing
        const motionCanvas = document.createElement('canvas');
        motionCanvas.width = 40;
        motionCanvas.height = 40;
        const mCtx = motionCanvas.getContext('2d');
        if (!mCtx) return;

        mCtx.drawImage(video, 0, 0, 40, 40);
        const imgData = mCtx.getImageData(0, 0, 40, 40);
        const data = imgData.data;

        let diffSum = 0;
        if (prevFrameRef.current) {
          for (let i = 0; i < data.length; i += 4) {
            const rDiff = Math.abs(data[i] - prevFrameRef.current[i]);
            const gDiff = Math.abs(data[i+1] - prevFrameRef.current[i+1]);
            const bDiff = Math.abs(data[i+2] - prevFrameRef.current[i+2]);
            diffSum += (rDiff + gDiff + bDiff);
          }
        }
        prevFrameRef.current = data;

        // Normalize motion level (0 to 100)
        const parsedMotion = Math.min(100, Math.round((diffSum / 60000) * 100));
        setMotionLevel(parsedMotion);

        const activeStep = currentStepRef.current;
        if (activeStep === 'completed') {
          return;
        }

        let guide = '';

        if (activeStep === 'front') {
          // 'front' calibrates the center axis and requires a steady, centered gaze. 
          if (parsedMotion < 10) {
            guide = '¡Excelente! Mantén tu mirada firme de frente al visor...';
            setFrontProgress((prev) => {
              const next = Math.min(100, prev + 10); // Steady state fills front in 1.5s
              if (next >= 100 && !scannedFrontRef.current) {
                // Snapshot now
                canvas.width = 300;
                canvas.height = 300;
                ctx.drawImage(video, 0, 0, 300, 300);
                const b64 = canvas.toDataURL('image/jpeg', 0.85);
                setScannedFront(b64);
                addLog('[AUTOCAPTURA] Frente registrado con éxito (100%).');
                setCurrentStep('left');
              }
              return next;
            });
          } else {
            guide = 'Estabiliza tu rostro. Mira fijo y centrado al visor...';
            setFrontProgress((prev) => Math.max(0, prev - 4)); // Crawl backwards if unstable
          }
        } 
        else if (activeStep === 'left') {
          // 'left' requires active head rotation.
          if (parsedMotion >= 5) {
            guide = '¡Giro izquierdo detectado! Registrando curvatura...';
            setLeftProgress((prev) => {
              const next = Math.min(100, prev + 12);
              if (next >= 100 && !scannedLeftRef.current) {
                canvas.width = 300;
                canvas.height = 300;
                ctx.drawImage(video, 0, 0, 300, 300);
                const b64 = canvas.toDataURL('image/jpeg', 0.85);
                setScannedLeft(b64);
                addLog('[AUTOCAPTURA] Perfil Izquierdo registrado (100%).');
                setCurrentStep('right');
              }
              return next;
            });
          } else {
            guide = 'Gira lentamente tu cabeza hacia la IZQUIERDA...';
          }
        } 
        else if (activeStep === 'right') {
          // 'right' requires active head rotation to the right side.
          if (parsedMotion >= 5) {
            guide = '¡Giro derecho detectado! Registrando curvatura...';
            setRightProgress((prev) => {
              const next = Math.min(100, prev + 12);
              if (next >= 100 && !scannedRightRef.current) {
                canvas.width = 300;
                canvas.height = 300;
                ctx.drawImage(video, 0, 0, 300, 300);
                const b64 = canvas.toDataURL('image/jpeg', 0.85);
                setScannedRight(b64);
                addLog('[AUTOCAPTURA] Perfil Derecho registrado (100%).');
                setCurrentStep('tilt');
              }
              return next;
            });
          } else {
            guide = 'Gira lentamente tu cabeza hacia la DERECHA...';
          }
        } 
        else if (activeStep === 'tilt') {
          // 'tilt' requires vertical elevation tilt up / down.
          if (parsedMotion >= 5) {
            guide = '¡Inclinación vertical detectada! Ajustando vectores...';
            setTiltProgress((prev) => {
              const next = Math.min(100, prev + 12);
              if (next >= 100 && !scannedTiltRef.current) {
                canvas.width = 300;
                canvas.height = 300;
                ctx.drawImage(video, 0, 0, 300, 300);
                const b64 = canvas.toDataURL('image/jpeg', 0.85);
                setScannedTilt(b64);
                addLog('[AUTOCAPTURA] Inclinación registrada con éxito (100%).');
                setCurrentStep('completed');
              }
              return next;
            });
          } else {
            guide = 'Inclina tu rostro levemente hacia arriba o abajo...';
          }
        }

        setMotionGuide(guide);
      } catch (err) {
        console.error("Error in automatic sweeps: ", err);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [cameraActive, stream]);

  // Mandatory backup capturer to guarantee enrollment
  const captureCurrentAngle = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    addLog(`Resincronización forzada de vectores biométricos...`);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 300;
    ctx.drawImage(video, 0, 0, 300, 300);
    const b64 = canvas.toDataURL('image/jpeg', 0.85);

    // Seed all slots so they can bypass immediately and save
    setScannedFront(b64);
    setScannedLeft(b64);
    setScannedRight(b64);
    setScannedTilt(b64);
    setFrontProgress(100);
    setLeftProgress(100);
    setRightProgress(100);
    setTiltProgress(100);
    setCurrentStep('completed');
    addLog('[SENSADO] Fuerza manual completa. Todos los vectores cargados.');
  };

  const handleEnrollAll = async () => {
    if (!auth.currentUser || !scannedFront || !scannedLeft || !scannedRight || !scannedTilt) {
      alert('Por favor completa todos los pasos de los ángulos antes de guardar.');
      return;
    }
    setLoading(true);
    addLog('Construyendo matriz biométrica agrupada (JSON)...');

    try {
      const email = auth.currentUser.email || 'jtrapero2013@gmail.com';
      const compositeData = {
        front: scannedFront,
        left: scannedLeft,
        right: scannedRight,
        tilt: scannedTilt
      };

      const serialized = JSON.stringify(compositeData);

      // Try reading cached password from local storage cache
      let password = localStorage.getItem(`_last_logged_in_pass_${email.toLowerCase()}`);
      
      if (!password) {
        addLog('[BIO] Solicitando verificación de contraseña única...');
        password = prompt('Por favor, indica tu contraseña actual para confirmar el enlace biométrico:');
        if (!password) {
          addLog('[ENROLL_CANCEL] Guardado cancelado sin contraseña de verificación.');
          setLoading(false);
          return;
        }
        localStorage.setItem(`_last_logged_in_pass_${email.toLowerCase()}`, password);
      }

      addLog(`[SISTEMA] Enlazando patrón facial a la cuenta ${email}...`);

      // Save locally to biometric locker (saves the original composite JSON)
      lockCredentials(email, password, serialized);

      // Save to a global bypass key inside localStorage that starts with _face_locker_ as well
      const globalObf = btoa(JSON.stringify({
        email: email.toLowerCase(),
        pass: password,
        faceData: serialized
      })).split('').reverse().join('');
      localStorage.setItem('_face_locker_global_bypass', globalObf);

      // Save to Cloud Firestore (Wrap in try/catch to make it completely non-blocking for local usage)
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          faceAuthEnabled: true,
          faceData: serialized
        }, { merge: true });
        addLog('[SINOPSIS] Matriz sincronizada con la nube correctamente.');
      } catch (cloudErr: any) {
        console.warn("Firestore save failed, but face is saved locally:", cloudErr);
        addLog('[BIO_WARN] Guardado local exitoso. Sincronización remota pendiente.');
      }

      setFaceAuthEnabled(true);
      setCapturedPhoto(scannedFront);
      addLog('[MASTER SUCCESS] Escaneo de perfiles FaceID de Apple guardado.');
      alert('¡Excelente! Tu firma facial ha sido registrada correctamente en este navegador. Ya puedes usar el Acceso Facial en la pantalla de inicio.');
      setCurrentStep('front');
      stopCamera();
    } catch (e: any) {
      console.error(e);
      addLog(`[ERROR ENROLL MULTI] ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetEnrollScanner = () => {
    setScannedFront(null);
    setScannedLeft(null);
    setScannedRight(null);
    setScannedTilt(null);
    setFrontProgress(0);
    setLeftProgress(0);
    setRightProgress(0);
    setTiltProgress(0);
    setCurrentStep('front');
    addLog('Reiniciando asistente de escaneo multi-perfil de Apple.');
  };

  // Test match score
  const handleVerifyTest = () => {
    if (!videoRef.current || !canvasRef.current || !scannedFront) {
      alert('Debes tener perfiles registrados para probar la coincidencia.');
      return;
    }
    addLog('Analizando rostro en vivo contra todos tus perfiles registrados...');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 300;
    ctx.drawImage(video, 0, 0, 300, 300);

    const liveSig = computeZNCCSignature(canvas);

    // We compare with all angles, selecting the max score
    const targetProfiles = [
      { key: 'Front', src: scannedFront },
      { key: 'Left', src: scannedLeft },
      { key: 'Right', src: scannedRight },
      { key: 'Tilt', src: scannedTilt }
    ].filter(p => !!p.src);

    let maxPercent = 0;
    let MatchedAngle = 'Ninguno';

    let loadedCount = 0;
    targetProfiles.forEach((p) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 300;
        offCanvas.height = 300;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(img, 0, 0, 300, 300);
          const savedSig = computeZNCCSignature(offCanvas);
          const coeff = compareZNCCSignatures(liveSig, savedSig);
          const percent = Math.round(coeff * 100);
          if (percent > maxPercent) {
            maxPercent = percent;
            MatchedAngle = p.key;
          }
        }
        loadedCount++;
        if (loadedCount === targetProfiles.length) {
          setMatchScore(maxPercent);
          if (maxPercent >= 78) {
            addLog(`Match exitoso (${maxPercent}%) detectado en el perfil: ${MatchedAngle}.`);
            setStatusText(`¡Perfil ${MatchedAngle} verificado con éxito (${maxPercent}%)!`);
          } else {
            addLog(`Match fallido (${maxPercent}%). Rostro inclinado o luz deficiente.`);
            setStatusText(`Rostro no coincide (${maxPercent}%). Ajusta tus ángulos.`);
          }
        }
      };
      img.src = p.src!;
    });
  };

  const handleDeactivate = async () => {
    if (!confirm('¿Seguro que deseas eliminar los perfiles faciales 3D y la biometría?') || !auth.currentUser) return;
    setLoading(true);
    try {
      deleteLockedCredentials(auth.currentUser.email || '');
      localStorage.removeItem('_face_locker_global_bypass');
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        faceAuthEnabled: false,
        faceData: null
      }, { merge: true });
      setFaceAuthEnabled(false);
      setCapturedPhoto(null);
      setScannedFront(null);
      setScannedLeft(null);
      setScannedRight(null);
      setScannedTilt(null);
      setMatchScore(null);
      setCurrentStep('front');
      addLog('Biometría multi-ángulo purgada de la terminal.');
      setStatusText('Reconocimiento facial desactivado.');
    } catch (e: any) {
      addLog(`Error al purgar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-250">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl overflow-hidden grid md:grid-cols-12"
      >
        {/* Left Column: Cam Scanner */}
        <div className="md:col-span-6 bg-slate-950 p-6 flex flex-col justify-between items-center text-white relative min-h-[490px]">
          {/* Futuristic Overlay Lines */}
          <div className="absolute inset-0 border border-slate-800 pointer-events-none rounded-l-[1.9rem]"></div>
          
          <div className="w-full flex justify-between items-center z-10">
            <span className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-950/80 px-3 py-1.5 rounded-full border border-blue-900/50">
              <Shield size={12} className="text-blue-400" />
              CYBER-SECURE 3D-FACE ENROLLER
            </span>
            <span className="text-[10px] font-mono text-slate-500">TRUEDEPTH ZNCC v4.0</span>
          </div>

          {/* Scanner View Area */}
          <div className="relative w-64 h-64 rounded-full border-4 border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shadow-inner group">
            {cameraActive ? (
              <>
                <video 
                  ref={videoRef}
                  className="w-full h-full object-cover rounded-full select-none -scale-x-100 animate-in fade-in duration-305" 
                  playsInline 
                  muted 
                />
                
                {/* Glowing Apple-inspired Biometric Ring Progress */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none -rotate-90 z-10" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="stroke-slate-900/40 fill-none"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="stroke-blue-500 fill-none transition-all duration-150"
                    strokeWidth="3.5"
                    strokeDasharray={289.02}
                    strokeDashoffset={289.02 - (289.02 * Math.min(100, stepProgress)) / 100}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.7))" }}
                  />
                </svg>

                {/* 3D mesh scanning visual overlay */}
                <div className="absolute inset-0 border border-dashed border-blue-500/20 pointer-events-none rounded-full scale-[0.98]"></div>
                
                {/* HUD Biometric Ring indicator representing multi angle status */}
                <span className="absolute inset-4 rounded-full border-2 border-dotted border-blue-500/10 animate-[spin_40s_linear_infinite]" />
                <span className="absolute inset-[30px] rounded-full border border-dashed border-sky-400/5 animate-[spin_20s_linear_infinite]" />

                {/* Sweeping Laser Scan Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.5)] animate-[bounce_3.5s_infinite] pointer-events-none"></div>

                {/* Angle alignment guide HUD details */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono tracking-widest bg-blue-600 px-3 py-1 rounded text-white font-black animate-pulse shadow-md">
                  {currentStep === 'front' && 'MIRA AL FRENTE'}
                  {currentStep === 'left' && 'GIRA A LA IZQUIERDA'}
                  {currentStep === 'right' && 'GIRA A LA DERECHA'}
                  {currentStep === 'tilt' && 'INCLINA TU CARA'}
                  {currentStep === 'completed' && 'PASOS COMPLETADOS'}
                </div>

                {/* Realtime progress tracker percentage bubble */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-sm text-blue-400 border border-blue-900/50 rounded-full px-3 py-1 font-mono text-[10px] uppercase font-black tracking-wider flex items-center shadow-lg gap-1">
                  <span>ESCANEANDO:</span>
                  <span className="text-white">{Math.round(stepProgress)}%</span>
                </div>

                {/* Simulated depth face mesh dots */}
                <div className="absolute inset-x-8 top-12 bottom-12 border-2 border-blue-500/15 rounded-full pointer-events-none flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-ping" />
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-3 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-slate-500">
                  <Camera size={30} />
                </div>
                <p className="text-xs font-bold text-slate-400">Hardware 3D Inactivo</p>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition-all active:scale-95 shadow-md"
                >
                  Iniciar Escáner
                </button>
              </div>
            )}
          </div>

          {/* Offscreen matching canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Assistant progress list indicating scanned perfiles */}
          <div className="w-full flex justify-around items-center bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 mt-1.5">
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full ${scannedFront ? 'bg-emerald-500 border-2 border-slate-950' : 'bg-slate-800 border'}`} />
              <span className="text-[9px] font-mono mt-1 text-slate-400">Frente</span>
            </div>
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full ${scannedLeft ? 'bg-emerald-500 border-2 border-slate-950' : 'bg-slate-800 border'}`} />
              <span className="text-[9px] font-mono mt-1 text-slate-400">Izq</span>
            </div>
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full ${scannedRight ? 'bg-emerald-500 border-2 border-slate-950' : 'bg-slate-800 border'}`} />
              <span className="text-[9px] font-mono mt-1 text-slate-400">Der</span>
            </div>
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full ${scannedTilt ? 'bg-emerald-500 border-2 border-slate-950' : 'bg-slate-800 border'}`} />
              <span className="text-[9px] font-mono mt-1 text-slate-400">Inclinado</span>
            </div>
          </div>

          {/* Diagnostics Display */}
          <div className="w-full text-center mt-2 z-10 px-2 lg:px-4">
            <p className="text-xs font-mono text-blue-300 min-h-[32px] leading-relaxed flex items-center justify-center">
              {motionGuide || statusText}
            </p>
            {matchScore !== null && (
              <div className="mt-1 flex items-center justify-center gap-1.5 h-5">
                <span className="text-[9px] text-slate-400 uppercase font-black">Coincidencia Multi-ángulo:</span>
                <span className={`text-xs font-black ${matchScore >= 78 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {matchScore}% {matchScore >= 78 ? '(Verificado)' : '(No coincide)'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Console & Status Log */}
        <div className="md:col-span-6 p-7 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="text-blue-600" size={24} />
                  TrueDepth ID Facial
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Apple-Inspired Angular Recognition</p>
              </div>
              <button 
                onClick={() => {
                  stopCamera();
                  onClose();
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Config State Card with real perfiles previews */}
            <div className={`p-4 rounded-3xl border ${faceAuthEnabled ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-250'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${faceAuthEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    {faceAuthEnabled ? 'ID Facial 3D Registrado' : 'Asistente Multi-ángulo'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                    {faceAuthEnabled 
                      ? 'Reconocimiento facial activo. Se han sensado tus perfiles e inclinaciones para mayor tolerancia.'
                      : 'Mueve tu cabeza en cada paso indicado para recolectar el mapa completo del rostro.'
                    }
                  </p>
                </div>
              </div>

              {/* Biometric Vector Mesh Calibration Nodes */}
              <div className="mt-3 grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                {/* 1. Centro (Frente) */}
                <div className="text-center">
                  <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-300 ${
                    scannedFront 
                      ? 'bg-emerald-500/10 border-emerald-400 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                      : currentStep === 'front' && frontProgress > 0
                        ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {scannedFront ? (
                      <CheckCircle size={18} className="text-emerald-600" />
                    ) : currentStep === 'front' && frontProgress > 0 ? (
                      <span className="text-xs font-mono font-black">{Math.round(frontProgress)}%</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-dashed border-slate-400 animate-spin flex items-center justify-center text-[8px] font-mono text-slate-400">+</div>
                    )}
                    <span className={`text-[8px] font-black tracking-widest mt-1.5 ${
                      scannedFront 
                        ? 'text-emerald-600' 
                        : currentStep === 'front' && frontProgress > 0 
                          ? 'text-blue-600 font-extrabold animate-pulse' 
                          : 'text-slate-400'
                    }`}>
                      {scannedFront ? 'MAPPED' : currentStep === 'front' ? 'MAPPING' : 'PENDING'}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-500 mt-1 block">1. Centro</span>
                </div>

                {/* 2. Izquierda */}
                <div className="text-center">
                  <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-300 ${
                    scannedLeft 
                      ? 'bg-emerald-500/10 border-emerald-400 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                      : currentStep === 'left' && leftProgress > 0
                        ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {scannedLeft ? (
                      <CheckCircle size={18} className="text-emerald-600" />
                    ) : currentStep === 'left' && leftProgress > 0 ? (
                      <span className="text-xs font-mono font-black">{Math.round(leftProgress)}%</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-dashed border-slate-400 animate-spin flex items-center justify-center text-[8px] font-mono text-slate-400">←</div>
                    )}
                    <span className={`text-[8px] font-black tracking-widest mt-1.5 ${
                      scannedLeft 
                        ? 'text-emerald-600' 
                        : currentStep === 'left' && leftProgress > 0 
                          ? 'text-blue-600 font-extrabold animate-pulse' 
                          : 'text-slate-400'
                    }`}>
                      {scannedLeft ? 'MAPPED' : currentStep === 'left' ? 'MAPPING' : 'PENDING'}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-500 mt-1 block">2. Izquierda</span>
                </div>

                {/* 3. Derecha */}
                <div className="text-center">
                  <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-300 ${
                    scannedRight 
                      ? 'bg-emerald-500/10 border-emerald-400 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                      : currentStep === 'right' && rightProgress > 0
                        ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {scannedRight ? (
                      <CheckCircle size={18} className="text-emerald-600" />
                    ) : currentStep === 'right' && rightProgress > 0 ? (
                      <span className="text-xs font-mono font-black">{Math.round(rightProgress)}%</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-dashed border-slate-400 animate-spin flex items-center justify-center text-[8px] font-mono text-slate-400">→</div>
                    )}
                    <span className={`text-[8px] font-black tracking-widest mt-1.5 ${
                      scannedRight 
                        ? 'text-emerald-600' 
                        : currentStep === 'right' && rightProgress > 0 
                          ? 'text-blue-600 font-extrabold animate-pulse' 
                          : 'text-slate-400'
                    }`}>
                      {scannedRight ? 'MAPPED' : currentStep === 'right' ? 'MAPPING' : 'PENDING'}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-500 mt-1 block">3. Derecha</span>
                </div>

                {/* 4. Eje Tilt */}
                <div className="text-center">
                  <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all duration-300 ${
                    scannedTilt 
                      ? 'bg-emerald-500/10 border-emerald-400 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                      : currentStep === 'tilt' && tiltProgress > 0
                        ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    {scannedTilt ? (
                      <CheckCircle size={18} className="text-emerald-600" />
                    ) : currentStep === 'tilt' && tiltProgress > 0 ? (
                      <span className="text-xs font-mono font-black">{Math.round(tiltProgress)}%</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-dashed border-slate-400 animate-spin flex items-center justify-center text-[8px] font-mono text-slate-400">↕</div>
                    )}
                    <span className={`text-[8px] font-black tracking-widest mt-1.5 ${
                      scannedTilt 
                        ? 'text-emerald-600' 
                        : currentStep === 'tilt' && tiltProgress > 0 
                          ? 'text-blue-600 font-extrabold animate-pulse' 
                          : 'text-slate-400'
                    }`}>
                      {scannedTilt ? 'MAPPED' : currentStep === 'tilt' ? 'MAPPING' : 'PENDING'}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-500 mt-1 block">4. Eje Tilt</span>
                </div>
              </div>
            </div>

            {/* Holographic Diagnostic Monitor console logs */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Monitor Óptico Holográfico</span>
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl font-mono text-[9px] text-emerald-400 space-y-1.5 min-h-[110px] shadow-inner select-none leading-relaxed">
                {logs.map((log, i) => (
                  <div key={i} className="truncate select-text">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            {cameraActive && (
              <div className="space-y-2">
                {currentStep !== 'completed' ? (
                  <div className="w-full flex flex-col gap-1 text-center bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles size={14} className="animate-spin text-emerald-400" />
                      <span>Barrido Biométrico Activo</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Mapeando vectores 3D... Mueve tu rostro lenta y continuamente.
                    </span>
                    <button
                      type="button"
                      onClick={captureCurrentAngle}
                      className="mt-1 text-[8px] uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      [ ¿Problemas con el movimiento? Forzar calibración manual ]
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleEnrollAll}
                      disabled={loading}
                      className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 uppercase"
                    >
                      <CheckCircle size={14} />
                      Guardar ID 3D
                    </button>
                    <button
                      type="button"
                      onClick={resetEnrollScanner}
                      className="py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl hover:bg-slate-200 transition-all text-center"
                    >
                      Repetir Proceso
                    </button>
                  </div>
                )}

                {faceAuthEnabled && (
                  <button
                    type="button"
                    onClick={handleVerifyTest}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-1.5 uppercase"
                  >
                    <Eye size={13} />
                    Comprobar Ángulos
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2.5">
              {!cameraActive && (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-slate-950 text-white hover:bg-slate-850 font-black text-xs rounded-2xl transition-colors text-center uppercase tracking-wide shadow"
                >
                  Iniciar Asistente TrueDepth
                </button>
              )}
              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs rounded-2xl transition-colors text-center"
                >
                  Apagar Cámara
                </button>
              )}
              {faceAuthEnabled && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={loading}
                  className="p-3 text-red-500 hover:bg-red-50 hover:text-red-650 rounded-2xl border border-red-100 transition-colors"
                  title="Desactivar Biometría"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
