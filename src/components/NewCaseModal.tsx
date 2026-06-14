import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BusinessCase, CatalogProduct, ReferenceInput, LogisticsType, GeoService, ColdEquipment, CoraTrainingRule } from '../types';
import { Search, Filter, Plus, Trash2, X, Check, Save, Calculator, Info, ChevronRight, FileText, ArrowLeft, ArrowRight, User, HelpCircle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import XLSX from 'xlsx-js-style';
import CoraVectorAvatar from './CoraVectorAvatar';

interface NewCaseModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
  initialData?: Partial<BusinessCase>;
  caseId?: string;
}

type WizardStep = 'cover' | 'channel' | 'standard' | 'importadas' | 'soon';

export default function NewCaseModal({ onClose, onSuccess, initialData, caseId }: NewCaseModalProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('cover');
  const [selectedChannel, setSelectedChannel] = useState<'ALIMENTACION' | 'GRANDES CUENTAS' | 'CONVENIENCIA' | 'IMPORTADAS' | ''>('');
  const [userName, setUserName] = useState('');

  // Standard case state
  const [basicData, setBasicData] = useState({
    title: initialData?.title || '',
    years: initialData?.years || 5,
    logisticsType: initialData?.logisticsType || LogisticsType.CAPILAR
  });

  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<ReferenceInput[]>(initialData?.references || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Geographic and Technical (Installation) States
  const [coldEquipmentMaster, setColdEquipmentMaster] = useState<ColdEquipment[]>([]);
  const [geographicService, setGeographicService] = useState<GeoService[]>(initialData?.geographicService || [{ region: 'Nacional', percentage: 100 }]);
  const [equipmentSelection, setEquipmentSelection] = useState<{ [equipmentId: string]: number }>(initialData?.equipmentSelection || {});

  const [coraTraining, setCoraTraining] = useState<CoraTrainingRule[]>([]);

  // Matrix Filter State (For standard case)
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    family: '',
    packaging: '',
    format: ''
  });

  // Importadas 16 questions questionnaire state
  const [importadasData, setImportadasData] = useState({
    projectName: initialData?.title || '',
    duracionAnios: initialData?.years || 5,
    negocio: 'Importadas', // Importadas, Vinos, Spirits, Custom, Cerveza, Agua y bebidas saludables
    categorias: ['Importadas'],
    litrosHT: 0,
    formatosHT: '',
    litrosAlimentacion: 0,
    formatosAlimentacion: '',
    litrosGrandesCuentas: 0,
    formatosGrandesCuentas: '',
    litrosConveniencia: 0,
    formatosConveniencia: '',
    pnHT1: 0,
    pnHT2: 0,
    pnConveniencia: 0,
    pnGrandesCuentas: 0,
    pnnAlimentacion: 0,
    pnnHT: 0,
    pnnConveniencia: 0,
    pnnGrandesCuentas: 0,
    pvpAlimentacion: 0,
    precioCesion: 0,
    inversionComercial: 0,
    creadorNombre: '',
    litrosPrevistos: 0,
    canalVenta: '',
    precioNeto: 0,
    precioCesionCosteFabricacion: 0,
    inversionComercialTercero: 0,
    logisticaIncoterm: '',
    trade: '',
    aportaciones: ''
  });

  // Load User Profile Name & Catalog Products
  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          setUserName(docSnap.data().name || '');
        } else {
          setUserName(auth.currentUser?.displayName || '');
        }
      });
    }

    const unsubCatalog = onSnapshot(collection(db, 'catalogProducts'), (snap) => {
      setAllProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
      setLoading(false);
    });

    const unsubCold = onSnapshot(collection(db, 'coldEquipment'), (snap) => {
      setColdEquipmentMaster(snap.docs.map(d => ({ id: d.id, ...d.data() } as ColdEquipment)));
    });

    return () => {
      unsubCatalog();
      unsubCold();
    };
  }, []);

  // Map conversational references without product IDs to actual catalog elements on load
  useEffect(() => {
    if (initialData?.references && allProducts.length > 0) {
      const mappedRefs = initialData.references.map(ref => {
        if (!ref.productId) {
          const match = allProducts.find(p => p.name.toLowerCase().includes(ref.name.toLowerCase()) || ref.name.toLowerCase().includes(p.name.toLowerCase()));
          if (match) {
            return {
              ...ref,
              productId: match.id,
              family: match.family || '',
              brand: match.brand || '',
              format: match.format || '',
              packaging: match.packaging || '',
              cost: match.cost || 0
            };
          }
        }
        return ref;
      });
      setSelectedReferences(mappedRefs);
    }
  }, [initialData, allProducts]);

  // Load existing case data if in edit mode
  useEffect(() => {
    if (caseId) {
      getDoc(doc(db, 'businessCases', caseId)).then((snap) => {
        if (snap.exists()) {
          const caseData = snap.data() as BusinessCase;
          setBasicData({
            title: caseData.title || '',
            years: caseData.years || 5,
            logisticsType: caseData.logisticsType || LogisticsType.CAPILAR
          });
          
          if (caseData.channel === 'IMPORTADAS' && caseData.importadasData) {
            setSelectedChannel('IMPORTADAS');
            setWizardStep('importadas');
            const imp = caseData.importadasData;
            setImportadasData({
              projectName: caseData.title || '',
              duracionAnios: caseData.years || 5,
              negocio: imp.negocio || 'Importadas',
              categorias: imp.categorias || (imp.negocio ? [imp.negocio] : ['Importadas']),
              litrosHT: imp.litrosHT || 0,
              formatosHT: imp.formatosHT || '',
              litrosAlimentacion: imp.litrosAlimentacion || 0,
              formatosAlimentacion: imp.formatosAlimentacion || '',
              litrosGrandesCuentas: imp.litrosGrandesCuentas || 0,
              formatosGrandesCuentas: imp.formatosGrandesCuentas || '',
              litrosConveniencia: imp.litrosConveniencia || 0,
              formatosConveniencia: imp.formatosConveniencia || '',
              pnHT1: imp.pnHT1 || 0,
              pnHT2: imp.pnHT2 || 0,
              pnConveniencia: imp.pnConveniencia || 0,
              pnGrandesCuentas: imp.pnGrandesCuentas || 0,
              pnnAlimentacion: imp.pnnAlimentacion || 0,
              pnnHT: imp.pnnHT || 0,
              pnnConveniencia: imp.pnnConveniencia || 0,
              pnnGrandesCuentas: imp.pnnGrandesCuentas || 0,
              pvpAlimentacion: imp.pvpAlimentacion || 0,
              precioCesion: imp.precioCesion || 0,
              inversionComercial: imp.inversionComercial || 0,
              creadorNombre: imp.creadorNombre || '',
              litrosPrevistos: imp.litrosPrevistos || 0,
              canalVenta: imp.canalVenta || '',
              precioNeto: imp.precioNeto || 0,
              precioCesionCosteFabricacion: imp.precioCesionCosteFabricacion || 0,
              inversionComercialTercero: imp.inversionComercialTercero || 0,
              logisticaIncoterm: imp.logisticaIncoterm || '',
              trade: imp.trade || '',
              aportaciones: imp.aportaciones || ''
            });
          } else {
            if (caseData.channel) {
              setSelectedChannel(caseData.channel as any);
            } else {
              setSelectedChannel('ALIMENTACION');
            }
            setWizardStep('standard');
            if (caseData.references) {
              setSelectedReferences(caseData.references);
            }
            if (caseData.geographicService) {
              setGeographicService(caseData.geographicService);
            }
            if (caseData.equipmentSelection) {
              setEquipmentSelection(caseData.equipmentSelection);
            }
          }
        }
      });
    }
  }, [caseId]);

  // --- VOICE ASSISTANT STATE AND LOGIC ---
  const [voiceActive, setVoiceActive] = useState(() => {
    if (typeof window !== 'undefined' && (window as any).coraAutoStart) {
      (window as any).coraAutoStart = false;
      return true;
    }
    return false;
  });
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [coraExpanded, setCoraExpanded] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [voiceText, setVoiceText] = useState('¡Hola! Soy Cora, tu asistente de voz. Haz clic en "Presionar para Hablar" y yo rellenaré los campos por ti.');
  const [voiceTranscription, setVoiceTranscription] = useState('');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [coraInteractionState, setCoraInteractionState] = useState<'greeting' | 'normal'>('greeting');

  const interviewQuestions = [
    {
      id: 'creator',
      label: 'Nombre Creador',
      question: 'Por favor, dime tu nombre y apellidos para registrar la autoría del caso financiero.',
      field: 'userName',
      step: 'cover',
      placeholder: 'Ej: Juan Pérez',
      type: 'text'
    },
    {
      id: 'channel',
      label: 'Canal de Venta',
      question: 'Indícame qué canal comercial quieres simular. Di por voz: Alimentación, Grandes Cuentas, Conveniencia o Importadas.',
      field: 'selectedChannel',
      step: 'channel',
      placeholder: 'Ej: Grandes Cuentas',
      type: 'channel'
    },
    {
      id: 'title',
      label: 'Título del Caso',
      question: '¿Qué título o nombre comercial quieres asignarle a este caso de negocio?',
      field: 'title',
      step: 'standard',
      placeholder: 'Ej: Lanzamiento Cerveza Especial',
      type: 'text'
    },
    {
      id: 'years',
      label: 'Años de duración',
      question: '¿Cuántos años durará el proyecto estándar? Por ejemplo: cinco.',
      field: 'years',
      step: 'standard',
      placeholder: 'Ej: 5',
      type: 'number'
    },
    {
      id: 'logistics',
      label: 'Logística',
      question: '¿Qué tipo de logística prefieres usar? Por ejemplo: Capilar, Camión, Medio Camión o Pallet.',
      field: 'logisticsType',
      step: 'standard',
      placeholder: 'Ej: Capilar',
      type: 'logistics'
    },
    {
      id: 'impProjectName',
      label: 'Nombre Proyecto',
      question: '¿Cómo se llama el proyecto de Importadas?',
      field: 'projectName',
      step: 'importadas',
      placeholder: 'Ej: Licores Premium',
      type: 'importadasText'
    },
    {
      id: 'impYears',
      label: 'Años Duración',
      question: '¿De cuántos años es la simulación? Di un número, por ejemplo, cinco.',
      field: 'duracionAnios',
      step: 'importadas',
      placeholder: 'Ej: 5',
      type: 'importadasNumber'
    },
    {
      id: 'impNegocio',
      label: 'Línea de Negocio',
      question: '¿A qué negocio pertenece? Por ejemplo: Importadas, Cerveza, Vinos o Líquidos.',
      field: 'negocio',
      step: 'importadas',
      placeholder: 'Ej: Importadas',
      type: 'importadasText'
    },
    {
      id: 'impLitAlim',
      label: 'Litros Alimentación',
      question: '¿Cuántos litros anuales prevés para el canal de Alimentación?',
      field: 'litrosAlimentacion',
      step: 'importadas',
      placeholder: 'Ej: 100.000 L',
      type: 'importadasNumber'
    },
    {
      id: 'impFormAlim',
      label: 'Formato Alimentación',
      question: '¿Qué formatos utilizarás en Alimentación? Por ejemplo: Botella 75 cl.',
      field: 'formatosAlimentacion',
      step: 'importadas',
      placeholder: 'Ej: Botella 75cl',
      type: 'importadasText'
    },
    {
      id: 'impLitGC',
      label: 'Litros Grandes Cuentas',
      question: '¿Cuántos litros anuales estimas para Grandes Cuentas?',
      field: 'litrosGrandesCuentas',
      step: 'importadas',
      placeholder: 'Ej: 50.000 L',
      type: 'importadasNumber'
    },
    {
      id: 'impFormGC',
      label: 'Formato Grandes Cuentas',
      question: '¿Qué formatos comercializarás en Grandes Cuentas?',
      field: 'formatosGrandesCuentas',
      step: 'importadas',
      placeholder: 'Ej: Barril 50L',
      type: 'importadasText'
    },
    {
      id: 'impLitConv',
      label: 'Litros Conveniencia',
      question: '¿Cuántos litros anuales estimas para Conveniencia?',
      field: 'litrosConveniencia',
      step: 'importadas',
      placeholder: 'Ej: 20.000 L',
      type: 'importadasNumber'
    },
    {
      id: 'impFormConv',
      label: 'Formato Conveniencia',
      question: '¿Qué formatos utilizará el canal de Conveniencia?',
      field: 'formatosConveniencia',
      step: 'importadas',
      placeholder: 'Ej: Lata 33cl',
      type: 'importadasText'
    },
    {
      id: 'impPrecioCesion',
      label: 'Precio Cesión / Coste',
      question: '¿Cuál es el precio de cesión o coste de fabricación por litro? Di un decimal, ej: uno con cincuenta.',
      field: 'precioCesionCosteFabricacion',
      step: 'importadas',
      placeholder: 'Ej: 1.50 €',
      type: 'importadasNumber'
    },
    {
      id: 'impInversionTercero',
      label: 'Inversión Comercial',
      question: '¿Cuánto se invertirá en aportaciones comerciales para terceros?',
      field: 'inversionComercialTercero',
      step: 'importadas',
      placeholder: 'Ej: 15.000 €',
      type: 'importadasNumber'
    },
    {
      id: 'impCreadorNombre',
      label: 'Nombre Creador',
      question: 'Por favor, dime tu nombre y apellidos para registrar la autoría de este proyecto de importadas.',
      field: 'creadorNombre',
      step: 'importadas',
      placeholder: 'Ej: Laura Martínez',
      type: 'importadasText'
    },
    {
      id: 'impLitPrevistos',
      label: 'Litros Previstos',
      question: '¿Cuántos litros totales tienes previsto comercializar para este proyecto de importadas en total?',
      field: 'litrosPrevistos',
      step: 'importadas',
      placeholder: 'Ej: 15.000 L',
      type: 'importadasNumber'
    },
    {
      id: 'impCanalVenta',
      label: 'Canal de Venta',
      question: '¿A qué canal de venta principal va dirigido? Por ejemplo: Alimentación o Grandes Cuentas.',
      field: 'canalVenta',
      step: 'importadas',
      placeholder: 'Ej: Alimentación / Horeca',
      type: 'importadasText'
    },
    {
      id: 'impPrecioNeto',
      label: 'Precio Neto',
      question: '¿Cuál es el precio neto objetivo por litro de venta?',
      field: 'precioNeto',
      step: 'importadas',
      placeholder: 'Ej: 2.10 €',
      type: 'importadasNumber'
    },
    {
      id: 'impLogisticaIncoterm',
      label: 'Logística Incoterm',
      question: 'Dime las condiciones de logística o Incoterm y los destinos. Por ejemplo: FOB Rotterdam a Madrid.',
      field: 'logisticaIncoterm',
      step: 'importadas',
      placeholder: 'Ej: FOB Rotterdam a Madrid',
      type: 'importadasText'
    },
    {
      id: 'impTrade',
      label: 'Trade',
      question: 'Indícame las aportaciones de Trade o acciones promocionales estimadas.',
      field: 'trade',
      step: 'importadas',
      placeholder: 'Ej: Acciones promocionales',
      type: 'importadasText'
    },
    {
      id: 'impAportaciones',
      label: 'Aportaciones',
      question: 'Por último, detalla otras aportaciones, subvenciones o apoyos publicitarios previstos.',
      field: 'aportaciones',
      step: 'importadas',
      placeholder: 'Ej: Apoyos publicitarios',
      type: 'importadasText'
    }
  ];

  const stepQuestions = interviewQuestions.filter(q => q.step === wizardStep);

  const parseSpanishNumber = (text: string): number => {
    const cleanText = text.toLowerCase().trim()
      .replace(/[,]/g, '.') // replace comma decimal
      .replace(/[.](?=\d{3})/g, '') // remove thousands separator dot (e.g. 100.000 -> 100000)
      .replace(/[\s]/g, '');

    if (cleanText.includes('unmillón') || cleanText.includes('millón')) return 1000000;
    if (cleanText.includes('cienmil')) return 100000;
    if (cleanText.includes('cincuentamil')) return 50000;
    if (cleanText.includes('diezmil')) return 10000;
    if (cleanText.includes('cincomil')) return 5000;
    if (cleanText.includes('mil')) return 1000;

    // Word decimal check, e.g. "uno con cincuenta" -> 1.5
    let workingText = text.toLowerCase()
      .replace(/ con /g, '.')
      .replace(/ y /g, '.')
      .replace(/ coma /g, '.')
      .replace(/punto/g, '.');

    // Basic spoken digits replacement
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

  function startListening() {
    if (voiceListening) return;
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La entrada de voz no está soportada en este navegador. Recomiendo usar Google Chrome.");
      return;
    }
    
    try {
      const rec = new SpeechRecognition();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      
      rec.onstart = () => {
        setVoiceListening(true);
        setVoiceTranscription("Escuchando...");
      };
      
      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setVoiceTranscription(resultText);
        handleVoiceAnswer(resultText);
      };
      
      rec.onerror = (event: any) => {
        console.warn("Speech Recognition Error", event);
        setVoiceListening(false);
        setVoiceTranscription("No te he oído bien. Prueba de nuevo.");
      };
      
      rec.onend = () => {
        setVoiceListening(false);
      };
      
      rec.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition", err);
      setVoiceListening(false);
    }
  }

  function speakActiveQuestion(qIndex: number) {
    if (coraInteractionState === 'greeting') {
      const greetingMsg = "¡Hola, Juan! Qué alegría saludarte, amigo. Llevamos ya diez años dándole caña a los números juntos, soy tu secretaria de confianza. ¿Cómo estás hoy? Cuéntame, ¿qué quieres que hagamos hoy? ¿Configuramos un nuevo caso de negocio, ajustamos algunas tarifas en el maestro de materiales en administración, pasamos al chat inteligente o volvemos al tablero principal?";
      setVoiceText(greetingMsg);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(greetingMsg);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        startListening();
      }
      return;
    }

    const currentStepQs = interviewQuestions.filter(q => q.step === wizardStep);
    const activeQ = currentStepQs[qIndex];
    if (activeQ) {
      setVoiceText(activeQ.question);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(activeQ.question);
        utterance.lang = 'es-ES';
        utterance.rate = 1.05;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        startListening();
      }
    } else {
      setVoiceText('Todos los campos del paso actual han sido completados de forma guiada. Di "siguiente" o haz clic en continuar.');
    }
  }

  function handleVoiceAnswer(transcript: string) {
    const spokenText = transcript.trim();
    if (!spokenText) return;

    setVoiceTranscription(spokenText);
    const cleanLower = spokenText.toLowerCase();

    // Check for general friend/conversational checks: "cómo estás", "qué tal", "como estás"
    if (cleanLower.includes('cómo estás') || cleanLower.includes('como estas') || 
        cleanLower.includes('qué tal estás') || cleanLower.includes('que tal estas') || 
        cleanLower.includes('qué tal') || cleanLower.includes('que tal') || 
        cleanLower.includes('cómo te va') || cleanLower.includes('como te va')) {
      
      const responseText = "¡Ay, mi querido amigo, yo estupendamente! Ya me conoces, con muchísimo trabajo organizando precios de cesión, revisando amortizaciones y costes de transporte... ¡pero súper contenta por estar otro año más apoyándote codo con codo! Son diez años ya de plena confianza, ¿eh? Trabajar contigo es un gustazo absoluto. Cuéntame tú de ti, ¿qué quieres que hagamos hoy? ¿Lanzamos un nuevo caso de negocio, ajustamos el maestro de materiales, un rato de chat o vemos el tablero?";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        startListening();
      }
      return;
    }

    // Check for general user status sharing: "yo bien", "estoy bien", "todo bien", "con mucho trabajo", "bien", "muy bien"
    if (coraInteractionState === 'greeting' && (
      cleanLower.includes('bien') || cleanLower.includes('estupendo') || 
      cleanLower.includes('tirando') || cleanLower.includes('cansado') || 
      cleanLower.includes('regular') || cleanLower.includes('con trabajo') ||
      cleanLower.includes('mal') || cleanLower.includes('regular')
    ) && !(
      cleanLower.includes('caso') || cleanLower.includes('material') || 
      cleanLower.includes('tablero') || cleanLower.includes('dashboard') || 
      cleanLower.includes('chat')
    )) {
      const responseText = "¡Me alegro un montón de oír eso! Siempre haces que el día sea más alegre con tu actitud. Bueno, al lío que hay faena: ¿qué quieres que hagamos hoy? ¿Configuramos un nuevo caso de negocio, ajustamos algunas tarifas en el maestro de materiales de administración, pasamos por el chat inteligente o vemos el tablero principal?";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        startListening();
      }
      return;
    }

    // Menu Navigation Orders
    // 1. New Case / Simulation
    if (cleanLower.includes('nuevo caso') || cleanLower.includes('caso de negocio') || 
        cleanLower.includes('nueva simulación') || cleanLower.includes('nueva simulacion') || 
        cleanLower.includes('crear propuesta') || cleanLower.includes('crear caso') ||
        cleanLower.includes('hacer una simulación') || cleanLower.includes('hacer propuesta') ||
        cleanLower.includes('empezar caso') || cleanLower.includes('comenzar caso')) {
      
      setCoraInteractionState('normal');
      const textConfirm = "¡Perfecto, al lío! Nos ponemos manos a la obra con la simulación del nuevo caso de negocio de inmediato. Vamos paso a paso rellenando la portada. Por favor, dime tu nombre y apellidos para registrar la autoría.";
      setVoiceText(textConfirm);
      
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textConfirm);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          setWizardStep('cover');
          setActiveQuestionIndex(0);
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          setWizardStep('cover');
          setActiveQuestionIndex(0);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setWizardStep('cover');
        setActiveQuestionIndex(0);
      }
      return;
    }

    // 2. Maestro de Materiales / Catálogo / Admin
    if (cleanLower.includes('materiales') || cleanLower.includes('maestro') || 
        cleanLower.includes('catálogo') || cleanLower.includes('catalogo') || 
        cleanLower.includes('administración') || cleanLower.includes('administrador') || 
        cleanLower.includes('tarifas') || cleanLower.includes('costes') || cleanLower.includes('precios')) {
      
      const responseText = "¡Oído cocina! Como tu fiel secretaria te llevo de inmediato al maestro de materiales en el panel de administración para que ajustes cualquier coste tranquilamente. ¡Hablamos luego, amigo!";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'admin' }));
          window.dispatchEvent(new CustomEvent('set-admin-tab', { detail: 'materials' }));
          onClose();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'admin' }));
          window.dispatchEvent(new CustomEvent('set-admin-tab', { detail: 'materials' }));
          onClose();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'admin' }));
        window.dispatchEvent(new CustomEvent('set-admin-tab', { detail: 'materials' }));
        onClose();
      }
      return;
    }

    // 3. Tablero principal / Dashboard
    if (cleanLower.includes('tablero') || cleanLower.includes('dashboard') || 
        cleanLower.includes('ver casos') || cleanLower.includes('volver al tablero') || 
        cleanLower.includes('pantalla principal') || cleanLower.includes('inicio') || 
        cleanLower.includes('propuestas guardadas') || cleanLower.includes('revisar un caso') ||
        cleanLower.includes('revisar caso') || cleanLower.includes('caso existente') ||
        cleanLower.includes('casos existentes')) {
      
      const responseText = "¡Por supuesto, jefe! Vamos a revisar tus casos existentes. Cerramos esta ventana de inmediato y te llevo al tablero principal, allí tienes tu listado completo con todos los informes, simulaciones y análisis de rentabilidad esperándote. ¡Vamos allá, amigo!";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'dashboard' }));
          onClose();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'dashboard' }));
          onClose();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'dashboard' }));
        onClose();
      }
      return;
    }

    // 4. Chat inteligente
    if (cleanLower.includes('chat') || cleanLower.includes('conversación') || 
        cleanLower.includes('hablar con la ia') || cleanLower.includes('ia chat') || 
        cleanLower.includes('charlar')) {
      
      const responseText = "¡Vámonos al Chat Inteligente! Allí podremos charlar con más detalle sobre todas las variables del modelado de tus proyectos. ¡Te veo allí!";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'chat' }));
          onClose();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'chat' }));
          onClose();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        window.dispatchEvent(new CustomEvent('change-app-view', { detail: 'chat' }));
        onClose();
      }
      return;
    }

    // Fallback block - only if we are in greeting/conversational mode we shouldn't attempt to fill form inputs.
    if (coraInteractionState === 'greeting') {
      const responseText = "Hmm, no te he entendido del todo bien amigo, ya sabes que a mi edad el oído a veces falla con el ruido de fondo... ¿Deseas crear un nuevo caso, revisar el maestro de materiales de administración, chatear o volver al tablero?";
      setVoiceText(responseText);
      if (!voiceMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        utterance.onstart = () => setVoiceSpeaking(true);
        utterance.onend = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        utterance.onerror = () => {
          setVoiceSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        startListening();
      }
      return;
    }

    const currentStepQs = interviewQuestions.filter(q => q.step === wizardStep);
    const activeQ = currentStepQs[activeQuestionIndex];
    if (!activeQ) return;

    // Navigation triggers
    if (cleanLower.includes('siguiente') || cleanLower.includes('continuar')) {
      if (wizardStep === 'cover' && userName.trim()) {
        setWizardStep('channel');
        return;
      }
      if (wizardStep === 'channel' && selectedChannel) {
        handleChannelNext();
        return;
      }
    }

    if (activeQ.type === 'text') {
      if (activeQ.field === 'userName') {
        setUserName(spokenText);
      } else if (activeQ.field === 'title') {
        setBasicData(prev => ({ ...prev, title: spokenText }));
      }
    } else if (activeQ.type === 'number') {
      const parsedNum = parseSpanishNumber(spokenText);
      if (parsedNum > 0) {
        if (activeQ.field === 'years') {
          setBasicData(prev => ({ ...prev, years: parsedNum }));
        }
      }
    } else if (activeQ.type === 'channel') {
      const cleanUpper = spokenText.toUpperCase();
      if (cleanUpper.includes('ALIMENTACIÓN') || cleanUpper.includes('ALIMENTACION')) {
        setSelectedChannel('ALIMENTACION');
      } else if (cleanUpper.includes('GRANDES') || cleanUpper.includes('CUENTAS') || cleanUpper.includes('ESTÁNDAR') || cleanUpper.includes('ESTANDAR')) {
        setSelectedChannel('GRANDES CUENTAS');
      } else if (cleanUpper.includes('CONVENIENCIA')) {
        setSelectedChannel('CONVENIENCIA');
      } else if (cleanUpper.includes('IMPORTADAS') || cleanUpper.includes('CUESTIONARIO')) {
        setSelectedChannel('IMPORTADAS');
      }
    } else if (activeQ.type === 'logistics') {
      const cleanUpper = spokenText.toUpperCase();
      if (cleanUpper.includes('CAPILAR')) {
        setBasicData(prev => ({ ...prev, logisticsType: LogisticsType.CAPILAR }));
      } else if (cleanUpper.includes('CAMIÓN') || cleanUpper.includes('CAMION')) {
        setBasicData(prev => ({ ...prev, logisticsType: LogisticsType.CAMION }));
      } else if (cleanUpper.includes('MEDIO') || cleanUpper.includes('MITAD')) {
        setBasicData(prev => ({ ...prev, logisticsType: LogisticsType.MEDIO_CAMION }));
      } else if (cleanUpper.includes('PALLET') || cleanUpper.includes('PALET')) {
        setBasicData(prev => ({ ...prev, logisticsType: LogisticsType.PALLET }));
      }
    } else if (activeQ.type === 'importadasText') {
      setImportadasData(prev => ({ ...prev, [activeQ.field]: spokenText }));
      if (activeQ.field === 'projectName') {
        setBasicData(prev => ({ ...prev, title: spokenText }));
      }
    } else if (activeQ.type === 'importadasNumber') {
      const parsedNum = parseSpanishNumber(spokenText);
      setImportadasData(prev => ({ ...prev, [activeQ.field]: parsedNum }));
      if (activeQ.field === 'duracionAnios') {
        setBasicData(prev => ({ ...prev, years: parsedNum }));
      }
    }

    // Give audio confirmation text
    if (!voiceMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const confirmSpeech = new SpeechSynthesisUtterance(`Entendido: ${spokenText}.`);
      confirmSpeech.lang = 'es-ES';
      confirmSpeech.rate = 1.1;
      window.speechSynthesis.speak(confirmSpeech);
    }

    // Auto-advance
    setTimeout(() => {
      if (activeQuestionIndex < currentStepQs.length - 1) {
        setActiveQuestionIndex(prev => prev + 1);
      } else {
        setVoiceText('¡Estupendo! Has completado todas las preguntas de este paso. Di "siguiente" o haz clic en pasar.');
      }
    }, 1200);
  }

  useEffect(() => {
    const handleCoraFloatingClick = () => {
      setVoiceActive(true);
      speakActiveQuestion(activeQuestionIndex);
    };
    window.addEventListener('cora-floating-click', handleCoraFloatingClick);
    return () => {
      window.removeEventListener('cora-floating-click', handleCoraFloatingClick);
    };
  }, [activeQuestionIndex, wizardStep, voiceMuted]);

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [wizardStep]);

  useEffect(() => {
    if (voiceActive) {
      speakActiveQuestion(activeQuestionIndex);
    } else {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }, [voiceActive, activeQuestionIndex, wizardStep]);

  useEffect(() => {
    if (voiceSpeaking) {
      setCoraExpanded(true);
    }
  }, [voiceSpeaking]);

  const families = Array.from(new Set(allProducts.map(p => p.family))).filter(Boolean);
  const packagings = Array.from(new Set(allProducts.map(p => p.packaging))).filter(Boolean);
  const formats = Array.from(new Set(allProducts.map(p => p.format))).filter(Boolean);

  const filteredProducts = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFamily = !filters.family || p.family === filters.family;
    const matchesPackaging = !filters.packaging || p.packaging === filters.packaging;
    const matchesFormat = !filters.format || p.format === filters.format;
    return matchesSearch && matchesFamily && matchesPackaging && matchesFormat;
  });

  const displayedProducts = [...filteredProducts];
  // Ensure selected references are siempre present / visible, even if catalog is filtered
  selectedReferences.forEach(ref => {
    const alreadyListed = displayedProducts.some(p => p.id === ref.productId);
    if (!alreadyListed) {
      const match = allProducts.find(p => p.id === ref.productId);
      if (match) {
        displayedProducts.unshift(match);
      }
    }
  });
  // Sort so selected references are listed first for quick editing and visual awareness
  displayedProducts.sort((a, b) => {
    const aSel = selectedReferences.some(r => r.productId === a.id) ? 1 : 0;
    const bSel = selectedReferences.some(r => r.productId === b.id) ? 1 : 0;
    return bSel - aSel;
  });

  const toggleProduct = (p: CatalogProduct) => {
    const isSelected = selectedReferences.some(r => r.productId === p.id);
    if (isSelected) {
      setSelectedReferences(prev => prev.filter(r => r.productId !== p.id));
    } else {
      setSelectedReferences(prev => [...prev, {
        productId: p.id,
        name: p.name,
        litersPerYear: 0,
        netPrice: 0,
        rappel: 0,
        contribution: 0,
        family: p.family,
        brand: p.brand,
        format: p.format,
        packaging: p.packaging,
        cost: p.cost
      }]);
    }
  };

  const updateReference = (productId: string, field: keyof ReferenceInput, value: any) => {
    setSelectedReferences(prev => prev.map(r => {
      if (r.productId === productId) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  // Create Standard (Grandes Cuentas / General) Case
  const handleCreateStandard = async () => {
    if (!basicData.title || selectedReferences.length === 0) return;
    setSaving(true);
    try {
      if (caseId) {
        await updateDoc(doc(db, 'businessCases', caseId), {
          title: basicData.title,
          years: basicData.years,
          logisticsType: basicData.logisticsType,
          references: selectedReferences,
          geographicService: geographicService,
          equipmentSelection: equipmentSelection,
          channel: selectedChannel === 'GRANDES CUENTAS' ? 'GRANDES CUENTAS' : selectedChannel || undefined,
          updatedAt: new Date().toISOString()
        });
        onSuccess(caseId);
      } else {
        const data: Omit<BusinessCase, 'id'> = {
          userId: auth.currentUser?.uid || '',
          title: basicData.title,
          years: basicData.years,
          logisticsType: basicData.logisticsType,
          references: selectedReferences,
          geographicService: geographicService,
          equipmentSelection: equipmentSelection,
          channel: selectedChannel === 'GRANDES CUENTAS' ? 'GRANDES CUENTAS' : undefined,
          userName: userName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'businessCases'), data);
        onSuccess(docRef.id);
      }
    } catch (e) {
      console.error(e);
      alert('Error al guardar el caso');
    } finally {
      setSaving(false);
    }
  };

  // Create Importadas Case
  const handleCreateImportadas = async () => {
    if (!importadasData.projectName || !userName) {
      alert('Por favor introduce al menos el nombre del proyecto');
      return;
    }
    setSaving(true);
    try {
      if (caseId) {
        await updateDoc(doc(db, 'businessCases', caseId), {
          title: importadasData.projectName,
          years: importadasData.duracionAnios,
          importadasData: {
            negocio: importadasData.categorias?.join(', ') || 'Importadas',
            categorias: importadasData.categorias || ['Importadas'],
            litrosHT: Number(importadasData.litrosHT) || 0,
            formatosHT: importadasData.formatosHT,
            litrosAlimentacion: Number(importadasData.litrosAlimentacion) || 0,
            formatosAlimentacion: importadasData.formatosAlimentacion,
            litrosGrandesCuentas: Number(importadasData.litrosGrandesCuentas) || 0,
            formatosGrandesCuentas: importadasData.formatosGrandesCuentas,
            litrosConveniencia: Number(importadasData.litrosConveniencia) || 0,
            formatosConveniencia: importadasData.formatosConveniencia,
            pnHT1: Number(importadasData.pnHT1) || 0,
            pnHT2: Number(importadasData.pnHT2) || 0,
            pnConveniencia: Number(importadasData.pnConveniencia) || 0,
            pnGrandesCuentas: Number(importadasData.pnGrandesCuentas) || 0,
            pnnAlimentacion: Number(importadasData.pnnAlimentacion) || 0,
            pnnHT: Number(importadasData.pnnHT) || 0,
            pnnConveniencia: Number(importadasData.pnnConveniencia) || 0,
            pnnGrandesCuentas: Number(importadasData.pnnGrandesCuentas) || 0,
            pvpAlimentacion: Number(importadasData.pvpAlimentacion) || 0,
            precioCesion: Number(importadasData.precioCesion) || 0,
            inversionComercial: Number(importadasData.inversionComercial) || 0,
            projectName: importadasData.projectName,
            creadorNombre: importadasData.creadorNombre || userName,
            litrosPrevistos: Number(importadasData.litrosPrevistos) || 0,
            canalVenta: importadasData.canalVenta || '',
            precioNeto: Number(importadasData.precioNeto) || 0,
            precioCesionCosteFabricacion: Number(importadasData.precioCesionCosteFabricacion) || 0,
            inversionComercialTercero: Number(importadasData.inversionComercialTercero) || 0,
            logisticaIncoterm: importadasData.logisticaIncoterm || '',
            trade: importadasData.trade || '',
            aportaciones: importadasData.aportaciones || ''
          },
          updatedAt: new Date().toISOString()
        });
        onSuccess(caseId);
      } else {
        const data: Omit<BusinessCase, 'id'> = {
          userId: auth.currentUser?.uid || '',
          title: importadasData.projectName,
          years: importadasData.duracionAnios,
          logisticsType: LogisticsType.CAPILAR,
          geographicService: [
            { region: 'Nacional', percentage: 100 }
          ],
          channel: 'IMPORTADAS',
          userName: userName,
          references: [], // No standard catalog references
          importadasData: {
            negocio: importadasData.categorias?.join(', ') || 'Importadas',
            categorias: importadasData.categorias || ['Importadas'],
            litrosHT: Number(importadasData.litrosHT) || 0,
            formatosHT: importadasData.formatosHT,
            litrosAlimentacion: Number(importadasData.litrosAlimentacion) || 0,
            formatosAlimentacion: importadasData.formatosAlimentacion,
            litrosGrandesCuentas: Number(importadasData.litrosGrandesCuentas) || 0,
            formatosGrandesCuentas: importadasData.formatosGrandesCuentas,
            litrosConveniencia: Number(importadasData.litrosConveniencia) || 0,
            formatosConveniencia: importadasData.formatosConveniencia,
            pnHT1: Number(importadasData.pnHT1) || 0,
            pnHT2: Number(importadasData.pnHT2) || 0,
            pnConveniencia: Number(importadasData.pnConveniencia) || 0,
            pnGrandesCuentas: Number(importadasData.pnGrandesCuentas) || 0,
            pnnAlimentacion: Number(importadasData.pnnAlimentacion) || 0,
            pnnHT: Number(importadasData.pnnHT) || 0,
            pnnConveniencia: Number(importadasData.pnnConveniencia) || 0,
            pnnGrandesCuentas: Number(importadasData.pnnGrandesCuentas) || 0,
            pvpAlimentacion: Number(importadasData.pvpAlimentacion) || 0,
            precioCesion: Number(importadasData.precioCesion) || 0,
            inversionComercial: Number(importadasData.inversionComercial) || 0,
            projectName: importadasData.projectName,
            creadorNombre: importadasData.creadorNombre || userName,
            litrosPrevistos: Number(importadasData.litrosPrevistos) || 0,
            canalVenta: importadasData.canalVenta || '',
            precioNeto: Number(importadasData.precioNeto) || 0,
            precioCesionCosteFabricacion: Number(importadasData.precioCesionCosteFabricacion) || 0,
            inversionComercialTercero: Number(importadasData.inversionComercialTercero) || 0,
            logisticaIncoterm: importadasData.logisticaIncoterm || '',
            trade: importadasData.trade || '',
            aportaciones: importadasData.aportaciones || ''
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'businessCases'), data);
        onSuccess(docRef.id);
      }
    } catch (e) {
      console.error(e);
      alert('Error al guardar el caso de importadas');
    } finally {
      setSaving(false);
    }
  };

  const parseFormatInLiters = (formatStr: string): number => {
    if (!formatStr) return 0.70;
    const clean = formatStr.toLowerCase();
    if (clean.includes('70cl') || clean.includes('70 cl') || clean.includes('700ml')) return 0.70;
    if (clean.includes('75cl') || clean.includes('75 cl') || clean.includes('750ml')) return 0.75;
    if (clean.includes('33cl') || clean.includes('33 cl') || clean.includes('330ml')) return 0.33;
    if (clean.includes('50cl') || clean.includes('50 cl') || clean.includes('500ml')) return 0.50;
    if (clean.includes('1l') || clean.includes('1 l')) return 1.0;
    
    const mlMatch = clean.match(/(\d+(?:\.\d+)?)\s*ml/);
    if (mlMatch) return parseFloat(mlMatch[1]) / 1000;
    const clMatch = clean.match(/(\d+(?:\.\d+)?)\s*cl/);
    if (clMatch) return parseFloat(clMatch[1]) / 100;
    const lMatch = clean.match(/(\d+(?:\.\d+)?)\s*l/);
    if (lMatch) return parseFloat(lMatch[1]);
    return 0.70;
  };

  const handleExportImportadasExcelDirectly = () => {
    const applyExcelStyling = (ws: any) => {
      if (!ws) return;
      const borderStyle = {
        top: { style: "thin", color: { rgb: "cbd5e1" } },
        bottom: { style: "thin", color: { rgb: "cbd5e1" } },
        left: { style: "thin", color: { rgb: "cbd5e1" } },
        right: { style: "thin", color: { rgb: "cbd5e1" } }
      };

      for (const key in ws) {
        if (key.startsWith('!')) continue;
        const cell = ws[key];
        if (!cell) continue;

        const col = key.replace(/[0-9]/g, '');
        const rowNum = parseInt(key.replace(/[^0-9]/g, ''));

        // Estilo base por defecto
        cell.s = {
          font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
          alignment: { vertical: "center", horizontal: col === 'A' ? 'left' : 'right' },
          border: borderStyle
        };

        // Fila 2: cabecera "sku/s" fusionada elegida por el usuario
        if (rowNum === 2) {
          if (col !== 'A') {
            cell.s = {
              fill: { patternType: "solid", fgColor: { rgb: "1E293B" } }, // Slate-800
              font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
              alignment: { vertical: "center", horizontal: "center" },
              border: borderStyle
            };
          }
        }
        // Fila 3: Canales de venta
        else if (rowNum === 3) {
          if (col === 'B') {
            cell.s = {
              fill: { patternType: "solid", fgColor: { rgb: "0284C7" } }, // Sky-600
              font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
              alignment: { vertical: "center", horizontal: "center" },
              border: borderStyle
            };
          } else if (col === 'C') {
            cell.s = {
              fill: { patternType: "solid", fgColor: { rgb: "4F46E5" } }, // Indigo-600
              font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
              alignment: { vertical: "center", horizontal: "center" },
              border: borderStyle
            };
          } else if (col === 'D') {
            cell.s = {
              fill: { patternType: "solid", fgColor: { rgb: "10B981" } }, // Emerald-500
              font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
              alignment: { vertical: "center", horizontal: "center" },
              border: borderStyle
            };
          }
        }
        // Configurar métricas y filas clave
        else {
          if (rowNum === 4) {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "F1F5F9" } }; // Slate-100
          }
          else if (rowNum === 12) {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "E0F2FE" } }; // Sky-100
            cell.s.font.color = { rgb: "0369A1" };
          }
          else if (rowNum === 18) {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "DCFCE7" } }; // Green-100
            cell.s.font.color = { rgb: "15803D" };
          }
          else if (rowNum === 22) {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "ECFDF5" } }; // Emerald-50
            cell.s.font.color = { rgb: "065F46" };
          }

          if (col === 'A') {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "F8FAFC" } };
          }
        }
      }
    };

    const applyBasicSheetStyling = (ws: any) => {
      if (!ws) return;
      const borderStyle = {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } }
      };

      for (const key in ws) {
        if (key.startsWith('!')) continue;
        const cell = ws[key];
        if (!cell) continue;

        const col = key.replace(/[0-9]/g, '');
        const rowNum = parseInt(key.replace(/[^0-9]/g, ''));

        cell.s = {
          font: { name: "Segoe UI", sz: 10, color: { rgb: "334155" } },
          alignment: { vertical: "center", horizontal: col === 'A' ? 'left' : 'right' },
          border: borderStyle
        };

        if (rowNum === 1) {
          cell.s.font.bold = true;
          cell.s.fill = { patternType: "solid", fgColor: { rgb: "1E293B" } };
          cell.s.font.color = { rgb: "FFFFFF" };
          cell.s.alignment.horizontal = "center";
        } else {
          if (col === 'A') {
            cell.s.font.bold = true;
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "F8FAFC" } };
          }
        }
      }
    };

    const wb = XLSX.utils.book_new();
    const imp = importadasData;

    const decesion = imp.precioCesion || 0;
    const invTotal = imp.inversionComercial || 0;

    const lAlim = imp.litrosAlimentacion || 0;
    const lHT = imp.litrosHT || 0;
    const lGC = imp.litrosGrandesCuentas || 0;
    const lConv = imp.litrosConveniencia || 0;
    const lTotal = lAlim + lHT + lGC + lConv;

    const fAlimStr = imp.formatosAlimentacion || "Lata 33cl";
    const fHTStr = imp.formatosHT || "Bot 70cl";
    const fGCStr = imp.formatosGrandesCuentas || "Bot 70cl";
    const fConvStr = imp.formatosConveniencia || "Bot 70cl";

    const volAlimUd = parseFormatInLiters(fAlimStr);
    const volHTUd = parseFormatInLiters(fHTStr);
    const volGCUd = parseFormatInLiters(fGCStr);
    const volConvUd = parseFormatInLiters(fConvStr);

    // Math according to pricing ladder
    const pnnAlimVal = imp.pnnAlimentacion || 0;
    const pnnHTVal = imp.pnnHT || 0;
    const pnnConvVal = imp.pnnConveniencia || 0;
    const pnnGCVal = imp.pnnGrandesCuentas || 0;

    const pvpAlimLiterSinIva = pnnAlimVal * 1.5; 
    const pvpAlimSinIva = pvpAlimLiterSinIva * volAlimUd;
    const pvpAlimUd = pvpAlimSinIva * 1.21;

    const pvpHTLiterSinIva = pnnHTVal * 2.5;
    const pvpHTSinIva = pvpHTLiterSinIva * volHTUd;
    const pvpHTUd = pvpHTSinIva * 1.21;

    const pvpConvLiterSinIva = pnnConvVal * 2.5;
    const pvpConvSinIva = pvpConvLiterSinIva * volConvUd;
    const pvpConvUd = pvpConvSinIva * 1.21;

    const pvpGCLiterSinIva = pnnGCVal * 2.5;
    const pvpGCSinIva = pvpGCLiterSinIva * volGCUd;
    const pvpGCUd = pvpGCSinIva * 1.21;

    // Weighted for TOTAL column
    const pvpTotalUd = lTotal > 0 ? ((pvpAlimUd * lAlim + pvpHTUd * lHT + pvpConvUd * lConv + pvpGCUd * lGC) / lTotal) : 0;
    const pvpTotalSinIva = lTotal > 0 ? ((pvpAlimSinIva * lAlim + pvpHTSinIva * lHT + pvpConvSinIva * lConv + pvpGCSinIva * lGC) / lTotal) : 0;
    const pvpTotalLiterSinIva = lTotal > 0 ? ((pvpAlimLiterSinIva * lAlim + pvpHTLiterSinIva * lHT + pvpConvLiterSinIva * lConv + pvpGCLiterSinIva * lGC) / lTotal) : 0;

    const invComAlim = lTotal > 0 ? (invTotal * (lAlim / lTotal)) : 0;
    const invComHT = lTotal > 0 ? (invTotal * (lHT / lTotal)) : 0;
    const invComConv = lTotal > 0 ? (invTotal * (lConv / lTotal)) : 0;
    const invComGC = lTotal > 0 ? (invTotal * (lGC / lTotal)) : 0;

    const factAlim = lAlim * pnnAlimVal;
    const factHT = lHT * pnnHTVal;
    const factConv = lConv * pnnConvVal;
    const factGC = lGC * pnnGCVal;
    const factTotal = factAlim + factHT + factConv + factGC;

    const pnnTotalVal = lTotal > 0 ? factTotal / lTotal : 0;

    const costVentaAlim = lAlim * decesion;
    const costVentaHT = lHT * decesion;
    const costVentaConv = lConv * decesion;
    const costVentaGC = lGC * decesion;
    const costVentaTotal = lTotal * decesion;

    const logAlim = lAlim * 0.12; 
    const logHT = lHT * 0.08;
    const logConv = lConv * 0.08;
    const logGC = lGC * 0.08;
    const logTotal = logAlim + logHT + logConv + logGC;

    const costVentaTotalAlim = costVentaAlim + logAlim;
    const costVentaTotalHT = costVentaHT + logHT;
    const costVentaTotalConv = costVentaConv + logConv;
    const costVentaTotalGC = costVentaGC + logGC;
    const costVentaTotalCost = costVentaTotal + logTotal;

    const margBrutoAlim = factAlim - costVentaTotalAlim;
    const margBrutoHT = factHT - costVentaTotalHT;
    const margBrutoConv = factConv - costVentaTotalConv;
    const margBrutoGC = factGC - costVentaTotalGC;
    const margBrutoTotal = factTotal - costVentaTotalCost;

    const margBrutoLAlim = lAlim > 0 ? margBrutoAlim / lAlim : 0;
    const margBrutoLHT = lHT > 0 ? margBrutoHT / lHT : 0;
    const margBrutoLConv = lConv > 0 ? margBrutoConv / lConv : 0;
    const margBrutoLGC = lGC > 0 ? margBrutoGC / lGC : 0;
    const margBrutoLTotal = lTotal > 0 ? margBrutoTotal / lTotal : 0;

    const margContAlim = margBrutoAlim - invComAlim;
    const margContHT = margBrutoHT - invComHT;
    const margContConv = margBrutoConv - invComConv;
    const margContGC = margBrutoGC - invComGC;
    const margContTotal = margBrutoTotal - invTotal;

    const margContLAlim = lAlim > 0 ? margContAlim / lAlim : 0;
    const margContLHT = lHT > 0 ? margContHT / lHT : 0;
    const margContLConv = lConv > 0 ? margContConv / lConv : 0;
    const margContLGC = lGC > 0 ? margContGC / lGC : 0;
    const margContLTotal = lTotal > 0 ? margContTotal / lTotal : 0;

    const gridRows = [
      ["", "", "", "", "", ""], 
      ["", "sku/s", "", "", "", ""], 
      ["", "Alimentación", "HT", "Conveniencia", "Grandes Cuentas", "TOTAL AGREGA"], 
      ["Litros", lAlim, lHT, lConv, lGC, lTotal],
      ["PVPr l/Ud", pvpAlimUd, pvpHTUd, pvpConvUd, pvpGCUd, pvpTotalUd],
      ["PVPr /uni SIN iva", pvpAlimSinIva, pvpHTSinIva, pvpConvSinIva, pvpGCSinIva, pvpTotalSinIva],
      ["PVPr /L SIN iva", pvpAlimLiterSinIva, pvpHTLiterSinIva, pvpConvLiterSinIva, pvpGCLiterSinIva, pvpTotalLiterSinIva],
      ["Inversión Sobre PVP", invComAlim, invComHT, invComConv, invComGC, invTotal],
      ["Precio neto", pnnAlimVal, pnnHTVal, pnnConvVal, pnnGCVal, pnnTotalVal],
      ["atipico %", 0, 0, 0, 0, 0],
      ["atipico", 0, 0, 0, 0, 0],
      ["Facturación neta neta", factAlim, factHT, factConv, factGC, factTotal],
      ["Precio Neto Neto", pnnAlimVal, pnnHTVal, pnnConvVal, pnnGCVal, pnnTotalVal],
      ["Coste de la Venta", costVentaAlim, costVentaHT, costVentaConv, costVentaGC, costVentaTotal],
      ["Logística", logAlim, logHT, logConv, logGC, logTotal],
      ["Coste de la Venta", costVentaTotalAlim, costVentaTotalHT, costVentaTotalConv, costVentaTotalGC, costVentaTotalCost],
      ["Margen Bruto l/L", margBrutoLAlim, margBrutoLHT, margBrutoLConv, margBrutoLGC, margBrutoLTotal],
      ["Margen Bruto l", margBrutoAlim, margBrutoHT, margBrutoConv, margBrutoGC, margBrutoTotal],
      ["Trade", 0, 0, 0, 0, 0],
      ["Aportación l/litro", 0, 0, 0, 0, 0],
      ["Margen contribución l/L", margContLAlim, margContLHT, margContLConv, margContLGC, margContLTotal],
      ["Margen contribución l", margContAlim, margContHT, margContConv, margContGC, margContTotal]
    ];

    const wsModel = XLSX.utils.aoa_to_sheet(gridRows);

    wsModel['!cols'] = [
      { wch: 28 }, 
      { wch: 18 }, 
      { wch: 18 }, 
      { wch: 18 }, 
      { wch: 18 }, 
      { wch: 20 }  
    ];

    wsModel['!merges'] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }
    ];

    for (const key in wsModel) {
      if (key.startsWith('!')) continue;
      const cell = wsModel[key];
      if (cell && cell.t === 'n') {
        const rowNum = parseInt(key.replace(/[^0-9]/g, ''));
        if (rowNum === 4) {
          cell.z = '#,##0" L"';
        } else if (rowNum === 10) {
          cell.z = '0.00"%"';
        } else {
          cell.z = '#,##0.00" €"';
        }
      }
    }

    applyExcelStyling(wsModel);
    XLSX.utils.book_append_sheet(wb, wsModel, 'sku_s_Modelo_Financiero');

    const summaryData = [
      { Concepto: 'Título del Proyecto', Valor: imp.projectName },
      { Concepto: 'Creador / Autor Nombre', Valor: imp.creadorNombre || userName },
      { Concepto: 'Canal de Venta Principal', Valor: 'IMPORTADAS' },
      { Concepto: 'Categorías Seleccionadas', Valor: imp.categorias && imp.categorias.length > 0 ? imp.categorias.join(', ') : 'Importadas' },
      { Concepto: 'Horizonte Temporal', Valor: `${imp.duracionAnios} años` },
      { Concepto: 'PREVISIONES VOLUMEN (LITROS DE CANAL):', Valor: '' },
      { Concepto: '  - Litros HT', Valor: imp.litrosHT || 0 },
      { Concepto: '  - Formatos HT', Valor: imp.formatosHT || 'N/A' },
      { Concepto: '  - Litros Alimentación', Valor: imp.litrosAlimentacion || 0 },
      { Concepto: '  - Formatos Alimentación', Valor: imp.formatosAlimentacion || 'N/A' },
      { Concepto: '  - Litros Grandes Cuentas', Valor: imp.litrosGrandesCuentas || 0 },
      { Concepto: '  - Formatos Grandes Cuentas', Valor: imp.formatosGrandesCuentas || 'N/A' },
      { Concepto: '  - Litros Conveniencia', Valor: imp.litrosConveniencia || 0 },
      { Concepto: '  - Formatos Conveniencia', Valor: imp.formatosConveniencia || 'N/A' },
      { Concepto: 'PRECIOS OBJETIVOS / CESIÓN / INVERSIÓN (MODELO):', Valor: '' },
      { Concepto: '  - PNN objetivo (€/L) Alimentación', Valor: imp.pnnAlimentacion || 0 },
      { Concepto: '  - PNN objetivo (€/L) HT', Valor: imp.pnnHT || 0 },
      { Concepto: '  - PNN objetivo (€/L) Conveniencia', Valor: imp.pnnConveniencia || 0 },
      { Concepto: '  - PNN objetivo (€/L) Grandes Cuentas', Valor: imp.pnnGrandesCuentas || 0 },
      { Concepto: '  - Precio de cesión / coste fabricación', Valor: imp.precioCesion || 0 },
      { Concepto: '  - Inversión comercial', Valor: imp.inversionComercial || 0 },
      { Concepto: 'CUESTIONARIO DE LOGÍSTICA, REGISTRO Y OTROS:', Valor: '' },
      { Concepto: '  - Litros Previstos Totales', Valor: imp.litrosPrevistos || 0 },
      { Concepto: '  - Canal de Venta Especificado', Valor: imp.canalVenta || 'N/A' },
      { Concepto: '  - Precio Neto Especificado', Valor: imp.precioNeto || 0 },
      { Concepto: '  - Precio Cesión / Coste Fabricación (Socio)', Valor: imp.precioCesionCosteFabricacion || 0 },
      { Concepto: '  - Inversión Comercial (Socio)', Valor: imp.inversionComercialTercero || 0 },
      { Concepto: '  - Logística (Incoterm y destinos)', Valor: imp.logisticaIncoterm || 'N/A' },
      { Concepto: '  - Trade', Valor: imp.trade || 'N/A' },
      { Concepto: '  - Aportaciones', Valor: imp.aportaciones || 'N/A' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    applyBasicSheetStyling(wsSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Datos_Entrada_Importacion');

    XLSX.writeFile(wb, `Analisis_Importacion_${(imp.projectName || 'Proyecto').replace(/\s+/g, '_')}.xlsx`);
  };

  const handleChannelNext = () => {
    if (!selectedChannel) return;
    if (selectedChannel === 'GRANDES CUENTAS') {
      setWizardStep('standard');
    } else if (selectedChannel === 'IMPORTADAS') {
      setWizardStep('importadas');
    } else {
      setWizardStep('soon');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-6xl h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0f4c3a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#0f4c3a]/12">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">{caseId ? 'Editar Caso de Negocio' : 'Formulario Caso de Negocio'}</h2>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-0.5">
                {wizardStep === 'cover' && 'Portada de Registro'}
                {wizardStep === 'channel' && 'Paso 1: Selección del Canal'}
                {wizardStep === 'standard' && 'Paso 2: Formulario de Cuentas Clave'}
                {wizardStep === 'importadas' && 'Paso 2: Cuestionario de Importadas'}
                {wizardStep === 'soon' && 'Canal bajo desarrollo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVoiceActive(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-2xl text-xs font-black transition-all hover:scale-105 active:scale-95 ${
                voiceActive
                  ? 'bg-[#0f4c3a] border-[#0f4c3a] text-white shadow-md shadow-[#0f4c3a]/10'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${voiceActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              🎙️ Asistente de Voz
            </button>
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-row bg-slate-50 relative">
          <div className="flex-1 overflow-y-auto">
          
          {wizardStep === 'cover' && (
            <div className="p-4 max-w-4xl mx-auto grid md:grid-cols-12 gap-6">
              
              {/* Left Form: Name Registration */}
              <div className="md:col-span-7 space-y-4 flex flex-col justify-center">
                <div className="space-y-1.5">
                  <span className="bg-[#0f4c3a]/5 text-[#0f4c3a] text-[10px] font-black px-2 py-1 rounded inline-block uppercase tracking-wider">
                    Registro de Autoría
                  </span>
                  <h3 className="text-xl font-black text-slate-800 leading-tight">
                    Introduce tu Identificación
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-bold">
                    Para mantener la trazabilidad de las simulaciones de negocio, registra tu nombre completo para este caso de negocio.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#0f4c3a]" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      Nombre del Creador
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Escribe tu nombre completo..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none shadow-sm transition-all"
                  />
                  <p className="text-[10px] text-amber-600 font-extrabold flex gap-1.5 items-start bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                    <span className="shrink-0">⚠️</span>
                    <span>Este formulario registrará su nombre como autor del caso financiero para su visualización y auditoría.</span>
                  </p>
                </div>
              </div>

              {/* Right Panel: Party Info Requirements */}
              <div className="md:col-span-5 bg-[#0f4c3a]/5 border border-[#0f4c3a]/10 p-4 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">📋</span>
                    <h4 className="font-black text-slate-800 text-xs tracking-tight uppercase">
                      Información de Partida
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                    Antes de arrancar el formulario, conviene disponer de la siguiente información a mano para asegurar un resultado preciso y ágil:
                  </p>

                  <ul className="space-y-1.5 text-[10px] font-bold text-slate-700">
                    {[
                      'Litros previstos',
                      'Canal de venta',
                      'Precio neto',
                      'Precio cesión / Coste fabricación',
                      'Inversión comercial',
                      'Logística (Incoterm y destinos)',
                      'Trade',
                      'Aportaciones'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-1.5 bg-white py-1.5 px-2 rounded-lg border border-[#0f4c3a]/10 hover:border-slate-300 transition-all select-none col-span-1">
                        <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={3} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[9px] text-slate-400 font-bold text-center">
                  Cálculos financieros automáticos basados en directrices operativas.
                </p>
              </div>

            </div>
          )}

          {wizardStep === 'channel' && (
            <div className="p-4 max-w-4xl mx-auto space-y-4">
              <div className="text-center space-y-0.5">
                <h3 className="text-lg font-black text-slate-800">Seleccione el Canal de Venta</h3>
                <p className="text-slate-500 text-xs font-bold">Las preguntas del cuestionario se adaptan según el funcionamiento específico de cada canal.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {[
                  {
                    id: 'ALIMENTACION',
                    title: 'Alimentación',
                    desc: 'Supermercados, retail y cadenas de distribución de alimentación general.',
                    icon: '🛒',
                    badge: 'Próximamente'
                  },
                  {
                    id: 'GRANDES CUENTAS',
                    title: 'Grandes Cuentas / Estándar',
                    desc: 'Cuentas clave tradicionales con matriz de materiales y duraciones estructuradas.',
                    icon: '🤝',
                    badge: 'Disponible'
                  },
                  {
                    id: 'CONVENIENCIA',
                    title: 'Conveniencia',
                    desc: 'Tiendas de gasolinera, formatos de 24 horas y compras de impulso rápido.',
                    icon: '🏪',
                    badge: 'Próximamente'
                  },
                  {
                    id: 'IMPORTADAS',
                    title: 'Importadas',
                    desc: 'Licores, espirituosos, vinos y cervezas de importación internacional.',
                    icon: '🌍',
                    badge: 'Disponible'
                  }
                ].map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannel(ch.id as any)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between h-32 relative ${
                      selectedChannel === ch.id
                        ? 'border-[#0f4c3a] bg-[#0f4c3a]/5 shadow-sm shadow-[#0f4c3a]/8'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-2xl">{ch.icon}</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                          ch.badge === 'Disponible' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {ch.badge}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-800">{ch.title}</h4>
                      <p className="text-slate-500 font-bold text-[11px] mt-0.5 leading-tight line-clamp-2">{ch.desc}</p>
                    </div>

                    {selectedChannel === ch.id && (
                      <span className="absolute bottom-3 right-3 bg-[#0f4c3a] text-white p-0.5 rounded-full">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 'soon' && (
            <div className="p-12 max-w-lg mx-auto text-center space-y-6 flex flex-col justify-center h-full">
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-3xl flex items-center justify-center text-amber-500 text-3xl mx-auto shadow-sm">
                🚧
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Canal en Desarrollo</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Las preguntas dinámicas para el canal de <span className="font-extrabold text-[#0f4c3a]">{selectedChannel}</span> se agregarán en próximas iteraciones organizativas. 
                </p>
                <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto">
                  Por ahora, puedes proceder utilizando el formulario de Grandes Cuentas / Estándar para realizar tus simulaciones financieras.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => {
                    setSelectedChannel('GRANDES CUENTAS');
                    setWizardStep('standard');
                  }}
                  className="w-full bg-[#0f4c3a] text-white font-bold py-4 rounded-2xl hover:bg-[#0b382b] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0f4c3a]/10"
                >
                  <ArrowRight size={18} />
                  Usar Formulario Estándar (Grandes Cuentas)
                </button>
              </div>
            </div>
          )}

          {/* Standard Form: Master configuration + Product Selection */}
          {wizardStep === 'standard' && (
            <div className="p-4 space-y-4">
              {/* Step 1: Basic Info */}
              <section className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#0f4c3a] bg-[#0f4c3a]/10 w-5 h-5 rounded-full flex items-center justify-center">1</span>
                  <h4 className="font-extrabold text-slate-700 uppercase tracking-wide text-xs">Información Básica del Proyecto</h4>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre del Proyecto</label>
                    <input 
                      value={basicData.title}
                      onChange={e => setBasicData(d => ({ ...d, title: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all outline-none"
                      placeholder="Eje: Expansión Madrid 2024"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Duración del Horizonte</label>
                    <select 
                      value={basicData.years}
                      onChange={e => setBasicData(d => ({ ...d, years: parseInt(e.target.value) }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 5, 10].map(y => <option key={y} value={y}>{y} años</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Modelo Logístico</label>
                    <select 
                      value={basicData.logisticsType}
                      onChange={e => setBasicData(d => ({ ...d, logisticsType: e.target.value as LogisticsType }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none cursor-pointer"
                    >
                      <option value={LogisticsType.CAPILAR}>Capilar (Multimarca)</option>
                      <option value={LogisticsType.PALLET}>Pallet Directo</option>
                      <option value={LogisticsType.MEDIO_CAMION}>Medio Camión</option>
                      <option value={LogisticsType.CAMION}>Camión Completo</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Step 2: Product Matrix */}
              <section className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#0f4c3a] bg-[#0f4c3a]/10 w-5 h-5 rounded-full flex items-center justify-center">2</span>
                    <h4 className="font-extrabold text-slate-700 uppercase tracking-wide text-xs">Matriz de Productos Seleccionados ({selectedReferences.length})</h4>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex-1 min-w-[150px] relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 text-xs font-bold text-slate-800"
                      />
                    </div>
                    <FilterSelect 
                      label="Negocio" 
                      options={families} 
                      value={filters.family} 
                      onChange={(v: string) => setFilters(f => ({ ...f, family: v }))} 
                    />
                    <FilterSelect 
                      label="Envase" 
                      options={packagings} 
                      value={filters.packaging} 
                      onChange={(v: string) => setFilters(f => ({ ...f, packaging: v }))} 
                    />
                    <FilterSelect 
                      label="Formato" 
                      options={formats} 
                      value={filters.format} 
                      onChange={(v: string) => setFilters(f => ({ ...f, format: v }))} 
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[22vh] scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                          <tr>
                            <th className="py-2 px-3 w-12 text-center">Sel.</th>
                            <th className="py-2 px-3">Referencia / Marca</th>
                            <th className="py-2 px-3 text-center">Litros/Año</th>
                            <th className="py-2 px-3 text-center">PN (€/L)</th>
                            <th className="py-2 px-3 text-center">Rappel %</th>
                            <th className="py-2 px-3 text-center">Aportación (€/L)</th>
                            <th className="py-2 px-3 text-right">Formato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loading ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">Cargando catálogo...</td>
                            </tr>
                          ) : displayedProducts.length > 0 ? (
                            displayedProducts.map(p => {
                              const selectedItem = selectedReferences.find(r => r.productId === p.id);
                              const isSelected = !!selectedItem;
                              return (
                                <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-[#0f4c3a]/5' : ''}`}>
                                  <td className="py-1.5 px-2.5 text-center">
                                    <button 
                                      onClick={() => toggleProduct(p)}
                                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all mx-auto ${
                                        isSelected 
                                          ? 'bg-[#0f4c3a] text-white' 
                                          : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                      }`}
                                    >
                                      {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                                    </button>
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <div>
                                      <p className="font-bold text-xs text-slate-800 leading-tight">{p.name}</p>
                                      <p className="text-[9px] text-slate-405 font-black uppercase tracking-wider">{p.brand} • {p.family}</p>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <input 
                                      type="number"
                                      disabled={!isSelected}
                                      value={selectedItem?.litersPerYear ?? ''}
                                      onChange={e => updateReference(p.id!, 'litersPerYear', parseFloat(e.target.value) || 0)}
                                      className="w-16 mx-auto block bg-slate-55 border border-slate-150 rounded px-1.5 py-0.5 text-center text-xs font-bold text-slate-700 disabled:opacity-30 outline-none focus:ring-1 focus:ring-[#0f4c3a]"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <input 
                                      type="number"
                                      step="any"
                                      disabled={!isSelected}
                                      value={selectedItem?.netPrice ?? ''}
                                      onChange={e => updateReference(p.id!, 'netPrice', parseFloat(e.target.value) || 0)}
                                      className="w-16 mx-auto block bg-slate-55 border border-slate-150 rounded px-1.5 py-0.5 text-center text-xs font-bold text-[#0f4c3a] disabled:opacity-30 outline-none focus:ring-1 focus:ring-[#0f4c3a]"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <input 
                                      type="number"
                                      step="any"
                                      disabled={!isSelected}
                                      value={selectedItem?.rappel ?? ''}
                                      onChange={e => updateReference(p.id!, 'rappel', parseFloat(e.target.value) || 0)}
                                      className="w-12 mx-auto block bg-slate-55 border border-slate-150 rounded px-1.5 py-0.5 text-center text-xs font-bold text-slate-700 disabled:opacity-30 outline-none focus:ring-1 focus:ring-[#0f4c3a]"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2.5">
                                    <input 
                                      type="number"
                                      step="any"
                                      disabled={!isSelected}
                                      value={selectedItem?.contribution ?? ''}
                                      onChange={e => updateReference(p.id!, 'contribution', parseFloat(e.target.value) || 0)}
                                      className="w-16 mx-auto block bg-slate-55 border border-slate-150 rounded px-1.5 py-0.5 text-center text-xs font-bold text-amber-600 disabled:opacity-30 outline-none focus:ring-1 focus:ring-[#0f4c3a]"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right">
                                    <p className="font-bold text-xs text-slate-700 leading-tight">{p.format}</p>
                                    <p className="text-[9px] text-slate-400">{p.packaging}</p>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-slate-400 italic">No se encontraron productos en el catálogo.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* Side-by-side Layout for Step 3 & Step 4 to Maximize Screen Estate */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                
                {/* Step 3: Geographic Locations (Ubicaciones) */}
                <section className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#0f4c3a] bg-[#0f4c3a]/10 w-5 h-5 rounded-full flex items-center justify-center">3</span>
                      <h4 className="font-extrabold text-slate-700 uppercase tracking-wide text-xs">Ubicaciones y Presencia</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeographicService(prev => [...prev, { region: '', percentage: 0 }])}
                      className="flex items-center gap-1 px-2 py-1 bg-[#0f4c3a] hover:bg-[#0b382b] text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      <Plus size={10} strokeWidth={3} />
                      Añadir
                    </button>
                  </div>

                  <div className="space-y-2">
                    {geographicService.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-150">
                        <div className="flex-1">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Región / Ubicación</label>
                          <input
                            type="text"
                            required
                            value={item.region}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGeographicService(prev => prev.map((g, i) => i === idx ? { ...g, region: val } : g));
                            }}
                            placeholder="Ej: Madrid, Barcelona..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:bg-white"
                          />
                        </div>
                        <div className="w-20">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Porcentaje %</label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min="0"
                              max="100"
                              value={item.percentage}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setGeographicService(prev => prev.map((g, i) => i === idx ? { ...g, percentage: val } : g));
                              }}
                              placeholder="0"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 pr-5 text-xs text-center font-bold text-slate-800 outline-none focus:bg-white"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">%</span>
                          </div>
                        </div>
                        <div className="pt-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => setGeographicService(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 px-1.5 text-slate-350 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar Ubicación"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {geographicService.length === 0 && (
                      <div className="p-4 text-center text-[11px] font-bold text-slate-400 border border-dashed border-slate-200 rounded-xl italic">
                        No has añadido ninguna ubicación.
                      </div>
                    )}

                    {/* Warning if percentages do not sum to 100 */}
                    {(() => {
                      const total = geographicService.reduce((sum, g) => sum + g.percentage, 0);
                      if (total !== 100 && geographicService.length > 0) {
                        return (
                          <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-[10px] font-extrabold text-amber-600 flex items-center gap-1 leading-tight">
                            <span>⚠️</span>
                            <span>Participación debe sumar 100% (Suma: {total}%).</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </section>

                {/* Step 4: Installation & Cold Equipment */}
                <section className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#0f4c3a] bg-[#0f4c3a]/10 w-5 h-5 rounded-full flex items-center justify-center">4</span>
                    <h4 className="font-extrabold text-slate-700 uppercase tracking-wide text-xs">Equipos de Frío</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-tight">
                    Equipos asociados a imputar amortización técnica de activos, mantenimiento técnico e instalación.
                  </p>

                  <div className="grid sm:grid-cols-1 gap-2">
                    {coldEquipmentMaster.map((eq) => {
                      const qty = equipmentSelection[eq.id!] || 0;
                      return (
                        <div key={eq.id} className="bg-white p-2 rounded-xl border border-slate-150 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-slate-800 truncate">{eq.name}</p>
                            <div className="flex gap-1.5 text-[8px] font-black text-slate-400 uppercase mt-0.5">
                              <span>Coste: {eq.price} €</span>
                              <span>•</span>
                              <span>Vida: {eq.amortizationYears} años</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newQty = Math.max(0, qty - 1);
                                setEquipmentSelection(prev => ({ ...prev, [eq.id!]: newQty }));
                              }}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-black rounded text-xs flex items-center justify-center transition-all select-none cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-black text-slate-800">{qty}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newQty = qty + 1;
                                setEquipmentSelection(prev => ({ ...prev, [eq.id!]: newQty }));
                              }}
                              className="w-6 h-6 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-600 font-black rounded text-xs flex items-center justify-center transition-all select-none cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {coldEquipmentMaster.length === 0 && (
                      <div className="text-center text-[10px] font-bold text-slate-400 py-3 italic border border-dashed border-slate-200 rounded-xl animate-pulse">
                        Cargando catálogo de frío...
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>
          )}

          {/* Importadas Cuestionario (16 preguntas) */}
          {wizardStep === 'importadas' && (
            <div className="p-8 space-y-8 max-w-4xl mx-auto">
              
              <div className="bg-[#0f4c3a]/5 border border-[#0f4c3a]/10 p-6 rounded-3xl space-y-2">
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <span>🌍</span> Formulario de Viabilidad de Importación
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Completa los objetivos del Business Case (BC) indicando las previsiones de volumen (Litros), formatos y precios objetivo por cada canal comercial para realizar un análisis multidimensional específico.
                </p>
              </div>

              {/* SECTION A: General project definition */}
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Sección General</h4>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nombre del Proyecto *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.projectName}
                      onChange={(e) => setImportadasData(d => ({ ...d, projectName: e.target.value }))}
                      placeholder="Ej: Licor Premium de Italia"
                      className="w-full bg-slate-50 border border-slate-250 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Horizonte Temporal (Años) *</label>
                    <select
                      value={importadasData.duracionAnios}
                      onChange={(e) => setImportadasData(d => ({ ...d, duracionAnios: Number(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-250 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 5, 10].map(y => (
                        <option key={y} value={y}>{y} {y === 1 ? 'Año' : 'Años'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 block">
                    Selecciona las categorías aplicables (Selección Múltiple)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    {['Importadas', 'Vinos', 'Spirits', 'Custom', 'Cerveza', 'Agua y bebidas saludables'].map(opt => {
                      const isSelected = (importadasData.categorias || []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            let curr = [...(importadasData.categorias || [])];
                            if (curr.includes(opt)) {
                              curr = curr.filter(x => x !== opt);
                            } else {
                              curr.push(opt);
                            }
                            if (curr.length === 0) curr = [opt];
                            setImportadasData(d => ({ ...d, categorias: curr }));
                          }}
                          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-bold transition-all text-left ${
                            isSelected
                              ? 'bg-[#0f4c3a]/5 border-[#0f4c3a]/15 text-[#0f4c3a] shadow-sm'
                              : 'bg-white border-slate-150 text-slate-655 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-[#0f4c3a] border-[#0f4c3a] text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(importadasData.categorias || []).includes('Importadas') && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-150 rounded-2xl w-fit">
                    <span className="text-emerald-700 text-xs">✓</span>
                    <span className="text-emerald-800 text-xs font-black uppercase tracking-wider">Configuración de Categoría: IMPORTADAS</span>
                  </div>
                )}
              </div>

              {/* SECTION B: Litros y Formatos por Canal */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Previsiones de Volumen por Canal</h4>

                <div className="grid md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                  
                  {/* HT Volume Group */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[10px] font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-2.5 py-1 rounded-md uppercase tracking-wider">Hostelería Tradicional (HT)</span>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Litros HT *</label>
                          <input
                            type="number"
                            value={importadasData.litrosHT || ''}
                            onChange={(e) => setImportadasData(d => ({ ...d, litrosHT: parseFloat(e.target.value) || 0 }))}
                            placeholder="0 L"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Formatos HT *</label>
                          <input
                            type="text"
                            value={importadasData.formatosHT}
                            onChange={(e) => setImportadasData(d => ({ ...d, formatosHT: e.target.value }))}
                            placeholder="Ej: Bot 70cl"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alimentacion Volume Group */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[10px] font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-2.5 py-1 rounded-md uppercase tracking-wider">Alimentación</span>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Litros Alim. *</label>
                          <input
                            type="number"
                            value={importadasData.litrosAlimentacion || ''}
                            onChange={(e) => setImportadasData(d => ({ ...d, litrosAlimentacion: parseFloat(e.target.value) || 0 }))}
                            placeholder="0 L"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Formatos Alim. *</label>
                          <input
                            type="text"
                            value={importadasData.formatosAlimentacion}
                            onChange={(e) => setImportadasData(d => ({ ...d, formatosAlimentacion: e.target.value }))}
                            placeholder="Ej: Lata 33cl"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grandes Cuentas Volume Group */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[10px] font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-2.5 py-1 rounded-md uppercase tracking-wider">Grandes Cuentas</span>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Litros GC *</label>
                          <input
                            type="number"
                            value={importadasData.litrosGrandesCuentas || ''}
                            onChange={(e) => setImportadasData(d => ({ ...d, litrosGrandesCuentas: parseFloat(e.target.value) || 0 }))}
                            placeholder="0 L"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Formatos GC *</label>
                          <input
                            type="text"
                            value={importadasData.formatosGrandesCuentas}
                            onChange={(e) => setImportadasData(d => ({ ...d, formatosGrandesCuentas: e.target.value }))}
                            placeholder="Ej: Bot 75cl"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conveniencia Volume Group */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[10px] font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-2.5 py-1 rounded-md uppercase tracking-wider">Conveniencia</span>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Litros Conv. *</label>
                          <input
                            type="number"
                            value={importadasData.litrosConveniencia || ''}
                            onChange={(e) => setImportadasData(d => ({ ...d, litrosConveniencia: parseFloat(e.target.value) || 0 }))}
                            placeholder="0 L"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Formatos Conv. *</label>
                          <input
                            type="text"
                            value={importadasData.formatosConveniencia}
                            onChange={(e) => setImportadasData(d => ({ ...d, formatosConveniencia: e.target.value }))}
                            placeholder="Ej: Pack x4"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C: Objetivos de Precios, Cesion e Inversión */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">2. Precios de Venta Objetivos</h4>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                  
                  {/* HT Channel */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PN Objetivo (€/L) HT *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnHT1 || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setImportadasData(d => ({ ...d, pnHT1: val, pnHT2: val }));
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PNN Objetivo (€/L) HT *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnnHT || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnnHT: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-[#0f4c3a]/5 border border-[#0f4c3a]/15 rounded-lg px-2.5 py-2 text-xs font-bold text-[#0f4c3a] hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Conveniencia Channel */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-extrabold text-[#0f4c3a]">PN Objetivo (€/L) Conveniencia *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnConveniencia || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnConveniencia: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PNN Objetivo (€/L) Conveniencia *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnnConveniencia || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnnConveniencia: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-[#0f4c3a]/5 border border-[#0f4c3a]/15 rounded-lg px-2.5 py-2 text-xs font-bold text-[#0f4c3a] hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Grandes Cuentas Channel */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-extrabold text-[#0f4c3a]">PN Objetivo (€/L) Grandes Cuentas *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnGrandesCuentas || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnGrandesCuentas: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PNN Objetivo (€/L) Grandes Cuentas *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnnGrandesCuentas || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnnGrandesCuentas: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-[#0f4c3a]/5 border border-[#0f4c3a]/15 rounded-lg px-2.5 py-2 text-xs font-bold text-[#0f4c3a] hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Alimentación Channel */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PNN Objetivo (€/L) Alimentación *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pnnAlimentacion || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pnnAlimentacion: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-[#0f4c3a]/5 border border-[#0f4c3a]/15 rounded-lg px-2.5 py-2 text-xs font-bold text-[#0f4c3a] hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold font-black">PVP Objetivo (€/Ud) Alimentación *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.pvpAlimentacion || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, pvpAlimentacion: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Cesión */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-emerald-700 font-extrabold font-black">Precio de Cesión o Coste Fabricación *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.precioCesion || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, precioCesion: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Inversión total */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150 md:col-span-2 lg:col-span-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-pink-700 font-extrabold">Inversión Comercial (€) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.inversionComercial || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, inversionComercial: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00 €"
                      className="w-full bg-pink-50 border border-pink-250 rounded-lg px-2.5 py-2 text-xs font-bold text-pink-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                </div>
              </div>

              {/* SECTION D: Logística, Registro y Otros */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">3. Logística, Registro y Otros</h4>

                <div className="grid md:grid-cols-3 gap-4 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                  
                  {/* Escribe tu nombre * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Escribe tu nombre *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.creadorNombre || userName}
                      onChange={(e) => setImportadasData(d => ({ ...d, creadorNombre: e.target.value }))}
                      placeholder="Tu nombre completo"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Litros previstos * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Litros previstos *</label>
                    <input
                      type="number"
                      required
                      value={importadasData.litrosPrevistos || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, litrosPrevistos: parseFloat(e.target.value) || 0 }))}
                      placeholder="Ej: 15000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Canal de venta * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Canal de venta *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.canalVenta}
                      onChange={(e) => setImportadasData(d => ({ ...d, canalVenta: e.target.value }))}
                      placeholder="Ej: Alimentación / Horeca"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Precio neto * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Precio neto *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.precioNeto || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, precioNeto: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Precio cesión / Coste fabricación * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Precio cesión / Coste fabricación *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.precioCesionCosteFabricacion || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, precioCesionCosteFabricacion: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Inversión comercial (€) * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Inversión comercial (€) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={importadasData.inversionComercialTercero || ''}
                      onChange={(e) => setImportadasData(d => ({ ...d, inversionComercialTercero: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Logística (Incoterm y destinos) * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150 md:col-span-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Logística (Incoterm y destinos) *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.logisticaIncoterm}
                      onChange={(e) => setImportadasData(d => ({ ...d, logisticaIncoterm: e.target.value }))}
                      placeholder="Ej: FOB Rotterdam a Madrid"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Trade * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150 md:col-span-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Trade *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.trade}
                      onChange={(e) => setImportadasData(d => ({ ...d, trade: e.target.value }))}
                      placeholder="Ej: Acciones promocionales"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                  {/* Aportaciones * */}
                  <div className="space-y-1 bg-white p-4 rounded-xl border border-slate-150 md:col-span-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-[#0f4c3a] font-extrabold">Aportaciones *</label>
                    <input
                      type="text"
                      required
                      value={importadasData.aportaciones}
                      onChange={(e) => setImportadasData(d => ({ ...d, aportaciones: e.target.value }))}
                      placeholder="Ej: Subvenciones o apoyos publicitarios"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30"
                    />
                  </div>

                </div>
              </div>

            </div>
          )}

          </div>

          {/* Floating Cora Assistant Panel - Absolute positioned to maximize visible screen space */}
          {voiceActive && (
            <div className="absolute top-3 right-4 z-40 w-72 pointer-events-none flex flex-col items-end gap-2 animate-in fade-in-10 slide-in-from-top-3 duration-300">
              
              {/* Floating Avatar Node - Zooms in scale automatically when speaking is active */}
              <div className="pointer-events-auto shrink-0 transition-all duration-350 ease-out">
                <div className={`relative flex items-center justify-center rounded-full bg-white p-1 border-2 transition-all duration-500 shadow-2xl ${
                  voiceSpeaking 
                    ? 'scale-[1.45] ring-8 ring-emerald-400/25 border-[#0f4c3a] shadow-emerald-400/10' 
                    : 'scale-100 border-slate-100 hover:scale-[1.05]'
                }`}>
                  <button
                    type="button"
                    onClick={() => speakActiveQuestion(activeQuestionIndex)}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-50 cursor-pointer"
                    title="Haz clic para volver a oír o hablar"
                  >
                    <CoraVectorAvatar speaking={voiceSpeaking} isListening={voiceListening} className="w-12 h-12" />
                  </button>

                  {/* Dynamic Status Beacon */}
                  <span className="absolute bottom-0 right-0 flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${voiceListening ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 border border-white ${voiceListening ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
                  </span>
                </div>
              </div>

              {/* Chat Popover Bubble with Text Input Response capability */}
              <div className="pointer-events-auto w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-205 shadow-xl p-3 space-y-2.5 text-left transition-all duration-300">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🎙️</span>
                    <h5 className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider leading-none">Cora (Guía IA)</h5>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setVoiceMuted(!voiceMuted)}
                      className="p-1 hover:bg-slate-100 rounded text-xs select-none"
                      title={voiceMuted ? "Activar sonido" : "Silenciar voz"}
                    >
                      {voiceMuted ? '🔇' : '🔊'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceActive(false)}
                      className="p-1 hover:bg-slate-100 font-extrabold text-slate-400 text-[10px] rounded"
                    >
                      ✖
                    </button>
                  </div>
                </div>

                {/* Question Label & Speech Content */}
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[8px] font-black uppercase text-slate-400">Pregunta activa:</span>
                    <span className="text-[8px] font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-1.5 py-0.5 rounded uppercase leading-none">
                      {stepQuestions[activeQuestionIndex]?.label || 'Completado'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-705 leading-relaxed bg-slate-50/75 p-2 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                    {voiceText}
                  </p>
                </div>

                {/* Microphone & TEXT response composer */}
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={startListening}
                      disabled={voiceListening}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                        voiceListening
                          ? 'bg-cyan-500 text-white shadow animate-pulse'
                          : 'bg-[#0f4c3a] text-white hover:bg-[#0b382b]'
                      }`}
                    >
                      <span>🎙️</span>
                      <span>{voiceListening ? 'Oigo...' : 'Hablar'}</span>
                    </button>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (textInput.trim()) {
                          handleVoiceAnswer(textInput);
                          setTextInput('');
                        }
                      }}
                      className="flex-1 flex gap-1 items-stretch"
                    >
                      <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        className="flex-1 bg-slate-50 border border-slate-205 rounded-lg px-2 text-[10px] font-bold text-slate-800 outline-none focus:bg-white focus:border-[#0f4c3a]"
                      />
                      <button
                        type="submit"
                        className="px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-[9px] rounded-lg cursor-pointer"
                      >
                        Enviar
                      </button>
                    </form>
                  </div>

                  {voiceTranscription && (
                    <div className="p-1 px-1.5 bg-slate-100/60 rounded text-[9px] font-bold text-slate-505 flex gap-1 items-baseline">
                      <span className="font-extrabold text-[#0f4c3a]">Recibido:</span>
                      <span className="italic">"{voiceTranscription}"</span>
                    </div>
                  )}
                </div>

                {/* Mini index dots to select question index */}
                {stepQuestions.length > 1 && (
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Guía de Paso:</span>
                    <div className="flex flex-wrap gap-1">
                      {stepQuestions.map((q, qIdx) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setActiveQuestionIndex(qIdx);
                            if (!voiceMuted) {
                              speakActiveQuestion(qIdx);
                            }
                          }}
                          className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center transition-all ${
                            qIdx === activeQuestionIndex
                              ? 'bg-[#0f4c3a] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {qIdx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <Info size={16} />
            <p className="text-xs font-medium">
              {wizardStep === 'cover' && 'Toda la información es privada y segura.'}
              {wizardStep === 'channel' && 'Puedes volver a cambiar el canal más tarde.'}
              {wizardStep === 'standard' && 'Asigna litros anuales para reflejar ingresos.'}
              {wizardStep === 'importadas' && 'Todos los campos marcados con (*) son obligatorios.'}
            </p>
          </div>
          <div className="flex gap-4">
            
            {/* BACK BUTTONS */}
            {wizardStep === 'cover' && (
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cerrar
              </button>
            )}

            {wizardStep === 'channel' && (
              <button 
                onClick={() => setWizardStep('cover')}
                className="px-6 py-3 bg-slate-100 text-slate-650 rounded-2xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={18} />
                Atrás
              </button>
            )}

            {(wizardStep === 'standard' || wizardStep === 'importadas' || wizardStep === 'soon') && (
              <button 
                onClick={() => setWizardStep('channel')}
                className="px-6 py-3 bg-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-300 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={18} />
                Cambiar Canal
              </button>
            )}

            {/* NEXT/SAVE BUTTONS */}
            {wizardStep === 'cover' && (
              <button 
                onClick={() => setWizardStep('channel')}
                disabled={!userName.trim()}
                className="px-10 py-3 bg-[#0f4c3a] text-white rounded-2xl font-bold hover:bg-[#0b382b] disabled:opacity-50 disabled:bg-slate-350 shadow-xl shadow-[#0f4c3a]/12 transition-all flex items-center gap-2 cursor-pointer"
              >
                Comenzar Formulario
                <ArrowRight size={18} />
              </button>
            )}

            {wizardStep === 'channel' && (
              <button 
                onClick={handleChannelNext}
                disabled={!selectedChannel}
                className="px-10 py-3 bg-[#0f4c3a] text-white rounded-2xl font-bold hover:bg-[#0b382b] disabled:opacity-50 disabled:bg-slate-350 shadow-xl shadow-[#0f4c3a]/12 transition-all flex items-center gap-2 cursor-pointer"
              >
                Siguiente
                <ArrowRight size={18} />
              </button>
            )}

            {wizardStep === 'standard' && (
              <button 
                onClick={handleCreateStandard}
                disabled={saving || !basicData.title || selectedReferences.length === 0}
                className="px-10 py-3 bg-[#0f4c3a] text-white rounded-2xl font-bold hover:bg-[#0b382b] disabled:opacity-50 disabled:bg-slate-350 shadow-xl shadow-[#0f4c3a]/15 transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Plus className="animate-spin" size={18} /> : <Save size={18} />}
                {caseId ? 'Guardar Cambios' : 'Crear Caso de Negocio'}
              </button>
            )}

            {wizardStep === 'importadas' && (
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={handleExportImportadasExcelDirectly}
                  className="px-6 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 shadow-xl shadow-green-150 transition-all flex items-center gap-2"
                >
                  <Download size={18} />
                  Exportar Excel
                </button>
                <button 
                  onClick={handleCreateImportadas}
                  disabled={saving || !importadasData.projectName || !userName}
                  className="px-10 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-300 shadow-xl shadow-emerald-250 transition-all flex items-center gap-2"
                >
                  {saving ? <Plus className="animate-spin" size={18} /> : <Save size={18} />}
                  {caseId ? 'Guardar Cambios' : 'Guardar Caso Importadas'}
                </button>
              </div>
            )}

          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FilterSelect({ label, options, value, onChange }: any) {
  return (
    <div className="relative group">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none min-w-[125px] text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 cursor-pointer pr-8 transition-all group-hover:bg-slate-50"
      >
        <option value="">{label}: Todos</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
    </div>
  );
}

function ChevronDown({ className, size }: any) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
