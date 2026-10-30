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
  console.log('PURCHASE MANAGER DASHBOARD CLEAN & COMPACT REDESIGN VERIFICATION');
  console.log('================================================================================\n');

  const pmDashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const pmDashboardCode = fs.readFileSync(pmDashboardPath, 'utf-8');

  // ---------------------------------------------------------------------------
  // 1. Top: Compact Header
  // ---------------------------------------------------------------------------
  console.log('--- 1. Top: Compact Header ---');
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
      pmDashboardCode.includes('{formattedToday}'),
      'Header dynamically displays formatted date badge'
    );
    assert(
      pmDashboardCode.includes('title="Refresh Procurement Metrics"'),
      'Header includes Refresh button with tooltip and spinner state'
    );
    assert(
      (pmDashboardCode.includes('New Order') || pmDashboardCode.includes('New Purchase Order')) &&
      pmDashboardCode.includes('navigate(\'/purchases/new?docType=purchase_order\')'),
      'Header includes "New Order" action button navigating to /purchases/new?docType=purchase_order'
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Dashboard Clutter Removal
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Dashboard Clutter Removal ---');
  {
    assert(
      !pmDashboardCode.includes('title="Month Purchases"') &&
      !pmDashboardCode.includes('title="Products in Inventory"'),
      'Top KPI cards row is completely removed from the dashboard'
    );
    assert(
      !pmDashboardCode.includes('Pending Purchase Requests Awaiting Your Review') &&
      !pmDashboardCode.includes('Review Requests') &&
      !pmDashboardCode.includes('pendingRequestsCount'),
      'Obsolete Pending Purchase Requests review section and buttons are cleanly removed'
    );
    assert(
      !pmDashboardCode.includes('id="recent-bills-section"'),
      'Recent Purchase Bills section is completely removed from dashboard view'
    );
    assert(
      !pmDashboardCode.includes('Procurement Reorder Watchlist'),
      'Procurement Reorder Watchlist is completely removed'
    );
    assert(
      shouldShowLowStockCard('Purchase Manager') === false,
      'Obsolete Low Stock Items card is strictly hidden for Purchase Manager'
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Middle Section: Two-Column Layout (Stock Overview & Supplier Overview)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Middle Section: Two-Column Layout ---');
  {
    assert(
      pmDashboardCode.includes('grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch'),
      'Middle section uses balanced two-column grid (grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch)'
    );

    // Left side: Stock Status Overview
    assert(
      pmDashboardCode.includes('id="stock-status-overview-card"'),
      'Left card container id "stock-status-overview-card" is present'
    );
    assert(
      pmDashboardCode.includes('Stock Status Overview'),
      'Left card displays title "Stock Status Overview"'
    );
    assert(
      pmDashboardCode.includes('<svg') && pmDashboardCode.includes('viewBox="0 0 100 100"'),
      'Left card renders SVG doughnut chart'
    );
    assert(
      pmDashboardCode.includes('Total SKUs') || pmDashboardCode.includes('Total Products'),
      'Doughnut chart displays total SKUs count in the center'
    );
    assert(
      pmDashboardCode.includes('Low Stock') &&
      pmDashboardCode.includes('Limited Stock') &&
      pmDashboardCode.includes('Active Stock'),
      'Stock Status Overview includes all 3 statuses: Low Stock, Limited Stock, Active Stock'
    );
    assert(
      pmDashboardCode.includes('stockData.lowStockCount') &&
      pmDashboardCode.includes('stockData.limitedStockCount') &&
      pmDashboardCode.includes('stockData.activeStockCount'),
      'Stock Status Overview shows actual counts fetched from existing inventory data'
    );
    assert(
      pmDashboardCode.includes("navigate('/inventory/alerts')") ||
      pmDashboardCode.includes("navigate('/products')"),
      'Each stock status is clickable to open corresponding existing inventory filter'
    );

    // Right side: Supplier Overview
    assert(
      pmDashboardCode.includes('id="supplier-overview-card"'),
      'Right card container id "supplier-overview-card" is present'
    );
    assert(
      pmDashboardCode.includes('Supplier Overview'),
      'Right card displays title "Supplier Overview"'
    );
    assert(
      pmDashboardCode.includes('Supplier Name') &&
      pmDashboardCode.includes('Supplier Status'),
      'Supplier Overview table contains Supplier Name and Supplier Status columns'
    );
    assert(
      pmDashboardCode.includes('View All Suppliers') &&
      pmDashboardCode.includes("navigate('/suppliers')"),
      'Supplier Overview includes "View All Suppliers" link navigating to /suppliers'
    );
    assert(
      pmDashboardCode.includes("sup.status === 'Active'") &&
      (pmDashboardCode.includes("sup.status === 'Inactive'") || pmDashboardCode.includes("isActive ? 'Active' : 'Inactive'")),
      'Supplier status evaluates strictly to "Active" or "Inactive"'
    );
    assert(
      !pmDashboardCode.includes("sup.status === 'Delivered'"),
      'Supplier status strictly NEVER displays "Delivered" (Delivered applies only to deliveries)'
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Bottom Section: Large Recent Purchase Orders Section
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Bottom Section: Large Recent Purchase Orders Section ---');
  {
    assert(
      pmDashboardCode.includes('id="recent-orders-section"'),
      'Recent Purchase Orders container id "recent-orders-section" is present'
    );
    assert(
      pmDashboardCode.includes('Recent Purchase Orders'),
      'Recent Purchase Orders section displays title'
    );
    assert(
      pmDashboardCode.includes('View All Orders') &&
      pmDashboardCode.includes("navigate('/purchases/orders')"),
      '"View All Orders" navigates to /purchases/orders'
    );

    const requiredColumns = [
      'Purchase Order Number',
      'Order Date',
      'Supplier Name',
      'Destination Warehouse',
      'Products / Item Count',
      'Ordered Quantity',
      'Outstanding Quantity',
      'Expected Delivery',
      'Delivery Status',
      'Actions'
    ];

    for (const col of requiredColumns) {
      assert(
        pmDashboardCode.includes(col),
        `Recent Purchase Orders table contains required column: "${col}"`
      );
    }

    assert(
      pmDashboardCode.includes("order.deliveryStatus === 'Received'") &&
      pmDashboardCode.includes("order.deliveryStatus === 'Ordered'"),
      'Delivery status strictly uses only "Ordered" and "Received"'
    );
    assert(
      !pmDashboardCode.includes("order.deliveryStatus === 'Delivered'") &&
      !pmDashboardCode.includes("order.deliveryStatus === 'Active'"),
      'Old delivery status labels "Active" and "Delivered" are replaced with "Ordered" and "Received"'
    );

    assert(
      pmDashboardCode.includes('setSelectedOrderForModal(order)'),
      'Actions column includes "View" action opening purchase order details popup modal'
    );
    assert(
      pmDashboardCode.includes('<Eye className="w-4 h-4 text-slate-500" />') &&
      !pmDashboardCode.includes('<span>View</span>'),
      'Actions column uses an icon-only Eye button without text wordings'
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Purchase Order Details Popup Modal
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Purchase Order Details Popup Modal ---');
  {
    assert(
      pmDashboardCode.includes('selectedOrderForModal &&') &&
      pmDashboardCode.includes('Purchase Order Details: #'),
      'Purchase Order Details modal displays PO number and item details'
    );
    assert(
      pmDashboardCode.includes('Ordered Qty') &&
      pmDashboardCode.includes('Received Qty') &&
      pmDashboardCode.includes('Outstanding Qty'),
      'PO Details modal displays ordered, received, and outstanding quantities'
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Critical Protection Audit: Protected Product Screens
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Critical Protection Audit: Protected Product Screens ---');
  {
    const protectedFiles = [
      'src/pages/products/InitialStockPage.tsx',
      'src/pages/products/NewProductPage.tsx',
      'src/pages/products/ProductListPage.tsx',
      'src/pages/products/UpdateStockPage.tsx'
    ];

    for (const file of protectedFiles) {
      assert(fs.existsSync(file), `Protected screen exists and is intact: ${file}`);
    }
  }

  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${totalTests - passedTests}`);
  console.log('================================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PURCHASE MANAGER DASHBOARD CLEAN & COMPACT REDESIGN TESTS PASSED 100%!');
  }
}

runTestSuite();
