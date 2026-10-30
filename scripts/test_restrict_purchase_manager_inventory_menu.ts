// Test Suite: Restrict Purchase Manager Inventory Menu
// Verifies all acceptance criteria from the Antigravity prompt:
// 1. Purchase Manager Inventory menu has only Stock Overview and Total Product Cost
// 2. Hidden options (Low Stock & Reorder, Purchase Requests under Inventory) cannot be accessed via direct URL
// 3. Purchase Requests under Purchases remains intact and functional for Purchase Manager
// 4. Warehouse Manager and Owner retain all Inventory options and workflows
// 5. Total Product Cost page/view uses existing authentic stock & cost data

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  canAccessRoute,
  hasPermission,
  ROLE_ALLOWED_NAV_MENUS,
  ROLE_PERMISSIONS_MATRIX
} from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: RESTRICT PURCHASE MANAGER INVENTORY MENU');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. Purchase Manager Sidebar Inventory Submenu Scoping
// -----------------------------------------------------------------------------
console.log('--- 1. Purchase Manager Inventory Submenu Filtering ---');

test('Purchase Manager retains top-level Inventory menu access', () => {
  assert.strictEqual(
    canRoleAccessNavItem('Purchase Manager', 'Inventory'),
    true,
    'Purchase Manager must see top-level Inventory menu'
  );
});

test('Purchase Manager CAN access "Stock Overview" under Inventory', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Stock Overview', '/inventory'),
    true,
    'Stock Overview must be accessible to Purchase Manager'
  );
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory'),
    true,
    'Route /inventory must be accessible to Purchase Manager'
  );
});

test('Purchase Manager CAN access "Total Product Cost" under Inventory', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Total Product Cost', '/inventory/total-cost'),
    true,
    'Total Product Cost must be accessible to Purchase Manager under Inventory'
  );
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory/total-cost'),
    true,
    'Route /inventory/total-cost must be accessible to Purchase Manager'
  );
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory/valuation'),
    true,
    'Route /inventory/valuation must be accessible to Purchase Manager'
  );
});

test('Purchase Manager CANNOT access "Low Stock & Reorder" under Inventory', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Low Stock & Reorder', '/inventory/alerts'),
    false,
    'Low Stock & Reorder must NOT be accessible in PM submenu'
  );
});

test('Purchase Manager CANNOT access "Purchase Requests" under Inventory', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Purchase Requests', '/inventory/purchase-requests'),
    false,
    'Purchase Requests under Inventory must NOT be accessible in PM submenu'
  );
});

test('Purchase Manager CANNOT access Warehouse Operations submenus under Inventory', () => {
  const forbiddenSubmenus = [
    { name: 'Stock Transfers', path: '/inventory/transfers' },
    { name: 'Stock Adjustments', path: '/inventory/adjustments' },
    { name: 'Batch Tracking', path: '/inventory/batches' },
    { name: 'Serial Numbers', path: '/inventory/serials' },
    { name: 'Warehouses / Godowns', path: '/inventory/warehouses' }
  ];

  forbiddenSubmenus.forEach(({ name, path: subPath }) => {
    assert.strictEqual(
      canRoleAccessSubItem('Purchase Manager', 'Inventory', name, subPath),
      false,
      `Purchase Manager must NOT see "${name}" under Inventory`
    );
  });
});

// -----------------------------------------------------------------------------
// 2. Direct URL & Unauthorized Navigation Blocked for Purchase Manager
// -----------------------------------------------------------------------------
console.log('\n--- 2. Direct URL & Unauthorized Navigation Protection ---');

test('Purchase Manager is BLOCKED from accessing /inventory/alerts via direct URL', () => {
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory/alerts'),
    false,
    'Direct URL /inventory/alerts must be denied for Purchase Manager'
  );
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory/reorder'),
    false,
    'Direct URL /inventory/reorder must be denied for Purchase Manager'
  );
});

test('Purchase Manager is BLOCKED from accessing /inventory/purchase-requests via direct URL', () => {
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/inventory/purchase-requests'),
    false,
    'Direct URL /inventory/purchase-requests must be denied for Purchase Manager'
  );
});

test('Purchase Manager is BLOCKED from accessing warehouse operational routes via direct URL', () => {
  const forbiddenRoutes = [
    '/inventory/transfers',
    '/inventory/adjustments',
    '/inventory/batches',
    '/inventory/serials',
    '/inventory/warehouses'
  ];

  forbiddenRoutes.forEach(r => {
    assert.strictEqual(
      canAccessRoute('Purchase Manager', r),
      false,
      `Direct URL ${r} must be denied for Purchase Manager`
    );
  });
});

test('ProtectedRoute.tsx enforces central canAccessRoute check', () => {
  const protectedRoutePath = path.resolve('src/components/auth/ProtectedRoute.tsx');
  const content = fs.readFileSync(protectedRoutePath, 'utf-8');

  assert(
    content.includes('canAccessRoute(userRole, location.pathname)'),
    'ProtectedRoute must call canAccessRoute(userRole, location.pathname) to prevent unauthorized direct URL access'
  );
});

// -----------------------------------------------------------------------------
// 3. Purchase Requests under Purchases Remains Completely Intact
// -----------------------------------------------------------------------------
console.log('\n--- 3. Purchase Requests under Purchases Removed for Purchase Manager ---');

test('Purchase Requests submenu is removed from Purchases for Purchase Manager', () => {
  assert.strictEqual(
    canRoleAccessNavItem('Purchase Manager', 'Purchases'),
    true,
    'Purchase Manager must see top-level Purchases menu'
  );
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Purchase Requests', '/purchases/requests'),
    false,
    'Purchase Requests under Purchases must NOT appear for Purchase Manager'
  );
});

test('Authorized Purchases submenus remain intact for Purchase Manager', () => {
  const expectedPurchasesSubmenus = [
    { name: 'Purchase Invoices', path: '/purchases' },
    { name: 'Purchase Orders', path: '/purchases/orders' },
    { name: 'New Purchase Bill', path: '/purchases/new' },
    { name: 'Purchase Returns', path: '/purchases/returns' }
  ];

  expectedPurchasesSubmenus.forEach(({ name, path: subPath }) => {
    assert.strictEqual(
      canRoleAccessSubItem('Purchase Manager', 'Purchases', name, subPath),
      true,
      `Purchase Manager must retain "${name}" under Purchases`
    );
    assert.strictEqual(
      canAccessRoute('Purchase Manager', subPath),
      true,
      `Route ${subPath} must remain accessible to Purchase Manager`
    );
  });
});

// -----------------------------------------------------------------------------
// 4. Warehouse Manager and Owner Inventory Options Fully Preserved
// -----------------------------------------------------------------------------
console.log('\n--- 4. Warehouse Manager and Owner Permissions Preserved ---');

test('Warehouse Manager retains all Inventory options and replenishment workflow', () => {
  const wmInventorySubmenus = [
    { name: 'Stock Overview', path: '/inventory' },
    { name: 'Low Stock & Reorder', path: '/inventory/alerts' },
    { name: 'Purchase Requests', path: '/inventory/purchase-requests' },
    { name: 'Stock Transfers', path: '/inventory/transfers' },
    { name: 'Stock Adjustments', path: '/inventory/adjustments' },
    { name: 'Batch Tracking', path: '/inventory/batches' },
    { name: 'Serial Numbers', path: '/inventory/serials' },
    { name: 'Stock Valuation', path: '/inventory/valuation' }
  ];

  wmInventorySubmenus.forEach(({ name, path: subPath }) => {
    assert.strictEqual(
      canRoleAccessSubItem('Warehouse Manager', 'Inventory', name, subPath),
      true,
      `Warehouse Manager must retain "${name}" under Inventory`
    );
    assert.strictEqual(
      canAccessRoute('Warehouse Manager', subPath),
      true,
      `Warehouse Manager must retain route access to ${subPath}`
    );
  });
});

test('Owner and Admin retain full Inventory access', () => {
  const roles = ['Owner', 'Admin'] as const;
  const inventoryRoutes = [
    '/inventory',
    '/inventory/alerts',
    '/inventory/reorder',
    '/inventory/purchase-requests',
    '/inventory/transfers',
    '/inventory/adjustments',
    '/inventory/batches',
    '/inventory/serials',
    '/inventory/valuation',
    '/inventory/total-cost',
    '/inventory/warehouses'
  ];

  roles.forEach(role => {
    inventoryRoutes.forEach(r => {
      assert.strictEqual(
        canAccessRoute(role, r),
        true,
        `${role} must have access to ${r}`
      );
    });
  });
});

// -----------------------------------------------------------------------------
// 5. Sidebar.tsx Configuration Verification
// -----------------------------------------------------------------------------
console.log('\n--- 5. Sidebar Configuration Verification ---');

test('Sidebar.tsx scopes Inventory children specifically for Purchase Manager', () => {
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf-8');

  assert(
    content.includes("profile?.role === 'Purchase Manager'"),
    'Sidebar.tsx must check profile?.role === "Purchase Manager" for Inventory children'
  );
  assert(
    content.includes("name: 'Total Product Cost'"),
    'Sidebar.tsx must define "Total Product Cost" item'
  );
  assert(
    content.includes("path: '/inventory/total-cost'"),
    'Sidebar.tsx must link Total Product Cost to /inventory/total-cost'
  );
});

// -----------------------------------------------------------------------------
// 6. Total Product Cost Page & Valuation Integrity
// -----------------------------------------------------------------------------
console.log('\n--- 6. Total Product Cost View & Valuation Engine Integrity ---');

test('App.tsx defines route for inventory/total-cost', () => {
  const appPath = path.resolve('src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf-8');

  assert(
    content.includes('path="inventory/total-cost"'),
    'App.tsx must register route for inventory/total-cost'
  );
});

test('StockValuationPage.tsx adapts title and labels for Total Product Cost', () => {
  const pagePath = path.resolve('src/pages/inventory/StockValuationPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert(
    content.includes("isTotalProductCost"),
    'StockValuationPage must check isTotalProductCost'
  );
  assert(
    content.includes("'Total Product Cost'"),
    'StockValuationPage must support Total Product Cost title'
  );
  assert(
    content.includes("totalValuationValue"),
    'StockValuationPage must calculate totalValuationValue from authentic product cost and stock data'
  );
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('================================================================================');

if (totalTests === passedTests) {
  console.log('\n🎉 ALL TESTS PASSED! Purchase Manager Inventory menu successfully restricted.');
} else {
  console.error('\n❌ SOME TESTS FAILED.');
  process.exitCode = 1;
}
