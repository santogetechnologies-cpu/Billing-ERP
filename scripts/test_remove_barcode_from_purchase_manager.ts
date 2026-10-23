import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  canAccessRoute,
  hasPermission,
  canManageBarcodeOverride,
  ROLE_ALLOWED_NAV_MENUS,
  ROLE_PERMISSIONS_MATRIX
} from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: REMOVE BARCODE MANAGEMENT FROM PURCHASE MANAGER SIDEBAR');
console.log('================================================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name} -> ${err?.message || err}`);
    failed++;
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. Inspect Purchase Manager Sidebar Rendering
// -----------------------------------------------------------------------------
console.log('--- 1. Purchase Manager Sidebar Menu Filtering ---');

test('Purchase Manager CANNOT access top-level Barcode menu', () => {
  assert.strictEqual(
    canRoleAccessNavItem('Purchase Manager', 'Barcode'),
    false,
    'Purchase Manager must not see top-level "Barcode" menu'
  );
  assert.strictEqual(
    canRoleAccessNavItem('Purchase Manager', 'Barcode Management'),
    false,
    'Purchase Manager must not see top-level "Barcode Management" menu'
  );
});

test('Purchase Manager CANNOT access Barcode Management under Purchases submenu', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Barcode Management', '/purchases/barcode-management'),
    false,
    'Purchase Manager must not access Barcode Management under Purchases'
  );
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Barcode Override', '/purchases/barcode-override'),
    false,
    'Purchase Manager must not access Barcode Override under Purchases'
  );
});

test('Sidebar.tsx Purchases children does NOT contain Barcode Management item', () => {
  const sidebarPath = path.resolve('src/components/layout/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  // Find Purchases children array in Sidebar.tsx
  const purchasesMenuMatch = sidebarContent.match(/name:\s*'Purchases',[\s\S]*?children:\s*\[([\s\S]*?)\]\s*\}/);
  assert(purchasesMenuMatch, 'Purchases navigation item must exist in Sidebar.tsx');
  const purchasesChildren = purchasesMenuMatch[1];
  assert(
    !purchasesChildren.includes('/purchases/barcode-management'),
    'Purchases children array MUST NOT contain /purchases/barcode-management'
  );
  assert(
    !purchasesChildren.includes('Barcode Management'),
    'Purchases children array MUST NOT contain Barcode Management item'
  );
});

// -----------------------------------------------------------------------------
// 2. Verify Purchase Requests & All Other Purchase Manager Menus Unchanged
// -----------------------------------------------------------------------------
console.log('\n--- 2. Preserve Authorized Purchase Manager Menus ---');

test('Purchase Manager retains Dashboard access', () => {
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Dashboard'), true);
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/dashboard'), true);
});

test('Purchase Manager retains Purchase Requests access', () => {
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Purchases'), true);
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Purchase Requests', '/purchases/requests'),
    true,
    'Purchase Requests in Purchases submenu must remain accessible to Purchase Manager'
  );
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/requests'), true);
});

test('Purchase Manager retains Purchase Orders access', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Purchase Orders', '/purchases/orders'),
    true
  );
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/orders'), true);
});

test('Purchase Manager retains Purchase Invoices, New Bill, and Purchase Returns', () => {
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Purchase Invoices', '/purchases'),
    true
  );
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'New Purchase Bill', '/purchases/new'),
    true
  );
  assert.strictEqual(
    canRoleAccessSubItem('Purchase Manager', 'Purchases', 'Purchase Returns', '/purchases/returns'),
    true
  );
});

test('Purchase Manager retains Suppliers, Products, Inventory, Expenses, Settings', () => {
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Suppliers'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Products'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Inventory'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Expenses'), true);
  assert.strictEqual(canRoleAccessNavItem('Purchase Manager', 'Settings'), true);
});

// -----------------------------------------------------------------------------
// 3. Ensure Barcode Management Remains Accessible to Warehouse Manager & Authorized Roles
// -----------------------------------------------------------------------------
console.log('\n--- 3. Warehouse Manager & Authorized Role Barcode Access ---');

test('Warehouse Manager CAN access top-level Barcode Management menu', () => {
  assert.strictEqual(
    canRoleAccessNavItem('Warehouse Manager', 'Barcode Management'),
    true,
    'Warehouse Manager must see "Barcode Management" menu'
  );
  assert.strictEqual(
    canRoleAccessNavItem('Warehouse Manager', 'Barcode'),
    true,
    'Warehouse Manager must retain "Barcode" nav menu access'
  );
});

test('Warehouse Manager CAN access /barcode route', () => {
  assert.strictEqual(
    canAccessRoute('Warehouse Manager', '/barcode'),
    true,
    'Warehouse Manager must be authorized to access /barcode'
  );
});

test('Owner and Admin CAN access Barcode Management menu and route', () => {
  assert.strictEqual(canRoleAccessNavItem('Owner', 'Barcode Management'), true);
  assert.strictEqual(canRoleAccessNavItem('Admin', 'Barcode Management'), true);
  assert.strictEqual(canAccessRoute('Owner', '/barcode'), true);
  assert.strictEqual(canAccessRoute('Admin', '/barcode'), true);
});

// -----------------------------------------------------------------------------
// 4. Prevent Unauthorized Purchase Manager Navigation to Barcode Pages
// -----------------------------------------------------------------------------
console.log('\n--- 4. Prevent Purchase Manager Access via Unauthorized Navigation ---');

test('Purchase Manager CANNOT access Warehouse Manager Barcode page (/barcode)', () => {
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/barcode'),
    false,
    'Purchase Manager must be DENIED access to /barcode'
  );
  assert.strictEqual(
    canAccessRoute('Purchase Manager', '/barcode/any-subpath'),
    false,
    'Purchase Manager must be DENIED access to /barcode subpaths'
  );
});

test('Purchase Manager has ALL_DENIED for barcode module in permissions matrix', () => {
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'view'), false);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'create'), false);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'edit'), false);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'manage'), false);
});

test('Purchase Manager cannot manage barcode override', () => {
  assert.strictEqual(
    canManageBarcodeOverride('Purchase Manager'),
    false,
    'Purchase Manager must return false for canManageBarcodeOverride'
  );
});

test('Purchase Manager CANNOT access /purchases/barcode-management or /purchases/barcode-override', () => {
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/barcode-management'), false);
  assert.strictEqual(canAccessRoute('Purchase Manager', '/purchases/barcode-override'), false);
});

// -----------------------------------------------------------------------------
// 5. Integrity Check: Codebase, Components & Pages Not Removed
// -----------------------------------------------------------------------------
console.log('\n--- 5. Verify Pages & Shared Components Integrity ---');

test('BarcodePage.tsx exists and is intact', () => {
  const p = path.resolve('src/pages/barcode/BarcodePage.tsx');
  assert(fs.existsSync(p), 'src/pages/barcode/BarcodePage.tsx must exist');
});

test('BarcodeOverridePage.tsx exists and is intact', () => {
  const p = path.resolve('src/pages/purchases/BarcodeOverridePage.tsx');
  assert(fs.existsSync(p), 'src/pages/purchases/BarcodeOverridePage.tsx must exist');
});

test('barcodeService.ts and barcodeOverrideService.ts exist', () => {
  assert(fs.existsSync(path.resolve('src/services/barcodeService.ts')));
  assert(fs.existsSync(path.resolve('src/services/barcodeOverrideService.ts')));
});

test('BarcodeCanvas.tsx shared component exists', () => {
  assert(fs.existsSync(path.resolve('src/components/barcode/BarcodeCanvas.tsx')));
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log('================================================================================');

if (failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Barcode Management successfully removed from Purchase Manager sidebar.');
}
