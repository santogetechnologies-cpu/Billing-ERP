import fs from 'fs';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';

async function main() {
  console.log('================================================================');
  console.log('🧪 TEST: Replace Product Master with Initial Stock & Product Intake');
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

  // 1. Verify NewPurchaseInvoicePage.tsx uses InitialStockPage
  console.log('--- Step 1: Checking NewPurchaseInvoicePage.tsx imports and wiring ---');
  const invoicePagePath = path.resolve(process.cwd(), 'src/pages/purchases/NewPurchaseInvoicePage.tsx');
  const invoicePageContent = fs.readFileSync(invoicePagePath, 'utf8');

  assert(
    !invoicePageContent.includes("from '../products/NewProductPage'") &&
    !invoicePageContent.includes('<NewProductPage'),
    'NewPurchaseInvoicePage has completely removed NewProductPage'
  );

  assert(
    invoicePageContent.includes("import { InitialStockPage } from '../products/InitialStockPage';"),
    'NewPurchaseInvoicePage imports InitialStockPage'
  );

  assert(
    invoicePageContent.includes('<InitialStockPage') &&
    invoicePageContent.includes('isEmbedded={true}') &&
    invoicePageContent.includes('onSuccess={handleNewProductCreated}') &&
    invoicePageContent.includes('onCancel={() => setIsAddNewProductModalOpen(false)}'),
    'NewPurchaseInvoicePage renders InitialStockPage with isEmbedded, onSuccess, and onCancel callbacks'
  );

  assert(
    invoicePageContent.includes('handleNewProductCreated = (created: Product | Product[])') &&
    invoicePageContent.includes('setItems(prev => [...prev, ...newRows])') &&
    invoicePageContent.includes('setIsAddNewProductModalOpen(false)'),
    'handleNewProductCreated properly appends created products to line items and closes modal'
  );

  // 2. Verify InitialStockPage.tsx interface and behavior
  console.log('\n--- Step 2: Checking InitialStockPage.tsx interface and preservation ---');
  const initialStockPath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
  const initialStockContent = fs.readFileSync(initialStockPath, 'utf8');

  assert(
    initialStockContent.includes('export interface InitialStockPageProps {') &&
    initialStockContent.includes('isEmbedded?: boolean;') &&
    initialStockContent.includes('onSuccess?: (products: Product[]) => void;') &&
    initialStockContent.includes('onCancel?: () => void;'),
    'InitialStockPageProps includes isEmbedded, onSuccess, and onCancel'
  );

  assert(
    initialStockContent.includes("profile?.role === 'Purchase Manager'"),
    'Purchase Manager has full access to Initial Stock & Product Intake'
  );

  assert(
    initialStockContent.includes('if (onSuccess && savedProductsList.length > 0) {') &&
    initialStockContent.includes('onSuccess(savedProductsList);') &&
    initialStockContent.includes('return;'),
    'InitialStockPage invokes onSuccess callback in embedded mode when saved'
  );

  assert(
    initialStockContent.includes('setSuccessMessage(') &&
    initialStockContent.includes("navigate('/products')") &&
    initialStockContent.includes('View in Product Master'),
    'InitialStockPage preserves standalone submission flow, success alert, and View in Product Master navigation'
  );

  // 3. Verify App.tsx route continues to render standalone InitialStockPage
  console.log('\n--- Step 3: Checking App.tsx standalone route ---');
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(
    appContent.includes("import { InitialStockPage } from './pages/products/InitialStockPage'") &&
    appContent.includes('<InitialStockPage />'),
    'App.tsx standalone /products/initial-stock route remains intact and unmodified'
  );

  // 4. Backend Database Integration: Create product with initial stock and verify
  console.log('\n--- Step 4: Testing backend database product creation & initial stock allocation ---');
  const companyId = '00000000-0000-0000-0000-000000000001';

  // Get first active warehouse
  const { data: whList } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', companyId)
    .limit(1);

  const testWhId = whList && whList.length > 0 ? whList[0].id : '00000000-0000-0000-0000-000000000002';
  const testWhCode = whList && whList.length > 0 ? whList[0].code : 'WH-MAIN';

  const testSku = `INTK-${Date.now().toString().slice(-6)}`;
  const testBarcode = `890${Date.now().toString().slice(-9)}`;
  const testProdName = `Initial Intake Test Item ${Date.now().toString().slice(-4)}`;
  const testInitialQty = 25;

  const createdProd = await productService.createProduct({
    name: testProdName,
    code: testSku,
    sku: testSku,
    barcode: testBarcode,
    category: 'Hardware',
    subcategory: 'Fittings',
    brand: 'IntakeBrand',
    description: 'Initial stock intake test item',
    hsn: '7318',
    taxRate: 18,
    purchasePrice: 150,
    costPrice: 150,
    sellingPrice: 220,
    retailPrice: 220,
    wholesalePrice: 190,
    dealerPrice: 175,
    mrp: 250,
    minSellingPrice: 160,
    reorderLevel: 5,
    targetStockLevel: 50,
    openingStock: testInitialQty,
    openingStockValue: testInitialQty * 150,
    currentStock: testInitialQty,
    primaryUnit: 'Piece',
    warehouse: testWhId,
    rack: 'RACK-B1',
    batchNumber: 'BATCH-INTK-001',
    expiryDate: '2028-10-30',
    batchTracking: true,
    serialTracking: false,
    expiryTracking: true,
    isActive: true
  }, companyId);

  assert(
    !!createdProd && createdProd.id !== undefined,
    'Product successfully saved to backend Product Master table'
  );

  assert(
    Number(createdProd.openingStock) === testInitialQty && Number(createdProd.currentStock) === testInitialQty,
    `Product correctly saved with openingStock=${testInitialQty} and currentStock=${testInitialQty}`
  );

  // Verify stock balance in warehouse is allocated by product creation
  const bal = await inventoryService.getStockBalance(testWhId, createdProd.id, companyId);
  console.log('bal received from inventoryService:', bal);

  assert(
    Number(bal) === testInitialQty,
    `Warehouse stock balance correctly allocated to ${testInitialQty} units`
  );

  // Clean up test data
  console.log('\n--- Step 5: Cleaning up test data ---');
  await supabase.from('stock_balances').delete().eq('product_id', createdProd.id);
  await supabase.from('products').delete().eq('id', createdProd.id);

  const { data: verifyDel } = await supabase.from('products').select('id').eq('id', createdProd.id);
  assert(
    !verifyDel || verifyDel.length === 0,
    'Temporary verification product and balances cleanly removed from database'
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
