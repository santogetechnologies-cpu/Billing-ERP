import {
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS,
  canAccessRoute,
  canRoleAccessSubItem,
  hasPermission
} from '../src/utils/rbac';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('\n--- 1. Testing Salesperson Permission Matrix ---');
const sp = ROLE_PERMISSIONS_MATRIX['Salesperson'];

// Sales: view-only (no create, edit, delete, approve)
assert(sp.sales.view === true, 'Salesperson can view sales');
assert(sp.sales.create === false, 'Salesperson CANNOT create sales invoices');
assert(sp.sales.edit === false, 'Salesperson CANNOT edit sales invoices');
assert(sp.sales.delete === false, 'Salesperson CANNOT delete sales invoices');

// POS: ALL DENIED
assert(sp.pos.view === false, 'Salesperson CANNOT access POS counter billing');
assert(sp.pos.create === false, 'Salesperson CANNOT create POS transactions');

// Payments: ALL DENIED
assert(sp.payments.view === false, 'Salesperson CANNOT view payments');
assert(sp.payments.create === false, 'Salesperson CANNOT process payments');

// Inventory: VIEW ONLY
assert(sp.inventory.view === true, 'Salesperson can view inventory');
assert(sp.inventory.create === false, 'Salesperson CANNOT create inventory adjustments or transfers');
assert(sp.inventory.edit === false, 'Salesperson CANNOT edit inventory');
assert(sp.inventory.delete === false, 'Salesperson CANNOT delete inventory');

// Products: VIEW ONLY
assert(sp.products.view === true, 'Salesperson can view products');
assert(sp.products.create === false, 'Salesperson CANNOT create products');
assert(sp.products.edit === false, 'Salesperson CANNOT edit products');
assert(sp.products.delete === false, 'Salesperson CANNOT delete products');

// Customers: view, create, edit, NO delete
assert(sp.customers.view === true, 'Salesperson can view customers');
assert(sp.customers.create === true, 'Salesperson can add customers');
assert(sp.customers.edit === true, 'Salesperson can edit customer details');
assert(sp.customers.delete === false, 'Salesperson CANNOT delete customer records');

// Settings: ALL DENIED
assert(sp.settings.view === false, 'Salesperson CANNOT access settings');

console.log('\n--- 2. Testing Salesperson Navigation Menus ---');
const allowedMenus = ROLE_ALLOWED_NAV_MENUS['Salesperson'];
assert(allowedMenus.length === 4, `Salesperson has exactly 4 permitted main menus (found ${allowedMenus.length})`);
assert(allowedMenus.includes('Dashboard'), 'Includes Dashboard');
assert(allowedMenus.includes('Sales'), 'Includes Sales');
assert(allowedMenus.includes('Inventory'), 'Includes Inventory');
assert(allowedMenus.includes('Customers'), 'Includes Customers');
assert(!allowedMenus.includes('Products'), 'Does NOT include standalone Products');
assert(!allowedMenus.includes('Purchases'), 'Does NOT include Purchases');
assert(!allowedMenus.includes('Suppliers'), 'Does NOT include Suppliers');
assert(!allowedMenus.includes('Settings'), 'Does NOT include Settings');

console.log('\n--- 3. Testing Salesperson Route Boundaries ---');
// Authorized Routes
assert(canAccessRoute('Salesperson', '/sales/dashboard'), 'Can access /sales/dashboard');
assert(canAccessRoute('Salesperson', '/sales'), 'Can access /sales');
assert(canAccessRoute('Salesperson', '/sales/invoices'), 'Can access /sales/invoices');
assert(canAccessRoute('Salesperson', '/inventory'), 'Can access /inventory');
assert(canAccessRoute('Salesperson', '/customers'), 'Can access /customers');
assert(canAccessRoute('Salesperson', '/customers/123'), 'Can access /customers/:id');

// Forbidden Routes
assert(!canAccessRoute('Salesperson', '/sales/pos'), 'CANNOT access /sales/pos');
assert(!canAccessRoute('Salesperson', '/sales/new'), 'CANNOT access /sales/new');
assert(!canAccessRoute('Salesperson', '/sales/returns'), 'CANNOT access /sales/returns');
assert(!canAccessRoute('Salesperson', '/sales/documents'), 'CANNOT access /sales/documents');
assert(!canAccessRoute('Salesperson', '/products'), 'CANNOT access /products');
assert(!canAccessRoute('Salesperson', '/units'), 'CANNOT access /units');
assert(!canAccessRoute('Salesperson', '/pricing'), 'CANNOT access /pricing');
assert(!canAccessRoute('Salesperson', '/settings'), 'CANNOT access /settings');
assert(!canAccessRoute('Salesperson', '/payments'), 'CANNOT access /payments');
assert(!canAccessRoute('Salesperson', '/purchases'), 'CANNOT access /purchases');
assert(!canAccessRoute('Salesperson', '/suppliers'), 'CANNOT access /suppliers');
assert(!canAccessRoute('Salesperson', '/inventory/transfers'), 'CANNOT access /inventory/transfers');
assert(!canAccessRoute('Salesperson', '/inventory/adjustments'), 'CANNOT access /inventory/adjustments');
assert(!canAccessRoute('Salesperson', '/inventory/warehouses'), 'CANNOT access /inventory/warehouses');
assert(!canAccessRoute('Salesperson', '/inventory/purchase-requests'), 'CANNOT access /inventory/purchase-requests');

console.log('\n--- 4. Testing Sub-Item Access for Salesperson ---');
assert(canRoleAccessSubItem('Salesperson', 'Sales', 'Sales Invoices', '/sales'), 'Can access Sales overview');
assert(!canRoleAccessSubItem('Salesperson', 'Sales', 'POS Fast Billing', '/sales/pos'), 'CANNOT access Sales POS submenu');
assert(!canRoleAccessSubItem('Salesperson', 'Sales', 'Sales Returns', '/sales/returns'), 'CANNOT access Sales returns submenu');
assert(canRoleAccessSubItem('Salesperson', 'Inventory', 'Stock Overview', '/inventory'), 'Can access Inventory overview');
assert(!canRoleAccessSubItem('Salesperson', 'Inventory', 'Stock Transfers', '/inventory/transfers'), 'CANNOT access Inventory transfers submenu');

console.log('\n--- 5. Testing Other Roles Integrity ---');
assert(hasPermission('Cashier', 'pos', 'create'), 'Cashier retains POS billing permission');
assert(canAccessRoute('Cashier', '/sales/pos'), 'Cashier can access /sales/pos');
assert(hasPermission('Warehouse Manager', 'inventory', 'create'), 'Warehouse Manager retains inventory transfer/adjustment permission');
assert(canAccessRoute('Warehouse Manager', '/inventory/transfers'), 'Warehouse Manager can access /inventory/transfers');
assert(hasPermission('Purchase Manager', 'purchases', 'create'), 'Purchase Manager retains purchase order creation permission');
assert(hasPermission('Owner', 'settings', 'manage'), 'Owner retains full settings manage permission');
assert(hasPermission('Admin', 'settings', 'edit'), 'Admin retains settings edit permission');

console.log('\n🎉 ALL SALESPERSON REBUILD AND RBAC INTEGRITY TESTS PASSED SUCCESSFULLY!\n');
