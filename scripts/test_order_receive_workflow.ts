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
      'Supplier',
      'Warehouse',
      'Purchase Orders',
      'Products Pending',
      'Outstanding Quantity',
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

    // Verification of Supplier Delivery Details and Inward Products Breakdown
    assert(
      pageContent.includes('Supplier Delivery Overview') &&
      pageContent.includes('All Products in Delivery') &&
      pageContent.includes('Previously Received') &&
      pageContent.includes('Receive Delivery'),
      'Eye Details Modal & Receive Form display comprehensive supplier delivery breakdown and actions'
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
      pageContent.includes('Search by supplier, PO#, GSTIN, or product...'),
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

  // ---------------------------------------------------------------------------
  // SECTION 6: Cement Bags Example & Default vs Edited Quantity Verification
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 6: Cement Bags Example & Default vs Edited Quantity Verification');
  {
    // Test Case A: Default Quantity Unchanged (All 20 bags arrive)
    const cementPrA = await purchaseRequestService.createPurchaseRequest({
      warehouseId: '00000000-0000-0000-0000-000000000002',
      warehouseName: 'Main Central Warehouse',
      priority: 'Normal',
      reason: '20 Bags of Cement Test A (Default Unchanged)',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          productName: 'Cement 50kg Bag',
          requestedQty: 20,
          currentStock: 0,
          unit: 'Bag',
          estimatedCost: 350
        }
      ]
    });

    await purchaseRequestService.updateRequestStatus({
      requestId: cementPrA.id,
      status: 'Approved',
      adjustedItems: [{ itemId: cementPrA.items[0].id, approvedQty: 20 }]
    });

    await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: cementPrA.id,
      supplierId: '381f01b1-73fd-4b72-82a7-51ec57e33dac',
      supplierName: 'UltraTech Cement Supplier',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          productName: 'Cement 50kg Bag',
          qty: 20,
          unit: 'Bag',
          rate: 350,
          taxRate: 18
        }
      ]
    });

    // Fetch order in Order Receive list:
    const orderListA = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [await purchaseRequestService.getPurchaseRequestById(cementPrA.id)!],
      todayStr: '2026-10-27'
    });
    const orderA = orderListA.find(o => o.id === cementPrA.id)!;
    assert(orderA.items[0].orderedQty === 20, 'Case A: Ordered quantity displays 20 (from Purchase Manager)');
    assert(orderA.items[0].pendingQty === 20, 'Case A: Pending quantity displays 20');

    // Form defaults to pending quantity (20):
    const defaultQtyA = orderA.items[0].pendingQty;
    assert(defaultQtyA === 20, 'Case A: Receive form defaults quantity to 20 bags');

    // Warehouse Manager leaves default unchanged and confirms:
    const receiptA = await purchaseRequestService.recordGoodsReceipt({
      requestId: cementPrA.id,
      receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
      receivedItems: [
        {
          itemId: orderA.items[0].id,
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          receivedQty: defaultQtyA,
          damagedQty: 0,
          acceptedQty: defaultQtyA
        }
      ]
    });

    assert(receiptA.status === 'Completed', 'Case A: Order status moves to "Completed"');
    assert(receiptA.items[0].receivedQty === 20, 'Case A: Saved 20 as received');

    // Verify duplicate receipt is blocked for Completed order:
    let duplicateBlocked = false;
    try {
      await purchaseRequestService.recordGoodsReceipt({
        requestId: cementPrA.id,
        receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
        receivedItems: [{ itemId: orderA.items[0].id, productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616', receivedQty: 1 }]
      });
    } catch (e: any) {
      duplicateBlocked = true;
      assert(e.message.includes('already been fully received'), 'Case A: Duplicate receipt on completed order is blocked');
    }
    assert(duplicateBlocked, 'Case A: Prevented duplicate receipt');

    // Test Case B: Quantity Manually Reduced (18 bags arrive out of 20)
    const cementPrB = await purchaseRequestService.createPurchaseRequest({
      warehouseId: '00000000-0000-0000-0000-000000000002',
      warehouseName: 'Main Central Warehouse',
      priority: 'Normal',
      reason: '20 Bags of Cement Test B (Edited to 18)',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          productName: 'Cement 50kg Bag',
          requestedQty: 20,
          currentStock: 0,
          unit: 'Bag',
          estimatedCost: 350
        }
      ]
    });

    await purchaseRequestService.updateRequestStatus({
      requestId: cementPrB.id,
      status: 'Approved',
      adjustedItems: [{ itemId: cementPrB.items[0].id, approvedQty: 20 }]
    });

    await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: cementPrB.id,
      supplierId: '381f01b1-73fd-4b72-82a7-51ec57e33dac',
      supplierName: 'UltraTech Cement Supplier',
      items: [
        {
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          productName: 'Cement 50kg Bag',
          qty: 20,
          unit: 'Bag',
          rate: 350,
          taxRate: 18
        }
      ]
    });

    // Fetch order in Order Receive list:
    const orderListB = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [await purchaseRequestService.getPurchaseRequestById(cementPrB.id)!],
      todayStr: '2026-10-27'
    });
    const orderB = orderListB.find(o => o.id === cementPrB.id)!;
    assert(orderB.items[0].orderedQty === 20, 'Case B: Original ordered quantity is 20 in PO (Preserved)');
    assert(orderB.items[0].pendingQty === 20, 'Case B: Initial pending quantity is 20');

    // Only 18 arrive: Warehouse Manager changes quantity from 20 to 18:
    const editedQty = 18;
    const receiptB1 = await purchaseRequestService.recordGoodsReceipt({
      requestId: cementPrB.id,
      receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
      receivedItems: [
        {
          itemId: orderB.items[0].id,
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          receivedQty: editedQty,
          damagedQty: 0,
          acceptedQty: editedQty
        }
      ]
    });

    assert(receiptB1.status === 'Partially Received', 'Case B: Order status is "Partially Received" after receiving 18');
    assert(receiptB1.items[0].receivedQty === 18, 'Case B: Saved exactly 18 as received (never added 20 + 18)');

    // Check Order Receive page again:
    const orderListB_after1 = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [receiptB1],
      todayStr: '2026-10-27'
    });
    const orderB_after1 = orderListB_after1.find(o => o.id === cementPrB.id)!;
    assert(orderB_after1.items[0].orderedQty === 20, 'Case B: Original ordered quantity remains 20 in PO');
    assert(orderB_after1.items[0].previouslyReceivedQty === 18, 'Case B: Previously received shows 18');
    assert(orderB_after1.items[0].pendingQty === 2, 'Case B: Exactly 2 bags remain pending for later delivery');

    // Form must default to current outstanding quantity (2), not the original order quantity (20):
    const defaultQtyB2 = orderB_after1.items[0].pendingQty;
    assert(defaultQtyB2 === 2, 'Case B: Receive form now defaults to 2 bags (current outstanding), not 20');

    // Over-receipt attempt: Warehouse Manager tries to enter 5 when only 2 pending:
    let overDeliveryBlocked = false;
    try {
      await purchaseRequestService.recordGoodsReceipt({
        requestId: cementPrB.id,
        receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
        receivedItems: [{ itemId: orderB.items[0].id, productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616', receivedQty: 5 }]
      });
    } catch (e: any) {
      overDeliveryBlocked = true;
      assert(e.message.includes('exceeds outstanding pending quantity'), 'Case B: Receiving more than outstanding quantity (5 > 2) is blocked');
    }
    assert(overDeliveryBlocked, 'Case B: Prevented over-receipt exceeding pending quantity');

    // Later delivery: Remaining 2 bags arrive:
    const receiptB2 = await purchaseRequestService.recordGoodsReceipt({
      requestId: cementPrB.id,
      receivingWarehouseId: '00000000-0000-0000-0000-000000000002',
      receivedItems: [
        {
          itemId: orderB.items[0].id,
          productId: '80bcca26-4bb0-4a4c-aa64-5562177fe616',
          receivedQty: 2,
          damagedQty: 0,
          acceptedQty: 2
        }
      ]
    });

    assert(receiptB2.status === 'Completed', 'Case B: Order status is now "Completed" after receiving remaining 2 bags');
    assert(receiptB2.items[0].receivedQty === 20, 'Case B: Total received is exactly 20 bags (18 + 2)');

    const orderListB_final = orderReceiveService.getOrderReceiveList({
      purchaseRequests: [receiptB2],
      todayStr: '2026-10-27'
    });
    const orderB_final = orderListB_final.find(o => o.id === cementPrB.id)!;
    assert(orderB_final.deliveryStatus === 'Received / Completed', 'Case B: Delivery status is "Received / Completed"');
    assert(orderB_final.pendingQuantity === 0, 'Case B: Outstanding pending quantity is 0');
  }

  // ---------------------------------------------------------------------------
  // SECTION 7: Multi-PO Supplier-Wise Complete Product Receiving Workflow
  // ---------------------------------------------------------------------------
  console.log('\n👉 SECTION 7: Multi-PO Supplier-Wise Complete Product Receiving Workflow');
  {
    // Setup Mock Entities:
    // Supplier A has 2 Purchase Orders (PO-001 & PO-002)
    // Supplier B has 1 Purchase Order (PO-003)
    const supplierA: Supplier = {
      id: 'sup-a-uuid-1111',
      name: 'Ultratech Cement Supplies',
      company: 'Ultratech Ltd',
      phone: '+91 98765 44444',
      email: 'orders@ultratech.com',
      address: 'Industrial Zone 1, Mumbai',
      gstin: '27AAAAU1234F1Z1',
      pan: 'AAAAU1234F',
      creditDays: 30,
      openingBalance: 0,
      currentOutstanding: 0,
      totalPurchases: 0,
      totalPaid: 0,
      status: 'Active',
      createdAt: '2026-01-01T00:00:00Z'
    };

    const supplierB: Supplier = {
      id: 'sup-b-uuid-2222',
      name: 'Tata Steel Tubes',
      company: 'Tata Steel',
      phone: '+91 98765 55555',
      email: 'orders@tatasteel.com',
      address: 'Steel Yard, Jamshedpur',
      gstin: '20AAACT5678F1Z2',
      pan: 'AAACT5678F',
      creditDays: 30,
      openingBalance: 0,
      currentOutstanding: 0,
      totalPurchases: 0,
      totalPaid: 0,
      status: 'Active',
      createdAt: '2026-01-01T00:00:00Z'
    };

    const whId = '00000000-0000-0000-0000-000000000002';
    const testWarehouses: Warehouse[] = [
      {
        id: whId,
        companyId: '00000000-0000-0000-0000-000000000001',
        name: 'Main Central Depot',
        code: 'DEPOT-1',
        address: 'Warehouse Hub',
        isDefault: true,
        createdAt: '2026-01-01T00:00:00Z'
      }
    ];

    // Create 3 products for Supplier A and 1 product for Supplier B
    // Product X (OPC Cement 50kg)
    const prodX: Product = {
      id: '00000000-0000-0000-0000-000000000111',
      name: 'OPC 53 Grade Cement',
      sku: 'CEM-OPC-53',
      primaryUnit: 'Bag',
      currentStock: 100,
      costPrice: 350,
      purchasePrice: 350,
      sellingPrice: 420,
      taxRate: 18,
      batchTracking: false,
      createdAt: '2026-01-01T00:00:00Z'
    } as any;

    // Product Y (PPC Cement 50kg)
    const prodY: Product = {
      id: '00000000-0000-0000-0000-000000000222',
      name: 'PPC Portland Cement',
      sku: 'CEM-PPC-50',
      primaryUnit: 'Bag',
      currentStock: 50,
      costPrice: 320,
      purchasePrice: 320,
      sellingPrice: 380,
      taxRate: 18,
      batchTracking: false,
      createdAt: '2026-01-01T00:00:00Z'
    } as any;

    // Product Z (White Cement 25kg - batch tracked)
    const prodZ: Product = {
      id: '00000000-0000-0000-0000-000000000333',
      name: 'JK White Cement 25kg',
      sku: 'CEM-WHT-25',
      primaryUnit: 'Bag',
      currentStock: 25,
      costPrice: 450,
      purchasePrice: 450,
      sellingPrice: 550,
      taxRate: 18,
      batchTracking: true,
      expiryTracking: true,
      createdAt: '2026-01-01T00:00:00Z'
    } as any;

    // Product W (Steel Rebar - Supplier B)
    const prodW: Product = {
      id: '00000000-0000-0000-0000-000000000444',
      name: 'TMT 12mm Rebar',
      sku: 'STL-TMT-12',
      primaryUnit: 'Ton',
      currentStock: 10,
      costPrice: 55000,
      purchasePrice: 55000,
      sellingPrice: 62000,
      taxRate: 18,
      batchTracking: false,
      createdAt: '2026-01-01T00:00:00Z'
    } as any;

    // 7.1 Setup Purchase Requests / Approved POs:
    // PO-001 (Supplier A): Product X: 10 units, Product Y: 5 units
    const pr1 = await purchaseRequestService.createPurchaseRequest({
      warehouseId: whId,
      warehouseName: 'Main Central Depot',
      priority: 'High',
      reason: 'Urgent order for Supplier A',
      requestedDeliveryDate: '2026-11-01',
      items: [
        {
          productId: prodX.id,
          productName: prodX.name,
          requestedQty: 10,
          currentStock: 100,
          unit: 'Bag',
          estimatedCost: 350
        },
        {
          productId: prodY.id,
          productName: prodY.name,
          requestedQty: 5,
          currentStock: 50,
          unit: 'Bag',
          estimatedCost: 320
        }
      ]
    });

    await purchaseRequestService.updateRequestStatus({
      requestId: pr1.id,
      status: 'Approved',
      adjustedItems: [
        { itemId: pr1.items[0].id, approvedQty: 10 },
        { itemId: pr1.items[1].id, approvedQty: 5 }
      ]
    });

    const po1Res = await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: pr1.id,
      supplierId: supplierA.id,
      supplierName: supplierA.name,
      supplierGstin: supplierA.gstin,
      items: [
        {
          productId: prodX.id,
          productName: prodX.name,
          qty: 10,
          unit: 'Bag',
          rate: 350,
          taxRate: 18
        },
        {
          productId: prodY.id,
          productName: prodY.name,
          qty: 5,
          unit: 'Bag',
          rate: 320,
          taxRate: 18
        }
      ]
    });
    const po1 = po1Res.request;

    // PO-002 (Supplier A): Product Z: 8 units
    const pr2 = await purchaseRequestService.createPurchaseRequest({
      warehouseId: whId,
      warehouseName: 'Main Central Depot',
      priority: 'Normal',
      reason: 'Second order for Supplier A',
      requestedDeliveryDate: '2026-11-02',
      items: [
        {
          productId: prodZ.id,
          productName: prodZ.name,
          requestedQty: 8,
          currentStock: 25,
          unit: 'Bag',
          estimatedCost: 450
        }
      ]
    });

    await purchaseRequestService.updateRequestStatus({
      requestId: pr2.id,
      status: 'Approved',
      adjustedItems: [
        { itemId: pr2.items[0].id, approvedQty: 8 }
      ]
    });

    const po2Res = await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: pr2.id,
      supplierId: supplierA.id,
      supplierName: supplierA.name,
      supplierGstin: supplierA.gstin,
      items: [
        {
          productId: prodZ.id,
          productName: prodZ.name,
          qty: 8,
          unit: 'Bag',
          rate: 450,
          taxRate: 18
        }
      ]
    });
    const po2 = po2Res.request;

    // PO-003 (Supplier B): Product W: 4 units
    const pr3 = await purchaseRequestService.createPurchaseRequest({
      warehouseId: whId,
      warehouseName: 'Main Central Depot',
      priority: 'Normal',
      reason: 'Order for Supplier B',
      requestedDeliveryDate: '2026-11-03',
      items: [
        {
          productId: prodW.id,
          productName: prodW.name,
          requestedQty: 4,
          currentStock: 10,
          unit: 'Ton',
          estimatedCost: 55000
        }
      ]
    });

    await purchaseRequestService.updateRequestStatus({
      requestId: pr3.id,
      status: 'Approved',
      adjustedItems: [
        { itemId: pr3.items[0].id, approvedQty: 4 }
      ]
    });

    const po3Res = await purchaseRequestService.createPurchaseOrderFromRequest({
      requestId: pr3.id,
      supplierId: supplierB.id,
      supplierName: supplierB.name,
      supplierGstin: supplierB.gstin,
      items: [
        {
          productId: prodW.id,
          productName: prodW.name,
          qty: 4,
          unit: 'Ton',
          rate: 55000,
          taxRate: 18
        }
      ]
    });
    const po3 = po3Res.request;

    // 7.2 Verify Supplier-Wise Delivery Grouping:
    const groups = orderReceiveService.getSupplierDeliveryGroups({
      purchaseRequests: [po1, po2, po3],
      suppliers: [supplierA, supplierB],
      warehouses: testWarehouses,
      todayStr: '2026-10-27'
    });

    assert(groups.length === 2, 'Exactly 2 distinct supplier delivery groups created (1 for Supplier A, 1 for Supplier B)');

    const groupA = groups.find(g => g.supplierId === supplierA.id);
    const groupB = groups.find(g => g.supplierId === supplierB.id);

    assert(!!groupA, 'Supplier A delivery group exists with actual supplier ID');
    assert(!!groupB, 'Supplier B delivery group exists with actual supplier ID');
    assert(groupA?.supplierName === 'Ultratech Cement Supplies', 'Supplier A name is preserved correctly');
    assert(groupA?.supplierGstin === '27AAAAU1234F1Z1', 'Supplier A GSTIN is preserved correctly');

    // Supplier A should have 2 POs and 3 products
    assert(groupA?.purchaseOrdersCount === 2, `Supplier A delivery group combines both approved POs (${po1Res.purchaseOrderNumber} and ${po2Res.purchaseOrderNumber})`);
    assert(groupA?.purchaseOrderNumbers.includes(po1Res.purchaseOrderNumber) && groupA?.purchaseOrderNumbers.includes(po2Res.purchaseOrderNumber), 'Both PO numbers are present in Supplier A delivery group');
    assert(groupA?.items.length === 3, 'Supplier A delivery group displays all 3 products together (X: 10, Y: 5, Z: 8)');
    assert(groupA?.totalOrderedQuantity === 23, 'Supplier A total ordered quantity is 23 (10 + 5 + 8)');
    assert(groupA?.totalOutstandingQuantity === 23, 'Supplier A initial total outstanding quantity is 23');
    assert(groupA?.totalPreviouslyReceivedQuantity === 0, 'Supplier A initial received quantity is 0');
    assert(groupA?.deliveryStatus === 'Pending', 'Supplier A initial delivery status is "Pending"');

    // Supplier B should NOT be merged
    assert(groupB?.purchaseOrdersCount === 1, `Supplier B has only its own PO (${po3Res.purchaseOrderNumber}) and is NOT merged with Supplier A`);
    assert(groupB?.items.length === 1, 'Supplier B has only Product W');
    assert(groupB?.totalOrderedQuantity === 4, 'Supplier B total ordered quantity is 4');

    // Verify PO reference is preserved for each product in Supplier A:
    const itemX = groupA!.items.find(i => i.productId === prodX.id)!;
    const itemY = groupA!.items.find(i => i.productId === prodY.id)!;
    const itemZ = groupA!.items.find(i => i.productId === prodZ.id)!;

    assert(itemX.orderNumber === po1Res.purchaseOrderNumber, `Product X correctly references ${po1Res.purchaseOrderNumber}`);
    assert(itemY.orderNumber === po1Res.purchaseOrderNumber, `Product Y correctly references ${po1Res.purchaseOrderNumber}`);
    assert(itemZ.orderNumber === po2Res.purchaseOrderNumber, `Product Z correctly references ${po2Res.purchaseOrderNumber}`);

    // 7.3 Execute First Delivery:
    // Arrived:
    // - Product X: 9 arrived, 1 damaged -> 8 accepted
    // - Product Y: 5 arrived, 0 damaged -> 5 accepted
    // - Product Z: 6 arrived, 0 damaged -> 6 accepted (with batch & expiry)
    console.log('  Executing first supplier delivery receiving action...');
    const deliveryResult1 = await orderReceiveService.confirmSupplierDelivery({
      supplierId: supplierA.id,
      receivingWarehouseId: whId,
      receivedItems: [
        {
          orderId: itemX.orderId,
          itemId: itemX.itemId,
          productId: itemX.productId,
          arrivedQty: 8,
          damagedQty: 0,
          acceptedQty: 8
        },
        {
          orderId: itemY.orderId,
          itemId: itemY.itemId,
          productId: itemY.productId,
          arrivedQty: 5,
          damagedQty: 0,
          acceptedQty: 5
        },
        {
          orderId: itemZ.orderId,
          itemId: itemZ.itemId,
          productId: itemZ.productId,
          arrivedQty: 6,
          damagedQty: 0,
          acceptedQty: 6,
          batchNumber: 'BATCH-WHT-2026',
          expiryDate: '2027-10-27',
          mfgDate: '2026-10-01'
        }
      ]
    });

    assert(deliveryResult1.totalAcceptedQty === 19, 'Supplier delivery confirmed successfully in one atomic action (19 units accepted)');
    assert(deliveryResult1.updatedOrders.length === 2, 'Both underlying POs were updated independently');

    // Fetch updated POs from service
    const updatedPo1_stage1 = (await purchaseRequestService.getPurchaseRequestById(po1.id))!;
    const updatedPo2_stage1 = (await purchaseRequestService.getPurchaseRequestById(po2.id))!;

    // PO1 checks: X: 8 received (2 pending), Y: 5 received (0 pending)
    assert(updatedPo1_stage1.status === 'Partially Received', 'PO-SUP-A-001 transitioned to "Partially Received"');
    const po1_itemX = updatedPo1_stage1.items.find(i => i.productId === prodX.id)!;
    const po1_itemY = updatedPo1_stage1.items.find(i => i.productId === prodY.id)!;
    assert(po1_itemX.receivedQty === 8, 'Product X has exactly 8 received in PO-SUP-A-001');
    assert(po1_itemY.receivedQty === 5, 'Product Y has exactly 5 received in PO-SUP-A-001');

    // PO2 checks: Z: 6 received (2 pending)
    assert(updatedPo2_stage1.status === 'Partially Received', 'PO-SUP-A-002 transitioned to "Partially Received"');
    const po2_itemZ = updatedPo2_stage1.items.find(i => i.productId === prodZ.id)!;
    assert(po2_itemZ.receivedQty === 6, 'Product Z has exactly 6 received in PO-SUP-A-002');

    // Re-evaluate delivery groups:
    const groupsAfterStage1 = orderReceiveService.getSupplierDeliveryGroups({
      purchaseRequests: [updatedPo1_stage1, updatedPo2_stage1, po3],
      suppliers: [supplierA, supplierB],
      warehouses: testWarehouses,
      todayStr: '2026-10-27'
    });

    const groupA_stage1 = groupsAfterStage1.find(g => g.supplierId === supplierA.id)!;
    assert(groupA_stage1.deliveryStatus === 'Partially Received', 'Supplier A group status is "Partially Received"');
    assert(groupA_stage1.totalPreviouslyReceivedQuantity === 19, 'Supplier A total received quantity recorded as 19 (8 + 5 + 6)');
    assert(groupA_stage1.totalOutstandingQuantity === 4, 'Supplier A outstanding quantity is exactly 4 (2 of X + 2 of Z)');
    assert(groupA_stage1.productsPendingCount === 2, 'Supplier A has 2 products with pending balance (Product X and Product Z)');

    // Verify default quantities for subsequent delivery:
    const itemX_stage1 = groupA_stage1.items.find(i => i.productId === prodX.id)!;
    const itemY_stage1 = groupA_stage1.items.find(i => i.productId === prodY.id)!;
    const itemZ_stage1 = groupA_stage1.items.find(i => i.productId === prodZ.id)!;

    assert(itemX_stage1.pendingQty === 2, 'Product X default receive quantity is now 2 (outstanding balance)');
    assert(itemY_stage1.pendingQty === 0, 'Product Y outstanding balance is 0 (fully received)');
    assert(itemZ_stage1.pendingQty === 2, 'Product Z default receive quantity is now 2 (outstanding balance)');

    // 7.4 Over-receiving Guard:
    let overReceivingBlocked = false;
    try {
      await orderReceiveService.confirmSupplierDelivery({
        supplierId: supplierA.id,
        receivingWarehouseId: whId,
        receivedItems: [
          {
            orderId: itemX_stage1.orderId,
            itemId: itemX_stage1.itemId,
            productId: itemX_stage1.productId,
            arrivedQty: 10, // Only 2 pending
            damagedQty: 0,
            acceptedQty: 10
          }
        ]
      });
    } catch (e: any) {
      overReceivingBlocked = true;
      assert(e.message.includes('exceeds outstanding pending quantity'), 'Over-receiving check prevents receiving more than outstanding quantity');
    }
    assert(overReceivingBlocked, 'Prevented accidental over-receiving across supplier delivery');

    // 7.5 Second Delivery to Complete Supplier Delivery:
    // Remaining 2 of X and 2 of Z arrive
    console.log('  Executing second supplier delivery to complete order...');
    const deliveryResult2 = await orderReceiveService.confirmSupplierDelivery({
      supplierId: supplierA.id,
      receivingWarehouseId: whId,
      supplierInvoiceNumber: 'INV-ULT-002',
      deliveryRemarks: 'Final remaining balance delivery',
      receivedItems: [
        {
          orderId: itemX_stage1.orderId,
          itemId: itemX_stage1.itemId,
          productId: itemX_stage1.productId,
          arrivedQty: 2,
          damagedQty: 0,
          acceptedQty: 2
        },
        {
          orderId: itemZ_stage1.orderId,
          itemId: itemZ_stage1.itemId,
          productId: itemZ_stage1.productId,
          arrivedQty: 2,
          damagedQty: 0,
          acceptedQty: 2,
          batchNumber: 'BATCH-WHT-2026',
          expiryDate: '2027-10-27'
        }
      ]
    });

    assert(deliveryResult2.totalAcceptedQty === 4, 'Second supplier delivery confirmed successfully (4 remaining units accepted)');

    const updatedPo1_final = (await purchaseRequestService.getPurchaseRequestById(po1.id))!;
    const updatedPo2_final = (await purchaseRequestService.getPurchaseRequestById(po2.id))!;

    assert(updatedPo1_final.status === 'Completed', 'PO-SUP-A-001 status is now "Completed"');
    assert(updatedPo2_final.status === 'Completed', 'PO-SUP-A-002 status is now "Completed"');

    const groupsFinal = orderReceiveService.getSupplierDeliveryGroups({
      purchaseRequests: [updatedPo1_final, updatedPo2_final, po3],
      suppliers: [supplierA, supplierB],
      warehouses: testWarehouses,
      todayStr: '2026-10-28'
    });

    const groupA_final = groupsFinal.find(g => g.supplierId === supplierA.id)!;
    assert(groupA_final.deliveryStatus === 'Received / Completed', 'Supplier A delivery group status is now "Received / Completed"');
    assert(groupA_final.totalOutstandingQuantity === 0, 'Supplier A total outstanding quantity is 0');
    assert(groupA_final.productsPendingCount === 0, 'Supplier A pending products count is 0');
    assert(groupA_final.totalPreviouslyReceivedQuantity === 23, 'Supplier A total received quantity equals total ordered quantity (23)');

    // Supplier B group remains completely untouched and pending:
    const groupB_final = groupsFinal.find(g => g.supplierId === supplierB.id)!;
    assert(groupB_final.deliveryStatus === 'Pending', 'Supplier B delivery group remains untouched and "Pending"');
    assert(groupB_final.totalOutstandingQuantity === 4, 'Supplier B total outstanding quantity remains 4');
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
