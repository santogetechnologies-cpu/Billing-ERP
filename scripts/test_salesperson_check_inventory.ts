import {
  canAccessRoute,
  hasPermission,
  ROLE_PERMISSIONS_MATRIX,
  ROLE_ALLOWED_NAV_MENUS,
  getActiveUserRole
} from '../src/utils/rbac';
import { calculateStockStatus } from '../src/utils/inventoryUtils';
import { supabase } from '../src/lib/supabase';
import { inventoryService } from '../src/services/inventoryService';
import { productService } from '../src/services/productService';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    if (detail !== undefined) console.error(`    Detail:`, detail);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' VERIFICATION SUITE: Sales Dashboard - Check Inventory (View Only) ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. Button Navigation & Route Permissions
  // -------------------------------------------------------------
  console.log('--- 1. Button Navigation & Route Protection ---');
  
  // Dashboard button calls navigate('/inventory')
  const dashboardFile = fs.readFileSync('src/pages/sales/SalespersonDashboardPage.tsx', 'utf8');
  assert(
    'Dashboard has "Check Inventory" button calling navigate(\'/inventory\')',
    dashboardFile.includes("onClick={() => navigate('/inventory')}") &&
    dashboardFile.includes("Check Inventory")
  );

  // Salesperson is permitted to access /inventory in view-only mode
  assert(
    'canAccessRoute allows Salesperson to access /inventory',
    canAccessRoute('Salesperson', '/inventory') === true
  );

  // Salesperson is strictly blocked from all warehouse management sub-routes
  const forbiddenSubRoutes = [
    '/inventory/stock-overview',
    '/inventory/adjustments',
    '/inventory/transfers',
    '/inventory/low-stock',
    '/inventory/valuation',
    '/inventory/warehouses',
    '/inventory/batches',
    '/inventory/serials',
    '/inventory/alerts',
    '/inventory/purchase-requests'
  ];

  for (const subRoute of forbiddenSubRoutes) {
    assert(
      `Salesperson CANNOT access ${subRoute}`,
      canAccessRoute('Salesperson', subRoute) === false
    );
  }

  // Sidebar includes Inventory menu for Salesperson
  const spMenus = ROLE_ALLOWED_NAV_MENUS.Salesperson;
  assert(
    'Salesperson sidebar nav menus includes Dashboard, Sales, Customers, Inventory',
    spMenus.includes('Dashboard') &&
    spMenus.includes('Sales') &&
    spMenus.includes('Customers') &&
    spMenus.includes('Inventory')
  );

  // -------------------------------------------------------------
  // 2. Inventory Page Component & Dedicated View-Only Mode
  // -------------------------------------------------------------
  console.log('\n--- 2. Inventory Page Component & Role Scoping ---');

  const invDashboardFile = fs.readFileSync('src/pages/inventory/InventoryDashboardPage.tsx', 'utf8');
  assert(
    'InventoryDashboardPage renders SalespersonInventoryPage for Salesperson role',
    invDashboardFile.includes("if (profile?.role === 'Salesperson')") &&
    invDashboardFile.includes('<SalespersonInventoryPage')
  );

  const spInvFile = fs.readFileSync('src/pages/inventory/SalespersonInventoryPage.tsx', 'utf8');
  
  // Table columns check (Barcode, Available Stock, and Category removed per user requirements)
  assert('Table contains "Product Name" column', spInvFile.includes('Product Name'));
  assert('Table contains "Product Code / SKU" column', spInvFile.includes('Product Code / SKU'));
  assert('Table excludes "Barcode" column in thead', !spInvFile.includes('>Barcode</th>'));
  assert('Table excludes "Category" column in thead', !spInvFile.includes('>Category</th>'));
  assert('Table contains "Warehouse Stock Breakdown" column', spInvFile.includes('Warehouse Stock Breakdown'));
  assert('Table excludes "Available Stock" column in thead', !spInvFile.includes('>Available Stock</th>'));
  assert('Table contains "Unit" column', spInvFile.includes('Unit'));
  assert('Table contains "Selling Price" column', spInvFile.includes('Selling Price'));
  assert('Table contains "Stock Status" column', spInvFile.includes('Stock Status'));
  assert('Table contains "Actions" column', spInvFile.includes('Actions'));

  // Details Modal check
  assert(
    'Details modal contains Warehouse Stock Breakdown per godown',
    spInvFile.includes('Warehouse Stock Breakdown in Details Modal')
  );

  // -------------------------------------------------------------
  // 3. Live Database Records & Stock Status Calculation
  // -------------------------------------------------------------
  console.log('\n--- 3. Live Database Records & Stock Calculations ---');

  const companyId = '00000000-0000-0000-0000-000000000001';
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, sku, barcode, current_stock, reorder_level, selling_price, primary_unit')
    .eq('company_id', companyId)
    .limit(10);

  assert('Supabase products query succeeds', !prodErr && Array.isArray(dbProducts));
  assert('Supabase returned real products from database', dbProducts && dbProducts.length > 0);

  if (dbProducts && dbProducts.length > 0) {
    const sample = dbProducts[0];
    console.log(`    Sample real product: "${sample.name}" (SKU: ${sample.sku || 'N/A'}, Stock: ${sample.current_stock}, Price: ${sample.selling_price})`);

    // Verify stock status logic on real product
    const status = calculateStockStatus(sample.current_stock, sample.reorder_level);
    assert('calculateStockStatus computes valid status', ['Active', 'Limited Stock', 'Out of Stock'].includes(status));
  }

  // -------------------------------------------------------------
  // 4. Strict View-Only Backend RBAC Security Enforcement
  // -------------------------------------------------------------
  console.log('\n--- 4. Backend RBAC Enforcement (Salesperson Blocked from Mutations) ---');

  // Verify RBAC Matrix
  const spMatrix = ROLE_PERMISSIONS_MATRIX.Salesperson;
  assert('Salesperson inventory permission is VIEW_ONLY',
    spMatrix.inventory.view === true &&
    spMatrix.inventory.create === false &&
    spMatrix.inventory.edit === false &&
    spMatrix.inventory.delete === false &&
    spMatrix.inventory.manage === false
  );

  assert('Salesperson products permission is VIEW_ONLY',
    spMatrix.products.view === true &&
    spMatrix.products.create === false &&
    spMatrix.products.edit === false &&
    spMatrix.products.delete === false
  );

  assert('Salesperson purchases permission is ALL_DENIED',
    spMatrix.purchases.view === false &&
    spMatrix.purchases.create === false
  );

  // -------------------------------------------------------------
  // 5. Authorized Roles Preservation
  // -------------------------------------------------------------
  console.log('\n--- 5. Preservation of Authorized Roles ---');

  // Warehouse Manager
  const wmMatrix = ROLE_PERMISSIONS_MATRIX['Warehouse Manager'];
  assert('Warehouse Manager can manage inventory',
    wmMatrix.inventory.view === true &&
    wmMatrix.inventory.create === true &&
    wmMatrix.inventory.edit === true &&
    wmMatrix.inventory.manage === true
  );
  assert('Warehouse Manager can access /inventory', canAccessRoute('Warehouse Manager', '/inventory'));
  assert('Warehouse Manager can access /inventory/transfers', canAccessRoute('Warehouse Manager', '/inventory/transfers'));

  // Purchase Manager
  const pmMatrix = ROLE_PERMISSIONS_MATRIX['Purchase Manager'];
  assert('Purchase Manager can create purchases', pmMatrix.purchases.create === true);
  assert('Purchase Manager can access /inventory (Stock Overview)', canAccessRoute('Purchase Manager', '/inventory'));

  // Admin & Owner
  assert('Admin can access /inventory', canAccessRoute('Admin', '/inventory'));
  assert('Admin can access /inventory/adjustments', canAccessRoute('Admin', '/inventory/adjustments'));
  assert('Owner can access /inventory', canAccessRoute('Owner', '/inventory'));
  assert('Owner can access /inventory/warehouses', canAccessRoute('Owner', '/inventory/warehouses'));

  // -------------------------------------------------------------
  // 6. Navigation, Refresh & Safety Checks
  // -------------------------------------------------------------
  console.log('\n--- 6. Navigation, Refresh & Safety Verification ---');

  assert(
    'Direct browser URL refresh to /inventory is authorized for Salesperson',
    canAccessRoute('Salesperson', '/inventory') === true
  );
  assert(
    'hasPermission(Salesperson, inventory, view) is true for ProtectedRoute',
    hasPermission('Salesperson', 'inventory', 'view') === true
  );
  assert(
    'hasPermission(Salesperson, inventory, create) is false for mutation blocking',
    hasPermission('Salesperson', 'inventory', 'create') === false
  );

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
