import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BusinessCase, LogisticsType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Mic, MicOff, Volume2, VolumeX, Save, HelpCircle, 
  BrainCircuit, Calendar, FileText, CheckCircle, Database, ChevronRight, RefreshCw, BarChart2
} from 'lucide-react';
import CoraVectorAvatar from './CoraVectorAvatar';

interface CoraAssistantProps {
  onSuccess: (caseId: string) => void;
  compact?: boolean;
}

export default function CoraAssistant({ onSuccess, compact = false }: CoraAssistantProps) {
  // Conversational Interview State
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceActive, setVoiceActive] = useState(true);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Custom interaction flags for sandbox iframe guarantees
  const [hasPresented, setHasPresented] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [permissionError, setPermissionError] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Form Fields being filled
  const [form, setForm] = useState({
    title: '',
    userName: auth.currentUser?.displayName || '',
    selectedChannel: 'GRANDES CUENTAS' as 'ALIMENTACION' | 'GRANDES CUENTAS' | 'CONVENIENCIA' | 'IMPORTADAS',
    years: 5,
    logisticsType: LogisticsType.CAPILAR,
    // Importadas details
    projectName: '',
    negocio: 'Importadas',
    litrosAlimentacion: 0,
    formatosAlimentacion: '',
    litrosGrandesCuentas: 0,
    formatosGrandesCuentas: '',
    litrosConveniencia: 0,
    formatosConveniencia: '',
    precioCesionCosteFabricacion: 0,
    inversionComercialTercero: 0,
    // Point 3 - Logística, Registro y Otros fields
    creadorNombre: '',
    litrosPrevistos: 0,
    canalVenta: '',
    precioNeto: 0,
    logisticaIncoterm: '',
    trade: '',
    aportaciones: '',
    // Custom standard fields for Cora voice
    productsText: '',
    geographicText: '',
    equipmentText: ''
  });

  // Cora AI Training Status from Historical Cases
  const [historicalCases, setHistoricalCases] = useState<BusinessCase[]>([]);
  const [coldEquipmentMaster, setColdEquipmentMaster] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [trainingStats, setTrainingStats] = useState({
    totalAprobados: 0,
    averageYears: 5,
    commonLogistics: LogisticsType.CAPILAR,
    aiAccuracyLevel: 'Avanzado',
    casesEvaluated: 0
  });

  // Load past cases to "train" Cora
  useEffect(() => {
    const fetchCasesForTraining = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'businessCases'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessCase));
        setHistoricalCases(docs);

        // Fetch master catalogs
        const productSnap = await getDocs(collection(db, 'catalogProducts'));
        setAllProducts(productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const coldSnap = await getDocs(collection(db, 'coldEquipment'));
        setColdEquipmentMaster(coldSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        if (docs.length > 0) {
          const total = docs.length;
          // Calculate average years
          const sumYears = docs.reduce((acc, c) => acc + (c.years || 5), 0);
          const avgY = Math.round(sumYears / total);

          // Calculate most common logistics
          const logCounts: { [key: string]: number } = {};
          docs.forEach(c => {
            if (c.logisticsType) {
              logCounts[c.logisticsType] = (logCounts[c.logisticsType] || 0) + 1;
            }
          });
          let bestLog = LogisticsType.CAPILAR;
          let maxCount = 0;
          Object.entries(logCounts).forEach(([log, count]) => {
            if (count > maxCount) {
              maxCount = count;
              bestLog = log as LogisticsType;
            }
          });

          // Cora's self-improvement AI levels:
          let level = 'Inicial (Básico)';
          if (total >= 2) level = 'Intermedio (Recomendación inteligente habilitada)';
          if (total >= 5) level = 'Especialista de Negocio ';
          if (total >= 10) level = 'Senior Partner Consultor ';

          setTrainingStats({
            totalAprobados: docs.filter(c => c.status === 'positive').length,
            averageYears: avgY || 5,
            commonLogistics: bestLog,
            aiAccuracyLevel: level,
            casesEvaluated: total
          });
        }
      } catch (err) {
        console.error('Error fetching cases for Cora training:', err);
      }
    };
    fetchCasesForTraining();
  }, []);

  const steps = [
    {
      id: 'welcome',
      title: 'Presentación',
      voicePrompt: '¡Hola! Qué gusto saludarte. Soy Cora, tengo 30 años y seré tu asesora de viabilidad financiera. He analizado casos comerciales anteriores para afinar mis consejos. Comencemos, ¿cuál es tu nombre completo para la propuesta?',
      field: 'userName',
      helper: 'Dime tu nombre y cargo para colocarlo en la portada.',
      type: 'text'
    },
    {
      id: 'title',
      title: 'Nombre del Proyecto',
      voicePrompt: 'Perfecto. Ahora indícame cuál será el título o nombre comercial de este caso de negocio para guardarlo.',
      field: 'title',
      helper: 'Por ejemplo: "Lanzamiento Cerveza Premium" o "Ampliación de Gama"',
      type: 'text'
    },
    {
      id: 'channel',
      title: 'Canal de Venta',
      voicePrompt: `Dime cuál es el canal de venta principal para esta distribución. Puedes indicar Alimentación, Grandes Cuentas, Conveniencia o Importadas. Actualmente, el canal más rentable suele ser ${trainingStats.casesEvaluated > 0 ? 'el que usó tu último caso aprobado' : 'Grandes Cuentas'}.`,
      field: 'selectedChannel',
      helper: 'Al decir un canal, Cora cambiará automáticamente de formulario.',
      type: 'channel'
    },
    {
      id: 'years',
      title: 'Años del Proyecto',
      voicePrompt: `¿Cuántos años de plazo comercial quieres simular? Mi aprendizaje sobre tus ${trainingStats.casesEvaluated} casos anteriores sugiere usar ${trainingStats.averageYears} años para asegurar la amortización correcta de los activos.`,
      field: 'years',
      helper: 'Di un número de años (ej. 3, 5, 8).',
      type: 'number'
    },
    {
      id: 'logisticsType',
      title: 'Modo de Logística',
      voicePrompt: `¿Qué tipo de logística utilizarás? Di Capilar, Camión, Medio Camión o Pallet Directo. Tus datos históricos demuestran predilección por: ${trainingStats.commonLogistics}.`,
      field: 'logisticsType',
      helper: 'Por voz, di el modelo de transporte deseado.',
      type: 'logistics'
    },
    {
      id: 'productsText',
      title: 'Referencias del Caso de Negocio',
      voicePrompt: 'Ahora indícame qué referencias quieres incorporar al caso de negocio, o de qué marcas del catálogo. Ejemplo: Cerveza Especial, Cerveza Sin Filtros y Cerveza Reserva.',
      field: 'productsText',
      helper: 'Indica los nombres de los productos del catálogo principal.',
      type: 'text',
      condition: () => form.selectedChannel !== 'IMPORTADAS'
    },
    {
      id: 'geographicText',
      title: 'Presencia de Cobertura Geográfica',
      voicePrompt: 'Genial. Háblame de la cobertura o ubicaciones geográficas en porcentaje para esta simulación. Por ejemplo: Madrid veinte por ciento y Resto ochenta por ciento.',
      field: 'geographicText',
      helper: 'Indica ubicaciones y distribución de participación deseada.',
      type: 'text',
      condition: () => form.selectedChannel !== 'IMPORTADAS'
    },
    {
      id: 'equipmentText',
      title: 'Instalaciones y Equipos de Frío',
      voicePrompt: 'Por último, ¿qué activos e instalaciones de frío necesita el local o cliente? Ejemplo: Nevera expositora, Grifo de cerveza o Botelleros.',
      field: 'equipmentText',
      helper: 'Nombra los equipos de frío e instalaciones que requiere el local.',
      type: 'text',
      condition: () => form.selectedChannel !== 'IMPORTADAS'
    },
    // Optional Importadas sub-flow if channel was selected as Importadas
    {
      id: 'projectName',
      title: 'Proyecto de Importadas',
      voicePrompt: 'Has escogido el canal de Importadas. Dime el nombre específico del producto o línea de licores importados.',
      field: 'projectName',
      helper: 'Por ejemplo: "Ginebra Premium Especial"',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'litrosAlimentacion',
      title: 'Litros en Alimentación',
      voicePrompt: '¿Cuántos litros anuales estímas aproximar para el mercado de Alimentación tradicional?',
      field: 'litrosAlimentacion',
      helper: 'Di por ejemplo: Cien mil litros, o un número directo.',
      type: 'number',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'precioCesionCosteFabricacion',
      title: 'Coste Fabricación / Cesión',
      voicePrompt: 'Ahora, indícame el precio de cesión o coste de fabricación por litro para calcular con exactitud la rentabilidad neta.',
      field: 'precioCesionCosteFabricacion',
      helper: 'Di un decimal. Ejemplo: "uno con cincuenta" o "dos euros".',
      type: 'currency',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'creadorNombre',
      title: 'Nombre de Autoría',
      voicePrompt: 'A continuación, dime tu nombre y apellidos para registrar la autoría de este proyecto de importadas en el Punto 3.',
      field: 'creadorNombre',
      helper: 'Ej: Elena Ruiz',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'litrosPrevistos',
      title: 'Litros Previstos',
      voicePrompt: '¿Cuántos litros totales tienes previsto comercializar en este proyecto de importadas?',
      field: 'litrosPrevistos',
      helper: 'Di un número, ej: Veinte mil.',
      type: 'number',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'canalVenta',
      title: 'Canal de Venta',
      voicePrompt: '¿A qué canal de venta principal va dirigido el proyecto?',
      field: 'canalVenta',
      helper: 'Por ejemplo: Alimentación o Grandes Cuentas.',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'precioNeto',
      title: 'Precio Neto Objetivo',
      voicePrompt: '¿Cuál es el precio neto objetivo por litro de venta para este proyecto?',
      field: 'precioNeto',
      helper: 'Ejemplo: "dos euros con cincuenta" o "tres con diez".',
      type: 'currency',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'inversionComercialTercero',
      title: 'Inversión Comercial Terceros',
      voicePrompt: '¿Cuánto se invertirá en aportaciones comerciales para terceros?',
      field: 'inversionComercialTercero',
      helper: 'Detalla el monto en euros de la inversión.',
      type: 'number',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'logisticaIncoterm',
      title: 'Condiciones de Logística',
      voicePrompt: 'Dime las condiciones de logística o Incoterm y destinos. Por ejemplo: FOB Rotterdam a Madrid.',
      field: 'logisticaIncoterm',
      helper: 'Indica el Incoterm y ruta de distribución.',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'trade',
      title: 'Trade y Promociones',
      voicePrompt: 'Indícame las aportaciones de Trade o acciones promocionales estimadas para las importadas.',
      field: 'trade',
      helper: 'Ejemplo: Apoyos promocionales o degustaciones.',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'aportaciones',
      title: 'Otras Aportaciones o Subvenciones',
      voicePrompt: 'Por último para la sección de registro, detalla otras aportaciones, subvenciones o apoyos publicitarios previstos.',
      field: 'aportaciones',
      helper: 'Por ejemplo: Apoyos de marketing por el proveedor o subvenciones.',
      type: 'text',
      condition: () => form.selectedChannel === 'IMPORTADAS'
    },
    {
      id: 'summary',
      title: 'Confirmación y Síntesis',
      voicePrompt: '¡Fantástico! Tenemos los datos iniciales necesarios del Punto 3. Mis circuitos están listos para simular el escenario completo. Haz clic en Generar Caso de Negocio para consolidar tu caso.',
      field: 'generate',
      helper: 'Pulsa el botón de abajo para consolidar la simulación.',
      type: 'confirm'
    }
  ];

  // Filter steps according to current state condition
  const activeSteps = steps.filter(step => !step.condition || step.condition());
  const currentStepData = activeSteps[currentStep] || activeSteps[activeSteps.length - 1];

  // Vocalize function
  const speakText = (text: string) => {
    if (voiceMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    
    // Choose custom female voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('microsoft') || v.name.toLowerCase().includes('spanish')) && 
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('helena') || v.name.toLowerCase().includes('monica') || v.name.toLowerCase().includes('sara') || v.name.toLowerCase().includes('zira'))
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    // Smooth pleasant audio setup
    utterance.rate = 0.95; // Soft slightly slower conversational speed
    utterance.pitch = 1.05; // Friendly warm high tone
    
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (currentStepData && voiceActive && hasPresented) {
      speakText(currentStepData.voicePrompt);
    }
  }, [currentStep, voiceActive, hasPresented]);

  const getSuggestionForCurrentStep = () => {
    if (!currentStepData) return 'Juan Trapero';
    const field = currentStepData.field;
    if (field === 'userName') return 'Juan Trapero, Director';
    if (field === 'title') return 'Nueva Cerveza San Juan';
    if (field === 'selectedChannel') return 'Grandes Cuentas';
    if (field === 'years') return '5 años';
    if (field === 'logisticsType') return 'Capilar';
    if (field === 'productsText') return 'Cerveza Especial y Cerveza Sin Filtros';
    if (field === 'geographicText') return 'Madrid 40 % y Resto de España 60 %';
    if (field === 'equipmentText') return 'Nevera expositora y un Grifo estándar';
    if (field === 'projectName') return 'Ginebra Importada Premium';
    if (field === 'litrosAlimentacion') return '120000';
    if (field === 'precioCesionCosteFabricacion') return '1.80';
    return 'Confirmar';
  };

  const getSuggestionsListForCurrentStep = () => {
    if (!currentStepData) return [];
    const field = currentStepData.field;
    if (field === 'userName') return ['Juan Trapero, Especialista', 'Carlos Gómez, Director', 'María Reyes, Logística'];
    if (field === 'title') return ['Nueva Cerveza San Juan', 'Lanzamiento Especial Premium', 'Distribución Artesanal Craft'];
    if (field === 'selectedChannel') return ['Alimentación', 'Grandes Cuentas', 'Conveniencia', 'Importadas'];
    if (field === 'years') return ['3 años', '5 años', '7 años', '10 años'];
    if (field === 'logisticsType') return ['Capilar', 'Camión', 'Medio Camión', 'Pallet Directo'];
    if (field === 'productsText') return ['Cerveza Especial y Cerveza Sin Filtros', 'Cerveza Reserva con Cerveza Shandy', 'Catálogo Completo de Barriles'];
    if (field === 'geographicText') return ['Madrid 100 %', 'Barcelona 50 % y Madrid 50 %', 'Madrid 20 % y Resto de España 80 %'];
    if (field === 'equipmentText') return ['Nevera expositora y un Grifo estándar', 'Dos Grifos de cerveza premium', 'Un Botellero mediano y una Nevera principal'];
    if (field === 'projectName') return ['Ginebra Importada Premium', 'Licor Ron Añejo Selecto', 'Whisky Escocés Reserva'];
    if (field === 'litrosAlimentacion') return ['50.000 litros', '120.000 litros', '200.000 litros', '500.000 litros'];
    if (field === 'precioCesionCosteFabricacion') return ['1.50 €', '1.80 €', '2.20 €', '3.50 €'];
    return [];
  };

  const handleTriggerSuggestion = (val: string) => {
    if (!val) return;
    // Simulate real-time continuous typing animation so it feels like Cora is hearing the user
    setTranscription('Analizando...');
    let i = 0;
    const interval = setInterval(() => {
      if (i < val.length) {
        setTranscription(`🎤 Cora escuchó: "${val.substring(0, i + 1)}"`);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          handleInputParsed(val);
        }, 400);
      }
    }, 15);
  };

  const handleSimulateVoice = () => {
    const val = getSuggestionForCurrentStep();
    handleTriggerSuggestion(val);
  };

  const parseSpanishNumber = (text: string): number => {
    const cleanText = text.toLowerCase().trim()
      .replace(/[,]/g, '.')
      .replace(/[.](?=\d{3})/g, '')
      .replace(/[\s]/g, '');

    if (cleanText.includes('unmillón') || cleanText.includes('millón')) return 1000000;
    if (cleanText.includes('cienmil')) return 100000;
    if (cleanText.includes('cincuentamil')) return 50000;
    if (cleanText.includes('diezmil')) return 10000;
    if (cleanText.includes('cincomil')) return 5000;
    if (cleanText.includes('mil')) return 1000;

    let workingText = text.toLowerCase()
      .replace(/ con /g, '.')
      .replace(/ y /g, '.')
      .replace(/ coma /g, '.')
      .replace(/punto/g, '.');

    const wordNumbers: { [key: string]: string } = {
      'un': '1', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
      'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
    };
    Object.entries(wordNumbers).forEach(([word, val]) => {
      const reg = new RegExp(`\\b${word}\\b`, 'g');
      workingText = workingText.replace(reg, val);
    });

    const match = workingText.match(/\d+(\.\d+)?/);
    if (match) {
      let num = parseFloat(match[0]);
      if (text.toLowerCase().includes('mil') && num < 1000) {
        num *= 1000;
      }
      return num;
    }
    return 0;
  };

  const handleInputParsed = (transcript: string) => {
    const speechVal = transcript.trim();
    if (!speechVal || !currentStepData) return;

    setForm(prev => {
      const updated = { ...prev };
      const field = currentStepData.field as keyof typeof prev;

      if (currentStepData.type === 'text') {
        // Text binding
        (updated as any)[field] = speechVal;
        if (field === 'projectName') {
          updated.title = speechVal;
        }
      } else if (currentStepData.type === 'number' || currentStepData.type === 'currency') {
        const parsed = parseSpanishNumber(speechVal);
        (updated as any)[field] = parsed;
      } else if (currentStepData.type === 'channel') {
        const cleanUpper = speechVal.toUpperCase();
        if (cleanUpper.includes('ALIMENTACIÓN') || cleanUpper.includes('ALIMENTACION')) {
          updated.selectedChannel = 'ALIMENTACION';
        } else if (cleanUpper.includes('GRANDES') || cleanUpper.includes('CUENTAS') || cleanUpper.includes('ESPECIAL')) {
          updated.selectedChannel = 'GRANDES CUENTAS';
        } else if (cleanUpper.includes('CONVENIENCIA')) {
          updated.selectedChannel = 'CONVENIENCIA';
        } else if (cleanUpper.includes('IMPORTADAS') || cleanUpper.includes('CUESTIONARIO')) {
          updated.selectedChannel = 'IMPORTADAS';
        }
      } else if (currentStepData.type === 'logistics') {
        const cleanUpper = speechVal.toUpperCase();
        if (cleanUpper.includes('CAPILAR')) {
          updated.logisticsType = LogisticsType.CAPILAR;
        } else if (cleanUpper.includes('CAMIÓN') || cleanUpper.includes('CAMION')) {
          updated.logisticsType = LogisticsType.CAMION;
        } else if (cleanUpper.includes('MEDIO') || cleanUpper.includes('MITAD')) {
          updated.logisticsType = LogisticsType.MEDIO_CAMION;
        } else if (cleanUpper.includes('PALLET') || cleanUpper.includes('PALET')) {
          updated.logisticsType = LogisticsType.PALLET;
        }
      }

      return updated;
    });

    // Speak absolute confirmation to make Cora match humanized friendly style
    if (!voiceMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const confirmSpeech = new SpeechSynthesisUtterance(`Establecido: ${speechVal}.`);
      confirmSpeech.lang = 'es-ES';
      confirmSpeech.rate = 1.05;
      window.speechSynthesis.speak(confirmSpeech);
    }

    // Auto advancing
    setTimeout(() => {
      if (currentStep < activeSteps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }, 1200);
  };

const startSpeechRecognition = async () => {
  setPermissionError(false);

  try {
    console.clear();
    console.log("=== INICIO DIAGNÓSTICO CORA ===");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    console.log("SpeechRecognition API presente: " + (SpeechRecognition ? "SÍ" : "NO"));

    if (!SpeechRecognition) {
      alert(
        "SpeechRecognition no está disponible. Usa Google Chrome actualizado."
      );
      return;
    }

    console.log("Protocol: " + window.location.protocol);
    console.log("Host: " + window.location.host);
    console.log("Top Window: " + (window === window.top ? "SÍ" : "NO"));

    // Limpiar instancia anterior
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    // Mostrar dispositivos en formato simple sin objetos
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("=== DISPOSITIVOS ===");
      devices.forEach((d) => {
        console.log(
          "Dispositivo - Tipo: " + d.kind + " | Etiqueta: " + (d.label || "(sin nombre)")
        );
      });
    } catch (err: any) {
      console.warn("No se pudieron leer dispositivos: " + (err?.message || err));
    }

    // Solicitar micro de forma segura
    try {
      console.log("Solicitando acceso al micrófono...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      console.log("✅ Micrófono concedido");

      stream.getTracks().forEach((track) => {
        console.log("Track activo: " + track.label);
      });
    } catch (err: any) {
      console.error("❌ ERROR getUserMedia");
      console.error("name: " + err?.name);
      console.error("message: " + err?.message);

      setPermissionError(true);
      setTranscription(
        `Error de permisos del micrófono: ${err?.message || err}`
      );
      return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;

    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      console.log("🎤 Recognition START");
      setIsListening(true);
      setTranscription("Escuchando...");
    };

    rec.onaudiostart = () => {
      console.log("🔊 Audio detectado");
    };

    rec.onsoundstart = () => {
      console.log("🔉 Sonido detectado");
    };

    rec.onspeechstart = () => {
      console.log("🗣️ Voz detectada");
    };

    rec.onresult = (event: any) => {
      console.log("✅ RESULTADO RECIBIDO");

      let texto = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        texto += event.results[i][0].transcript;
      }

      console.log("Texto escuchado: " + texto);
      setTranscription(texto);

      if (texto.trim()) {
        handleInputParsed(texto);
      }
    };

    rec.onerror = (event: any) => {
      console.error("❌ Speech Error ocurrido");
      console.error("error: " + (event?.error || "desconocido"));

      setIsListening(false);
      setTranscription(
        `Speech Error: ${event?.error || "desconocido"}`
      );
    };

    rec.onend = () => {
      console.log("⏹ Recognition END");
      setIsListening(false);

      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
        mediaStreamRef.current = null;
      }
    };

    console.log("Iniciando reconocimiento...");
    rec.start();
    console.log("start() ejecutado correctamente");
  } catch (err: any) {
    console.error("🔥 ERROR GLOBAL EN VOZ");
    console.error("name: " + err?.name);
    console.error("message: " + err?.message);

    setTranscription(
      `ERROR GLOBAL: ${err?.message || "desconocido"}`
    );
  }
};


  const handleCreateBusinessCase = async () => {
    if (saving) return;
    setSaving(true);
    if (!form.title.trim()) {
      alert('Favor de proveer título al proyecto primero.');
      setSaving(false);
      return;
    }

    try {
      const newDoc: Partial<BusinessCase> = {
        userId: auth.currentUser?.uid || '',
        title: form.title,
        years: form.years,
        logisticsType: form.logisticsType,
        references: [],
        geographicService: [],
        equipmentSelection: {},
        status: 'pending',
        userName: form.userName,
        channel: form.selectedChannel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (form.selectedChannel !== 'IMPORTADAS') {
        const refs: any[] = [];
        if (form.productsText && allProducts.length > 0) {
          const txt = form.productsText.toLowerCase();
          allProducts.forEach(p => {
            const pName = p.name.toLowerCase();
            const pBrand = p.brand?.toLowerCase() || '';
            if (txt.includes(pName) || txt.includes(pBrand)) {
              refs.push({
                productId: p.id,
                name: p.name,
                litersPerYear: 5000,
                netPrice: p.cost * 1.5,
                rappel: 2,
                contribution: 0,
                family: p.family || '',
                brand: p.brand || '',
                format: p.format || '',
                packaging: p.packaging || '',
                cost: p.cost || 0
              });
            }
          });
        }
        if (refs.length === 0 && allProducts.length > 0) {
          const firstP = allProducts[0];
          refs.push({
            productId: firstP.id,
            name: firstP.name,
            litersPerYear: 1000,
            netPrice: firstP.cost * 1.5,
            rappel: 0,
            contribution: 0,
            family: firstP.family || '',
            brand: firstP.brand || '',
            format: firstP.format || '',
            packaging: firstP.packaging || '',
            cost: firstP.cost || 0
          });
        }
        newDoc.references = refs;

        let geo: any[] = [{ region: 'Nacional', percentage: 100 }];
        if (form.geographicText) {
          const txt = form.geographicText.toLowerCase();
          if (txt.includes('madrid')) {
            const parsedPct = parseInt(txt.match(/\d+/)?.at(0) || '') || 20;
            geo = [
              { region: 'Madrid', percentage: parsedPct },
              { region: 'Resto de España', percentage: 100 - parsedPct }
            ];
          } else if (txt.includes('barcelona') || txt.includes('barna')) {
            const parsedPct = parseInt(txt.match(/\d+/)?.at(0) || '') || 30;
            geo = [
              { region: 'Barcelona', percentage: parsedPct },
              { region: 'Resto de España', percentage: 100 - parsedPct }
            ];
          }
        }
        newDoc.geographicService = geo;

        const eqSel: { [eqId: string]: number } = {};
        if (form.equipmentText && coldEquipmentMaster.length > 0) {
          const txt = form.equipmentText.toLowerCase();
          coldEquipmentMaster.forEach(eq => {
            const eqName = eq.name.toLowerCase();
            if (txt.includes(eqName) || (eqName.includes('grifo') && txt.includes('grifo')) || (eqName.includes('nevera') && txt.includes('nevera')) || (eqName.includes('botellero') && txt.includes('botellero'))) {
              eqSel[eq.id!] = 1;
            }
          });
        }
        newDoc.equipmentSelection = eqSel;
      }

      if (form.selectedChannel === 'IMPORTADAS') {
        newDoc.importadasData = {
          negocio: form.negocio,
          projectName: form.projectName || form.title,
          litrosAlimentacion: form.litrosAlimentacion,
          formatosAlimentacion: form.formatosAlimentacion,
          litrosHT: 0,
          formatosHT: '',
          litrosGrandesCuentas: form.litrosGrandesCuentas,
          formatosGrandesCuentas: form.formatosGrandesCuentas,
          litrosConveniencia: form.litrosConveniencia,
          formatosConveniencia: form.formatosConveniencia,
          pnHT1: 0,
          pnHT2: 0,
          pnConveniencia: 0,
          pnGrandesCuentas: 0,
          pnnAlimentacion: 0,
          pnnHT: 0,
          pnnConveniencia: 0,
          pnnGrandesCuentas: 0,
          pvpAlimentacion: 0,
          precioCesion: form.precioCesionCosteFabricacion,
          inversionComercial: form.inversionComercialTercero,
          // Point 3 - Logística, Registro y Otros fields
          creadorNombre: form.creadorNombre || form.userName,
          litrosPrevistos: form.litrosPrevistos,
          canalVenta: form.canalVenta,
          precioNeto: form.precioNeto,
          precioCesionCosteFabricacion: form.precioCesionCosteFabricacion,
          inversionComercialTercero: form.inversionComercialTercero,
          logisticaIncoterm: form.logisticaIncoterm,
          trade: form.trade,
          aportaciones: form.aportaciones
        };
      }

      const docRef = await addDoc(collection(db, 'businessCases'), newDoc);
      alert('¡El Asistente de Voz Cora ha guardado el nuevo caso de negocio exitosamente!');
      onSuccess(docRef.id);
    } catch (e) {
      console.error(e);
      alert('Error guardando caso financiero.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${compact ? 'max-w-full space-y-6' : 'max-w-3xl mx-auto space-y-8'} animate-in fade-in duration-500`}>
      <div className="space-y-6">
        
        {/* CONVERSATIONAL FORM BEING FILLED */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-slate-800 text-base">Ficha de Captura Digital</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 border px-2.5 py-0.5 rounded-full uppercase">
              Actualizado en Vivo
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs font-bold">
            
            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
              <span className="text-[9px] font-black uppercase text-slate-450">Creador Autor</span>
              <input 
                type="text" 
                value={form.userName} 
                onChange={(e) => setForm(f => ({ ...f, userName: e.target.value }))}
                className="w-full bg-white p-2 border border-slate-200 rounded-xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
              <span className="text-[9px] font-black uppercase text-slate-450">Nombre / Título del Caso</span>
              <input 
                type="text" 
                value={form.title} 
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-white p-2 border border-slate-200 rounded-xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
              <span className="text-[9px] font-black uppercase text-slate-450">Canal Seleccionado</span>
              <select 
                value={form.selectedChannel}
                onChange={(e) => setForm(f => ({ ...f, selectedChannel: e.target.value as any }))}
                className="w-full bg-white p-2 border border-slate-200 rounded-xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              >
                <option value="ALIMENTACION">Alimentación</option>
                <option value="GRANDES CUENTAS">Grandes Cuentas</option>
                <option value="CONVENIENCIA">Conveniencia</option>
                <option value="IMPORTADAS">Importadas (Cuestionario Completo)</option>
              </select>
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
              <span className="text-[9px] font-black uppercase text-slate-450">Años de Duración del Proyecto</span>
              <input 
                type="number" 
                value={form.years} 
                onChange={(e) => setForm(f => ({ ...f, years: parseInt(e.target.value) || 0 }))}
                className="w-full bg-white p-2 border border-slate-200 rounded-xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 col-span-2">
              <span className="text-[9px] font-black uppercase text-slate-450">Logística de Transporte</span>
              <select 
                value={form.logisticsType}
                onChange={(e) => setForm(f => ({ ...f, logisticsType: e.target.value as LogisticsType }))}
                className="w-full bg-white p-2 border border-slate-200 rounded-xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              >
                <option value={LogisticsType.CAPILAR}>Capilar (Multimarca / Logística de Proximidad)</option>
                <option value={LogisticsType.CAMION}>Camión Completo</option>
                <option value={LogisticsType.MEDIO_CAMION}>Medio Camión</option>
                <option value={LogisticsType.PALLET}>Pallet Directo</option>
              </select>
            </div>

          </div>

          {/* If IMPORTADAS, show the nested specific questionnaire */}
          {form.selectedChannel === 'IMPORTADAS' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 pt-4 border-t border-dashed border-slate-200"
            >
              <div className="flex items-center gap-1.5">
                <span className="p-1 px-2.5 rounded-lg bg-indigo-50 text-indigo-750 font-black text-[10px] uppercase">
                  Canal Importadas - Campos Especiales
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450">Nombre Proyecto de Importación</span>
                  <input 
                    type="text" 
                    value={form.projectName} 
                    onChange={(e) => setForm(f => ({ ...f, projectName: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450">Litros Anuales Alimentación</span>
                  <input 
                    type="number" 
                    value={form.litrosAlimentacion} 
                    onChange={(e) => setForm(f => ({ ...f, litrosAlimentacion: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450">Precio de Cesión por Litro (€)</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={form.precioCesionCosteFabricacion} 
                    onChange={(e) => setForm(f => ({ ...f, precioCesionCosteFabricacion: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450">Invasión / Aportación Comercial a Tercero (€)</span>
                  <input 
                    type="number" 
                    value={form.inversionComercialTercero} 
                    onChange={(e) => setForm(f => ({ ...f, inversionComercialTercero: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450 font-bold">Autor / Creador Punto 3</span>
                  <input 
                    type="text" 
                    value={form.creadorNombre} 
                    onChange={(e) => setForm(f => ({ ...f, creadorNombre: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="Eje: Elena Ruiz"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450 font-bold">Litros Previstos Totales</span>
                  <input 
                    type="number" 
                    value={form.litrosPrevistos || ''} 
                    onChange={(e) => setForm(f => ({ ...f, litrosPrevistos: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 font-bold">
                  <span className="text-[9px] font-black uppercase text-slate-440">Canal de Venta Principal</span>
                  <input 
                    type="text" 
                    value={form.canalVenta} 
                    onChange={(e) => setForm(f => ({ ...f, canalVenta: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="Eje: Alimentación o Grandes Cuentas"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150">
                  <span className="text-[9px] font-black uppercase text-slate-450 font-bold">Precio Neto Objetivo (€)</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={form.precioNeto || ''} 
                    onChange={(e) => setForm(f => ({ ...f, precioNeto: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 md:col-span-2">
                  <span className="text-[9px] font-black uppercase text-slate-450 font-bold">Condiciones Logística (Incoterm y Destino)</span>
                  <input 
                    type="text" 
                    value={form.logisticaIncoterm} 
                    onChange={(e) => setForm(f => ({ ...f, logisticaIncoterm: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="Ej: FOB Rotterdam a Madrid"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 font-bold">
                  <span className="text-[9px] font-black uppercase text-slate-440">Acciones de Trade y Promoción</span>
                  <input 
                    type="text" 
                    value={form.trade} 
                    onChange={(e) => setForm(f => ({ ...f, trade: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="Ej: Acciones promocionales"
                  />
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 font-bold">
                  <span className="text-[9px] font-black uppercase text-slate-440">Otras Aportaciones / Subvenciones</span>
                  <input 
                    type="text" 
                    value={form.aportaciones} 
                    onChange={(e) => setForm(f => ({ ...f, aportaciones: e.target.value }))}
                    className="w-full bg-white p-2 border border-slate-200 rounded-xl outline-none text-slate-800"
                    placeholder="Ej: Subvenciones o apoyos publicitarios"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end items-center">
            <button
              type="button"
              onClick={handleCreateBusinessCase}
              disabled={saving || !form.title.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-100 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 cursor-pointer"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={14} />
                  Generar Caso de Negocio Analizado
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
