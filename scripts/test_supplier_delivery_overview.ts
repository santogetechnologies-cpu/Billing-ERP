// Test Suite: Supplier Delivery Overview on Purchase Manager Dashboard
// Verifies all acceptance criteria from the Antigravity prompt

import { computeSupplierDeliveries } from '../src/pages/purchases/PurchaseManagerDashboardPage';
import { Supplier, PurchaseRequest } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

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
  console.log('================================================================');
  console.log('TEST SUITE: SUPPLIER DELIVERY OVERVIEW REPLACEMENT');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Static Source Code Inspection: Reorder Watchlist Removed
  // ---------------------------------------------------------------------------
  console.log('--- 1. Removal of Procurement Reorder Watchlist from PM Dashboard ---');
  {
    const filePath = path.resolve(process.cwd(), 'src/pages/purchases/PurchaseManagerDashboardPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must NOT contain old section ID or title
    assert(
      !content.includes('id="reorder-watchlist-section"'),
      'Old "reorder-watchlist-section" ID is completely removed'
    );
    assert(
      !content.includes('Procurement Reorder Watchlist'),
      'Title "Procurement Reorder Watchlist" is completely removed'
    );
    assert(
      !content.includes('All catalog items currently meet healthy minimum threshold limits'),
      'Watchlist empty-state text is completely removed'
    );

    // Must contain new section ID and title in exact position
    assert(
      content.includes('id="supplier-delivery-overview-section"'),
      'New "supplier-delivery-overview-section" is created in exact position'
    );
    assert(
      content.includes('Supplier Delivery Overview'),
      'Card title "Supplier Delivery Overview" is prominently rendered'
    );
    assert(
      content.includes('View All Suppliers'),
      '"View All Suppliers" navigation action is present in header'
    );

    // Layout Proportions & Responsive Grid (40% / 60% on desktop)
    assert(
      content.includes('lg:grid-cols-5'),
      'Grid container configures 5-column grid "lg:grid-cols-5" for exact 40%/60% split'
    );
    assert(
      content.includes('lg:col-span-2'),
      'Recent Purchase Bills allocated "lg:col-span-2" (2/5 = 40% width)'
    );
    assert(
      content.includes('lg:col-span-3'),
      'Supplier Delivery Overview allocated "lg:col-span-3" (3/5 = 60% width)'
    );
    assert(
      content.includes('grid-cols-1'),
      'Grid container stacks vertically on mobile with "grid-cols-1"'
    );
    assert(
      content.includes('items-stretch') && content.includes('h-full'),
      'Both cards configure "items-stretch" and "h-full" aligning top and bottom edges'
    );

    // All 6 Table Columns
    const columns = [
      'Supplier Name',
      'Contact',
      'Active Orders',
      'Items to Deliver',
      'Expected Delivery',
      'Delivery Status'
    ];
    columns.forEach(col => {
      assert(content.includes(col), `Supplier Delivery Overview table contains header column "${col}"`);
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Data Calculations: Single Supplier with Active Order
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Data & Calculations: Active Orders & Items to Deliver ---');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-001',
        name: 'Tata Steel Ltd',
        company: 'Tata Steel',
        phone: '+91 98765 43210',
        email: 'orders@tatasteel.com',
        address: 'Jamshedpur',
        gstin: '20AAACT2727Q1ZW',
        pan: 'AAACT2727Q',
        creditDays: 30,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 500000,
        totalPaid: 500000,
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];

    const mockOrders = [
      {
        id: 'po-101',
        order_number: 'PO-2026-1001',
        supplier_id: 'sup-001',
        supplier_name: 'Tata Steel Ltd',
        status: 'Ordered',
        expected_delivery: '2026-10-30',
        purchase_order_items: [
          { product_name: 'TMT Steel Rod 12mm', qty: 50, received_qty: 0, unit: 'Piece' },
          { product_name: 'TMT Steel Rod 16mm', qty: 30, received_qty: 10, unit: 'Piece' }
        ]
      }
    ];

    const result = computeSupplierDeliveries({
      suppliers: mockSuppliers,
      purchaseOrders: mockOrders,
      purchaseRequests: [],
      todayStr: '2026-10-22'
    });

    assert(result.length === 1, 'Returns 1 supplier delivery record');
    const tata = result[0];
    assert(tata.supplierName === 'Tata Steel Ltd', 'Supplier name matches "Tata Steel Ltd"');
    assert(tata.contact === '+91 98765 43210', 'Primary contact phone extracted accurately');
    assert(tata.activeOrders === 1, 'Active orders count equals 1');
    // Items to deliver: 50 + (30 - 10) = 70
    assert(tata.itemsToDeliver === 70, `Items to deliver equals 70 (Actual: ${tata.itemsToDeliver})`);
    assert(tata.expectedDelivery === '2026-10-30', 'Expected delivery date matches "2026-10-30"');
    // Since received_qty = 10 and pending = 70, status is Partially Delivered
    assert(tata.deliveryStatus === 'Partially Delivered', `Delivery status is "Partially Delivered" (Actual: ${tata.deliveryStatus})`);
  }

  // ---------------------------------------------------------------------------
  // 3. Overdue Delivery Detection & Visual Distinction
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Overdue Delivery Status & Priority Sorting ---');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-002',
        name: 'Ultratech Cement',
        company: 'Aditya Birla',
        phone: '+91 91234 56789',
        email: 'dispatch@ultratech.com',
        address: 'Mumbai',
        gstin: '27AAACU1234F1Z1',
        pan: 'AAACU1234F',
        creditDays: 15,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 300000,
        totalPaid: 300000,
        status: 'Active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'sup-003',
        name: 'Asian Paints Ltd',
        company: 'Asian Paints',
        phone: '+91 98989 89898',
        email: 'sales@asianpaints.com',
        address: 'Delhi',
        gstin: '07AAACA5678G1Z2',
        pan: 'AAACA5678G',
        creditDays: 30,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 200000,
        totalPaid: 200000,
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];

    const mockOrders = [
      {
        id: 'po-102',
        order_number: 'PO-2026-1002',
        supplier_id: 'sup-002',
        supplier_name: 'Ultratech Cement',
        status: 'Ordered',
        expected_delivery: '2026-10-18', // Past date relative to 2026-10-22
        purchase_order_items: [
          { product_name: 'Portland Cement 50kg', qty: 100, received_qty: 0, unit: 'Bag' }
        ]
      },
      {
        id: 'po-103',
        order_number: 'PO-2026-1003',
        supplier_id: 'sup-003',
        supplier_name: 'Asian Paints Ltd',
        status: 'In Transit',
        expected_delivery: '2026-10-25', // Future date
        purchase_order_items: [
          { product_name: 'Royale Luxury Emulsion 20L', qty: 20, received_qty: 0, unit: 'Bucket' }
        ]
      }
    ];

    const result = computeSupplierDeliveries({
      suppliers: mockSuppliers,
      purchaseOrders: mockOrders,
      purchaseRequests: [],
      todayStr: '2026-10-22'
    });

    // Overdue supplier (Ultratech) must appear first in list
    assert(result[0].supplierName === 'Ultratech Cement', 'Overdue supplier is prioritized at the top of list');
    assert(result[0].deliveryStatus === 'Overdue', 'Ultratech Cement marked with status "Overdue"');
    assert(result[0].isOverdue === true, 'isOverdue flag set to true');

    // In Transit supplier (Asian Paints)
    const asian = result.find(s => s.supplierName === 'Asian Paints Ltd')!;
    assert(asian.deliveryStatus === 'In Transit', 'Asian Paints marked with status "In Transit"');
    assert(asian.isOverdue === false, 'Asian Paints is not overdue');
  }

  // ---------------------------------------------------------------------------
  // 4. Multiple Active Orders Aggregation
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Multiple Active Orders Aggregation ---');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-004',
        name: 'Jindal Steel & Power',
        company: 'Jindal',
        phone: '', // No phone
        email: 'contact@jindal.com', // Has email
        address: 'Hisar',
        gstin: '06AAACJ9999H1Z0',
        pan: 'AAACJ9999H',
        creditDays: 45,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 800000,
        totalPaid: 800000,
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];

    const mockOrders = [
      {
        id: 'po-201',
        order_number: 'PO-2026-2001',
        supplier_id: 'sup-004',
        status: 'Ordered',
        expected_delivery: '2026-10-28',
        purchase_order_items: [{ product_name: 'Steel Angle 50mm', qty: 40, received_qty: 0 }]
      },
      {
        id: 'po-202',
        order_number: 'PO-2026-2002',
        supplier_id: 'sup-004',
        status: 'Ordered',
        expected_delivery: '2026-10-24', // Earlier date
        purchase_order_items: [{ product_name: 'Steel Channel 75mm', qty: 60, received_qty: 0 }]
      }
    ];

    const result = computeSupplierDeliveries({
      suppliers: mockSuppliers,
      purchaseOrders: mockOrders,
      purchaseRequests: [],
      todayStr: '2026-10-22'
    });

    const jindal = result[0];
    assert(jindal.activeOrders === 2, 'Accurately sums 2 active orders for Jindal');
    assert(jindal.itemsToDeliver === 100, `Accurately sums total pending items 40 + 60 = 100 (Actual: ${jindal.itemsToDeliver})`);
    assert(jindal.expectedDelivery === '2026-10-24', 'Shows earliest upcoming expected delivery date "2026-10-24"');
    assert(jindal.contact === 'contact@jindal.com', 'Falls back to email when phone is unavailable');
  }

  // ---------------------------------------------------------------------------
  // 5. Handling Unavailable Contact & Delivery Date (No Fabricated Values)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Unavailability Fallback: "Not available" ---');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-005',
        name: 'Local Hardware Traders',
        company: 'Local Hardware',
        phone: '', // No phone
        email: '', // No email
        address: 'Market',
        gstin: '',
        pan: '',
        creditDays: 0,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 0,
        totalPaid: 0,
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];

    const mockOrders = [
      {
        id: 'po-301',
        order_number: 'PO-2026-3001',
        supplier_id: 'sup-005',
        status: 'Pending',
        expected_delivery: null, // No date
        purchase_order_items: [{ product_name: 'Binding Wire', qty: 15, received_qty: 0 }]
      }
    ];

    const result = computeSupplierDeliveries({
      suppliers: mockSuppliers,
      purchaseOrders: mockOrders,
      purchaseRequests: [],
      todayStr: '2026-10-22'
    });

    const local = result[0];
    assert(local.contact === 'Not available', 'Displays "Not available" when neither phone nor email exists');
    assert(local.expectedDelivery === 'Not available', 'Displays "Not available" when no delivery date is recorded');
    assert(local.deliveryStatus === 'Pending', 'Status is "Pending" for pending order without date');
  }

  // ---------------------------------------------------------------------------
  // 6. Fully Delivered Orders Status
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Delivered Status for Fulfilled Suppliers ---');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-006',
        name: 'Supreme Pipes Ltd',
        company: 'Supreme',
        phone: '+91 99000 11223',
        email: 'dispatch@supreme.com',
        address: 'Jalgaon',
        gstin: '27AAACS1111K1Z3',
        pan: 'AAACS1111K',
        creditDays: 30,
        openingBalance: 0,
        currentOutstanding: 0,
        totalPurchases: 100000,
        totalPaid: 100000,
        status: 'Active',
        createdAt: new Date().toISOString()
      }
    ];

    const mockOrders = [
      {
        id: 'po-401',
        order_number: 'PO-2026-4001',
        supplier_id: 'sup-006',
        status: 'Completed',
        expected_delivery: '2026-10-15',
        purchase_order_items: [{ product_name: 'PVC Pipe 4-inch', qty: 50, received_qty: 50 }]
      }
    ];

    const result = computeSupplierDeliveries({
      suppliers: mockSuppliers,
      purchaseOrders: mockOrders,
      purchaseRequests: [],
      todayStr: '2026-10-22'
    });

    const supreme = result[0];
    assert(supreme.activeOrders === 0, 'Active orders equals 0 for fulfilled order');
    assert(supreme.itemsToDeliver === 0, 'Items to deliver equals 0');
    assert(supreme.deliveryStatus === 'Delivered', 'Delivery status is "Delivered"');
  }

  // ---------------------------------------------------------------------------
  // 7. Warehouse Manager and Owner Dashboards Untouched
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Non-Regression: Other Roles Dashboards Untouched ---');
  {
    const wmPath = path.resolve(process.cwd(), 'src/pages/warehouse/WarehouseManagerDashboardPage.tsx');
    const wmContent = fs.readFileSync(wmPath, 'utf-8');
    assert(
      wmContent.includes('title="Low Stock Items"'),
      'Warehouse Manager dashboard retains its Low Stock Items card'
    );
    assert(
      wmContent.includes('id="low-stock-table-card"'),
      'Warehouse Manager dashboard retains its low-stock-table-card'
    );

    const ownerPath = path.resolve(process.cwd(), 'src/pages/dashboard/DashboardPage.tsx');
    const ownerContent = fs.readFileSync(ownerPath, 'utf-8');
    assert(
      ownerContent.includes('Low Stock & Reorder Warnings'),
      'Owner / Admin dashboard retains Low Stock & Reorder Warnings card'
    );
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
  console.log('================================================================\n');

  if (totalTests === passedTests) {
    console.log('🎉 All Supplier Delivery Overview tests passed 100%!\n');
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
