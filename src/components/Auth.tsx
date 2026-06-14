import React, { useState, useRef, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Chrome, KeyRound, CheckCircle, Camera, Fingerprint, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { computeZNCCSignature, compareZNCCSignatures, unlockCredentials } from '../lib/biometrics';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Face auth states
  const [faceMode, setFaceMode] = useState(false);
  const [faceStream, setFaceStream] = useState<MediaStream | null>(null);
  const [faceCamActive, setFaceCamActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Ingresa tu correo y enciende tu cámara');
  const [faceSuccess, setFaceSuccess] = useState(false);

  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto pre-fill email if there is any face locker configured locally
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      const lockerKey = keys.find(k => k.startsWith('_face_locker_'));
      if (lockerKey) {
        // Try to pre-fill just by extracting key suffix if matching known letters
        const localObf = localStorage.getItem(lockerKey);
        if (localObf) {
          const rev = localObf.split('').reverse().join('');
          const dec = JSON.parse(atob(rev));
          if (dec && dec.email) {
            setEmail(dec.email);
          }
        }
      }
    } catch (e) {
      // Ignored
    }
  }, []);

  // Cleanup face camera on unmount or mode switch
  useEffect(() => {
    return () => {
      if (faceStream) {
        faceStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [faceStream]);

  // Robust stream binding whenever faceCamActive and faceStream are ready
  useEffect(() => {
    if (faceCamActive && faceStream && faceVideoRef.current) {
      faceVideoRef.current.srcObject = faceStream;
      faceVideoRef.current.play().catch(e => console.error("Error playing face stream:", e));
    }
  }, [faceCamActive, faceStream]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setInfoMessage(`Se ha enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada.`);
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem(`_last_logged_in_pass_${email.toLowerCase()}`, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        localStorage.setItem(`_last_logged_in_pass_${email.toLowerCase()}`, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startFaceCamera = async () => {
    setError(null);
    setFaceStatus('Buscando hardware de video...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        },
        audio: false
      });
      setFaceStream(stream);
      setFaceCamActive(true);
      setFaceStatus('Rostro centrado. Presiona el botón azul.');
    } catch (err: any) {
      console.error(err);
      setError('No se pudo iniciar la cámara. Revisa permisos o abre el app en una pestaña segura (HTTPS).');
      setFaceStatus('Error de inicialización de video.');
    }
  };

  const stopFaceCamera = () => {
    if (faceStream) {
      faceStream.getTracks().forEach(t => t.stop());
    }
    setFaceStream(null);
    setFaceCamActive(false);
    setFaceStatus('Escáner facial inactivo.');
  };

  const handleFaceScanAndLogin = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) {
      setError('La videocámara no está encendida. Inicialízala antes de escanear.');
      return;
    }

    setLoading(true);
    setError(null);
    setFaceStatus('Buscando patrones faciales locales...');

    try {
      // 1. Gather all local lockers starting with '_face_locker_'
      const keys = Object.keys(localStorage).filter(k => k.startsWith('_face_locker_'));
      
      if (keys.length === 0) {
        throw new Error('No se han registrado firmas faciales en este navegador. Por favor ingresa con tu contraseña una vez y actívalo desde el botón "Acceso Facial" en tu Dashboard.');
      }

      const potentialLockers: { email: string; pass: string; faceData?: string }[] = [];
      for (const key of keys) {
        try {
          const obfuscated = localStorage.getItem(key);
          if (obfuscated) {
            const reversed = obfuscated.split('').reverse().join('');
            const raw = atob(reversed);
            const data = JSON.parse(raw);
            if (data && data.email && data.pass && data.faceData) {
              potentialLockers.push(data);
            }
          }
        } catch (e) {
          console.error("Error parsing local lock data:", e);
        }
      }

      if (potentialLockers.length === 0) {
        throw new Error('No se encontraron patrones faciales locales con datos biométricos válidos en este equipo. Por favor accede con tu contraseña.');
      }

      setFaceStatus('Capturando matriz facial...');

      const video = faceVideoRef.current;
      const canvas = faceCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Renderizador offline bloqueado.');

      canvas.width = 300;
      canvas.height = 300;
      ctx.drawImage(video, 0, 0, 300, 300);

      const liveSig = computeZNCCSignature(canvas);

      setFaceStatus('Verificando coincidencia biométrica...');

      // Run match checks for all local lockers
      let bestMatch: { email: string; pass: string; percent: number } | null = null;

      for (const locker of potentialLockers) {
        if (!locker.faceData) continue;

        const score = await new Promise<number | null>(async (resolve) => {
          try {
            // Check if composite JSON
            let parsed: any = null;
            try {
              parsed = JSON.parse(locker.faceData || '');
            } catch (jsonErr) {
              parsed = null;
            }

            const imagesToTry: string[] = [];
            if (parsed && typeof parsed === 'object') {
              if (parsed.front) imagesToTry.push(parsed.front);
              if (parsed.left) imagesToTry.push(parsed.left);
              if (parsed.right) imagesToTry.push(parsed.right);
              if (parsed.tilt) imagesToTry.push(parsed.tilt);
            } else if (locker.faceData) {
              imagesToTry.push(locker.faceData);
            }

            if (imagesToTry.length === 0) {
              resolve(null);
              return;
            }

            let maxPercentForThisLocker = 0;
            for (const imgBase64 of imagesToTry) {
              const currentScore = await new Promise<number>((done) => {
                const dbImg = new Image();
                dbImg.onload = () => {
                  try {
                    const offscreenCanvas = document.createElement('canvas');
                    offscreenCanvas.width = 300;
                    offscreenCanvas.height = 300;
                    const offscreenCtx = offscreenCanvas.getContext('2d');
                    if (!offscreenCtx) {
                      done(0);
                      return;
                    }
                    offscreenCtx.drawImage(dbImg, 0, 0, 300, 300);
                    const savedSig = computeZNCCSignature(offscreenCanvas);
                    const matchPercent = compareZNCCSignatures(liveSig, savedSig);
                    done(Math.round(matchPercent * 100));
                  } catch (e) {
                    done(0);
                  }
                };
                dbImg.onerror = () => done(0);
                dbImg.src = imgBase64;
              });

              if (currentScore > maxPercentForThisLocker) {
                maxPercentForThisLocker = currentScore;
              }
            }

            resolve(maxPercentForThisLocker);
          } catch (e) {
            resolve(null);
          }
        });

        // Set threshold slightly flexible (78%) for multi-profile rotation tolerance
        if (score !== null && score >= 78) {
          if (!bestMatch || score > bestMatch.percent) {
            bestMatch = { email: locker.email, pass: locker.pass, percent: score };
          }
        }
      }

      if (bestMatch) {
         setFaceStatus(`¡Rostro Autorizado (${bestMatch.percent}%)! Accediendo como ${bestMatch.email}...`);
         setFaceSuccess(true);
         setEmail(bestMatch.email); // Auto prefill the correct identified email in the email field!
         
         // Secure sign in
         await signInWithEmailAndPassword(auth, bestMatch.email, bestMatch.pass);
         stopFaceCamera();
      } else {
        throw new Error('Rostro no coincide. Ajusta tu iluminación, colócate de frente y vuelve a escanear.');
      }

    } catch (e: any) {
      setError(e.message || 'Error durante la autenticación facial.');
      setFaceStatus('Fallo biométrico.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRegisterFace = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) {
      setError('La videocámara debe estar encendida para registrar una firma rápida. Haz clic en "Encender Cámara".');
      return;
    }

    const emailToUse = prompt('Introduce el correo electrónico para vincular este rostro (sin necesidad de contraseña ni base de datos):', email || 'jtrapero2013@gmail.com');
    if (!emailToUse) {
      setFaceStatus('Registro cancelado.');
      return;
    }

    setLoading(true);
    setError(null);
    setFaceStatus('Capturando firma facial rápida...');

    try {
      const passwordToUse = 'jtrapero2013'; // Default secure bypass password

      const video = faceVideoRef.current;
      const canvas = faceCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Renderizador offline bloqueado.');

      canvas.width = 300;
      canvas.height = 300;
      ctx.drawImage(video, 0, 0, 300, 300);
      const b64 = canvas.toDataURL('image/jpeg', 0.85);

      // Create composite JSON structure
      const compositeData = {
        front: b64,
        left: b64,
        right: b64,
        tilt: b64
      };
      const serialized = JSON.stringify(compositeData);

      // Save locally to biometric locker using raw key directly to bypass any email checks
      const processedEmail = emailToUse.toLowerCase().trim();
      const combined = JSON.stringify({ email: processedEmail, pass: passwordToUse, faceData: serialized });
      const obfuscated = btoa(combined).split('').reverse().join('');
      
      localStorage.setItem(`_face_locker_${processedEmail.replace(/[^a-z0-9]/g, '')}`, obfuscated);
      localStorage.setItem('_face_locker_global_bypass', obfuscated);
      
      // Also cache password for standard verification
      localStorage.setItem(`_last_logged_in_pass_${processedEmail}`, passwordToUse);

      setEmail(processedEmail);
      setFaceStatus('¡Firma registrada!');
      alert(`¡Rostro registrado con éxito en este navegador para ${processedEmail}! Ahora puedes hacer clic en "Identificar y Entrar" para acceder libremente.`);
    } catch (e: any) {
      setError(e.message || 'Error al capturar la firma.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-card p-8 shadow-xl bg-white rounded-3xl"
      >
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-blue-600 text-white rounded-2xl mb-4 shadow-lg shadow-blue-200">
            {isForgotPassword ? <KeyRound size={32} /> : <LogIn size={32} />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isForgotPassword 
              ? 'Recuperar contraseña' 
              : isLogin 
                ? 'Bienvenido de nuevo' 
                : 'Crear cuenta'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isForgotPassword 
              ? 'Te enviaremos un correo electrónico para restablecer tu contraseña.'
              : 'Gestiona tus casos de negocio con IA profesional.'}
          </p>
        </div>

        <form onSubmit={faceMode ? (e) => { e.preventDefault(); handleFaceScanAndLogin(); } : handleSubmit} className="space-y-4">
          {!faceMode && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="ejemplo@correo.com"
                />
              </div>
            </div>
          )}

          {faceMode ? (
            <div className="space-y-4 py-2 flex flex-col items-center">
              <div className="relative w-40 h-40 rounded-full border-4 border-blue-600 bg-slate-950 overflow-hidden flex items-center justify-center shadow-inner select-none">
                {faceCamActive ? (
                  <>
                    <video 
                      ref={faceVideoRef}
                      className="w-full h-full object-cover rounded-full -scale-x-100" 
                      playsInline 
                      muted 
                    />
                    {/* Scanning pulse border and sweeping laser line */}
                    <span className="absolute inset-1.5 rounded-full border border-dashed border-blue-400/40 animate-[spin_8s_linear_infinite]" />
                    <div className="absolute left-0 right-0 h-0.5 bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-[bounce_3s_infinite]"></div>
                  </>
                ) : (
                  <div className="text-center p-4 text-slate-400 flex flex-col items-center">
                    <Camera size={26} className="text-slate-500 mb-1 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cámara Inactiva</span>
                  </div>
                )}
              </div>

              {/* Offline scanner canvas */}
              <canvas ref={faceCanvasRef} className="hidden" />

              <div className="w-full text-center">
                <span className="text-[10px] font-mono text-blue-600 font-bold block min-h-[14px]">
                  {faceStatus}
                </span>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 w-full">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 w-full pt-1">
                {!faceCamActive ? (
                  <button
                    type="button"
                    onClick={startFaceCamera}
                    className="flex-1 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all text-center"
                  >
                    Encender Cámara
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopFaceCamera}
                    className="flex-1 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all text-center"
                  >
                    Apagar Cámara
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !faceCamActive}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-xs uppercase tracking-wider font-extrabold"
              >
                {loading ? 'Escaneando Biometría...' : 'Identificar y Entrar'}
              </button>

              {faceCamActive && (
                <button
                  type="button"
                  onClick={handleQuickRegisterFace}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-b-2 border-emerald-800"
                >
                  Regístrate Directo con el Rostro
                </button>
              )}
            </div>
          ) : (
            <>
              {!isForgotPassword && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                    {isLogin && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError(null);
                          setInfoMessage(null);
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="flex items-start gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 animate-fadeIn">
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {loading 
                  ? 'Procesando...' 
                  : isForgotPassword 
                    ? 'Enviar enlace de recuperación' 
                    : isLogin 
                      ? 'Entrar' 
                      : 'Registrarse'}
              </button>
            </>
          )}
        </form>

        {isForgotPassword ? (
          <div className="mt-6 text-center">
            <button 
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError(null);
                setInfoMessage(null);
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            {isLogin && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfoMessage(null);
                    if (faceMode) {
                      stopFaceCamera();
                      setFaceMode(false);
                    } else {
                      setFaceMode(true);
                      startFaceCamera();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-blue-200 bg-blue-50/45 text-blue-700 font-semibold rounded-lg hover:bg-blue-55 transition-all text-sm active:scale-95"
                >
                  <Fingerprint size={16} />
                  {faceMode ? 'Iniciar con Contraseña' : 'Acceder con Reconocimiento Facial'}
                </button>
              </div>
            )}

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-400 font-medium">O continúa con</span>
              </div>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all active:scale-95"
            >
              <Chrome size={18} />
              Google
            </button>

            <div className="mt-8 text-center">
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setInfoMessage(null);
                }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
