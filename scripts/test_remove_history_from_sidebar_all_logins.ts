import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { canRoleAccessNavItem, ALL_ROLES } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE HISTORY FROM SIDEBAR FOR ALL LOGINS');
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

const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
const rbacPath = path.resolve('src/utils/rbac.ts');

const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');
const rbacCode = fs.readFileSync(rbacPath, 'utf-8');

console.log('--- 1. Removal from Sidebar allNavItems ---');

check('Sidebar allNavItems does NOT contain any history navigation item', () => {
  const allNavItemsMatch = sidebarCode.match(/const allNavItems:\s*UniversalNavItem\[\]\s*=\s*\[([\s\S]*?)\];/);
  assert(allNavItemsMatch, 'allNavItems must exist in Sidebar.tsx');
  const itemsContent = allNavItemsMatch[1];

  assert(!itemsContent.includes("id: 'history'"), "Sidebar must NOT have item with id: 'history'");
  assert(!itemsContent.includes("id: 'purchase_history'"), "Sidebar must NOT have item with id: 'purchase_history'");
  assert(!itemsContent.includes("path: '/purchases/history'"), "Sidebar must NOT have item with path: '/purchases/history'");
});

check('Sidebar does NOT calculate historyOrdersCount for sidebar badge', () => {
  assert(!sidebarCode.includes('historyOrdersCount'), 'historyOrdersCount must be removed from Sidebar.tsx');
});

console.log('\n--- 2. RBAC Enforcement Across ALL Logins / Roles ---');

check('canRoleAccessNavItem strictly returns false for History across ALL user roles', () => {
  const rolesToTest = [
    'Owner',
    'Admin',
    'Purchase Manager',
    'Warehouse Manager',
    'Cashier',
    'Salesperson',
    'Accountant'
  ];

  for (const role of rolesToTest) {
    assert(
      !canRoleAccessNavItem(role, 'History', 'history'),
      `Role "${role}" must NOT have access to History sidebar item`
    );
    assert(
      !canRoleAccessNavItem(role, 'Purchase History', 'purchase_history'),
      `Role "${role}" must NOT have access to Purchase History sidebar item`
    );
  }
});

check('rbac.ts explicit deny rules block history navigation for all roles', () => {
  assert(
    rbacCode.includes("id === 'history' ||") || rbacCode.includes("id === 'history'"),
    'rbac.ts must explicitly check id === history'
  );
  assert(
    rbacCode.includes("navItemName === 'History'"),
    'rbac.ts must explicitly check navItemName === History'
  );
});

console.log('\n--- 3. Active Nav State Handling ---');

check('Purchases & PO handles active highlight cleanly', () => {
  assert(
    sidebarCode.includes("cur === '/purchases' || cur.startsWith('/purchases')"),
    'Purchases & PO must handle active route without orphaned history item'
  );
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL REMOVE HISTORY FROM SIDEBAR TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

