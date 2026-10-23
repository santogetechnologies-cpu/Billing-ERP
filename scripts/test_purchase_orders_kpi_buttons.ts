// Test: Purchase Orders KPI Cards Button Functionality
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE ORDERS KPI CARDS BUTTON FUNCTIONALITY');
console.log('================================================================================\n');

let total = 0;
let passed = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    process.exitCode = 1;
  }
}

test('StatCard.tsx supports isSelected and selectedColor props', () => {
  const statCardPath = path.resolve('src/components/common/StatCard.tsx');
  const content = fs.readFileSync(statCardPath, 'utf-8');

  assert(content.includes('isSelected?: boolean'), 'StatCardProps must include isSelected');
  assert(content.includes('selectedColor?:'), 'StatCardProps must include selectedColor');
  assert(content.includes('activeSelectedClass'), 'StatCard must apply activeSelectedClass');
});

test('PurchaseOrdersPage.tsx implements handleCardFilterClick with smooth scroll', () => {
  const pagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert(content.includes('handleCardFilterClick'), 'PurchaseOrdersPage must implement handleCardFilterClick');
  assert(content.includes('ordersTableRef'), 'PurchaseOrdersPage must define ordersTableRef');
  assert(content.includes('scrollIntoView'), 'PurchaseOrdersPage must trigger scrollIntoView on filter click');
});

test('PurchaseOrdersPage.tsx KPI cards are interactive and bound to filter handler', () => {
  const pagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert(content.includes("onClick={() => handleCardFilterClick('Active')}"), 'Active Orders card must call handleCardFilterClick');
  assert(content.includes("isSelected={tabFilter === 'Active'}"), 'Active Orders card must set isSelected based on tabFilter');

  assert(content.includes("onClick={() => handleCardFilterClick('Items to Deliver')}"), 'Items to Deliver card must be clickable');
  assert(content.includes("isSelected={tabFilter === 'Items to Deliver'}"), 'Items to Deliver card must set isSelected');

  assert(content.includes("onClick={() => handleCardFilterClick('Overdue')}"), 'Overdue Deliveries card must be clickable');
  assert(content.includes("isSelected={tabFilter === 'Overdue'}"), 'Overdue Deliveries card must set isSelected');

  assert(content.includes("onClick={() => handleCardFilterClick('Completed')}"), 'Completed Orders card must be clickable');
  assert(content.includes("isSelected={tabFilter === 'Completed'}"), 'Completed Orders card must set isSelected');
});

test('PurchaseOrdersPage.tsx filters support Items to Deliver and Overdue', () => {
  const pagePath = path.resolve('src/pages/purchases/PurchaseOrdersPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert(content.includes("tabFilter === 'Items to Deliver'"), 'filteredOrders must support Items to Deliver filter');
  assert(content.includes("tabFilter === 'Overdue'"), 'filteredOrders must support Overdue filter');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('================================================================================');
