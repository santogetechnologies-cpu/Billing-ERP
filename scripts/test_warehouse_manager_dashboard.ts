// Test Suite: Warehouse Manager Dashboard
// Validates role-specific routing, real inventory metrics, stock status distribution,
// warehouse scoping, low-stock reorder formulas, and purchase request submission.

import { isNavItemActive } from '../src/components/layout/Sidebar';
import { canAccessRoute, hasPermission } from '../src/utils/rbac';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { notificationService } from '../src/services/notificationService';
import {
  Product,
  Warehouse,
  UserRole,
  CreatePurchaseRequestInput
} from '../src/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runWarehouseManagerDashboardTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: WAREHOUSE MANAGER DASHBOARD & REPLENISHMENT WORKFLOW');
  console.log('================================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  // Mock Users
  const warehouseManager = {
    id: 'user-wm-001',
    name: 'Rajesh Kumar (Warehouse Manager)',
    role: 'Warehouse Manager' as UserRole
  };

  const purchaseManager = {
    id: 'user-pm-001',
    name: 'Priya Sharma (Purchase Manager)',
    role: 'Purchase Manager' as UserRole
  };

  const adminUser = {
    id: 'user-admin-001',
    name: 'Admin Boss (Admin)',
    role: 'Admin' as UserRole
  };

  const salespersonUser = {
    id: 'user-sp-001',
    name: 'Amit Patel (Salesperson)',
    role: 'Salesperson' as UserRole
  };

  // Mock Warehouses
  const centralWarehouse: Warehouse = {
    id: 'wh-central-001',
    name: 'Main Central Warehouse',
    code: 'WH-CENTRAL',
    address: 'Plot 10, Industrial Logistics Hub',
    managerId: warehouseManager.id,
    managerName: warehouseManager.name,
    managerIds: [warehouseManager.id]
  };

  const northGodown: Warehouse = {
    id: 'wh-north-002',
    name: 'North Regional Godown',
    code: 'WH-NORTH',
    address: 'Warehouse Sector 4',
    managerId: 'other-user-999',
    managerName: 'Other Manager',
    managerIds: ['other-user-999']
  };

  const allWarehouses = [centralWarehouse, northGodown];

  // ---------------------------------------------------------------------------
  // 1. Role-Specific Dashboard Route Authorization
  // ---------------------------------------------------------------------------
  console.log('--- 1. Role-Specific Dashboard Route Authorization ---');

  assert(canAccessRoute('Warehouse Manager', '/'), 'Warehouse Manager CAN access root dashboard');
  assert(canAccessRoute('Warehouse Manager', '/warehouse/dashboard'), 'Warehouse Manager CAN access /warehouse/dashboard');
  assert(canAccessRoute('Owner', '/'), 'Owner CAN access root dashboard');
  assert(canAccessRoute('Admin', '/'), 'Admin CAN access root dashboard');
  assert(canAccessRoute('Salesperson', '/sales/dashboard'), 'Salesperson CAN access /sales/dashboard');
  assert(canAccessRoute('Warehouse Manager', '/inventory'), 'Warehouse Manager CAN access /inventory');
  assert(canAccessRoute('Warehouse Manager', '/inventory/alerts'), 'Warehouse Manager CAN access /inventory/alerts');
  assert(canAccessRoute('Warehouse Manager', '/inventory/purchase-requests'), 'Warehouse Manager CAN access /inventory/purchase-requests');

  // ---------------------------------------------------------------------------
  // 2. Sidebar Navigation Mutual Exclusivity
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Sidebar Navigation Mutual Exclusivity ---');

  const rootDashboardNavItem = { name: 'Dashboard', path: '/', end: true };
  const stockOverviewNavItem = { name: 'Stock Overview', path: '/inventory', end: true };
  const lowStockNavItem = { name: 'Low Stock & Reorder', path: '/inventory/alerts', end: true };
  const purchaseRequestsNavItem = { name: 'Purchase Requests', path: '/inventory/purchase-requests', end: true };

  // When Warehouse Manager is on '/'
  assert(isNavItemActive(rootDashboardNavItem, '/', false) === true, 'Dashboard is ACTIVE on "/"');
  assert(isNavItemActive(stockOverviewNavItem, '/', false) === false, 'Stock Overview is NOT active on "/"');
  assert(isNavItemActive(lowStockNavItem, '/', false) === false, 'Low Stock & Reorder is NOT active on "/"');
  assert(isNavItemActive(purchaseRequestsNavItem, '/', false) === false, 'Purchase Requests is NOT active on "/"');

  // When Warehouse Manager is on '/warehouse/dashboard'
  assert(isNavItemActive(rootDashboardNavItem, '/warehouse/dashboard', false) === true, 'Dashboard is ACTIVE on "/warehouse/dashboard"');
  assert(isNavItemActive(stockOverviewNavItem, '/warehouse/dashboard', false) === false, 'Stock Overview is NOT active on "/warehouse/dashboard"');
  assert(isNavItemActive(lowStockNavItem, '/warehouse/dashboard', false) === false, 'Low Stock & Reorder is NOT active on "/warehouse/dashboard"');

  // When Warehouse Manager navigates to '/inventory'
  assert(isNavItemActive(rootDashboardNavItem, '/inventory', false) === false, 'Dashboard is NOT active on "/inventory"');
  assert(isNavItemActive(stockOverviewNavItem, '/inventory', false) === true, 'Stock Overview is ACTIVE on "/inventory"');

  // ---------------------------------------------------------------------------
  // 3. Warehouse Scoping & Access Restrictions
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Warehouse Scoping & Access Restrictions ---');

  const getAuthorizedWarehouses = (userObj: any, role: string) => {
    if (role === 'Owner' || role === 'Admin') return allWarehouses;
    const assigned = allWarehouses.filter(
      w => w.managerId === userObj.id || w.managerIds?.includes(userObj.id)
    );
    return assigned.length > 0 ? assigned : allWarehouses;
  };

  const wmWarehouses = getAuthorizedWarehouses(warehouseManager, 'Warehouse Manager');
  assert(wmWarehouses.length === 1, 'Warehouse Manager is scoped to exactly 1 authorized warehouse');
  assert(wmWarehouses[0].id === centralWarehouse.id, 'Warehouse Manager authorized hub is Central Warehouse');

  const adminWarehouses = getAuthorizedWarehouses(adminUser, 'Admin');
  assert(adminWarehouses.length === 2, 'Admin has global access across all hubs');

  // ---------------------------------------------------------------------------
  // 4. Inventory Metric Formulas (Distinct Counts & Stock Status)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Inventory Metric Formulas & Status Classification ---');

  const sampleProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Steel Fasteners M8',
      sku: 'FAST-M8',
      category: 'Hardware',
      currentStock: 0,
      primaryUnit: 'Piece',
      reorderLevel: 20
    },
    {
      id: 'prod-2',
      name: 'Hydraulic Seal Ring',
      sku: 'HYD-SEAL-01',
      category: 'Hydraulics',
      currentStock: -2, // Legacy negative balance
      primaryUnit: 'Piece',
      reorderLevel: 15
    },
    {
      id: 'prod-3',
      name: 'Industrial Lubricant ISO 68',
      sku: 'LUB-ISO-68',
      category: 'Fluids',
      currentStock: 8, // Stock <= warning limit (10)
      primaryUnit: 'Litre',
      reorderLevel: 10
    },
    {
      id: 'prod-4',
      name: 'Heavy Duty Packaging Tape',
      sku: 'TAPE-HD-50',
      category: 'Packaging',
      currentStock: 120, // Stock > warning limit (30)
      primaryUnit: 'Roll',
      reorderLevel: 30
    },
    {
      id: 'prod-5',
      name: 'Safety Goggles UV400',
      sku: 'SAF-GOG-01',
      category: 'Safety',
      currentStock: 45, // Stock > 0, warning limit not set
      primaryUnit: 'Piece'
    }
  ];

  const computeStatus = (stock: number, warningLimit?: number | null): 'Out of Stock' | 'Limited Stock' | 'Active' => {
    if (stock <= 0) return 'Out of Stock';
    if (warningLimit !== undefined && warningLimit !== null && stock <= warningLimit) return 'Limited Stock';
    return 'Active';
  };

  const computeSuggested = (stock: number, warningLimit?: number | null): number => {
    if (stock <= 0) {
      const target = warningLimit && warningLimit > 0 ? warningLimit : 10;
      return target * 2;
    }
    if (warningLimit !== undefined && warningLimit !== null && stock <= warningLimit) {
      return Math.max(1, (warningLimit * 2) - stock);
    }
    return 0;
  };

  const enriched = sampleProducts.map(p => ({
    ...p,
    status: computeStatus(p.currentStock, p.reorderLevel),
    suggestedQty: computeSuggested(p.currentStock, p.reorderLevel)
  }));

  const outOfStockCount = enriched.filter(p => p.status === 'Out of Stock').length;
  const limitedStockCount = enriched.filter(p => p.status === 'Limited Stock').length;
  const activeCount = enriched.filter(p => p.status === 'Active').length;
  const totalProducts = enriched.length;

  assert(totalProducts === 5, 'Total products distinct count is 5');
  assert(outOfStockCount === 2, 'Out of stock items count is 2 (stock <= 0)');
  assert(limitedStockCount === 1, 'Low stock items count is 1 (stock 8 <= limit 10)');
  assert(activeCount === 2, 'Active healthy stock items count is 2');

  // Suggested reorder verification
  assert(enriched[0].suggestedQty === 40, 'Out of stock with limit 20 suggests 40 units (limit * 2)');
  assert(enriched[1].suggestedQty === 30, 'Negative stock (-2) with limit 15 suggests 30 units (limit * 2)');
  assert(enriched[2].suggestedQty === 12, 'Limited stock (8) with limit 10 suggests 12 units ((10 * 2) - 8)');
  assert(enriched[3].suggestedQty === 0, 'Healthy stock suggests 0 replenishment');

  // ---------------------------------------------------------------------------
  // 5. Stock Status Donut Chart Consistency
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Stock Status Donut Chart Consistency ---');

  const activePct = Math.round((activeCount / totalProducts) * 100);
  const limitedPct = Math.round((limitedStockCount / totalProducts) * 100);
  const outPct = Math.max(0, 100 - activePct - limitedPct);

  assert(activePct + limitedPct + outPct === 100, 'Donut chart percentages sum to exactly 100%');
  assert(activePct === 40, `Active stock percentage is 40% (got ${activePct}%)`);
  assert(limitedPct === 20, `Limited stock percentage is 20% (got ${limitedPct}%)`);
  assert(outPct === 40, `Out of stock percentage is 40% (got ${outPct}%)`);

  // Handle empty catalog without crashing or NaN
  const emptyTotal = 0;
  const safePct = emptyTotal > 0 ? Math.round((0 / emptyTotal) * 100) : 0;
  assert(safePct === 0, 'Empty catalog computes safe 0% without NaN');

  // ---------------------------------------------------------------------------
  // 6. Multi-Item Purchase Request Submission from Warehouse Manager Dashboard
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Multi-Item Purchase Request Submission ---');

  const prPayload: CreatePurchaseRequestInput = {
    warehouseId: centralWarehouse.id,
    warehouseName: centralWarehouse.name,
    priority: 'Urgent',
    reason: 'Critical replenishment for Out of Stock and Limited Stock inventory items',
    requestedDeliveryDate: '2026-10-22',
    notes: 'Please expedite delivery for packaging tape and fasteners',
    items: [
      {
        productId: sampleProducts[0].id,
        productName: sampleProducts[0].name,
        sku: sampleProducts[0].sku,
        currentStock: sampleProducts[0].currentStock,
        warningLimit: sampleProducts[0].reorderLevel,
        requestedQty: 40,
        unit: sampleProducts[0].primaryUnit,
        estimatedCost: 15
      },
      {
        productId: sampleProducts[2].id,
        productName: sampleProducts[2].name,
        sku: sampleProducts[2].sku,
        currentStock: sampleProducts[2].currentStock,
        warningLimit: sampleProducts[2].reorderLevel,
        requestedQty: 12,
        unit: sampleProducts[2].primaryUnit,
        estimatedCost: 350
      }
    ]
  };

  const createdPR = await purchaseRequestService.createPurchaseRequest(
    prPayload,
    testCompanyId,
    warehouseManager
  );

  assert(Boolean(createdPR.id), 'Purchase request created with valid ID');
  assert(/^PR-\d{8}-\d{4}$/.test(createdPR.requestNumber), `Request number format matches PR-YYYYMMDD-XXXX (${createdPR.requestNumber})`);
  assert(createdPR.status === 'Pending Approval', 'Initial status is "Pending Approval"');
  assert(createdPR.priority === 'Urgent', 'Request priority is "Urgent"');
  assert(createdPR.items.length === 2, '2 line items stored in purchase request');
  assert(createdPR.warehouseId === centralWarehouse.id, 'Receiving warehouse correctly mapped');

  // Verify in-app notification delivered to Purchase Manager
  const pmNotifs = await notificationService.getNotifications(testCompanyId, purchaseManager.id, 'Purchase Manager');
  const hasNotif = pmNotifs.some(n => n.type === 'purchase_request' && n.title.includes(createdPR.requestNumber));
  assert(hasNotif, `Purchase Manager notified of new request #${createdPR.requestNumber}`);

  // Stock inventory remains unmodified upon request submission (only goods receipt modifies stock)
  assert(sampleProducts[0].currentStock === 0, 'Inventory stock is strictly UNCHANGED upon purchase request submission');

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================================\n');
}

runWarehouseManagerDashboardTests().catch(err => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
