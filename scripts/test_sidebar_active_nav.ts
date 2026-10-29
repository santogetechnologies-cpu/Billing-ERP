import { isNavItemActive } from '../src/components/layout/Sidebar';
import { canAccessRoute, canAccessHeaderProfile } from '../src/utils/rbac';

interface TestItem {
  name: string;
  path: string;
  action?: 'profile' | 'logout';
  end?: boolean;
}

const salespersonNavItems: TestItem[] = [
  { name: 'Dashboard', path: '/sales/dashboard', end: true },
  { name: 'New Sale (POS)', path: '/sales/pos', end: true },
  { name: 'Sales Invoices', path: '/sales' },
  { name: 'Customers', path: '/customers' },
  { name: 'Products / Stock Lookup', path: '/products' },
  { name: 'Sales Returns', path: '/sales/returns', end: true },
  { name: 'Settings', path: '/settings' },
  { name: 'My Profile', path: '#profile', action: 'profile' }
];

const adminSalesSubmenuItems: TestItem[] = [
  { name: 'Sales Invoices', path: '/sales', end: true },
  { name: 'Fast Billing / POS', path: '/sales/pos', end: true },
  { name: 'New Invoice', path: '/sales/new', end: true },
  { name: 'Sales Documents', path: '/sales/documents', end: true },
  { name: 'Sales Returns', path: '/sales/returns', end: true }
];

const adminInventorySubmenuItems: TestItem[] = [
  { name: 'Stock Overview', path: '/inventory', end: true },
  { name: 'Low Stock & Reorder', path: '/inventory/alerts', end: true },
  { name: 'Purchase Requests', path: '/inventory/purchase-requests', end: true },
  { name: 'Stock Transfers', path: '/inventory/transfers', end: true },
  { name: 'Stock Adjustments', path: '/inventory/adjustments', end: true },
  { name: 'Batch Tracking', path: '/inventory/batches', end: true },
  { name: 'Serial Numbers', path: '/inventory/serials', end: true },
  { name: 'Stock Valuation', path: '/inventory/valuation', end: true }
];

const adminPurchasesSubmenuItems: TestItem[] = [
  { name: 'Purchase Invoices', path: '/purchases', end: true },
  { name: 'Purchase Requests', path: '/purchases/requests', end: true },
  { name: 'Barcode Management', path: '/purchases/barcode-management', end: true },
  { name: 'New Purchase Bill', path: '/purchases/new', end: true },
  { name: 'Purchase Returns', path: '/purchases/returns', end: true }
];

const productsStandaloneItem: TestItem = {
  name: 'Products',
  path: '/products'
};

const warehousesStandaloneItem: TestItem = {
  name: 'Warehouses / Godowns',
  path: '/inventory/warehouses',
  end: true
};

const rootDashboardItem: TestItem = {
  name: 'Dashboard',
  path: '/',
  end: true
};

function runTests() {
  console.log('--- RUNNING SIDEBAR ACTIVE NAVIGATION TESTS ---\n');
  let failures = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      failures++;
    } else {
      console.log(`✅ PASSED: ${msg}`);
    }
  }

  // =========================================================================
  // 1. Root Dashboard Tests: Dashboard alone must be highlighted on '/' and '/dashboard'
  // =========================================================================
  console.log('Testing Root Dashboard Exclusivity:');
  const dashboardRoutes = ['/', '/dashboard', '/?tab=overview', '/#main'];
  for (const route of dashboardRoutes) {
    // 1. Dashboard item itself must be active
    assert(
      isNavItemActive(rootDashboardItem, route, false) === true,
      `Dashboard must be ACTIVE on "${route}"`
    );

    // 2. Stock Overview must NOT be active
    assert(
      isNavItemActive({ name: 'Stock Overview', path: '/inventory', end: true }, route, false) === false,
      `Stock Overview must NOT be active on "${route}"`
    );

    // 3. Low Stock & Reorder must NOT be active
    assert(
      isNavItemActive({ name: 'Low Stock & Reorder', path: '/inventory/alerts', end: true }, route, false) === false,
      `Low Stock & Reorder must NOT be active on "${route}"`
    );

    // 4. Purchase Requests must NOT be active
    assert(
      isNavItemActive({ name: 'Purchase Requests', path: '/inventory/purchase-requests', end: true }, route, false) === false,
      `Purchase Requests must NOT be active on "${route}"`
    );

    // 5. Parent Inventory must NOT have any active child
    const anyInventoryChildActive = adminInventorySubmenuItems.some(item =>
      isNavItemActive(item, route, false)
    );
    assert(
      anyInventoryChildActive === false,
      `No Inventory child item must be active on "${route}"`
    );

    // 6. Direct parent items must NOT be active
    assert(
      isNavItemActive({ name: 'Inventory', path: '/inventory' }, route, false) === false,
      `Parent Inventory must NOT be active on "${route}"`
    );
    assert(
      isNavItemActive({ name: 'Sales', path: '/sales' }, route, false) === false,
      `Parent Sales must NOT be active on "${route}"`
    );
    assert(
      isNavItemActive({ name: 'Purchases', path: '/purchases' }, route, false) === false,
      `Parent Purchases must NOT be active on "${route}"`
    );
    assert(
      isNavItemActive({ name: 'Products', path: '/products' }, route, false) === false,
      `Parent Products must NOT be active on "${route}"`
    );
  }

  // =========================================================================
  // 2. Inventory Submenu Item Exact Route Matching & Isolation
  // =========================================================================
  console.log('\nTesting Inventory Submenu Mutual Exclusivity:');
  const inventoryRoutes = [
    { route: '/inventory', expectedActive: 'Stock Overview' },
    { route: '/inventory/alerts', expectedActive: 'Low Stock & Reorder' },
    { route: '/inventory/reorder', expectedActive: 'Low Stock & Reorder' },
    { route: '/inventory/purchase-requests', expectedActive: 'Purchase Requests' },
    { route: '/inventory/transfers', expectedActive: 'Stock Transfers' },
    { route: '/inventory/adjustments', expectedActive: 'Stock Adjustments' },
    { route: '/inventory/batches', expectedActive: 'Batch Tracking' },
    { route: '/inventory/serials', expectedActive: 'Serial Numbers' },
    { route: '/inventory/valuation', expectedActive: 'Stock Valuation' }
  ];

  for (const { route, expectedActive } of inventoryRoutes) {
    const activeSubItems = adminInventorySubmenuItems.filter(item =>
      isNavItemActive(item, route, false)
    );
    const activeSubNames = activeSubItems.map(i => i.name);
    assert(
      activeSubItems.length === 1 && activeSubNames[0] === expectedActive,
      `Inventory on "${route}": exactly ONE sub-item expected ("${expectedActive}"), got [${activeSubNames.join(', ')}]`
    );

    // Root Dashboard must NOT be active on any inventory route
    assert(
      isNavItemActive(rootDashboardItem, route, false) === false,
      `Root Dashboard must NOT be active on "${route}"`
    );

    // Warehouses / Godowns must NOT be active on any of these inventory routes
    assert(
      isNavItemActive(warehousesStandaloneItem, route, false) === false,
      `Warehouses / Godowns must NOT be active on "${route}"`
    );
  }

  // Specific check: Stock Overview must NOT be active on /inventory/alerts or /inventory/purchase-requests
  const stockOverviewItem = adminInventorySubmenuItems.find(i => i.name === 'Stock Overview')!;
  assert(
    isNavItemActive(stockOverviewItem, '/inventory/alerts', false) === false,
    'Stock Overview must NOT be active on /inventory/alerts'
  );
  assert(
    isNavItemActive(stockOverviewItem, '/inventory/purchase-requests', false) === false,
    'Stock Overview must NOT be active on /inventory/purchase-requests'
  );

  // =========================================================================
  // 3. Standalone Warehouses / Godowns Navigation & Isolation
  // =========================================================================
  console.log('\nTesting Standalone Warehouses / Godowns Item:');
  assert(
    isNavItemActive(warehousesStandaloneItem, '/inventory/warehouses', false) === true,
    'Warehouses / Godowns must be ACTIVE on /inventory/warehouses'
  );

  // When on /inventory/warehouses, no item in the Inventory submenu should be active
  const anyInventoryChildActiveOnWh = adminInventorySubmenuItems.some(item =>
    isNavItemActive(item, '/inventory/warehouses', false)
  );
  assert(
    anyInventoryChildActiveOnWh === false,
    'No item in Inventory submenu must be active on /inventory/warehouses'
  );

  // When on /inventory/warehouses, parent Inventory ({ path: '/inventory' }) must NOT be active
  assert(
    isNavItemActive({ name: 'Inventory', path: '/inventory' }, '/inventory/warehouses', false) === false,
    'Parent Inventory item must NOT be directly active on /inventory/warehouses'
  );

  // =========================================================================
  // 4. Purchases Submenu Item Mutual Exclusivity
  // =========================================================================
  console.log('\nTesting Purchases Submenu Mutual Exclusivity:');
  const purchasesRoutes = [
    { route: '/purchases', expectedActive: 'Purchase Invoices' },
    { route: '/purchases/requests', expectedActive: 'Purchase Requests' },
    { route: '/purchases/barcode-management', expectedActive: 'Barcode Management' },
    { route: '/purchases/barcode-override', expectedActive: 'Barcode Management' },
    { route: '/purchases/new', expectedActive: 'New Purchase Bill' },
    { route: '/purchases/returns', expectedActive: 'Purchase Returns' }
  ];

  for (const { route, expectedActive } of purchasesRoutes) {
    const activeSubItems = adminPurchasesSubmenuItems.filter(item =>
      isNavItemActive(item, route, false)
    );
    const activeSubNames = activeSubItems.map(i => i.name);
    assert(
      activeSubItems.length === 1 && activeSubNames[0] === expectedActive,
      `Purchases on "${route}": exactly ONE sub-item expected ("${expectedActive}"), got [${activeSubNames.join(', ')}]`
    );

    // Dashboard must NOT be active on any purchases route
    assert(
      isNavItemActive(rootDashboardItem, route, false) === false,
      `Dashboard must NOT be active on "${route}"`
    );

    // Inventory items must NOT be active on purchases routes
    const anyInvActive = adminInventorySubmenuItems.some(i => isNavItemActive(i, route, false));
    assert(
      anyInvActive === false,
      `No Inventory item should be active on "${route}"`
    );
  }

  // =========================================================================
  // 5. Single-Level Products Sidebar Navigation & Active Highlighting
  // =========================================================================
  console.log('\nTesting Single-Level Products Sidebar Navigation:');
  assert(
    isNavItemActive(productsStandaloneItem, '/products', false) === true,
    'Products must be ACTIVE on /products'
  );
  assert(
    isNavItemActive(productsStandaloneItem, '/products/new', false) === true,
    'Products must be ACTIVE on /products/new'
  );
  assert(
    isNavItemActive(productsStandaloneItem, '/products/edit/p-123', false) === true,
    'Products must be ACTIVE on /products/edit/p-123'
  );
  assert(
    isNavItemActive(productsStandaloneItem, '/', false) === false,
    'Products must NOT be active on /'
  );
  assert(
    isNavItemActive(productsStandaloneItem, '/inventory', false) === false,
    'Products must NOT be active on /inventory'
  );
  assert(
    isNavItemActive(productsStandaloneItem, '/sales', false) === false,
    'Products must NOT be active on /sales'
  );

  // =========================================================================
  // 6. Admin Sales Submenu Item Mutual Exclusivity
  // =========================================================================
  console.log('\nTesting Admin Sales Submenu Mutual Exclusivity:');
  const adminRoutes = [
    { route: '/sales', expectedActive: 'Sales Invoices' },
    { route: '/sales/pos', expectedActive: 'Fast Billing / POS' },
    { route: '/sales/new', expectedActive: 'New Invoice' },
    { route: '/sales/documents', expectedActive: 'Sales Documents' },
    { route: '/sales/returns', expectedActive: 'Sales Returns' }
  ];

  for (const { route, expectedActive } of adminRoutes) {
    const activeSubItems = adminSalesSubmenuItems.filter(item =>
      isNavItemActive(item, route, false)
    );
    const activeSubNames = activeSubItems.map(i => i.name);
    assert(
      activeSubItems.length === 1 && activeSubNames[0] === expectedActive,
      `Admin on "${route}": exactly ONE sub-item expected ("${expectedActive}"), got [${activeSubNames.join(', ')}]`
    );
  }

  // =========================================================================
  // 7. Salesperson Navigation Item Mutual Exclusivity
  // =========================================================================
  console.log('\nTesting Salesperson Navigation Item Mutual Exclusivity:');
  const salespersonRoutes = [
    { route: '/sales/dashboard', expectedActive: 'Dashboard' },
    { route: '/sales/dashboard/', expectedActive: 'Dashboard' },
    { route: '/sales/dashboard?tab=overview', expectedActive: 'Dashboard' },
    { route: '/sales', expectedActive: 'Sales Invoices' },
    { route: '/sales/', expectedActive: 'Sales Invoices' },
    { route: '/sales/invoices', expectedActive: 'Sales Invoices' },
    { route: '/sales/pos', expectedActive: 'New Sale (POS)' },
    { route: '/sales/pos/', expectedActive: 'New Sale (POS)' },
    { route: '/sales/returns', expectedActive: 'Sales Returns' },
    { route: '/sales/returns/', expectedActive: 'Sales Returns' },
    { route: '/sales/new', expectedActive: 'Sales Invoices' },
    { route: '/sales/documents', expectedActive: 'Sales Invoices' },
    { route: '/sales/INV-2026-001', expectedActive: 'Sales Invoices' },
    { route: '/customers', expectedActive: 'Customers' },
    { route: '/customers/c-12345', expectedActive: 'Customers' },
    { route: '/products', expectedActive: 'Products / Stock Lookup' },
    { route: '/products/p-98765', expectedActive: 'Products / Stock Lookup' }
  ];

  for (const { route, expectedActive } of salespersonRoutes) {
    const activeItems = salespersonNavItems.filter(item =>
      isNavItemActive(item, route, true)
    );

    const activeNames = activeItems.map(i => i.name);
    assert(
      activeItems.length === 1 && activeNames[0] === expectedActive,
      `On route "${route}": exactly ONE active item expected ("${expectedActive}"), got [${activeNames.join(', ')}]`
    );
  }

  // Action items (My Profile, Logout removed)
  console.log('\nTesting Action items (My Profile, Logout removed):');
  const logoutItem = salespersonNavItems.find(i => i.name === 'Logout');
  const profileItem = salespersonNavItems.find(i => i.name === 'My Profile')!;

  assert(
    logoutItem === undefined,
    'Logout button must NOT be present in salespersonNavItems'
  );
  assert(
    isNavItemActive(profileItem, '/sales/dashboard', true) === false,
    'My Profile action must not be active on normal route'
  );

  // =========================================================================
  // 8. Role-Based Visibility for Warehouses / Godowns
  // =========================================================================
  console.log('\nTesting Role-Based Visibility for Warehouses / Godowns:');
  assert(canAccessRoute('Owner', '/inventory/warehouses') === true, 'Owner CAN access /inventory/warehouses');
  assert(canAccessRoute('Admin', '/inventory/warehouses') === true, 'Admin CAN access /inventory/warehouses');
  assert(canAccessRoute('Warehouse Manager', '/inventory/warehouses') === true, 'Warehouse Manager CAN access /inventory/warehouses');
  assert(canAccessRoute('Salesperson', '/inventory/warehouses') === false, 'Salesperson CANNOT access /inventory/warehouses');
  assert(canAccessRoute('Cashier', '/inventory/warehouses') === false, 'Cashier CANNOT access /inventory/warehouses');
  assert(canAccessRoute('Accountant', '/inventory/warehouses') === false, 'Accountant CANNOT access /inventory/warehouses');
  assert(canAccessRoute('Purchase Manager', '/inventory/warehouses') === true, 'Purchase Manager CAN access /inventory/warehouses (Warehouse Details)');

  // =========================================================================
  // 9. Warehouse Manager Profile Placement (Removed from Header, Added to Sidebar below Settings)
  // =========================================================================
  console.log('\nTesting Warehouse Manager Profile Placement:');
  assert(
    canAccessHeaderProfile('Warehouse Manager') === false,
    'Warehouse Manager must NOT have My Profile in header user dropdown'
  );
  assert(
    canAccessHeaderProfile('Salesperson') === false,
    'Salesperson must NOT have My Profile in header user dropdown'
  );
  assert(
    canAccessHeaderProfile('Purchase Manager') === false,
    'Purchase Manager must NOT have My Profile in header user dropdown'
  );
  assert(
    canAccessHeaderProfile('Owner') === true,
    'Owner HAS My Profile in header user dropdown'
  );
  assert(
    canAccessHeaderProfile('Admin') === true,
    'Admin HAS My Profile in header user dropdown'
  );
  // =========================================================================
  // 10. Purchase Manager Dashboard Navigation & Submenu Exclusivity
  // =========================================================================
  console.log('\nTesting Purchase Manager Dashboard Navigation & Submenu Exclusivity:');
  const pmDashboardItem: TestItem = {
    name: 'Dashboard',
    path: '/purchases/dashboard',
    end: true
  };

  // On /purchases/dashboard:
  assert(
    isNavItemActive(pmDashboardItem, '/purchases/dashboard', false) === true,
    'Dashboard must be ACTIVE on /purchases/dashboard'
  );
  assert(
    isNavItemActive({ name: 'Purchase Invoices', path: '/purchases', end: true }, '/purchases/dashboard', false) === false,
    'Purchase Invoices must NOT be active on /purchases/dashboard'
  );
  assert(
    isNavItemActive({ name: 'Purchase Requests', path: '/purchases/requests', end: true }, '/purchases/dashboard', false) === false,
    'Purchase Requests must NOT be active on /purchases/dashboard'
  );

  // On /purchases:
  assert(
    isNavItemActive(pmDashboardItem, '/purchases', false) === false,
    'Dashboard must NOT be active on /purchases'
  );
  assert(
    isNavItemActive({ name: 'Purchase Invoices', path: '/purchases', end: true }, '/purchases', false) === true,
    'Purchase Invoices must be ACTIVE on /purchases'
  );

  // On /purchases/requests:
  assert(
    isNavItemActive(pmDashboardItem, '/purchases/requests', false) === false,
    'Dashboard must NOT be active on /purchases/requests'
  );
  assert(
    isNavItemActive({ name: 'Purchase Requests', path: '/purchases/requests', end: true }, '/purchases/requests', false) === true,
    'Purchase Requests must be ACTIVE on /purchases/requests'
  );

  console.log(`\n========================================`);
  if (failures === 0) {
    console.log('🎉 ALL SIDEBAR ACTIVE NAVIGATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`💥 ${failures} TEST(S) FAILED!`);
    process.exit(1);
  }
}

runTests();
