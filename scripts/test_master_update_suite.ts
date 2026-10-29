import assert from 'assert';
import { supabase } from '../src/lib/supabase';
import { Product } from '../src/types';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';
import {
  canAccessRoute,
  canManageProducts,
  canManageInitialStock,
  canUpdateStock,
  canPerformManualStockAdjustment,
  canRoleAccessNavItem,
  canRoleAccessSubItem
} from '../src/utils/rbac';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const WAREHOUSE_CODE = 'WH-MAIN';
let warehouseId = '00000000-0000-0000-0000-000000000002';

function createProductPayload(overrides: Partial<Omit<Product, 'id' | 'createdAt'>> = {}): Omit<Product, 'id' | 'createdAt'> {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  return {
    name: 'Master Suite Product ' + ts,
    sku: 'SKU-MS-' + ts,
    code: 'CODE-MS-' + ts,
    barcode: 'BC-MS-' + ts,
    category: 'Electronics',
    brand: 'Universal Tech',
    description: 'Tested via Master Update Test Suite',
    hsn: '8517',
    taxRate: 18,
    purchasePrice: 200,
    costPrice: 200,
    sellingPrice: 350,
    retailPrice: 350,
    wholesalePrice: 300,
    mrp: 399,
    minSellingPrice: 280,
    openingStock: 0,
    openingStockValue: 0,
    currentStock: 0,
    primaryUnit: 'Piece',
    warehouse: WAREHOUSE_CODE,
    rack: 'RACK-01',
    reorderLevel: 15,
    batchTracking: true,
    serialTracking: false,
    expiryTracking: true,
    isActive: true,
    batchNumber: 'BAT-MS-' + ts,
    expiryDate: '2028-12-31',
    ...overrides
  };
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('SIMPLIFIED PRODUCT & STOCK MANAGEMENT — MASTER UPDATE TEST SUITE');
  console.log('===============================================================\n');

  // 0. Ensure target warehouse exists
  const { data: whRec } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .or(`code.eq.${WAREHOUSE_CODE},name.eq.Main Central Warehouse`)
    .maybeSingle();

  if (whRec) {
    warehouseId = whRec.id;
    console.log(`[OK] Using target warehouse: ${whRec.name} (${whRec.code}, ID: ${warehouseId})`);
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Role-Based Navigation & Route Access Control
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 1: Sidebar & Route RBAC Enforcement ---');

  // 1A. Owner, Admin, Purchase Manager can see Product menu in sidebar
  assert.strictEqual(canRoleAccessNavItem('Owner', 'Product'), true, 'Owner sees Product in sidebar');
  assert.strictEqual(canRoleAccessNavItem('Admin', 'Product'), true, 'Admin sees Product in sidebar');
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Product'), true, 'PM sees Product in sidebar');

  // 1B. Warehouse Manager, Cashier, Salesperson MUST NOT see Product menu in sidebar
  assert.strictEqual(canRoleAccessNavItem('Warehouse Manager', 'Product'), false, 'WM does NOT see Product menu');
  assert.strictEqual(canRoleAccessNavItem('Cashier', 'Product'), false, 'Cashier does NOT see Product menu');
  assert.strictEqual(canRoleAccessNavItem('Salesperson', 'Product'), false, 'Salesperson does NOT see Product menu');
  assert.strictEqual(canRoleAccessNavItem('Accountant', 'Product'), false, 'Accountant does NOT see Product menu');

  // 1C. Product Submenu access for authorized roles
  assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Product Master', '/products'), true);
  assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Initial Stock', '/products/initial-stock'), true);
  assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Update Stock', '/products/update-stock'), true);

  // 1D. Warehouse Manager is blocked from Product submenus and routes
  assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Product Master', '/products'), false);
  assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Initial Stock', '/products/initial-stock'), false);
  assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Update Stock', '/products/update-stock'), false);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/products'), false);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/new'), false);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/initial-stock'), false);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/update-stock'), false);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/adjustments'), false);

  // 1E. Warehouse Manager retains authorized duties
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory'), true, 'WM retains stock overview');
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/receive'), true, 'WM retains order receiving');
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/batches'), true, 'WM retains batch tracking');
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/warehouse/dashboard'), true, 'WM retains warehouse dashboard');

  console.log('[PASS] Sidebar and Route Access Control verified for all roles.');

  // ---------------------------------------------------------------------------
  // TEST 2: Product Master Creation (No automatic stock unless opening stock is set)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Product Creation & Zero Initial Balance ---');

  const productPayload = createProductPayload({ openingStock: 0 });
  const createdProd = await productService.createProduct(productPayload, COMPANY_ID);

  assert(createdProd && createdProd.id, 'Product created successfully');
  console.log(`[OK] Product created: ${createdProd.name} (ID: ${createdProd.id})`);

  // Verify stock is 0
  const initWhStock = await inventoryService.getStockBalance(WAREHOUSE_CODE, createdProd.id, COMPANY_ID);
  assert.strictEqual(initWhStock, 0, 'Creating product with openingStock=0 does not add stock');
  console.log('[PASS] Product created without adding unprompted stock.');

  // ---------------------------------------------------------------------------
  // TEST 3: Initial Stock (Option A: Single Product)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Option A — Add Initial Stock for Single Product ---');

  const openQty = 50;
  const openCost = 180;
  const openBatch = 'BAT-INIT-' + Date.now();
  const openExpiry = '2028-11-30';

  const openTxn = await inventoryService.recordOpeningStock({
    productId: createdProd.id,
    warehouseId: warehouseId,
    quantity: openQty,
    unit: 'Piece',
    costPrice: openCost,
    batchNumber: openBatch,
    expiryDate: openExpiry,
    notes: 'Master Suite Initial Stock Test',
    companyId: COMPANY_ID,
    currentUser: { id: 'test-pm-id', name: 'Purchase Manager', role: 'Purchase Manager' }
  });

  assert(openTxn && openTxn.id, 'Opening stock transaction registered');
  console.log(`[OK] Opening Stock Transaction ID: ${openTxn.id}`);

  // Verify warehouse stock increased by exactly 50
  const postOpenWhStock = await inventoryService.getStockBalance(warehouseId, createdProd.id, COMPANY_ID);
  assert.strictEqual(postOpenWhStock, openQty, `Warehouse stock matches initial stock (${openQty})`);

  // Verify duplicate initial stock for same product & warehouse is prevented
  let duplicateBlocked = false;
  try {
    await inventoryService.recordOpeningStock({
      productId: createdProd.id,
      warehouseId: warehouseId,
      quantity: 25,
      companyId: COMPANY_ID,
      currentUser: { id: 'test-pm-id', name: 'Purchase Manager', role: 'Purchase Manager' }
    });
  } catch (err: any) {
    duplicateBlocked = true;
    console.log(`[OK] Duplicate opening stock blocked: "${err.message}"`);
  }
  assert.strictEqual(duplicateBlocked, true, 'Duplicate opening stock must be rejected');

  console.log('[PASS] Add Initial Stock recorded exactly once and updated warehouse balance.');

  // ---------------------------------------------------------------------------
  // TEST 4: Initial Stock (Option B: Stock Bundle)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Option B — Add Stock Bundle for Multiple Products ---');

  // Create two new catalog items for the bundle
  const bundleProd1 = await productService.createProduct(createProductPayload({ name: 'Bundle Item Alpha' }), COMPANY_ID);
  const bundleProd2 = await productService.createProduct(createProductPayload({ name: 'Bundle Item Beta' }), COMPANY_ID);

  const bundleResult = await inventoryService.recordStockBundle({
    warehouseId: warehouseId,
    notes: 'Master Suite Bundle Test',
    companyId: COMPANY_ID,
    currentUser: { id: 'test-admin-id', name: 'Admin User', role: 'Admin' },
    items: [
      { productId: bundleProd1.id, quantity: 40, unit: 'Piece', costPrice: 120 },
      { productId: bundleProd2.id, quantity: 60, unit: 'Piece', costPrice: 220 }
    ]
  });

  assert.strictEqual(bundleResult.success, true, 'Stock bundle recorded successfully');
  assert.strictEqual(bundleResult.count, 2, 'Two product lines recorded');

  // Verify stock for both products in warehouse
  const whStockProd1 = await inventoryService.getStockBalance(warehouseId, bundleProd1.id, COMPANY_ID);
  const whStockProd2 = await inventoryService.getStockBalance(warehouseId, bundleProd2.id, COMPANY_ID);
  assert.strictEqual(whStockProd1, 40, 'Bundle Item Alpha has 40 in warehouse');
  assert.strictEqual(whStockProd2, 60, 'Bundle Item Beta has 60 in warehouse');

  // Verify duplicate product rows inside a bundle are blocked
  let duplicateInBundleBlocked = false;
  try {
    await inventoryService.recordStockBundle({
      warehouseId: warehouseId,
      companyId: COMPANY_ID,
      items: [
        { productId: bundleProd1.id, quantity: 10 },
        { productId: bundleProd1.id, quantity: 20 }
      ]
    });
  } catch (err: any) {
    duplicateInBundleBlocked = true;
    console.log(`[OK] Duplicate lines within bundle blocked: "${err.message}"`);
  }
  assert.strictEqual(duplicateInBundleBlocked, true, 'Duplicate product rows in bundle rejected');

  console.log('[PASS] Stock Bundle updated all products accurately.');

  // ---------------------------------------------------------------------------
  // TEST 5: Update Stock (Add, Reduce, Correct, Negative Stock Prevention)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Update Stock Adjustments ---');

  // Current stock of createdProd in warehouseId is openQty (50)
  const currentStockBefore = await inventoryService.getStockBalance(warehouseId, createdProd.id, COMPANY_ID);
  assert.strictEqual(currentStockBefore, 50);

  // 5A. ADD Stock (+15)
  console.log('Testing Stock ADD (+15)...');
  await inventoryService.adjustStock(
    createdProd.id,
    15,
    'Audit surplus verified',
    warehouseId,
    COMPANY_ID,
    { id: 'test-pm-id', name: 'Purchase Manager', role: 'Purchase Manager' }
  );

  const stockAfterAdd = await inventoryService.getStockBalance(warehouseId, createdProd.id, COMPANY_ID);
  assert.strictEqual(stockAfterAdd, 65, 'Stock after add (+15) should be 65');
  console.log(`[OK] Stock after ADD: ${stockAfterAdd}`);

  // 5B. REDUCE Stock (-20)
  console.log('Testing Stock REDUCE (-20)...');
  await inventoryService.adjustStock(
    createdProd.id,
    -20,
    'Damaged packaging write-off',
    warehouseId,
    COMPANY_ID,
    { id: 'test-pm-id', name: 'Purchase Manager', role: 'Purchase Manager' }
  );

  const stockAfterReduce = await inventoryService.getStockBalance(warehouseId, createdProd.id, COMPANY_ID);
  assert.strictEqual(stockAfterReduce, 45, 'Stock after reduce (-20) should be 45');
  console.log(`[OK] Stock after REDUCE: ${stockAfterReduce}`);

  // 5C. PREVENT NEGATIVE STOCK (-100 when balance is 45)
  console.log('Testing Negative Stock Prevention (-100 on balance of 45)...');
  let negativeBlocked = false;
  try {
    await inventoryService.adjustStock(
      createdProd.id,
      -100,
      'Attempt invalid write-off',
      warehouseId,
      COMPANY_ID,
      { id: 'test-pm-id', name: 'Purchase Manager', role: 'Purchase Manager' }
    );
  } catch (err: any) {
    negativeBlocked = true;
    console.log(`[OK] Negative stock blocked: "${err.message}"`);
  }
  assert.strictEqual(negativeBlocked, true, 'Negative stock adjustment must be rejected');

  // 5D. CORRECT Stock (Set to 80 -> Adjustment is 80 - 45 = +35)
  console.log('Testing Stock CORRECT (Physical Count set to 80)...');
  const targetCount = 80;
  const correctionDiff = targetCount - stockAfterReduce; // +35

  await inventoryService.adjustStock(
    createdProd.id,
    correctionDiff,
    'Annual physical inventory count correction',
    warehouseId,
    COMPANY_ID,
    { id: 'test-owner-id', name: 'Owner User', role: 'Owner' }
  );

  const stockAfterCorrect = await inventoryService.getStockBalance(warehouseId, createdProd.id, COMPANY_ID);
  assert.strictEqual(stockAfterCorrect, 80, 'Stock after correction should be 80');
  console.log(`[OK] Stock after CORRECT: ${stockAfterCorrect}`);

  // 5E. REASON VALIDATION (Mandatory reason)
  console.log('Testing Mandatory Reason Validation...');
  let emptyReasonBlocked = false;
  try {
    await inventoryService.adjustStock(
      createdProd.id,
      5,
      '   ', // empty
      warehouseId,
      COMPANY_ID,
      { id: 'test-owner-id', name: 'Owner User', role: 'Owner' }
    );
  } catch (err: any) {
    emptyReasonBlocked = true;
    console.log(`[OK] Empty reason blocked: "${err.message}"`);
  }
  assert.strictEqual(emptyReasonBlocked, true, 'Empty reason must be rejected');

  console.log('[PASS] Update Stock logic (Add, Reduce, Correct, Negative Prevention, Reason) verified.');

  // ---------------------------------------------------------------------------
  // TEST 6: Backend RBAC Enforcement (Warehouse Manager blocked from adjusting)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Backend Security — Warehouse Manager Blocked ---');

  // 6A. Warehouse Manager blocked from recording opening stock
  let wmOpenBlocked = false;
  try {
    await inventoryService.recordOpeningStock({
      productId: createdProd.id,
      warehouseId: warehouseId,
      quantity: 10,
      companyId: COMPANY_ID,
      currentUser: { id: 'wm-user-id', name: 'Warehouse Mgr', role: 'Warehouse Manager' }
    });
  } catch (err: any) {
    wmOpenBlocked = true;
    assert(err.message.includes('Unauthorized (403)'), 'Error message is 403 Forbidden');
    console.log(`[OK] Backend blocked WM from recording opening stock: "${err.message}"`);
  }
  assert.strictEqual(wmOpenBlocked, true, 'WM cannot record opening stock');

  // 6B. Warehouse Manager blocked from stock bundle
  let wmBundleBlocked = false;
  try {
    await inventoryService.recordStockBundle({
      warehouseId: warehouseId,
      companyId: COMPANY_ID,
      currentUser: { id: 'wm-user-id', name: 'Warehouse Mgr', role: 'Warehouse Manager' },
      items: [{ productId: createdProd.id, quantity: 10 }]
    });
  } catch (err: any) {
    wmBundleBlocked = true;
    assert(err.message.includes('Unauthorized (403)'), 'Error message is 403 Forbidden');
    console.log(`[OK] Backend blocked WM from stock bundle: "${err.message}"`);
  }
  assert.strictEqual(wmBundleBlocked, true, 'WM cannot record stock bundle');

  // 6C. Warehouse Manager blocked from manual stock adjustment
  let wmAdjustBlocked = false;
  try {
    await inventoryService.adjustStock(
      createdProd.id,
      10,
      'WM trying to adjust',
      warehouseId,
      COMPANY_ID,
      { id: 'wm-user-id', name: 'Warehouse Mgr', role: 'Warehouse Manager' }
    );
  } catch (err: any) {
    wmAdjustBlocked = true;
    assert(err.message.includes('Unauthorized (403)'), 'Error message is 403 Forbidden');
    console.log(`[OK] Backend blocked WM from manual adjustStock: "${err.message}"`);
  }
  assert.strictEqual(wmAdjustBlocked, true, 'WM cannot adjust stock');

  console.log('[PASS] Backend security strictly denies Warehouse Manager from modifying stock master.');

  console.log('\n===============================================================');
  console.log('ALL TESTS IN MASTER UPDATE SUITE PASSED SUCCESSFULLY! [OK]');
  console.log('===============================================================');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});

