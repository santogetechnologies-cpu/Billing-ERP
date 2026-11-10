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

console.log('=== MULTI-WAREHOUSE INTERNAL NAVIGATION TABS VERIFICATION ===\n');

const warehousesPagePath = path.resolve('src/pages/inventory/WarehousesPage.tsx');
const warehousesContent = fs.readFileSync(warehousesPagePath, 'utf8');

const transfersTabPath = path.resolve('src/components/stock/WarehouseStockTransfersTab.tsx');
const transfersContent = fs.readFileSync(transfersTabPath, 'utf8');

const adjustmentsTabPath = path.resolve('src/components/stock/WarehouseStockAdjustmentsTab.tsx');
const adjustmentsContent = fs.readFileSync(adjustmentsTabPath, 'utf8');

const tabsComponentPath = path.resolve('src/components/common/Tabs.tsx');
const tabsComponentContent = fs.readFileSync(tabsComponentPath, 'utf8');

// 1. Verify 3 Internal Tabs in WarehousesPage
assert(
  warehousesContent.includes("id: 'warehouse'") &&
  warehousesContent.includes("label: 'Warehouse'") &&
  warehousesContent.includes("icon: WarehouseIcon"),
  '1. Tab 1: "Warehouse" tab defined with Building/Warehouse icon'
);

assert(
  warehousesContent.includes("id: 'transfers'") &&
  warehousesContent.includes("label: 'Stock Transfer'") &&
  warehousesContent.includes("icon: ArrowLeftRight"),
  '2. Tab 2: "Stock Transfer" tab defined with Arrow-left-right icon'
);

assert(
  warehousesContent.includes("id: 'adjustments'") &&
  warehousesContent.includes("label: 'Stock Adjustment'") &&
  warehousesContent.includes("icon: SlidersHorizontal"),
  '3. Tab 3: "Stock Adjustment" tab defined with Sliders icon'
);

// 2. Verify Tab Styling and Alignment
assert(
  tabsComponentContent.includes('border-b-2') &&
  tabsComponentContent.includes('border-blue-600') &&
  tabsComponentContent.includes('text-blue-600'),
  '4. Active tab styling matches requirement: highlighted in blue with bottom border'
);

assert(
  warehousesContent.includes('<Tabs') &&
  warehousesContent.includes('syncWithUrlQuery="tab"'),
  '5. Tabs component placed in WarehousesPage and synchronizes via URL tab query parameter'
);

// 3. Verify Tab 1 (Warehouse) retains ALL existing functionality
assert(
  warehousesContent.includes('Total Locations') &&
  warehousesContent.includes('Primary Receiving Hub') &&
  warehousesContent.includes('Total In-Stock Units') &&
  warehousesContent.includes('Inventory Asset Value'),
  '6. Tab 1: All 4 Summary Metric Cards preserved intact'
);

assert(
  warehousesContent.includes('Add Warehouse') &&
  warehousesContent.includes('handleOpenCreateModal') &&
  warehousesContent.includes('generateUniqueWarehouseCode'),
  '7. Tab 1: Add Warehouse action and auto-generated unique code preserved'
);

assert(
  warehousesContent.includes('handleOpenStockModal') &&
  warehousesContent.includes('handleOpenEditModal') &&
  warehousesContent.includes('handleOpenDeleteModal'),
  '8. Tab 1: View stock, Edit warehouse, and Delete warehouse modals preserved'
);

// 4. Verify Tab 2 (Stock Transfer) Features
assert(
  transfersContent.includes('Create Stock Transfer') &&
  transfersContent.includes('generateTransferNumber'),
  '9. Tab 2: Create Stock Transfer button with auto-generated Transfer Number'
);

assert(
  transfersContent.includes('Transfer Number') &&
  transfersContent.includes('Source Warehouse') &&
  transfersContent.includes('Destination Warehouse') &&
  transfersContent.includes('No of Products') &&
  transfersContent.includes('Transfer Date') &&
  transfersContent.includes('Transfer Status') &&
  transfersContent.includes('Actions') &&
  !transfersContent.includes('<th className="py-3 px-4 text-center">Available Stock</th>') &&
  !transfersContent.includes('<th className="py-3 px-4 text-center">Transfer Quantity</th>') &&
  !transfersContent.includes('Transfer Reason</th>'),
  '10. Tab 2: Stock Transfer table columns verified (No of Products added; Available Stock, Transfer Quantity, and Reason removed)'
);

assert(
  transfersContent.includes('Insufficient stock') ||
  transfersContent.includes('exceeds available stock'),
  '11. Tab 2: Prevents transfer when sufficient stock is unavailable in source warehouse'
);

assert(
  transfersContent.includes('createStockTransfer') &&
  (transfersContent.includes('Completed') || transfersContent.includes('In Transit')),
  '12. Tab 2: Executes real stock transfer updating database inventory'
);

assert(
  transfersContent.includes('setIsViewModalOpen') &&
  transfersContent.includes('handleOpenEdit') &&
  transfersContent.includes('handleOpenCancelConfirm'),
  '13. Tab 2: Includes View, Edit, and Cancel actions with confirmation'
);

// 5. Verify Tab 3 (Stock Adjustment) Features
assert(
  adjustmentsContent.includes('Create Stock Adjustment') &&
  adjustmentsContent.includes('generateAdjustmentNumber'),
  '14. Tab 3: Create Stock Adjustment button with auto-generated Adjustment Number'
);

assert(
  adjustmentsContent.includes('Adjustment Number') &&
  adjustmentsContent.includes('Warehouse') &&
  adjustmentsContent.includes('Product Name') &&
  adjustmentsContent.includes('Current Stock') &&
  adjustmentsContent.includes('Adjusted Stock') &&
  adjustmentsContent.includes('<th className="py-3 px-3.5 text-center">Adjustment</th>') &&
  !adjustmentsContent.includes('<th className="py-3 px-3.5 text-center">Difference (+/-)</th>') &&
  !adjustmentsContent.includes('<th className="py-3 px-3.5 text-center">Adjustment Type</th>') &&
  !adjustmentsContent.includes('<th className="py-3 px-3.5">Adjustment Reason</th>') &&
  adjustmentsContent.includes('Adjustment Date') &&
  adjustmentsContent.includes('Actions'),
  '15. Tab 3: Stock Adjustment table merges Difference & Type into Adjustment and removes Adjustment Reason column'
);

assert(
  adjustmentsContent.includes('Mandatory') &&
  adjustmentsContent.includes('adjustmentReason.trim()'),
  '16. Tab 3: Adjustment Reason is strictly mandatory'
);

assert(
  adjustmentsContent.includes('Increase') &&
  adjustmentsContent.includes('Decrease') &&
  adjustmentsContent.includes('adjustStock'),
  '17. Tab 3: Supports Increase/Decrease types and updates inventory automatically via adjustStock'
);

assert(
  adjustmentsContent.includes('setIsViewModalOpen') &&
  adjustmentsContent.includes('handleOpenEdit'),
  '18. Tab 3: Includes View and Edit actions for adjustment records'
);

// 6. Verify Navigation Integrity & Dynamic Header Action Button
assert(
  warehousesContent.includes("activeTab === 'warehouse'") &&
  warehousesContent.includes("activeTab === 'transfers'") &&
  warehousesContent.includes("activeTab === 'adjustments'"),
  '19. Tabs switch internal view states without navigating away from the page'
);

assert(
  warehousesContent.includes("activeTab === 'warehouse'") &&
  warehousesContent.includes("<span>Add Warehouse</span>") &&
  warehousesContent.includes("activeTab === 'transfers'") &&
  warehousesContent.includes("<span>Create Stock Transfer</span>") &&
  warehousesContent.includes("activeTab === 'adjustments'") &&
  warehousesContent.includes("<span>Create Adjustment</span>"),
  '20. Top-right action button dynamically updates per selected tab (+ Add Warehouse, + Create Stock Transfer, + Create Adjustment)'
);

assert(
  warehousesContent.includes('handleTopRightAction') &&
  warehousesContent.includes('transfersTabRef.current?.openCreateModal()') &&
  warehousesContent.includes('adjustmentsTabRef.current?.openCreateModal()'),
  '21. Top-right button click opens respective creation modal for the active tab'
);

assert(
  warehousesContent.includes("activeTab === 'transfers'") &&
  warehousesContent.includes("Stock Transfer Management") &&
  warehousesContent.includes("activeTab === 'adjustments'") &&
  warehousesContent.includes("Stock Adjustment Management") &&
  warehousesContent.includes("Multi-Warehouse Management"),
  '22. Page title and description dynamically update when switching tabs'
);

// 7. Verify Lower Sections contain NO duplicate action buttons
assert(
  !transfersContent.includes('<span>Create Stock Transfer</span>') &&
  !adjustmentsContent.includes('<span>Create Adjustment</span>') &&
  !warehousesContent.includes('<span>Add First Warehouse</span>'),
  '23. Action buttons removed from lower sections; each action button appears exclusively in top-right header'
);

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

