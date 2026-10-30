import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';

async function main() {
  console.log('================================================================');
  console.log('🧪 TEST: Quick Product Creation in Purchase Bill — Inward Line Items');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, failureReason?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (failureReason) console.error(`   Reason: ${failureReason}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Source code checks for NewProductPage.tsx
  console.log('--- Step 1: Checking NewProductPage.tsx interface and behavior ---');
  const newProductPagePath = path.resolve(process.cwd(), 'src/pages/products/NewProductPage.tsx');
  const newProductPageContent = fs.readFileSync(newProductPagePath, 'utf8');

  assert(
    newProductPageContent.includes('isEmbedded?: boolean') &&
    newProductPageContent.includes('onSuccess?: (product: Product) => void') &&
    newProductPageContent.includes('onCancel?: () => void') &&
    newProductPageContent.includes('disableOpeningStock?: boolean'),
    'NewProductPageProps includes isEmbedded, onSuccess, onCancel, and disableOpeningStock'
  );

  assert(
    newProductPageContent.includes('const finalOpeningStock = disableOpeningStock ? 0 : numOpeningStock;') &&
    newProductPageContent.includes('const finalOpeningStockValue = disableOpeningStock ? 0 :'),
    'NewProductPage strictly zeroes openingStock when disableOpeningStock is true'
  );

  assert(
    newProductPageContent.includes('if (onSuccess) {') &&
    newProductPageContent.includes('onSuccess(savedProduct);') &&
    newProductPageContent.includes('return;'),
    'NewProductPage invokes onSuccess callback with the saved Product without page reload'
  );

  assert(
    newProductPageContent.includes('isDuplicateBarcode') &&
    newProductPageContent.includes('Barcode "${barcode.trim()}" is already assigned to another product'),
    'NewProductPage validates unique barcodes to prevent duplicate barcode creation'
  );

  // TEST 2: Source code checks for NewPurchaseInvoicePage.tsx
  console.log('\n--- Step 2: Checking NewPurchaseInvoicePage.tsx integration ---');
  const newPurchaseInvoicePath = path.resolve(process.cwd(), 'src/pages/purchases/NewPurchaseInvoicePage.tsx');
  const newPurchaseInvoiceContent = fs.readFileSync(newPurchaseInvoicePath, 'utf8');

  assert(
    newPurchaseInvoiceContent.includes('isAddNewProductModalOpen') &&
    newPurchaseInvoiceContent.includes('setIsAddNewProductModalOpen'),
    'NewPurchaseInvoicePage defines isAddNewProductModalOpen state'
  );

  assert(
    newPurchaseInvoiceContent.includes('Add Product Item') &&
    newPurchaseInvoiceContent.includes('Add New Product') &&
    newPurchaseInvoiceContent.includes('setIsAddNewProductModalOpen(true)'),
    'NewPurchaseInvoicePage renders "+ Add New Product" button alongside "+ Add Product Item"'
  );

  assert(
    newPurchaseInvoiceContent.includes('handleNewProductCreated') &&
    newPurchaseInvoiceContent.includes('productId: newProd.id') &&
    newPurchaseInvoiceContent.includes('productName: newProd.name') &&
    newPurchaseInvoiceContent.includes('qty: 1'),
    'handleNewProductCreated appends newly created product with qty=1 and populated details'
  );

  assert(
    newPurchaseInvoiceContent.includes('<NewProductPage') &&
    newPurchaseInvoiceContent.includes('isEmbedded={true}') &&
    newPurchaseInvoiceContent.includes('disableOpeningStock={true}') &&
    newPurchaseInvoiceContent.includes('onSuccess={handleNewProductCreated}'),
    'Quick Add Product Modal renders NewProductPage with disableOpeningStock={true}'
  );

  // TEST 3: Backend Database Validation — Product Master Creation as Catalog Record Only
  console.log('\n--- Step 3: Testing Backend Database Catalog Creation with Opening Stock = 0 ---');
  const companyId = '00000000-0000-0000-0000-000000000001';

  // Get active warehouse for catalog linking
  const { data: whList } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', companyId)
    .limit(1);

  const testWhId = whList && whList.length > 0 ? whList[0].id : '00000000-0000-0000-0000-000000000002';

  const testSku = `TEST-PRD-${Date.now().toString().slice(-6)}`;
  const testBarcode = `999${Date.now().toString().slice(-10)}`;
  const testProductName = `Automated Verification Item ${Date.now().toString().slice(-4)}`;

  const createdProd = await productService.createProduct({
    name: testProductName,
    code: testSku,
    sku: testSku,
    barcode: testBarcode,
    category: 'Hardware',
    subcategory: 'Fasteners',
    brand: 'TestBrand',
    description: 'Catalog-only test product for purchase bill',
    hsn: '7318',
    taxRate: 18,
    purchasePrice: 250,
    costPrice: 250,
    sellingPrice: 350,
    retailPrice: 350,
    wholesalePrice: 300,
    dealerPrice: 280,
    mrp: 400,
    minSellingPrice: 260,
    reorderLevel: 10,
    openingStock: 0,
    openingStockValue: 0,
    currentStock: 0,
    primaryUnit: 'Piece',
    warehouse: testWhId,
    rack: 'A-01',
    batchNumber: 'BATCH-TEST-001',
    expiryDate: '2028-12-31',
    batchTracking: true,
    serialTracking: false,
    expiryTracking: true,
    isActive: true
  }, companyId);

  assert(
    !!createdProd && createdProd.id !== undefined,
    'Product successfully saved to backend Product Master table with UUID'
  );

  assert(
    Number(createdProd.openingStock) === 0 && Number(createdProd.currentStock) === 0,
    'Product catalog record safely has 0 opening stock and 0 current stock'
  );

  // Check that no opening stock transactions were created
  const { data: txns } = await supabase
    .from('stock_transactions')
    .select('id, type')
    .eq('product_id', createdProd.id);

  assert(
    !txns || txns.length === 0,
    'No stock transactions were created (catalog record only, stock will be inwarded on bill finalization)'
  );

  // Clean up test product
  console.log('\n--- Step 4: Cleaning up temporary verification product ---');
  await supabase.from('products').delete().eq('id', createdProd.id);
  const { data: verifyDel } = await supabase.from('products').select('id').eq('id', createdProd.id);
  assert(
    !verifyDel || verifyDel.length === 0,
    'Temporary verification product removed safely (clean database state preserved)'
  );

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} checks passed successfully.`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test script encountered an error:', err);
  process.exit(1);
});
