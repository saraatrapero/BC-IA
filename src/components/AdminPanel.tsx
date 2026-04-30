import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GlobalConfig, CatalogProduct } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { Save, Loader2, DollarSign, Truck, Package, Percent, Settings2, Info, Upload, Download, Trash2, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'costs' | 'catalog'>('costs');
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Costs Config
    const unsubCosts = onSnapshot(doc(db, 'configs', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as GlobalConfig);
      } else {
        setDoc(doc(db, 'configs', 'global'), DEFAULT_CONFIG);
      }
      setLoading(false);
    });

    // Catalog Products
    const unsubCatalog = onSnapshot(collection(db, 'catalogProducts'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct));
      setProducts(items);
    });

    return () => {
      unsubCosts();
      unsubCatalog();
    };
  }, []);

  const handleSaveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'configs', 'global'), config);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        
        // Batch upload
        const batch = writeBatch(db);
        json.forEach((product: any) => {
          const newDocRef = doc(collection(db, 'catalogProducts'));
          batch.set(newDocRef, {
            name: product.name || 'Sin nombre',
            family: product.family || 'Otros',
            brand: product.brand || 'Genérica',
            format: product.format || 'N/A',
            packaging: product.packaging || 'N/A',
            material: product.material || 'N/A'
          });
        });

        await batch.commit();
        setMessage({ type: 'success', text: `${json.length} productos importados correctamente.` });
      } catch (err) {
        setMessage({ type: 'error', text: 'Error al procesar el archivo. Asegúrate de que sea un JSON válido.' });
      } finally {
        setSaving(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const data = products.length > 0 ? products : [
      { name: "Producto Ejemplo", family: "Bebidas", brand: "Marca X", format: "1L", packaging: "Tetra", material: "Cartón" }
    ];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalogo_productos.json';
    a.click();
  };

  const clearCatalog = async () => {
    if (!confirm('¿Estás seguro de que quieres borrar TODO el catálogo?')) return;
    setSaving(true);
    try {
      const snap = await getDocs(collection(db, 'catalogProducts'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setMessage({ type: 'success', text: 'Catálogo vaciado.' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al vaciar catálogo.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Panel de Administración</h2>
          <p className="text-slate-500 mt-1">Configura parámetros y gestiona el catálogo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('costs')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'costs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Costes Globales
        </button>
        <button 
          onClick={() => setActiveTab('catalog')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'catalog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Catálogo de Productos
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'costs' ? (
          <motion.div 
            key="costs" 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-4 text-blue-800 shadow-sm">
              <Info className="shrink-0" />
              <p className="text-sm">
                Estos valores se utilizan como base para todos los cálculos. Los cambios afectan a nuevos análisis.
              </p>
            </div>

            <form onSubmit={handleSaveCosts} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="text-blue-600" />
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Logística (€/Litro)</h3>
                  </div>
                  <div className="space-y-4">
                    {['capilarCost', 'camionCost', 'palletCost'].map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-600 mb-1 capitalize">{field.replace('Cost', '')}</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="number" step="0.01" 
                            value={config[field as keyof GlobalConfig]}
                            onChange={(e) => setConfig(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="text-blue-600" />
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Producción e Impuestos</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Coste Producción (€/Litro)</label>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number" step="0.01" value={config.baseProductionCost}
                          onChange={(e) => setConfig(prev => ({ ...prev, baseProductionCost: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Tipo Impositivo (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number" step="0.5" value={config.taxRate}
                          onChange={(e) => setConfig(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Guardar Costes
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="catalog" 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <List size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Maestro de Productos</h3>
                  <p className="text-sm text-slate-500">{products.length} productos registrados.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  <Download size={18} /> Exportar JSON
                </button>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 cursor-pointer shadow-md transition-all">
                  <Upload size={18} /> Importar JSON
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
                <button 
                  onClick={clearCatalog}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Familia</th>
                      <th className="px-6 py-3">Marca</th>
                      <th className="px-6 py-3">Formato</th>
                      <th className="px-6 py-3">Envase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {products.map((p) => (
                      <tr key={p.id} className="text-sm hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-800">{p.name}</td>
                        <td className="px-6 py-4 text-slate-600">{p.family}</td>
                        <td className="px-6 py-4 text-slate-600">{p.brand}</td>
                        <td className="px-6 py-4 text-slate-500">{p.format}</td>
                        <td className="px-6 py-4 text-slate-500">{p.packaging} ({p.material})</td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                          No hay productos. Importa un archivo JSON para empezar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl font-medium text-sm border ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {message.text}
        </motion.div>
      )}
    </div>
  );
}
