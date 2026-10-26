import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Dispatch to Batch & Expiry Date Management Navigation ---');

  const appFile = path.resolve(process.cwd(), 'src/App.tsx');
  const inventoryDashboardFile = path.resolve(process.cwd(), 'src/pages/inventory/InventoryDashboardPage.tsx');
  const batchManagementFile = path.resolve(process.cwd(), 'src/pages/inventory/BatchManagementPage.tsx');
  const dataTableFile = path.resolve(process.cwd(), 'src/components/common/DataTable.tsx');

  const appContent = fs.readFileSync(appFile, 'utf-8');
  const invContent = fs.readFileSync(inventoryDashboardFile, 'utf-8');
  const batchContent = fs.readFileSync(batchManagementFile, 'utf-8');
  const dataTableContent = fs.readFileSync(dataTableFile, 'utf-8');

  // Check 1: App.tsx has route for /inventory/batches mapped to BatchManagementPage
  const hasRoute = appContent.includes('path="inventory/batches"') && appContent.includes('<BatchManagementPage />');
  console.log(hasRoute ? 'PASS: Route inventory/batches is mapped to BatchManagementPage' : 'FAIL: Route mapping missing');

  // Check 2: Dispatch button in InventoryDashboardPage navigates to /inventory/batches
  const hasDispatchNavigation = invContent.includes("navigate(`/inventory/batches?search=");
  console.log(hasDispatchNavigation ? 'PASS: Dispatch button navigates to /inventory/batches with search query' : 'FAIL: Dispatch navigation missing');

  // Check 3: Dispatch button passes batch context in state
  const hasDispatchState = invContent.includes('fromDispatch: true') &&
    invContent.includes('batchNumber: b.batchNumber') &&
    invContent.includes('productId: b.productId');
  console.log(hasDispatchState ? 'PASS: Dispatch button passes batchNumber, productId and fromDispatch in location state' : 'FAIL: Dispatch state context missing');

  // Check 4: Dispatch button styling and label preserved
  const hasDispatchStyling = invContent.includes('inline-flex items-center justify-center px-3 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs cursor-pointer') &&
    /Dispatch\s*<\/button>/.test(invContent);
  console.log(hasDispatchStyling ? 'PASS: Dispatch button styling, label and dimensions preserved' : 'FAIL: Dispatch button styling altered');

  // Check 5: BatchManagementPage handles dispatchContext
  const hasBatchContext = batchContent.includes('dispatchContext') &&
    batchContent.includes('fromDispatch') &&
    batchContent.includes('initialSearchTerm={dispatchContext.searchTerm}');
  console.log(hasBatchContext ? 'PASS: BatchManagementPage extracts dispatchContext and binds initialSearchTerm' : 'FAIL: BatchManagementPage context handling missing');

  // Check 6: BatchManagementPage renders context indicator banner
  const hasContextBanner = batchContent.includes('Dispatch Context Alert') || batchContent.includes('Showing batch inventory for');
  console.log(hasContextBanner ? 'PASS: BatchManagementPage renders identification banner for dispatch context' : 'FAIL: Identification banner missing');

  // Check 7: DataTable supports initialSearchTerm
  const hasDataTableSupport = dataTableContent.includes('initialSearchTerm?: string') &&
    dataTableContent.includes('setSearchTerm(initialSearchTerm)');
  console.log(hasDataTableSupport ? 'PASS: DataTable supports dynamic initialSearchTerm' : 'FAIL: DataTable initialSearchTerm missing');

  const allPassed = hasRoute && hasDispatchNavigation && hasDispatchState && hasDispatchStyling && hasBatchContext && hasContextBanner && hasDataTableSupport;

  if (allPassed) {
    console.log('\nAll 7 verification checks PASSED successfully!');
  } else {
    console.error('\nSome checks FAILED.');
    process.exit(1);
  }
}

runTests();
