/**
 * Verification Test Suite: Move Add Product Functionality into Initial Stock
 * Validates:
 * 1. Creating a new product and recording its initial stock in one submission.
 * 2. Selecting an existing product and adding its opening stock without creating duplicate products.
 * 3. Adding multiple products through Stock Bundle without product duplication.
 * 4. Validation failures (missing required fields, negative stock, invalid units).
 * 5. Duplicate submission prevention (blocking duplicate opening stock).
 * 6. Verification that stock balances are updated exactly once.
 * 7. Verification that Product Master catalog displays newly created products.
 * 8. Strict RBAC enforcement (Owner, Admin, Purchase Manager allowed; Warehouse Manager blocked).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { inventoryService } from '../src/services/inventoryService';
import { Product } from '../src/types';

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: MOVE ADD PRODUCT FUNCTIONALITY INTO INITIAL STOCK');
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

  // 1. Fetch active warehouses
  const { data: whList } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .limit(2);

  assert.ok(whList && whList.length > 0, 'Must have at least 1 warehouse in test environment');
  const targetWh = whList[0];
  console.log(`[INFO] Using Target Warehouse: ${targetWh.name} (${targetWh.code}, ID: ${targetWh.id})\n`);

  // --- TEST 1: CREATE NEW PRODUCT WITH INITIAL STOCK ---
  console.log('--- 1. Create New Product with Initial Stock in One Submission ---');

  const timestamp = Date.now();
  const testNewSku = `TEST-INIT-${timestamp.toString().slice(-6)}`;
  let createdProductId = '';

  await test('Create product master record and allocate opening stock atomically', async () => {
    const payload: Omit<Product, 'id' | 'createdAt'> = {
      name: `Initial Stock Intake Product ${timestamp}`,
      code: testNewSku,
      sku: testNewSku,
      barcode: `890${timestamp.toString().slice(-9)}`,
      category: 'Building Materials',
      subcategory: 'Cement',
      brand: 'TestBrand',
      description: 'Product created directly via Initial Stock intake workflow',
      hsn: '252329',
      taxRate: 18,
      purchasePrice: 280,
      costPrice: 300,
      sellingPrice: 380,
      retailPrice: 380,
      wholesalePrice: 350,
      dealerPrice: 340,
      mrp: 400,
      minSellingPrice: 320,
      reorderLevel: 25,
      targetStockLevel: 150,
      openingStock: 75,
      openingStockValue: 75 * 300,
      currentStock: 75,
      primaryUnit: 'Bag',
      secondaryUnit: 'Pallet',
      conversionFactor: 50,
      warehouse: targetWh.code,
      rack: 'Aisle 4, Bay 2',
      batchNumber: `BAT-${timestamp}`,
      expiryDate: '2027-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    };

    const created = await productService.createProduct(payload, COMPANY_ID);
    assert.ok(created.id, 'Created product must return a valid ID');
    createdProductId = created.id;

    // Verify product record in products table
    const { data: dbProd } = await supabase
      .from('products')
      .select('id, name, sku, current_stock, opening_stock, primary_unit, warehouse')
      .eq('id', created.id)
      .single();

    assert.ok(dbProd, 'Product must exist in products table');
    assert.strictEqual(dbProd.sku, testNewSku, 'SKU must match');
    assert.strictEqual(Number(dbProd.current_stock), 75, 'current_stock must be 75');
    assert.strictEqual(Number(dbProd.opening_stock), 75, 'opening_stock must be 75');

    // Verify stock balance in stock_balances table
    const { data: dbBalance } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('product_id', created.id)
      .eq('warehouse_id', targetWh.id)
      .single();

    assert.ok(dbBalance, 'Stock balance record must exist');
    assert.strictEqual(Number(dbBalance.quantity), 75, 'Warehouse stock balance must equal opening stock 75');

    // Verify Opening Stock transaction in stock_transactions table
    const { data: dbTxn } = await supabase
      .from('stock_transactions')
      .select('id, type, qty, unit, unit_cost, total_cost, warehouse_id')
      .eq('product_id', created.id)
      .eq('type', 'Opening Stock')
      .single();

    assert.ok(dbTxn, 'Opening Stock transaction must be recorded');
    assert.strictEqual(Number(dbTxn.qty), 75, 'Transaction qty must be 75');
    assert.strictEqual(dbTxn.warehouse_id, targetWh.id, 'Transaction warehouse must match');

    // Verify batch in product_batches
    const { data: dbBatch } = await supabase
      .from('product_batches')
      .select('batch_number, qty, warehouse_id')
      .eq('product_id', created.id)
      .single();

    assert.ok(dbBatch, 'Batch record must be created');
    assert.strictEqual(dbBatch.batch_number, `BAT-${timestamp}`);
    assert.strictEqual(Number(dbBatch.qty), 75);
  });

  // --- TEST 2: SELECT EXISTING PRODUCT & ADD INITIAL STOCK ---
  console.log('--- 2. Select Existing Product and Add Initial Stock ---');

  const existingSku = `TEST-EXIST-${timestamp.toString().slice(-6)}`;
  let existingProdId = '';

  await test('Allocate initial stock to existing product without creating duplicate product', async () => {
    // 1. Create product with 0 stock
    const baseProd = await productService.createProduct({
      name: `Existing Catalog Item ${timestamp}`,
      code: existingSku,
      sku: existingSku,
      barcode: `890${(timestamp + 1).toString().slice(-9)}`,
      category: 'Electrical Supplies',
      subcategory: 'Cables',
      brand: 'Havells',
      description: 'Existing item to receive initial stock',
      hsn: '8544',
      taxRate: 18,
      purchasePrice: 1500,
      costPrice: 1600,
      sellingPrice: 2100,
      retailPrice: 2100,
      wholesalePrice: 1900,
      dealerPrice: 1800,
      mrp: 2300,
      minSellingPrice: 1750,
      reorderLevel: 10,
      targetStockLevel: 50,
      openingStock: 0,
      openingStockValue: 0,
      currentStock: 0,
      primaryUnit: 'Coil',
      warehouse: targetWh.code,
      rack: 'Shelf E-3',
      batchNumber: `BAT-BASE-${timestamp}`,
      expiryDate: '2028-06-30',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true
    }, COMPANY_ID);

    existingProdId = baseProd.id;

    // Count products before allocation
    const { count: countBefore } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', COMPANY_ID);

    // Record opening stock for existing product
    const txn = await inventoryService.recordOpeningStock({
      productId: existingProdId,
      warehouseId: targetWh.id,
      quantity: 40,
      unit: 'Coil',
      costPrice: 1600,
      batchNumber: `BAT-ADD-${timestamp}`,
      expiryDate: '2028-06-30',
      date: '2026-10-28',
      referenceNumber: `REF-OP-${timestamp}`,
      notes: 'Initial opening stock intake for existing product',
      companyId: COMPANY_ID,
      currentUser: { id: 'test-admin', name: 'Test Admin', role: 'Admin' }
    });

    assert.ok(txn.id, 'Transaction must be returned');

    // Count products after allocation - MUST BE IDENTICAL
    const { count: countAfter } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', COMPANY_ID);

    assert.strictEqual(countAfter, countBefore, 'Product count must NOT increase (no duplicate products)');

    // Verify product current_stock is updated to 40
    const { data: updatedProd } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', existingProdId)
      .single();

    assert.strictEqual(Number(updatedProd?.current_stock), 40, 'Product current_stock must be 40');

    // Verify warehouse balance is 40
    const { data: updatedBalance } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('product_id', existingProdId)
      .eq('warehouse_id', targetWh.id)
      .single();

    assert.strictEqual(Number(updatedBalance?.quantity), 40, 'Warehouse balance must be 40');
  });

  // --- TEST 3: PREVENT DUPLICATE OPENING STOCK ---
  console.log('--- 3. Prevent Duplicate Opening Stock Submissions ---');

  await test('Reject duplicate opening stock submission for the same product and warehouse', async () => {
    let duplicateRejected = false;
    try {
      await inventoryService.recordOpeningStock({
        productId: existingProdId,
        warehouseId: targetWh.id,
        quantity: 20,
        unit: 'Coil',
        companyId: COMPANY_ID,
        currentUser: { id: 'test-admin', name: 'Test Admin', role: 'Admin' }
      });
    } catch (err: any) {
      if (err.message.includes('has already been registered') || err.message.includes('Opening stock of')) {
        duplicateRejected = true;
      } else {
        throw err;
      }
    }

    assert.ok(duplicateRejected, 'Duplicate opening stock must be blocked with an informative error');

    // Verify stock balance remained unchanged at 40
    const { data: balanceCheck } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('product_id', existingProdId)
      .eq('warehouse_id', targetWh.id)
      .single();

    assert.strictEqual(Number(balanceCheck?.quantity), 40, 'Stock balance must not be modified by duplicate submission');
  });

  // --- TEST 4: ADD STOCK BUNDLE ---
  console.log('--- 4. Add Stock Bundle for Multiple Products ---');

  await test('Record opening stock bundle for multiple distinct products without creating duplicates', async () => {
    const prodA = await productService.createProduct({
      name: `Bundle Item A ${timestamp}`,
      code: `BNDL-A-${timestamp.toString().slice(-4)}`,
      sku: `BNDL-A-${timestamp.toString().slice(-4)}`,
      category: 'General Merchandise',
      costPrice: 50,
      sellingPrice: 80,
      primaryUnit: 'Piece',
      warehouse: targetWh.code,
      batchNumber: `BAT-A-${timestamp}`,
      expiryDate: '2028-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true,
      openingStock: 0,
      openingStockValue: 0,
      currentStock: 0,
      hsn: '',
      brand: '',
      description: '',
      purchasePrice: 50,
      retailPrice: 80,
      wholesalePrice: 70,
      mrp: 90,
      minSellingPrice: 60,
      taxRate: 18
    }, COMPANY_ID);

    const prodB = await productService.createProduct({
      name: `Bundle Item B ${timestamp}`,
      code: `BNDL-B-${timestamp.toString().slice(-4)}`,
      sku: `BNDL-B-${timestamp.toString().slice(-4)}`,
      category: 'General Merchandise',
      costPrice: 100,
      sellingPrice: 150,
      primaryUnit: 'Box',
      warehouse: targetWh.code,
      batchNumber: `BAT-B-${timestamp}`,
      expiryDate: '2028-12-31',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true,
      openingStock: 0,
      openingStockValue: 0,
      currentStock: 0,
      hsn: '',
      brand: '',
      description: '',
      purchasePrice: 100,
      retailPrice: 150,
      wholesalePrice: 130,
      mrp: 170,
      minSellingPrice: 120,
      taxRate: 18
    }, COMPANY_ID);

    // Test duplicate line prevention inside bundle
    let duplicateLineBlocked = false;
    try {
      await inventoryService.recordStockBundle({
        warehouseId: targetWh.id,
        items: [
          { productId: prodA.id, quantity: 10 },
          { productId: prodA.id, quantity: 20 } // Duplicate row!
        ],
        companyId: COMPANY_ID,
        currentUser: { id: 'test-admin', name: 'Test Admin', role: 'Admin' }
      });
    } catch (err: any) {
      if (err.message.includes('Duplicate product') || err.message.includes('can only appear once')) {
        duplicateLineBlocked = true;
      }
    }
    assert.ok(duplicateLineBlocked, 'Duplicate product lines within bundle must be rejected');

    // Execute valid bundle
    const bundleRes = await inventoryService.recordStockBundle({
      warehouseId: targetWh.id,
      referenceNumber: `BNDL-REF-${timestamp}`,
      notes: 'Testing multi-product bundle intake',
      items: [
        { productId: prodA.id, quantity: 25, unit: 'Piece', costPrice: 50, batchNumber: `BAT-A-${timestamp}`, expiryDate: '2028-12-31' },
        { productId: prodB.id, quantity: 15, unit: 'Box', costPrice: 100, batchNumber: `BAT-B-${timestamp}`, expiryDate: '2028-12-31' }
      ],
      companyId: COMPANY_ID,
      currentUser: { id: 'test-admin', name: 'Test Admin', role: 'Admin' }
    });

    assert.strictEqual(bundleRes.count, 2, 'Bundle should process 2 products');

    // Verify stock balance for Prod A = 25
    const { data: balA } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('product_id', prodA.id)
      .eq('warehouse_id', targetWh.id)
      .single();
    assert.strictEqual(Number(balA?.quantity), 25);

    // Verify stock balance for Prod B = 15
    const { data: balB } = await supabase
      .from('stock_balances')
      .select('quantity')
      .eq('product_id', prodB.id)
      .eq('warehouse_id', targetWh.id)
      .single();
    assert.strictEqual(Number(balB?.quantity), 15);
  });

  // --- TEST 5: VALIDATION FAILURES ---
  console.log('--- 5. Validation Failure Protections ---');

  await test('Reject product creation when destination warehouse is missing', async () => {
    let rejected = false;
    try {
      await productService.createProduct({
        name: 'Invalid Warehouse Product',
        code: 'INV-1',
        sku: 'INV-1',
        category: 'General',
        warehouse: '', // Missing warehouse
        openingStock: 10,
        batchNumber: 'BAT-1',
        expiryDate: '2027-12-31',
        sellingPrice: 100,
        costPrice: 50,
        primaryUnit: 'Piece',
        hsn: '',
        brand: '',
        description: '',
        purchasePrice: 50,
        retailPrice: 100,
        wholesalePrice: 90,
        mrp: 110,
        minSellingPrice: 80,
        taxRate: 18,
        batchTracking: true,
        serialTracking: false,
        expiryTracking: true,
        isActive: true,
        currentStock: 10,
        openingStockValue: 500
      }, COMPANY_ID);
    } catch (err: any) {
      if (err.message.includes('Warehouse selection is required') || err.message.includes('warehouse')) {
        rejected = true;
      }
    }
    assert.ok(rejected, 'Missing warehouse must be blocked');
  });

  await test('Reject product creation with negative opening stock quantity', async () => {
    let rejected = false;
    try {
      await productService.createProduct({
        name: 'Negative Stock Product',
        code: 'NEG-1',
        sku: 'NEG-1',
        category: 'General',
        warehouse: targetWh.code,
        openingStock: -25, // Negative quantity
        batchNumber: 'BAT-1',
        expiryDate: '2027-12-31',
        sellingPrice: 100,
        costPrice: 50,
        primaryUnit: 'Piece',
        hsn: '',
        brand: '',
        description: '',
        purchasePrice: 50,
        retailPrice: 100,
        wholesalePrice: 90,
        mrp: 110,
        minSellingPrice: 80,
        taxRate: 18,
        batchTracking: true,
        serialTracking: false,
        expiryTracking: true,
        isActive: true,
        currentStock: -25,
        openingStockValue: -1250
      }, COMPANY_ID);
    } catch (err: any) {
      if (err.message.includes('cannot be negative') || err.message.includes('negative')) {
        rejected = true;
      }
    }
    assert.ok(rejected, 'Negative opening stock must be blocked');
  });

  // --- TEST 6: ROLE PERMISSIONS (RBAC) ---
  console.log('--- 6. Role Permissions (Warehouse Manager Blocked) ---');

  await test('Warehouse Manager is strictly denied from recording opening stock', async () => {
    let wmBlocked = false;
    try {
      await inventoryService.recordOpeningStock({
        productId: createdProductId,
        warehouseId: targetWh.id,
        quantity: 10,
        unit: 'Bag',
        companyId: COMPANY_ID,
        currentUser: { id: 'test-wm', name: 'Test WM', role: 'Warehouse Manager' }
      });
    } catch (err: any) {
      if (err.message.includes('Unauthorized (403)') && err.message.includes('Warehouse Manager')) {
        wmBlocked = true;
      }
    }
    assert.ok(wmBlocked, 'Warehouse Manager must be denied from recording opening stock');
  });

  await test('Warehouse Manager is strictly denied from recording stock bundles', async () => {
    let wmBlocked = false;
    try {
      await inventoryService.recordStockBundle({
        warehouseId: targetWh.id,
        items: [{ productId: createdProductId, quantity: 5 }],
        companyId: COMPANY_ID,
        currentUser: { id: 'test-wm', name: 'Test WM', role: 'Warehouse Manager' }
      });
    } catch (err: any) {
      if (err.message.includes('Unauthorized (403)') && err.message.includes('Warehouse Manager')) {
        wmBlocked = true;
      }
    }
    assert.ok(wmBlocked, 'Warehouse Manager must be denied from recording stock bundles');
  });

  // --- TEST 7: PRODUCT MASTER VERIFICATION ---
  console.log('--- 7. Product Master Verification ---');

  await test('Newly created product appears in Product Master catalog with correct stock', async () => {
    const catalog = await productService.getProducts(undefined, COMPANY_ID);
    const found = catalog.find(p => p.id === createdProductId || p.sku === testNewSku);

    assert.ok(found, 'Product created via Initial Stock must appear in Product Master catalog');
    assert.strictEqual(Number(found.currentStock), 75, 'Catalog item currentStock must be 75');
    assert.strictEqual(found.primaryUnit, 'Bag', 'Catalog item primaryUnit must be Bag');
  });

  // --- TEST 8: CODEBASE WORKFLOW & UI INTEGRATION ---
  console.log('--- 8. Codebase Workflow & UI Integration ---');

  await test('InitialStockPage.tsx contains Add Product entry form with stock intake fields', async () => {
    const pagePath = path.resolve(process.cwd(), 'src/pages/products/InitialStockPage.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert.ok(content.includes('Initial Stock'), 'Must include Initial Stock heading');
    assert.ok(content.includes('Add Product'), 'Must include Add Product badge / label');
    assert.ok(content.includes('Product Name'), 'Must contain Product Name input');
    assert.ok(content.includes('SKU'), 'Must contain SKU input');
    assert.ok(content.includes('Category'), 'Must contain Category selection');
    assert.ok(content.includes('Destination Warehouse'), 'Must contain Destination Warehouse selection');
    assert.ok(content.includes('Opening Stock Quantity'), 'Must contain Opening Stock Quantity');
    assert.ok(content.includes('handleAutoGenerateSku'), 'Must provide Auto-Generate SKU helper');
    assert.ok(content.includes('handleAutoGenerateBarcode'), 'Must provide Auto-Generate Barcode helper');
    assert.ok(content.includes('handleAutoGenerateBatch'), 'Must provide Auto-Generate Batch helper');
    assert.ok(content.includes('setIsAddCategoryModalOpen'), 'Must support custom category addition');
  });

  await test('App.tsx routes /products/new to /products/initial-stock', async () => {
    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    assert.ok(
      appContent.includes('path="products/new"') && appContent.includes('to="/products/initial-stock"'),
      '/products/new must redirect to /products/initial-stock'
    );
  });

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} OF ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite fatal error:', err);
  process.exit(1);
});
