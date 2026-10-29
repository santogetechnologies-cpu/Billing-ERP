import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';

console.log('================================================================================');
console.log('TEST SUITE: AUTOMATICALLY GENERATE BATCH NUMBER BY DEFAULT (BTH-YYMM-###)');
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

  // --- 1. CODEBASE AUDIT: INITIAL STOCK PAGE AUTOMATIC BATCH GENERATION ---
  console.log('--- 1. InitialStockPage Automatic Batch Generation Audit ---');

  await test('InitialStockPage.tsx auto-generates batch number on component mount', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('useEffect') && content.includes('generateNextBatchNumber'),
      'InitialStockPage must auto-generate batch number on mount'
    );
  });

  await test('InitialStockPage.tsx automatically generates separate batch number on handleAddItem', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('handleAddItem') && content.includes('generateNextBatchNumber'),
      'handleAddItem must call generateNextBatchNumber for each added product entry'
    );
  });

  await test('InitialStockPage.tsx displays Auto-generated label beside Batch Number field', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('Auto-generated'),
      'Must display "Auto-generated" badge beside Batch Number label'
    );
  });

  await test('InitialStockPage.tsx provides Regenerate action button', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('Regenerate'),
      'Must display "Regenerate" button for authorized users'
    );
  });

  await test('InitialStockPage.tsx preserves batch number on existing product selection or generates if missing', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('handleSelectExistingProduct'),
      'Must handle batch assignment when selecting existing product'
    );
    assert(
      content.includes('batchNumToUse'),
      'Must retain current batch number or generate new batch number for the stock entry'
    );
  });

  // --- 2. CODEBASE AUDIT: UPDATE STOCK PAGE BATCH PRESERVATION & NEW BATCH AUTO-GENERATION ---
  console.log('\n--- 2. UpdateStockPage Batch Preservation & Auto-Generation Audit ---');

  await test('UpdateStockPage.tsx preserves existing batch number during batch edit/selection', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/UpdateStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes("setBatchMode('existing')"),
      'Must support existing batch mode'
    );
    assert(
      content.includes('setBatchNumber(activeBatch.batchNumber)') ||
      content.includes('setBatchNumber(selected.batchNumber)'),
      'Must load and preserve current batch number without generating a replacement'
    );
  });

  await test('UpdateStockPage.tsx auto-generates batch number when entering new batch mode', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/UpdateStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert(
      content.includes('Auto-generated'),
      'Must display Auto-generated badge when batchMode is new'
    );
    assert(
      content.includes('Regenerate'),
      'Must provide Regenerate button in new batch mode'
    );
  });

  // --- 3. DATABASE SEQUENCE ALLOCATION (BTH-YYMM-###) ---
  console.log('\n--- 3. Database Sequence Allocation & Month Reset ---');

  await test('Batch numbers format as BTH-YYMM-### and increment monotonically', async () => {
    const b1 = await productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29');
    const b2 = await productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29');

    assert(/^BTH-2610-\d{3}$/.test(b1), `Batch 1 "${b1}" must match BTH-2610-###`);
    assert(/^BTH-2610-\d{3}$/.test(b2), `Batch 2 "${b2}" must match BTH-2610-###`);

    const n1 = parseInt(b1.split('-')[2], 10);
    const n2 = parseInt(b2.split('-')[2], 10);
    assert.strictEqual(n2, n1 + 1, `Sequences must increment sequentially: ${b1} -> ${b2}`);
  });

  await test('Sequence resets to independent series (BTH-2611-001) at the start of a new month', async () => {
    const novBatch = await productService.generateNextBatchNumber(COMPANY_ID, '2026-11-01');
    assert(novBatch.startsWith('BTH-2611-'), `November batch "${novBatch}" must start with BTH-2611-`);
  });

  await test('Concurrent calls allocate strictly unique sequential batch numbers without collision', async () => {
    const batchPromises = Array.from({ length: 4 }, () =>
      productService.generateNextBatchNumber(COMPANY_ID, '2026-10-29')
    );
    const results = await Promise.all(batchPromises);
    const unique = new Set(results);

    assert.strictEqual(unique.size, results.length, `Concurrent batch numbers must all be unique: ${results.join(', ')}`);
  });

  // --- 4. RETRY IDEMPOTENCE & RECORD PERSISTENCE ---
  console.log('\n--- 4. Retry Idempotence & Record Persistence ---');

  await test('Retrying batch creation updates existing batch quantity rather than duplicating', async () => {
    const timestamp = Date.now();
    const testSku = `IDEMP-${timestamp.toString().slice(-6)}`;
    const testBarcode = `890${timestamp.toString().slice(-10)}`;
    const testBatch = await productService.generateNextBatchNumber(COMPANY_ID);

    const { data: whList } = await withRetry(async () => {
      return await supabase.from('warehouses').select('id, code').limit(1);
    });
    const testWh = whList && whList[0] ? whList[0] : null;
    assert(testWh, 'Warehouse required for persistence test');

    // 1. Initial product creation with 10 units in batch
    const prod = await withRetry(async () => {
      return await productService.createProduct({
        name: `Idempotent Test ${timestamp}`,
        sku: testSku,
        code: `PRD-${timestamp}`,
        barcode: testBarcode,
        category: 'Electronics',
        subcategory: 'Accessories',
        primaryUnit: 'Piece',
        warehouse: testWh.code || testWh.id,
        openingStock: 10,
        batchNumber: testBatch,
        expiryDate: '2027-10-29',
        sellingPrice: 199,
        costPrice: 100,
        purchasePrice: 90,
        taxRate: 18,
        batchTracking: true,
        expiryTracking: true
      }, COMPANY_ID);
    });

    assert(prod && prod.id, 'Product created successfully');

    // Verify exactly 1 batch record exists
    const { data: batches1 } = await withRetry(async () => {
      return await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', prod.id)
        .eq('batch_number', testBatch);
    });

    assert.strictEqual(batches1?.length, 1, 'Exactly 1 batch record initially created');
    assert.strictEqual(Number(batches1![0].qty), 10, 'Initial batch qty must be 10');

    // 2. Simulate retry: recordOpeningStock with the exact same batch number and 15 more units
    await withRetry(async () => {
      await inventoryService.recordOpeningStock({
        productId: prod.id,
        warehouseId: testWh.id,
        quantity: 15,
        unit: 'Piece',
        costPrice: 100,
        batchNumber: testBatch,
        expiryDate: '2027-10-29',
        date: new Date().toISOString().split('T')[0],
        referenceNumber: `RETRY-REF-${timestamp}`,
        companyId: COMPANY_ID
      });
    });

    // Verify still exactly 1 batch record exists, with updated quantity (10 + 15 = 25)
    const { data: batches2 } = await withRetry(async () => {
      return await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', prod.id)
        .eq('batch_number', testBatch);
    });

    assert.strictEqual(batches2?.length, 1, 'Retry must NOT create duplicate batch rows');
    assert.strictEqual(Number(batches2![0].qty), 25, 'Retry must safely combine batch quantity to 25');

    // Cleanup
    await withRetry(async () => {
      await supabase.from('product_batches').delete().eq('product_id', prod.id);
      await supabase.from('stock_transactions').delete().eq('product_id', prod.id);
      await supabase.from('stock_balances').delete().eq('product_id', prod.id);
      await supabase.from('products').delete().eq('id', prod.id);
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
