import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  canRoleAccessNavItem,
  canAccessRoute,
  hasPermission,
  normalizeRole,
  ROLE_ALLOWED_NAV_MENUS,
  ROLE_PERMISSIONS_MATRIX
} from '../src/utils/rbac';

console.log('================================================================================');
console.log('TEST SUITE: PURCHASE MANAGER CONNECT EXISTING BARCODES & LABELS SIDEBAR');
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
// 1. Sidebar Item Verification for Purchase Manager
// -----------------------------------------------------------------------------
console.log('--- 1. Purchase Manager Sidebar Navigation ---');

test('Purchase Manager can access existing "Barcodes & Labels" sidebar item', () => {
  const canAccess = canRoleAccessNavItem('Purchase Manager', 'Barcodes & Labels', 'barcode');
  assert.strictEqual(canAccess, true, 'Purchase Manager must have access to Barcodes & Labels sidebar item');
});

test('Sidebar.tsx includes Barcodes & Labels pointing to /barcode', () => {
  const sidebarContent = fs.readFileSync(path.resolve('src/components/layout/Sidebar.tsx'), 'utf-8');
  assert(sidebarContent.includes("id: 'barcode'"), 'Sidebar must have barcode item');
  assert(sidebarContent.includes("name: 'Barcodes & Labels'"), 'Sidebar must have Barcodes & Labels name');
  assert(sidebarContent.includes("path: '/barcode'"), 'Sidebar must point to /barcode');
});

// -----------------------------------------------------------------------------
// 2. Route & Permission RBAC Checks
// -----------------------------------------------------------------------------
console.log('\n--- 2. RBAC Route & Permission Checks ---');

test('Purchase Manager is authorized to access /barcode route', () => {
  const canAccess = canAccessRoute('Purchase Manager', '/barcode');
  assert.strictEqual(canAccess, true, 'canAccessRoute for Purchase Manager on /barcode must be true');
});

test('Purchase Manager has view, create, edit permission on barcode module', () => {
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'view'), true);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'create'), true);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'edit'), true);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'delete'), false);
  assert.strictEqual(hasPermission('Purchase Manager', 'barcode', 'manage'), false);
});

test('Other roles permissions are strictly preserved', () => {
  // Warehouse Manager
  assert.strictEqual(hasPermission('Warehouse Manager', 'barcode', 'view'), true);
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/barcode'), true);

  // Admin & Owner
  assert.strictEqual(hasPermission('Admin', 'barcode', 'view'), true);
  assert.strictEqual(canAccessRoute('Admin', '/barcode'), true);
  assert.strictEqual(hasPermission('Owner', 'barcode', 'view'), true);
  assert.strictEqual(canAccessRoute('Owner', '/barcode'), true);

  // Salesperson & Cashier must remain blocked from barcode
  assert.strictEqual(hasPermission('Salesperson', 'barcode', 'view'), false);
  assert.strictEqual(canAccessRoute('Salesperson', '/barcode'), false);
  assert.strictEqual(hasPermission('Cashier', 'barcode', 'view'), false);
  assert.strictEqual(canAccessRoute('Cashier', '/barcode'), false);
});

// -----------------------------------------------------------------------------
// 3. BarcodePage & ProductLabelsTab Component Reuse Checks
// -----------------------------------------------------------------------------
console.log('\n--- 3. Screen & Component Verification ---');

test('BarcodePage.tsx imports and renders ProductLabelsTab for Purchase Manager', () => {
  const barcodePageContent = fs.readFileSync(path.resolve('src/pages/barcode/BarcodePage.tsx'), 'utf-8');
  assert(barcodePageContent.includes("import { ProductLabelsTab } from '../../components/products/ProductLabelsTab';"));
  assert(barcodePageContent.includes("normalizedRole === 'Purchase Manager'"));
  assert(barcodePageContent.includes('<ProductLabelsTab />'));
});

test('ProductLabelsTab.tsx contains all required screen elements', () => {
  const tabContent = fs.readFileSync(path.resolve('src/components/products/ProductLabelsTab.tsx'), 'utf-8');

  // Option A
  assert(tabContent.includes('Option A: Print Custom In-House Stickers'), 'Includes Option A');
  // Option B
  assert(tabContent.includes('Option B: Use Pre-Printed Manufacturer Barcode'), 'Includes Option B');
  // Custom Sticker Designer
  assert(tabContent.includes('Custom Sticker Designer'), 'Includes Custom Sticker Designer');
  // Product selection
  assert(tabContent.includes('Select Product') && tabContent.includes('handleSelectProduct'), 'Includes Product Selection');
  // Sticker sizes
  assert(tabContent.includes('Sticker Size') && tabContent.includes('50x25') && tabContent.includes('38x25') && tabContent.includes('100x50'), 'Includes Sticker Sizes');
  // Visible Elements
  assert(tabContent.includes('Visible Elements') && tabContent.includes('showPrice') && tabContent.includes('showMrp') && tabContent.includes('showCategory'), 'Includes Visible Elements');
  // Number of Copies
  assert(tabContent.includes('Number of Copies') && tabContent.includes('copies'), 'Includes Number of Copies');
  // Barcode preview and printing
  assert(tabContent.includes('<BarcodeCanvas') && tabContent.includes('handlePrintCustomSticker'), 'Includes Barcode preview & printing');
});

test('Labels & Barcodes tab removed from Products & Catalog', () => {
  const productListContent = fs.readFileSync(path.resolve('src/pages/products/ProductListPage.tsx'), 'utf-8');
  assert(!productListContent.includes("{ id: 'labels'"), 'Labels tab should be removed from tabs array');
  assert(!productListContent.includes('<ProductLabelsTab'), 'ProductLabelsTab component should not be rendered in ProductListPage');
  assert(productListContent.includes("{ id: 'all'"), 'All Products tab remains');
  assert(productListContent.includes("{ id: 'categories'"), 'Categories tab remains');
  assert(productListContent.includes("{ id: 'pricing'"), 'Pricing tab remains');
  assert(productListContent.includes("{ id: 'import_export'"), 'Import/Export tab remains');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}
