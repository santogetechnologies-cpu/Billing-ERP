import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  hasPermission,
  canAccessRoute,
  canManageProducts,
  canManageInitialStock
} from '../src/utils/rbac';

console.log('================================================================');
console.log('TEST SUITE: Common Initial Stock Add Product Page Consistency');
console.log('================================================================');

async function runTests() {
  // 1. RBAC Tests for canManageInitialStock and canManageProducts
  console.log('\n--- Test 1: RBAC Permissions for Initial Stock ---');
  assert.strictEqual(canManageInitialStock('Owner'), true, 'Owner must have canManageInitialStock = true');
  assert.strictEqual(canManageInitialStock('Admin'), true, 'Admin must have canManageInitialStock = true');
  assert.strictEqual(canManageInitialStock('Purchase Manager'), true, 'Purchase Manager must have canManageInitialStock = true');
  assert.strictEqual(canManageInitialStock('Warehouse Manager'), false, 'Warehouse Manager must have canManageInitialStock = false');
  assert.strictEqual(canManageInitialStock('Cashier'), false, 'Cashier must have canManageInitialStock = false');

  // Verify that any role with explicit products.create permission gets canManageInitialStock = true
  assert.strictEqual(canManageProducts('Owner'), true, 'Owner canManageProducts must be true');
  assert.strictEqual(canManageProducts('Admin'), true, 'Admin canManageProducts must be true');
  assert.strictEqual(canManageProducts('Purchase Manager'), true, 'Purchase Manager canManageProducts must be true');
  console.log('✔ RBAC permission checks passed.');

  // 2. Route accessibility for /products/initial-stock
  console.log('\n--- Test 2: Route Access for /products/initial-stock ---');
  assert.strictEqual(canAccessRoute('Owner', '/products/initial-stock'), true, 'Owner can access /products/initial-stock');
  assert.strictEqual(canAccessRoute('Admin', '/products/initial-stock'), true, 'Admin can access /products/initial-stock');
  assert.strictEqual(canAccessRoute('Purchase Manager', '/products/initial-stock'), true, 'PM can access /products/initial-stock');
  assert.strictEqual(canAccessRoute('Warehouse Manager', '/products/initial-stock'), false, 'WM cannot access /products/initial-stock');
  console.log('✔ Route access verification passed.');

  // 3. ProductListPage.tsx: "New Product" button and ?action=new redirection
  console.log('\n--- Test 3: ProductListPage.tsx Navigation ---');
  const productListContent = fs.readFileSync(path.resolve('src/pages/products/ProductListPage.tsx'), 'utf-8');
  assert(
    productListContent.includes("onClick={() => navigate('/products/initial-stock')}"),
    'ProductListPage "New Product" primary button must navigate to /products/initial-stock'
  );
  assert(
    productListContent.includes("navigate('/products/initial-stock', { replace: true })"),
    'ProductListPage ?action=new query param must redirect to /products/initial-stock'
  );
  // Ensure Edit action still opens edit modal without changing Edit Product functionality
  assert(
    productListContent.includes('handleEditProduct'),
    'ProductListPage preserves handleEditProduct for existing product editing'
  );
  console.log('✔ ProductListPage.tsx navigates to Initial Stock for new products.');

  // 4. Header.tsx: "+ New" quick create dropdown
  console.log('\n--- Test 4: Header.tsx Quick Create Dropdown ---');
  const headerContent = fs.readFileSync(path.resolve('src/components/layout/Header.tsx'), 'utf-8');
  assert(
    headerContent.includes("navigate('/products/initial-stock')"),
    'Header Quick Create "+ New" -> "New Product" must navigate to /products/initial-stock'
  );
  console.log('✔ Header.tsx navigates to /products/initial-stock.');

  // 5. DashboardPage.tsx: Action Bar "Add Product" button
  console.log('\n--- Test 5: DashboardPage.tsx Action Bar ---');
  const dashboardContent = fs.readFileSync(path.resolve('src/pages/dashboard/DashboardPage.tsx'), 'utf-8');
  assert(
    dashboardContent.includes("onClick={() => navigate('/products/initial-stock')}"),
    'DashboardPage "Add Product" button must navigate to /products/initial-stock'
  );
  console.log('✔ DashboardPage.tsx navigates to /products/initial-stock.');

  // 6. BarcodePage.tsx: "+ New Product" button
  console.log('\n--- Test 6: BarcodePage.tsx Generator Form ---');
  const barcodeContent = fs.readFileSync(path.resolve('src/pages/barcode/BarcodePage.tsx'), 'utf-8');
  assert(
    barcodeContent.includes("onClick={() => navigate('/products/initial-stock')}"),
    'BarcodePage "+ New Product" button must navigate to /products/initial-stock'
  );
  console.log('✔ BarcodePage.tsx navigates to /products/initial-stock.');

  // 7. GlobalSearch.tsx & RoleQuickStartCard.tsx
  console.log('\n--- Test 7: Quick Action Links ---');
  const searchContent = fs.readFileSync(path.resolve('src/components/common/GlobalSearch.tsx'), 'utf-8');
  assert(
    searchContent.includes("link: '/products/initial-stock'"),
    'GlobalSearch "Add New Product Master" link must be /products/initial-stock'
  );
  const quickStartContent = fs.readFileSync(path.resolve('src/components/dashboard/RoleQuickStartCard.tsx'), 'utf-8');
  assert(
    quickStartContent.includes("actionPath: '/products/initial-stock'"),
    'RoleQuickStartCard "Add Products & Initial Inventory" must link to /products/initial-stock'
  );
  console.log('✔ GlobalSearch and RoleQuickStartCard links verified.');

  // 8. InitialStockPage.tsx form sections preservation
  console.log('\n--- Test 8: InitialStockPage Form Sections Preservation ---');
  const initialStockContent = fs.readFileSync(path.resolve('src/pages/products/InitialStockPage.tsx'), 'utf-8');
  // Section 1: Identification & Classification
  assert(initialStockContent.includes('Product Identification & Classification'), 'InitialStockPage retains Section 1 heading');
  assert(initialStockContent.includes('Item Name *') || initialStockContent.includes('Product Name'), 'InitialStockPage retains Product Name field');
  assert(initialStockContent.includes('Category *'), 'InitialStockPage retains Category field');
  assert(initialStockContent.includes('SKU'), 'InitialStockPage retains SKU field');
  assert(initialStockContent.includes('Brand / Manufacturer'), 'InitialStockPage retains Brand field');
  assert(initialStockContent.includes('HSN / SAC Code'), 'InitialStockPage retains HSN field');
  assert(initialStockContent.includes('GST Tax Slab'), 'InitialStockPage retains GST Tax Slab field');

  // Section 2: Units of Measurement & Conversions
  assert(initialStockContent.includes('Units of Measurement & Conversions'), 'InitialStockPage retains Section 2 heading');
  assert(initialStockContent.includes('Primary Unit (Purchase/Stock Unit)'), 'InitialStockPage retains Primary Unit');
  assert(initialStockContent.includes('Secondary Unit (Optional)'), 'InitialStockPage retains Secondary Unit');

  // Section 3: Pricing & Valuation
  assert(initialStockContent.includes('Pricing & Valuation'), 'InitialStockPage retains Section 3 heading');
  assert(initialStockContent.includes('Cost / Purchase'), 'InitialStockPage retains Purchase Price');
  assert(initialStockContent.includes('Selling Price'), 'InitialStockPage retains Selling Price');
  assert(initialStockContent.includes('MRP'), 'InitialStockPage retains MRP');

  // Section 4: Product Tracking Details
  assert(initialStockContent.includes('Product Tracking Details'), 'InitialStockPage retains Section 4 heading');
  assert(initialStockContent.includes('Batch Number'), 'InitialStockPage retains Batch Number field');
  assert(initialStockContent.includes('Expiry Date'), 'InitialStockPage retains Expiry Date field');
  assert(initialStockContent.includes('Serial Number') || initialStockContent.includes('serialNumber'), 'InitialStockPage retains Serial Number');

  // Section 5: Opening Stock Intake & Warehouse Allocation
  assert(initialStockContent.includes('Opening Stock Intake & Warehouse Allocation'), 'InitialStockPage retains Section 5 heading');
  assert(initialStockContent.includes('openingStock'), 'InitialStockPage retains openingStock field');

  // Role restriction in InitialStockPage
  assert(
    initialStockContent.includes('canManageInitialStock(profile?.role)'),
    'InitialStockPage uses canManageInitialStock for role validation'
  );
  assert(
    initialStockContent.includes('Access Restricted'),
    'InitialStockPage retains Access Restricted fallback view'
  );
  console.log('✔ InitialStockPage form sections and security verified.');

  // 9. App.tsx Routes verification
  console.log('\n--- Test 9: App.tsx Route Declarations ---');
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert(
    appContent.includes('<Route path="products/new" element={<Navigate to="/products/initial-stock" replace />} />') ||
    appContent.includes('path="products/new"'),
    'App.tsx has route for products/new redirecting to /products/initial-stock'
  );
  assert(
    appContent.includes('path="products/initial-stock"'),
    'App.tsx has route for products/initial-stock'
  );
  assert(
    appContent.includes('customValidator={canManageInitialStock}'),
    'App.tsx protects products/initial-stock with canManageInitialStock validator'
  );
  console.log('✔ App.tsx routing verified.');

  console.log('\n================================================================');
  console.log('ALL 9 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
