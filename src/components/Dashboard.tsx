import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BusinessCase } from '../types';
import { FileText, Trash2, ChevronRight, Clock, Plus, Search, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que quieres eliminar este caso?')) {
      await deleteDoc(doc(db, 'businessCases', id));
    }
  };

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Stats/Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1">Gestiona y analiza tus proyecciones de negocio.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-r border-slate-100">
            <TrendingUp size={18} className="text-green-600" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Casos</p>
              <p className="text-lg font-bold leading-none">{cases.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2">
            <Clock size={18} className="text-blue-600" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Último</p>
              <p className="text-sm font-bold leading-none">
                {cases.length > 0 ? new Date(cases[0].createdAt).toLocaleDateString() : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
          />
        </div>
      </div>

      {/* Case List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Cargando tus casos...</p>
          </div>
        ) : filteredCases.length > 0 ? (
          <AnimatePresence>
            {filteredCases.map((c) => (
              <motion.div
                layout
                key={c.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onViewCase(c.id!)}
                className="group relative flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText size={24} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate text-lg">{c.title}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
                      <Clock size={14} /> {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 capitalize bg-slate-100 px-2 py-1 rounded-md">
                      {c.logisticsType || 'Logística N/A'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      {c.years} años
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDelete(e, c.id!)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Eliminar"
                  >
                    <Trash2 size={20} />
                  </button>
                  <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 gap-4">
            <Plus size={48} className="opacity-20" />
            <div className="text-center">
              <p className="text-lg font-bold text-slate-600">No hay casos todavía</p>
              <p className="text-sm">Empieza chateando con el asistente para crear tu primer análisis.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
