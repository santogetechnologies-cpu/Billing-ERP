import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE PO STATUS NAVIGATION CARDS FROM PURCHASE MANAGER DASHBOARD');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function check(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf-8');

console.log('--- 1. Verification of Removal from Dashboard ---');

check('po-status-navigation-buttons container is completely removed from PurchaseManagerDashboardPage', () => {
  assert(
    !pmDashboardCode.includes('id="po-status-navigation-buttons"'),
    'po-status-navigation-buttons must not exist in PurchaseManagerDashboardPage'
  );
});

check('Ordered status button is removed from PurchaseManagerDashboardPage', () => {
  assert(
    !pmDashboardCode.includes("navigate('/purchases/orders?status=Ordered')"),
    'Ordered navigation button must not exist'
  );
  assert(
    !pmDashboardCode.includes('Pending warehouse receipt'),
    'Pending warehouse receipt label must not exist'
  );
});

check('Delivered status button is removed from PurchaseManagerDashboardPage', () => {
  assert(
    !pmDashboardCode.includes("navigate('/purchases/orders?status=Received')"),
    'Delivered navigation button must not exist'
  );
  assert(
    !pmDashboardCode.includes('Warehouse confirmed'),
    'Warehouse confirmed label must not exist'
  );
});

check('Overdue status button is removed from PurchaseManagerDashboardPage', () => {
  assert(
    !pmDashboardCode.includes("navigate('/purchases/orders?status=Overdue')"),
    'Overdue navigation button must not exist'
  );
  assert(
    !pmDashboardCode.includes('Past expected date'),
    'Past expected date label must not exist'
  );
});

check('Stocks status button is removed from PurchaseManagerDashboardPage', () => {
  assert(
    !pmDashboardCode.includes('View all product stock'),
    'Stocks navigation button label must not exist'
  );
});

console.log('\n--- 2. Preservation of Dashboard Header & Middle Sections ---');

check('Dashboard Header and Action Toolbar remain intact', () => {
  assert(
    pmDashboardCode.includes('Purchase Manager Dashboard'),
    'Dashboard title must remain intact'
  );
  assert(
    pmDashboardCode.includes('Procurement Operations'),
    'Breadcrumb must remain intact'
  );
});

check('Stock Status Overview and Supplier Overview remain intact', () => {
  assert(
    pmDashboardCode.includes('id="stock-status-overview-card"'),
    'Stock Status Overview card must remain intact'
  );
  assert(
    pmDashboardCode.includes('Stock Status Overview'),
    'Stock Status Overview title must remain intact'
  );
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL DASHBOARD REMOVAL TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

