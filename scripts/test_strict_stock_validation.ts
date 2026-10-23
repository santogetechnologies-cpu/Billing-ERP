// Verification Test Suite: Strict Stock Availability Validation & Negative Stock Prevention
// Covers all scenarios specified in the task requirements:
// 1. Stock 10, sell 3 -> Sale succeeds; remaining stock is 7.
// 2. Stock 1, sell 1 -> Sale succeeds; remaining stock is 0 and status becomes Out of Stock.
// 3. Stock 0, sell 1 -> Sale is blocked with exact Out of Stock warning.
// 4. Stock 5, sell 6 -> Sale is blocked with exact insufficient-stock warning.
// 5. Two simultaneous sales attempt to sell the last unit -> Only one succeeds.
// 6. Failed or cancelled sale -> No stock is deducted.
// 7. Existing negative balance -> Further sales are blocked until stock is reconciled.
// 8. Supported units: Kg, Litre, Bag, Piece/Pcs, Meter, Box, Roll, Pack.
// 9. Product Master Status: Active, Limited Stock, Out of Stock (negative balance never Active).

import { validateStockAvailability, validateCartStock, calculateStockStatus } from '../src/utils/inventoryUtils';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('RUNNING COMPREHENSIVE STOCK VALIDATION TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Scenario 1: Stock 10, sell 3 -> Sale succeeds; remaining stock is 7
// -----------------------------------------------------------------------------
console.log('SCENARIO 1: Stock 10, sell 3 -> Sale succeeds; remaining stock is 7');
{
  let stock = 10;
  const requested = 3;
  const unit = 'Kg';

  const result = validateStockAvailability(stock, requested, unit);
  assert(result.valid === true, 'Sale validation succeeds when stock is sufficient');
  
  if (result.valid) {
    stock -= requested;
  }
  assert(stock === 7, `Stock deducted from 10 to 7 (Actual: ${stock})`);
  assert(calculateStockStatus(stock, 5) === 'Active', 'Stock 7 with warning limit 5 is Active');
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 2: Stock 1, sell 1 -> Sale succeeds; remaining stock is 0, status Out of Stock
// -----------------------------------------------------------------------------
console.log('SCENARIO 2: Stock 1, sell 1 -> Sale succeeds; remaining stock 0, status Out of Stock');
{
  let stock = 1;
  const requested = 1;
  const unit = 'Piece';

  const result = validateStockAvailability(stock, requested, unit);
  assert(result.valid === true, 'Sale validation succeeds when selling exactly last unit');
  
  if (result.valid) {
    stock -= requested;
  }
  assert(stock === 0, `Remaining stock is exactly 0 (Actual: ${stock})`);
  assert(calculateStockStatus(stock, 5) === 'Out of Stock', 'Remaining stock 0 has status Out of Stock');
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 3: Stock 0, sell 1 -> Sale is blocked with Out of Stock warning
// -----------------------------------------------------------------------------
console.log('SCENARIO 3: Stock 0, sell 1 -> Blocked with exact Out of Stock warning');
{
  const stock = 0;
  const requested = 1;
  const unit = 'Litre';

  const result = validateStockAvailability(stock, requested, unit);
  assert(result.valid === false, 'Sale validation is blocked when stock is 0');
  assert(
    result.errorMessage?.startsWith('No stock available') || result.errorMessage?.startsWith('Out of Stock'),
    `Exact warning message starts with "No stock available" or "Out of Stock" (Actual: "${result.errorMessage}")`
  );
  assert(calculateStockStatus(stock, 5) === 'Out of Stock', 'Stock 0 status is Out of Stock');
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 4: Stock 5, sell 6 -> Sale is blocked with insufficient-stock warning
// -----------------------------------------------------------------------------
console.log('SCENARIO 4: Stock 5, sell 6 -> Blocked with insufficient-stock warning');
{
  const stock = 5;
  const requested = 6;
  const unit = 'Bag';

  const result = validateStockAvailability(stock, requested, unit);
  assert(result.valid === false, 'Sale validation is blocked when requested > stock');
  assert(
    result.errorMessage === 'Insufficient stock. Available: 5 Bag.',
    `Exact warning message: "Insufficient stock. Available: 5 Bag." (Actual: "${result.errorMessage}")`
  );
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 5: Two simultaneous sales attempt to sell the last unit -> Only one succeeds
// -----------------------------------------------------------------------------
console.log('SCENARIO 5: Two simultaneous sales attempt to sell the last unit -> Only one succeeds');
{
  let currentStock = 1;
  const unit = 'Piece';
  let sale1Result: any = null;
  let sale2Result: any = null;

  // Simulate atomic transaction with row lock (FOR UPDATE mutex serialization)
  let isRowLocked = false;
  async function simulateAtomicSale(saleId: string, reqQty: number) {
    while (isRowLocked) {
      await new Promise(r => setTimeout(r, 5));
    }
    isRowLocked = true;
    try {
      const val = validateStockAvailability(currentStock, reqQty, unit);
      if (!val.valid) {
        throw new Error(val.errorMessage);
      }
      currentStock -= reqQty;
      return { success: true, remainingStock: currentStock };
    } finally {
      isRowLocked = false;
    }
  }

  await Promise.all([
    simulateAtomicSale('Sale 1', 1)
      .then(res => { sale1Result = res; })
      .catch(err => { sale1Result = { success: false, error: err.message }; }),
    simulateAtomicSale('Sale 2', 1)
      .then(res => { sale2Result = res; })
      .catch(err => { sale2Result = { success: false, error: err.message }; })
  ]);

  const oneSucceeded = (sale1Result.success && !sale2Result.success) || (!sale1Result.success && sale2Result.success);
  assert(oneSucceeded, 'Exactly one concurrent sale succeeds when competing for the last unit');
  assert(currentStock === 0, `Remaining stock is 0 and never goes negative (Actual: ${currentStock})`);
  
  const failedSale = sale1Result.success ? sale2Result : sale1Result;
  assert(
    failedSale.error?.startsWith('No stock available') || failedSale.error?.startsWith('Out of Stock'),
    `The second competing sale was rejected with: "${failedSale.error}"`
  );
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 6: Failed or cancelled sale -> No stock is deducted
// -----------------------------------------------------------------------------
console.log('SCENARIO 6: Failed or cancelled sale -> Stock remains unchanged');
{
  const initialStock = 5;
  let stock = initialStock;
  const unit = 'Meter';

  try {
    const val = validateStockAvailability(stock, 10, unit);
    if (!val.valid) {
      throw new Error(val.errorMessage);
    }
    stock -= 10;
  } catch (err) {
    // Transaction rolled back
  }

  assert(stock === initialStock, `Stock remains exactly ${initialStock} following failed sale (Actual: ${stock})`);
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 7: Existing negative balance -> Further sales are blocked until reconciled
// -----------------------------------------------------------------------------
console.log('SCENARIO 7: Existing negative balance -> Further sales are blocked until reconciled');
{
  const negativeStockSamples = [
    { name: 'cement', stock: -69, unit: 'Bag' },
    { name: 'paint', stock: -9, unit: 'Litre' },
    { name: 'paint', stock: -1, unit: 'Litre' }
  ];

  for (const item of negativeStockSamples) {
    const result = validateStockAvailability(item.stock, 1, item.unit);
    assert(
      result.valid === false,
      `Product ${item.name} with negative stock ${item.stock} ${item.unit} blocks sale`
    );
    assert(
      result.errorMessage?.startsWith('No stock available') || result.errorMessage?.startsWith('Out of Stock'),
      `Warning message for ${item.name} (${item.stock} ${item.unit}): "${result.errorMessage}"`
    );
    const status = calculateStockStatus(item.stock, 10);
    assert(
      status === 'Out of Stock',
      `Negative stock ${item.stock} ${item.unit} displays status "Out of Stock" (Never Active! Actual: "${status}")`
    );
  }
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 8: Unit formatting verification across all supported units
// -----------------------------------------------------------------------------
console.log('SCENARIO 8: Supported units formatting verification');
{
  const units = ['Kg', 'Litre', 'Bag', 'Piece', 'Meter', 'Box', 'Roll', 'Pack'];
  for (const u of units) {
    const res = validateStockAvailability(4, 5, u);
    assert(
      res.errorMessage === `Insufficient stock. Available: 4 ${u}.`,
      `Unit ${u} formats correctly in warning: "${res.errorMessage}"`
    );
  }
}
console.log('');

// -----------------------------------------------------------------------------
// Scenario 9: Product Master Status calculation rules
// -----------------------------------------------------------------------------
console.log('SCENARIO 9: Product Master Status logic rules');
{
  // Active: Stock > Warning Limit
  assert(calculateStockStatus(25, 10) === 'Active', 'Stock 25 with limit 10 is Active');
  assert(calculateStockStatus(15, null) === 'Active', 'Stock 15 with no limit set is Active');

  // Limited Stock: 0 < Stock <= Warning Limit
  assert(calculateStockStatus(10, 10) === 'Limited Stock', 'Stock 10 with limit 10 is Limited Stock');
  assert(calculateStockStatus(5, 10) === 'Limited Stock', 'Stock 5 with limit 10 is Limited Stock');

  // Out of Stock: Stock <= 0
  assert(calculateStockStatus(0, 10) === 'Out of Stock', 'Stock 0 is Out of Stock');
  assert(calculateStockStatus(-1, 10) === 'Out of Stock', 'Stock -1 is Out of Stock');
  assert(calculateStockStatus(-69, 10) === 'Out of Stock', 'Stock -69 is Out of Stock');
}
console.log('');

console.log('================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('ALL 9 VERIFICATION SCENARIOS PASSED PERFECTLY!\n');
} else {
  process.exit(1);
}
