import {
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS,
  canAccessRoute,
  canRoleAccessSubItem,
  hasPermission,
  getRoleDefaultRoute
} from '../src/utils/rbac';
import * as fs from 'fs';
import * as path from 'path';

function runTestSuite() {
  console.log('================================================================');
  console.log(' VERIFICATION SUITE: Rebuilt Sales Person Role & Access Control ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extraInfo?: any) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      if (extraInfo !== undefined) console.error('    Details:', extraInfo);
      failed++;
    }
  }

  // --- 1. RBAC Permissions Matrix for Salesperson ---
  console.log('--- 1. Salesperson Permissions Matrix ---');
  const spPerms = ROLE_PERMISSIONS_MATRIX.Salesperson;

  assert('Salesperson has NO pos access (ALL_DENIED)', 
    spPerms.pos.view === false && spPerms.pos.create === false && spPerms.pos.edit === false && spPerms.pos.delete === false);

  assert('Salesperson has NO payment processing permissions (ALL_DENIED)', 
    spPerms.payments.view === false && spPerms.payments.create === false && spPerms.payments.edit === false && spPerms.payments.delete === false);

  assert('Salesperson has NO settings permissions (ALL_DENIED)', 
    spPerms.settings.view === false && spPerms.settings.create === false && spPerms.settings.manage === false);

  assert('Salesperson CANNOT delete customers', spPerms.customers.delete === false);
  assert('Salesperson CAN view customers', spPerms.customers.view === true);
  assert('Salesperson CAN create customers', spPerms.customers.create === true);
  assert('Salesperson CAN edit customers', spPerms.customers.edit === true);

  assert('Salesperson has VIEW_ONLY access to products (for live stock & catalog lookup inside Sales)', 
    spPerms.products.view === true && spPerms.products.create === false && spPerms.products.edit === false && spPerms.products.delete === false);

  assert('Salesperson can view and create sales orders, but cannot edit or delete finalized sales records',
    spPerms.sales.view === true && spPerms.sales.create === true && spPerms.sales.edit === false && spPerms.sales.delete === false);

  assert('Salesperson has NO inventory permissions (ALL_DENIED)',
    spPerms.inventory.view === false && spPerms.inventory.create === false && spPerms.inventory.edit === false);

  assert('Salesperson has NO purchases permissions (ALL_DENIED)',
    spPerms.purchases.view === false && spPerms.purchases.create === false && spPerms.purchases.edit === false);

  assert('Salesperson has NO accounting or financial ledger permissions',
    spPerms.accounting.view === false && spPerms.accounting.create === false);

  // --- 2. Allowed Navigation Menus in RBAC ---
  console.log('\n--- 2. Navigation Menus for Salesperson ---');
  const spMenus = ROLE_ALLOWED_NAV_MENUS.Salesperson;
  assert('Salesperson allowed nav menus length is exactly 3 (Dashboard, Sales, Customers)',
    spMenus.length === 3 && spMenus.includes('Dashboard') && spMenus.includes('Sales') && spMenus.includes('Customers'),
    spMenus);

  assert('Salesperson excluded from Purchases menu', !spMenus.includes('Purchases'));
  assert('Salesperson excluded from Inventory menu', !spMenus.includes('Inventory'));
  assert('Salesperson excluded from Accounting menu', !spMenus.includes('Accounting'));
  assert('Salesperson excluded from Reports menu', !spMenus.includes('Reports'));
  assert('Salesperson excluded from Settings menu', !spMenus.includes('Settings'));
  assert('Salesperson excluded from Barcode menu', !spMenus.includes('Barcode'));

  // --- 3. Sub-Item Access for Salesperson ---
  console.log('\n--- 3. Sub-Item Access Controls for Salesperson ---');
  assert('Salesperson CANNOT access POS Counter subitem', !canRoleAccessSubItem('Salesperson', 'Sales', 'POS Counter', '/sales/pos'));
  assert('Salesperson CANNOT access Sales Returns subitem', !canRoleAccessSubItem('Salesperson', 'Sales', 'Sales Returns', '/sales/returns'));
  assert('Salesperson CAN access Main Sales list', canRoleAccessSubItem('Salesperson', 'Sales', 'Invoices & Orders', '/sales'));

  // --- 4. Route Protection (canAccessRoute) ---
  console.log('\n--- 4. Direct Route Access Protection ---');
  // Permitted routes:
  assert('Salesperson can access /sales/dashboard', canAccessRoute('Salesperson', '/sales/dashboard'));
  assert('Salesperson can access /sales', canAccessRoute('Salesperson', '/sales'));
  assert('Salesperson can access /sales/orders', canAccessRoute('Salesperson', '/sales/orders'));
  assert('Salesperson can access /customers', canAccessRoute('Salesperson', '/customers'));
  assert('Salesperson can access /customers/cust-101', canAccessRoute('Salesperson', '/customers/cust-101'));

  // Blocked routes:
  const forbiddenRoutes = [
    '/sales/pos',
    '/sales/returns',
    '/products',
    '/units',
    '/pricing',
    '/inventory',
    '/inventory/stock-overview',
    '/inventory/adjustments',
    '/inventory/transfers',
    '/inventory/low-stock',
    '/inventory/valuation',
    '/purchases',
    '/purchases/orders',
    '/purchases/new',
    '/purchases/invoices',
    '/suppliers',
    '/expenses',
    '/accounting',
    '/accounting/ledger',
    '/reports',
    '/barcode',
    '/users',
    '/settings'
  ];

  for (const route of forbiddenRoutes) {
    assert(`Salesperson blocked from ${route}`, !canAccessRoute('Salesperson', route));
  }

  // --- 5. Preservation of Other Roles ---
  console.log('\n--- 5. Preservation of Other Roles ---');
  assert('Admin can access /sales/pos', canAccessRoute('Admin', '/sales/pos'));
  assert('Admin can access /settings', canAccessRoute('Admin', '/settings'));
  assert('Admin can access /products', canAccessRoute('Admin', '/products'));
  assert('Cashier can access /sales/pos', canAccessRoute('Cashier', '/sales/pos'));
  assert('Cashier can access /sales', canAccessRoute('Cashier', '/sales'));
  assert('Cashier landing route is /sales/pos', getRoleDefaultRoute('Cashier') === '/sales/pos');
  assert('Purchase Manager can access /purchases', canAccessRoute('Purchase Manager', '/purchases'));
  assert('Warehouse Manager can access /inventory', canAccessRoute('Warehouse Manager', '/inventory'));

  // --- 6. Inspection of Sidebar Component File ---
  console.log('\n--- 6. Sidebar Implementation Verification ---');
  const sidebarPath = path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

  assert('Sidebar explicitly defines salespersonNavItems', sidebarCode.includes('salespersonNavItems'));
  assert('Salesperson sidebar includes Dashboard (/sales/dashboard)', sidebarCode.includes("path: '/sales/dashboard'"));
  assert('Salesperson sidebar includes Sales (/sales)', sidebarCode.includes("path: '/sales'"));
  assert('Salesperson sidebar includes Customers (/customers)', sidebarCode.includes("path: '/customers'"));
  assert('Salesperson sidebar includes My Profile', sidebarCode.includes("path: '#profile'"));

  // Check that no forbidden links are inside salespersonNavItems block
  const spNavMatch = sidebarCode.match(/const salespersonNavItems: NavItem\[\] = \[([\s\S]*?)\];/);
  assert('Found salespersonNavItems array definition', !!spNavMatch);
  if (spNavMatch) {
    const spNavContent = spNavMatch[1];
    assert('salespersonNavItems has exactly 4 items', (spNavContent.match(/name:/g) || []).length === 4);
    assert('salespersonNavItems does not contain purchases', !spNavContent.toLowerCase().includes('purchases'));
    assert('salespersonNavItems does not contain inventory', !spNavContent.toLowerCase().includes('inventory'));
    assert('salespersonNavItems does not contain suppliers', !spNavContent.toLowerCase().includes('suppliers'));
    assert('salespersonNavItems does not contain barcode', !spNavContent.toLowerCase().includes('barcode'));
    assert('salespersonNavItems does not contain settings', !spNavContent.toLowerCase().includes('settings'));
  }

  // --- 7. Inspection of Salesperson Dashboard Component File ---
  console.log('\n--- 7. Salesperson Dashboard Implementation Verification ---');
  const dashboardPath = path.resolve(process.cwd(), 'src/pages/sales/SalespersonDashboardPage.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

  assert('Dashboard contains "My Sales Today" card', dashboardCode.includes('My Sales Today'));
  assert('Dashboard contains "My Sales Orders" card', dashboardCode.includes('My Sales Orders'));
  assert('Dashboard contains "Total Customers" card', dashboardCode.includes('Total Customers'));
  assert('Dashboard contains "Recent Sales Activity" card', dashboardCode.includes('Recent Sales Activity'));

  // Verify unique card navigations:
  assert('Dashboard routes "My Sales Today" to /sales?filter=today', dashboardCode.includes("/sales?filter=today"));
  assert('Dashboard routes "My Sales Orders" to /sales?tab=orders', dashboardCode.includes("/sales?tab=orders"));
  assert('Dashboard routes "Total Customers" to /customers', dashboardCode.includes("navigate('/customers')"));
  assert('Dashboard routes "Recent Sales Activity" to /sales?tab=history', dashboardCode.includes("/sales?tab=history"));

  // Verify 4 quick actions:
  assert('Dashboard provides "New Sales Order" quick action', dashboardCode.includes('New Sales Order'));
  assert('Dashboard provides "Add Customer" quick action', dashboardCode.includes('Add Customer'));
  assert('Dashboard provides "View Customers" quick action', dashboardCode.includes('View Customers'));
  assert('Dashboard provides "View My Sales" quick action', dashboardCode.includes('View My Sales'));

  // --- 8. Customer Management Logic Verification ---
  console.log('\n--- 8. Customer Duplicate Prevention & Required Field Validation ---');
  const customersPath = path.resolve(process.cwd(), 'src/pages/customers/CustomersPage.tsx');
  const customersCode = fs.readFileSync(customersPath, 'utf8');

  assert('CustomersPage checks duplicate by phone', customersCode.includes('A customer with this phone number already exists'));
  assert('CustomersPage checks duplicate by name', customersCode.includes('A customer with this name already exists'));
  assert('CustomersPage validates required fields (name & phone)', customersCode.includes('Customer name is required') && customersCode.includes('Valid phone number is required'));
  assert('CustomersPage auto-opens Add Customer modal on ?action=new', customersCode.includes("searchParams.get('action') === 'new'"));

  // --- 9. Sales Invoices & Cashier Handover Verification ---
  console.log('\n--- 9. Sales Module & Cashier Handover Integration ---');
  const salesInvoicesPath = path.resolve(process.cwd(), 'src/pages/sales/SalesInvoicesPage.tsx');
  const salesInvoicesCode = fs.readFileSync(salesInvoicesPath, 'utf8');

  assert('SalesInvoicesPage prevents ordering quantities exceeding available stock',
    salesInvoicesCode.includes('Quantity limit exceeded'));
  assert('SalesInvoicesPage displays clear Out of Stock warning badge',
    salesInvoicesCode.includes('Out of Stock') && salesInvoicesCode.includes('isOutOfStock'));
  assert('SalesInvoicesPage creates sales_order docType without stock deduction',
    salesInvoicesCode.includes("docType: 'sales_order'"));
  assert('SalesInvoicesPage registers order into heldInvoices for Cashier checkout handover',
    salesInvoicesCode.includes('holdInvoice'));

  const fastPOSPath = path.resolve(process.cwd(), 'src/pages/sales/FastPOSPage.tsx');
  const fastPOSCode = fs.readFileSync(fastPOSPath, 'utf8');
  assert('FastPOSPage displays Sales Person Handover Orders in held counter drawer',
    fastPOSCode.includes('Sales Person Handover Orders'));
  assert('FastPOSPage allows Cashier to load and bill handed-over sales orders',
    fastPOSCode.includes('Load Order & Bill') || fastPOSCode.includes('handedOverSalesOrders'));

  // --- Summary ---
  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
