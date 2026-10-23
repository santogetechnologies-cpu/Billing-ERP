import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  determineSupplierStatus,
  enrichSuppliersWithDeliveryStatus,
  isPurchaseOrderActiveDelivery,
  isPurchaseRequestActiveDelivery
} from '../src/utils/supplierStatus';
import { computeSupplierDeliveries } from '../src/pages/purchases/PurchaseManagerDashboardPage';
import { Supplier, PurchaseRequest } from '../src/types';

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('TEST SUITE: AUTOMATIC SUPPLIER ACTIVE / INACTIVE STATUS');
console.log('================================================================\n');

// ---------------------------------------------------------------------------
// 1. Acceptance Test 1: Supplier has one pending order → Active
// ---------------------------------------------------------------------------
console.log('--- 1. Acceptance Test 1: Supplier has one pending order → Active ---');
{
  const supplierId = 'sup-1';
  const supplierName = 'Acme Steel Corp';

  const po = {
    id: 'po-1',
    order_number: 'PO-2026-001',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Ordered',
    qty: 50,
    received_qty: 0
  };

  const status = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [po]
  });

  check(status === 'Active', `Supplier with 1 pending order has status "Active" (got: ${status})`);
}

// ---------------------------------------------------------------------------
// 2. Acceptance Test 2: Supplier has 3 pending orders, 1 is completed → Active
// ---------------------------------------------------------------------------
console.log('\n--- 2. Acceptance Test 2: 3 orders, 1 completed → Active ---');
{
  const supplierId = 'sup-2';
  const supplierName = 'National Cement Ltd';

  const poCompleted = {
    id: 'po-c1',
    order_number: 'PO-2026-101',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Completed',
    qty: 100,
    received_qty: 100
  };

  const poPending1 = {
    id: 'po-p1',
    order_number: 'PO-2026-102',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Ordered',
    qty: 60,
    received_qty: 0
  };

  const poPending2 = {
    id: 'po-p2',
    order_number: 'PO-2026-103',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'In Transit',
    qty: 40,
    received_qty: 0
  };

  const status = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [poCompleted, poPending1, poPending2]
  });

  check(status === 'Active', `Supplier with 1 completed and 2 pending orders remains "Active" (got: ${status})`);
}

// ---------------------------------------------------------------------------
// 3. Acceptance Test 3: All 3 orders completed → Inactive
// ---------------------------------------------------------------------------
console.log('\n--- 3. Acceptance Test 3: All 3 orders completed → Inactive ---');
{
  const supplierId = 'sup-3';
  const supplierName = 'Apex Chemicals';

  const poCompleted1 = {
    id: 'po-c1',
    order_number: 'PO-2026-201',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Completed',
    qty: 50,
    received_qty: 50
  };

  const poCompleted2 = {
    id: 'po-c2',
    order_number: 'PO-2026-202',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Delivered',
    qty: 30,
    received_qty: 30
  };

  const poCompleted3 = {
    id: 'po-c3',
    order_number: 'PO-2026-203',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Ordered',
    qty: 25,
    received_qty: 25 // Fully received => closed
  };

  const status = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [poCompleted1, poCompleted2, poCompleted3]
  });

  check(status === 'Inactive', `Supplier with all orders completed transitions to "Inactive" (got: ${status})`);
}

// ---------------------------------------------------------------------------
// 4. Acceptance Test 4: New order assigned to inactive supplier → Active again
// ---------------------------------------------------------------------------
console.log('\n--- 4. Acceptance Test 4: New order assigned to inactive supplier → Active again ---');
{
  const supplierId = 'sup-4';
  const supplierName = 'Vanguard Tools';

  // Initially: completed order => Inactive
  const initialStatus = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [
      { id: 'po-old', order_number: 'PO-2026-300', supplier_id: supplierId, supplier_name: supplierName, status: 'Completed', qty: 20, received_qty: 20 }
    ]
  });
  check(initialStatus === 'Inactive', 'Supplier is initially Inactive when all past orders are fulfilled');

  // New order created and assigned => Active
  const updatedStatus = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [
      { id: 'po-old', order_number: 'PO-2026-300', supplier_id: supplierId, supplier_name: supplierName, status: 'Completed', qty: 20, received_qty: 20 },
      { id: 'po-new', order_number: 'PO-2026-301', supplier_id: supplierId, supplier_name: supplierName, status: 'Ordered', qty: 15, received_qty: 0 }
    ]
  });
  check(updatedStatus === 'Active', `Supplier automatically changes back to "Active" when new order is assigned (got: ${updatedStatus})`);
}

// ---------------------------------------------------------------------------
// 5. Acceptance Test 5: Historical purchase bills remain → Inactive, records preserved
// ---------------------------------------------------------------------------
console.log('\n--- 5. Acceptance Test 5: Historical bills remain → Inactive, history preserved ---');
{
  const supplier: Supplier = {
    id: 'sup-5',
    name: 'Pioneer Paints',
    company: 'Pioneer Paints Ltd',
    phone: '+91 98765 43210',
    email: 'orders@pioneer.com',
    address: 'Industrial Area, Phase 2',
    gstin: '27AAACP1234F1Z1',
    pan: 'AAACP1234F',
    creditDays: 30,
    openingBalance: 0,
    currentOutstanding: 25000,
    totalPurchases: 150000,
    totalPaid: 125000,
    status: 'Active',
    createdAt: '2026-01-01'
  };

  // Historical purchase bills (all delivered / completed)
  const historicalBills = [
    { id: 'bill-1', invoice_number: 'BILL-001', supplier_id: 'sup-5', status: 'Completed', qty: 100, received_qty: 100 },
    { id: 'bill-2', invoice_number: 'BILL-002', supplier_id: 'sup-5', status: 'Delivered', qty: 200, received_qty: 200 }
  ];

  const enriched = enrichSuppliersWithDeliveryStatus([supplier], {
    purchaseOrders: historicalBills
  });

  check(enriched.length === 1, 'Supplier list preserved (length 1)');
  const s = enriched[0];
  check(s.status === 'Inactive', `Supplier status is "Inactive" since all deliveries completed (got: ${s.status})`);
  check(s.phone === '+91 98765 43210', 'Phone number preserved');
  check(s.email === 'orders@pioneer.com', 'Email preserved');
  check(s.totalPurchases === 150000, 'Historical total purchases preserved');
  check(s.currentOutstanding === 25000, 'Accounts payable balance preserved');
}

// ---------------------------------------------------------------------------
// 6. Business Rule: Cancelled / Rejected orders do not keep supplier Active
// ---------------------------------------------------------------------------
console.log('\n--- 6. Business Rule: Cancelled/rejected orders do not keep supplier Active ---');
{
  const supplierId = 'sup-6';
  const supplierName = 'Delta Logistics';

  const cancelledPo = {
    id: 'po-cancel',
    order_number: 'PO-2026-401',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Cancelled',
    qty: 100,
    received_qty: 0
  };

  const rejectedPo = {
    id: 'po-reject',
    order_number: 'PO-2026-402',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Rejected',
    qty: 50,
    received_qty: 0
  };

  const status = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [cancelledPo, rejectedPo]
  });

  check(status === 'Inactive', `Cancelled/rejected orders result in "Inactive" status (got: ${status})`);
}

// ---------------------------------------------------------------------------
// 7. Business Rule: Partially received delivery keeps supplier Active
// ---------------------------------------------------------------------------
console.log('\n--- 7. Business Rule: Partially received delivery keeps supplier Active ---');
{
  const supplierId = 'sup-7';
  const supplierName = 'Gamma Metals';

  const partialPo = {
    id: 'po-part',
    order_number: 'PO-2026-501',
    supplier_id: supplierId,
    supplier_name: supplierName,
    status: 'Partially Received',
    qty: 100,
    received_qty: 40 // 60 still pending
  };

  const status = determineSupplierStatus(supplierId, supplierName, {
    purchaseOrders: [partialPo]
  });

  check(status === 'Active', `Partially received order with pending units keeps supplier "Active" (got: ${status})`);
}

// ---------------------------------------------------------------------------
// 8. Integration with computeSupplierDeliveries in PurchaseManagerDashboardPage
// ---------------------------------------------------------------------------
console.log('\n--- 8. Integration: computeSupplierDeliveries outputs supplierStatus ---');
{
  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-active',
      name: 'Active Supplier Co',
      company: 'Active Supplier Co',
      phone: '1111111111',
      email: 'active@supp.com',
      address: '',
      gstin: '',
      pan: '',
      creditDays: 30,
      openingBalance: 0,
      currentOutstanding: 0,
      totalPurchases: 0,
      totalPaid: 0,
      status: 'Active',
      createdAt: ''
    },
    {
      id: 'sup-inactive',
      name: 'Inactive Supplier Co',
      company: 'Inactive Supplier Co',
      phone: '2222222222',
      email: 'inactive@supp.com',
      address: '',
      gstin: '',
      pan: '',
      creditDays: 30,
      openingBalance: 0,
      currentOutstanding: 0,
      totalPurchases: 0,
      totalPaid: 0,
      status: 'Active',
      createdAt: ''
    }
  ];

  const activePo = {
    id: 'po-1',
    order_number: 'PO-001',
    supplier_id: 'sup-active',
    supplier_name: 'Active Supplier Co',
    status: 'Ordered',
    qty: 50,
    received_qty: 0,
    expected_delivery: '2026-10-30'
  };

  const completedPo = {
    id: 'po-2',
    order_number: 'PO-002',
    supplier_id: 'sup-inactive',
    supplier_name: 'Inactive Supplier Co',
    status: 'Completed',
    qty: 80,
    received_qty: 80,
    expected_delivery: '2026-10-15'
  };

  const items = computeSupplierDeliveries({
    suppliers: mockSuppliers,
    purchaseOrders: [activePo, completedPo],
    purchaseRequests: []
  });

  const activeItem = items.find(i => i.supplierId === 'sup-active');
  const inactiveItem = items.find(i => i.supplierId === 'sup-inactive');

  check(activeItem !== undefined, 'Active supplier found in delivery overview');
  check(activeItem?.supplierStatus === 'Active', `Active supplier has supplierStatus === "Active" (got: ${activeItem?.supplierStatus})`);
  check(activeItem?.activeOrders === 1, 'Active supplier has activeOrders === 1');

  check(inactiveItem !== undefined, 'Inactive supplier found in delivery overview');
  check(inactiveItem?.supplierStatus === 'Inactive', `Inactive supplier has supplierStatus === "Inactive" (got: ${inactiveItem?.supplierStatus})`);
  check(inactiveItem?.activeOrders === 0, 'Inactive supplier has activeOrders === 0');
}

// ---------------------------------------------------------------------------
// 9. Static Code Inspection: Supplier Delivery Overview UI table
// ---------------------------------------------------------------------------
console.log('\n--- 9. UI Static Inspection: Table headers & status indicators ---');
{
  const dashboardPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const content = fs.readFileSync(dashboardPath, 'utf-8');

  check(content.includes('Supplier Status'), 'Table header includes "Supplier Status" column');
  check(content.includes('item.supplierStatus'), 'Table row renders item.supplierStatus');
  check(content.includes('item.supplierStatus === \'Active\''), 'Table row renders conditional styling for Active');
  check(content.includes('item.supplierStatus === \'Active\' ? \'bg-emerald-500 animate-pulse\' : \'bg-slate-400\''), 'Table row renders pulsing visual indicator');
  check(content.includes('supplierDeliveries.filter(s => s.supplierStatus === \'Active\').length'), 'Dashboard metrics.activeSuppliersCount filters for Active suppliers');
}

// ---------------------------------------------------------------------------
// 10. Static Code Inspection: SuppliersPage.tsx integration
// ---------------------------------------------------------------------------
console.log('\n--- 10. UI Static Inspection: SuppliersPage.tsx integration ---');
{
  const suppliersPath = path.resolve('src/pages/suppliers/SuppliersPage.tsx');
  const content = fs.readFileSync(suppliersPath, 'utf-8');

  check(content.includes('enrichSuppliersWithDeliveryStatus'), 'SuppliersPage imports and uses enrichSuppliersWithDeliveryStatus');
  check(content.includes('suppliersWithStatus'), 'SuppliersPage passes enriched suppliersWithStatus to DataTable');
  check(content.includes('row.status === \'Active\''), 'SuppliersPage renders active/inactive badge with indicator');
}

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('\n🎉 ALL AUTOMATIC SUPPLIER STATUS TESTS PASSED 100%!\n');
} else {
  process.exit(1);
}
