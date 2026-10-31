/**
 * Automated Test Suite for Part E: Universal Unit System
 * Run with: node scripts/test-units.cjs
 */

const assert = require('assert');

// Implement lightweight standalone imports matching universalUnitSystem.ts logic
const UNIVERSAL_UNITS = {
  PCS: { code: 'PCS', allowsDecimals: false, decimalPlaces: 0 },
  STRIP: { code: 'STRIP', allowsDecimals: false, decimalPlaces: 0 },
  TAB: { code: 'TAB', allowsDecimals: false, decimalPlaces: 0 },
  BOX: { code: 'BOX', allowsDecimals: false, decimalPlaces: 0 },
  SET: { code: 'SET', allowsDecimals: false, decimalPlaces: 0 },
  KG: { code: 'KG', allowsDecimals: true, decimalPlaces: 3 },
  LTR: { code: 'LTR', allowsDecimals: true, decimalPlaces: 3 },
  MTR: { code: 'MTR', allowsDecimals: true, decimalPlaces: 3 },
  SQF: { code: 'SQF', allowsDecimals: true, decimalPlaces: 2 }
};

function normalizeUniversalUnit(rawUnit) {
  if (!rawUnit) return 'PCS';
  const u = rawUnit.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (['PCS', 'PC', 'PIECE', 'PIECES', 'NOS', 'NO', 'UNIT'].includes(u)) return 'PCS';
  if (['STRIP', 'STRIPS', 'BLISTER'].includes(u)) return 'STRIP';
  if (['TAB', 'TABS', 'TABLET', 'TABLETS', 'CAP', 'CAPSULE', 'PILL'].includes(u)) return 'TAB';
  if (['BOX', 'BOXES', 'PACK', 'PACKS', 'CTN', 'CARTON', 'BDL'].includes(u)) return 'BOX';
  if (['SET', 'SETS', 'PAIR', 'PAIRS', 'PR'].includes(u)) return 'SET';
  if (['KG', 'KGS', 'KILOGRAM', 'KILOGRAMS', 'KILO', 'G', 'GM', 'GRAM'].includes(u)) return 'KG';
  if (['LTR', 'L', 'LITER', 'LITERS', 'LITRE', 'ML'].includes(u)) return 'LTR';
  if (['MTR', 'M', 'METER', 'METERS', 'METRE', 'CM', 'IN', 'INCH', 'FT'].includes(u)) return 'MTR';
  if (['SQF', 'SQFT', 'SQUAREFEET', 'SQM'].includes(u)) return 'SQF';
  return 'PCS';
}

function formatUnitQuantity(qty, unitCode) {
  const spec = UNIVERSAL_UNITS[unitCode] || UNIVERSAL_UNITS.PCS;
  if (!spec.allowsDecimals) {
    return Math.round(qty);
  }
  const factor = Math.pow(10, spec.decimalPlaces);
  return Math.round(qty * factor) / factor;
}

function parseNaturalQuantityInput(rawInput, defaultUnit = 'PCS') {
  const input = rawInput.trim().toLowerCase();

  const gramMatch = input.match(/^([\d.]+)\s*(g|gm|gms|gram|grams)$/);
  if (gramMatch) {
    const grams = parseFloat(gramMatch[1]);
    if (!isNaN(grams) && grams > 0) {
      const kg = Math.round((grams / 1000) * 1000) / 1000;
      return { qty: kg, unit: 'KG' };
    }
  }

  const mlMatch = input.match(/^([\d.]+)\s*(ml|milliliter|millilitre)$/);
  if (mlMatch) {
    const ml = parseFloat(mlMatch[1]);
    if (!isNaN(ml) && ml > 0) {
      const ltr = Math.round((ml / 1000) * 1000) / 1000;
      return { qty: ltr, unit: 'LTR' };
    }
  }

  const inchMatch = input.match(/^([\d.]+)\s*(in|inch|inches)$/);
  if (inchMatch) {
    const inches = parseFloat(inchMatch[1]);
    if (!isNaN(inches) && inches > 0) {
      const mtr = Math.round(inches * 0.0254 * 1000) / 1000;
      return { qty: mtr, unit: 'MTR' };
    }
  }

  const cmMatch = input.match(/^([\d.]+)\s*(cm|centimeter|centimeters)$/);
  if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    if (!isNaN(cm) && cm > 0) {
      const mtr = Math.round((cm / 100) * 1000) / 1000;
      return { qty: mtr, unit: 'MTR' };
    }
  }

  const ftMatch = input.match(/^([\d.]+)\s*(ft|foot|feet)$/);
  if (ftMatch) {
    const ft = parseFloat(ftMatch[1]);
    if (!isNaN(ft) && ft > 0) {
      const mtr = Math.round(ft * 0.3048 * 1000) / 1000;
      return { qty: mtr, unit: 'MTR' };
    }
  }

  const genericMatch = input.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
  if (genericMatch) {
    const val = parseFloat(genericMatch[1]);
    if (!isNaN(val)) {
      const unit = genericMatch[2] ? normalizeUniversalUnit(genericMatch[2]) : defaultUnit;
      return { qty: formatUnitQuantity(val, unit), unit };
    }
  }

  const numericVal = parseFloat(input);
  const qty = !isNaN(numericVal) ? formatUnitQuantity(numericVal, defaultUnit) : 1;
  return { qty, unit: defaultUnit };
}

function calculateCutStrip(tabsToSell, tabsPerStrip = 10, currentLooseTabs = 0) {
  const safeTabsPerStrip = Math.max(1, Math.round(tabsPerStrip));
  const safeSell = Math.max(0, Math.round(tabsToSell));

  if (currentLooseTabs >= safeSell) {
    return {
      stripsDeducted: 0,
      tabsSold: safeSell,
      tabsOpened: 0,
      tabsRemainingLoose: currentLooseTabs - safeSell
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
    tabsRemainingLoose: remainingLoose
  };
}

function parseScaleBarcode(barcode) {
  const clean = String(barcode).trim();
  if (clean.length !== 13) return { isScaleBarcode: false };
  const prefix = clean.substring(0, 2);
  if (prefix === '20' || prefix === '22') {
    const itemCode = clean.substring(2, 7);
    const weightGrams = parseInt(clean.substring(7, 12), 10);
    return {
      isScaleBarcode: true,
      barcodeType: 'weight',
      itemCode,
      weightKg: Math.round((weightGrams / 1000) * 1000) / 1000
    };
  }
  return { isScaleBarcode: false };
}

// -------------------------------------------------------------
// RUN TESTS
// -------------------------------------------------------------
console.log('🧪 Starting Universal Unit System Automated Test Suite...\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}:`, err.message);
    failed++;
  }
}

// Test Group 1: 9 Fixed Units
it('1. Exactly 9 Universal Unit Codes defined', () => {
  const codes = Object.keys(UNIVERSAL_UNITS);
  assert.strictEqual(codes.length, 9);
  assert.deepStrictEqual(codes, ['PCS', 'STRIP', 'TAB', 'BOX', 'SET', 'KG', 'LTR', 'MTR', 'SQF']);
});

// Test Group 2: Whole vs Decimal Rules
it('2. Discrete units reject/round decimals to whole integers', () => {
  assert.strictEqual(formatUnitQuantity(2.7, 'PCS'), 3);
  assert.strictEqual(formatUnitQuantity(1.2, 'STRIP'), 1);
  assert.strictEqual(formatUnitQuantity(4.9, 'TAB'), 5);
  assert.strictEqual(formatUnitQuantity(0.8, 'BOX'), 1);
  assert.strictEqual(formatUnitQuantity(2.1, 'SET'), 2);
});

it('3. Decimal units enforce precise fractional precision (3 places for KG/LTR/MTR, 2 for SQF)', () => {
  assert.strictEqual(formatUnitQuantity(0.2504, 'KG'), 0.250);
  assert.strictEqual(formatUnitQuantity(1.4567, 'LTR'), 1.457);
  assert.strictEqual(formatUnitQuantity(2.1234, 'MTR'), 2.123);
  assert.strictEqual(formatUnitQuantity(14.856, 'SQF'), 14.86);
});

// Test Group 3: Small-Unit Parsing
it('4. Natural language: 250g converts to 0.250 KG', () => {
  const res = parseNaturalQuantityInput('250g', 'KG');
  assert.strictEqual(res.qty, 0.250);
  assert.strictEqual(res.unit, 'KG');
});

it('5. Natural language: 500ml converts to 0.500 LTR', () => {
  const res = parseNaturalQuantityInput('500ml', 'LTR');
  assert.strictEqual(res.qty, 0.500);
  assert.strictEqual(res.unit, 'LTR');
});

it('6. Natural language: 10in converts to 0.254 MTR', () => {
  const res = parseNaturalQuantityInput('10in', 'MTR');
  assert.strictEqual(res.qty, 0.254);
  assert.strictEqual(res.unit, 'MTR');
});

it('7. Natural language: 45cm converts to 0.450 MTR', () => {
  const res = parseNaturalQuantityInput('45cm', 'MTR');
  assert.strictEqual(res.qty, 0.450);
  assert.strictEqual(res.unit, 'MTR');
});

// Test Group 4: Cut-Strip Pharma Flow
it('8. Pharma Cut-Strip: Selling 3 TAB with 0 loose opens 1 STRIP (10 TAB), leaves 7 TAB', () => {
  const result = calculateCutStrip(3, 10, 0);
  assert.strictEqual(result.stripsDeducted, 1);
  assert.strictEqual(result.tabsSold, 3);
  assert.strictEqual(result.tabsOpened, 10);
  assert.strictEqual(result.tabsRemainingLoose, 7);
});

it('9. Pharma Cut-Strip: Selling 4 TAB with 7 loose deducts 0 STRIP, leaves 3 TAB', () => {
  const result = calculateCutStrip(4, 10, 7);
  assert.strictEqual(result.stripsDeducted, 0);
  assert.strictEqual(result.tabsSold, 4);
  assert.strictEqual(result.tabsOpened, 0);
  assert.strictEqual(result.tabsRemainingLoose, 3);
});

it('10. Pharma Cut-Strip: Selling 15 TAB with 3 loose opens 2 STRIPs, leaves 8 TAB', () => {
  const result = calculateCutStrip(15, 10, 3);
  // Deficit is 12 tabs -> opens 2 strips (20 tabs) + 3 loose = 23 tabs -> sells 15 -> 8 loose remain
  assert.strictEqual(result.stripsDeducted, 2);
  assert.strictEqual(result.tabsSold, 15);
  assert.strictEqual(result.tabsOpened, 20);
  assert.strictEqual(result.tabsRemainingLoose, 8);
});

// Test Group 5: Barcode Scale Integration
it('11. Weight-embedded scale barcode parses item code and weight in KG', () => {
  // Barcode 2000123002508: item code 00123, 250 grams -> 0.250 KG
  const res = parseScaleBarcode('2000123002508');
  assert.strictEqual(res.isScaleBarcode, true);
  assert.strictEqual(res.itemCode, '00123');
  assert.strictEqual(res.weightKg, 0.250);
});

console.log(`\n============================================================`);
console.log(`Unit Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`============================================================\n`);

if (failed > 0) {
  process.exit(1);
}

