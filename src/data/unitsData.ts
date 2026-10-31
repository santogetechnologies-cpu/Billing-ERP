import { Unit, UnitCategory } from '../types';
import {
  UNIVERSAL_UNITS,
  UNIVERSAL_UNIT_LIST,
  UniversalUnitCode,
  normalizeUniversalUnit,
  formatUnitQuantity,
  parseNaturalQuantityInput,
  calculateCutStrip,
  parseScaleBarcode
} from '../utils/universalUnitSystem';

export interface SystemUnitDefinition {
  name: string;
  symbol: string;
  category: UnitCategory;
  isBase?: boolean;
  label?: string;
  decimalPlaces: number;
  allowsDecimals: boolean;
}

// Exactly the 9 Universal ERP Units (Part E)
export const UNIVERSAL_BUILTIN_UNITS: SystemUnitDefinition[] = [
  {
    name: 'Pieces / Numbers',
    symbol: 'PCS',
    category: 'Count',
    isBase: true,
    label: 'Pieces (PCS)',
    decimalPlaces: 0,
    allowsDecimals: false
  },
  {
    name: 'Strip',
    symbol: 'STRIP',
    category: 'Packaging',
    isBase: true,
    label: 'Strip (STRIP)',
    decimalPlaces: 0,
    allowsDecimals: false
  },
  {
    name: 'Tablet / Capsule',
    symbol: 'TAB',
    category: 'Count',
    isBase: false,
    label: 'Tablet (TAB)',
    decimalPlaces: 0,
    allowsDecimals: false
  },
  {
    name: 'Box / Pack',
    symbol: 'BOX',
    category: 'Packaging',
    isBase: false,
    label: 'Box (BOX)',
    decimalPlaces: 0,
    allowsDecimals: false
  },
  {
    name: 'Set / Pair',
    symbol: 'SET',
    category: 'Count',
    isBase: false,
    label: 'Set (SET)',
    decimalPlaces: 0,
    allowsDecimals: false
  },
  {
    name: 'Kilogram',
    symbol: 'KG',
    category: 'Weight',
    isBase: true,
    label: 'Kilogram (KG)',
    decimalPlaces: 3,
    allowsDecimals: true
  },
  {
    name: 'Liter',
    symbol: 'LTR',
    category: 'Volume',
    isBase: true,
    label: 'Liter (LTR)',
    decimalPlaces: 3,
    allowsDecimals: true
  },
  {
    name: 'Meter',
    symbol: 'MTR',
    category: 'Length',
    isBase: true,
    label: 'Meter (MTR)',
    decimalPlaces: 3,
    allowsDecimals: true
  },
  {
    name: 'Square Feet',
    symbol: 'SQF',
    category: 'Area',
    isBase: false,
    label: 'Square Feet (SQF)',
    decimalPlaces: 2,
    allowsDecimals: true
  }
];

export const ALL_UNIT_CATEGORIES: UnitCategory[] = [
  'Count',
  'Weight',
  'Volume',
  'Length',
  'Area',
  'Packaging',
  'Custom'
];

export const BUILTIN_UNIT_CODES = new Set([
  'pcs', 'strip', 'tab', 'box', 'set', 'kg', 'ltr', 'mtr', 'sqf'
]);

export function isBuiltInUnit(unit: { name?: string; symbol?: string; id?: string; isCustom?: boolean }): boolean {
  if (unit.isCustom === true) return false;
  if (unit.id?.startsWith('builtin-')) return true;
  const sym = (unit.symbol || '').trim().toLowerCase();
  const name = (unit.name || '').trim().toLowerCase();
  return BUILTIN_UNIT_CODES.has(sym) || BUILTIN_UNIT_CODES.has(name);
}

export function isCustomUnit(unit: { name?: string; symbol?: string; id?: string; isCustom?: boolean }): boolean {
  return !isBuiltInUnit(unit);
}

export function matchesUnitCategory(unit: Unit, category: string): boolean {
  if (!category || category === 'All') return true;
  if (category === 'Custom') return isCustomUnit(unit);
  return unit.category === category;
}

export function normalizeUnitKey(val?: string): string {
  return normalizeUniversalUnit(val);
}

// Re-export core engine utilities
export {
  UNIVERSAL_UNITS,
  UNIVERSAL_UNIT_LIST,
  normalizeUniversalUnit,
  formatUnitQuantity,
  parseNaturalQuantityInput,
  calculateCutStrip,
  parseScaleBarcode
};
export type { UniversalUnitCode };
