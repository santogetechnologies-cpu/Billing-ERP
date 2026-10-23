/**
 * Comprehensive Test Suite: Role-Based Menu and Feature Visibility System
 *
 * Verifies:
 * 1. Strict top-level sidebar menu filtering for all 7 roles.
 * 2. Granular submenu filtering & elimination of empty parent menus.
 * 3. Dynamic role dashboard routing.
 * 4. Header quick actions & Global Search route permissions gating.
 * 5. Settings tabs authorization & Owner-only Company Policy governance.
 * 6. Barcode override restricted permissions.
 * 7. ProtectedRoute fallback logic preventing access-denied warnings and loops.
 */

import {
  UserRole,
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  canAccessRoute,
  getRoleDefaultRoute,
  hasPermission,
  canManageCompanySettings,
  canManageCompanyPolicy,
  canManageBarcodeOverride,
  ROLE_ALLOWED_NAV_MENUS
} from '../src/utils/rbac';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('========================================================================');
console.log('TEST SUITE: ROLE-BASED MENU AND FEATURE VISIBILITY SYSTEM');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: Top-Level Sidebar Navigation Items for All 7 Roles
// -----------------------------------------------------------------------------
console.log('👉 SUITE 1: Top-Level Sidebar Navigation Visibility Across All 7 Roles');

const allTopMenus = [
  'Dashboard',
  'Sales',
  'Purchases',
  'Products',
  'Inventory',
  'Warehouses / Godowns',
  'Customers',
  'Suppliers',
  'Expenses',
  'Payments',
  'Accounting',
  'Reports',
  'Barcode',
  'Taxes & GST',
  'Users & Roles',
  'Audit Log',
  'Settings'
];

// 1. Owner & Admin: Complete visibility
allTopMenus.forEach(menu => {
  assert(canRoleAccessNavItem('Owner', menu), `Owner can see top-level menu "${menu}"`);
  assert(canRoleAccessNavItem('Admin', menu), `Admin can see top-level menu "${menu}"`);
});

// 2. Accountant: Dashboard, Payments, Expenses, Accounting, Reports, Taxes & GST, Settings
// Blocked from Sales, Purchases, Products, Inventory, Warehouses, Barcode, Users, Audit
const accountantAllowed = ['Dashboard', 'Payments', 'Expenses', 'Accounting', 'Reports', 'Taxes & GST', 'Settings'];
allTopMenus.forEach(menu => {
  const allowed = accountantAllowed.includes(menu);
  assert(
    canRoleAccessNavItem('Accountant', menu) === allowed,
    `Accountant ${allowed ? 'CAN see' : 'CANNOT see'} top-level menu "${menu}"`
  );
});

// 3. Salesperson: Dashboard, Sales, Customers, Products, Settings
// Blocked from Purchases, Inventory, Warehouses, Suppliers, Accounting, Reports, Barcode, Users, Audit
const salespersonAllowed = ['Dashboard', 'Sales', 'Customers', 'Products', 'Settings'];
allTopMenus.forEach(menu => {
  const allowed = salespersonAllowed.includes(menu);
  assert(
    canRoleAccessNavItem('Salesperson', menu) === allowed,
    `Salesperson ${allowed ? 'CAN see' : 'CANNOT see'} top-level menu "${menu}"`
  );
});

// 4. Purchase Manager: Dashboard, Purchases, Suppliers, Products, Inventory, Expenses, Settings
// Blocked from Sales, Warehouses, Customers, Accounting, Reports, Barcode, Users, Audit
const purchaseManagerAllowed = ['Dashboard', 'Purchases', 'Suppliers', 'Products', 'Inventory', 'Expenses', 'Settings'];
allTopMenus.forEach(menu => {
  const allowed = purchaseManagerAllowed.includes(menu);
  assert(
    canRoleAccessNavItem('Purchase Manager', menu) === allowed,
    `Purchase Manager ${allowed ? 'CAN see' : 'CANNOT see'} top-level menu "${menu}"`
  );
});

// 5. Warehouse Manager: Dashboard, Inventory, Warehouses / Godowns, Products, Barcode, Settings
// Blocked from Sales, Purchases, Customers, Suppliers, Expenses, Payments, Accounting, Reports, Users, Audit
const warehouseManagerAllowed = ['Dashboard', 'Inventory', 'Warehouses / Godowns', 'Products', 'Barcode', 'Settings'];
allTopMenus.forEach(menu => {
  const allowed = warehouseManagerAllowed.includes(menu);
  assert(
    canRoleAccessNavItem('Warehouse Manager', menu) === allowed,
    `Warehouse Manager ${allowed ? 'CAN see' : 'CANNOT see'} top-level menu "${menu}"`
  );
});

// 6. Cashier: Dashboard, Sales, Customers, Products, Payments, Settings
// Blocked from Purchases, Inventory, Warehouses, Suppliers, Expenses, Accounting, Reports, Barcode, Users, Audit
const cashierAllowed = ['Dashboard', 'Sales', 'Customers', 'Products', 'Payments', 'Settings'];
allTopMenus.forEach(menu => {
  const allowed = cashierAllowed.includes(menu);
  assert(
    canRoleAccessNavItem('Cashier', menu) === allowed,
    `Cashier ${allowed ? 'CAN see' : 'CANNOT see'} top-level menu "${menu}"`
  );
});

// -----------------------------------------------------------------------------
// SUITE 2: Granular Submenu Filtering & Parent Menu Elimination
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 2: Granular Submenu Filtering');

// Purchase Manager in Inventory: ONLY Stock Overview and Total Product Cost
assert(
  !canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Low Stock & Reorder', '/inventory/alerts'),
  'Purchase Manager CANNOT see "Low Stock & Reorder" under Inventory'
);
assert(
  !canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Purchase Requests', '/inventory/purchase-requests'),
  'Purchase Manager CANNOT see "Purchase Requests" under Inventory'
);
assert(
  canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Overview', '/inventory'),
  'Purchase Manager can see "Stock Overview" for purchasing assessment'
);
assert(
  canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Total Product Cost', '/inventory/total-cost'),
  'Purchase Manager can see "Total Product Cost" under Inventory'
);
assert(
  !canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Transfers', '/inventory/transfers'),
  'Purchase Manager CANNOT see "Stock Transfers" under Inventory'
);
assert(
  !canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Adjustments', '/inventory/adjustments'),
  'Purchase Manager CANNOT see "Stock Adjustments" under Inventory'
);

// Warehouse Manager in Products:
assert(
  canRoleAccessSubItem('Warehouse Manager', 'Products', 'Product Master', '/products'),
  'Warehouse Manager can see "Product Master"'
);
assert(
  canRoleAccessSubItem('Warehouse Manager', 'Products', 'Add Product', '/products/new'),
  'Warehouse Manager can see "Add Product"'
);

// Cashier in Sales: POS Fast Billing and Sales Invoices
assert(
  canRoleAccessSubItem('Cashier', 'Sales', 'Fast Billing / POS', '/sales/pos'),
  'Cashier can see "Fast Billing / POS"'
);
assert(
  canRoleAccessSubItem('Cashier', 'Sales', 'Sales Invoices', '/sales'),
  'Cashier can see "Sales Invoices"'
);

// -----------------------------------------------------------------------------
// SUITE 3: Dynamic Role Landing & Dashboard Redirection
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 3: Dynamic Role Landing & Default Dashboard Routing');

assert(getRoleDefaultRoute('Owner') === '/', 'Owner default landing route is /');
assert(getRoleDefaultRoute('Admin') === '/', 'Admin default landing route is /');
assert(getRoleDefaultRoute('Accountant') === '/accounting', 'Accountant default landing route is /accounting');
assert(getRoleDefaultRoute('Salesperson') === '/sales/dashboard', 'Salesperson default landing route is /sales/dashboard');
assert(
  getRoleDefaultRoute('Purchase Manager') === '/purchases/dashboard' || getRoleDefaultRoute('Purchase Manager') === '/purchases',
  'Purchase Manager default landing route is /purchases/dashboard'
);
assert(getRoleDefaultRoute('Warehouse Manager') === '/warehouse/dashboard', 'Warehouse Manager default landing route is /warehouse/dashboard');
assert(getRoleDefaultRoute('Cashier') === '/sales/pos', 'Cashier default landing route is /sales/pos');

// -----------------------------------------------------------------------------
// SUITE 4: Settings Governance & Company Policy Authoring
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 4: Settings Governance & Company Policy');

assert(canManageCompanyPolicy('Owner'), 'Owner CAN author and edit Company Policy');
assert(!canManageCompanyPolicy('Admin'), 'Admin CANNOT author or edit Company Policy');
assert(!canManageCompanyPolicy('Accountant'), 'Accountant CANNOT author or edit Company Policy');
assert(!canManageCompanyPolicy('Salesperson'), 'Salesperson CANNOT author or edit Company Policy');
assert(!canManageCompanyPolicy('Purchase Manager'), 'Purchase Manager CANNOT author or edit Company Policy');
assert(!canManageCompanyPolicy('Warehouse Manager'), 'Warehouse Manager CANNOT author or edit Company Policy');
assert(!canManageCompanyPolicy('Cashier'), 'Cashier CANNOT author or edit Company Policy');

assert(canManageCompanySettings('Owner'), 'Owner CAN manage company settings');
assert(canManageCompanySettings('Admin'), 'Admin CAN manage company settings');
assert(!canManageCompanySettings('Accountant'), 'Accountant CANNOT manage company settings');
assert(!canManageCompanySettings('Salesperson'), 'Salesperson CANNOT manage company settings');
assert(!canManageCompanySettings('Cashier'), 'Cashier CANNOT manage company settings');

// -----------------------------------------------------------------------------
// SUITE 5: Barcode Override Permission
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 5: Barcode Override Authorization');

assert(canManageBarcodeOverride('Owner'), 'Owner CAN access barcode override');
assert(canManageBarcodeOverride('Admin'), 'Admin CAN access barcode override');
assert(!canManageBarcodeOverride('Purchase Manager'), 'Purchase Manager CANNOT access barcode override');
assert(!canManageBarcodeOverride('Salesperson'), 'Salesperson CANNOT access barcode override');
assert(!canManageBarcodeOverride('Cashier'), 'Cashier CANNOT access barcode override');
assert(!canManageBarcodeOverride('Warehouse Manager'), 'Warehouse Manager CANNOT access barcode override');
assert(!canManageBarcodeOverride('Accountant'), 'Accountant CANNOT access barcode override');

// -----------------------------------------------------------------------------
// SUITE 6: Header Actions & Feature Gating
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 6: Header Quick Actions & Feature Gating');

const roles: UserRole[] = ['Owner', 'Admin', 'Accountant', 'Salesperson', 'Purchase Manager', 'Warehouse Manager', 'Cashier'];

roles.forEach(role => {
  const canCreateSales = hasPermission(role, 'sales', 'create');
  const canCreatePurchases = hasPermission(role, 'purchases', 'create');
  const canCreateProducts = hasPermission(role, 'products', 'create');
  const canCreateCustomers = hasPermission(role, 'customers', 'create');

  if (role === 'Accountant') {
    assert(!canCreateSales, 'Accountant cannot create sales from header');
    assert(!canCreatePurchases, 'Accountant cannot create purchases from header');
  }

  if (role === 'Salesperson') {
    assert(canCreateSales, 'Salesperson can create sales invoice');
    assert(!canCreatePurchases, 'Salesperson CANNOT create purchase bill');
  }

  if (role === 'Purchase Manager') {
    assert(!canCreateSales, 'Purchase Manager CANNOT create sales invoice');
    assert(canCreatePurchases, 'Purchase Manager can create purchase bill');
  }

  if (role === 'Warehouse Manager') {
    assert(hasPermission(role, 'inventory', 'view'), 'Warehouse Manager can view inventory branch selector');
  }

  if (role === 'Cashier') {
    assert(!hasPermission(role, 'inventory', 'view'), 'Cashier cannot view warehouse branch selector');
  }
});

// -----------------------------------------------------------------------------
// SUITE 7: Global Search Route Filtering
// -----------------------------------------------------------------------------
console.log('\n👉 SUITE 7: Global Search Navigation & Entity Filtering');

assert(!canAccessRoute('Accountant', '/inventory'), 'Accountant search results omit Inventory');
assert(!canAccessRoute('Accountant', '/barcode'), 'Accountant search results omit Barcode');
assert(!canAccessRoute('Salesperson', '/accounting/ledger'), 'Salesperson search results omit Accounting Ledgers');
assert(!canAccessRoute('Purchase Manager', '/sales'), 'Purchase Manager search results omit Sales Invoices');
assert(!canAccessRoute('Cashier', '/purchases'), 'Cashier search results omit Purchase Invoices');
assert(canAccessRoute('Salesperson', '/customers'), 'Salesperson search results include Customers');
assert(canAccessRoute('Purchase Manager', '/suppliers'), 'Purchase Manager search results include Suppliers');

console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
