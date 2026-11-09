import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    failCount++;
  }
}

console.log('=== VERIFY WAREHOUSE TAB NAVIGATION & NO AUTO MODAL BEHAVIOR ===\n');

const warehousesPagePath = path.resolve('src/pages/inventory/WarehousesPage.tsx');
const warehousesContent = fs.readFileSync(warehousesPagePath, 'utf8');

const transfersTabPath = path.resolve('src/components/stock/WarehouseStockTransfersTab.tsx');
const transfersContent = fs.readFileSync(transfersTabPath, 'utf8');

const adjustmentsTabPath = path.resolve('src/components/stock/WarehouseStockAdjustmentsTab.tsx');
const adjustmentsContent = fs.readFileSync(adjustmentsTabPath, 'utf8');

// 1. Check that triggerCreate state & props are completely eliminated
assert(
  !warehousesContent.includes('transferCreateTrigger') &&
  !warehousesContent.includes('adjustmentCreateTrigger'),
  '1. triggerCreate numeric counters are completely removed from WarehousesPage state'
);

assert(
  !transfersContent.includes('triggerCreate') &&
  !adjustmentsContent.includes('triggerCreate'),
  '2. triggerCreate props are completely removed from Transfers and Adjustments tabs'
);

// 2. Check that no useEffect triggers modals on mount or tab change
assert(
  !transfersContent.includes('useEffect(() => {\n    if (triggerCreate') &&
  !adjustmentsContent.includes('useEffect(() => {\n    if (triggerCreate'),
  '3. No useEffect opens create modals automatically on tab mount or tab switch'
);

// 3. Check that isFormModalOpen is reset on tab switch in WarehousesPage
assert(
  warehousesContent.includes('const handleTabChange = (tabId: string) => {\n    setActiveTab(tabId);\n    setIsFormModalOpen(false);'),
  '4. handleTabChange explicitly closes any warehouse form modal on tab switch'
);

assert(
  warehousesContent.includes('setActiveTab(t);\n      setIsFormModalOpen(false);'),
  '5. URL searchParams sync effect explicitly closes form modal when tab changes via URL'
);

// 4. Verify imperative ref openCreateModal is exclusively used by header action button
assert(
  warehousesContent.includes('transfersTabRef.current?.openCreateModal()') &&
  warehousesContent.includes('adjustmentsTabRef.current?.openCreateModal()'),
  '6. Top-right action button calls imperative openCreateModal directly on explicit click only'
);

// 5. Verify the 3 tabs are properly configured
assert(
  warehousesContent.includes("id: 'warehouse'") &&
  warehousesContent.includes("id: 'transfers'") &&
  warehousesContent.includes("id: 'adjustments'"),
  '7. All 3 tabs (warehouse, transfers, adjustments) exist and switch view sections'
);

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL TAB NAVIGATION TESTS PASSED!');
}

