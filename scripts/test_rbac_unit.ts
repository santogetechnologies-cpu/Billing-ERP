import assert from 'assert';
import {
  hasPermission,
  canAccessRoute,
  canManageProducts,
  canManageInitialStock,
  canUpdateStock,
  canPerformManualStockAdjustment,
  canRoleAccessNavItem,
  canRoleAccessSubItem
} from '../src/utils/rbac';

console.log('--- TESTING RBAC PRODUCT PERMISSIONS ---');

// 1. Owner
console.log('Testing Owner permissions...');
assert.strictEqual(canManageProducts('Owner'), true, 'Owner canManageProducts must be true');
assert.strictEqual(canManageInitialStock('Owner'), true, 'Owner canManageInitialStock must be true');
assert.strictEqual(canUpdateStock('Owner'), true, 'Owner canUpdateStock must be true');
assert.strictEqual(canPerformManualStockAdjustment('Owner'), true, 'Owner canPerformManualStockAdjustment must be true');
assert.strictEqual(canRoleAccessNavItem('Owner', 'Product'), true, 'Owner must see Product menu in sidebar');
assert.strictEqual(canAccessRoute('Owner', '/products'), true, 'Owner must access /products');
assert.strictEqual(canAccessRoute('Owner', '/products/new'), true, 'Owner must access /products/new');
assert.strictEqual(canAccessRoute('Owner', '/products/initial-stock'), true, 'Owner must access /products/initial-stock');
assert.strictEqual(canAccessRoute('Owner', '/products/update-stock'), true, 'Owner must access /products/update-stock');
assert.strictEqual(canRoleAccessSubItem('Owner', 'Product', 'Product Master', '/products'), true);
assert.strictEqual(canRoleAccessSubItem('Owner', 'Product', 'Initial Stock', '/products/initial-stock'), true);
assert.strictEqual(canRoleAccessSubItem('Owner', 'Product', 'Update Stock', '/products/update-stock'), true);

// 2. Admin
console.log('Testing Admin permissions...');
assert.strictEqual(canManageProducts('Admin'), true, 'Admin canManageProducts must be true');
assert.strictEqual(canManageInitialStock('Admin'), true, 'Admin canManageInitialStock must be true');
assert.strictEqual(canUpdateStock('Admin'), true, 'Admin canUpdateStock must be true');
assert.strictEqual(canPerformManualStockAdjustment('Admin'), true, 'Admin canPerformManualStockAdjustment must be true');
assert.strictEqual(canRoleAccessNavItem('Admin', 'Product'), true, 'Admin must see Product menu in sidebar');
assert.strictEqual(canAccessRoute('Admin', '/products'), true, 'Admin must access /products');
assert.strictEqual(canAccessRoute('Admin', '/products/new'), true, 'Admin must access /products/new');
assert.strictEqual(canAccessRoute('Admin', '/products/initial-stock'), true, 'Admin must access /products/initial-stock');
assert.strictEqual(canAccessRoute('Admin', '/products/update-stock'), true, 'Admin must access /products/update-stock');
assert.strictEqual(canRoleAccessSubItem('Admin', 'Product', 'Product Master', '/products'), true);
assert.strictEqual(canRoleAccessSubItem('Admin', 'Product', 'Initial Stock', '/products/initial-stock'), true);
assert.strictEqual(canRoleAccessSubItem('Admin', 'Product', 'Update Stock', '/products/update-stock'), true);

// 3. Purchase Manager
console.log('Testing Purchase Manager permissions...');
assert.strictEqual(canManageProducts('Purchase Manager'), true, 'PM canManageProducts must be true');
assert.strictEqual(canManageInitialStock('Purchase Manager'), true, 'PM canManageInitialStock must be true');
assert.strictEqual(canUpdateStock('Purchase Manager'), true, 'PM canUpdateStock must be true');
assert.strictEqual(canPerformManualStockAdjustment('Purchase Manager'), true, 'PM canPerformManualStockAdjustment must be true');
assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Product'), true, 'PM must see Product menu in sidebar');
assert.strictEqual(canAccessRoute('Purchase Manager', '/products'), true, 'PM must access /products');
assert.strictEqual(canAccessRoute('Purchase Manager', '/products/new'), true, 'PM must access /products/new');
assert.strictEqual(canAccessRoute('Purchase Manager', '/products/initial-stock'), true, 'PM must access /products/initial-stock');
assert.strictEqual(canAccessRoute('Purchase Manager', '/products/update-stock'), true, 'PM must access /products/update-stock');
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Product Master', '/products'), true);
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Initial Stock', '/products/initial-stock'), true);
assert.strictEqual(canRoleAccessSubItem('Purchase Manager', 'Product', 'Update Stock', '/products/update-stock'), true);

// 4. Warehouse Manager (Strictly restricted from Product & stock updates, retained warehouse operations)
console.log('Testing Warehouse Manager restrictions & retentions...');
assert.strictEqual(canManageProducts('Warehouse Manager'), false, 'WM canManageProducts must be false');
assert.strictEqual(canManageInitialStock('Warehouse Manager'), false, 'WM canManageInitialStock must be false');
assert.strictEqual(canUpdateStock('Warehouse Manager'), false, 'WM canUpdateStock must be false');
assert.strictEqual(canPerformManualStockAdjustment('Warehouse Manager'), false, 'WM canPerformManualStockAdjustment must be false');
assert.strictEqual(canRoleAccessNavItem('Warehouse Manager', 'Product'), false, 'WM must NOT see Product menu in sidebar');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/products'), false, 'WM must NOT access /products');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/new'), false, 'WM must NOT access /products/new');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/edit/123'), false, 'WM must NOT access /products/edit');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/initial-stock'), false, 'WM must NOT access /products/initial-stock');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/update-stock'), false, 'WM must NOT access /products/update-stock');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/adjustments'), false, 'WM must NOT access /inventory/adjustments');
assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Product Master', '/products'), false);
assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Initial Stock', '/products/initial-stock'), false);
assert.strictEqual(canRoleAccessSubItem('Warehouse Manager', 'Product', 'Update Stock', '/products/update-stock'), false);

// Warehouse Manager Operational Retentions
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory'), true, 'WM must retain /inventory stock overview');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/receive'), true, 'WM must retain /inventory/receive');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/warehouses'), true, 'WM must retain /inventory/warehouses');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/inventory/batches'), true, 'WM must retain /inventory/batches');
assert.strictEqual(canAccessRoute('Warehouse Manager', '/warehouse/dashboard'), true, 'WM must retain /warehouse/dashboard');

// 5. Cashier, Salesperson, Accountant (Strictly restricted from Product menu)
console.log('Testing other roles...');
assert.strictEqual(canRoleAccessNavItem('Cashier', 'Product'), false, 'Cashier must NOT see Product in sidebar');
assert.strictEqual(canRoleAccessNavItem('Salesperson', 'Product'), false, 'Salesperson must NOT see Product in sidebar');
assert.strictEqual(canRoleAccessNavItem('Accountant', 'Product'), false, 'Accountant must NOT see Product in sidebar');

console.log('ALL RBAC UNIT TESTS PASSED SUCCESSFULLY! [OK]');
