import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BusinessCase, GlobalConfig, LogisticsType } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { ChevronLeft, Calculator, TrendingUp, PieChart, Info, MapPin, Package, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
}

export default function CaseDetails({ caseId, onBack }: CaseDetailsProps) {
  const [data, setData] = useState<BusinessCase | null>(null);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get Config
    getDoc(doc(db, 'configs', 'global')).then(snap => {
      if (snap.exists()) setConfig(snap.data() as GlobalConfig);
    });

    // Get Case
    return onSnapshot(doc(db, 'businessCases', caseId), (snap) => {
      if (snap.exists()) {
        setData(snap.data() as BusinessCase);
      }
      setLoading(false);
    });
  }, [caseId]);

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando análisis...</div>;
  if (!data) return <div>No se encontró el caso de negocio.</div>;

  // CALCULATIONS
  const years = data.years || 1;
  const references = data.references || [];
  const logType = data.logisticsType as LogisticsType || LogisticsType.CAPILAR;
  
  const totalLitersYear = references.reduce((acc, r) => acc + (r.litersPerYear || 0), 0);
  const totalGrossRevenueYear = references.reduce((acc, r) => acc + ((r.litersPerYear || 0) * (r.netPrice || 0)), 0);
  const totalContributionsYear = references.reduce((acc, r) => acc + (r.contribution || 0), 0);
  const totalRappelYear = references.reduce((acc, r) => acc + ((r.litersPerYear || 0) * (r.netPrice || 0) * ((r.rappel || 0) / 100)), 0);

  const logisticRate = config[`${logType}Cost` as keyof GlobalConfig] as number;
  const logisticCostYear = totalLitersYear * logisticRate;
  const productionCostYear = totalLitersYear * config.baseProductionCost;

  const totalCostsYear = logisticCostYear + productionCostYear + totalContributionsYear + totalRappelYear;
  const ebitdaYear = totalGrossRevenueYear - totalCostsYear;
  const taxYear = Math.max(0, ebitdaYear * (config.taxRate / 100));
  const netBenefitYear = ebitdaYear - taxYear;

  // Project totals (multiplied by years)
  const totalRevenue = totalGrossRevenueYear * years;
  const totalCosts = totalCostsYear * years;
  const totalBenefit = netBenefitYear * years;
  const totalTax = taxYear * years;

  const chartData = [
    { name: 'Ingresos', value: totalRevenue, color: '#3b82f6' },
    { name: 'Costes', value: totalCosts, color: '#ef4444' },
    { name: 'Impuestos', value: totalTax, color: '#f59e0b' },
    { name: 'Beneficio Neto', value: totalBenefit, color: '#22c55e' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 bg-white"
        >
          <ChevronLeft />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">{data.title}</h2>
          <p className="text-slate-500">Análisis proyectado a {years} años</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Core Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard 
              label="Margen Total" 
              value={totalRevenue - totalCosts} 
              icon={<TrendingUp className="text-blue-500" />} 
              suffix="€"
            />
            <StatCard 
              label="Beneficio Neto" 
              value={totalBenefit} 
              icon={<Calculator className="text-green-500" />} 
              suffix="€" 
              highlight
            />
            <StatCard 
              label="Impuestos Est." 
              value={totalTax} 
              icon={<PieChart className="text-amber-500" />} 
              suffix="€"
            />
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
              <TrendingUp size={20} className="text-blue-600" />
              Proyección Financiera Total
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table of references */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Package size={20} className="text-blue-600" />
                Desglose por Referencia (Anual)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">Producto</th>
                    <th className="px-6 py-3 font-semibold text-right">Lts/Año</th>
                    <th className="px-6 py-3 font-semibold text-right">P.Neto</th>
                    <th className="px-6 py-3 font-semibold text-right">Margen Bruto</th>
                    <th className="px-6 py-3 font-semibold text-right">Rappel ({references[0]?.rappel}%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {references.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.name}</td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-600">{r.litersPerYear?.toLocaleString()} L</td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-600">{r.netPrice?.toLocaleString()} €</td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums font-semibold text-slate-900">
                        {((r.litersPerYear || 0) * (r.netPrice || 0)).toLocaleString()} €
                      </td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-500">
                        {((r.litersPerYear || 0) * (r.netPrice || 0) * ((r.rappel || 0) / 100)).toLocaleString()} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-blue-600" />
              Presencia Geográfica
            </h3>
            <div className="space-y-3">
              {(data.geographicService || []).map((g, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{g.region}</span>
                    <span className="font-bold text-blue-600">{g.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${g.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Info size={18} className="text-blue-600" />
              Parámetros de Cálculo
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Logística</span>
                <span className="font-semibold capitalize">{logType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Log. ({logType})</span>
                <span className="font-semibold">{logisticRate} €/L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Prod. Base</span>
                <span className="font-semibold">{config.baseProductionCost} €/L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tasa Impuestos</span>
                <span className="font-semibold">{config.taxRate}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg shadow-blue-200 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold mb-2">Resumen AI</h3>
              <div className="text-sm opacity-90 markdown-body prose prose-invert prose-sm">
                <ReactMarkdown>{data.summary || 'Generando resumen...'}</ReactMarkdown>
              </div>
              {!data.summary && (
                <p className="text-xs italic mt-2 opacity-70">El agente está procesando los resultados finales...</p>
              )}
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BotIcon size={80} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, suffix = '', highlight = false }: any) {
  return (
    <div className={`p-5 rounded-3xl border transition-all ${
      highlight 
        ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200 text-white' 
        : 'bg-white border-slate-200 shadow-sm text-slate-900 group hover:border-blue-500'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <span className={highlight ? 'text-blue-100' : 'text-slate-400 group-hover:text-blue-500 transition-colors'}>
          {icon}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-blue-200' : 'text-slate-400'}`}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black">{Math.round(value).toLocaleString()}</span>
        <span className={`text-sm font-semibold ${highlight ? 'text-blue-200' : 'text-slate-500'}`}>{suffix}</span>
      </div>
    </div>
  );
}

function BotIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
