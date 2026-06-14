import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Save, AlertTriangle, List } from 'lucide-react';
import { getNextAgentResponse, extractBusinessCaseData, ChatMessage } from '../services/geminiService';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { BusinessCase, CatalogProduct, ReferenceInput } from '../types';
import ProductSelector from './ProductSelector';
import NewCaseModal from './NewCaseModal';

interface ChatAgentProps {
  onFinished: (id: string) => void;
}

export default function ChatAgent({ onFinished }: ChatAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '¡Hola! Soy tu asistente para la creación de casos de negocio. ¿Cómo quieres llamar a este nuevo proyecto?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [reviewData, setReviewData] = useState<Partial<BusinessCase> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', text: textToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const responseText = await getNextAgentResponse(newMessages);
      setMessages([...newMessages, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages([...newMessages, { role: 'model', text: 'Error al conectar con la IA. Prueba de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onProductsConfirm = (references: ReferenceInput[]) => {
    const productsList = references.map(r => 
      `${r.name} (${r.litersPerYear} L/año, ${r.netPrice} €/L, ${r.rappel}% rappel)`
    ).join(', ');
    const info = `He seleccionado los siguientes productos: ${productsList}.`;
    handleSend(info);
    setShowSelector(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await extractBusinessCaseData(messages);
      
      if (!data.title) {
        alert("Parece que faltan datos críticos. Asegúrate de haber definido al menos el título.");
        setSaving(false);
        return;
      }

      setReviewData(data);
    } catch (error) {
      console.error(error);
      alert("Error al extraer datos del caso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl rounded-[2rem] border border-[#1c2621]/8 max-w-4xl mx-auto overflow-hidden shadow-[0_10px_40px_-10px_rgba(15,76,58,0.04)]">
      {/* Header */}
      <div className="p-5 border-b border-[#1c2621]/8 bg-gradient-to-r from-white via-white to-[#faf8f5] flex justify-between items-center select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] uppercase font-bold tracking-widest text-[#0f4c3a] bg-[#0f4c3a]/10 px-2.5 py-0.5 rounded-md">Atelier IA</span>
            <span className="w-1.5 h-1.5 bg-[#0f4c3a] rounded-full animate-bounce" />
          </div>
          <h2 className="font-extrabold text-[#1c2621] text-base flex items-center gap-2">
            <Bot size={18} className="text-[#0f4c3a]" />
            Colega Virtual Cora
          </h2>
          <p className="text-xs text-[#5a6561]">Diseña tu propuesta comercial conversando interactivamente</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0f4c3a] text-white rounded-xl hover:brightness-110 disabled:opacity-50 transition-all font-bold text-xs tracking-wide uppercase shadow-[0_4px_12px_rgba(15,76,58,0.15)] cursor-pointer"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
          Generar Caso
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#faf8f5]/30" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3.5 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(15,76,58,0.04)] border ${
                  m.role === 'user' 
                    ? 'bg-[#0f4c3a] border-[#0f4c3a] text-white' 
                    : 'bg-white border-[#1c2621]/10 text-[#0f4c3a]'
                }`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-[0_4px_16px_rgba(0,0,0,0.015)] ${
                  m.role === 'user' 
                    ? 'bg-[#0f4c3a] text-white rounded-tr-none' 
                    : 'bg-white border border-[#1c2621]/8 text-[#1c2621] rounded-tl-none'
                }`}>
                  <div className={`markdown-body prose prose-sm max-w-none ${m.role === 'user' ? 'prose-invert text-white' : 'prose-slate text-[#1c2621]'}`}>
                    <ReactMarkdown>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#1c2621]/10 text-[#0f4c3a] flex items-center justify-center shadow-[0_2px_8px_rgba(15,76,58,0.04)]">
                <Bot size={16} />
              </div>
              <div className="p-4 bg-white border border-[#1c2621]/8 rounded-2xl rounded-tl-none flex items-center gap-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.015)]">
                <Loader2 className="w-4 h-4 animate-spin text-[#0f4c3a]" />
                <span className="text-xs font-bold text-[#6a7470] tracking-wider uppercase">Cora analizando...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-5 bg-white border-t border-[#1c2621]/8">
        <div className="flex gap-2.5 p-2 bg-[#faf8f5] border border-[#1c2621]/8 rounded-2xl focus-within:ring-2 focus-within:ring-[#0f4c3a]/15 focus-within:border-[#0f4c3a]/30 transition-all">
          <button
            onClick={() => setShowSelector(true)}
            className="p-2 text-[#6a7470] hover:text-[#0f4c3a] hover:bg-white rounded-xl transition-all"
            title="Seleccionar del catálogo"
          >
            <List size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe aquí para conversar o selecciona productos del catálogo..."
            className="flex-1 bg-transparent px-3 text-sm outline-none text-[#1c2621] placeholder-[#6a7470]/50 font-medium"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-[#0f4c3a] text-white rounded-xl hover:bg-[#0f4c3a]/90 disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(15,76,58,0.15)] active:scale-95 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-center text-[#6a7470] mt-3 font-medium">
          💡 Puedes pulsar sobre el icono de lista para insertar productos reales del catálogo oficial directamente en tu propuesta.
        </p>
      </div>

      <AnimatePresence>
        {showSelector && (
          <ProductSelector 
            onConfirm={onProductsConfirm}
            onClose={() => setShowSelector(false)}
          />
        )}
        {reviewData && (
          <NewCaseModal 
            initialData={reviewData}
            onClose={() => setReviewData(null)}
            onSuccess={(id) => {
              setReviewData(null);
              onFinished(id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
