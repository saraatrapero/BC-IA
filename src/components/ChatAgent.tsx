import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Save, AlertTriangle, List } from 'lucide-react';
import { getNextAgentResponse, extractBusinessCaseData, ChatMessage } from '../services/geminiService';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { BusinessCase, CatalogProduct } from '../types';
import ProductSelector from './ProductSelector';

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

  const onProductSelect = (product: CatalogProduct) => {
    const info = `He seleccionado el producto: ${product.name} (Marca: ${product.brand}, Formato: ${product.format}, Envase: ${product.packaging}).`;
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

      const newCase: any = {
        ...data,
        userId: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'businessCases'), newCase);
      onFinished(docRef.id);
    } catch (error) {
      console.error(error);
      alert("Error al guardar el caso de negocio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full glass-card max-w-4xl mx-auto overflow-hidden shadow-xl border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white/50 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Bot size={20} className="text-blue-600" />
            Asistente de Business Case
          </h2>
          <p className="text-xs text-slate-500">Completa los datos para generar tu análisis</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all font-semibold shadow-sm"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Generar Caso
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-blue-600'
                }`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  <div className="markdown-body prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown>
                      {m.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-blue-600 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-none flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-slate-500">Pensando...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <button
            onClick={() => setShowSelector(true)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
            title="Seleccionar del catálogo"
          >
            <List size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Responde al asistente o selecciona un producto..."
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Usa el icono de lista para seleccionar productos del catálogo oficial.
        </p>
      </div>

      <AnimatePresence>
        {showSelector && (
          <ProductSelector 
            onSelect={onProductSelect}
            onClose={() => setShowSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
