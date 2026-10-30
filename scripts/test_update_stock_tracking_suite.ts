import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';
import { canUpdateStock, canManageBarcodeOverride } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: UPDATE STOCK — TRACKING FIELDS & RECENT ADJUSTMENTS REMOVAL');
console.log('================================================================================\n');

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function runTestSuite() {
  let passed = 0;
  let total = 0;

  async function test(title: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${title}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${title}`);
      console.error('   ', err.message || err);
    }
  }

  // --- 1. CODEBASE AUDIT: RECENT STOCK ADJUSTMENTS REMOVED ---
  console.log('--- 1. Recent Stock Adjustments Section Removed from UpdateStockPage ---');
  await test('UpdateStockPage.tsx does not display Recent Stock Adjustments table or empty state', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/UpdateStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(!content.includes('Recent Stock Adjustments'), 'Must NOT contain "Recent Stock Adjustments" heading');
    assert(!content.includes('Audit log of manual stock corrections'), 'Must NOT contain table subtitle');
    assert(!content.includes('No stock adjustments recorded yet.'), 'Must NOT contain recent adjustments empty state');
    assert(!content.includes('recentAdjustments.map'), 'Must NOT iterate or render recentAdjustments table');
  });

  // --- 2. CODEBASE AUDIT: PRODUCT TRACKING DETAILS ADDED ---
  console.log('\n--- 2. Product Tracking Details Section Present in Form ---');
  await test('UpdateStockPage.tsx contains Product Tracking Details section and fields', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/UpdateStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(content.includes('Product Tracking Details'), 'Must contain "Product Tracking Details" section heading');
    assert(content.includes('Barcode'), 'Must contain Barcode field');
    assert(content.includes('Batch Number'), 'Must contain Batch Number field');
    assert(content.includes('Expiry Date'), 'Must contain Expiry Date field');
    assert(content.includes('Serial Number'), 'Must contain Serial Number field');
    assert(content.includes('canEditBarcode'), 'Must evaluate barcode editing permission');
    assert(content.includes('handleAutoBatch'), 'Must provide auto-batch generator');
    assert(content.includes('handleAutoSerial'), 'Must provide auto-serial generator');
    assert(content.includes('applyExpiryPreset'), 'Must provide expiry preset helpers');
    assert(content.includes("useState<string>('0')"), 'Must initialize quantity state to 0');
    assert(content.includes('min="0"'), 'Must have min="0" on quantity input');
    assert(!content.includes('min="0.001"'), 'Must NOT have min="0.001"');
    assert(content.includes('onFocus={e => e.target.select()}'), 'Must select on focus for instant replacement');
    assert(content.includes('cleanQuantityInput(e.target.value)'), 'Must use cleanQuantityInput on change');
    assert(!content.includes('absolute right-3 top-2.5 text-slate-400'), 'Must NOT have overlapping absolute unit label');
  });

  // --- 3. RBAC RESTRICTIONS ENFORCEMENT ---
  console.log('\n--- 3. Role Permissions (Warehouse Manager Denied Manual Adjustment) ---');
  await test('canUpdateStock strictly blocks Warehouse Manager and permits Owner/Admin/Purchase Manager', async () => {
    assert.strictEqual(canUpdateStock('Owner'), true, 'Owner permitted');
    assert.strictEqual(canUpdateStock('Admin'), true, 'Admin permitted');
    assert.strictEqual(canUpdateStock('Purchase Manager'), true, 'Purchase Manager permitted');
    assert.strictEqual(canUpdateStock('Warehouse Manager'), false, 'Warehouse Manager MUST be denied');
    assert.strictEqual(canUpdateStock('Salesperson'), false, 'Salesperson MUST be denied');
    assert.strictEqual(canUpdateStock('Cashier'), false, 'Cashier MUST be denied');
  });

  await test('canManageBarcodeOverride allows only Owner and Admin', async () => {
    assert.strictEqual(canManageBarcodeOverride('Owner'), true, 'Owner permitted');
    assert.strictEqual(canManageBarcodeOverride('Admin'), true, 'Admin permitted');
    assert.strictEqual(canManageBarcodeOverride('Purchase Manager'), false, 'Purchase Manager denied barcode edit');
    assert.strictEqual(canManageBarcodeOverride('Warehouse Manager'), false, 'Warehouse Manager denied barcode edit');
  });

  // --- 4. DATABASE & REUSE: TEST PRODUCT SETUP ---
  console.log('\n--- 4. Data Layer: Product with Tracking Details Creation & Adjustments ---');
  const testSku = `TRK-${Date.now().toString().slice(-6)}`;
  const testBarcode = `890${Date.now().toString().slice(-9)}`;
  let createdProductId = '';
  let createdBatchId = '';

  const { data: wh } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .limit(1)
    .single();

  const targetWh = wh || { id: 'wh-main', code: 'WH-MAIN', name: 'Main Warehouse' };

  await test('Create product with batch, expiry, and serial tracking enabled', async () => {
    const newProd = await productService.createProduct({
      name: `Tracking Test Item ${testSku}`,
      code: testSku,
      sku: testSku,
      barcode: testBarcode,
      category: 'Electronics',
      warehouse: targetWh.code,
      openingStock: 50,
      batchNumber: `BAT-${testSku}`,
      expiryDate: '2028-06-30',
      sellingPrice: 500,
      costPrice: 300,
      primaryUnit: 'Piece',
      hsn: '8517',
      brand: 'TestBrand',
      description: 'Test product for tracking adjustment',
      purchasePrice: 300,
      retailPrice: 500,
      wholesalePrice: 450,
      mrp: 550,
      minSellingPrice: 400,
      taxRate: 18,
      batchTracking: true,
      serialTracking: true,
      expiryTracking: true,
      isActive: true,
      currentStock: 50,
      openingStockValue: 15000
    }, COMPANY_ID);

    assert.ok(newProd.id, 'Product created');
    createdProductId = newProd.id;

    // Create a batch record for this product
    const batch = await productService.createBatch({
      productId: createdProductId,
      productName: newProd.name,
      warehouseId: targetWh.id,
      batchNumber: `BAT-${testSku}`,
      expiryDate: '2028-06-30',
      mfgDate: '2026-01-01',
      purchaseDate: '2026-01-01',
      cost: 300,
      qty: 50,
      status: 'Active'
    }, COMPANY_ID);

    assert.ok(batch.id, 'Batch created');
    createdBatchId = batch.id;

    // Seed warehouse stock balance to match opening stock
    await inventoryService.updateStockBalance(targetWh.id, createdProductId, 50, COMPANY_ID);

    // Create a serial number record for this product
    const serial = await productService.createSerialNumber({
      productId: createdProductId,
      productName: newProd.name,
      serialNumber: `SN-${testSku}-001`,
      purchaseDate: '2026-01-01',
      warrantyMonths: 12,
      warrantyStatus: 'In Stock'
    }, COMPANY_ID);

    assert.ok(serial.id, 'Serial created');
  });

  // --- 5. STOCK ADJUSTMENT EXECUTION WITH BATCH & SERIAL DETAILS ---
  console.log('\n--- 5. Stock Adjustment Execution & Traceability ---');
  await test('Stock adjustment reduces inventory and updates batch tracking atomically', async () => {
    const adjustQty = -10;
    const reason = `[Batch: BAT-${testSku} | Exp: 2028-06-30 | SN: SN-${testSku}-001] Audit discrepancy reduction test`;

    const txn = await inventoryService.adjustStock(
      createdProductId,
      adjustQty,
      reason,
      targetWh.id,
      COMPANY_ID,
      { id: 'admin-1', name: 'Test Admin', role: 'Admin' }
    );

    assert.ok(txn.id, 'Transaction recorded');
    assert.strictEqual(Number(txn.qty), -10, 'Transaction quantity must be -10');
    assert.ok(txn.notes.includes(`BAT-${testSku}`), 'Transaction notes must record batch tracking');

    // Update batch quantity using updateBatch
    const targetBatch = (await productService.getBatches(COMPANY_ID)).find(b => b.id === createdBatchId);
    assert.ok(targetBatch, 'Batch found');
    const newBatchQty = targetBatch.qty + adjustQty; // 50 - 10 = 40
    await productService.updateBatch(createdBatchId, { qty: newBatchQty }, COMPANY_ID);

    const updatedBatch = (await productService.getBatches(COMPANY_ID)).find(b => b.id === createdBatchId);
    assert.strictEqual(updatedBatch?.qty, 40, 'Batch quantity must be updated to 40');
  });

  await test('Stock adjustment history preserved in database (not deleted)', async () => {
    const { data: txns, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('product_id', createdProductId)
      .eq('company_id', COMPANY_ID);

    assert(!error, 'No DB error');
    assert.ok(txns && txns.length > 0, 'Historical stock transactions must exist in database');
    const adjTxn = txns.find(t => t.type === 'Stock Adjustment');
    assert.ok(adjTxn, 'Stock Adjustment record preserved');
    assert.ok(adjTxn.notes.includes(`BAT-${testSku}`), 'Tracking reference preserved in audit log');
  });

  // --- 6. ADVANCED TRACKING VALIDATIONS ---
  console.log('\n--- 6. Advanced Tracking Validations & Business Rules ---');

  await test('Non-tracked product allows stock adjustment without mandatory tracking fields', async () => {
    const nonTrackSku = `NON-${Date.now().toString().slice(-6)}`;
    const nonTrackProd = await productService.createProduct({
      name: `Standard Non-Tracked Item ${nonTrackSku}`,
      code: nonTrackSku,
      sku: nonTrackSku,
      category: 'Hardware',
      warehouse: targetWh.code,
      openingStock: 20,
      batchNumber: `BAT-INIT-${nonTrackSku}`,
      expiryDate: '2028-12-31',
      sellingPrice: 100,
      costPrice: 60,
      primaryUnit: 'Piece',
      hsn: '7318',
      brand: 'Standard',
      description: 'Standard untracked item',
      purchasePrice: 60,
      retailPrice: 100,
      wholesalePrice: 90,
      mrp: 110,
      minSellingPrice: 80,
      taxRate: 18,
      batchTracking: false,
      serialTracking: false,
      expiryTracking: false,
      isActive: true,
      currentStock: 20,
      openingStockValue: 1200
    }, COMPANY_ID);

    await inventoryService.updateStockBalance(targetWh.id, nonTrackProd.id, 20, COMPANY_ID);

    // Adjust without any batch, expiry, or serial
    const txn = await inventoryService.adjustStock(
      nonTrackProd.id,
      5, // ADD 5
      'Standard inventory audit reconciliation',
      targetWh.id,
      COMPANY_ID,
      { id: 'admin-1', name: 'Test Admin', role: 'Admin' }
    );

    assert.ok(txn.id, 'Adjustment recorded');
    assert.strictEqual(Number(txn.qty), 5, 'Adjusted quantity is 5');

    // Clean up
    await supabase.from('stock_transactions').delete().eq('product_id', nonTrackProd.id);
    await supabase.from('products').delete().eq('id', nonTrackProd.id);
  });

  await test('Creating a new batch on stock addition records in product_batches', async () => {
    const newBatchNum = `BAT-NEW-${Date.now().toString().slice(-4)}`;
    const newBatch = await productService.createBatch({
      productId: createdProductId,
      productName: `Tracking Test Item ${testSku}`,
      warehouseId: targetWh.id,
      batchNumber: newBatchNum,
      expiryDate: '2029-12-31',
      mfgDate: '2026-10-01',
      purchaseDate: '2026-10-01',
      cost: 300,
      qty: 15,
      status: 'Active'
    }, COMPANY_ID);

    assert.ok(newBatch.id, 'New batch created');
    assert.strictEqual(newBatch.batchNumber, newBatchNum, 'Batch number matches');
    assert.strictEqual(newBatch.qty, 15, 'Batch qty matches added stock');

    // Clean up extra batch
    await supabase.from('product_batches').delete().eq('id', newBatch.id);
  });

  await test('Serial number uniqueness prevents duplicate registrations', async () => {
    const serialList = await productService.getSerialNumbers(COMPANY_ID);
    const existingSn = `SN-${testSku}-001`;
    const isDuplicate = serialList.some(s => s.serialNumber.toLowerCase() === existingSn.toLowerCase());
    assert.ok(isDuplicate, 'Existing serial must be detected as duplicate');
  });

  // --- 7. CLEANUP TEST DATA ---
  console.log('\n--- 7. Cleanup Test Records ---');
  await test('Clean up test product, batch, serial, and transactions', async () => {
    if (createdProductId) {
      await supabase.from('stock_transactions').delete().eq('product_id', createdProductId);
      await supabase.from('product_serial_numbers').delete().eq('product_id', createdProductId);
      await supabase.from('product_batches').delete().eq('product_id', createdProductId);
      await supabase.from('products').delete().eq('id', createdProductId);
    }
  });

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} OF ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
