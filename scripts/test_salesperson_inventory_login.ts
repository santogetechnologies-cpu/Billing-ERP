import {
  canAccessRoute,
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  hasPermission,
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS
} from '../src/utils/rbac';
import { isNavItemActive } from '../src/components/layout/Sidebar';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING INVENTORY IN SALES PERSON LOGIN');
  console.log('================================================================\n');

  let passed = 0;

  // 1. RBAC Permissions Matrix
  console.log('👉 [1] Verifying Salesperson Inventory RBAC Permissions');
  const spInventoryPerms = ROLE_PERMISSIONS_MATRIX.Salesperson.inventory;
  if (!spInventoryPerms.view) throw new Error('FAIL: Salesperson must have view access to inventory');
  if (spInventoryPerms.create || spInventoryPerms.edit || spInventoryPerms.delete || spInventoryPerms.manage) {
    throw new Error('FAIL: Salesperson must be strictly view-only (no create, edit, delete, manage)');
  }
  console.log('  ✓ Salesperson has inventory: VIEW_ONLY (read-only stock directory)');
  passed++;

  // 2. Navigation Menu Visibility in RBAC
  console.log('👉 [2] Verifying Navigation Menu Visibility in RBAC');
  const allowedMenus = ROLE_ALLOWED_NAV_MENUS.Salesperson;
  if (!allowedMenus.includes('Inventory')) {
    throw new Error('FAIL: ROLE_ALLOWED_NAV_MENUS.Salesperson must include "Inventory"');
  }
  if (!canRoleAccessNavItem('Salesperson', 'Inventory')) {
    throw new Error('FAIL: canRoleAccessNavItem("Salesperson", "Inventory") returned false');
  }
  console.log('  ✓ canRoleAccessNavItem("Salesperson", "Inventory") === true');
  passed++;

  // 3. Sub-Item Access Validation
  console.log('👉 [3] Verifying Sub-Item Scoping');
  if (!canRoleAccessSubItem('Salesperson', 'Inventory', 'Stock Overview', '/inventory')) {
    throw new Error('FAIL: Salesperson must access /inventory subitem');
  }
  if (canRoleAccessSubItem('Salesperson', 'Inventory', 'Warehouses', '/inventory/warehouses')) {
    throw new Error('FAIL: Salesperson must NOT access /inventory/warehouses');
  }
  if (canRoleAccessSubItem('Salesperson', 'Inventory', 'Stock Adjustments', '/inventory/adjustments')) {
    throw new Error('FAIL: Salesperson must NOT access /inventory/adjustments');
  }
  console.log('  ✓ Salesperson permitted for /inventory; forbidden from administrative subroutes');
  passed++;

  // 4. Route Access Protection
  console.log('👉 [4] Verifying Direct Route Access');
  if (!canAccessRoute('Salesperson', '/inventory')) {
    throw new Error('FAIL: canAccessRoute("Salesperson", "/inventory") returned false');
  }
  const forbiddenSubRoutes = [
    '/inventory/transfers',
    '/inventory/adjustments',
    '/inventory/batches',
    '/inventory/serials',
    '/inventory/warehouses',
    '/inventory/alerts',
    '/inventory/purchase-requests'
  ];
  for (const r of forbiddenSubRoutes) {
    if (canAccessRoute('Salesperson', r)) {
      throw new Error(`FAIL: Salesperson must NOT be allowed to access ${r}`);
    }
  }
  console.log('  ✓ /inventory is allowed; all warehouse mutation routes strictly blocked');
  passed++;

  // 5. Sidebar Component Definition & Active State
  console.log('👉 [5] Verifying Sidebar.tsx salespersonNavItems');
  const sidebarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf-8');
  if (!sidebarContent.includes("{ name: 'Inventory', path: '/inventory', icon: Boxes, end: true }")) {
    throw new Error('FAIL: salespersonNavItems does not contain the Inventory item with Boxes icon');
  }
  console.log('  ✓ salespersonNavItems explicitly includes Inventory (/inventory) with Boxes icon');

  const invItem = { name: 'Inventory', path: '/inventory', end: true };
  const salesItem = { name: 'Sales', path: '/sales' };

  if (!isNavItemActive(invItem, '/inventory', true)) {
    throw new Error('FAIL: isNavItemActive for Inventory on /inventory should be true');
  }
  if (!isNavItemActive(invItem, '/inventory?status=low', true)) {
    throw new Error('FAIL: isNavItemActive for Inventory on /inventory?status=low should be true');
  }
  if (isNavItemActive(salesItem, '/inventory', true)) {
    throw new Error('FAIL: Sales item must NOT be active when on /inventory');
  }
  console.log('  ✓ Active nav highlighting works exclusively and accurately for /inventory');
  passed++;

  // 6. View-Only Scoping on InventoryDashboardPage
  console.log('👉 [6] Verifying InventoryDashboardPage Renders Salesperson View');
  const invDashContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/inventory/InventoryDashboardPage.tsx'), 'utf-8');
  if (!invDashContent.includes("if (profile?.role === 'Salesperson')") || !invDashContent.includes('<SalespersonInventoryPage')) {
    throw new Error('FAIL: InventoryDashboardPage must render SalespersonInventoryPage for role Salesperson');
  }
  console.log('  ✓ InventoryDashboardPage serves dedicated SalespersonInventoryPage');
  passed++;

  console.log('================================================================');
  console.log(`🎉 ALL ${passed} VERIFICATION CHECKS PASSED!`);
  console.log('Salesperson login now has full, dedicated access to Inventory.');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
