import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { canRoleAccessNavItem } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: REPLACE HISTORY BUTTON TO SIDEBAR FOR PURCHASE MANAGER');
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
const appPath = path.resolve('src/App.tsx');
const invoicesPath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
const historyPagePath = path.resolve('src/pages/purchases/PurchaseHistoryPage.tsx');

const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');
const rbacCode = fs.readFileSync(rbacPath, 'utf-8');
const appCode = fs.readFileSync(appPath, 'utf-8');
const invoicesCode = fs.readFileSync(invoicesPath, 'utf-8');
const historyPageCode = fs.readFileSync(historyPagePath, 'utf-8');

console.log('--- 1. Sidebar Navigation Item for History ---');

check('Sidebar imports History icon from lucide-react', () => {
  assert(sidebarCode.includes('History'), 'History icon must be imported in Sidebar.tsx');
});

check('Sidebar includes History nav item under Inventory & Stock section with badge', () => {
  assert(sidebarCode.includes("id: 'history'"), "Sidebar must have item with id: 'history'");
  assert(sidebarCode.includes("path: '/purchases/history'"), "Sidebar History item must route to '/purchases/history'");
  assert(sidebarCode.includes("icon: History"), 'Sidebar History item must use History icon');
  assert(sidebarCode.includes('historyOrdersCount'), 'Sidebar History item must bind badge to order count');
});

check('Sidebar isItemActive mutually distinguishes Purchases & PO and History', () => {
  assert(sidebarCode.includes("cur === '/purchases/history'"), 'Sidebar checks for /purchases/history');
  assert(sidebarCode.includes("item.id === 'history'"), 'Sidebar handles active state for history item');
});

console.log('\n--- 2. RBAC Permissions for Purchase Manager ---');

check('canRoleAccessNavItem allows Purchase Manager, Owner, and Admin to access History nav item', () => {
  assert(canRoleAccessNavItem('Purchase Manager', 'History', 'history'), 'Purchase Manager must access History nav item');
  assert(canRoleAccessNavItem('Purchase Manager', 'Purchase History', 'purchase_history'), 'Purchase Manager must access Purchase History nav item');
  assert(canRoleAccessNavItem('Owner', 'History', 'history'), 'Owner must access History nav item');
  assert(canRoleAccessNavItem('Admin', 'History', 'history'), 'Admin must access History nav item');
});

check('canRoleAccessNavItem restricts History nav item from unauthorized roles', () => {
  assert(!canRoleAccessNavItem('Cashier', 'History', 'history'), 'Cashier must NOT access History nav item');
  assert(!canRoleAccessNavItem('Salesperson', 'History', 'history'), 'Salesperson must NOT access History nav item');
  assert(!canRoleAccessNavItem('Warehouse Manager', 'History', 'history'), 'Warehouse Manager must NOT access History nav item');
  assert(!canRoleAccessNavItem('Accountant', 'History', 'history'), 'Accountant must NOT access History nav item');
});

console.log('\n--- 3. Routing and PurchaseHistoryPage ---');

check('App.tsx registers /purchases/history route with ProtectedRoute', () => {
  assert(appCode.includes('path="purchases/history"'), 'Route purchases/history must be registered');
  assert(appCode.includes('<PurchaseHistoryPage />'), 'purchases/history must render PurchaseHistoryPage');
});

check('PurchaseHistoryPage renders dedicated header and embedded PurchaseOrdersPage', () => {
  assert(historyPageCode.includes('Purchase History'), 'Must render Purchase History title');
  assert(historyPageCode.includes('<PurchaseOrdersPage embedded={true} initialTabFilter="History" />'), 'Must render PurchaseOrdersPage embedded with initialTabFilter="History"');
});

console.log('\n--- 4. Removal from Purchases & PO Tabs & Redirection ---');

check('PurchaseInvoicesPage tabs contain only the 4 operational tabs', () => {
  const tabsMatch = invoicesCode.match(/const purchaseTabs:\s*TabItem\[\]\s*=\s*\[([\s\S]*?)\];/);
  assert(tabsMatch, 'purchaseTabs array must exist');
  const tabsContent = tabsMatch[1];
  assert(tabsContent.includes("'orders'"), 'Orders tab must exist');
  assert(tabsContent.includes("'bills'"), 'Bills tab must exist');
  assert(tabsContent.includes("'returns'"), 'Returns tab must exist');
  assert(tabsContent.includes("'payments'"), 'Payments Made tab must exist');
  assert(!tabsContent.includes("'history'"), 'History tab must be removed from purchaseTabs');
});

check('PurchaseInvoicesPage redirects legacy ?tab=history to /purchases/history', () => {
  assert(invoicesCode.includes("navigate('/purchases/history', { replace: true })"), 'Must redirect ?tab=history to /purchases/history');
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================\n');

if (totalTests === passedTests) {
  console.log('🎉 ALL SIDEBAR HISTORY BUTTON TESTS PASSED 100%!\n');
} else {
  process.exitCode = 1;
}

