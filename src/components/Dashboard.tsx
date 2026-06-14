import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BusinessCase } from '../types';
import { FileText, Trash2, ChevronRight, Clock, Plus, Search, TrendingUp, Layout, Edit2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NewCaseModal from './NewCaseModal';

interface DashboardProps {
  onViewCase: (id: string) => void;
}

export default function Dashboard({ onViewCase }: DashboardProps) {
  const [cases, setCases] = useState<BusinessCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'businessCases'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BusinessCase));
      setCases(docs);
      setLoading(false);
    });
  }, []);

  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'businessCases', id));
      setCaseToDelete(null);
    } catch (err: any) {
      console.error("Error al eliminar caso:", err);
      alert(`Error al eliminar caso: ${err.message || err}`);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenFormEvent = () => {
      setIsModalOpen(true);
    };
    window.addEventListener('open-new-case-form', handleOpenFormEvent);
    return () => {
      window.removeEventListener('open-new-case-form', handleOpenFormEvent);
    };
  }, []);

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {isModalOpen && (
          <NewCaseModal 
            onClose={() => setIsModalOpen(false)} 
            onSuccess={(id) => {
              setIsModalOpen(false);
              onViewCase(id);
            }}
          />
        )}
        {editingCaseId && (
          <NewCaseModal 
            caseId={editingCaseId}
            onClose={() => setEditingCaseId(null)} 
            onSuccess={(id) => {
              setEditingCaseId(null);
              onViewCase(id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Stats/Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-stretch gap-6 border-b border-[#1c2621]/10 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 select-none">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#0f4c3a] bg-[#0f4c3a]/10 px-2.5 py-1 rounded-md">Atelier de Modelado</span>
            <span className="w-1.5 h-1.5 bg-[#0f4c3a] rounded-full animate-pulse" />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#1c2621] tracking-tight">
            Dashboard <span className="font-serif italic font-normal text-[#0f4c3a]">Estratégico</span>
          </h2>
          <p className="text-[#5a6561] text-sm max-w-xl">
            Modelación analítica avanzada de flujos financieros, catalogo de productos y amortizaciones de capital.
          </p>
        </div>
        <div className="flex items-center bg-[#fafdfc] p-1.5 rounded-2xl border border-[#1c2621]/10 shadow-[0_2px_12px_rgba(15,76,58,0.02)] select-none shrink-0 self-start md:self-center">
          <div className="flex items-center gap-3 px-6 py-2 border-r border-[#1c2621]/8">
            <TrendingUp size={16} className="text-[#0f4c3a]" />
            <div>
              <p className="text-[9px] uppercase font-bold text-[#6a7470] tracking-wider">Total Modelos</p>
              <p className="text-lg font-black text-[#0f4c3a] leading-none">{cases.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-2">
            <Clock size={16} className="text-[#bc9c6e]" />
            <div>
              <p className="text-[9px] uppercase font-bold text-[#6a7470] tracking-wider">Última Edición</p>
              <p className="text-xs font-black text-[#1c2621] leading-none">
                {cases.length > 0 ? new Date(cases[0].createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Biometrics Information Banner */}
      <div className="bg-gradient-to-r from-[#0f4c3a]/5 via-[#fcfbf7] to-[#faf8f5] border border-[#0f4c3a]/12 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm select-none">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#0f4c3a]/10 text-[#0f4c3a] rounded-2xl border border-[#0f4c3a]/10 shadow-[0_4px_12px_rgba(15,76,58,0.03)] my-auto">
            <Camera size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-[#1c2621] text-sm uppercase tracking-wider flex items-center gap-2">
              Tecnología de Autenticación Biométrica
              <span className="text-[9px] bg-[#0f4c3a] text-white font-bold px-2 py-0.5 rounded-md tracking-wider">ACTIVAL</span>
            </h4>
            <p className="text-xs text-[#5a6561] mt-1 max-w-3xl leading-relaxed">
              Resguarda tus proyecciones y datos críticos de forma soberana. Activa ahora el inicio de sesión ultrarrápido y seguro mediante reconocimiento facial en la barra de navegación lateral.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6a7470]" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título de caso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#1c2621]/10 rounded-2xl text-[#1c2621] placeholder-[#6a7470]/60 focus:ring-2 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/30 transition-all outline-none shadow-sm text-sm"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0f4c3a] text-white rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(15,76,58,0.18)] cursor-pointer text-sm tracking-wide"
        >
          <Layout size={18} />
          Crear Nuevo Caso Manual
        </button>
      </div>

      {/* Case List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-2 border-t-[#0f4c3a] border-[#0f4c3a]/10 rounded-full animate-spin"></div>
            <p className="text-xs font-bold tracking-widest text-[#6a7470] uppercase">Cargando portafolio...</p>
          </div>
        ) : filteredCases.length > 0 ? (
          <AnimatePresence>
            {filteredCases.map((c, idx) => (
              <motion.div
                layout
                key={c.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onViewCase(c.id!)}
                className="group relative flex items-center gap-5 bg-[#ffffff] p-6 rounded-2xl border border-[#1c2621]/8 hover:border-[#0f4c3a]/30 hover:bg-[#faf9f6] transition-all duration-300 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_28px_rgba(15,76,58,0.06)] overflow-hidden"
              >
                {/* Visual Swiss ribbon bar on hover */}
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#0f4c3a] scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />

                {/* Hand-numbered ledger offset */}
                <span className="text-xs font-mono font-bold text-[#bc9c6e]/80 tracking-widest select-none bg-[#faf8f5] px-2.5 py-1.5 rounded-lg border border-[#1c2621]/4">
                  #{String(filteredCases.length - idx).padStart(2, '0')}
                </span>

                <div className="w-10 h-10 bg-[#0f4c3a]/8 text-[#0f4c3a] border border-[#0f4c3a]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0f4c3a] group-hover:text-white transition-all duration-300 shrink-0">
                  <FileText size={18} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-[#1c2621] group-hover:text-[#0f4c3a] truncate text-base md:text-lg transition-colors duration-250 tracking-tight">
                    {c.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#5a6561] bg-[#faf8f5] border border-[#1c2621]/4 px-2.5 py-0.5 rounded-md">
                      <Clock size={12} className="text-[#bc9c6e]" /> {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#5a6561] uppercase bg-[#faf8f5] border border-[#1c2621]/4 px-2.5 py-0.5 rounded-md">
                      {c.logisticsType || 'Sin logística'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#5a6561] bg-[#faf8f5] border border-[#1c2621]/4 px-2.5 py-0.5 rounded-md font-bold">
                      {c.years} años
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {caseToDelete === c.id ? (
                    <div className="flex items-center gap-2">
                       <button
                         onClick={(e) => handleDelete(e, c.id!)}
                         className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all active:scale-95"
                       >
                         Eliminar
                       </button>
                       <button
                         onClick={() => setCaseToDelete(null)}
                         className="px-3 py-1.5 bg-[#faf8f5] hover:bg-[#eae7e0] text-[#1c2621] font-bold text-xs rounded-lg border border-[#1c2621]/10 cursor-pointer transition-all"
                       >
                         No
                       </button>
                     </div>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCaseId(c.id!);
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#0f4c3a] hover:bg-[#0f4c3a]/5 rounded-lg transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaseToDelete(c.id!);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  <ChevronRight size={18} className="text-[#6a7470] group-hover:text-[#0f4c3a] transition-colors duration-250 ml-1" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-[#1c2621]/10 rounded-2xl text-slate-400 gap-4 bg-white/40">
            <Plus size={36} className="opacity-30 text-[#0f4c3a]" />
            <div className="text-center px-4 max-w-md">
              <p className="text-sm font-bold text-[#1c2621]">No se han modelado casos</p>
              <p className="text-xs text-[#5a6561] mt-1">Utiliza el asistente de voz inteligente, conversa con Cora, o define un caso de forma manual para desplegar simulaciones de rentabilidad.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
