import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { BusinessCase, GlobalConfig, LogisticsType, BrandLogistics, CapillaryRule, ColdEquipment, CatalogProduct, MaintenanceCost, FixedCost } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { ChevronLeft, Calculator, TrendingUp, PieChart, Info, MapPin, Package, Download, Wind, Truck, Edit2, CheckCircle2, XCircle, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import XLSX from 'xlsx-js-style';
import NewCaseModal from './NewCaseModal';


const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    if (!entry) return null;
    
    // Filter and sort details
    const rawDetails = entry.details || [];
    const details = rawDetails.filter((d: any) => Math.round(Math.abs(d.value)) > 0);

    return (
      <div className="bg-slate-900/95 text-slate-100 p-4 rounded-2xl shadow-xl border border-slate-800 max-w-sm text-xs space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-xs tracking-tight text-white flex items-center gap-1.5 uppercase">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono font-black text-sm text-slate-100">
            {Math.round(entry.value).toLocaleString()} €
          </span>
        </div>
        
        {details.length > 0 ? (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 select-none">
            {details.map((d: any, i: number) => {
              const val = Math.round(d.value);
              const percentage = entry.value > 0 ? ((d.value / entry.value) * 100) : 0;
              const formattedPercentage = val >= 0 && entry.value > 0 ? `${Math.round(percentage)}%` : '';
              
              return (
                <div key={i} className="flex justify-between items-center gap-4 text-[11px]">
                  <span className="text-slate-400 font-medium truncate max-w-[190px]" title={d.label}>
                    {d.label}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-right shrink-0">
                    <span className={d.isNegative || val < 0 ? "text-rose-400 font-semibold" : "text-slate-200 font-medium"}>
                      {val.toLocaleString()} €
                    </span>
                    {formattedPercentage && !d.isNegative && val >= 0 && (
                      <span className="text-[10px] text-slate-500 font-semibold">
                        ({formattedPercentage})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic pb-1">
            Sin desglose adicional disponible para esta selección.
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
}

export default function CaseDetails({ caseId, onBack }: CaseDetailsProps) {
  const [data, setData] = useState<BusinessCase | null>(null);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [capillaryRules, setCapillaryRules] = useState<CapillaryRule[]>([]);
  const [brandLogistics, setBrandLogistics] = useState<BrandLogistics[]>([]);
  const [coldEquipment, setColdEquipment] = useState<ColdEquipment[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<MaintenanceCost[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [recommendationInput, setRecommendationInput] = useState('');
  const [showNegExplanation, setShowNegExplanation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Get Config
      const configSnap = await getDoc(doc(db, 'configs', 'global'));
      if (configSnap.exists()) setConfig(configSnap.data() as GlobalConfig);

      // Get Master Data Tables
      const capSnap = await getDocs(collection(db, 'capillaryRules'));
      setCapillaryRules(capSnap.docs.map(d => ({ id: d.id, ...d.data() } as CapillaryRule)));

      const brandSnap = await getDocs(collection(db, 'brandLogistics'));
      setBrandLogistics(brandSnap.docs.map(d => ({ id: d.id, ...d.data() } as BrandLogistics)));

      const coldSnap = await getDocs(collection(db, 'coldEquipment'));
      setColdEquipment(coldSnap.docs.map(d => ({ id: d.id, ...d.data() } as ColdEquipment)));

      const maintSnap = await getDocs(collection(db, 'maintenanceCosts'));
      setMaintenanceCosts(maintSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceCost)));

      const fixedSnap = await getDocs(collection(db, 'fixedCosts'));
      setFixedCosts(fixedSnap.docs.map(d => ({ id: d.id, ...d.data() } as FixedCost)));

      const prodSnap = await getDocs(collection(db, 'catalogProducts'));
      setCatalogProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogProduct)));

      // Check if user is admin
      if (auth.currentUser) {
        const uDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (uDoc.exists()) {
          const profile = uDoc.data();
          setIsAdmin(profile?.role === 'admin' || auth.currentUser.email === 'jtrapero2013@gmail.com');
        } else if (auth.currentUser.email === 'jtrapero2013@gmail.com') {
          setIsAdmin(true);
        }
      }

      // Get Case
      onSnapshot(doc(db, 'businessCases', caseId), (snap) => {
        if (snap.exists()) {
          const cData = snap.data() as BusinessCase;
          setData(cData);
        }
        setLoading(false);
      });
    };

    fetchData();
  }, [caseId]);

  useEffect(() => {
    if (data) {
      setRecommendationInput(data.recommendations || '');
      if (data.status === 'negative') {
        setShowNegExplanation(true);
      } else {
        setShowNegExplanation(false);
      }
    }
  }, [data]);

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando análisis...</div>;
  if (!data) return <div>No se encontró el caso de negocio.</div>;  // CALCULATIONS
  const years = data.years || 1;
  const references = data.references || [];
  const logType = data.logisticsType as LogisticsType || LogisticsType.CAPILAR;
  
  // 1. Production & Material Costs
  const totalLitersYear = references.reduce((acc, r) => acc + (r.litersPerYear || 0), 0);
  const baseProductionCostYear = 0; // Removed per user request

  // Check if channel is IMPORTADAS
  const isImportadas = data.channel === 'IMPORTADAS' && !!data.importadasData;
  const imp = data.importadasData;

  // Let's compute the unified Horeca parameters if it is Importadas
  const pnnAlim = imp?.pnnAlimentacion || 0;
  
  // Compute IMPORTADAS values
  const totalLitersHT = imp?.litrosHT || 0;
  const totalLitersAlimentary = imp?.litrosAlimentacion || 0;
  const totalLitersGrandesCuentas = imp?.litrosGrandesCuentas || 0;
  const totalLitersConveniencia = imp?.litrosConveniencia || 0;
  
  const totalLitersHoreca = totalLitersHT + totalLitersGrandesCuentas + totalLitersConveniencia;
  const totalLitersImp = totalLitersAlimentary + totalLitersHoreca;

  const pnnHTVal = imp?.pnnHT || 0;
  const pnnConvenienciaVal = imp?.pnnConveniencia || 0;
  const pnnGrandesCuentasVal = imp?.pnnGrandesCuentas || 0;

  const hasExplicitPnnOthers = !!(pnnHTVal || pnnConvenienciaVal || pnnGrandesCuentasVal);
  const revHoreca = hasExplicitPnnOthers
    ? (totalLitersHT * pnnHTVal + totalLitersConveniencia * pnnConvenienciaVal + totalLitersGrandesCuentas * pnnGrandesCuentasVal)
    : (totalLitersHoreca * (pnnAlim * 1.5));

  const pnnHoreca = totalLitersHoreca > 0 
    ? revHoreca / totalLitersHoreca 
    : (pnnHTVal || pnnConvenienciaVal || pnnGrandesCuentasVal || (pnnAlim * 1.5));

  const revAlimentary = totalLitersAlimentary * pnnAlim;
  const totalRevenueImp = revAlimentary + revHoreca;

  const costFabImp = totalLitersImp * (imp?.precioCesion || 0);
  const invComImp = imp?.inversionComercial || 0;

  // 2. Logistics & Profitability per Reference
  const DISTANCES: Record<string, Record<string, number>> = {
    'Madrid': { 'Madrid': 20, 'Barcelona': 620, 'Valencia': 350, 'Sevilla': 530, 'Bilbao': 400, 'Málaga': 530, 'Zaragoza': 310, 'Nacional': 350, 'Otros': 400 },
    'Barcelona': { 'Madrid': 620, 'Barcelona': 20, 'Valencia': 350, 'Sevilla': 1000, 'Bilbao': 600, 'Málaga': 970, 'Zaragoza': 310, 'Nacional': 500, 'Otros': 500 },
    'Valencia': { 'Madrid': 350, 'Barcelona': 350, 'Valencia': 20, 'Sevilla': 650, 'Bilbao': 600, 'Málaga': 620, 'Zaragoza': 310, 'Nacional': 400, 'Otros': 400 },
    'Sevilla': { 'Madrid': 530, 'Barcelona': 1000, 'Valencia': 650, 'Sevilla': 20, 'Bilbao': 860, 'Málaga': 200, 'Zaragoza': 840, 'Nacional': 500, 'Otros': 500 },
    'Bilbao': { 'Madrid': 400, 'Barcelona': 600, 'Valencia': 600, 'Sevilla': 860, 'Bilbao': 20, 'Málaga': 900, 'Zaragoza': 300, 'Nacional': 450, 'Otros': 450 },
    'Málaga': { 'Madrid': 530, 'Barcelona': 970, 'Valencia': 620, 'Sevilla': 200, 'Bilbao': 900, 'Málaga': 20, 'Zaragoza': 840, 'Nacional': 500, 'Otros': 500 },
    'Zaragoza': { 'Madrid': 310, 'Barcelona': 310, 'Valencia': 310, 'Sevilla': 840, 'Bilbao': 300, 'Málaga': 840, 'Zaragoza': 20, 'Nacional': 350, 'Otros': 350 },
  };

  const getDistance = (origin: string, destination: string) => {
    const o = origin.charAt(0).toUpperCase() + origin.slice(1).toLowerCase();
    const d = destination.charAt(0).toUpperCase() + destination.slice(1).toLowerCase();
    return DISTANCES[o]?.[d] || DISTANCES[d]?.[o] || 350;
  };

  const profitabilityByMaterial = references.map(ref => {
    const product = catalogProducts.find(p => p.id === ref.productId || p.name === ref.name);
    const brandLog = brandLogistics.find(bl => bl.brand === ref.brand);
    const origin = brandLog?.origin || 'Madrid';

    const litersPerPallet = product?.litersPerPallet || 500;
    const palletsPerTruck = product?.palletsPerTruck || 33;
    const litersPerTruck = litersPerPallet * palletsPerTruck;

    const pallets = (ref.litersPerYear || 0) / litersPerPallet;
    const trucks = (ref.litersPerYear || 0) / litersPerTruck;

    // Weighted distance
    const weightedDistance = (data.geographicService || []).reduce((acc, geo) => {
      const d = getDistance(origin, geo.region);
      return acc + (d * (geo.percentage / 100));
    }, 0) || 350;

    let logCost = 0;
    if (logType === LogisticsType.CAPILAR) {
      const rule = capillaryRules.find(c => 
        c.family === ref.family && 
        c.brand === ref.brand &&
        c.format === ref.format && 
        c.packaging === ref.packaging
      ) || capillaryRules.find(c => 
        c.family === ref.family && 
        c.format === ref.format && 
        c.packaging === ref.packaging
      );
      const capillaryBaseUnitCost = rule ? rule.baseCost : 0.12; 
      logCost = (trucks * weightedDistance * config.truckCostPerKm) + ((ref.litersPerYear || 0) * capillaryBaseUnitCost);
    } else if (logType === LogisticsType.CAMION) {
      logCost = trucks * weightedDistance * config.truckCostPerKm;
    } else if (logType === LogisticsType.MEDIO_CAMION) {
      logCost = (trucks * weightedDistance * config.truckCostPerKm) + config.halfTruckDoubleDropFee;
    } else { // PALLET
      logCost = pallets * weightedDistance * config.palletCostPerKm;
    }

    const revenue = (ref.litersPerYear || 0) * (ref.netPrice || 0);
    const matCost = (ref.litersPerYear || 0) * (ref.cost || 0);
    const commCost = (ref.contribution || 0) + (revenue * ((ref.rappel || 0) / 100));
    const totalCost = logCost + matCost + commCost;
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    return {
      ...ref,
      revenue,
      logCost,
      matCost,
      commCost,
      totalCost,
      margin,
      marginPct
    };
  });

  const logisticsCostYear = profitabilityByMaterial.reduce((acc, p) => acc + p.logCost, 0);
  const materialCostYear = profitabilityByMaterial.reduce((acc, p) => acc + p.matCost, 0);
  const totalContributionsYear = references.reduce((acc, r) => acc + (r.contribution || 0), 0);
  const totalRappelYear = profitabilityByMaterial.reduce((acc, p) => acc + (p.revenue * ((p.rappel || 0) / 100)), 0);

  // 3. Equipment Amortization & Maintenance
  const hasFormat8 = references.some(r => r.format === '8');
  
  const selectedEquipCheck = coldEquipment.filter(eq => (data.equipmentSelection?.[eq.id!] || 0) > 0);
  const totalEquipQty = selectedEquipCheck.reduce((sum, eq) => sum + (data.equipmentSelection?.[eq.id!] || 0), 0);

  const amortizationTotal = coldEquipment.reduce((acc, eq) => {
    const qty = data.equipmentSelection ? (data.equipmentSelection[eq.id!] || 0) : 0;
    if (qty === 0) return acc;
    if (eq.category === 'grifo' || eq.name.toLowerCase().includes('grifo')) {
      if (!hasFormat8) return acc;
    }
    const eqYears = eq.amortizationYears || 5;
    return acc + ((eq.price / eqYears) * qty);
  }, 0);

  const maintenanceTotal = maintenanceCosts.reduce((acc, m) => {
    if (m.isTapRelated && !hasFormat8) return acc;
    return acc + (m.amount || 0);
  }, 0);

  const fixedCostsTotal = fixedCosts.reduce((acc, f) => {
    if (f.isTapRelated && !hasFormat8) return acc;
    return acc + (f.monthlyAmount * 12);
  }, 0);

  const coolingAmortizationYear = amortizationTotal + maintenanceTotal + fixedCostsTotal;

  // 4. Revenue & Margin
  const totalGrossRevenueYear = profitabilityByMaterial.reduce((acc, p) => acc + p.revenue, 0);
  const totalCostsYear = logisticsCostYear + materialCostYear + totalContributionsYear + totalRappelYear + coolingAmortizationYear;
  const ebitdaYear = totalGrossRevenueYear - totalCostsYear;
  const taxYear = 0; // Removed per user request
  const netBenefitYear = ebitdaYear; 

  // Project totals
  const totalRevenue = isImportadas ? totalRevenueImp * years : totalGrossRevenueYear * years;
  const totalCosts = isImportadas ? (costFabImp + invComImp) * years : totalCostsYear * years;
  const totalBenefit = isImportadas ? (totalRevenueImp - (costFabImp + invComImp)) * years : netBenefitYear * years;
  const totalTax = taxYear * years;

  const marginPercent = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 105 : 0; // standard display margin helper percentage (revenue vs benefit)
  const actualMarginPercent = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

  const chartData = isImportadas
    ? [
        { 
          name: 'Ingresos Totales', 
          value: totalRevenueImp * years, 
          color: '#3b82f6',
          details: [
            { label: 'Canal Alimentación', value: revAlimentary * years },
            ...(totalLitersHT > 0 ? [{ label: `HT (${pnnHTVal} €/L)`, value: (totalLitersHT * pnnHTVal) * years }] : []),
            ...(totalLitersConveniencia > 0 ? [{ label: `Conveniencia (${pnnConvenienciaVal} €/L)`, value: (totalLitersConveniencia * pnnConvenienciaVal) * years }] : []),
            ...(totalLitersGrandesCuentas > 0 ? [{ label: `Grandes Cuentas (${pnnGrandesCuentasVal} €/L)`, value: (totalLitersGrandesCuentas * pnnGrandesCuentasVal) * years }] : []),
            ...(!hasExplicitPnnOthers && totalLitersHoreca > 0 ? [{ label: `Canal HORECA (${(pnnAlim * 1.5).toFixed(2)} €/L)`, value: revHoreca * years }] : [])
          ]
        },
        { 
          name: 'Costes Producción/Cesión', 
          value: costFabImp * years, 
          color: '#94a3b8',
          details: [
            { label: `Precio Cesión de Fábrica (${imp?.precioCesion} €/L)`, value: costFabImp * years }
          ]
        },
        { 
          name: 'Inversión Comercial', 
          value: invComImp * years, 
          color: '#ec4899',
          details: [
            { label: 'Inversión Comercial Asignada', value: invComImp * years }
          ]
        },
        { 
          name: 'Beneficio Neto Estimado', 
          value: (totalRevenueImp - (costFabImp + invComImp)) * years, 
          color: '#22c55e',
          details: [
            { label: 'Ingresos Totales', value: totalRevenueImp * years },
            { label: 'Coste Producción/Cesión (Restado)', value: -(costFabImp * years), isNegative: true },
            { label: 'Inversión Comercial (Restado)', value: -(invComImp * years), isNegative: true }
          ]
        }
      ]
    : [
        { 
          name: 'Ingresos', 
          value: totalRevenue, 
          color: '#3b82f6',
          details: profitabilityByMaterial.map(p => ({
            label: `${p.name} (${p.brand})`,
            value: p.revenue * years
          }))
        },
        { 
          name: 'Materiales', 
          value: materialCostYear * years, 
          color: '#94a3b8',
          details: profitabilityByMaterial.map(p => ({
            label: p.name,
            value: p.matCost * years
          }))
        },
        { 
          name: 'Logística', 
          value: logisticsCostYear * years, 
          color: '#f59e0b',
          details: profitabilityByMaterial.map(p => ({
            label: `${p.name} (${logType})`,
            value: p.logCost * years
          }))
        },
        { 
          name: 'Frío Amort.', 
          value: coolingAmortizationYear * years, 
          color: '#06b6d4',
          details: [
            ...(selectedEquipCheck.map(eq => {
              const qty = data.equipmentSelection ? (data.equipmentSelection[eq.id!] || 0) : 0;
              return {
                label: `Amort. ${eq.name} (x${qty})`,
                value: (eq.price / (eq.amortizationYears || 5)) * qty * years
              };
            })),
            ...(maintenanceTotal > 0 ? [{
              label: 'Mantenimiento Técnico Frío',
              value: maintenanceTotal * years
            }] : []),
            ...(fixedCostsTotal > 0 ? [{
              label: 'Costes Fijos Dispensación/Grifos',
              value: fixedCostsTotal * years
            }] : [])
          ]
        },
        { 
          name: 'Comercial', 
          value: (totalContributionsYear + totalRappelYear) * years, 
          color: '#ec4899',
          details: profitabilityByMaterial.map(p => ({
            label: `${p.name} (Aportación, Rappel)`,
            value: p.commCost * years
          }))
        },
        { 
          name: 'Beneficio Neto', 
          value: totalBenefit, 
          color: '#22c55e',
          details: [
            ...profitabilityByMaterial.map(p => ({
              label: `Margen prod.: ${p.name}`,
              value: p.margin * years
            })),
            ...(coolingAmortizationYear > 0 ? [{
              label: 'Costes Generales de Frío (Restado)',
              value: -(coolingAmortizationYear * years),
              isNegative: true
            }] : [])
          ]
        },
      ];

  const handleExportExcel = () => {
    if (!data) return;

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

    const isGrandesCuentas = data.channel === 'GRANDES CUENTAS';
    if (isGrandesCuentas) {
      const colCount = profitabilityByMaterial.length;
      
      // Initialize matrix with room for the grid, spacers, general info, and associated amortizations
      const gridRows: any[][] = [];
      for (let r = 0; r < 14; r++) {
        gridRows.push(new Array(colCount + 2).fill(""));
      }

      // Column A Labels (Mimicking the uploaded image reference row indexes)
      gridRows[0][0] = "id articulo";
      gridRows[1][0] = "DESCRIPCION";
      gridRows[2][0] = "";
      gridRows[3][0] = "";
      gridRows[4][0] = "";
      gridRows[5][0] = ""; 
      gridRows[6][0] = ""; 
      gridRows[7][0] = "Litros";
      gridRows[8][0] = "PN";
      gridRows[9][0] = "PNN";
      gridRows[10][0] = "Margen Bruto €/L";
      gridRows[11][0] = "% Margen Bruto";
      gridRows[12][0] = "Margen Bruto €";

      let totalLiters = 0;
      let totalRevenue = 0;
      let totalPnnRevenue = 0;
      let totalMargin = 0;

      // Populate each product column
      profitabilityByMaterial.forEach((p, idx) => {
        const colIdx = idx + 1;
        const prod = catalogProducts.find(pr => pr.id === p.productId || pr.name === p.name);
        const artId = prod?.material || p.productId || '2011122';
        
        const liters = p.litersPerYear || 0;
        const pn = p.netPrice || 0;
        const pnn = pn * (1 - (p.rappel || 0) / 100);
        const revenue = liters * pn;
        const margin = p.margin || 0;
        const marginPerLiter = liters > 0 ? margin / liters : 0;
        const marginPct = revenue > 0 ? margin / revenue : 0;

        totalLiters += liters;
        totalRevenue += revenue;
        totalPnnRevenue += liters * pnn;
        totalMargin += margin;

        gridRows[0][colIdx] = artId;
        gridRows[1][colIdx] = p.name || 'N/A';
        gridRows[2][colIdx] = "";
        gridRows[3][colIdx] = "";
        gridRows[4][colIdx] = "";
        gridRows[5][colIdx] = "€/L";
        gridRows[6][colIdx] = artId; 
        gridRows[7][colIdx] = liters;
        gridRows[8][colIdx] = pn;
        gridRows[9][colIdx] = pnn;
        gridRows[10][colIdx] = marginPerLiter;
        gridRows[11][colIdx] = marginPct;
        gridRows[12][colIdx] = margin;
      });

      // Populate TOTAL Column
      const totalColIdx = colCount + 1;
      gridRows[0][totalColIdx] = "TOTAL";
      gridRows[1][totalColIdx] = "";
      gridRows[2][totalColIdx] = "";
      gridRows[3][totalColIdx] = "";
      gridRows[4][totalColIdx] = "";
      gridRows[5][totalColIdx] = "€/L";
      gridRows[6][totalColIdx] = "TOTAL";
      gridRows[7][totalColIdx] = totalLiters;
      gridRows[8][totalColIdx] = totalLiters > 0 ? totalRevenue / totalLiters : 0;
      gridRows[9][totalColIdx] = totalLiters > 0 ? totalPnnRevenue / totalLiters : 0;
      gridRows[10][totalColIdx] = totalLiters > 0 ? totalMargin / totalLiters : 0;
      gridRows[11][totalColIdx] = totalRevenue > 0 ? totalMargin / totalRevenue : 0;
      gridRows[12][totalColIdx] = totalMargin;

      // Append general metadata and remaining settings "DEBAJO DEL TODO"
      gridRows.push([]); // Row 14
      gridRows.push([]); // Row 15
      gridRows.push(["=== DATOS GENERALES DEL CASO ==="]);
      gridRows.push(["Nombre del Caso", data.title]);
      gridRows.push(["Creador / Gestor", data.userName || "N/A"]);
      gridRows.push(["Horizonte Temporal", `${years} años`]);
      gridRows.push(["Asignación Logística Principal", logType.toUpperCase()]);

      const geoStr = (data.geographicService || []).map(g => `${g.region} (${g.percentage}%)`).join(', ');
      gridRows.push(["Distribución Capilar Geográfica", geoStr || "100% Nacional"]);

      gridRows.push([]);
      gridRows.push(["=== AMORTIZACIÓN Y GASTOS GENERALES DE FRÍO (ANUAL) ==="]);
      gridRows.push(["Amortización Equipos Frío Anual", amortizationTotal]);
      gridRows.push(["Mantenimiento Técnico Frío Anual", maintenanceTotal]);
      gridRows.push(["Costes Fijos de Dispensación (Grifos)", fixedCostsTotal]);
      gridRows.push(["TOTAL Costes Anuales de Frío", coolingAmortizationYear]);

      gridRows.push([]);
      gridRows.push(["=== RESUMEN DE RENTABILIDAD PROYECTADA (TOTAL PROYECTO) ==="]);
      gridRows.push(["Ingresos Brutos Estimados", totalRevenue]);
      gridRows.push(["Coste de Materiales total", materialCostYear * years]);
      gridRows.push(["Incurridos de Logística total", logisticsCostYear * years]);
      gridRows.push(["Amortizaciones & Fijos acumulados", coolingAmortizationYear * years]);
      gridRows.push(["Contribuciones y Rappels total", (totalContributionsYear + totalRappelYear) * years]);
      gridRows.push(["BENEFICIO NETO TOTAL ESTIMADO (EBITDA)", totalBenefit]);

      if (recommendationInput) {
        gridRows.push([]);
        gridRows.push(["=== RECOMENDACIONES Y DIRECCIÓN ADMIN ==="]);
        gridRows.push(["Recomendación del Administrador", recommendationInput]);
      }

      const wsGC = XLSX.utils.aoa_to_sheet(gridRows);

      // Define columns widths dynamically for legibility
      const cols: { wch: number }[] = [{ wch: 35 }]; // Column A gets wide label support
      for (let i = 0; i < colCount; i++) {
        cols.push({ wch: 16 });
      }
      cols.push({ wch: 18 }); // TOTAL Column
      wsGC['!cols'] = cols;

      // Apply highly refined precise styling matching the uploaded image
      const borderStyle = {
        top: { style: "thin", color: { rgb: "BFBFBF" } },
        bottom: { style: "thin", color: { rgb: "BFBFBF" } },
        left: { style: "thin", color: { rgb: "BFBFBF" } },
        right: { style: "thin", color: { rgb: "BFBFBF" } }
      };

      for (const key in wsGC) {
        if (key.startsWith('!')) continue;
        const cell = wsGC[key];
        if (!cell) continue;

        const col = key.replace(/[0-9]/g, '');
        const rowNum = parseInt(key.replace(/[^0-9]/g, ''));

        // Default cell layout
        cell.s = {
          font: { name: "Arial", sz: 10, color: { rgb: "000000" } },
          alignment: { vertical: "center", horizontal: col === 'A' ? 'left' : 'right' },
          border: borderStyle
        };

        const val = cell.v;
        const isNum = (typeof val === 'number');
        const isNeg = isNum && val < 0;

        // Custom styling blocks representing the matrix (Rows 1 to 13)
        if (rowNum <= 13) {
          // --- Rows 1 to 6, columns B through TOTAL (meaning col !== 'A') represent the Light Blue Header Space
          if (rowNum >= 1 && rowNum <= 6) {
            if (col !== 'A') {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "DCE6F1" } }; // Soft corporate light blue
              cell.s.font.bold = true;
              cell.s.font.color = { rgb: "000000" };
              cell.s.alignment.horizontal = "center";
              if (rowNum === 6) {
                cell.s.alignment.horizontal = "right";
              }
            } else {
              // Row 1 & 2 column A labels
              cell.s.font.bold = true;
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "F2F2F2" } };
            }
          }

          // --- Row 7: Dark Subheader with ID repetition
          else if (rowNum === 7) {
            cell.s.fill = { patternType: "solid", fgColor: { rgb: "595959" } }; // Dark grey
            cell.s.font.bold = true;
            cell.s.font.color = { rgb: "FFFFFF" }; // White text
            cell.s.alignment.horizontal = col === 'A' ? "left" : "center";
          }

          // --- Rows 8 to 13: Main analytical data rows
          else if (rowNum >= 8 && rowNum <= 13) {
            // Column A labels
            if (col === 'A') {
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "595959" } }; // Dark grey label headers
              cell.s.font.bold = true;
              cell.s.font.color = { rgb: "FFFFFF" }; // White text
              cell.s.alignment.horizontal = "left";
            } else {
              // Performance columns (B to TOTAL)
              cell.s.font.bold = true;

              // Row 11 & 12: Margen Bruto €/L and % Margen Bruto (Grey background and color highlights)
              if (rowNum === 11 || rowNum === 12) {
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "F2F2F2" } }; // Light gray background
                if (isNeg) {
                  cell.s.font.color = { rgb: "C00000" }; // Red text
                } else {
                  cell.s.font.color = { rgb: "000000" }; // Black text
                }
              }

              // Row 13: Margen Bruto € (White background, bold color text)
              else if (rowNum === 13) {
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                if (isNeg) {
                  cell.s.font.color = { rgb: "C00000" }; // Bold red for negative margin euros
                } else {
                  cell.s.font.color = { rgb: "000000" };
                }
              }

              // Row 8, 9, 10: Litros, PN, PNN (White background, bold black)
              else {
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                cell.s.font.color = { rgb: "000000" };
              }
            }
          }

          // Assign number formats precisely
          if (isNum) {
            if (rowNum === 8) {
              cell.z = '#,##0'; // Litros formatted as integer
            } else if (rowNum === 12) {
              cell.z = '0.00%'; // percent formatted
            } else if (rowNum === 13) {
              cell.z = '#,##0'; // margins in euro formatted as integer rounded
            } else {
              cell.z = '#,##0.000'; // 3 decimals for PN, PNN, €/L as in image!
            }
          }
        }

        // --- Custom Styling for Appendix under the main matrix (Row 14 and onwards) "DEBAJO DEL TODO"
        else if (rowNum >= 14) {
          const textVal = String(val);
          // Header lines
          if (textVal.startsWith("===") && textVal.endsWith("===")) {
            cell.s = {
              font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
              fill: { patternType: "solid", fgColor: { rgb: "34495E" } }, // Cool corporate dark blue/slate
              alignment: { vertical: "center", horizontal: "left" }
            };
          } else {
            // Parameter descriptive lines
            cell.s = {
              font: { name: "Arial", sz: 9, color: { rgb: "333333" } },
              alignment: { vertical: "center", horizontal: col === 'A' ? "left" : "right" },
              border: {
                bottom: { style: "thin", color: { rgb: "EAEAEA" } }
              }
            };
            if (col === 'A') {
              cell.s.font.bold = true;
              cell.s.fill = { patternType: "solid", fgColor: { rgb: "F9F9F9" } };
            }
            if (isNum) {
              cell.z = '#,##0.00';
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsGC, 'Modelo_Financiero_GC');
      XLSX.writeFile(wb, `Analisis_Grandes_Cuentas_${data.title.replace(/\s+/g, '_')}.xlsx`);
      return;
    }

    if (isImportadas) {
      const decesion = imp?.precioCesion || 0;
      const invTotal = imp?.inversionComercial || 0;

      const lAlim = imp?.litrosAlimentacion || 0;
      const lHT = imp?.litrosHT || 0;
      const lGC = imp?.litrosGrandesCuentas || 0;
      const lConv = imp?.litrosConveniencia || 0;
      const lTotal = lAlim + lHT + lGC + lConv;

      const fAlimStr = imp?.formatosAlimentacion || "Lata 33cl";
      const fHTStr = imp?.formatosHT || "Bot 70cl";
      const fGCStr = imp?.formatosGrandesCuentas || "Bot 70cl";
      const fConvStr = imp?.formatosConveniencia || "Bot 70cl";

      const volAlimUd = parseFormatInLiters(fAlimStr);
      const volHTUd = parseFormatInLiters(fHTStr);
      const volGCUd = parseFormatInLiters(fGCStr);
      const volConvUd = parseFormatInLiters(fConvStr);

      // Math according to pricing ladder
      const pnnAlimVal = imp?.pnnAlimentacion || 0;
      const pnnHTVal = imp?.pnnHT || 0;
      const pnnConvVal = imp?.pnnConveniencia || 0;
      const pnnGCVal = imp?.pnnGrandesCuentas || 0;

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

      // exact 2D grid layout matching the image columns with Conveniencia and Grandes Cuentas added:
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

      // Sheet generation 
      const wsModel = XLSX.utils.aoa_to_sheet(gridRows);

      // Define columns width for legibility
      wsModel['!cols'] = [
        { wch: 28 }, // Labels
        { wch: 18 }, // Alimentación
        { wch: 18 }, // HT
        { wch: 18 }, // Conveniencia
        { wch: 18 }, // Grandes Cuentas
        { wch: 20 }  // Total Agrega
      ];

      // Merge Cells for sku/s spanning over B2:F2
      wsModel['!merges'] = [
        { s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }
      ];

      // Professional styling layout (currency, liter formats and zero decimals where applicable)
      for (const key in wsModel) {
        if (key.startsWith('!')) continue;
        const cell = wsModel[key];
        if (cell && cell.t === 'n') {
          const rowNum = parseInt(key.replace(/[^0-9]/g, ''));
          // Row 4 is "Litros" => formatted as integers with custom ' L'
          if (rowNum === 4) {
            cell.z = '#,##0" L"';
          } else if (rowNum === 10) {
            cell.z = '0.00"%"';
          } else {
            cell.z = '#,##0.00" €"';
          }
        }
      }

      // Add Model Sheet as the FIRST tab!
      applyExcelStyling(wsModel);
      XLSX.utils.book_append_sheet(wb, wsModel, 'sku_s_Modelo_Financiero');

      // 2. Questionnaire/Form original answers sheet
      const summaryData = [
        { Concepto: 'Título del Proyecto', Valor: data.title },
        { Concepto: 'Canal de Venta Principal', Valor: 'IMPORTADAS' },
        { Concepto: 'Negocio de Aplicación', Valor: imp?.negocio || 'N/A' },
        { Concepto: 'Horizonte Temporal', Valor: `${years} años` },
        { Concepto: 'Autor / Creador', Valor: data.userName || 'N/A' },
        { Concepto: 'PREVISIONES VOLUMEN (LITROS):', Valor: '' },
        { Concepto: '  - Litros HT', Valor: imp?.litrosHT || 0 },
        { Concepto: '  - Formatos HT', Valor: imp?.formatosHT || 'N/A' },
        { Concepto: '  - Litros Alimentación', Valor: imp?.litrosAlimentacion || 0 },
        { Concepto: '  - Formatos Alimentación', Valor: imp?.formatosAlimentacion || 'N/A' },
        { Concepto: '  - Litros Grandes Cuentas', Valor: imp?.litrosGrandesCuentas || 0 },
        { Concepto: '  - Formatos Grandes Cuentas', Valor: imp?.formatosGrandesCuentas || 'N/A' },
        { Concepto: '  - Litros Conveniencia', Valor: imp?.litrosConveniencia || 0 },
        { Concepto: '  - Formatos Conveniencia', Valor: imp?.formatosConveniencia || 'N/A' },
        { Concepto: 'PRECIOS OBJETIVOS / CESIÓN / INVERSIÓN:', Valor: '' },
        { Concepto: '  - PNN objetivo (€/L) Alimentación', Valor: imp?.pnnAlimentacion || 0 },
        { Concepto: '  - PNN objetivo (€/L) HT', Valor: imp?.pnnHT || 0 },
        { Concepto: '  - PNN objetivo (€/L) Conveniencia', Valor: imp?.pnnConveniencia || 0 },
        { Concepto: '  - PNN objetivo (€/L) Grandes Cuentas', Valor: imp?.pnnGrandesCuentas || 0 },
        { Concepto: '  - Precio de cesión / coste fabricación', Valor: imp?.precioCesion || 0 },
        { Concepto: '  - Inversión comercial', Valor: imp?.inversionComercial || 0 }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      applyBasicSheetStyling(wsSummary);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Datos_Entrada_Importacion');

      XLSX.writeFile(wb, `Analisis_Importacion_${data.title.replace(/\s+/g, '_')}.xlsx`);
      return;
    }

    // Sheet 1: Summary
    const summaryData = [
      { Concepto: 'Título', Valor: data.title },
      { Concepto: 'Horizonte Temporal', Valor: `${years} años` },
      { Concepto: 'Tipo Logística', Valor: logType },
      { Concepto: 'Ingresos Totales (Proyecto)', Valor: totalRevenue },
      { Concepto: 'Costes Totales (Proyecto)', Valor: totalCosts },
      { Concepto: 'Beneficio Neto (Proyecto)', Valor: totalBenefit },
      { Concepto: 'Impuestos Estimados', Valor: totalTax }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    applyBasicSheetStyling(wsSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    // Sheet 2: References
    const refData = references.map(r => ({
      Producto: r.name,
      Familia: r.family,
      Marca: r.brand,
      Formato: r.format,
      Coste_Material: r.cost,
      Litros_Año: r.litersPerYear,
      Precio_Neto_L: r.netPrice,
      Ingresos_Anual: (r.litersPerYear || 0) * (r.netPrice || 0),
      Rappel_Anual: (r.litersPerYear || 0) * (r.netPrice || 0) * ((r.rappel || 0) / 100),
      Contribucion: r.contribution
    }));
    const wsRefs = XLSX.utils.json_to_sheet(refData);
    applyBasicSheetStyling(wsRefs);
    XLSX.utils.book_append_sheet(wb, wsRefs, 'Referencias');

    // Sheet 3: Breakdown
    const breakdownData = chartData.map(d => ({
      Concepto: d.name,
      Valor_Euros: d.value
    }));
    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownData);
    applyBasicSheetStyling(wsBreakdown);
    XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Desglose_Costes');

    XLSX.writeFile(wb, `Analisis_${data.title.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleResolveCase = async (status: 'positive' | 'negative') => {
    setAdminSaving(true);
    try {
      const caseRef = doc(db, 'businessCases', caseId);
      const updateData: Partial<BusinessCase> = {
        status,
        recommendations: status === 'negative' ? recommendationInput : ''
      };
      await setDoc(caseRef, updateData, { merge: true });
      setShowNegExplanation(status === 'negative');
    } catch (err) {
      console.error('Error updating case resolution:', err);
    } finally {
      setAdminSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 hover:bg-[#0f4c3a]/5 rounded-xl transition-colors border border-[#1c2621]/10 bg-white text-[#1c2621] hover:text-[#0f4c3a] cursor-pointer shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-extrabold text-[#1c2621] tracking-tight">{data.title}</h2>
            <p className="text-[#5a6561] text-xs font-mono font-bold tracking-wider mt-0.5">Análisis proyectado a {years} años</p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-white text-[#1c2621] border border-[#1c2621]/10 hover:border-[#0f4c3a]/30 rounded-2xl hover:bg-[#faf8f5] transition-all font-bold shadow-sm cursor-pointer text-sm"
          >
            <Edit2 size={16} className="text-[#bc9c6e]" /> Editar Caso
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-3.5 bg-[#0f4c3a] text-white rounded-2xl hover:brightness-110 transition-all font-black shadow-lg shadow-[#0f4c3a]/12 cursor-pointer text-sm"
          >
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Core Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <StatCard 
              label="Margen Total" 
              value={totalRevenue - totalCosts} 
              icon={<TrendingUp className="text-[#0f4c3a]" />} 
              suffix="€"
              percentage={marginPercent}
            />
            <StatCard 
              label="Beneficio Neto" 
              value={totalBenefit} 
              icon={<Calculator className="text-[#bc9c6e]" />} 
              suffix="€" 
              highlight
            />
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#1c2621]/8 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
            <h3 className="font-extrabold text-[#1c2621] mb-6 flex items-center gap-2.5 text-md uppercase tracking-tight">
              <TrendingUp size={20} className="text-[#0f4c3a]" />
              Desglose de Costes y Beneficio
            </h3>
            <div className="h-[350px] w-full relative">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(28,38,33,0.04)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#6a7470" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    cursor={{fill: 'rgba(28, 38, 33, 0.015)'}}
                    content={<CustomTooltip />}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table of references or custom channels breakdown */}
          {isImportadas ? (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Canales y Objetivos Financieros (Anual)
                </h3>
                <span className="bg-[#0f4c3a] text-white font-black px-3 py-1 text-[11px] rounded-lg uppercase tracking-wider">
                  Negocio: {imp?.negocio}
                </span>
              </div>
              <div className="p-6 space-y-6">
                
                {/* 2x2 grid for channels */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* HT Box */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#0f4c3a] bg-[#0f4c3a]/5 px-2.5 py-1 rounded-md uppercase">Hostelería Tradicional (HT)</span>
                      <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{imp?.formatosHT || 'Formato N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Litros Previstas</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.litrosHT || 0).toLocaleString()} L</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-[#0f4c3a]">PN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnHT1 || 0).toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-emerald-700">PNN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnnHT || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Alimentación Box */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-pink-700 bg-pink-50 px-2.5 py-1 rounded-md uppercase">Alimentación</span>
                      <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{imp?.formatosAlimentacion || 'Formato N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Litros Previstos</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.litrosAlimentacion || 0).toLocaleString()} L</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-emerald-700">PNN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnnAlimentacion || 0).toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-indigo-700">PVP (€/Ud)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pvpAlimentacion || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Grandes Cuentas Box */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md uppercase">Grandes Cuentas</span>
                      <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{imp?.formatosGrandesCuentas || 'Formato N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Litros Previstas</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.litrosGrandesCuentas || 0).toLocaleString()} L</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-[#0f4c3a]">PN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnGrandesCuentas || 0).toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-emerald-700">PNN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnnGrandesCuentas || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Conveniencia Box */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md uppercase">Conveniencia</span>
                      <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">{imp?.formatosConveniencia || 'Formato N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Litros Previstas</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.litrosConveniencia || 0).toLocaleString()} L</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-[#0f4c3a]">PN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnConveniencia || 0).toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-extrabold text-emerald-700">PNN (€/L)</p>
                        <p className="text-sm font-black text-slate-800">{(imp?.pnnConveniencia || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Industrial Costs & Total Volume */}
                <div className="grid sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wide">Litros Acumulados</p>
                    <p className="text-lg font-black text-emerald-900">{totalLitersImp.toLocaleString()} Litros</p>
                  </div>
                  <div className="p-4 bg-[#0f4c3a]/5 rounded-xl border border-[#0f4c3a]/15">
                    <p className="text-[10px] text-[#0f4c3a] font-bold uppercase tracking-wide">Precio de Cesión / Coste Fab.</p>
                    <p className="text-lg font-black text-[#0f4c3a]">{(imp?.precioCesion || 0).toFixed(2)} €/Litro</p>
                  </div>
                  <div className="p-4 bg-pink-50/50 rounded-xl border border-pink-100">
                    <p className="text-[10px] text-pink-800 font-bold uppercase tracking-wide">Inversión Comercial Registrada</p>
                    <p className="text-lg font-black text-pink-900">{(imp?.inversionComercial || 0).toLocaleString()} €</p>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Package size={20} className="text-[#0f4c3a]" />
                  Desglose por Referencia (Anual)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-6 py-3 font-semibold">Producto</th>
                      <th className="px-6 py-3 font-semibold text-right">Lts/Año</th>
                      <th className="px-6 py-3 font-semibold text-right">Ingresos</th>
                      <th className="px-6 py-3 font-semibold text-right">C. Log</th>
                      <th className="px-6 py-3 font-semibold text-right">C. Mat</th>
                      <th className="px-6 py-3 font-semibold text-right">C. Com</th>
                      <th className="px-6 py-3 font-semibold text-right">Margen</th>
                      <th className="px-6 py-3 font-semibold text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {profitabilityByMaterial.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-700">
                          {p.name}
                          <div className="text-[10px] text-slate-400 font-normal">{p.packaging} • {p.brand}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-600">{p.litersPerYear?.toLocaleString()} L</td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-900 font-medium">
                          {p.revenue.toLocaleString()}€
                        </td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums text-amber-600">
                          -{p.logCost.toLocaleString()}€
                        </td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums text-slate-500">
                          -{p.matCost.toLocaleString()}€
                        </td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums text-pink-600">
                          -{p.commCost.toLocaleString()}€
                        </td>
                        <td className="px-6 py-4 text-sm text-right tabular-nums font-bold text-slate-900">
                          {p.margin.toLocaleString()}€
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${p.marginPct > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {p.marginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* RESOLUTION CARD PANEL */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CheckCircle2 size={18} className="text-[#0f4c3a]" />
              Estado y Resolución del Caso
            </h3>

            {/* Regular User Agent View */}
            {!isAdmin && (
              <div className="space-y-3">
                {(!data.status || data.status === 'pending') && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="text-amber-500 animate-pulse" size={18} />
                      <span className="font-extrabold text-xs uppercase tracking-wide">Pendiente de Revisión</span>
                    </div>
                    <p className="text-[11px] font-bold leading-relaxed">
                      Este caso está pendiente de revisión. El administrador analizará la rentabilidad neta antes de conceder la aprobación comercial.
                    </p>
                  </div>
                )}

                {data.status === 'positive' && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-emerald-500" size={18} />
                      <span className="font-extrabold text-xs uppercase tracking-wide">Rentabilidad Validada</span>
                    </div>
                    <p className="text-[11px] font-bold leading-relaxed">
                      ¡Felicidades! El administrador ha certificado este caso con una viabilidad económica y comercial positiva. El margen neto cumple los requisitos establecidos.
                    </p>
                  </div>
                )}

                {data.status === 'negative' && (
                  <div className="space-y-3">
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-rose-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="text-rose-500" size={18} />
                        <span className="font-extrabold text-xs uppercase tracking-wide">Rentabilidad Negativa</span>
                      </div>
                      <p className="text-[11px] font-bold leading-relaxed">
                        El administrador ha determinado que este caso no es viable en su estado actual debido a márgenes insuficientes o costes excesivos.
                      </p>
                    </div>

                    {data.recommendations && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Recomendaciones del Administrador</span>
                        <div className="text-xs text-slate-700 font-bold bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed shadow-sm">
                          {data.recommendations}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Administrador Control View */}
            {isAdmin && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Actual:</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    data.status === 'positive' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : data.status === 'negative'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {data.status === 'positive' ? 'Rentabilidad Positiva' : data.status === 'negative' ? 'Rentabilidad Negativa' : 'Pendiente'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={adminSaving}
                    onClick={() => handleResolveCase('positive')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] font-black transition-all hover:scale-[1.02] active:scale-[0.98] border ${
                      data.status === 'positive'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <ThumbsUp size={13} /> Rentabilidad +
                  </button>

                  <button
                    disabled={adminSaving}
                    onClick={() => {
                      setShowNegExplanation(true);
                      if (data.status !== 'negative') {
                        // Keep state and focus input area
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] font-black transition-all hover:scale-[1.02] active:scale-[0.98] border ${
                      data.status === 'negative' || showNegExplanation
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <ThumbsDown size={13} /> Rentabilidad -
                  </button>
                </div>

                {showNegExplanation && (
                  <div className="pt-2 space-y-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">
                      ¿Qué debe corregir el agente?
                    </label>
                    <textarea
                      placeholder="Redacta las recomendaciones o correcciones que el agente debe aplicar en costes fijos, alquileres, compras, etc..."
                      value={recommendationInput}
                      onChange={(e) => setRecommendationInput(e.target.value)}
                      className="w-full h-28 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0f4c3a]/20 focus:border-[#0f4c3a]/30 text-slate-800 font-bold leading-relaxed resize-none"
                    />
                    <button
                      disabled={adminSaving || !recommendationInput.trim()}
                      onClick={() => handleResolveCase('negative')}
                      className="w-full flex items-center justify-center gap-1 py-2 bg-[#0f4c3a] hover:bg-[#0f4c3a]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
                    >
                      {adminSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Guardar Recomendación'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-[#0f4c3a]" />
              Presencia Geográfica
            </h3>
            <div className="space-y-3">
              {(data.geographicService || []).map((g, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{g.region}</span>
                    <span className="font-bold text-[#0f4c3a]">{g.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0f4c3a]" style={{ width: `${g.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Info size={18} className="text-[#0f4c3a]" />
              Parámetros de Cálculo
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-4">
                <Truck size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Configuración de Envío</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Logística</span>
                <span className="font-semibold capitalize">{logType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Camión</span>
                <span className="font-semibold">{config.truckCostPerKm}€ / KM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Pallet</span>
                <span className="font-semibold">{config.palletCostPerKm}€ / KM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Log. Total</span>
                <span className="font-semibold">{Math.round(logisticsCostYear).toLocaleString()} €/Año</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coste Mat. Total</span>
                <span className="font-semibold">{Math.round(materialCostYear).toLocaleString()} €/Año</span>
              </div>
            </div>
          </div>

          {coolingAmortizationYear > 0 && (
            <div className="bg-cyan-50 p-6 rounded-3xl border border-cyan-100 shadow-sm">
              <h3 className="font-bold text-cyan-800 mb-4 flex items-center gap-2">
                <Wind size={18} /> Equipos de Frío e Instalaciones
              </h3>
              <div className="space-y-2 text-sm text-cyan-700">
                <div className="flex justify-between">
                  <span>Equipos Configurados</span>
                  <span className="font-bold">{totalEquipQty} Equipos ({selectedEquipCheck.length} tipos)</span>
                </div>
                {selectedEquipCheck.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cyan-200 space-y-1.5 text-xs">
                    <p className="font-black uppercase tracking-wider text-[10px] text-cyan-800 mb-2">Detalle de Equipamiento Ofertado:</p>
                    {selectedEquipCheck.map(eq => {
                      const qty = data.equipmentSelection?.[eq.id!] || 0;
                      const annAmort = (eq.price / (eq.amortizationYears || 5)) * qty;
                      return (
                        <div key={eq.id} className="flex justify-between items-center text-cyan-600 font-medium">
                          <span>{eq.name} (x{qty})</span>
                          <span>{Math.round(annAmort).toLocaleString()} €/Año (Total {Math.round(annAmort * years).toLocaleString()} €)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between border-t border-cyan-200 pt-2 mt-2">
                  <span>Carga Anual (Amort + Mtto)</span>
                  <span className="font-bold">{Math.round(coolingAmortizationYear).toLocaleString()} €/Año</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-[#0f4c3a] to-emerald-950 p-6 rounded-3xl text-white shadow-lg shadow-black/10 relative overflow-hidden">
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

      <AnimatePresence>
        {isEditModalOpen && (
          <NewCaseModal 
            caseId={caseId}
            onClose={() => setIsEditModalOpen(false)} 
            onSuccess={() => {
              setIsEditModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon, suffix = '', highlight = false, percentage }: any) {
  return (
    <div className={`p-5 rounded-3xl border transition-all duration-300 ${
      highlight 
        ? 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-slate-950/40 border-emerald-500/20 shadow-xl shadow-emerald-500/5 text-slate-100' 
        : 'bg-[#0b0f1a]/50 border-white/5 text-slate-100 group hover:border-indigo-500/25 hover:bg-[#0e1324]/80'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <span className={highlight ? 'text-emerald-400' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'}>
          {icon}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black tracking-tight font-mono">{Math.round(value).toLocaleString()}</span>
          <span className={`text-xs font-bold ${highlight ? 'text-emerald-400/80' : 'text-slate-500'}`}>{suffix}</span>
        </div>
        {percentage !== undefined && (
          <div className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg ${highlight ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-300 border border-white/5'}`}>
            {percentage.toFixed(1)}%
          </div>
        )}
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
