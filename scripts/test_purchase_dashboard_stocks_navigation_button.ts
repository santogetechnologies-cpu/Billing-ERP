import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const rootDir = process.cwd();
const dashboardPath = path.join(rootDir, 'src', 'pages', 'purchases', 'PurchaseManagerDashboardPage.tsx');
const productListPath = path.join(rootDir, 'src', 'pages', 'products', 'ProductListPage.tsx');

console.log('--- Verifying Purchase Manager Dashboard Stocks Navigation Button ---');

const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
const productListCode = fs.readFileSync(productListPath, 'utf-8');

// 1. Verify Stocks button in PurchaseManagerDashboardPage
assert(dashboardCode.includes('Boxes'), 'Imports or uses Boxes icon from lucide-react');
assert(dashboardCode.includes('stocksCount'), 'Calculates stocksCount using products');
assert(dashboardCode.includes('navigate(\'/products\')'), 'Navigates to /products on clicking Stocks button');
assert(dashboardCode.includes('>Stocks</span>'), 'Displays "Stocks" button label');
assert(dashboardCode.includes('View all product stock'), 'Displays "View all product stock" subtitle and title');
assert(dashboardCode.includes('orderStatusNavigationCounts.stocksCount'), 'Displays stocks count badge');

// 2. Verify Ordered, Delivered, Overdue buttons remain unchanged
assert(dashboardCode.includes('navigate(\'/purchases/orders?status=Ordered\')'), 'Ordered button still navigates to status=Ordered');
assert(dashboardCode.includes('navigate(\'/purchases/orders?status=Received\')'), 'Delivered button still navigates to status=Received');
assert(dashboardCode.includes('navigate(\'/purchases/orders?status=Overdue\')'), 'Overdue button still navigates to status=Overdue');
assert(dashboardCode.includes('>Ordered</span>'), 'Ordered button label preserved');
assert(dashboardCode.includes('>Delivered</span>'), 'Delivered button label preserved');
assert(dashboardCode.includes('>Overdue</span>'), 'Overdue button label preserved');

// 3. Verify Product Master page (/products)
assert(productListCode.includes('sortProductsAZ') || productListCode.includes('defaultSortKey="name"'), 'Alphabetical default sort in ProductListPage');
assert(productListCode.includes('warehouseStockList') || productListCode.includes('stockBalances'), 'Warehouse-wise stock available in ProductListPage');
assert(productListCode.includes('currentStock'), 'Displays current stock in ProductListPage');
assert(productListCode.includes('sellingPrice'), 'Displays price in ProductListPage');
assert(productListCode.includes('stockStatus'), 'Displays stock status in ProductListPage');
assert(productListCode.includes('selectedProduct'), 'Has View product details modal');

// 4. Verify safety: protected pages remain untouched
const initialStockPath = path.join(rootDir, 'src', 'pages', 'products', 'InitialStockPage.tsx');
const updateStockPath = path.join(rootDir, 'src', 'pages', 'products', 'UpdateStockPage.tsx');
assert(fs.existsSync(initialStockPath), 'InitialStockPage.tsx exists');
assert(fs.existsSync(updateStockPath), 'UpdateStockPage.tsx exists');

console.log('🎉 All Purchase Dashboard Stocks Navigation Button checks PASSED!');

