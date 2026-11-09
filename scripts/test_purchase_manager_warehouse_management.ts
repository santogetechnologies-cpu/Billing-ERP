import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { canAccessRoute, ROLE_ALLOWED_NAV_MENUS, canRoleAccessNavItem } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: WAREHOUSE MANAGEMENT FOR PURCHASE MANAGER');
console.log('================================================================================\n');

let testsPassed = 0;
let totalTests = 0;

function runTest(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. Sidebar Item Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Sidebar Navigation & RBAC ---');

runTest('Purchase Manager CAN access /inventory/warehouses and /warehouses routes', () => {
  assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory/warehouses'), true);
  assert.strictEqual(canAccessRoute('Purchase Manager', '/warehouses'), true);
});

runTest('Purchase Manager has Warehouse in allowed nav menus and RBAC allows nav item', () => {
  const allowed = ROLE_ALLOWED_NAV_MENUS['Purchase Manager'] || [];
  assert.ok(allowed.includes('Warehouse'), 'Purchase Manager nav menus must include Warehouse');
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Warehouse', 'warehouses'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Warehouse', 'warehouse'), true);
});

runTest('Owner, Admin, and Warehouse Manager also have access to Warehouse', () => {
  assert.strictEqual(canRoleAccessNavItem('Owner', 'Warehouse', 'warehouses'), true);
  assert.strictEqual(canRoleAccessNavItem('Admin', 'Warehouse', 'warehouses'), true);
  assert.strictEqual(canRoleAccessNavItem('Warehouse Manager', 'Warehouse', 'warehouses'), true);
});

runTest('Restricted roles (Cashier, Salesperson, Accountant) CANNOT access Warehouse', () => {
  assert.strictEqual(canRoleAccessNavItem('Cashier', 'Warehouse', 'warehouses'), false);
  assert.strictEqual(canRoleAccessNavItem('Salesperson', 'Warehouse', 'warehouses'), false);
  assert.strictEqual(canRoleAccessNavItem('Accountant', 'Warehouse', 'warehouses'), false);
  assert.strictEqual(canAccessRoute('Cashier', '/inventory/warehouses'), false);
  assert.strictEqual(canAccessRoute('Salesperson', '/inventory/warehouses'), false);
  assert.strictEqual(canAccessRoute('Accountant', '/inventory/warehouses'), false);
});

runTest('Sidebar.tsx has Warehouse menu item placed below Products and above Purchases & PO', () => {
  const sidebar = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf8');
  assert.ok(sidebar.includes("id: 'warehouses'"), 'Sidebar must have warehouses item');
  assert.ok(sidebar.includes("name: 'Warehouse'"), 'Sidebar item must be named Warehouse');
  assert.ok(sidebar.includes("path: '/inventory/warehouses'"), 'Sidebar item path must be /inventory/warehouses');
  assert.ok(sidebar.includes('icon: Warehouse'), 'Sidebar item must use Warehouse icon');

  const productsPos = sidebar.indexOf("id: 'products'");
  const warehousePos = sidebar.indexOf("id: 'warehouses'");
  const purchasesPos = sidebar.indexOf("id: 'purchases'");

  assert.ok(productsPos !== -1 && warehousePos !== -1 && purchasesPos !== -1, 'Products, Warehouse, and Purchases items must exist');
  assert.ok(productsPos < warehousePos, 'Warehouse must be placed below Products & Catalog');
  assert.ok(warehousePos < purchasesPos, 'Warehouse must be placed above Purchases & PO');
  assert.ok(!sidebar.includes("name: 'Stock & Godowns'"), 'Stock & Godowns must be removed from Sidebar');
});

runTest('Sidebar.tsx includes active matching for /inventory/warehouses and /warehouses', () => {
  const sidebar = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf8');
  assert.ok(
    sidebar.includes("item.id === 'warehouses' || item.id === 'warehouse'"),
    'Sidebar must check warehouses active state'
  );
  assert.ok(
    sidebar.includes("cur === '/inventory/warehouses' || cur.startsWith('/inventory/warehouses/')"),
    'Sidebar must match /inventory/warehouses'
  );
});

// -----------------------------------------------------------------------------
// 2. Warehouse Model & Service Fields
// -----------------------------------------------------------------------------
console.log('\n--- 2. Warehouse Model & Service ---');

runTest('Warehouse interface in src/types/index.ts includes email', () => {
  const types = fs.readFileSync(path.resolve('src/types/index.ts'), 'utf8');
  assert.ok(types.includes('email?: string;'), 'Warehouse interface must include email field');
});

runTest('companyService.ts supports email in getWarehouses, createWarehouse, and updateWarehouse', () => {
  const service = fs.readFileSync(path.resolve('src/services/companyService.ts'), 'utf8');
  assert.ok(service.includes('email: meta.email || (w as any).email'), 'getWarehouses must map email');
  assert.ok(service.includes('email: warehouse.email || \'\''), 'createWarehouse must persist email');
  assert.ok(service.includes('updates.email !== undefined'), 'updateWarehouse must handle email updates');
});

runTest('companyService.ts deleteWarehouse checks stock, transfers, purchase orders, and inventory transactions', () => {
  const service = fs.readFileSync(path.resolve('src/services/companyService.ts'), 'utf8');
  assert.ok(service.includes("from('stock_balances')"), 'deleteWarehouse must check stock balances');
  assert.ok(service.includes("from('stock_transfers')"), 'deleteWarehouse must check stock transfers');
  assert.ok(service.includes("from('purchase_orders')"), 'deleteWarehouse must check purchase orders');
  assert.ok(service.includes("from('inventory_transactions')"), 'deleteWarehouse must check inventory transactions');
});

// -----------------------------------------------------------------------------
// 3. WarehousesPage.tsx Permissions, Table, and CRUD
// -----------------------------------------------------------------------------
console.log('\n--- 3. WarehousesPage Permissions & CRUD ---');

runTest('Purchase Manager is authorized in canManageWarehouse', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(
    page.includes("profile?.role === 'Purchase Manager'"),
    'canManageWarehouse must include Purchase Manager'
  );
});

runTest('WarehousesPage defaults to table view mode', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(
    page.includes("useState<'cards' | 'table'>('table')"),
    'viewMode must default to table'
  );
});

runTest('Warehouse List Table has all required columns', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  const headers = [
    'Warehouse Name',
    'Warehouse Code',
    'Location',
    'Contact Person',
    'Contact Number',
    'Status',
    'Actions'
  ];
  for (const h of headers) {
    assert.ok(page.includes(h), `Table must have column: ${h}`);
  }
});

runTest('WarehousesPage includes auto-generated unique warehouse code logic', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(
    page.includes('generateUniqueWarehouseCode') || page.includes('WH-'),
    'WarehousesPage must have auto-code generation'
  );
});

runTest('Form modal includes all 7 required fields', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(page.includes('Warehouse Name'), 'Form must have Warehouse Name');
  assert.ok(page.includes('Warehouse Code'), 'Form must have Warehouse Code');
  assert.ok(page.includes('Location / Address') || page.includes('Warehouse Location'), 'Form must have Location / Address');
  assert.ok(page.includes('Contact Person'), 'Form must have Contact Person');
  assert.ok(page.includes('Contact Number') || page.includes('Phone Number'), 'Form must have Contact Number');
  assert.ok(page.includes('Email Address'), 'Form must have Email Address');
  assert.ok(page.includes('Active Status') || page.includes('Warehouse Status'), 'Form must have Status');
});

runTest('Delete modal prevents deletion when warehouse is in use and warns user', () => {
  const page = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(page.includes('checkWarehouseUsage'), 'Page must validate warehouse usage');
  assert.ok(page.includes('Cannot Delete Warehouse') || page.includes('deleteUsageWarning'), 'Modal must show clear warning');
  assert.ok(page.includes('Inactivate Warehouse Instead'), 'Modal must offer Inactivate Warehouse Instead option');
});

// -----------------------------------------------------------------------------
// 4. Purchasing Integration: Active Destination Warehouse Dropdown
// -----------------------------------------------------------------------------
console.log('\n--- 4. Purchasing Integration: Active Destination Warehouse ---');

runTest('NewPurchaseInvoicePage filters destination warehouse dropdown by isActive', () => {
  const poPage = fs.readFileSync(path.resolve('src/pages/purchases/NewPurchaseInvoicePage.tsx'), 'utf8');
  assert.ok(
    poPage.includes('warehouses.filter(w => w.isActive ?? true)'),
    'Destination warehouse dropdown must only show active warehouses'
  );
});

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${testsPassed}`);
console.log(`FAILED:      ${totalTests - testsPassed}`);
console.log('================================================================================\n');

if (testsPassed === totalTests) {
  console.log('ALL WAREHOUSE MANAGEMENT TESTS PASSED (100%)\n');
} else {
  process.exit(1);
}

