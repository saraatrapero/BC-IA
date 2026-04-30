export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface CatalogProduct {
  id?: string;
  name: string;
  family: string;
  brand: string;
  format: string;
  packaging: string;
  material: string;
}

export interface ReferenceInput {
  productId?: string;
  name: string;
  litersPerYear: number;
  netPrice: number;
  contribution: number;
  rappel: number;
}

export interface GeoService {
  region: string;
  percentage: number;
}

export enum LogisticsType {
  CAPILAR = 'capilar',
  CAMION = 'camion',
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
}

export interface GlobalConfig {
  capilarCost: number;
  camionCost: number;
  palletCost: number;
  baseProductionCost: number;
  taxRate: number;
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
