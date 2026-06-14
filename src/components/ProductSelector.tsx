import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CatalogProduct, ReferenceInput } from '../types';
import { Search, Filter, Check, ChevronDown, Plus, Trash2, Calculator, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductSelectorProps {
  onConfirm: (references: ReferenceInput[]) => void;
  onClose: () => void;
}

export default function ProductSelector({ onConfirm, onClose }: ProductSelectorProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<ReferenceInput[]>([]);
  const [filters, setFilters] = useState({
    family: '',
    brand: '',
    format: '',
    packaging: ''
  });

  useEffect(() => {
    return onSnapshot(collection(db, 'catalogProducts'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));
      setLoading(false);
    });
  }, []);

  const families = Array.from(new Set(products.map(p => p.family))).filter(Boolean);
  const brands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean);
  const packagings = Array.from(new Set(products.map(p => p.packaging))).filter(Boolean);
  const formats = Array.from(new Set(products.map(p => p.format))).filter(Boolean);

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.family.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFamily = !filters.family || p.family === filters.family;
    const matchesBrand = !filters.brand || p.brand === filters.brand;
    const matchesPackaging = !filters.packaging || p.packaging === filters.packaging;
    const matchesFormat = !filters.format || p.format === filters.format;
    return matchesSearch && matchesFamily && matchesBrand && matchesPackaging && matchesFormat;
  });

  const toggleProduct = (p: CatalogProduct) => {
    const isSelected = selectedItems.some(r => r.productId === p.id);
    if (isSelected) {
      setSelectedItems(prev => prev.filter(r => r.productId !== p.id));
    } else {
      setSelectedItems(prev => [...prev, {
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

  const updateItem = (productId: string, field: keyof ReferenceInput, value: any) => {
    setSelectedItems(prev => prev.map(r => {
      if (r.productId === productId) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0f4c3a] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#0f4c3a]/15">
              <Calculator size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[#1c2621] uppercase tracking-tight">Matriz de Materiales</h3>
              <p className="text-[#6a7470] font-medium text-sm">Selecciona productos y define volúmenes en tiempo real</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[#0f4c3a]/5 rounded-2xl transition-colors text-slate-400 hover:text-rose-500">
            <Trash2 size={24} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Advanced Search & Filter Bar */}
          <div className="p-8 pb-6 border-b border-slate-50 space-y-4 bg-white">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Buscar por material, marca, negocio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-[#0f4c3a]/25 focus:border-[#0f4c3a]/30 font-bold text-slate-800 transition-all shadow-sm"
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
          </div>

          {/* Main Table Matrix */}
          <div className="flex-1 overflow-auto bg-slate-50/30">
            <table className="w-full border-separate border-spacing-y-2 px-8">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                  <th className="py-4 pl-6 w-16">Sel.</th>
                  <th className="py-4 px-4">Material / Marca</th>
                  <th className="py-4 px-4 text-center">Litros / Año</th>
                  <th className="py-4 px-4 text-center">Precio Neto (€/L)</th>
                  <th className="py-4 px-4 text-center">Rappel (%)</th>
                  <th className="py-4 pr-6 text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="pb-8">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">Cargando catálogo...</td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map(p => {
                    const selectedItem = selectedItems.find(r => r.productId === p.id);
                    const isSelected = !!selectedItem;
                    return (
                      <tr 
                        key={p.id} 
                        className={`group transition-all ${isSelected ? 'bg-[#0f4c3a]/5' : 'bg-white'} hover:shadow-md rounded-2xl`}
                      >
                        <td className="py-4 pl-6 rounded-l-2xl">
                          <button 
                            onClick={() => toggleProduct(p)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#0f4c3a] text-white shadow-lg shadow-[#0f4c3a]/25' 
                                : 'bg-[#e2dfd9] text-slate-550 hover:bg-[#0f4c3a]/10 hover:text-[#0f4c3a]'
                            }`}
                          >
                            {isSelected ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className={`font-bold text-sm ${isSelected ? 'text-[#0f4c3a]' : 'text-slate-800'}`}>{p.name}</p>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-tight">{p.brand} • {p.family}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <input 
                              type="number"
                              step="any"
                              value={isNaN(Number(selectedItem?.litersPerYear)) ? '' : selectedItem?.litersPerYear}
                              onChange={e => updateItem(p.id!, 'litersPerYear', parseFloat(e.target.value) || 0)}
                              className="w-28 mx-auto block bg-white border border-slate-200 rounded-xl px-4 py-2 text-center text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/25 outline-none"
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <input 
                              type="number"
                              step="any"
                              value={isNaN(Number(selectedItem?.netPrice)) ? '' : selectedItem?.netPrice}
                              onChange={e => updateItem(p.id!, 'netPrice', parseFloat(e.target.value) || 0)}
                              className="w-28 mx-auto block bg-white border border-slate-200 rounded-xl px-4 py-2 text-center text-sm font-mono font-bold text-[#0f4c3a] focus:ring-2 focus:ring-[#0f4c3a]/25 outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <input 
                              type="number"
                              step="any"
                              value={isNaN(Number(selectedItem?.rappel)) ? '' : selectedItem?.rappel}
                              onChange={e => updateItem(p.id!, 'rappel', parseFloat(e.target.value) || 0)}
                              className="w-24 mx-auto block bg-white border border-slate-200 rounded-xl px-4 py-2 text-center text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#0f4c3a]/25 outline-none"
                              placeholder="0%"
                            />
                          </div>
                        </td>
                        <td className="py-4 pr-6 text-right rounded-r-2xl">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{p.packaging}</p>
                          <p className="text-[10px] font-black text-slate-900">{p.format}</p>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic">No se encontraron materiales para tu búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {selectedItems.slice(0, 5).map((s, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-[#0f4c3a]/10 border-2 border-white flex items-center justify-center text-[10px] font-black text-[#0f4c3a]">
                  {s.name[0]}
                </div>
              ))}
              {selectedItems.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-600">
                  +{selectedItems.length - 5}
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">
              {selectedItems.length} materiales seleccionados
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-[#f5f1ea] scroll-m-1 text-[#1c2621] border border-[#1c2621]/15 rounded-2xl font-bold hover:bg-[#eae7e1] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              disabled={selectedItems.length === 0}
              onClick={() => onConfirm(selectedItems)}
              className="px-12 py-3 bg-[#0f4c3a] text-white rounded-2xl font-bold hover:bg-[#0b382b] disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl shadow-[#0f4c3a]/12 active:scale-95 cursor-pointer"
            >
              <Save size={20} strokeWidth={2.5} />
              Añadir a la Proyección
            </button>
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
        className="appearance-none min-w-[125px] text-xs font-bold text-[#1c2621] bg-[#f5f1ea] px-4 py-2.5 rounded-xl border border-[#1c2621]/10 outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 cursor-pointer pr-8 transition-all group-hover:bg-[#eae7e1]"
      >
        <option value="">{label}: Todos</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
    </div>
  );
}
