import fs from 'fs';
import { calculateStockStatus } from '../src/utils/inventoryUtils';
import { formatNumber } from '../src/utils/formatters';

async function runWarehouseLowStockRedesignTests() {
  console.log('--- TESTING WAREHOUSE MANAGER LOW STOCK TABLE REDESIGN ---');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    const wmFile = 'src/pages/warehouse/WarehouseManagerDashboardPage.tsx';
    const wmContent = fs.readFileSync(wmFile, 'utf8');

    // 1. Verify Priority Column is completely removed from the Low Stock table
    assert(!wmContent.includes('>Priority</th>'), 'Priority column header completely removed');
    assert(!wmContent.includes('{safeStock <= 0 ? \'Critical\' : \'High\'}'), 'Priority Critical/High badge logic removed from table');

    // 2. Verify Available Stock and Status are merged into one column
    assert(wmContent.includes('Available Stock / Status</span>'), 'Merged column header "Available Stock / Status" present');
    assert(!wmContent.includes('>Available Stock</span>'), 'Old separate "Available Stock" header removed');
    assert(!wmContent.includes('>Status</th>'), 'Old separate "Status" header removed');

    // 3. Verify Combined Cell displays quantity, unit, and status badge together
    assert(wmContent.includes('{formatNumber(safeStock)} {p.unit}'), 'Stock quantity and unit displayed prominently');
    assert(wmContent.includes('Out of Stock'), 'Out of Stock badge present in merged cell');
    assert(wmContent.includes('Limited'), 'Limited badge present in merged cell');
    assert(wmContent.includes('In Stock'), 'In Stock badge present in merged cell');
    assert(wmContent.includes('flex flex-wrap items-center gap-2'), 'Responsive flex container for quantity and badge');

    // 4. Verify Remaining Columns
    assert(wmContent.includes('SKU</span>'), 'SKU column header present');
    assert(wmContent.includes('Warehouse</th>'), 'Warehouse column header present');
    assert(wmContent.includes('Warning Limit</th>'), 'Warning Limit column header present');
    assert(wmContent.includes('Suggested Reorder</span>'), 'Suggested Reorder column header present');
    assert(wmContent.includes('Actions</th>'), 'Actions column header present');
    assert(wmContent.includes('type="checkbox"'), 'Multi-select checkbox column preserved');

    // 5. Verify Actions: View Product & Request buttons preserved
    assert(wmContent.includes('title="View product in catalog"'), 'View product button preserved');
    assert(wmContent.includes('handleOpenSingleRequestModal(p.product)'), 'Request replenishment modal button preserved');

    // 6. Verify Sorting behavior on numeric stock quantity
    assert(wmContent.includes('setSortField(\'stock\')'), 'Sorting triggered on numeric stock field');
    assert(wmContent.includes('a.currentStock - b.currentStock'), 'Numeric stock sorting calculation preserved');

    // 7. Verify stock status calculations
    assert(calculateStockStatus(0, 10) === 'Out of Stock', '0 stock is Out of Stock');
    assert(calculateStockStatus(5, 10) === 'Limited Stock', '5 stock with limit 10 is Limited Stock');
    assert(calculateStockStatus(20, 10) === 'Active', '20 stock with limit 10 is Active / In Stock');

    // 8. Verify Other Roles / Tables (StockAlertsPage.tsx) are untouched
    const alertsContent = fs.readFileSync('src/pages/inventory/StockAlertsPage.tsx', 'utf8');
    assert(alertsContent.includes('Low Stock & Reorder'), 'StockAlertsPage remains operational');

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runWarehouseLowStockRedesignTests();
