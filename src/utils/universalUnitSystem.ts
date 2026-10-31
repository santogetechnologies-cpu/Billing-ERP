/**
 * Universal ERP Unit System Engine
 * Implements Part E: The Universal 9-Unit System
 * 
 * Fixed Universal Units:
 * 1. PCS   - Pieces / Numbers (Whole number)
 * 2. STRIP - Pharma tablet/capsule blister pack (Whole number)
 * 3. TAB   - Loose pill/capsule from cut strip (Whole number)
 * 4. BOX   - Box / Pack / Multipack (Whole number)
 * 5. SET   - Set / Pair (Whole number)
 * 6. KG    - Kilogram (Decimal, 3 places: 0.001)
 * 7. LTR   - Liter (Decimal, 3 places: 0.001)
 * 8. MTR   - Meter (Decimal, 3 places: 0.001)
 * 9. SQF   - Square Feet (Decimal, 2 places: 0.01)
 */

export type UniversalUnitCode =
  | 'PCS'
  | 'STRIP'
  | 'TAB'
  | 'BOX'
  | 'SET'
  | 'KG'
  | 'LTR'
  | 'MTR'
  | 'SQF';

export interface UniversalUnitSpec {
  code: UniversalUnitCode;
  name: string;
  category: 'Count' | 'Pharma' | 'Packaging' | 'Weight' | 'Volume' | 'Length' | 'Area';
  decimalPlaces: number;
  allowsDecimals: boolean;
  minIncrement: number;
  description: string;
  commonExamples: string;
}

export const UNIVERSAL_UNITS: Record<UniversalUnitCode, UniversalUnitSpec> = {
  PCS: {
    code: 'PCS',
    name: 'Pieces / Numbers',
    category: 'Count',
    decimalPlaces: 0,
    allowsDecimals: false,
    minIncrement: 1,
    description: 'Whole discrete units',
    commonExamples: 'Clothes, electronics, toys, tools, packets, cans, bottles, vehicles'
  },
  STRIP: {
    code: 'STRIP',
    name: 'Blister Strip',
    category: 'Pharma',
    decimalPlaces: 0,
    allowsDecimals: false,
    minIncrement: 1,
    description: 'Standard pharma blister pack',
    commonExamples: 'Medicine strips, capsule packs'
  },
  TAB: {
    code: 'TAB',
    name: 'Tablet / Capsule',
    category: 'Pharma',
    decimalPlaces: 0,
    allowsDecimals: false,
    minIncrement: 1,
    description: 'Individual loose pill/capsule',
    commonExamples: 'Cut strip loose tablets, single capsules'
  },
  BOX: {
    code: 'BOX',
    name: 'Box / Pack',
    category: 'Packaging',
    decimalPlaces: 0,
    allowsDecimals: false,
    minIncrement: 1,
    description: 'Multipacks & bulk cartons',
    commonExamples: 'Multipacks, wholesale bundles, cigarette packs, soda cases'
  },
  SET: {
    code: 'SET',
    name: 'Set / Pair',
    category: 'Count',
    decimalPlaces: 0,
    allowsDecimals: false,
    minIncrement: 1,
    description: 'Matched pairs and composite sets',
    commonExamples: 'Shoes, sofa sets, dinnerware sets, tool kits'
  },
  KG: {
    code: 'KG',
    name: 'Kilogram',
    category: 'Weight',
    decimalPlaces: 3,
    allowsDecimals: true,
    minIncrement: 0.001,
    description: 'Weights (supports typing 250g -> 0.250 KG)',
    commonExamples: 'Loose grains, vegetables, meat, hardware nails, chemicals'
  },
  LTR: {
    code: 'LTR',
    name: 'Liter',
    category: 'Volume',
    decimalPlaces: 3,
    allowsDecimals: true,
    minIncrement: 0.001,
    description: 'Liquids (supports typing 500ml -> 0.500 LTR)',
    commonExamples: 'Edible oil, milk, paint, liquid fuel, chemicals'
  },
  MTR: {
    code: 'MTR',
    name: 'Meter',
    category: 'Length',
    decimalPlaces: 3,
    allowsDecimals: true,
    minIncrement: 0.001,
    description: 'Lengths (supports typing 10in, 45cm -> meters)',
    commonExamples: 'Textile fabric, rope, wire, pipes, gauze'
  },
  SQF: {
    code: 'SQF',
    name: 'Square Feet',
    category: 'Area',
    decimalPlaces: 2,
    allowsDecimals: true,
    minIncrement: 0.01,
    description: 'Surface areas',
    commonExamples: 'Tiles, marble slabs, glass sheets, plywood, banners'
  }
};

export const UNIVERSAL_UNIT_LIST = Object.values(UNIVERSAL_UNITS);

/**
 * Normalizes any unit string to its canonical 9-unit code.
 */
export function normalizeUniversalUnit(rawUnit?: string): UniversalUnitCode {
  if (!rawUnit) return 'PCS';
  const u = rawUnit.trim().toUpperCase().replace(/[^A-Z]/g, '');

  if (u === 'PCS' || u === 'PC' || u === 'PIECE' || u === 'PIECES' || u === 'NOS' || u === 'NO' || u === 'UNIT' || u === 'UNITS') {
    return 'PCS';
  }
  if (u === 'STRIP' || u === 'STRIPS' || u === 'BLISTER') {
    return 'STRIP';
  }
  if (u === 'TAB' || u === 'TABS' || u === 'TABLET' || u === 'TABLETS' || u === 'CAP' || u === 'CAPSULE' || u === 'CAPSULES' || u === 'PILL' || u === 'PILLS') {
    return 'TAB';
  }
  if (u === 'BOX' || u === 'BOXES' || u === 'PACK' || u === 'PACKS' || u === 'CTN' || u === 'CARTON' || u === 'CARTONS' || u === 'BDL' || u === 'BUNDLE') {
    return 'BOX';
  }
  if (u === 'SET' || u === 'SETS' || u === 'PAIR' || u === 'PAIRS' || u === 'PR') {
    return 'SET';
  }
  if (u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS' || u === 'KILO' || u === 'G' || u === 'GM' || u === 'GRAM' || u === 'GRAMS') {
    return 'KG';
  }
  if (u === 'LTR' || u === 'L' || u === 'LITER' || u === 'LITERS' || u === 'LITRE' || u === 'LITRES' || u === 'ML' || u === 'MILLILITER') {
    return 'LTR';
  }
  if (u === 'MTR' || u === 'M' || u === 'METER' || u === 'METERS' || u === 'METRE' || u === 'CM' || u === 'CENTIMETER' || u === 'IN' || u === 'INCH' || u === 'FT' || u === 'FEET') {
    return 'MTR';
  }
  if (u === 'SQF' || u === 'SQFT' || u === 'SQUAREFEET' || u === 'SQM' || u === 'SQUAREMETER') {
    return 'SQF';
  }

  return 'PCS';
}

/**
 * Validates and rounds a quantity for a given unit code.
 * Rejects decimals for whole-number units (rounds half-up to integer).
 * Enforces decimal precision (3 places for KG/LTR/MTR, 2 for SQF).
 */
export function formatUnitQuantity(qty: number, unitCode: UniversalUnitCode): number {
  const spec = UNIVERSAL_UNITS[unitCode] || UNIVERSAL_UNITS.PCS;
  if (!spec.allowsDecimals) {
    return Math.round(qty);
  }
  const factor = Math.pow(10, spec.decimalPlaces);
  return Math.round(qty * factor) / factor;
}

/**
 * Natural language small-unit parser for fast billing entry.
 * Allows cashiers to type '250g', '500ml', '10in', '45cm' directly.
 * 
 * Examples:
 * - '250g'   -> { qty: 0.250, unit: 'KG' }
 * - '500ml'  -> { qty: 0.500, unit: 'LTR' }
 * - '10in'   -> { qty: 0.254, unit: 'MTR' }
 * - '45cm'   -> { qty: 0.450, unit: 'MTR' }
 * - '2.5kg'  -> { qty: 2.500, unit: 'KG' }
 * - '5'      -> { qty: 5, unit: defaultUnit }
 */
export function parseNaturalQuantityInput(
  rawInput: string,
  defaultUnit: UniversalUnitCode = 'PCS'
): { qty: number; unit: UniversalUnitCode; note?: string } {
  const input = rawInput.trim().toLowerCase();

  // 1. Grams -> Kilograms (e.g. '250g', '250 gm', '500 grams')
  const gramMatch = input.match(/^([\d.]+)\s*(g|gm|gms|gram|grams)$/);
  if (gramMatch) {
    const grams = parseFloat(gramMatch[1]);
    if (!isNaN(grams) && grams > 0) {
      const kg = Math.round((grams / 1000) * 1000) / 1000;
      return { qty: kg, unit: 'KG', note: `${grams}g converted to ${kg} KG` };
    }
  }

  // 2. Milliliters -> Liters (e.g. '500ml', '750 ml')
  const mlMatch = input.match(/^([\d.]+)\s*(ml|milliliter|millilitre)$/);
  if (mlMatch) {
    const ml = parseFloat(mlMatch[1]);
    if (!isNaN(ml) && ml > 0) {
      const ltr = Math.round((ml / 1000) * 1000) / 1000;
      return { qty: ltr, unit: 'LTR', note: `${ml}ml converted to ${ltr} LTR` };
    }
  }

  // 3. Inches -> Meters (1 inch = 0.0254 m)
  const inchMatch = input.match(/^([\d.]+)\s*(in|inch|inches)$/);
  if (inchMatch) {
    const inches = parseFloat(inchMatch[1]);
    if (!isNaN(inches) && inches > 0) {
      const mtr = Math.round(inches * 0.0254 * 1000) / 1000;
      return { qty: mtr, unit: 'MTR', note: `${inches} inches converted to ${mtr} MTR` };
    }
  }

  // 4. Centimeters -> Meters (1 cm = 0.01 m)
  const cmMatch = input.match(/^([\d.]+)\s*(cm|centimeter|centimeters)$/);
  if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    if (!isNaN(cm) && cm > 0) {
      const mtr = Math.round((cm / 100) * 1000) / 1000;
      return { qty: mtr, unit: 'MTR', note: `${cm}cm converted to ${mtr} MTR` };
    }
  }

  // 5. Feet -> Meters (1 foot = 0.3048 m)
  const ftMatch = input.match(/^([\d.]+)\s*(ft|foot|feet)$/);
  if (ftMatch) {
    const ft = parseFloat(ftMatch[1]);
    if (!isNaN(ft) && ft > 0) {
      const mtr = Math.round(ft * 0.3048 * 1000) / 1000;
      return { qty: mtr, unit: 'MTR', note: `${ft} feet converted to ${mtr} MTR` };
    }
  }

  // 6. Explicit explicit unit matching (e.g. '3 tabs', '2 strip', '1.5 kg')
  const genericMatch = input.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
  if (genericMatch) {
    const val = parseFloat(genericMatch[1]);
    if (!isNaN(val)) {
      const unit = genericMatch[2] ? normalizeUniversalUnit(genericMatch[2]) : defaultUnit;
      const formatted = formatUnitQuantity(val, unit);
      return { qty: formatted, unit };
    }
  }

  // Fallback
  const numericVal = parseFloat(input);
  const qty = !isNaN(numericVal) ? formatUnitQuantity(numericVal, defaultUnit) : 1;
  return { qty, unit: defaultUnit };
}

/**
 * Cut-Strip Pharma Counter Conversion Engine
 * Selling loose tablets (TAB) from blister strips (STRIP).
 * 
 * Rules:
 * - Product stock is stored in base unit (typically STRIP or TAB).
 * - If base unit is STRIP and cashier sells loose TAB:
 *   1 Strip is "opened" into N Tabs (e.g. 10 TAB).
 *   The sold amount is deducted, leaving (10 - sold) loose TAB.
 */
export interface CutStripResult {
  stripsDeducted: number;
  tabsSold: number;
  tabsOpened: number;
  tabsRemainingLoose: number;
  cashierNotice: string;
}

export function calculateCutStrip(
  tabsToSell: number,
  tabsPerStrip: number = 10,
  currentLooseTabs: number = 0
): CutStripResult {
  const safeTabsPerStrip = Math.max(1, Math.round(tabsPerStrip));
  const safeSell = Math.max(0, Math.round(tabsToSell));

  // If already enough loose tabs in counter
  if (currentLooseTabs >= safeSell) {
    return {
      stripsDeducted: 0,
      tabsSold: safeSell,
      tabsOpened: 0,
      tabsRemainingLoose: currentLooseTabs - safeSell,
      cashierNotice: `Dispensed ${safeSell} loose Tab(s). ${currentLooseTabs - safeSell} loose Tab(s) remain.`
    };
  }

  const deficit = safeSell - currentLooseTabs;
  const stripsToOpen = Math.ceil(deficit / safeTabsPerStrip);
  const totalTabsAvailable = currentLooseTabs + (stripsToOpen * safeTabsPerStrip);
  const remainingLoose = totalTabsAvailable - safeSell;

  return {
    stripsDeducted: stripsToOpen,
    tabsSold: safeSell,
    tabsOpened: stripsToOpen * safeTabsPerStrip,
    tabsRemainingLoose: remainingLoose,
    cashierNotice: `Opened ${stripsToOpen} Strip(s) into ${stripsToOpen * safeTabsPerStrip} Tabs. Dispensed ${safeSell} Tab(s). ${remainingLoose} loose Tab(s) remain in stock.`
  };
}

/**
 * Barcode Scale Parsing (Weighing-Scale Embedded Barcodes)
 * Supports standard retail weighing scale formats:
 * Format A: Price-embedded (starts with 21 or 02)
 * Format B: Weight-embedded (starts with 20 or 22)
 * 
 * Example Weight Barcode: 2000123005008
 * - Prefix: 20
 * - Item Code: 00123
 * - Weight (5 digits in grams): 00500 -> 500g = 0.500 KG
 * - Checksum: 8
 */
export interface BarcodeScaleData {
  isScaleBarcode: boolean;
  itemCode?: string;
  weightKg?: number;
  price?: number;
  barcodeType?: 'weight' | 'price';
}

export function parseScaleBarcode(barcode: string): BarcodeScaleData {
  const clean = barcode.trim();
  if (clean.length !== 13) {
    return { isScaleBarcode: false };
  }

  const prefix = clean.substring(0, 2);

  // Weight-embedded barcode: Prefix 20, 22, 02
  if (prefix === '20' || prefix === '22') {
    const itemCode = clean.substring(2, 7);
    const weightGrams = parseInt(clean.substring(7, 12), 10);
    if (!isNaN(weightGrams)) {
      return {
        isScaleBarcode: true,
        barcodeType: 'weight',
        itemCode,
        weightKg: Math.round((weightGrams / 1000) * 1000) / 1000
      };
    }
  }

  // Price-embedded barcode: Prefix 21, 23
  if (prefix === '21' || prefix === '23') {
    const itemCode = clean.substring(2, 7);
    const priceCents = parseInt(clean.substring(7, 12), 10);
    if (!isNaN(priceCents)) {
      return {
        isScaleBarcode: true,
        barcodeType: 'price',
        itemCode,
        price: priceCents / 100
      };
    }
  }

  return { isScaleBarcode: false };
}

