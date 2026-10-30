import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🧪 TEST: Stock Overview Cards Display-Only & View Catalog Navigation');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, failureReason?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (failureReason) console.error(`   Reason: ${failureReason}`);
      process.exitCode = 1;
    }
  }

  // 1. Check PurchaseManagerDashboardPage.tsx
  console.log('--- Step 1: Checking PurchaseManagerDashboardPage.tsx stock overview cards ---');
  const dashboardPath = path.resolve(process.cwd(), 'src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  // Verify that slices in stockData do not have onClick navigation handlers
  assert(
    !dashboardContent.includes("onClick: () => navigate('/inventory/alerts')") &&
    !dashboardContent.includes("onClick: () => navigate('/products')"),
    'stockData slices have no onClick navigation handlers'
  );

  // Verify that the stock breakdown items are rendered as <div> and NOT <button>
  const statusLegendSnippet = dashboardContent.slice(
    dashboardContent.indexOf('Status Breakdown Legend'),
    dashboardContent.indexOf('Status Breakdown Legend') + 1200
  );

  assert(
    statusLegendSnippet.includes('<div') &&
    !statusLegendSnippet.includes('<button') &&
    !statusLegendSnippet.includes('onClick='),
    'Low Stock, Limited Stock, and Active Stock rows are rendered as non-clickable <div> elements'
  );

  assert(
    statusLegendSnippet.includes('cursor-default') &&
    !statusLegendSnippet.includes('cursor-pointer'),
    'Removed pointer cursor from stock overview cards and Product badges (cursor-default applied)'
  );

  assert(
    dashboardContent.includes('{slice.label}') &&
    dashboardContent.includes('({slice.pct}%)') &&
    dashboardContent.includes('{formatNumber(slice.count)}') &&
    dashboardContent.includes("{slice.count === 1 ? 'Product' : 'Products'}"),
    'Preserved counts, percentages, and Product/Products labels in display-only cards'
  );

  // Verify View Catalog button
  assert(
    dashboardContent.includes('<span>View Catalog</span>') &&
    dashboardContent.includes("onClick={() => navigate('/products')}"),
    'View Catalog button is functional and navigates directly to /products'
  );

  // 2. Check ProductListPage.tsx
  console.log('\n--- Step 2: Checking ProductListPage.tsx (/products catalog) ---');
  const productListPath = path.resolve(process.cwd(), 'src/pages/products/ProductListPage.tsx');
  const productListContent = fs.readFileSync(productListPath, 'utf8');

  assert(
    productListContent.includes('Product Master & Inventory Catalog') &&
    productListContent.includes('data={productsWithStatus}'),
    'ProductListPage renders complete product master and inventory catalog'
  );

  assert(
    productListContent.includes("key: 'name'") &&
    productListContent.includes("key: 'sku'") &&
    productListContent.includes("key: 'category'") &&
    productListContent.includes("key: 'currentStock'") &&
    productListContent.includes("key: 'stockStatus'") &&
    productListContent.includes("key: 'sellingPrice'"),
    'Catalog table includes Name, SKU, Category, Current Stock, Status, and Price columns'
  );

  assert(
    productListContent.includes('warehouseStockList') &&
    productListContent.includes('setSelectedProduct(row)'),
    'Product modal view allows inspecting warehouse-wise stock breakdown'
  );

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} checks passed successfully.`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test script encountered an error:', err);
  process.exit(1);
});
