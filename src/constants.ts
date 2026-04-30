import { GlobalConfig } from "./types";

export const DEFAULT_CONFIG: GlobalConfig = {
  capilarCost: 0.15, // € per liter
  camionCost: 0.05, // € per liter  
  palletCost: 0.08, // € per liter
  baseProductionCost: 0.40, // € per liter
  taxRate: 21, // %
};

export const REGIONS = [
  "Madrid",
  "Barcelona",
  "Valencia",
  "Sevilla",
  "Bilbao",
  "Málaga",
  "Zaragoza",
  "Otros"
];
