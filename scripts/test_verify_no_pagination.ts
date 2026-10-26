import * as fs from 'fs';
import * as path from 'path';

console.log('=== Verifying Removal of Pagination Across Codebase ===\n');

let issuesFound = 0;
const rootDir = process.cwd();

// 1. Verify DataTable.tsx
const dataTableContent = fs.readFileSync(path.join(rootDir, 'src/components/common/DataTable.tsx'), 'utf-8');
if (dataTableContent.includes('Per page:')) {
  console.error('❌ DataTable still contains "Per page:" dropdown');
  issuesFound++;
} else {
  console.log('✅ DataTable has no "Per page" dropdown');
}

if (dataTableContent.includes('Previous Page') || dataTableContent.includes('Next Page') || dataTableContent.includes('currentPage / totalPages')) {
  console.error('❌ DataTable still contains pagination buttons/indicators');
  issuesFound++;
} else {
  console.log('✅ DataTable has no pagination buttons or page count indicators');
}

if (!dataTableContent.includes('const displayedData = sortedData;')) {
  console.error('❌ DataTable does not set displayedData = sortedData directly');
  issuesFound++;
} else {
  console.log('✅ DataTable displays all records directly (displayedData = sortedData)');
}

// 2. Verify InventoryDashboardPage.tsx
const invDashContent = fs.readFileSync(path.join(rootDir, 'src/pages/inventory/InventoryDashboardPage.tsx'), 'utf-8');
if (invDashContent.includes('totalOpPages > 1')) {
  console.error('❌ InventoryDashboardPage still contains operational stock pagination UI');
  issuesFound++;
} else {
  console.log('✅ InventoryDashboardPage has no pagination UI in Current Stock tab');
}
if (!invDashContent.includes('const paginatedOpStock = filteredOperationalStock;')) {
  console.error('❌ InventoryDashboardPage does not set paginatedOpStock = filteredOperationalStock');
  issuesFound++;
} else {
  console.log('✅ InventoryDashboardPage displays all operational stock items continuously');
}

// 3. Verify StockAlertsPage.tsx
const stockAlertsContent = fs.readFileSync(path.join(rootDir, 'src/pages/inventory/StockAlertsPage.tsx'), 'utf-8');
if (stockAlertsContent.includes('totalPages > 1') || stockAlertsContent.includes('Showing {(currentPage - 1)')) {
  console.error('❌ StockAlertsPage still contains pagination UI');
  issuesFound++;
} else {
  console.log('✅ StockAlertsPage has no pagination UI');
}
if (!stockAlertsContent.includes('const paginatedProducts = filteredProducts;')) {
  console.error('❌ StockAlertsPage does not set paginatedProducts = filteredProducts');
  issuesFound++;
} else {
  console.log('✅ StockAlertsPage displays all products continuously');
}

// 4. Verify StockValuationPage.tsx
const stockValuationContent = fs.readFileSync(path.join(rootDir, 'src/pages/inventory/StockValuationPage.tsx'), 'utf-8');
if (stockValuationContent.includes('totalPages > 1') || stockValuationContent.includes('Showing {(currentPage - 1)')) {
  console.error('❌ StockValuationPage still contains pagination UI');
  issuesFound++;
} else {
  console.log('✅ StockValuationPage has no pagination UI');
}
if (!stockValuationContent.includes('const paginatedItems = filteredItems;')) {
  console.error('❌ StockValuationPage does not set paginatedItems = filteredItems');
  issuesFound++;
} else {
  console.log('✅ StockValuationPage displays all valuation items continuously');
}

// 5. Verify PurchaseRequestsPage.tsx
const purchaseReqContent = fs.readFileSync(path.join(rootDir, 'src/pages/purchases/PurchaseRequestsPage.tsx'), 'utf-8');
if (purchaseReqContent.includes('Showing <span className="font-semibold text-slate-700">{(currentPage - 1)')) {
  console.error('❌ PurchaseRequestsPage still contains pagination UI');
  issuesFound++;
} else {
  console.log('✅ PurchaseRequestsPage has no pagination UI');
}
if (!purchaseReqContent.includes('const paginatedRequests = filteredRequests;')) {
  console.error('❌ PurchaseRequestsPage does not set paginatedRequests = filteredRequests');
  issuesFound++;
} else {
  console.log('✅ PurchaseRequestsPage displays all purchase requests continuously');
}

// 6. Verify WarehouseManagerDashboardPage.tsx
const whManagerContent = fs.readFileSync(path.join(rootDir, 'src/pages/warehouse/WarehouseManagerDashboardPage.tsx'), 'utf-8');
if (whManagerContent.includes('Per page:') || whManagerContent.includes('Showing <strong className="font-semibold text-slate-900">{(currentPage - 1)')) {
  console.error('❌ WarehouseManagerDashboardPage still contains pagination UI');
  issuesFound++;
} else {
  console.log('✅ WarehouseManagerDashboardPage has no pagination UI');
}
if (!whManagerContent.includes('const paginatedLowStock = filteredLowStockProducts;')) {
  console.error('❌ WarehouseManagerDashboardPage does not set paginatedLowStock = filteredLowStockProducts');
  issuesFound++;
} else {
  console.log('✅ WarehouseManagerDashboardPage displays all low stock products continuously');
}

// 7. General scan of all files in src/ for "Showing X to Y" or "Per page"
function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.tsx')) {
      const text = fs.readFileSync(fullPath, 'utf-8');
      if (text.includes('Per page:') || text.includes('per page') || text.includes('Per Page')) {
        console.warn(`⚠️ Warning: possible pagination "Per page" in ${path.relative(rootDir, fullPath)}`);
      }
      if (/Showing\s+(?:all\s+)?(?:\d+|\{.*?\})\s+(?:to|of)/i.test(text)) {
        console.warn(`⚠️ Warning: possible "Showing X to Y" in ${path.relative(rootDir, fullPath)}`);
      }
    }
  }
}

console.log('\nScanning all src/**/*.tsx for remaining pagination strings:');
scanDir(path.join(rootDir, 'src'));

console.log(`\nVerification complete. Total blocking issues: ${issuesFound}`);
if (issuesFound > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PAGINATION RESTRICTIONS & CONTROLS SUCCESSFULLY REMOVED!');
}
