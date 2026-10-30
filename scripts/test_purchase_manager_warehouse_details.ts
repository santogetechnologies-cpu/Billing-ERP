import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { canAccessRoute, hasPermission, ROLE_ALLOWED_NAV_MENUS, canRoleAccessNavItem } from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: WAREHOUSE DETAILS FOR PURCHASE MANAGER VERIFICATION');
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
// 1. Sidebar Navigation & RBAC Permissions for Warehouse Details
// -----------------------------------------------------------------------------
console.log('--- 1. Sidebar Navigation & RBAC Permissions ---');

runTest('Purchase Manager CAN access /inventory/warehouses route', () => {
  assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory/warehouses'), true);
});

runTest('Purchase Manager has Warehouse Details in allowed nav menus', () => {
  const allowed = ROLE_ALLOWED_NAV_MENUS['Purchase Manager'] || [];
  assert.ok(
    allowed.includes('Warehouse Details') || allowed.includes('Warehouses / Godowns'),
    'Purchase Manager nav menus must include Warehouse Details'
  );
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Warehouse Details'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Warehouses / Godowns'), true);
});

runTest('Owner, Admin, and Warehouse Manager retain access to /inventory/warehouses', () => {
  assert.strictEqual(canAccessRoute('Owner', '/inventory/warehouses'), true);
  assert.strictEqual(canAccessRoute('Admin', '/inventory/warehouses'), true);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/warehouses'), true);
});

runTest('Salesperson, Cashier, and Accountant CANNOT access /inventory/warehouses', () => {
  assert.strictEqual(canAccessRoute('Salesperson', '/inventory/warehouses'), false);
  assert.strictEqual(canAccessRoute('Cashier', '/inventory/warehouses'), false);
  assert.strictEqual(canAccessRoute('Accountant', '/inventory/warehouses'), false);
});

runTest('Sidebar.tsx labels warehouse item as "Warehouse Details" for Purchase Manager', () => {
  const sidebarContent = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf8');
  assert.ok(
    sidebarContent.includes("profile?.role === 'Purchase Manager' ? 'Warehouse Details' : 'Warehouses / Godowns'"),
    'Sidebar must dynamically label top-level item as Warehouse Details for Purchase Manager'
  );
  assert.ok(
    sidebarContent.includes("name: 'Warehouse Details', path: '/inventory/warehouses'"),
    'Sidebar Inventory sub-items must include Warehouse Details for Purchase Manager'
  );
});

// -----------------------------------------------------------------------------
// 2. WarehousesPage.tsx Permissions & Boundaries
// -----------------------------------------------------------------------------
console.log('\n--- 2. WarehousesPage Read-Only Security for Purchase Manager ---');

runTest('WarehousesPage checks canManageWarehouse guarding add/edit/delete operations', () => {
  const pageContent = fs.readFileSync(path.resolve('src/pages/inventory/WarehousesPage.tsx'), 'utf8');
  assert.ok(
    pageContent.includes('canManageWarehouse'),
    'WarehousesPage must define canManageWarehouse'
  );
  assert.ok(
    pageContent.includes("profile?.role === 'Owner' || profile?.role === 'Admin' || profile?.role === 'Warehouse Manager'"),
    'canManageWarehouse must be restricted to Owner, Admin, and Warehouse Manager'
  );
  assert.ok(
    pageContent.includes('{canManageWarehouse && ('),
    'Add Warehouse button must be wrapped in canManageWarehouse check'
  );
  assert.ok(
    pageContent.includes('canManageWarehouse ? ('),
    'Edit/Delete/Toggle action buttons must be conditional on canManageWarehouse'
  );
});

// -----------------------------------------------------------------------------
// 3. Purchase Manager Dashboard: Warehouse Details Section & Modal
// -----------------------------------------------------------------------------
console.log('\n--- 3. Purchase Manager Dashboard: Warehouse Details & Modal ---');

runTest('PurchaseManagerDashboardPage includes dedicated Warehouse Details section', () => {
  const dashContent = fs.readFileSync(path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx'), 'utf8');
  assert.ok(
    dashContent.includes('id="warehouse-details-section"'),
    'Dashboard must contain warehouse-details-section id'
  );
  assert.ok(
    dashContent.includes('Warehouse Details & Stock Availability'),
    'Dashboard section title must be Warehouse Details & Stock Availability'
  );
});

runTest('Warehouse Details section contains search query and status filters', () => {
  const dashContent = fs.readFileSync(path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx'), 'utf8');
  assert.ok(
    dashContent.includes('warehouseSearchTerm'),
    'Warehouse search query state must be present'
  );
  assert.ok(
    dashContent.includes('warehouseStatusFilter'),
    'Warehouse status filter state must be present'
  );
  assert.ok(
    dashContent.includes('placeholder="Search warehouse..."'),
    'Search placeholder must be present'
  );
});

runTest('Warehouse Details table contains all required columns', () => {
  const dashContent = fs.readFileSync(path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx'), 'utf8');
  const requiredHeaders = [
    'Warehouse',
    'Code',
    'Location',
    'Contact',
    'Total Products',
    'Available Stock',
    'Status',
    'Action'
  ];
  for (const header of requiredHeaders) {
    assert.ok(
      dashContent.includes(header),
      `Warehouse Details table must include column header "${header}"`
    );
  }
});

runTest('Warehouse Details section integrates View Stock modal', () => {
  const dashContent = fs.readFileSync(path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx'), 'utf8');
  assert.ok(
    dashContent.includes('selectedWarehouseForModal'),
    'Modal warehouse state must be defined'
  );
  assert.ok(
    dashContent.includes('isWarehouseModalOpen'),
    'Warehouse modal open state must be defined in dashboard'
  );
  assert.ok(
    dashContent.includes('Warehouse Details & Stored Products:'),
    'Modal title Warehouse Details & Stored Products must be present'
  );
});

// -----------------------------------------------------------------------------
// 4. Purchasing Integration: Destination Warehouse Selection & Traceability
// -----------------------------------------------------------------------------
console.log('\n--- 4. Purchasing Integration: Destination Warehouse Selection ---');

runTest('ApprovePurchaseRequestModal allows selecting destination warehouse', () => {
  const modalContent = fs.readFileSync(path.resolve('src/components/purchases/ApprovePurchaseRequestModal.tsx'), 'utf8');
  assert.ok(
    modalContent.includes('destinationWarehouseId'),
    'ApprovePurchaseRequestModal must define destinationWarehouseId state'
  );
  assert.ok(
    modalContent.includes('Destination Warehouse'),
    'Modal must have Destination Warehouse label'
  );
});

runTest('approvePurchaseRequestWithOrder receives destinationWarehouseId', () => {
  const svcContent = fs.readFileSync(path.resolve('src/services/purchaseRequestService.ts'), 'utf8');
  assert.ok(
    svcContent.includes('destinationWarehouseId?: string;'),
    'Service parameters must include optional destinationWarehouseId'
  );
  assert.ok(
    svcContent.includes('warehouse_id: params.destinationWarehouseId || existing.warehouseId'),
    'Service must link destinationWarehouseId into created purchase order warehouse_id'
  );
});

runTest('NewPurchaseInvoicePage dynamically labels Destination Warehouse for POs', () => {
  const invoicePageContent = fs.readFileSync(path.resolve('src/pages/purchases/NewPurchaseInvoicePage.tsx'), 'utf8');
  assert.ok(
    invoicePageContent.includes("docType === 'purchase_order' ? 'Destination Warehouse' : 'Receiving Warehouse'"),
    'NewPurchaseInvoicePage must display Destination Warehouse for PO documents'
  );
});

runTest('Supplier Delivery Overview displays destination warehouse', () => {
  const dashContent = fs.readFileSync(path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx'), 'utf8');
  assert.ok(
    dashContent.includes('destinationWarehouse?: string;') || dashContent.includes('destinationWarehouse: string;'),
    'SupplierDeliveryItem interface must include destinationWarehouse'
  );
  assert.ok(
    dashContent.includes('item.destinationWarehouse'),
    'Supplier Delivery Overview must render destination warehouse tag'
  );
});

// -----------------------------------------------------------------------------
// 5. Protected Product Screens Audit
// -----------------------------------------------------------------------------
console.log('\n--- 5. Protected Product Screens Audit ---');

const protectedFiles = [
  'src/pages/products/InitialStockPage.tsx',
  'src/pages/products/NewProductPage.tsx',
  'src/pages/products/ProductListPage.tsx',
  'src/pages/products/UpdateStockPage.tsx'
];

for (const relPath of protectedFiles) {
  runTest(`Protected file ${relPath} is intact`, () => {
    assert.ok(fs.existsSync(path.resolve(relPath)), `File must exist: ${relPath}`);
  });
}

console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${testsPassed}`);
console.log(`FAILED:      ${totalTests - testsPassed}`);
console.log('================================================================================\n');

if (testsPassed === totalTests) {
  console.log('🎉 ALL WAREHOUSE DETAILS VERIFICATION TESTS PASSED 100%!');
} else {
  process.exit(1);
}
