import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { filterSupportedPurchasePayload } from '../src/utils/schemaDetector';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE INVOICE & ORDER UUID SAFETY VERIFICATION');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(desc: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const purchaseServicePath = path.resolve('src/services/purchaseService.ts');
  const schemaDetectorPath = path.resolve('src/utils/schemaDetector.ts');
  const newInvoicePagePath = path.resolve('src/pages/purchases/NewPurchaseInvoicePage.tsx');
  const notifServicePath = path.resolve('src/services/notificationService.ts');

  const purchaseServiceCode = fs.readFileSync(purchaseServicePath, 'utf-8');
  const schemaDetectorCode = fs.readFileSync(schemaDetectorPath, 'utf-8');
  const newInvoicePageCode = fs.readFileSync(newInvoicePagePath, 'utf-8');
  const notifServiceCode = fs.readFileSync(notifServicePath, 'utf-8');

  // ---------------------------------------------------------------------------
  // 1. purchaseService.ts UUID Sanitization
  // ---------------------------------------------------------------------------
  console.log('--- 1. purchaseService.ts UUID Sanitization ---');

  await runTest('createPurchaseInvoice checks isValidUuid for supplierId', () => {
    assert(
      purchaseServiceCode.includes('isValidUuid(invoice.supplierId)'),
      'purchaseService must validate supplierId with isValidUuid'
    );
  });

  await runTest('createPurchaseInvoice checks isValidUuid for warehouse', () => {
    assert(
      purchaseServiceCode.includes('isValidUuid(invoice.warehouse)'),
      'purchaseService must validate warehouse with isValidUuid'
    );
  });

  await runTest('createPurchaseInvoice checks isValidUuid for purchaseOrderId & purchaseRequestId', () => {
    assert(
      purchaseServiceCode.includes('isValidUuid(invoice.purchaseOrderId)'),
      'purchaseService must validate purchaseOrderId with isValidUuid'
    );
    assert(
      purchaseServiceCode.includes('isValidUuid(invoice.purchaseRequestId)'),
      'purchaseService must validate purchaseRequestId with isValidUuid'
    );
  });

  await runTest('createPurchaseInvoice checks isValidUuid for item.productId', () => {
    assert(
      purchaseServiceCode.includes('isValidUuid(it.productId)'),
      'purchaseService payload items must validate productId'
    );
    assert(
      purchaseServiceCode.includes('isValidUuid(item.productId)'),
      'purchaseService raw items must validate productId'
    );
  });

  // ---------------------------------------------------------------------------
  // 2. schemaDetector.ts filterSupportedPurchasePayload Sanitization
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. filterSupportedPurchasePayload Runtime Sanitization ---');

  await runTest('filterSupportedPurchasePayload converts empty strings on UUID columns to null', async () => {
    const rawPayload = {
      company_id: '',
      supplier_id: '',
      warehouse_id: '',
      purchase_order_id: '',
      invoice_number: 'INV-TEST-001',
      grand_total: 5000
    };

    const filtered = await filterSupportedPurchasePayload(rawPayload);
    assert.strictEqual(filtered.supplier_id, null, 'supplier_id must be null instead of ""');
    assert.strictEqual(filtered.warehouse_id, null, 'warehouse_id must be null instead of ""');
    assert.strictEqual(filtered.company_id, null, 'company_id must be null instead of ""');
    assert.strictEqual(filtered.invoice_number, 'INV-TEST-001', 'invoice_number must be preserved');
  });

  await runTest('filterSupportedPurchasePayload converts non-UUID strings on UUID columns to null', async () => {
    const rawPayload = {
      supplier_id: 'supplier2',
      warehouse_id: 'central-godown',
      invoice_number: 'INV-TEST-002'
    };

    const filtered = await filterSupportedPurchasePayload(rawPayload);
    assert.strictEqual(filtered.supplier_id, null, 'supplier_id "supplier2" must be null');
    assert.strictEqual(filtered.warehouse_id, null, 'warehouse_id "central-godown" must be null');
  });

  await runTest('filterSupportedPurchasePayload preserves valid UUIDs', async () => {
    const validUuid = '15ec6ffc-59cf-4654-b820-c6fca35be53e';
    const rawPayload = {
      warehouse_id: validUuid,
      invoice_number: 'INV-TEST-003'
    };

    const filtered = await filterSupportedPurchasePayload(rawPayload);
    assert.strictEqual(filtered.warehouse_id, validUuid, 'Valid UUID must be preserved');
  });

  // ---------------------------------------------------------------------------
  // 3. NewPurchaseInvoicePage Graceful Supplier Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. NewPurchaseInvoicePage Zero Suppliers Support ---');

  await runTest('NewPurchaseInvoicePage includes customSupplierName fallback when suppliers are empty', () => {
    assert(
      newInvoicePageCode.includes('customSupplierName') &&
      newInvoicePageCode.includes('setCustomSupplierName'),
      'NewPurchaseInvoicePage must provide customSupplierName state'
    );
  });

  await runTest('NewPurchaseInvoicePage renders text input when suppliers array is empty', () => {
    assert(
      newInvoicePageCode.includes('suppliers.length > 0 ?') &&
      newInvoicePageCode.includes('Enter supplier name'),
      'NewPurchaseInvoicePage must render input when no saved suppliers exist'
    );
  });

  await runTest('NewPurchaseInvoicePage auto-selects warehouse when warehouses load', () => {
    assert(
      newInvoicePageCode.includes('setWarehouse(defaultWh?.id || \'\')'),
      'NewPurchaseInvoicePage must auto-select default warehouse on load'
    );
  });

  // ---------------------------------------------------------------------------
  // 4. notificationService.ts Fix
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. notificationService.ts Fix ---');

  await runTest('resolveMissingWarehouseManagerAlert does not query non-existent columns', () => {
    assert(
      !notifServiceCode.includes(".eq('warehouse_id', warehouseId)"),
      'notifications table does not have warehouse_id column in Supabase schema'
    );
    assert(
      notifServiceCode.includes(".update({ is_read: true })"),
      'notifications table uses is_read column'
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Critical Protected Screens Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Critical Protected Screens Audit ---');

  const protectedScreens = [
    'src/pages/products/InitialStockPage.tsx',
    'src/pages/products/NewProductPage.tsx',
    'src/pages/products/ProductListPage.tsx',
    'src/pages/products/UpdateStockPage.tsx'
  ];

  for (const filePath of protectedScreens) {
    await runTest(`Protected file is intact: ${filePath}`, () => {
      assert(fs.existsSync(path.resolve(filePath)), `File must exist: ${filePath}`);
      const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
      assert(content.length > 500, `File must have content: ${filePath}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================================\n');

  if (totalTests === passedTests) {
    console.log('🎉 ALL UUID SAFETY & BILL CREATION TESTS PASSED 100%!\n');
  } else {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
