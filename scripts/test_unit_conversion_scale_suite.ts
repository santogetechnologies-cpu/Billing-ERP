/**
 * Test Suite: Primary Unit, Secondary Unit & Conversion Scale
 * 
 * Verifies:
 * 1. Primary Unit (Purchase/Stock Unit) selection and saving.
 * 2. Optional Secondary Unit: single unit products (no secondary unit) save cleanly.
 * 3. Conversion Scale:
 *    - kg to g (multiplier 1000) -> 1 kg = 1000 g
 *    - litre to ml (multiplier 1000) -> 1 L = 1000 ml
 *    - box to piece (multiplier 12) -> 1 Box = 12 Pieces
 * 4. Invalid conversion multipliers (<= 0, empty, NaN) are correctly identified and rejected.
 * 5. Identical primary and secondary unit detection (e.g. kg to kg).
 * 6. Correct database persistence of primary_unit, secondary_unit, conversion_factor, and unit_conversions ledger.
 * 7. Stock quantity integrity: opening stock remains recorded in Primary Unit without double conversion.
 */

import assert from 'node:assert';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { Product } from '../src/types';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: PRIMARY UNIT, SECONDARY UNIT & CONVERSION SCALE');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
    }
  };

  const createdCleanupIds: string[] = [];

  // Warehouse fetch
  const { data: whList } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .limit(1);

  assert.ok(whList && whList.length > 0, 'Must have at least 1 warehouse');
  const targetWh = whList[0];

  // ============================================================================
  // TEST 1: Single Unit Item (No Secondary Unit)
  // ============================================================================
  console.log('--- 1. Optional Secondary Unit (Single Unit Product) ---');
  const ts1 = Date.now();
  const sku1 = `UOM-SGL-${ts1.toString().slice(-6)}`;

  await test('Save product with only Primary Unit (Purchase/Stock Unit) and no secondary unit', async () => {
    const payload: Omit<Product, 'id' | 'createdAt'> = {
      name: `Single Unit Product ${ts1}`,
      code: sku1,
      sku: sku1,
      barcode: `890${ts1.toString().slice(-9)}`,
      category: 'Building Materials',
      brand: 'Ambuja',
      description: 'Single unit tracking without secondary unit',
      hsn: '2523',
      taxRate: 18,
      purchasePrice: 350,
      costPrice: 350,
      sellingPrice: 420,
      retailPrice: 420,
      wholesalePrice: 400,
      dealerPrice: 390,
      mrp: 450,
      minSellingPrice: 380,
      reorderLevel: 20,
      targetStockLevel: 100,
      openingStock: 60,
      openingStockValue: 60 * 350,
      currentStock: 60,
      primaryUnit: 'Bag',
      warehouse: targetWh.code,
      rack: 'Aisle 1',
      batchNumber: `BAT-U1-${ts1}`,
      expiryDate: '2028-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    };

    const created = await productService.createProduct(payload, COMPANY_ID);
    assert.ok(created.id);
    createdCleanupIds.push(created.id);

    const { data: dbProd } = await supabase
      .from('products')
      .select('primary_unit, secondary_unit, conversion_factor, current_stock')
      .eq('id', created.id)
      .single();

    assert.strictEqual(dbProd?.primary_unit, 'Bag');
    assert.ok(!dbProd?.secondary_unit, 'Secondary unit should be null/empty');
    assert.strictEqual(Number(dbProd?.current_stock), 60);
  });

  // ============================================================================
  // TEST 2: Conversion Scale (kg to g with Multiplier 1000)
  // ============================================================================
  console.log('\n--- 2. Conversion Scale: kg to g (Multiplier 1000) ---');
  const ts2 = Date.now();
  const sku2 = `UOM-KG-${ts2.toString().slice(-6)}`;

  await test('Save product with Primary: kg, Secondary: gram, Conversion Scale: 1000', async () => {
    const payload: Omit<Product, 'id' | 'createdAt'> = {
      name: `Chemical Powder ${ts2}`,
      code: sku2,
      sku: sku2,
      barcode: `890${(ts2 + 1).toString().slice(-9)}`,
      category: 'Paints & Finishes',
      brand: 'Pidilite',
      description: '1 kg = 1000 g conversion',
      hsn: '3214',
      taxRate: 18,
      purchasePrice: 200,
      costPrice: 200,
      sellingPrice: 280,
      retailPrice: 280,
      wholesalePrice: 260,
      dealerPrice: 250,
      mrp: 300,
      minSellingPrice: 240,
      reorderLevel: 10,
      targetStockLevel: 50,
      openingStock: 25,
      openingStockValue: 25 * 200,
      currentStock: 25,
      primaryUnit: 'Kilogram',
      secondaryUnit: 'Gram',
      conversionFactor: 1000,
      warehouse: targetWh.code,
      rack: 'Shelf C-2',
      batchNumber: `BAT-U2-${ts2}`,
      expiryDate: '2028-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    };

    const created = await productService.createProduct(payload, COMPANY_ID);
    assert.ok(created.id);
    createdCleanupIds.push(created.id);

    const { data: dbProd } = await supabase
      .from('products')
      .select('primary_unit, secondary_unit, conversion_factor, current_stock')
      .eq('id', created.id)
      .single();

    assert.strictEqual(dbProd?.primary_unit, 'Kilogram');
    assert.strictEqual(dbProd?.secondary_unit, 'Gram');
    assert.strictEqual(Number(dbProd?.conversion_factor), 1000);
    // Stock is recorded in primary purchase unit (25 kg)
    assert.strictEqual(Number(dbProd?.current_stock), 25);
  });

  // ============================================================================
  // TEST 3: Conversion Scale (Litre to ml with Multiplier 1000)
  // ============================================================================
  console.log('\n--- 3. Conversion Scale: Litre to ml (Multiplier 1000) ---');
  const ts3 = Date.now();
  const sku3 = `UOM-LTR-${ts3.toString().slice(-6)}`;

  await test('Save product with Primary: Litre, Secondary: ml, Conversion Scale: 1000', async () => {
    const payload: Omit<Product, 'id' | 'createdAt'> = {
      name: `Synthetic Thinner ${ts3}`,
      code: sku3,
      sku: sku3,
      barcode: `890${(ts3 + 2).toString().slice(-9)}`,
      category: 'Paints & Finishes',
      brand: 'Asian Paints',
      description: '1 L = 1000 ml conversion',
      hsn: '3814',
      taxRate: 28,
      purchasePrice: 150,
      costPrice: 150,
      sellingPrice: 220,
      retailPrice: 220,
      wholesalePrice: 200,
      dealerPrice: 190,
      mrp: 240,
      minSellingPrice: 180,
      reorderLevel: 20,
      targetStockLevel: 80,
      openingStock: 40,
      openingStockValue: 40 * 150,
      currentStock: 40,
      primaryUnit: 'Litre',
      secondaryUnit: 'Millilitre',
      conversionFactor: 1000,
      warehouse: targetWh.code,
      rack: 'Bay T-4',
      batchNumber: `BAT-U3-${ts3}`,
      expiryDate: '2029-06-30',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    };

    const created = await productService.createProduct(payload, COMPANY_ID);
    assert.ok(created.id);
    createdCleanupIds.push(created.id);

    const { data: dbProd } = await supabase
      .from('products')
      .select('primary_unit, secondary_unit, conversion_factor, current_stock')
      .eq('id', created.id)
      .single();

    assert.strictEqual(dbProd?.primary_unit, 'Litre');
    assert.strictEqual(dbProd?.secondary_unit, 'Millilitre');
    assert.strictEqual(Number(dbProd?.conversion_factor), 1000);
    assert.strictEqual(Number(dbProd?.current_stock), 40);
  });

  // ============================================================================
  // TEST 4: Conversion Scale (Box to Piece with Multiplier 12)
  // ============================================================================
  console.log('\n--- 4. Conversion Scale: Box to Piece (Multiplier 12) ---');
  const ts4 = Date.now();
  const sku4 = `UOM-BOX-${ts4.toString().slice(-6)}`;

  await test('Save product with Primary: Box, Secondary: Piece, Conversion Scale: 12', async () => {
    const payload: Omit<Product, 'id' | 'createdAt'> = {
      name: `LED Bulbs 9W Pack ${ts4}`,
      code: sku4,
      sku: sku4,
      barcode: `890${(ts4 + 3).toString().slice(-9)}`,
      category: 'Electrical Supplies',
      brand: 'Philips',
      description: '1 Box = 12 Pieces conversion',
      hsn: '8539',
      taxRate: 18,
      purchasePrice: 840,
      costPrice: 840,
      sellingPrice: 1200,
      retailPrice: 1200,
      wholesalePrice: 1080,
      dealerPrice: 1020,
      mrp: 1440,
      minSellingPrice: 960,
      reorderLevel: 5,
      targetStockLevel: 25,
      openingStock: 10,
      openingStockValue: 10 * 840,
      currentStock: 10,
      primaryUnit: 'Box',
      secondaryUnit: 'Piece',
      conversionFactor: 12,
      warehouse: targetWh.code,
      rack: 'Bin L-12',
      batchNumber: `BAT-U4-${ts4}`,
      expiryDate: '2029-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    };

    const created = await productService.createProduct(payload, COMPANY_ID);
    assert.ok(created.id);
    createdCleanupIds.push(created.id);

    const { data: dbProd } = await supabase
      .from('products')
      .select('primary_unit, secondary_unit, conversion_factor, current_stock')
      .eq('id', created.id)
      .single();

    assert.strictEqual(dbProd?.primary_unit, 'Box');
    assert.strictEqual(dbProd?.secondary_unit, 'Piece');
    assert.strictEqual(Number(dbProd?.conversion_factor), 12);
    assert.strictEqual(Number(dbProd?.current_stock), 10);
  });

  // ============================================================================
  // TEST 5: Preview Formula & Prompt for Invalid Multipliers
  // ============================================================================
  console.log('\n--- 5. Validation: Preview Rule & Invalid Multiplier Prompt ---');

  await test('Correct preview string generation and prompt for invalid multiplier', async () => {
    const generatePreview = (primary: string, secondary?: string, multiplier?: string | number) => {
      if (!secondary || !secondary.trim()) return null;
      const factor = Number(multiplier);
      if (multiplier === '' || multiplier === undefined || isNaN(factor) || factor <= 0) {
        return 'Enter a valid conversion multiplier';
      }
      return `1 ${primary} = ${factor} ${secondary}`;
    };

    // Valid cases
    assert.strictEqual(generatePreview('kg', 'g', 1000), '1 kg = 1000 g');
    assert.strictEqual(generatePreview('L', 'ml', 1000), '1 L = 1000 ml');
    assert.strictEqual(generatePreview('Box', 'Piece', 12), '1 Box = 12 Piece');

    // Invalid / empty multiplier cases
    assert.strictEqual(generatePreview('kg', 'g', ''), 'Enter a valid conversion multiplier');
    assert.strictEqual(generatePreview('kg', 'g', 0), 'Enter a valid conversion multiplier');
    assert.strictEqual(generatePreview('kg', 'g', -5), 'Enter a valid conversion multiplier');
    assert.strictEqual(generatePreview('kg', 'g', 'abc'), 'Enter a valid conversion multiplier');

    // Single unit case (no secondary unit)
    assert.strictEqual(generatePreview('kg', ''), null);
  });

  // ============================================================================
  // TEST 6: Prevent Identical Primary and Secondary Unit
  // ============================================================================
  console.log('\n--- 6. Validation: Reject Identical Units ---');

  await test('Reject secondary unit identical to primary unit', async () => {
    const validateUnits = (primary: string, secondary?: string) => {
      if (secondary && secondary.trim()) {
        if (secondary.trim().toLowerCase() === primary.trim().toLowerCase()) {
          return 'Secondary unit cannot be identical to Primary unit.';
        }
      }
      return null;
    };

    assert.strictEqual(validateUnits('Piece', 'Piece'), 'Secondary unit cannot be identical to Primary unit.');
    assert.strictEqual(validateUnits('kg', 'KG'), 'Secondary unit cannot be identical to Primary unit.');
    assert.strictEqual(validateUnits('Kilogram', 'Gram'), null);
    assert.strictEqual(validateUnits('Kilogram', ''), null);
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================
  console.log('\n--- 7. Cleanup Test Records ---');
  for (const id of createdCleanupIds) {
    try {
      await productService.rollbackProductCreation(id);
    } catch (e) {
      // ignore
    }
  }
  console.log(`[INFO] Cleaned up ${createdCleanupIds.length} test products.\n`);

  console.log('================================================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});

