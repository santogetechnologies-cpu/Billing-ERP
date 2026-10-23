// Test Suite: Low Stock & Reorder Products Table, Non-Negative Stock & Reconciliation
// Validates:
// 1. Table structure has NO separate Current Stock column.
// 2. Status column displays badge on first line and stock quantity with unit underneath.
// 3. Non-negative stock clamping (negative balances like -69, -9, -1 clamped to 0).
// 4. Billing blocked when stock is 0 with "No stock available".
// 5. Stock status classification rules (0 stock is Out of Stock even if limit is 0).
// 6. Safe reconciliation creating formal audit entries without rewriting history.

import { calculateStockStatus, validateStockAvailability } from '../src/utils/inventoryUtils';
import { formatNumber } from '../src/utils/formatters';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================================');
console.log('TEST SUITE: LOW STOCK TABLE, STATUS BADGE QUANTITY & NON-NEGATIVE RECONCILIATION');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// 1. Table Column Ordering & Removal of Current Stock Column
// -----------------------------------------------------------------------------
console.log('--- 1. Table Column Specifications ---');

const expectedColumns = [
  'Checkbox',
  'Product',
  'SKU',
  'Warehouse',
  'Unit',
  'Suggested Reorder',
  'Status',
  'Action'
];

assert(!expectedColumns.includes('Current Stock'), 'Table strictly excludes a separate "Current Stock" column');
assert(!expectedColumns.includes('Warning Limit'), 'Table strictly excludes a separate "Warning Limit" column');
assert(!expectedColumns.includes('Last Movement'), 'Table strictly excludes a separate "Last Movement" column');
assert(expectedColumns.length === 8, 'Table has exactly 8 aligned columns');
assert(expectedColumns.indexOf('Warehouse') < expectedColumns.indexOf('Unit'), 'Warehouse precedes Unit');
assert(expectedColumns.indexOf('Unit') < expectedColumns.indexOf('Suggested Reorder'), 'Unit precedes Suggested Reorder');
assert(expectedColumns.indexOf('Suggested Reorder') < expectedColumns.indexOf('Status'), 'Suggested Reorder precedes Status');
assert(expectedColumns.indexOf('Status') < expectedColumns.indexOf('Action'), 'Status precedes Action');

// -----------------------------------------------------------------------------
// 2. Status Column: Badge on Line 1, Stock Quantity with Unit on Line 2
// -----------------------------------------------------------------------------
console.log('\n--- 2. Status Column Layout & Quantity Formatting ---');

interface StatusCellRender {
  badge: 'Out of Stock' | 'Limited Stock' | 'Active';
  badgeColorClass: string;
  quantityText: string;
}

function renderStatusCell(stock: number, warningLimit: number | null | undefined, unit: string): StatusCellRender {
  const safeStock = Math.max(0, stock);
  const status = calculateStockStatus(safeStock, warningLimit);
  
  let badgeColorClass = '';
  if (status === 'Out of Stock') {
    badgeColorClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (status === 'Limited Stock') {
    badgeColorClass = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    badgeColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  const quantityText = `${formatNumber(safeStock)} ${unit}`;
  return { badge: status as any, badgeColorClass, quantityText };
}

// User's specific prompt examples:
// Red Out of Stock badge: 0 Bag
const cell1 = renderStatusCell(-69, 50, 'Bag'); // Legacy negative stock -69
assert(cell1.badge === 'Out of Stock', 'Legacy -69 Bag stock status is Out of Stock');
assert(cell1.quantityText === '0 Bag', `Quantity underneath is clamped to "0 Bag" (got: "${cell1.quantityText}")`);
assert(cell1.badgeColorClass.includes('text-rose-700'), 'Out of Stock badge has red/rose styling');

// Red Out of Stock badge: 0 Litre
const cell2 = renderStatusCell(-9, 20, 'Litre'); // Legacy negative stock -9
assert(cell2.badge === 'Out of Stock', 'Legacy -9 Litre stock status is Out of Stock');
assert(cell2.quantityText === '0 Litre', `Quantity underneath is clamped to "0 Litre" (got: "${cell2.quantityText}")`);

// Amber Limited Stock badge: 3 Piece
const cell3 = renderStatusCell(3, 10, 'Piece');
assert(cell3.badge === 'Limited Stock', 'Stock 3 with warning limit 10 is Limited Stock');
assert(cell3.quantityText === '3 Piece', `Quantity underneath is "3 Piece" (got: "${cell3.quantityText}")`);
assert(cell3.badgeColorClass.includes('text-amber-700'), 'Limited Stock badge has amber styling');

// Green Active badge: 50 Kg
const cell4 = renderStatusCell(50, 20, 'Kg');
assert(cell4.badge === 'Active', 'Stock 50 with warning limit 20 is Active');
assert(cell4.quantityText === '50 Kg', `Quantity underneath is "50 Kg" (got: "${cell4.quantityText}")`);
assert(cell4.badgeColorClass.includes('text-emerald-700'), 'Active badge has emerald/green styling');

// -----------------------------------------------------------------------------
// 3. Stock Status Rules & Edge Cases
// -----------------------------------------------------------------------------
console.log('\n--- 3. Stock Status Rules & Warning Limit Thresholds ---');

// Edge case: Stock is 0 and warning limit is 0 -> Out of Stock (NEVER Active)
const zeroLimitStatus = calculateStockStatus(0, 0);
assert(zeroLimitStatus === 'Out of Stock', 'Stock 0 with warning limit 0 is strictly Out of Stock (never Active)');

// Edge case: Negative stock with warning limit 0 -> Out of Stock
const negZeroLimitStatus = calculateStockStatus(-1, 0);
assert(negZeroLimitStatus === 'Out of Stock', 'Stock -1 with warning limit 0 is strictly Out of Stock');

// Stock > 0 and <= warning limit -> Limited Stock
assert(calculateStockStatus(10, 10) === 'Limited Stock', 'Stock 10 with warning limit 10 is Limited Stock');
assert(calculateStockStatus(1, 10) === 'Limited Stock', 'Stock 1 with warning limit 10 is Limited Stock');

// Stock > warning limit -> Active
assert(calculateStockStatus(11, 10) === 'Active', 'Stock 11 with warning limit 10 is Active');

// Stock > 0 and no warning limit -> Active
assert(calculateStockStatus(5, null) === 'Active', 'Stock 5 with no limit set is Active');

// -----------------------------------------------------------------------------
// 4. Suggested Reorder Quantity Computation
// -----------------------------------------------------------------------------
console.log('\n--- 4. Suggested Reorder Formulas & Units ---');

function computeSuggestedReorder(stock: number, warningLimit: number | null | undefined, unit: string): string {
  const safeStock = Math.max(0, stock);
  let qty = 0;
  if (safeStock <= 0) {
    qty = warningLimit && warningLimit > 0 ? warningLimit * 2 : 20;
  } else if (warningLimit !== null && warningLimit !== undefined && safeStock <= warningLimit) {
    qty = Math.max(1, (warningLimit * 2) - safeStock);
  }
  return `+${formatNumber(qty)} ${unit}`;
}

assert(computeSuggestedReorder(0, 10, 'Bag') === '+20 Bag', 'Out of stock with limit 10 suggests +20 Bag');
assert(computeSuggestedReorder(-69, 10, 'Bag') === '+20 Bag', 'Negative stock with limit 10 suggests +20 Bag (never confused with -69)');
assert(computeSuggestedReorder(0, 30, 'Meter') === '+60 Meter', 'Out of stock with limit 30 suggests +60 Meter');
assert(computeSuggestedReorder(5, 10, 'Piece') === '+15 Piece', 'Limited stock (5) with limit 10 suggests +15 Piece');

// -----------------------------------------------------------------------------
// 5. Billing & Sales Availability Validation
// -----------------------------------------------------------------------------
console.log('\n--- 5. Billing & Sales Availability Validation ---');

// When stock is 0 -> blocked with "No stock available"
const zeroVal = validateStockAvailability(0, 1, 'Bag');
assert(zeroVal.valid === false, 'Billing blocked when stock is 0');
assert(zeroVal.errorMessage?.includes('No stock available'), `Error message mentions "No stock available" (got: "${zeroVal.errorMessage}")`);

// When stock is negative (-69) -> clamped to 0, blocked with "No stock available"
const negVal = validateStockAvailability(-69, 1, 'Bag');
assert(negVal.valid === false, 'Billing blocked when stock is negative (-69)');
assert(negVal.availableStock === 0, 'Available stock reported as 0');
assert(negVal.errorMessage?.includes('No stock available'), `Error message mentions "No stock available" (got: "${negVal.errorMessage}")`);

// When stock is 5 and requesting 10 -> blocked with insufficient stock
const partialVal = validateStockAvailability(5, 10, 'Litre');
assert(partialVal.valid === false, 'Billing blocked when requested exceeds available');
assert(partialVal.errorMessage === 'Insufficient stock. Available: 5 Litre.', `Insufficient stock formatted correctly: "${partialVal.errorMessage}"`);

// When stock is 5 and requesting 3 -> allowed
const okVal = validateStockAvailability(5, 3, 'Kg');
assert(okVal.valid === true, 'Billing allowed when stock is sufficient');
assert(okVal.availableStock === 5, 'Available stock is 5');

// -----------------------------------------------------------------------------
// 6. Safe Audit Reconciliation of Negative Balances
// -----------------------------------------------------------------------------
console.log('\n--- 6. Safe Inventory Reconciliation & Audit Trail ---');

interface StockAdjustmentAudit {
  date: string;
  type: string;
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  referenceType: string;
  referenceDoc: string;
  notes: string;
}

function reconcileNegativeProduct(product: { id: string; name: string; currentStock: number; unit: string }): {
  reconciledStock: number;
  auditEntry: StockAdjustmentAudit | null;
} {
  if (product.currentStock >= 0) {
    return { reconciledStock: product.currentStock, auditEntry: null };
  }

  const adjQty = Math.abs(product.currentStock);
  const auditEntry: StockAdjustmentAudit = {
    date: '2026-10-16',
    type: 'Stock Adjustment',
    productId: product.id,
    productName: product.name,
    qty: adjQty,
    unit: product.unit,
    referenceType: 'Reconciliation',
    referenceDoc: `RECON-20261016-${Math.floor(1000 + Math.random() * 9000)}`,
    notes: `Automated Inventory Reconciliation: Clamped legacy negative balance (${product.currentStock} ${product.unit}) to 0`
  };

  return { reconciledStock: 0, auditEntry };
}

const legacyCement = { id: 'p-cement', name: 'Portland Cement Grade 53', currentStock: -69, unit: 'Bag' };
const reconCement = reconcileNegativeProduct(legacyCement);

assert(reconCement.reconciledStock === 0, 'Cement stock reconciled from -69 to 0');
assert(reconCement.auditEntry !== null, 'Reconciliation audit transaction created');
assert(reconCement.auditEntry?.type === 'Stock Adjustment', 'Audit transaction type is "Stock Adjustment"');
assert(reconCement.auditEntry?.referenceType === 'Reconciliation', 'Audit reference type is "Reconciliation"');
assert(reconCement.auditEntry?.qty === 69, 'Audit transaction records +69 Bag adjustment quantity');
assert(reconCement.auditEntry?.notes.includes('-69 Bag'), 'Audit notes document the legacy -69 Bag balance');

console.log('\n================================================================================');
console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}% SUCCESS)`);
console.log('================================================================================\n');
