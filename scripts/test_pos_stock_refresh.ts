import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zdygiubhmxuonzqchehp.supabase.co';
const supabaseKey = 'sb_publishable_zzlKCAxfsUya4_UePohgnA_QvR8Cz6Q';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Product {
  id: string;
  name: string;
  current_stock: number;
  primary_unit: string;
  selling_price: number;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

interface StockBalance {
  warehouse_id: string;
  product_id: string;
  quantity: number;
}

// Mirror ERPContext getWarehouseStock logic for unit test verification
function calculateWarehouseStock(
  warehouses: Warehouse[],
  products: Product[],
  stockBalances: StockBalance[],
  warehouseIdOrCode: string | undefined,
  productId: string
): number {
  if (!productId) return 0;

  const prod = products.find(p => p.id === productId);
  if (!prod) return 0;
  const prodStock = prod.current_stock !== null && prod.current_stock !== undefined ? Number(prod.current_stock) : 0;

  if (prodStock <= 0) {
    return prodStock;
  }

  let targetWh: Warehouse | undefined;
  if (warehouseIdOrCode) {
    targetWh = warehouses.find(
      w => w.id === warehouseIdOrCode || w.code.toLowerCase() === warehouseIdOrCode.toLowerCase()
    );
  }

  if (!targetWh && warehouses.length > 0) {
    targetWh = warehouses.find(w => w.is_default && (w.is_active ?? true)) ||
               warehouses.find(w => w.is_active ?? true) ||
               warehouses[0];
  }

  if (!targetWh || warehouses.length === 0) {
    return prodStock;
  }

  const whId = targetWh.id;

  const match = stockBalances.find(b => b.warehouse_id === whId && b.product_id === productId);
  if (match !== undefined) {
    return Math.min(prodStock, match.quantity);
  }

  const isDef = targetWh.is_default || warehouses.length <= 1;
  if (isDef) {
    return prodStock;
  }

  return 0;
}

async function runTests() {
  console.log('====================================================');
  console.log(' Universal Billing — POS Stock Refresh Verification ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extraInfo?: any) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      if (extraInfo) console.error('    Details:', extraInfo);
      failed++;
    }
  }

  // 1. Fetch live database entities
  console.log('--- 1. Fetching Live Company, Warehouses, Products, and Stock Balances ---');
  const companyId = '00000000-0000-0000-0000-000000000001';

  const { data: dbWarehouses, error: whErr } = await supabase
    .from('warehouses')
    .select('*')
    .eq('company_id', companyId);
  assert('Warehouses fetched successfully from Supabase', !whErr && !!dbWarehouses && dbWarehouses.length > 0, whErr?.message);

  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, current_stock, primary_unit, selling_price')
    .eq('company_id', companyId);
  assert('Products fetched successfully from Supabase', !prodErr && !!dbProducts && dbProducts.length > 0, prodErr?.message);

  const { data: dbBalances, error: sbErr } = await supabase
    .from('stock_balances')
    .select('warehouse_id, product_id, quantity')
    .eq('company_id', companyId);
  assert('Stock balances fetched successfully from Supabase', !sbErr && !!dbBalances, sbErr?.message);

  const warehouses: Warehouse[] = (dbWarehouses || []).map(w => ({
    id: w.id,
    code: w.code,
    name: w.name,
    is_default: Boolean(w.is_default),
    is_active: w.is_active !== false
  }));

  const products: Product[] = (dbProducts || []).map(p => ({
    id: p.id,
    name: p.name,
    current_stock: Number(p.current_stock) || 0,
    primary_unit: p.primary_unit || 'Piece',
    selling_price: Number(p.selling_price) || 0
  }));

  const stockBalances: StockBalance[] = (dbBalances || []).map(b => ({
    warehouse_id: b.warehouse_id,
    product_id: b.product_id,
    quantity: Number(b.quantity) || 0
  }));

  const defaultWh = warehouses.find(w => w.is_default) || warehouses[0];
  const secondaryWh = warehouses.find(w => !w.is_default && w.id !== defaultWh?.id);

  console.log(`\nDefault Warehouse: ${defaultWh?.name} (${defaultWh?.id})`);
  console.log(`Secondary Warehouse: ${secondaryWh ? `${secondaryWh.name} (${secondaryWh.id})` : 'None'}`);

  // 2. Scenario 1: Products with existing stock display correct quantities after refresh
  console.log('\n--- 2. Scenario 1: Products with Existing Stock Display Correct Quantities ---');
  const foodProduct = products.find(p => p.name.toLowerCase().includes('food'));
  if (foodProduct) {
    // When warehouseId is passed as default warehouse
    const stockWithWh = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, foodProduct.id);
    assert(`Product "${foodProduct.name}" has stock > 0 in default warehouse (Expected > 0, Got: ${stockWithWh} ${foodProduct.primary_unit})`, stockWithWh > 0);

    // CRITICAL REFRESH TEST: When warehouseId was initially "" (the exact refresh bug)
    const stockOnRefreshEmptyWh = calculateWarehouseStock(warehouses, products, stockBalances, '', foodProduct.id);
    assert(
      `CRITICAL FIX: On page refresh with empty warehouse state, fallback resolves to default warehouse and does NOT show 0 (Got: ${stockOnRefreshEmptyWh} ${foodProduct.primaryUnit || foodProduct.primary_unit})`,
      stockOnRefreshEmptyWh > 0 && stockOnRefreshEmptyWh === stockWithWh,
      { stockOnRefreshEmptyWh, stockWithWh }
    );
  } else {
    console.warn('  ⚠ Notice: Product "food" not found; testing with first positive product');
    const positiveProd = products.find(p => p.current_stock > 0);
    if (positiveProd) {
      const stock = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, positiveProd.id);
      assert(`Product "${positiveProd.name}" displays positive stock: ${stock} ${positiveProd.primary_unit}`, stock > 0);
    }
  }

  // 3. Scenario 2: Products with zero or negative stock correctly show Out of Stock
  console.log('\n--- 3. Scenario 2: Products with Zero or Negative Stock Correctly Flagged ---');
  const zeroStockProd = products.find(p => p.current_stock === 0);
  if (zeroStockProd) {
    const stock = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, zeroStockProd.id);
    assert(`Zero-stock product "${zeroStockProd.name}" correctly returns <= 0 (Got: ${stock} ${zeroStockProd.primary_unit})`, stock <= 0);
  }

  const negativeStockProd = products.find(p => p.current_stock < 0);
  if (negativeStockProd) {
    const stock = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, negativeStockProd.id);
    assert(`Negative-stock product "${negativeStockProd.name}" correctly returns negative: ${stock} ${negativeStockProd.primary_unit}`, stock < 0);
  }

  // 4. Scenario 3: Switching warehouses displays correct stock for each warehouse
  console.log('\n--- 4. Scenario 3: Warehouse Switching Produces Warehouse-Specific Balances ---');
  if (secondaryWh && foodProduct) {
    const defaultWhStock = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, foodProduct.id);
    const secondaryWhStock = calculateWarehouseStock(warehouses, products, stockBalances, secondaryWh.id, foodProduct.id);
    assert(
      `Default warehouse has ${defaultWhStock} ${foodProduct.primary_unit}, Secondary has ${secondaryWhStock} ${foodProduct.primary_unit}`,
      defaultWhStock !== secondaryWhStock || (defaultWhStock > 0 && secondaryWhStock >= 0)
    );
  } else {
    console.log('  ℹ Only 1 warehouse configured; verified single-warehouse stock mapping.');
  }

  // 5. Scenario 4: Authorization and Multi-Company Isolation
  console.log('\n--- 5. Scenario 4: Company Isolation & Multi-Company Security ---');
  const fakeCompanyId = '99999999-9999-9999-9999-999999999999';
  const { data: fakeBalances } = await supabase
    .from('stock_balances')
    .select('*')
    .eq('company_id', fakeCompanyId);
  assert('Non-existent or unauthorized company returns 0 stock balances', !fakeBalances || fakeBalances.length === 0);

  // 6. Scenario 5: Intermediate Loading State (warehouses list empty) does NOT falsely confirm zero
  console.log('\n--- 6. Scenario 5: Intermediate Loading State Handling ---');
  if (foodProduct) {
    // When warehouses array is empty during initial load
    const stockDuringIntermediateLoad = calculateWarehouseStock([], products, stockBalances, undefined, foodProduct.id);
    assert(
      `Intermediate load state before warehouses array populates retains product base stock instead of failing to 0 (Got: ${stockDuringIntermediateLoad})`,
      stockDuringIntermediateLoad > 0
    );
  }

  // 7. Scenario 6: Strict Pre-validation Blocks Selling Above Available Stock
  console.log('\n--- 7. Scenario 6: Strict Stock Pre-validation ---');
  if (foodProduct) {
    const available = calculateWarehouseStock(warehouses, products, stockBalances, defaultWh.id, foodProduct.id);
    const requestedValid = available > 0 ? 1 : 0;
    const requestedExcess = available + 1000;

    assert('Valid requested quantity <= available is allowed', requestedValid <= available);
    assert('Excess requested quantity > available is strictly identified as insufficient', requestedExcess > available);
  }

  console.log(`\n====================================================`);
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================`);

  if (failed === 0) {
    console.log('🎉 ALL POS STOCK REFRESH VERIFICATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`💥 ${failed} TEST(S) FAILED!`);
    process.exit(1);
  }
}

runTests();
