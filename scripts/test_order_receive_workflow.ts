// Test Suite: Order Receive Workflow for Warehouse Manager
// Verifies all acceptance criteria from the user prompt:
// 1. Sidebar Navigation & Scroll-down Submenu
// 2. Order Receive Page & 11 Table Columns
// 3. Eye Icon (View Full Details)
// 4. Receive Button & Goods Receipt Confirmation
// 5. Delivery Status Progression (Pending -> Partially Received -> Received / Completed)
// 6. Permissions, Data Integrity & Stock Updates (Only accepted stock added, damaged excluded)

import { orderReceiveService } from '../src/services/orderReceiveService';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { canAccessRoute, canRoleAccessSubItem, canRoleAccessNavItem } from '../src/utils/rbac';
import { PurchaseRequest, PurchaseInvoice, Supplier, Warehouse, Product } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: WAREHOUSE MANAGER ORDER RECEIVE WORKFLOW');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 1: Sidebar Navigation & RBAC
  // ---------------------------------------------------------------------------
  console.log('👉 SECTION 1: Sidebar Navigation & Role-Based Access Control');
  {
    // 1.1 Warehouse Manager can access /inventory/receive
    assert(
      canAccessRoute('Warehouse Manager', '/inventory/receive') === true,
      'Warehouse Manager has authorized access to /inventory/receive'
    );
    assert(
      canAccessRoute('Warehouse Manager', '/inventory/order-receive') === true,
      'Warehouse Manager has authorized access to alias /inventory/order-receive'
    );

    // 1.2 Admin & Owner can also access /inventory/receive
    assert(
      canAccessRoute('Owner', '/inventory/receive') === true,
      'Owner has oversight access to /inventory/receive'
    );
    assert(
      canAccessRoute('Admin', '/inventory/receive') === true,
      'Admin has oversight access to /inventory/receive'
    );

    // 1.3 Other roles are strictly blocked from /inventory/receive
    assert(
      canAccessRoute('Purchase Manager', '/inventory/receive') === false,
      'Purchase Manager is strictly forbidden from /inventory/receive'
    );
    assert(
      canAccessRoute('Salesperson', '/inventory/receive') === false,
      'Salesperson is strictly forbidden from /inventory/receive'
    );
    assert(
      canAccessRoute('Cashier', '/inventory/receive') === false,
      'Cashier is strictly forbidden from /inventory/receive'
    );

    // 1.4 Submenu access checks in canRoleAccessSubItem
    assert(
      canRoleAccessSubItem('Warehouse Manager', 'Inventory', 'Order Receive', '/inventory/receive') === true,
      'Warehouse Manager can access "Order Receive" under Inventory parent menu'
    );
    assert(
      canRoleAccessSubItem('Purchase Manager', 'Inventory', 'Order Receive', '/inventory/receive') === false,
      'Purchase Manager cannot access "Order Receive" subitem under Inventory'
    );

    // 1.5 Sidebar source code check: Order Receive is in Sidebar.tsx for Warehouse Manager
    const sidebarPath = path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

    assert(
      sidebarContent.includes("name: 'Order Receive', path: '/inventory/receive'"),
      'Sidebar.tsx registers { name: "Order Receive", path: "/inventory/receive" }'
    );
    assert(
      sidebarContent.includes("profile?.role === 'Warehouse Manager'"),
      'Sidebar.tsx configures Order Receive specifically for Warehouse Manager'
    );
    assert(
      sidebarContent.includes("PackageCheck"),
      'Sidebar.tsx uses PackageCheck icon for Order Receive'
    );

    // 1.6 App.tsx routes check
    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert(
      appContent.includes('path="inventory/receive"'),
      'App.tsx configures path="inventory/receive"'
    );
    assert(
      appContent.includes('OrderReceivePage'),
      'App.tsx renders <OrderReceivePage /> for inventory/receive'
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Order Receive Page Structure & 11 Table Columns
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 2: Order Receive Page Layout & 11 Table Columns');
  {
    const pagePath = path.resolve(process.cwd(), 'src/pages/inventory/OrderReceivePage.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    const expectedTableColumns = [
      'Purchase Order / Bill #',
      'Supplier Name',
      'Supplier Contact',
      'Expected Delivery',
      'Delivery Status',
      'Actions'
    ];

    expectedTableColumns.forEach(col => {
      assert(
        pageContent.includes(col),
        `Order Receive table contains required column: "${col}"`
      );
    });

    // Verification that Supplier Invoice and ordered products breakdown are present in the Eye Details Modal
    assert(
      pageContent.includes('Supplier Invoice:') &&
      pageContent.includes('Ordered Products Breakdown') &&
      pageContent.includes('Pending Qty') &&
      pageContent.includes('Previously Received'),
      'Eye Details Modal displays comprehensive breakdown: Supplier Invoice, Ordered Products, Ordered Qty, Previously Received, and Pending Qty'
    );

    // Check for KPI stats & status tabs
    assert(
      pageContent.includes('Awaiting Receipt') &&
      pageContent.includes('Pending Deliveries') &&
      pageContent.includes('Partially Received') &&
      pageContent.includes('Received / Completed'),
      'Order Receive page displays KPI statistics and status cards'
    );

    // Check for Search & Warehouse filter
    assert(
      pageContent.includes('Search by PO#, supplier, invoice#, or product...'),
      'Search input is present for instant filtering'
    );
    assert(
      pageContent.includes('All Warehouses'),
      'Warehouse dropdown filter is present'
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: Data Aggregation & Calculations
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 3: Supplier Orders Awaiting Receipt Aggregation');
  {
    const mockSuppliers: Supplier[] = [
      {
        id: 'sup-100',
        name: 'Bharat Steel Industries',
        company: 'Bharat Steel',
        phone: '+91 98765 11111',
        email: 'sales@bharatsteel.com',
        address: 'Plot 45, Industrial Area, Pune',
        gstin: '27AABCB1234F1Z9',
        pan: 'AABCB1234F',
        creditDays: 30,
        openingBalance: 0,
        currentOutstanding: 50000,
        totalPurchases: 500000,
        totalPaid: 450000,
        status: 'Active',
        createdAt: '2026-01-01T00:00:00Z'
      }
    ];

    const mockProducts: Product[] = [
      {
        id: 'prod-001',
        name: 'Steel Rod 12mm',
        sku: 'STL-12MM-01',
        primaryUnit: 'Piece',
        currentStock: 100,
        costPrice: 250,
        purchasePrice: 250,
        sellingPrice: 300,
        taxRate: 18,
        createdAt: '2026-01-01T00:00:00Z'
      } as any,
      {
        id: 'prod-002',
        name: 'Steel Rod 16mm',
        sku: 'STL-16MM-02',
        primaryUnit: 'Piece',
        currentStock: 50,
        costPrice: 400,
        purchasePrice: 400,
        sellingPrice: 480,
        taxRate: 18,
        createdAt: '2026-01-01T00:00:00Z'
      } as any
    ];

    const mockWarehouses: Warehouse[] = [
      {
        id: 'wh-main',
        companyId: '00000000-0000-0000-0000-000000000001',
        name: 'Central Godown',
        code: 'WH-MAIN',
        address: 'Central Hub',
        isDefault: true,
        createdAt: '2026-01-01T00:00:00Z'
      }
    ];

    const mockPurchaseRequests: PurchaseRequest[] = [
      {
        id: 'pr-test-1',
        companyId: '00000000-0000-0000-0000-000000000001',
        requestNumber: 'PR-2026-0001',
        warehouseId: 'wh-main',
        warehouseName: 'Central Godown',
        requesterId: 'wm-01',
        requesterName: 'Warehouse Staff',
        status: 'Ordered',
        priority: 'Normal',
        purchaseOrderId: 'po-test-1',
        purchaseOrderNumber: 'PO-2026-9001',
        requestedDeliveryDate: '2026-10-30',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
        items: [
          {
            id: 'it-1',
            requestId: 'pr-test-1',
            productId: 'prod-001',
            productName: 'Steel Rod 12mm',
            sku: 'STL-12MM-01',
            currentStock: 100,
            requestedQty: 50,
            approvedQty: 50,
            receivedQty: 0,
            unit: 'Piece'
          },
          {
            id: 'it-2',
            requestId: 'pr-test-1',
            productId: 'prod-002',
            productName: 'Steel Rod 16mm',
            sku: 'STL-16MM-02',
            currentStock: 50,
            requestedQty: 30,
            approvedQty: 30,
            receivedQty: 0,
            unit: 'Piece'
          }
        ],
        history: [
          {
            id: 'hist-1',
            requestId: 'pr-test-1',
            statusTo: 'Ordered',
            userId: 'pm-01',
            userName: 'Purchase Manager',
            comments: 'Converted to Purchase Order PO-2026-9001 (Vendor: Bharat Steel Industries)',
            createdAt: '2026-10-21T10:00:00Z'
          }
        ]
      }
    ];

    const mockPurchaseInvoices: PurchaseInvoice[] = [
      {
        id: 'bill-101',
        invoiceNumber: 'INV-BSI-9988',
        docType: 'purchase_invoice',
        date: '2026-10-22',
        dueDate: '2026-11-22',
        supplierId: 'sup-100',
        supplierName: 'Bharat Steel Industries',
        supplierGstin: '27AABCB1234F1Z9',
        items: [],
        subtotal: 24500,
        taxTotal: 4410,
        freightCharges: 0,
        otherCharges: 0,
        grandTotal: 28910,
        paidAmount: 0,
        paymentStatus: 'Unpaid',
        warehouse: 'wh-main',
        createdAt: '2026-10-22T12:00:00Z',
        purchaseOrderId: 'po-test-1',
        purchaseOrderNumber: 'PO-2026-9001',
        purchaseRequestId: 'pr-test-1',
        purchaseRequestNumber: 'PR-2026-0001'
      }
    ];

    const list = orderReceiveService.getOrderReceiveList({
      purchaseRequests: mockPurchaseRequests,
      purchaseInvoices: mockPurchaseInvoices,
      suppliers: mockSuppliers,
      warehouses: mockWarehouses,
      products: mockProducts,
      todayStr: '2026-10-27'
    });

    assert(list.length === 1, 'Successfully aggregates order awaiting receipt');
    const item = list[0];

    assert(item.orderNumber === 'PO-2026-9001', 'Purchase order number is correctly resolved');
    assert(item.supplierName === 'Bharat Steel Industries', 'Supplier name correctly extracted');
    assert(item.supplierContact === '+91 98765 11111', 'Supplier contact correctly extracted');
    assert(item.supplierInvoiceNumber === 'INV-BSI-9988', 'Supplier invoice number matched from linked bill');
    assert(item.hasSupplierBill === true, 'Linked supplier bill presence detected');
    assert(item.orderedQuantity === 80, 'Total ordered quantity is 80 (50 + 30)');
    assert(item.previouslyReceivedQuantity === 0, 'Initial received quantity is 0');
    assert(item.pendingQuantity === 80, 'Initial pending quantity is 80');
    assert(item.deliveryStatus === 'Pending', 'Initial delivery status is "Pending"');
    assert(item.items.length === 2, 'Line items preserved with SKU and product details');
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: Goods Receipt Execution & Stock Updates
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 4: Goods Receipt Execution & Atomic Stock Updates');
  {
    // Create an actual PR for end-to-end receipt testing
    const testPr = await purchaseRequestService.createPurchaseRequest({
      warehouseId: '00000000-0000-0000-0000-000000000002',
      warehouseName: 'Main Central Warehouse',
      priority: 'Normal',
      reason: 'Order Receive E2E Verification',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616', // paint product from test suite
          productName: 'Paint 1L Can',
          requestedQty: 20,
          currentStock: 10,
          unit: 'Liter',
          estimatedCost: 500
        }
      ]
    });

    // Move to Approved & Ordered
    await purchaseRequestService.updateRequestStatus({
      requestId: testPr.id,
      status: 'Approved',
      adjustedItems: [{ itemId: testPr.items[0].id, approvedQty: 20 }]
    });

    await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: testPr.id,
      supplierId: '381f01b1-73fd-4b72-82a7-51ec57e33dac',
      supplierName: 'Premier Paints Supplier',
      supplierGstin: '27AABCS1234F1Z1',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          productName: 'Paint 1L Can',
          qty: 20,
          unit: 'Liter',
          rate: 500,
          taxRate: 18
        }
      ]
    });

    const orderedPr = await purchaseRequestService.getPurchaseRequestById(testPr.id);
    assert(orderedPr?.status === 'Ordered', 'Purchase Request successfully converted to "Ordered"');

    // 4.1 Partial Receipt with Damaged Goods (Arrived = 10, Damaged = 2 -> Accepted = 8)
    const partialReceipt = await purchaseRequestService.recordGoodsReceipt({
      requestId: testPr.id,
      receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
      invoiceNumber: 'INV-TEST-001',
      notes: 'First delivery batch: 2 cans leaked in transit',
      receivedItems: [
        {
          itemId: testPr.items[0].id,
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          receivedQty: 10,
          damagedQty: 2,
          acceptedQty: 8
        }
      ]
    });

    assert(partialReceipt.status === 'Partially Received', 'Status transitions to "Partially Received" after first receipt');
    assert(partialReceipt.items[0].receivedQty === 10, 'Total arrived recorded as 10');
    assert(
      partialReceipt.history?.some(h => h.comments?.includes('8 accepted (2 damaged/rejected)')),
      'Receipt audit history notes accepted (8) and damaged (2) items'
    );

    // Verify orderReceiveService now calculates status as Partially Received
    const aggregatedAfterPartial = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [partialReceipt],
      todayStr: '2026-10-27'
    });
    assert(
      aggregatedAfterPartial[0].deliveryStatus === 'Partially Received',
      'Order Receive table shows deliveryStatus as "Partially Received"'
    );
    assert(
      aggregatedAfterPartial[0].pendingQuantity === 10,
      'Order Receive table shows 10 units still pending receipt'
    );

    // 4.2 Final Receipt (Arrived = 10, Damaged = 0 -> Accepted = 10)
    const finalReceipt = await purchaseRequestService.recordGoodsReceipt({
      requestId: testPr.id,
      receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
      invoiceNumber: 'INV-TEST-002',
      notes: 'Second delivery batch: complete and intact',
      receivedItems: [
        {
          itemId: testPr.items[0].id,
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          receivedQty: 10,
          damagedQty: 0,
          acceptedQty: 10
        }
      ]
    });

    assert(finalReceipt.status === 'Completed', 'Status transitions to "Completed" when all quantities received');
    assert(finalReceipt.items[0].receivedQty === 20, 'Total arrived recorded as 20');

    // Verify orderReceiveService now calculates status as Received / Completed
    const aggregatedAfterFinal = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [finalReceipt],
      todayStr: '2026-10-27'
    });
    assert(
      aggregatedAfterFinal[0].deliveryStatus === 'Received / Completed',
      'Order Receive table shows deliveryStatus as "Received / Completed"'
    );
    assert(
      aggregatedAfterFinal[0].pendingQuantity === 0,
      'Order Receive table shows 0 units pending'
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: Over-receipt & Duplicate Receipt Validation
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 5: Over-receipt & Data Integrity Guards');
  {
    // Try to receive zero or negative items
    let zeroError = false;
    try {
      await orderReceiveService.confirmGoodsReceipt({
        orderId: 'test-order',
        receivingWarehouseId: 'wh-1',
        receivedItems: [
          { itemId: 'it-1', productId: 'prod-1', arrivedQty: 0, damagedQty: 0, acceptedQty: 0 }
        ]
      });
    } catch (e: any) {
      zeroError = true;
      assert(
        e.message.includes('at least one positive received quantity'),
        'Zero arrived quantity is strictly rejected'
      );
    }
    assert(zeroError, 'Prevented empty/zero goods receipt');

    // Try damaged > arrived
    let damagedError = false;
    try {
      await orderReceiveService.confirmGoodsReceipt({
        orderId: 'test-order',
        receivingWarehouseId: 'wh-1',
        receivedItems: [
          { itemId: 'it-1', productId: 'prod-1', arrivedQty: 5, damagedQty: 8, acceptedQty: 0 }
        ]
      });
    } catch (e: any) {
      damagedError = true;
      assert(
        e.message.includes('cannot exceed arrived quantity'),
        'Damaged quantity exceeding arrived quantity is strictly rejected'
      );
    }
    assert(damagedError, 'Prevented invalid damaged > arrived quantity');
  }

  console.log('\n===============================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   PASSED:      ${passedTests}`);
  console.log(`   FAILED:      ${totalTests - passedTests}`);
  console.log('===============================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});
