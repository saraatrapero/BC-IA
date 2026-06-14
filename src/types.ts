export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  faceAuthEnabled?: boolean;
  faceData?: string; // base64 representation or biometric structural hash of the registered face
}

export interface CatalogProduct {
  id?: string;
  name: string;
  family: string;
  brand: string;
  format: string;
  packaging: string;
  material: string;
  cost: number;
  litersPerPallet: number;
  palletsPerTruck: number;
}

export interface BrandLogistics {
  id?: string;
  family: string;
  brand: string;
  origin: string;
}

export interface ColdEquipment {
  id?: string;
  name: string;
  price: number;
  amortizationYears: number;
  category: 'grifo' | 'limpieza' | 'nevera' | 'botellero' | 'otros';
}

export interface FixedCost {
  id?: string;
  name: string;
  monthlyAmount: number;
  isTapRelated?: boolean;
}

export interface MaintenanceCost {
  id?: string;
  name: string;
  amount: number;
  isTapRelated?: boolean;
}

export interface CapillaryRule {
  id?: string;
  business?: string;
  family: string;
  brand: string;
  format: string;
  packaging: string;
  baseCost: number;
}

export interface ReferenceInput {
  productId?: string;
  name: string;
  litersPerYear: number;
  netPrice: number;
  contribution: number;
  rappel: number;
  family?: string;
  brand?: string;
  format?: string;
  packaging?: string;
  cost?: number;
}

export interface GeoService {
  region: string;
  percentage: number;
}

export enum LogisticsType {
  CAPILAR = 'capilar',
  CAMION = 'camion',
  MEDIO_CAMION = 'medio_camion',
  PALLET = 'pallet'
}

export interface BusinessCase {
  id?: string;
  userId: string;
  title: string;
  years: number;
  references: ReferenceInput[];
  logisticsType: LogisticsType;
  geographicService: GeoService[];
  totalMargin?: number;
  totalBenefit?: number;
  totalTax?: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  channel?: 'ALIMENTACION' | 'GRANDES CUENTAS' | 'CONVENIENCIA' | 'IMPORTADAS';
  userName?: string;
  status?: 'pending' | 'positive' | 'negative';
  recommendations?: string;
  equipmentSelection?: { [equipmentId: string]: number };
  importadasData?: {
    negocio: string;
    categorias?: string[];
    litrosHT: number;
    formatosHT: string;
    litrosAlimentacion: number;
    formatosAlimentacion: string;
    litrosGrandesCuentas: number;
    formatosGrandesCuentas: string;
    litrosConveniencia: number;
    formatosConveniencia: string;
    pnHT1: number;
    pnHT2: number;
    pnConveniencia: number;
    pnGrandesCuentas: number;
    pnnAlimentacion: number;
    pnnHT: number;
    pnnConveniencia: number;
    pnnGrandesCuentas: number;
    pvpAlimentacion: number;
    precioCesion: number;
    inversionComercial: number;
    projectName: string;
    creadorNombre?: string;
    litrosPrevistos?: number;
    canalVenta?: string;
    precioNeto?: number;
    precioCesionCosteFabricacion?: number;
    inversionComercialTercero?: number;
    logisticaIncoterm?: string;
    trade?: string;
    aportaciones?: string;
  };
}

export interface GlobalConfig {
  halfTruckDoubleDropFee: number;
  defaultAmortizationYears: number;
  truckCostPerKm: number;
  palletCostPerKm: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export interface CoraTrainingRule {
  id?: string;
  phrase: string;
  response: string;
  createdAt?: string;
}
