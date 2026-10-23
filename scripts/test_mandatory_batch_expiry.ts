import fs from 'fs';
import path from 'path';
import { productService } from '../src/services/productService';
import { supabase } from '../src/lib/supabase';
import { isBatchExpired, calculateBatchStatus } from '../src/utils/inventoryUtils';

console.log('================================================================');
console.log(' VERIFICATION SUITE: Mandatory Batch Number & Expiry Date');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failCount++;
  }
}

async function runTests() {
  const newProductPageCode = fs.readFileSync(path.resolve('src/pages/products/NewProductPage.tsx'), 'utf8');
  const productServiceCode = fs.readFileSync(path.resolve('src/services/productService.ts'), 'utf8');
  const erpContextCode = fs.readFileSync(path.resolve('src/context/ERPContext.tsx'), 'utf8');

  console.log('--- 1. Frontend UI Structure & Mandatory Indicators ---');
  assert(newProductPageCode.includes('Batch & Expiry Details'), 'NewProductPage contains "Batch & Expiry Details" section heading');
  assert(newProductPageCode.includes('id="field-batchNumber"'), 'Contains batch number input with id="field-batchNumber"');
  assert(newProductPageCode.includes('id="field-expiryDate"'), 'Contains expiry date input with id="field-expiryDate"');
  assert(newProductPageCode.includes('Batch Number <span className="text-rose-500">*</span>'), 'Batch Number has mandatory red asterisk');
  assert(newProductPageCode.includes('Expiry Date <span className="text-rose-500">*</span>'), 'Expiry Date has mandatory red asterisk');

  console.log('\n--- 2. Frontend Validation Rules & Auto-focus ---');
  assert(newProductPageCode.includes("errs.batchNumber = 'Batch number is required.'"), 'Frontend validates empty batch number');
  assert(newProductPageCode.includes("errs.expiryDate = 'Expiry date is required.'"), 'Frontend validates missing expiry date');
  assert(newProductPageCode.includes("errs.expiryDate = 'Please select a valid expiry date.'"), 'Frontend validates invalid date');
  assert(newProductPageCode.includes('const el = document.getElementById(`field-${firstField}`);'), 'Auto-focus logic handles field focus on validation failure');

  console.log('\n--- 3. Backend Validation in productService ---');
  assert(productServiceCode.includes("throw new Error('Batch number is required.');"), 'productService.createProduct blocks missing batch number');
  assert(productServiceCode.includes("throw new Error('Expiry date is required.');"), 'productService.createProduct blocks missing expiry date');
  assert(productServiceCode.includes("throw new Error('Please select a valid expiry date.');"), 'productService.createProduct blocks invalid date format');

  // Test backend validation calls directly
  try {
    await productService.createProduct({
      name: 'Test No Batch',
      sku: 'TEST-NO-BATCH-' + Date.now(),
      category: 'General',
      purchasePrice: 100,
      costPrice: 100,
      sellingPrice: 150,
      primaryUnit: 'Piece',
      warehouse: 'WH-MAIN',
      openingStock: 0,
      batchNumber: '', // missing
      expiryDate: '2028-12-31'
    } as any);
    assert(false, 'Backend threw error for missing batch number');
  } catch (err: any) {
    assert(err.message === 'Batch number is required.', 'Backend blocked product creation without batch number: ' + err.message);
  }

  try {
    await productService.createProduct({
      name: 'Test No Expiry',
      sku: 'TEST-NO-EXP-' + Date.now(),
      category: 'General',
      purchasePrice: 100,
      costPrice: 100,
      sellingPrice: 150,
      primaryUnit: 'Piece',
      warehouse: 'WH-MAIN',
      openingStock: 0,
      batchNumber: 'BAT-1234',
      expiryDate: '' // missing
    } as any);
    assert(false, 'Backend threw error for missing expiry date');
  } catch (err: any) {
    assert(err.message === 'Expiry date is required.', 'Backend blocked product creation without expiry date: ' + err.message);
  }

  console.log('\n--- 4. End-to-End Product Creation, Batch Insertion & Persistence ---');
  const testBatchNum = 'BAT-MANDATORY-' + Date.now();
  const testExpiry = '2028-06-30';
  const testSku = 'SKU-BATCH-' + Date.now();

  let createdProduct: any = null;
  try {
    createdProduct = await productService.createProduct({
      name: 'Medicine Antiseptic Cream',
      sku: testSku,
      code: 'MED-CREAM-01',
      category: 'Healthcare',
      purchasePrice: 45,
      costPrice: 45,
      sellingPrice: 75,
      retailPrice: 75,
      primaryUnit: 'Tube',
      warehouse: 'WH-MAIN',
      openingStock: 50,
      batchNumber: testBatchNum,
      expiryDate: testExpiry
    } as any);

    assert(createdProduct && createdProduct.id, 'Product created successfully with ID: ' + createdProduct?.id);

    // Verify batch was created in product_batches table
    const { data: dbBatches } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', createdProduct.id);

    assert(dbBatches && dbBatches.length === 1, 'Exactly one batch record created in product_batches');
    const batchRec = dbBatches![0];
    assert(batchRec.batch_number === testBatchNum, `Batch number in DB matches: ${batchRec.batch_number}`);
    assert(batchRec.expiry_date === testExpiry, `Expiry date in DB matches: ${batchRec.expiry_date}`);
    assert(batchRec.qty === 50, `Batch stock matches opening stock (50)`);
    assert(batchRec.status === 'Active', `Batch status is Active`);

    console.log('\n--- 5. Persistence across Refresh / getProducts ---');
    const productsList = await productService.getProducts({ search: testSku });
    const fetchedProd = productsList.find(p => p.id === createdProduct.id);
    assert(fetchedProd !== undefined, 'Product fetched by getProducts');
    assert(fetchedProd?.batchNumber === testBatchNum, `Fetched product has batchNumber: ${fetchedProd?.batchNumber}`);
    assert(fetchedProd?.expiryDate === testExpiry, `Fetched product has expiryDate: ${fetchedProd?.expiryDate}`);

    console.log('\n--- 6. Product Edit & No Duplicate Batches ---');
    const updatedBatchNum = testBatchNum + '-MOD';
    const updatedExpiry = '2029-01-15';
    await productService.updateProduct(createdProduct.id, {
      batchNumber: updatedBatchNum,
      expiryDate: updatedExpiry
    });

    const { data: batchesAfterEdit } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', createdProduct.id);

    assert(batchesAfterEdit && batchesAfterEdit.length === 1, 'No duplicate batch created after edit (still 1 batch)');
    assert(batchesAfterEdit![0].batch_number === updatedBatchNum, 'Batch number updated to: ' + updatedBatchNum);
    assert(batchesAfterEdit![0].expiry_date === updatedExpiry, 'Expiry date updated to: ' + updatedExpiry);

    // Clean up test batch and product
    await supabase.from('product_batches').delete().eq('product_id', createdProduct.id);
    await supabase.from('products').delete().eq('id', createdProduct.id);
    console.log('  ✓ Cleaned up test product and batches.');
  } catch (err: any) {
    console.error('E2E creation test error:', err);
    failCount++;
  }

  console.log('\n--- 7. Expiry & Inventory Rules ---');
  assert(isBatchExpired('2020-01-01') === true, 'Past date (2020-01-01) is correctly identified as expired');
  assert(isBatchExpired('2030-12-31') === false, 'Future date (2030-12-31) is NOT expired');
  assert(calculateBatchStatus('2020-01-01', 10) === 'Expired', 'calculateBatchStatus returns Expired for past date');
  assert(calculateBatchStatus('2030-01-01', 10) === 'Active', 'calculateBatchStatus returns Active for future date');
  assert(erpContextCode.includes('stock has expired and cannot be sold'), 'ERPContext sales validation rejects expired stock');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
