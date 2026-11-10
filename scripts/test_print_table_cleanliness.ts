import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Print Table Cleanliness & Fixes ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  const baseDir = path.resolve('C:/Users/mijil/OneDrive/Desktop/New');
  const dataTablePath = path.join(baseDir, 'src/components/common/DataTable.tsx');
  const productListPagePath = path.join(baseDir, 'src/pages/products/ProductListPage.tsx');
  const suppliersPagePath = path.join(baseDir, 'src/pages/suppliers/SuppliersPage.tsx');
  const customersPagePath = path.join(baseDir, 'src/pages/customers/CustomersPage.tsx');
  const indexCssPath = path.join(baseDir, 'src/index.css');

  const dataTableContent = fs.readFileSync(dataTablePath, 'utf8');
  const productListPageContent = fs.readFileSync(productListPagePath, 'utf8');
  const suppliersPageContent = fs.readFileSync(suppliersPagePath, 'utf8');
  const customersPageContent = fs.readFileSync(customersPagePath, 'utf8');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  // Test 1: Asynchronous print execution to guarantee popover closes before print
  assert(
    dataTableContent.includes('handlePrintTable') &&
    dataTableContent.includes('setTimeout') &&
    dataTableContent.includes('setShowExportMenu(false)'),
    'DataTable uses handlePrintTable with setTimeout to ensure popover unmounts before print preview'
  );

  // Test 2: Popover menus have print:hidden and no-print
  assert(
    dataTableContent.includes('glass-dropdown rounded-lg py-1 text-xs z-30 print:hidden no-print') &&
    dataTableContent.includes('glass-dropdown rounded-lg p-2 text-xs space-y-1 z-30 print:hidden no-print'),
    'Export and Column dropdown menus have print:hidden and no-print classes'
  );

  // Test 3: Search, filters, and toolbar controls have print:hidden and no-print
  assert(
    dataTableContent.includes('print:hidden no-print') &&
    dataTableContent.includes('Search Box') &&
    dataTableContent.includes('Filters & Toolbar Buttons'),
    'Toolbar search input and filter selects are marked print:hidden no-print'
  );

  // Test 4: Checkbox column is hidden in print
  assert(
    dataTableContent.includes('w-11 min-w-[44px] max-w-[44px] px-2 py-3 text-center align-middle print:hidden no-print') &&
    dataTableContent.includes('w-11 min-w-[44px] max-w-[44px] px-2 py-2.5 text-center align-middle print:hidden no-print'),
    'Table selection checkboxes (header and row) are marked print:hidden no-print'
  );

  // Test 5: Action columns (both key="actions" and actions prop) are hidden in print
  assert(
    dataTableContent.includes('isActionCol') &&
    dataTableContent.includes('isAction ? \'print:hidden no-print\''),
    'Action columns and buttons are automatically detected and marked print:hidden no-print'
  );

  // Test 6: Table container and table element have overflow-visible and full width in print
  assert(
    dataTableContent.includes('print:overflow-visible') &&
    dataTableContent.includes('print:w-full') &&
    dataTableContent.includes('print:min-w-0'),
    'Table container and table element expand cleanly without scroll clipping in print'
  );

  // Test 7: ProductListPage has action buttons, tabs, and actions column hidden in print
  assert(
    productListPageContent.includes('New Product</span>') &&
    productListPageContent.includes('print:hidden no-print') &&
    productListPageContent.includes('Tabs') &&
    productListPageContent.includes('className: \'print:hidden no-print\''),
    'ProductListPage has New Product button, Tabs, and Actions column marked print:hidden no-print'
  );

  // Test 8: index.css hides scrollbars, popups, and forces width: auto and 100% width on tables in @media print
  assert(
    indexCssContent.includes('::-webkit-scrollbar') &&
    indexCssContent.includes('display: none !important') &&
    indexCssContent.includes('.glass-dropdown') &&
    indexCssContent.includes('width: auto !important') &&
    indexCssContent.includes('overflow: visible !important'),
    'src/index.css suppresses scrollbars/popups and forces width: auto on th/td to prevent right-side truncation in @media print'
  );

  // Test 9: SuppliersPage has the entire top header card hidden in print
  assert(
    suppliersPageContent.includes('Supplier Details & Management') &&
    suppliersPageContent.includes('border-slate-200/90 dark:border-slate-800 shadow-2xs print:hidden no-print'),
    'SuppliersPage has entire top header card (icon, title, description, and button) hidden in print'
  );

  // Test 10: CustomersPage has the entire top header card hidden in print
  assert(
    customersPageContent.includes('Customer Details & Management') &&
    customersPageContent.includes('border-slate-200/90 dark:border-slate-800 shadow-2xs print:hidden no-print'),
    'CustomersPage has entire top header card (icon, title, description, and button) hidden in print'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
