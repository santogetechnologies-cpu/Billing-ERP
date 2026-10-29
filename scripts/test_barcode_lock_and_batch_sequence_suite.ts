import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';
import { canAssignBarcode, canManageBarcodeOverride } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: BARCODE LOCK FIX & ATOMIC BATCH NUMBER GENERATION (BTH-YYMM-###)');
console.log('================================================================================\n');

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

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

  // --- 1. RBAC PERMISSIONS VERIFICATION ---
  console.log('--- 1. RBAC Permissions Verification for Barcode Assignment & Overwrite ---');

  await test('Owner and Admin can assign AND modify/override barcodes', async () => {
    assert.strictEqual(canAssignBarcode('Owner'), true, 'Owner must be allowed to assign barcode');
    assert.strictEqual(canManageBarcodeOverride('Owner'), true, 'Owner must be allowed to override barcode');
    assert.strictEqual(canAssignBarcode('Admin'), true, 'Admin must be allowed to assign barcode');
    assert.strictEqual(canManageBarcodeOverride('Admin'), true, 'Admin must be allowed to override barcode');
  });

  await test('Purchase Manager can assign/generate barcode for new/unassigned products, but CANNOT overwrite existing assigned barcode', async () => {
    assert.strictEqual(canAssignBarcode('Purchase Manager'), true, 'Purchase Manager must be allowed to assign barcode');
    assert.strictEqual(canManageBarcodeOverride('Purchase Manager'), false, 'Purchase Manager must NOT override existing barcode');
  });

  await test('Warehouse Manager and Salesperson are strictly blocked from barcode editing', async () => {
    assert.strictEqual(canAssignBarcode('Warehouse Manager'), false, 'Warehouse Manager must NOT assign barcode');
    assert.strictEqual(canManageBarcodeOverride('Warehouse Manager'), false, 'Warehouse Manager must NOT override barcode');
    assert.strictEqual(canAssignBarcode('Salesperson'), false, 'Salesperson must NOT assign barcode');
    assert.strictEqual(canManageBarcodeOverride('Salesperson'), false, 'Salesperson must NOT override barcode');
  });

  // --- 2. CODEBASE AUDIT: INITIAL STOCK PAGE PRODUCT TRACKING DETAILS ---
  console.log('\n--- 2. InitialStockPage Product Tracking Details Audit ---');

  await test('InitialStockPage.tsx contains Barcode with Generate button and permission feedback', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(content.includes('Product Tracking Details'), 'Must contain Product Tracking Details section');
    assert(content.includes('canAssignBarcode'), 'Must import or use canAssignBarcode');
    assert(content.includes('canManageBarcodeOverride'), 'Must import or use canManageBarcodeOverride');
    assert(content.includes('Generate Barcode'), 'Must have Generate Barcode action');
    assert(content.includes('handleAutoGenerateBarcode'), 'Must have handleAutoGenerateBarcode handler');
    assert(content.includes('seenBarcodes'), 'Must validate intra-batch duplicate barcodes');
  });

  await test('InitialStockPage.tsx contains Auto Generate Batch Number in format BTH-YYMM-###', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(content.includes('Auto Generate'), 'Must have Auto Generate button for Batch Number');
    assert(content.includes('handleAutoGenerateBatch'), 'Must provide handleAutoGenerateBatch');
    assert(content.includes('generateNextBatchNumber'), 'Must call generateNextBatchNumber service');
    assert(content.includes('BTH-YYMM-###'), 'Must display helper text with Format: BTH-YYMM-###');
    assert(content.includes('BTH-2610-001'), 'Must have example placeholder BTH-2610-001');
  });

  // --- 3. CODEBASE AUDIT: UPDATE STOCK PAGE PRODUCT TRACKING DETAILS ---
  console.log('\n--- 3. UpdateStockPage Product Tracking Details Audit ---');

  await test('UpdateStockPage.tsx correctly evaluates canAssign and canOverride based on pre-assigned status', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/UpdateStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(content.includes('isBarcodePreAssigned'), 'Must check whether product already has barcode');
    assert(content.includes('canEditBarcode'), 'Must compute canEditBarcode dynamically');
    assert(content.includes('Generate Barcode'), 'Must provide Generate Barcode button');
    assert(content.includes('handleGenerateBarcode'), 'Must provide handleGenerateBarcode handler');
    assert(content.includes('Auto Generate'), 'Must have Auto Generate button in Batch Number');
    assert(content.includes('BTH-YYMM-###'), 'Must document format BTH-YYMM-###');
  });

  // --- 4. ATOMIC BATCH NUMBER GENERATION (BTH-YYMM-###) ---
  console.log('\n--- 4. Batch Number Generation Service (productService.generateNextBatchNumber) ---');

  await test('generateNextBatchNumber formats correctly with BTH-YYMM-### prefix and 3-digit sequence', async () => {
    const batch = await productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29');
    const regex = /^BTH-2610-\d{3}$/;
    assert(regex.test(batch), `Generated batch "${batch}" must match format BTH-2610-###`);
  });

  await test('Sequential calls increment monotonically without collision', async () => {
    const b1 = await productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29');
    const b2 = await productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29');

    const num1 = parseInt(b1.split('-')[2], 10);
    const num2 = parseInt(b2.split('-')[2], 10);

    assert.strictEqual(num2, num1 + 1, `Batch numbers must increment sequentially: ${b1} -> ${b2}`);
  });

  await test('Target date in different month resets sequence to independent YYMM series', async () => {
    const novBatch = await productService.generateNextBatchNumber(COMPANY_ID, '2026-11-01');
    assert(novBatch.startsWith('BTH-2611-'), `November batch "${novBatch}" must start with BTH-2611-`);
  });

  await test('Concurrent calls produce strictly distinct, unique batch numbers', async () => {
    const promises = Array.from({ length: 4 }, () =>
      productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29')
    );
    const results = await Promise.all(promises);
    const unique = new Set(results);

    assert.strictEqual(unique.size, results.length, `Concurrent batch numbers must all be distinct: ${results.join(', ')}`);
  });

  // --- 5. END-TO-END DATABASE PERSISTENCE ---
  console.log('\n--- 5. End-to-End Database Persistence ---');

  await test('Product with assigned barcode and generated batch number persists to Supabase', async () => {
    const timestamp = Date.now();
    const testSku = `TEST-BT-${timestamp.toString().slice(-6)}`;
    const testBarcode = `890${timestamp.toString().slice(-10)}`;
    const testBatchNumber = await productService.generateNextBatchNumber(COMPANY_ID);

    // Fetch warehouse
    const { data: whList } = await withRetry(async () => {
      return await supabase.from('warehouses').select('id, code').limit(1);
    });
    const testWh = whList && whList[0] ? whList[0] : null;
    assert(testWh, 'At least one warehouse must exist for testing');

    // 1. Create product with initial batch and barcode
    const createdProduct = await withRetry(async () => {
      return await productService.createProduct({
        name: `Test Batch Product ${timestamp}`,
        sku: testSku,
        code: `PRD-${timestamp}`,
        barcode: testBarcode,
        category: 'Electronics',
        subcategory: 'Accessories',
        primaryUnit: 'Piece',
        warehouse: testWh.code || testWh.id,
        openingStock: 25,
        batchNumber: testBatchNumber,
        expiryDate: '2027-10-29',
        sellingPrice: 499,
        costPrice: 250,
        purchasePrice: 240,
        taxRate: 18,
        batchTracking: true,
        expiryTracking: true
      }, COMPANY_ID);
    });

    assert(createdProduct && createdProduct.id, 'Product must be successfully created');
    assert.strictEqual(createdProduct.barcode, testBarcode, 'Persisted product barcode must match');

    // 2. Query product from DB directly
    const { data: dbProduct, error: fetchErr } = await withRetry(async () => {
      return await supabase
        .from('products')
        .select('*')
        .eq('id', createdProduct.id)
        .single();
    });

    assert(!fetchErr, `Direct query must succeed: ${fetchErr?.message}`);
    assert.strictEqual(dbProduct.barcode, testBarcode, 'DB product record must preserve barcode');

    // 3. Verify batch record in product_batches
    const { data: batchRecords } = await withRetry(async () => {
      return await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', createdProduct.id)
        .eq('batch_number', testBatchNumber);
    });

    assert(batchRecords && batchRecords.length > 0, `Batch record "${testBatchNumber}" must persist in product_batches`);
    assert.strictEqual(batchRecords![0].batch_number, testBatchNumber, 'Batch number in database must match generated number');

    // Cleanup
    await withRetry(async () => {
      await supabase.from('product_batches').delete().eq('product_id', createdProduct.id);
      await supabase.from('stock_transactions').delete().eq('product_id', createdProduct.id);
      await supabase.from('stock_balances').delete().eq('product_id', createdProduct.id);
      await supabase.from('products').delete().eq('id', createdProduct.id);
    });
  });

  // SUMMARY
  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
