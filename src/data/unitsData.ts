import { Unit, UnitCategory } from '../types';

export interface SystemUnitDefinition {
  name: string;
  symbol: string;
  category: UnitCategory;
  isBase?: boolean;
  label?: string;
}

export const UNIVERSAL_BUILTIN_UNITS: SystemUnitDefinition[] = [
  // 1. Piece (Count)
  { name: 'Piece', symbol: 'Pcs', category: 'Count', isBase: true, label: 'Piece (Pcs)' },
  // 2. Kg / Kilogram (Weight)
  { name: 'Kilogram', symbol: 'Kg', category: 'Weight', isBase: true, label: 'Kilogram (Kg)' },
  // 3. Gram (Weight)
  { name: 'Gram', symbol: 'g', category: 'Weight', isBase: false, label: 'Gram (g)' },
  // 4. Ton (Weight)
  { name: 'Ton', symbol: 'MT', category: 'Weight', isBase: false, label: 'Ton (MT)' },
  // 5. Quintal (Weight)
  { name: 'Quintal', symbol: 'Qtl', category: 'Weight', isBase: false, label: 'Quintal (Qtl)' },
  // 6. Litre (Volume)
  { name: 'Litre', symbol: 'L', category: 'Volume', isBase: true, label: 'Litre (L)' },
  // 7. Millilitre (Volume)
  { name: 'Millilitre', symbol: 'ml', category: 'Volume', isBase: false, label: 'Millilitre (ml)' },
  // 8. Meter (Length)
  { name: 'Meter', symbol: 'm', category: 'Length', isBase: true, label: 'Meter (m)' },
  // 9. Centimeter (Length)
  { name: 'Centimeter', symbol: 'cm', category: 'Length', isBase: false, label: 'Centimeter (cm)' },
  // 10. Feet (Length)
  { name: 'Feet', symbol: 'ft', category: 'Length', isBase: false, label: 'Feet (ft)' },
  // 11. Inch (Length)
  { name: 'Inch', symbol: 'in', category: 'Length', isBase: false, label: 'Inch (in)' },
  // 12. Square Feet (Area)
  { name: 'Square Feet', symbol: 'sq ft', category: 'Area', isBase: false, label: 'Square Feet (sq ft)' },
  // 13. Square Meter (Area)
  { name: 'Square Meter', symbol: 'sq m', category: 'Area', isBase: false, label: 'Square Meter (sq m)' },
  // 14. Cubic Feet (Volume Dimension)
  { name: 'Cubic Feet', symbol: 'cu ft', category: 'Volume Dimension', isBase: false, label: 'Cubic Feet (cu ft)' },
  // 15. Cubic Meter (Volume Dimension)
  { name: 'Cubic Meter', symbol: 'cu m', category: 'Volume Dimension', isBase: false, label: 'Cubic Meter (cu m)' },
  // 16. Box (Packaging)
  { name: 'Box', symbol: 'Box', category: 'Packaging', isBase: false, label: 'Box (Box)' },
  // 17. Carton (Packaging)
  { name: 'Carton', symbol: 'Ctn', category: 'Packaging', isBase: false, label: 'Carton (Ctn)' },
  // 18. Pack (Packaging)
  { name: 'Pack', symbol: 'Pack', category: 'Packaging', isBase: false, label: 'Pack' },
  // 19. Bundle (Packaging)
  { name: 'Bundle', symbol: 'Bdl', category: 'Packaging', isBase: false, label: 'Bundle (Bdl)' },
  // 20. Pair (Count)
  { name: 'Pair', symbol: 'Pr', category: 'Count', isBase: false, label: 'Pair (Pr)' },
  // 21. Set (Count)
  { name: 'Set', symbol: 'Set', category: 'Count', isBase: false, label: 'Set (Set)' },
  // 22. Roll (Packaging)
  { name: 'Roll', symbol: 'Roll', category: 'Packaging', isBase: false, label: 'Roll' },
  // 23. Bag (Packaging)
  { name: 'Bag', symbol: 'Bag', category: 'Packaging', isBase: false, label: 'Bag (Bag)' },
  // 24. Bottle (Packaging)
  { name: 'Bottle', symbol: 'Btl', category: 'Packaging', isBase: false, label: 'Bottle (Btl)' },
  // 25. Can (Packaging)
  { name: 'Can', symbol: 'Can', category: 'Packaging', isBase: false, label: 'Can' },
  // 26. Dozen (Count)
  { name: 'Dozen', symbol: 'Dzn', category: 'Count', isBase: false, label: 'Dozen (Dzn)' }
];

export const ALL_UNIT_CATEGORIES: UnitCategory[] = [
  'Count',
  'Weight',
  'Volume',
  'Length',
  'Area',
  'Volume Dimension',
  'Packaging',
  'Custom'
];

export const BUILTIN_UNIT_NAMES = new Set([
  'piece', 'kg', 'kilogram', 'gram', 'ton', 'quintal',
  'litre', 'millilitre', 'meter', 'centimeter', 'feet', 'inch',
  'square feet', 'square meter', 'cubic feet', 'cubic meter',
  'box', 'carton', 'pack', 'bundle', 'pair', 'set', 'roll',
  'bag', 'bottle', 'can', 'dozen'
]);

export const BUILTIN_UNIT_SYMBOLS = new Set([
  'pcs', 'kg', 'g', 'mt', 'qtl',
  'l', 'ml', 'm', 'cm', 'ft', 'in',
  'sq ft', 'sq m', 'cu ft', 'cu m',
  'box', 'ctn', 'pack', 'bdl', 'pr', 'set', 'roll',
  'bag', 'btl', 'can', 'dzn'
]);

export function isBuiltInUnit(unit: { name?: string; symbol?: string; id?: string; isCustom?: boolean }): boolean {
  if (unit.isCustom === true) return false;
  if (unit.id?.startsWith('builtin-')) return true;
  const name = (unit.name || '').trim().toLowerCase();
  const symbol = (unit.symbol || '').trim().toLowerCase();
  return BUILTIN_UNIT_NAMES.has(name) || BUILTIN_UNIT_SYMBOLS.has(symbol);
}

export function isCustomUnit(unit: { name?: string; symbol?: string; id?: string; isCustom?: boolean }): boolean {
  if (unit.isCustom === true) return true;
  if (unit.isCustom === false) return false;
  return !isBuiltInUnit(unit);
}

/**
 * Checks if a unit matches a given category filter.
 * 
 * Rules:
 * - 'All': matches every unit (built-in + custom).
 * - 'Custom': always matches every user-created custom unit, regardless of its category,
 *             plus any unit whose assigned category is 'Custom'.
 * - Any other category ('Packaging', 'Weight', etc.): matches built-in units assigned
 *   to that category + custom units whose selected category is that category.
 */
export function matchesUnitCategory(unit: Unit, category: string): boolean {
  if (!category || category === 'All') return true;
  const isCustom = isCustomUnit(unit);
  if (category === 'Custom') {
    return isCustom || unit.category === 'Custom';
  }
  return unit.category === category;
}

/**
 * Normalizes a unit name or symbol to a canonical identity key to prevent duplicates
 * between synonyms/aliases (e.g. 'kg' vs 'kilogram', 'piece' vs 'pcs', 'meter' vs 'm').
 */
export function normalizeUnitKey(val?: string): string {
  if (!val) return '';
  const s = val.trim().toLowerCase();
  if (s === 'kg' || s === 'kilogram' || s === 'kgs' || s === 'kilo') return 'kg';
  if (s === 'piece' || s === 'pieces' || s === 'pcs' || s === 'pc') return 'pcs';
  if (s === 'litre' || s === 'liter' || s === 'litres' || s === 'liters' || s === 'l' || s === 'ltr') return 'l';
  if (s === 'millilitre' || s === 'milliliter' || s === 'ml') return 'ml';
  if (s === 'meter' || s === 'metre' || s === 'meters' || s === 'metres' || s === 'm') return 'm';
  if (s === 'centimeter' || s === 'centimetre' || s === 'cm') return 'cm';
  if (s === 'box' || s === 'boxes') return 'box';
  if (s === 'carton' || s === 'cartons' || s === 'ctn') return 'ctn';
  if (s === 'bag' || s === 'bags') return 'bag';
  if (s === 'gram' || s === 'grams' || s === 'g') return 'g';
  if (s === 'ton' || s === 'tonne' || s === 'tons' || s === 'tonnes' || s === 'mt') return 'mt';
  if (s === 'quintal' || s === 'quintals' || s === 'qtl') return 'qtl';
  if (s === 'dozen' || s === 'dozens' || s === 'dzn') return 'dzn';
  return s;
}


