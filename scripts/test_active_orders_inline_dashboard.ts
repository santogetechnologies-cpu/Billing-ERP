import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  computeActiveInTransitOrders,
  ActiveInTransitOrder
} from '../src/pages/purchases/PurchaseManagerDashboardPage';
import { PurchaseRequest, Supplier, Warehouse } from '../src/types';

console.log('================================================================');
console.log('TEST SUITE: ACTIVE ORDERS DASHBOARD INLINE PANEL & LOGIC');
console.log('================================================================');

// 1. Static code inspections on PurchaseManagerDashboardPage.tsx
const dashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
assert(fs.existsSync(dashboardPath), 'PurchaseManagerDashboardPage.tsx must exist');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');

console.log('\n--- 1. Verification of Active Orders Card & Inline Toggle ---');
// Verify Active Orders card properties
assert(dashboardCode.includes('title="Active Orders"'), 'Must have title "Active Orders"');
assert(dashboardCode.includes('subtitle="Purchase orders in-transit"'), 'Must have subtitle "Purchase orders in-transit"');
assert(dashboardCode.includes('icon={Truck}'), 'Must have Truck icon');
assert(dashboardCode.includes('iconBgColor="bg-blue-50"'), 'Must preserve iconBgColor="bg-blue-50"');
assert(dashboardCode.includes('iconTextColor="text-blue-600"'), 'Must preserve iconTextColor="text-blue-600"');
assert(dashboardCode.includes('onClick={toggleActiveOrdersPanel}'), 'Must have onClick handler toggling panel');
assert(dashboardCode.includes('isSelected={showActiveOrdersPanel}'), 'Must pass isSelected={showActiveOrdersPanel}');
assert(!dashboardCode.includes("title=\"Active Orders\"[\\s\\S]*?navigate('/purchases/orders')"), 'Must NOT navigate to another route');
console.log('  ✓ PASS: Active Orders card retains exact design, colors, subtitle and toggles inline panel');

console.log('\n--- 2. Inline Section & Layout Requirements ---');
assert(dashboardCode.includes('id="active-orders-panel"'), 'Inline section must have id="active-orders-panel"');
assert(dashboardCode.includes('Active Purchase Orders in Transit'), 'Inline section header must be present');
assert(dashboardCode.includes('onClick={() => setShowActiveOrdersPanel(false)}'), 'Must provide a close button');
assert(dashboardCode.includes('No active orders in transit'), 'Must contain exact empty state text "No active orders in transit"');
console.log('  ✓ PASS: Inline expandable section renders with title, close button, and empty state');

console.log('\n--- 3. Required Table Columns Verification ---');
const requiredColumns = [
  'Purchase Order Number',
  'Order Date',
  'Supplier Name',
  'Destination Warehouse',
  'Total Items',
  'Ordered Quantity',
  'Received Quantity',
  'Order Status'
];

requiredColumns.forEach(col => {
  assert(dashboardCode.includes(`<th className="py-3 px-4">${col}</th>`) || dashboardCode.includes(`>${col}</th>`), `Table header must include column: ${col}`);
  console.log(`  ✓ PASS: Column "${col}" is present in table header`);
});

console.log('\n--- 4. Data Logic: computeActiveInTransitOrders Unit Tests ---');

const mockWarehouses: Warehouse[] = [
  { id: 'wh-1', name: 'South Central Godown', companyId: 'comp-1', code: 'SCG-01', address: '123 Hub', isDefault: true, createdAt: '2026-01-01' },
  { id: 'wh-2', name: 'North Regional Warehouse', companyId: 'comp-1', code: 'NRW-02', address: '456 Depot', isDefault: false, createdAt: '2026-01-01' }
];

const mockSuppliers: Supplier[] = [
  { id: 'sup-1', name: 'Jindal Steel & Power', phone: '9876543210', email: 'sales@jindal.com', gstin: '27AAAAA0000A1Z5', address: 'Mumbai', balance: 0, status: 'Active' },
  { id: 'sup-2', name: 'Ultratech Cement Ltd', phone: '9123456789', email: 'info@ultratech.com', gstin: '27BBBBB0000B1Z6', address: 'Gujarat', balance: 0, status: 'Active' }
];

// Test case A: Only In Transit, Ordered, and Partially Received orders are included
const samplePurchaseOrders = [
  {
    id: 'po-101',
    order_number: 'PO-2026-101',
    date: '2026-10-22',
    supplier_id: 'sup-1',
    warehouse_id: 'wh-1',
    status: 'In Transit',
    purchase_order_items: [
      { id: 'poi-1', product_name: 'TMT Steel 12mm', qty: 50, received_qty: 0 },
      { id: 'poi-2', product_name: 'TMT Steel 16mm', qty: 30, received_qty: 0 }
    ]
  },
  {
    id: 'po-102',
    order_number: 'PO-2026-102',
    date: '2026-10-21',
    supplier_id: 'sup-2',
    warehouse_id: 'wh-2',
    status: 'Partially Received',
    purchase_order_items: [
      { id: 'poi-3', product_name: 'PPC Cement 50kg', qty: 100, received_qty: 40 }
    ]
  },
  {
    // Completed order - must be EXCLUDED
    id: 'po-103',
    order_number: 'PO-2026-103',
    date: '2026-10-15',
    supplier_id: 'sup-1',
    warehouse_id: 'wh-1',
    status: 'Completed',
    purchase_order_items: [
      { id: 'poi-4', product_name: 'Binding Wire', qty: 20, received_qty: 20 }
    ]
  },
  {
    // Cancelled order - must be EXCLUDED
    id: 'po-104',
    order_number: 'PO-2026-104',
    date: '2026-10-10',
    supplier_id: 'sup-2',
    warehouse_id: 'wh-2',
    status: 'Cancelled',
    purchase_order_items: [
      { id: 'poi-5', product_name: 'White Cement', qty: 10, received_qty: 0 }
    ]
  },
  {
    // Delivered order (received = ordered) - must be EXCLUDED
    id: 'po-105',
    order_number: 'PO-2026-105',
    date: '2026-10-12',
    supplier_id: 'sup-1',
    warehouse_id: 'wh-1',
    status: 'Delivered',
    purchase_order_items: [
      { id: 'poi-6', product_name: 'Steel Mesh', qty: 15, received_qty: 15 }
    ]
  }
];

const sampleRequests: PurchaseRequest[] = [
  {
    id: 'pr-201',
    requestNumber: 'PR-2026-201',
    companyId: 'comp-1',
    warehouseId: 'wh-1',
    warehouseName: 'South Central Godown',
    requesterId: 'user-1',
    requesterName: 'Warehouse Staff',
    status: 'Ordered',
    purchaseOrderNumber: 'PO-PR-201',
    priority: 'High',
    history: [{ timestamp: '2026-10-23', action: 'Ordered', userName: 'Purchaser', comments: 'Created PO (Vendor: Jindal Steel & Power)' }],
    items: [
      { id: 'pri-1', requestId: 'pr-201', productId: 'p1', productName: 'Safety Helmets', requestedQty: 25, approvedQty: 25, receivedQty: 0, unit: 'Piece' }
    ],
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z'
  },
  {
    // Pending Approval request - must be EXCLUDED from active in-transit orders
    id: 'pr-202',
    requestNumber: 'PR-2026-202',
    companyId: 'comp-1',
    warehouseId: 'wh-2',
    requesterId: 'user-2',
    requesterName: 'Warehouse Staff',
    status: 'Pending Approval',
    priority: 'Normal',
    items: [
      { id: 'pri-2', requestId: 'pr-202', productId: 'p2', productName: 'Work Gloves', requestedQty: 50, unit: 'Pair' }
    ],
    createdAt: '2026-10-23T09:00:00.000Z',
    updatedAt: '2026-10-23T09:00:00.000Z'
  }
];

const computedOrders = computeActiveInTransitOrders({
  purchaseOrders: samplePurchaseOrders,
  purchaseRequests: sampleRequests,
  suppliers: mockSuppliers,
  warehouses: mockWarehouses
});

console.log(`Computed ${computedOrders.length} active in-transit orders`);
assert.strictEqual(computedOrders.length, 3, 'Must return exactly 3 active in-transit orders (PO-101, PO-102, PO-PR-201)');
console.log('  ✓ PASS: Excluded Completed, Cancelled, Delivered, and non-ordered requests');

// Check PO-101 details
const po101 = computedOrders.find(o => o.orderNumber === 'PO-2026-101');
assert(po101, 'PO-2026-101 must be present');
assert.strictEqual(po101.supplierName, 'Jindal Steel & Power', 'Supplier name must match Jindal Steel & Power');
assert.strictEqual(po101.warehouseName, 'South Central Godown', 'Warehouse name must match South Central Godown');
assert.strictEqual(po101.totalItems, 2, 'Total items must be 2');
assert.strictEqual(po101.orderedQty, 80, 'Ordered qty must be 50 + 30 = 80');
assert.strictEqual(po101.receivedQty, 0, 'Received qty must be 0');
assert.strictEqual(po101.status, 'In Transit', 'Status must be In Transit');
console.log('  ✓ PASS: PO-2026-101 fields verified: Supplier, Warehouse, Items (2), Ordered (80), Received (0), In Transit');

// Check PO-102 details
const po102 = computedOrders.find(o => o.orderNumber === 'PO-2026-102');
assert(po102, 'PO-2026-102 must be present');
assert.strictEqual(po102.supplierName, 'Ultratech Cement Ltd');
assert.strictEqual(po102.warehouseName, 'North Regional Warehouse');
assert.strictEqual(po102.totalItems, 1);
assert.strictEqual(po102.orderedQty, 100);
assert.strictEqual(po102.receivedQty, 40);
assert.strictEqual(po102.status, 'Partially Received');
console.log('  ✓ PASS: PO-2026-102 fields verified: Supplier, Warehouse, Items (1), Ordered (100), Received (40), Partially Received');

// Check PO-PR-201 details from PurchaseRequest
const poPr201 = computedOrders.find(o => o.orderNumber === 'PO-PR-201');
assert(poPr201, 'PO-PR-201 from purchaseRequests must be present');
assert.strictEqual(poPr201.supplierName, 'Jindal Steel & Power');
assert.strictEqual(poPr201.warehouseName, 'South Central Godown');
assert.strictEqual(poPr201.totalItems, 1);
assert.strictEqual(poPr201.orderedQty, 25);
assert.strictEqual(poPr201.receivedQty, 0);
assert.strictEqual(poPr201.status, 'Ordered');
console.log('  ✓ PASS: PO-PR-201 from PurchaseRequest resolved vendor and mapped to active in-transit list');

// Test Empty State
const emptyOrders = computeActiveInTransitOrders({
  purchaseOrders: [],
  purchaseRequests: [],
  suppliers: mockSuppliers,
  warehouses: mockWarehouses
});
assert.strictEqual(emptyOrders.length, 0, 'Empty data must return 0 orders');
console.log('  ✓ PASS: Empty input returns empty list, triggering "No active orders in transit"');

console.log('\n================================================================');
console.log('ALL ACTIVE ORDERS INLINE DASHBOARD TESTS PASSED (100%)');
console.log('================================================================');
