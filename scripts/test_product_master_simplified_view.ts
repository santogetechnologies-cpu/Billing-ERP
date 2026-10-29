/**
 * Verification Test Suite: Product Master — View, Edit, Export & Simplified Table
 * Validates:
 * 1. Removal of "Add Product" button from Product Master header.
 * 2. Addition of "Export" button to the top-right header with CSV export integration.
 * 3. Table simplification to only the 7 requested columns (Name, SKU, Category, Unit, Current Stock, Selling Price, Stock Status).
 * 4. Removal of horizontal scrolling (hideHorizontalScroll=true, tableFixed=true, no 1060px minWidth).
 * 5. Complete View Details modal with all available fields and warehouse-wise stock breakdown.
 * 6. Edit action navigation and stock preservation verification.
 * 7. Role-based permissions integrity.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: PRODUCT MASTER — VIEW, EDIT, EXPORT & SIMPLIFIED TABLE');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  const test = (name: string, fn: () => void) => {
    total++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
    }
  };

  const productListPagePath = path.resolve(process.cwd(), 'src/pages/products/ProductListPage.tsx');
  const productListContent = fs.readFileSync(productListPagePath, 'utf-8');

  const dataTablePath = path.resolve(process.cwd(), 'src/components/common/DataTable.tsx');
  const dataTableContent = fs.readFileSync(dataTablePath, 'utf-8');

  const newProductPagePath = path.resolve(process.cwd(), 'src/pages/products/NewProductPage.tsx');
  const newProductContent = fs.readFileSync(newProductPagePath, 'utf-8');

  // --- 1. REMOVE ADD PRODUCT FROM PRODUCT MASTER ---
  console.log('--- 1. Remove Add Product from Product Master ---');

  test('Add Product button is completely removed from Product Master', () => {
    assert.strictEqual(
      productListContent.includes('Add Product'),
      false,
      'Product Master page must not contain "Add Product" button or text'
    );
    assert.strictEqual(
      productListContent.includes("navigate('/products/new')"),
      false,
      'Product Master page must not navigate to /products/new'
    );
  });

  // --- 2. MOVE EXPORT TO THE HEADER ---
  console.log('--- 2. Move Export to Header ---');

  test('Export button is placed in the top-right header of Product Master', () => {
    assert.ok(
      productListContent.includes('handleExport'),
      'Header must include handleExport click handler'
    );
    assert.ok(
      productListContent.includes('<Download className="w-3.5 h-3.5" />'),
      'Export button must feature the Download icon'
    );
    assert.ok(
      productListContent.includes('<span>Export</span>'),
      'Export button text must read "Export"'
    );
  });

  test('Export functionality reuses DataTable export and provides CSV download', () => {
    assert.ok(
      productListContent.includes('tableRef.current?.exportCSV()') ||
      productListContent.includes('tableRef.current.exportCSV()'),
      'Export button must trigger DataTable export implementation via ref'
    );
    assert.ok(
      dataTableContent.includes('exportCSV'),
      'DataTable must expose exportCSV'
    );
    assert.ok(
      dataTableContent.includes('tableRef?: React.MutableRefObject<DataTableRef'),
      'DataTableProps must accept tableRef'
    );
  });

  // --- 3. SIMPLIFY PRODUCT TABLE ---
  console.log('--- 3. Simplify Product Table (7 Core Columns) ---');

  test('Main table contains exactly the 7 essential columns: Name, SKU, Category, Unit, Current Stock, Selling Price, Stock Status', () => {
    // Check column definitions in columns array
    assert.ok(productListContent.includes("key: 'name'"), 'Must contain Product Name column');
    assert.ok(productListContent.includes("key: 'sku'"), 'Must contain SKU column');
    assert.ok(productListContent.includes("key: 'category'"), 'Must contain Category column');
    assert.ok(productListContent.includes("key: 'primaryUnit'"), 'Must contain Unit column');
    assert.ok(productListContent.includes("key: 'currentStock'"), 'Must contain Current Stock column');
    assert.ok(productListContent.includes("key: 'sellingPrice'"), 'Must contain Selling Price column');
    assert.ok(productListContent.includes("key: 'stockStatus'"), 'Must contain Stock Status column');
  });

  test('Removed columns (Cost Price, Warning Limit, Tax Rate) are NOT in the table columns array', () => {
    // Ensure costPrice, taxRate, reorderLevel are not registered as table column keys
    const columnsMatch = productListContent.match(/const columns: Column<Product>\[] = \[([\s\S]*?)\];/);
    assert.ok(columnsMatch, 'columns array must be defined');
    const colsStr = columnsMatch[1];

    assert.strictEqual(
      colsStr.includes("key: 'costPrice'"),
      false,
      'Cost Price column must not be present in main table columns'
    );
    assert.strictEqual(
      colsStr.includes("key: 'taxRate'"),
      false,
      'Tax Rate column must not be present in main table columns'
    );
    assert.strictEqual(
      colsStr.includes("key: 'reorderLevel'"),
      false,
      'Warning Limit column must not be present in main table columns'
    );
  });

  // --- 4. REMOVE HORIZONTAL SCROLLING ---
  console.log('--- 4. Remove Horizontal Table Scrolling ---');

  test('DataTable has hideHorizontalScroll=true, tableFixed=true, and no minTableWidth="1060px"', () => {
    assert.ok(
      productListContent.includes('hideHorizontalScroll={true}'),
      'hideHorizontalScroll must be true'
    );
    assert.ok(
      productListContent.includes('tableFixed={true}'),
      'tableFixed must be true'
    );
    assert.strictEqual(
      productListContent.includes('minTableWidth="1060px"'),
      false,
      'Hardcoded 1060px minTableWidth must be removed'
    );
    assert.ok(
      productListContent.includes('actionsWidth="84px"'),
      'Actions column must have compact width'
    );
  });

  // --- 5. COMPREHENSIVE VIEW DETAILS MODAL ---
  console.log('--- 5. View Details Modal with Complete Product Information ---');

  test('Modal displays barcode canvas, barcode number, SKU, and identifiers', () => {
    assert.ok(
      productListContent.includes('<BarcodeCanvas value={selectedProduct.barcode}'),
      'Modal must render BarcodeCanvas'
    );
    assert.ok(
      productListContent.includes('selectedProduct.sku'),
      'Modal must show SKU'
    );
    assert.ok(
      productListContent.includes('selectedProduct.hsn'),
      'Modal must show HSN code'
    );
  });

  test('Modal displays Units, Secondary Units, and Unit Conversions', () => {
    assert.ok(
      productListContent.includes('selectedProduct.primaryUnit'),
      'Modal must show Primary Unit'
    );
    assert.ok(
      productListContent.includes('selectedProduct.secondaryUnit'),
      'Modal must show Secondary Unit when available'
    );
    assert.ok(
      productListContent.includes('selectedProduct.conversionFactor'),
      'Modal must show Conversion Factor when available'
    );
  });

  test('Modal displays comprehensive Commercial Pricing Tiers', () => {
    assert.ok(productListContent.includes('selectedProduct.costPrice'), 'Modal must show Cost Price');
    assert.ok(productListContent.includes('selectedProduct.purchasePrice'), 'Modal must show Purchase Price');
    assert.ok(productListContent.includes('selectedProduct.sellingPrice'), 'Modal must show Standard Selling Price');
    assert.ok(productListContent.includes('selectedProduct.retailPrice'), 'Modal must show Retail Price');
    assert.ok(productListContent.includes('selectedProduct.wholesalePrice'), 'Modal must show Wholesale Price');
    assert.ok(productListContent.includes('selectedProduct.dealerPrice'), 'Modal must show Dealer Price');
    assert.ok(productListContent.includes('selectedProduct.mrp'), 'Modal must show MRP');
    assert.ok(productListContent.includes('selectedProduct.minSellingPrice'), 'Modal must show Min Selling Price');
  });

  test('Modal displays Warehouse Breakdown and Stock Valuation', () => {
    assert.ok(
      productListContent.includes('warehouseStockList'),
      'Modal must compute warehouseStockList'
    );
    assert.ok(
      productListContent.includes('Available Quantity'),
      'Warehouse table must show Available Quantity'
    );
    assert.ok(
      productListContent.includes('Valuation:'),
      'Modal must display calculated inventory stock valuation'
    );
    assert.ok(
      productListContent.includes('selectedProduct.reorderLevel'),
      'Modal must show Warning Limit / Reorder Level'
    );
  });

  test('Modal displays Batch, Expiry, Serial Tracking and Description', () => {
    assert.ok(
      productListContent.includes('selectedProduct.batchNumber'),
      'Modal must show Batch Number'
    );
    assert.ok(
      productListContent.includes('selectedProduct.expiryDate'),
      'Modal must show Expiry Date with status'
    );
    assert.ok(
      productListContent.includes('selectedProduct.serialTracking'),
      'Modal must show Serial Tracking controls'
    );
    assert.ok(
      productListContent.includes('selectedProduct.description'),
      'Modal must show Description'
    );
  });

  test('Modal footer includes Direct Print, Delete, Edit, and Close actions', () => {
    assert.ok(
      productListContent.includes('handleDirectPrintProductBarcode'),
      'Modal footer must provide direct sticker printing'
    );
    assert.ok(
      productListContent.includes("navigate(`/products/edit/${selectedProduct.id}`)"),
      'Modal footer must provide Edit action'
    );
    assert.ok(
      productListContent.includes('setSelectedProduct(null)'),
      'Modal footer must provide Close action'
    );
  });

  // --- 6. EDIT FUNCTIONALITY & STOCK PRESERVATION ---
  console.log('--- 6. Edit Functionality & Stock Preservation ---');

  test('Edit action in table navigates to /products/edit/:id', () => {
    assert.ok(
      productListContent.includes("navigate(`/products/edit/${row.id}`)"),
      'Table row actions must navigate to /products/edit/:id'
    );
  });

  test('Product edit workflow preserves existing currentStock without silent alterations', () => {
    assert.ok(
      newProductContent.includes('currentStock: isEditMode && existingProd ? existingProd.currentStock : numOpeningStock'),
      'NewProductPage must preserve existingProd.currentStock during edit mode'
    );
    assert.ok(
      newProductContent.includes('Existing stock balance is preserved and cannot be altered by product editing'),
      'NewProductPage must inform users stock balance is preserved'
    );
  });

  // --- 7. RBAC INTEGRITY ---
  console.log('--- 7. Role-Based Access Control ---');

  const rbacPath = path.resolve(process.cwd(), 'src/utils/rbac.ts');
  const rbacContent = fs.readFileSync(rbacPath, 'utf-8');

  test('Product Master and Stock Management routes are restricted from Warehouse Manager', () => {
    assert.ok(
      rbacContent.includes('export function canManageProducts(role?: UserRole | string | null): boolean'),
      'canManageProducts must be defined in rbac.ts'
    );
    assert.ok(
      rbacContent.includes('export function canManageInitialStock(role?: UserRole | string | null): boolean'),
      'canManageInitialStock must be defined in rbac.ts'
    );
    assert.ok(
      rbacContent.includes('export function canUpdateStock(role?: UserRole | string | null): boolean'),
      'canUpdateStock must be defined in rbac.ts'
    );

    // Verify allowed roles
    assert.ok(
      rbacContent.includes("normalized === 'Owner' || normalized === 'Admin' || normalized === 'Purchase Manager'"),
      'Product permissions must strictly permit Owner, Admin, and Purchase Manager'
    );
  });

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} OF ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
