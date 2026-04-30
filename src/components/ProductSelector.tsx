import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CatalogProduct } from '../types';
import { Search, Filter, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductSelectorProps {
  onSelect: (product: CatalogProduct) => void;
  onClose: () => void;
}

export default function ProductSelector({ onSelect, onClose }: ProductSelectorProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    family: '',
    brand: '',
    format: ''
  });

  useEffect(() => {
    return onSnapshot(collection(db, 'catalogProducts'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
      setLoading(false);
    });
  }, []);

  const families = Array.from(new Set(products.map(p => p.family))).filter(Boolean);
  const brands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean);

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.family.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFamily = !filters.family || p.family === filters.family;
    const matchesBrand = !filters.brand || p.brand === filters.brand;
    return matchesSearch && matchesFamily && matchesBrand;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-900">Seleccionar Producto</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">Cerrar</button>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nombre, marca o familia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              <FilterSelect 
                label="Familia" 
                options={families} 
                value={filters.family} 
                onChange={(v) => setFilters(f => ({ ...f, family: v }))} 
              />
              <FilterSelect 
                label="Marca" 
                options={brands} 
                value={filters.brand} 
                onChange={(v) => setFilters(f => ({ ...f, brand: v }))} 
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Cargando catálogo...</div>
          ) : filtered.length > 0 ? (
            <div className="grid gap-2">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{p.name}</h4>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {p.brand} • {p.family} • {p.format}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {p.packaging} | {p.material}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">No se encontraron productos.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function FilterSelect({ label, options, value, onChange }: any) {
  return (
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      <option value="">{label}: Todos</option>
      {options.map((o: string) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
