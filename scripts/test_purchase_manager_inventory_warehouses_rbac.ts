import assert from 'assert';
import {
  canAccessRoute,
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  hasPermission,
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS,
  ROUTE_MODULE_MAP
} from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE MANAGER INVENTORY & WAREHOUSES RBAC ACCESS');
console.log('================================================================================');

// 1. Module Permissions Matrix
console.log('\n--- 1. Purchase Manager Module Permissions on Inventory & Warehouses ---');
const pmPerms = ROLE_PERMISSIONS_MATRIX['Purchase Manager'].inventory;
assert.strictEqual(pmPerms.view, true, 'Purchase Manager must have inventory.view = true');
assert.strictEqual(pmPerms.create, true, 'Purchase Manager must have inventory.create = true');
assert.strictEqual(pmPerms.edit, true, 'Purchase Manager must have inventory.edit = true');
assert.strictEqual(pmPerms.delete, true, 'Purchase Manager must have inventory.delete = true');
assert.strictEqual(pmPerms.approve, true, 'Purchase Manager must have inventory.approve = true');
assert.strictEqual(pmPerms.manage, true, 'Purchase Manager must have inventory.manage = true');
assert.strictEqual(pmPerms.export, true, 'Purchase Manager must have inventory.export = true');
console.log('  ✓ PASS: Purchase Manager has full operational permissions (view, create, edit, delete, approve, manage, export) on inventory');

// 2. hasPermission helper
console.log('\n--- 2. hasPermission RBAC Function Checks ---');
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'view'), true);
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'create'), true);
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'edit'), true);
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'delete'), true);
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'manage'), true);
assert.strictEqual(hasPermission('Purchase Manager', 'inventory', 'approve'), true);
console.log('  ✓ PASS: hasPermission returns true for Purchase Manager across all required actions');

// 3. Frontend Route Access
console.log('\n--- 3. canAccessRoute for Warehouse & Inventory Routes ---');
assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory/warehouses'), true, 'Must access /inventory/warehouses');
assert.strictEqual(canAccessRoute('Purchase Manager', '/warehouses'), true, 'Must access /warehouses');
assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory'), true, 'Must access /inventory');
assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory/transfers'), true, 'Must access /inventory/transfers');
assert.strictEqual(canAccessRoute('Purchase Manager', '/inventory/adjustments'), true, 'Must access /inventory/adjustments');
console.log('  ✓ PASS: Purchase Manager can access all required warehouse & inventory routes');

// 4. Sidebar Nav Items
console.log('\n--- 4. Navigation Menu Access ---');
assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Warehouse', 'warehouses'), true, 'Must access Warehouse nav item');
assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Stock & Godowns', 'stock'), true, 'Must access Stock & Godowns nav item');
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Transfers', '/inventory/transfers'), true);
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Warehouse Details', '/inventory/warehouses'), true);
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Adjustments', '/inventory/adjustments'), true);
console.log('  ✓ PASS: Purchase Manager can access Warehouse and Inventory nav menus and sub-items');

// 5. Preserved Permissions for Other Roles
console.log('\n--- 5. Preservation of Roles & Security Boundaries ---');
// Warehouse Manager
assert.strictEqual(hasPermission('Warehouse Manager', 'inventory', 'view'), true);
assert.strictEqual(hasPermission('Warehouse Manager', 'inventory', 'manage'), true);
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/warehouses'), true);
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory'), true);
console.log('  ✓ PASS: Warehouse Manager retains inventory and warehouse permissions');

// Owner & Admin
assert.strictEqual(canAccessRoute('Owner', '/inventory/warehouses'), true);
assert.strictEqual(canAccessRoute('Admin', '/inventory/warehouses'), true);
console.log('  ✓ PASS: Owner and Admin retain full access');

// Restricted Roles Must Still Be Denied
assert.strictEqual(canAccessRoute('Salesperson', '/inventory/warehouses'), false);
assert.strictEqual(canAccessRoute('Cashier', '/inventory/warehouses'), false);
assert.strictEqual(canAccessRoute('Accountant', '/inventory/warehouses'), false);
assert.strictEqual(hasPermission('Salesperson', 'inventory', 'manage'), false);
assert.strictEqual(hasPermission('Cashier', 'inventory', 'manage'), false);
assert.strictEqual(hasPermission('Accountant', 'inventory', 'manage'), false);
console.log('  ✓ PASS: Restricted roles (Salesperson, Cashier, Accountant) remain strictly denied from warehouses');

// 6. Non-Admin Boundaries for Purchase Manager
console.log('\n--- 6. No Unnecessary Admin Privileges Granted ---');
assert.strictEqual(hasPermission('Purchase Manager', 'users', 'view'), false, 'Purchase Manager must not access users');
assert.strictEqual(hasPermission('Purchase Manager', 'accounting', 'view'), false, 'Purchase Manager must not access accounting');
assert.strictEqual(hasPermission('Purchase Manager', 'taxes', 'view'), false, 'Purchase Manager must not access taxes');
assert.strictEqual(hasPermission('Purchase Manager', 'audit', 'view'), false, 'Purchase Manager must not access audit');
assert.strictEqual(hasPermission('Purchase Manager', 'sales', 'view'), false, 'Purchase Manager must not access sales');
console.log('  ✓ PASS: Purchase Manager is strictly blocked from Admin/Finance/Sales areas');

console.log('\n================================================================================');
console.log('ALL INVENTORY & WAREHOUSES RBAC TESTS PASSED SUCCESSFULLY (100%)');
console.log('================================================================================');

