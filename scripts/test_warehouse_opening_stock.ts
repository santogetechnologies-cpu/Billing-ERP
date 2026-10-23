import { supabase } from '../src/lib/supabase';
import { productService } from '../src/services/productService';
import { setTabScopedStaffSession } from '../src/services/authService';

async function runWarehouseOpeningStockTests() {
  console.log('--- STARTING WAREHOUSE & OPENING STOCK TEST SUITE ---');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      testsFailed++;
    }
  }

  try {
    // Authenticate as Owner for privileged operations
    setTabScopedStaffSession({
      user: { id: '00000000-0000-0000-0000-000000000099', email: 'owner@tester.com' },
      profile: {
        id: '00000000-0000-0000-0000-000000000099',
        company_id: '00000000-0000-0000-0000-000000000001',
        name: 'Owner Tester',
        email: 'owner@tester.com',
        role: 'Owner',
        is_active: true,
        created_at: new Date().toISOString()
      } as any
    });

    // 1. Verify Warehouses from DB
    console.log('\n--- 1. Testing Warehouse Loading from DB ---');
    const { data: dbWarehouses, error: whErr } = await supabase
      .from('warehouses')
      .select('id, name, code, address, is_default')
      .eq('company_id', '00000000-0000-0000-0000-000000000001');

    assert(!whErr && dbWarehouses && dbWarehouses.length >= 2, 'Loaded active warehouses from DB successfully');
    console.log('Warehouses in DB:', dbWarehouses?.map(w => `${w.name} (${w.code})`));
    const targetWh = dbWarehouses![0];
    const secondaryWh = dbWarehouses![1];

    // 2. Rejection of Missing Warehouse
    console.log('\n--- 2. Testing Missing / Invalid Warehouse Validation ---');
    try {
      await productService.createProduct({
        name: 'No Warehouse Item ' + Date.now(),
        sku: 'NOWH-' + Date.now(),
        category: 'Building Materials',
        purchasePrice: 100,
        costPrice: 120,
        sellingPrice: 150,
        openingStock: 10,
        openingStockValue: 1200,
        primaryUnit: 'Piece',
        warehouse: '', // EMPTY
        batchNumber: 'BAT-001',
        expiryDate: '2028-12-31'
      });
      assert(false, 'Should reject empty warehouse');
    } catch (err: any) {
      assert(err.message.includes('Warehouse selection is required'), `Rejected empty warehouse: ${err.message}`);
    }

    try {
      await productService.createProduct({
        name: 'Fake Warehouse Item ' + Date.now(),
        sku: 'FAKEWH-' + Date.now(),
        category: 'Building Materials',
        purchasePrice: 100,
        costPrice: 120,
        sellingPrice: 150,
        openingStock: 10,
        openingStockValue: 1200,
        primaryUnit: 'Piece',
        warehouse: 'FAKE-NONEXISTENT-WAREHOUSE-999', // FAKE
        batchNumber: 'BAT-001',
        expiryDate: '2028-12-31'
      });
      assert(false, 'Should reject non-existent warehouse');
    } catch (err: any) {
      assert(err.message.includes('Selected warehouse does not exist'), `Rejected fake warehouse: ${err.message}`);
    }

    // 3. Rejection of Negative / Invalid Opening Stock Quantity
    console.log('\n--- 3. Testing Opening Stock Quantity Validation ---');
    try {
      await productService.createProduct({
        name: 'Negative Stock Item ' + Date.now(),
        sku: 'NEGSTK-' + Date.now(),
        category: 'Building Materials',
        purchasePrice: 100,
        costPrice: 120,
        sellingPrice: 150,
        openingStock: -10, // NEGATIVE
        openingStockValue: -1200,
        primaryUnit: 'Piece',
        warehouse: targetWh.id,
        batchNumber: 'BAT-001',
        expiryDate: '2028-12-31'
      });
      assert(false, 'Should reject negative opening stock');
    } catch (err: any) {
      assert(err.message.includes('cannot be negative'), `Rejected negative opening stock: ${err.message}`);
    }

    // 4. Successful Creation with Warehouse and Positive Opening Stock
    console.log('\n--- 4. Testing Positive Opening Stock Creation & Allocation ---');
    const posTimestamp = Date.now();
    const posSku = 'POS-' + posTimestamp;
    const testCostPrice = 250;
    const testOpeningQty = 45;
    const expectedValue = testOpeningQty * testCostPrice;
    const testBatchNo = 'BAT-POS-' + posTimestamp;
    const testExpiry = '2029-06-30';

    const createdProd = await productService.createProduct({
      name: 'Warehouse Stock Product ' + posTimestamp,
      sku: posSku,
      category: 'Building Materials',
      purchasePrice: 200,
      costPrice: testCostPrice,
      sellingPrice: 350,
      openingStock: testOpeningQty,
      openingStockValue: expectedValue,
      primaryUnit: 'Kg',
      warehouse: targetWh.id,
      batchNumber: testBatchNo,
      expiryDate: testExpiry
    });

    assert(Boolean(createdProd && createdProd.id), 'Product created successfully with ID: ' + createdProd.id);
    assert(createdProd.openingStock === testOpeningQty, `Product opening stock matches: ${createdProd.openingStock}`);
    assert(createdProd.openingStockValue === expectedValue, `Product opening stock value calculated correctly: ₹${createdProd.openingStockValue}`);

    // Verify stock_balances for this warehouse
    const { data: balanceRow } = await supabase
      .from('stock_balances')
      .select('*')
      .eq('product_id', createdProd.id)
      .eq('warehouse_id', targetWh.id)
      .maybeSingle();

    assert(Boolean(balanceRow), 'Stock balance record exists for target warehouse');
    assert(Number(balanceRow?.quantity) === testOpeningQty, `Warehouse stock balance quantity exactly matches opening stock (${balanceRow?.quantity} === ${testOpeningQty})`);

    // Verify product_batches record
    const { data: batchRow } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', createdProd.id)
      .eq('warehouse_id', targetWh.id)
      .maybeSingle();

    assert(Boolean(batchRow), 'Batch record created linked to warehouse');
    assert(batchRow?.batch_number === testBatchNo, `Batch number matches: ${batchRow?.batch_number}`);
    assert(batchRow?.expiry_date === testExpiry, `Expiry date matches: ${batchRow?.expiry_date}`);
    assert(Number(batchRow?.qty) === testOpeningQty, `Batch quantity matches opening stock: ${batchRow?.qty}`);
    assert(batchRow?.status === 'Active', `Batch status is Active: ${batchRow?.status}`);

    // Verify stock_transactions (should have exactly 1 opening transaction)
    const { data: txRows } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('product_id', createdProd.id);

    assert(txRows?.length === 1, `Exactly 1 stock transaction recorded (No double-counting, found: ${txRows?.length})`);
    assert(Number(txRows?.[0].qty) === testOpeningQty, `Stock transaction quantity matches: ${txRows?.[0].qty}`);
    assert(txRows?.[0].warehouse_id === targetWh.id, `Stock transaction linked to target warehouse`);

    // 5. Successful Creation with ZERO Opening Stock
    console.log('\n--- 5. Testing Zero Opening Stock Creation ---');
    const zeroTimestamp = Date.now();
    const zeroSku = 'ZERO-' + zeroTimestamp;
    const zeroBatchNo = 'BAT-ZERO-' + zeroTimestamp;

    const zeroProd = await productService.createProduct({
      name: 'Zero Stock Product ' + zeroTimestamp,
      sku: zeroSku,
      category: 'Metals & Structural',
      purchasePrice: 100,
      costPrice: 100,
      sellingPrice: 150,
      openingStock: 0,
      openingStockValue: 0,
      primaryUnit: 'Piece',
      warehouse: secondaryWh.id,
      batchNumber: zeroBatchNo,
      expiryDate: '2028-05-15'
    });

    assert(Boolean(zeroProd && zeroProd.id), 'Zero stock product created successfully: ' + zeroProd.id);

    // Verify warehouse balance exists with quantity 0
    const { data: zeroBalance } = await supabase
      .from('stock_balances')
      .select('*')
      .eq('product_id', zeroProd.id)
      .eq('warehouse_id', secondaryWh.id)
      .maybeSingle();

    assert(Boolean(zeroBalance), 'Warehouse balance row registered for warehouse even with 0 stock');
    assert(Number(zeroBalance?.quantity) === 0, `Zero stock balance is 0: ${zeroBalance?.quantity}`);

    // Verify zero stock does NOT generate unnecessary stock_transactions
    const { data: zeroTx } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('product_id', zeroProd.id);

    assert((zeroTx?.length || 0) === 0, 'No stock transactions created for zero opening stock intake');

    // 6. Security & RBAC: Salesperson Blocked
    console.log('\n--- 6. Testing RBAC: Salesperson blocked from creating product/stock ---');
    setTabScopedStaffSession({
      user: { id: '00000000-0000-0000-0000-000000000044', email: 'bob@sales.com' },
      profile: {
        id: '00000000-0000-0000-0000-000000000044',
        company_id: '00000000-0000-0000-0000-000000000001',
        name: 'Sales Rep Bob',
        email: 'bob@sales.com',
        role: 'Salesperson',
        is_active: true,
        created_at: new Date().toISOString()
      } as any
    });

    try {
      await productService.createProduct({
        name: 'Salesperson Illegal Product',
        sku: 'ILLEGAL-' + Date.now(),
        category: 'Building Materials',
        purchasePrice: 50,
        costPrice: 50,
        sellingPrice: 80,
        openingStock: 5,
        openingStockValue: 250,
        primaryUnit: 'Piece',
        warehouse: targetWh.id,
        batchNumber: 'BAT-BAD',
        expiryDate: '2028-01-01'
      });
      assert(false, 'Salesperson should be blocked from creating product/stock');
    } catch (err: any) {
      assert(err.message.toLowerCase().includes('permission') || err.message.includes('Unauthorized'), `Salesperson correctly blocked: ${err.message}`);
    }

    // Clean up in-memory session
    setTabScopedStaffSession(null);

    // Summary
    console.log('\n=============================================');
    console.log(`TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('=============================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (globalErr: any) {
    console.error('Test suite crashed with unhandled error:', globalErr);
    process.exit(1);
  }
}

runWarehouseOpeningStockTests();
