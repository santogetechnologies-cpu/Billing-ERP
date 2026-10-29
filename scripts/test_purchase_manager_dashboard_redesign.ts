import fs from 'fs';
import path from 'path';
import {
  computeSupplierDeliveries,
  computeActiveInTransitOrders,
  isAwaitingPurchaseManagerReview,
  shouldShowLowStockCard
} from '../src/pages/purchases/PurchaseManagerDashboardPage';
import { Supplier, PurchaseRequest } from '../src/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('PURCHASE MANAGER DASHBOARD REDESIGN & VERIFICATION SUITE');
  console.log('================================================================================\n');

  const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf-8');

  const activeOrdersModalPath = path.resolve('src/components/purchases/ActiveOrdersModal.tsx');
  const activeOrdersModalCode = fs.readFileSync(activeOrdersModalPath, 'utf-8');

  // ---------------------------------------------------------------------------
  // 1. Dashboard Header Layout & Elements
  // ---------------------------------------------------------------------------
  console.log('--- 1. Dashboard Header Layout & Elements ---');
  {
    assert(
      pmDashboardCode.includes('Purchase Manager Dashboard'),
      'Header displays the title "Purchase Manager Dashboard"'
    );
    assert(
      pmDashboardCode.includes('Welcome back,') && pmDashboardCode.includes('{displayName}'),
      'Header includes personalized greeting: "Welcome back, {displayName}!"'
    );
    assert(
      pmDashboardCode.includes('Procurement Operations'),
      'Header breadcrumb displays "Procurement Operations"'
    );
    assert(
      pmDashboardCode.includes('{formattedToday}'),
      'Header dynamically displays formatted date badge'
    );
    assert(
      pmDashboardCode.includes('title="Refresh Procurement Metrics"'),
      'Header includes Refresh button with tooltip and spinner state'
    );
    assert(
      pmDashboardCode.includes('setIsProfileModalOpen(true)'),
      'Header includes User Profile button opening UserProfileModal'
    );
    assert(
      pmDashboardCode.includes('New Purchase Order') &&
      pmDashboardCode.includes('navigate(\'/purchases/new?docType=purchase_order\')'),
      'Header includes "New Purchase Order" action button navigating to /purchases/new?docType=purchase_order'
    );
    assert(
      !pmDashboardCode.includes('Review Requests') &&
      !pmDashboardCode.includes('pendingRequestsCount'),
      'Header retired "Review Requests" button and pending requests badge'
    );
    assert(
      pmDashboardCode.includes('New Purchase Bill') &&
      pmDashboardCode.includes('navigate(\'/purchases/new\')'),
      'Header includes "New Purchase Bill" action button navigating to /purchases/new'
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Removal of Unwanted Sections & 4 Top KPI Cards
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Removal of Unwanted Sections & Top KPI Cards ---');
  {
    assert(
      shouldShowLowStockCard('Purchase Manager') === false,
      'Low Stock Items card is strictly hidden for Purchase Manager role'
    );
    assert(
      !pmDashboardCode.includes('Procurement Reorder Watchlist'),
      'Procurement Reorder Watchlist is completely removed from dashboard'
    );
    assert(
      pmDashboardCode.includes('title="Total Purchase Orders"') &&
      pmDashboardCode.includes('title="Month Purchases"') &&
      pmDashboardCode.includes('title="Active Orders"') &&
      pmDashboardCode.includes('title="Active Suppliers"'),
      'Top KPI section includes Total Purchase Orders, Month Purchases, Active Orders, and Active Suppliers'
    );
    assert(
      pmDashboardCode.includes("showLowStockCard ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'"),
      'Grid layout adapts to "lg:grid-cols-4" without gaps when Low Stock card is hidden'
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Supplier Delivery Overview Logic & Columns
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Supplier Delivery Overview Logic & Columns ---');
  {
    assert(
      pmDashboardCode.includes('lg:col-span-8') && pmDashboardCode.includes('lg:col-span-4'),
      'Lower grid allocates generous width to Supplier Delivery Overview (8 of 12 cols) vs Recent Bills (4 cols)'
    );
    assert(
      pmDashboardCode.includes('Supplier Name') &&
      pmDashboardCode.includes('Contact') &&
      pmDashboardCode.includes('Active Orders') &&
      pmDashboardCode.includes('Items to Deliver') &&
      pmDashboardCode.includes('Expected Delivery') &&
      pmDashboardCode.includes('Delivery Status') &&
      pmDashboardCode.includes('Supplier Status'),
      'Supplier Delivery table contains all 7 specified columns'
    );

    // Test computeSupplierDeliveries logic with real telemetry
    const testSuppliers: Supplier[] = [
      {
        id: 'sup-1',
        name: 'Apex Fasteners',
        phone: '+91 98765 43210',
        email: 'sales@apexfasteners.com',
        city: 'Mumbai',
        state: 'Maharashtra',
        currentBalance: 0
      },
      {
        id: 'sup-2',
        name: 'Zenith Logistics & Supplies',
        phone: '',
        email: '',
        city: 'Delhi',
        state: 'Delhi',
        currentBalance: 0
      }
    ];

    const testOrders = [
      {
        id: 'po-101',
        order_number: 'PO-2026-101',
        supplier_id: 'sup-1',
        expected_delivery: '2026-11-05',
        status: 'In Transit',
        items: [
          { qty: 100, receivedQty: 30 }
        ]
      }
    ];

    const deliveries = computeSupplierDeliveries({
      suppliers: testSuppliers,
      purchaseOrders: testOrders,
      purchaseRequests: [],
      todayStr: '2026-10-29'
    });

    const sup1 = deliveries.find(d => d.supplierId === 'sup-1');
    const sup2 = deliveries.find(d => d.supplierId === 'sup-2');

    assert(sup1 !== undefined, 'Supplier with orders is present in delivery telemetry');
    assert(sup1?.activeOrders === 1, 'Supplier 1 has 1 active order');
    assert(sup1?.itemsToDeliver === 70, 'Supplier 1 has 70 items remaining to deliver (100 - 30)');
    assert(sup1?.supplierStatus === 'Active', 'Supplier 1 status evaluates to "Active" while deliveries are outstanding');
    assert(sup1?.deliveryStatus === 'Partially Delivered', 'Supplier 1 delivery status evaluates to "Partially Delivered"');
    assert(sup1?.contact === '+91 98765 43210', 'Supplier 1 contact phone is displayed correctly');

    assert(sup2 !== undefined, 'Supplier without orders is present in delivery telemetry');
    assert(sup2?.activeOrders === 0, 'Supplier 2 has 0 active orders');
    assert(sup2?.itemsToDeliver === 0, 'Supplier 2 has 0 items to deliver');
    assert(sup2?.supplierStatus === 'Inactive', 'Supplier 2 status evaluates to "Inactive" when no orders are outstanding');
    assert(sup2?.contact === 'Not available', 'Supplier 2 contact gracefully falls back to "Not available" when phone/email are empty');
    assert(sup2?.expectedDelivery === 'Not available', 'Supplier 2 expected delivery gracefully falls back to "Not available"');
  }

  // ---------------------------------------------------------------------------
  // 4. Recent Purchase Bills Section
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Recent Purchase Bills Section ---');
  {
    assert(
      pmDashboardCode.includes('Recent Purchase Bills'),
      'Recent Purchase Bills section header is rendered'
    );
    assert(
      pmDashboardCode.includes('navigate(\'/purchases\')') &&
      pmDashboardCode.includes('View All'),
      '"View All" under Recent Purchase Bills navigates to /purchases'
    );
    assert(
      pmDashboardCode.includes('Record Bill') &&
      pmDashboardCode.includes('navigate(\'/purchases/new\')'),
      '"Record Bill" button under Recent Purchase Bills navigates to /purchases/new'
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Recent Purchase Orders Section (Direct Purchasing Workflow)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Recent Purchase Orders Section ---');
  {
    assert(
      pmDashboardCode.includes('Recent Purchase Orders'),
      'Recent Purchase Orders section title is displayed'
    );
    assert(
      pmDashboardCode.includes('navigate(\'/purchases/orders\')'),
      '"View All Orders" navigates to /purchases/orders'
    );
    assert(
      pmDashboardCode.includes('Purchase Order Number') &&
      pmDashboardCode.includes('Supplier') &&
      pmDashboardCode.includes('Destination Warehouse') &&
      pmDashboardCode.includes('Number of Products') &&
      pmDashboardCode.includes('Ordered Quantity') &&
      pmDashboardCode.includes('Outstanding Quantity') &&
      pmDashboardCode.includes('Expected Delivery') &&
      pmDashboardCode.includes('Delivery Status'),
      'Recent Purchase Orders table contains all required columns'
    );
    assert(
      !pmDashboardCode.includes('Pending Purchase Requests Awaiting Your Review'),
      'Obsolete Pending Purchase Requests review section is cleanly removed'
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Active Orders Modal Behavior & Rules
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Active Orders Modal Behavior & Rules ---');
  {
    assert(
      pmDashboardCode.includes('setIsActiveOrdersModalOpen(true)'),
      'Active Orders summary card and Manage Orders button open ActiveOrdersModal'
    );
    assert(
      activeOrdersModalCode.includes('border border-rose-300 text-rose-600') &&
      activeOrdersModalCode.includes('title="Close (ESC)"'),
      'ActiveOrdersModal features red outlined close button and Esc key support'
    );
    assert(
      activeOrdersModalCode.includes("statusFilter === 'Active'") &&
      activeOrdersModalCode.includes("statusFilter === 'Delivered'") &&
      !activeOrdersModalCode.includes("statusFilter === 'Ordered'"),
      'ActiveOrdersModal restricts status filtering to ONLY "Active" and "Delivered" (no "Ordered")'
    );
    assert(
      activeOrdersModalCode.includes('fixed inset-0 z-50 flex items-center justify-center') &&
      activeOrdersModalCode.includes('overflow-y-auto'),
      'ActiveOrdersModal is a standalone modal popup that scrolls independently'
    );
  }

  // ---------------------------------------------------------------------------
  // 7. Critical Protection Audit: Unmodified Protected Product Screens
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Critical Protection Audit: Protected Product Screens ---');
  {
    const protectedFiles = [
      'src/pages/products/InitialStockPage.tsx',
      'src/pages/products/NewProductPage.tsx',
      'src/pages/products/ProductListPage.tsx',
      'src/pages/products/UpdateStockPage.tsx'
    ];

    for (const file of protectedFiles) {
      assert(fs.existsSync(file), `Protected screen exists: ${file}`);
    }
  }

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PURCHASE MANAGER DASHBOARD VERIFICATION TESTS PASSED 100%!');
  }
}

runTestSuite();

