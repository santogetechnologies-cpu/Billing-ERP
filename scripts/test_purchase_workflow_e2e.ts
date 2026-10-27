/**
 * test_purchase_workflow_e2e.ts
 *
 * Comprehensive End-to-End Automated Test Suite:
 * Connect Purchase Approval, Supplier Bills, and Accountant Workflow
 *
 * 1. Warehouse Manager submits Purchase Request.
 * 2. Purchase Manager approves PR -> generates linked Purchase Order (with unique PO# and duplicate check).
 * 3. Warehouse Manager views Order Receive and records partial goods receipt (stock & status updated).
 * 4. Purchase Invoice is created against PO with supplier invoice # and discrepancy detection.
 * 5. Purchase Manager views Supplier Bills list (strictly view-only, receiving status, discrepancy warning).
 * 6. Bill auto-transfers to Accountant Pending Review queue.
 * 7. Accountant verifies bill and records partial & full disbursements with real-time balance tracking.
 */

import { supabase } from '../src/lib/supabase';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { orderReceiveService } from '../src/services/orderReceiveService';
import { purchaseService } from '../src/services/purchaseService';
import { supplierBillService } from '../src/services/supplierBillService';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error('     Details:', details);
    failCount++;
  }
}

async function runEndToEndPurchaseWorkflow() {
  console.log('\n======================================================================');
  console.log('   PURCHASE APPROVAL, SUPPLIER BILLS & ACCOUNTANT WORKFLOW E2E TEST');
  console.log('======================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const warehouseManagerUser = {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Logistics Supervisor',
    role: 'Warehouse Manager'
  };
  const purchaseManagerUser = {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Senior Purchase Executive',
    role: 'Purchase Manager'
  };
  const accountantUser = {
    id: '00000000-0000-0000-0000-000000000004',
    fullName: 'Chief Financial Accountant',
    role: 'Accountant'
  };

  // 0. Reference Product & Supplier
  console.log('👉 STEP 0: Fetch reference Product and Supplier...');
  const { data: prodData } = await supabase
    .from('products')
    .select('id, name, purchase_price, current_stock')
    .eq('company_id', testCompanyId)
    .limit(1);

  const testProduct = prodData && prodData[0]
    ? prodData[0]
    : { id: 'prod-e2e-01', name: 'Industrial Test Fasteners', purchase_price: 250, current_stock: 50 };

  const { data: supData } = await supabase
    .from('suppliers')
    .select('id, name, company, phone, email, gstin')
    .eq('company_id', testCompanyId)
    .limit(1);

  const testSupplier = supData && supData[0]
    ? supData[0]
    : {
        id: 'sup-e2e-01',
        name: 'Apex Industrial Supplies',
        company: 'Apex Industrial Supplies Ltd',
        phone: '+91 98765 43210',
        email: 'billing@apexindustrial.in',
        gstin: '29ABCDE1234F1Z5'
      };

  console.log(`   Product: ${testProduct.name} (ID: ${testProduct.id}, Cost: ₹${testProduct.purchase_price})`);
  console.log(`   Supplier: ${testSupplier.company || testSupplier.name} (ID: ${testSupplier.id})\n`);

  // =========================================================================
  // 1. Warehouse Manager creates Purchase Request
  // =========================================================================
  console.log('👉 STEP 1: Warehouse Manager Submits Purchase Request');
  const initialQty = 30;
  const unitRate = Number(testProduct.purchase_price) || 250;

  const pr = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: 'wh-main-01',
      warehouseName: 'Main Storage Godown',
      priority: 'High',
      reason: 'E2E workflow replenishment testing',
      requestedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          currentStock: Number(testProduct.current_stock) || 50,
          requestedQty: initialQty,
          unit: 'Piece',
          estimatedCost: initialQty * unitRate
        }
      ]
    },
    testCompanyId,
    warehouseManagerUser
  );

  assert(Boolean(pr.id), 'PR created with unique ID', pr.id);
  assert(pr.status === 'Pending Approval', 'Initial PR status is "Pending Approval"');
  assert(pr.items.length === 1 && pr.items[0].requestedQty === initialQty, 'PR line item recorded requested quantity');

  // =========================================================================
  // 2. Purchase Manager Approves PR -> Auto-creates linked Purchase Order
  // =========================================================================
  console.log('\n👉 STEP 2: Purchase Manager Approves Request & Generates Purchase Order');
  const approvedPr = await purchaseRequestService.updateRequestStatus(
    {
      requestId: pr.id,
      status: 'Approved',
      comments: 'Approved for procurement with Apex Industrial Supplies',
      adjustedItems: [
        {
          itemId: pr.items[0].id,
          approvedQty: initialQty,
          adjustmentReason: 'Standard batch pricing agreed'
        }
      ]
    },
    testCompanyId,
    purchaseManagerUser
  );

  assert(approvedPr.status === 'Approved', 'PR status transitioned to "Approved"');

  // Auto-generate Purchase Order from approved PR
  const poParams = {
    requestId: approvedPr.id,
    supplierId: testSupplier.id,
    supplierName: testSupplier.company || testSupplier.name,
    supplierGstin: testSupplier.gstin,
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    notes: 'Generated via Purchase Approval workflow',
    items: [
      {
        productId: testProduct.id,
        productName: testProduct.name,
        qty: initialQty,
        rate: unitRate,
        taxRate: 18,
        unit: 'Piece'
      }
    ]
  };

  const poResult = await purchaseRequestService.createPurchaseOrderFromRequest(
    poParams,
    testCompanyId,
    purchaseManagerUser
  );

  assert(Boolean(poResult.purchaseOrderNumber), `Purchase Order generated: ${poResult.purchaseOrderNumber}`);
  assert(poResult.purchaseOrderNumber.startsWith('PO-'), 'Purchase Order has standardized PO- prefix');
  assert(poResult.request.items.length === 1, 'PO contains carried-over product');
  assert(poResult.request.items[0].approvedQty === initialQty, 'PO contains approved quantity');

  // Verify Idempotency: calling createPurchaseOrderFromRequest again returns existing PO
  const duplicatePoCheck = await purchaseRequestService.createPurchaseOrderFromRequest(
    poParams,
    testCompanyId,
    purchaseManagerUser
  );
  assert(duplicatePoCheck.purchaseOrderNumber === poResult.purchaseOrderNumber, 'Idempotency verified: duplicate order prevented');

  // Fetch updated PR to verify status updated to 'Ordered'
  const updatedPr = await purchaseRequestService.getPurchaseRequestById(pr.id, testCompanyId);
  assert(updatedPr?.status === 'Ordered', 'PR status transitioned to "Ordered" after PO generation');
  assert(updatedPr?.purchaseOrderNumber === poResult.purchaseOrderNumber, 'PR is linked to generated PO number');

  // =========================================================================
  // 3. Warehouse Manager Views Order Receive & Confirms Goods Receipt
  // =========================================================================
  console.log('\n👉 STEP 3: Warehouse Manager Order Receive & Partial Delivery Confirmation');
  const allPrs = await purchaseRequestService.getPurchaseRequests(undefined, testCompanyId);
  const orderReceiveList = orderReceiveService.getOrderReceiveList({
    purchaseRequests: allPrs,
    suppliers: [testSupplier],
    warehouses: [{ id: 'wh-main-01', name: 'Main Storage Godown', code: 'WH-01', isDefault: true, createdAt: '', updatedAt: '' } as any],
    products: [testProduct as any]
  });

  const matchingReceiveItem = orderReceiveList.find(
    o => o.orderNumber === poResult.purchaseOrderNumber || o.id === pr.id
  );
  assert(Boolean(matchingReceiveItem), `PO ${poResult.purchaseOrderNumber} appears in Order Receive list`);
  assert(matchingReceiveItem?.deliveryStatus === 'Pending', 'Initial delivery status is "Pending"');
  assert(matchingReceiveItem?.orderedQuantity === initialQty, `Ordered quantity is ${initialQty}`);

  // Confirm partial receipt: 18 arrived, 2 damaged, 16 accepted
  const arrivedQty = 18;
  const damagedQty = 2;
  const acceptedQty = 16;
  const supplierDeliveryBillNo = `INV-SUP-E2E-${Date.now().toString().slice(-5)}`;

  await orderReceiveService.confirmGoodsReceipt(
    {
      orderId: pr.id,
      purchaseRequestId: pr.id,
      purchaseOrderId: poResult.purchaseOrderId,
      receivingWarehouseId: 'wh-main-01',
      supplierInvoiceNumber: supplierDeliveryBillNo,
      deliveryRemarks: 'First partial consignment received. 2 units damaged during unloading.',
      receivedItems: [
        {
          itemId: pr.items[0].id,
          productId: testProduct.id,
          arrivedQty,
          damagedQty,
          acceptedQty
        }
      ]
    },
    testCompanyId,
    warehouseManagerUser
  );

  const prAfterReceipt = await purchaseRequestService.getPurchaseRequestById(pr.id, testCompanyId);
  assert(prAfterReceipt?.status === 'Partially Received', 'PR status updated to "Partially Received"');
  assert(
    prAfterReceipt?.items[0].receivedQty === arrivedQty,
    `PR receivedQty recorded as ${arrivedQty} (${acceptedQty} accepted)`
  );

  // =========================================================================
  // 4. Purchase Invoice Created with Discrepancy Detection & Linked PO
  // =========================================================================
  console.log('\n👉 STEP 4: Create Supplier Invoice Linked to PO with Discrepancy Checking');
  const invoicedQty = initialQty; // Full PO quantity invoiced by supplier
  const higherInvoicedRate = unitRate + 30; // ₹30/unit price increase (Discrepancy)
  const subtotal = invoicedQty * higherInvoicedRate;
  const gstRate = 18;
  const taxTotal = subtotal * (gstRate / 100);
  const freightCharges = 500;
  const grandTotal = subtotal + taxTotal + freightCharges;

  // Discrepancy detected: rate increased from unitRate to higherInvoicedRate
  const hasDiscrepancy = higherInvoicedRate !== unitRate;
  const discrepancyNotes = `Price Discrepancy on "${testProduct.name}": Invoiced rate ₹${higherInvoicedRate} exceeds agreed PO rate ₹${unitRate} (+₹30/unit).`;

  const newBillPayload = {
    invoiceNumber: `PUR-BILL-${Date.now().toString().slice(-6)}`,
    supplierInvoiceNumber: supplierDeliveryBillNo,
    docType: 'purchase_invoice' as const,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    supplierId: testSupplier.id,
    supplierName: testSupplier.company || testSupplier.name,
    supplierGstin: testSupplier.gstin,
    warehouse: 'wh-main-01',
    items: [
      {
        productId: testProduct.id,
        productName: testProduct.name,
        qty: invoicedQty,
        unit: 'Piece',
        rate: higherInvoicedRate,
        discount: 0,
        taxRate: gstRate,
        taxAmt: taxTotal,
        total: subtotal + taxTotal
      }
    ],
    subtotal,
    taxTotal,
    freightCharges,
    otherCharges: 0,
    grandTotal,
    paidAmount: 0,
    paymentStatus: 'Unpaid' as const,
    notes: 'Invoice received with revised transport charges.',
    purchaseOrderId: poResult.purchaseOrderId,
    purchaseOrderNumber: poResult.purchaseOrderNumber,
    purchaseRequestId: pr.id,
    purchaseRequestNumber: pr.requestNumber,
    verificationStatus: 'Pending Review' as const,
    hasDiscrepancy,
    discrepancyNotes
  };

  const createdBill = await purchaseService.createPurchaseInvoice(newBillPayload, testCompanyId);

  assert(Boolean(createdBill.id), `Supplier Bill created: ${createdBill.invoiceNumber}`);
  assert(createdBill.supplierInvoiceNumber === supplierDeliveryBillNo, 'Supplier Invoice Number saved');
  assert(createdBill.purchaseOrderNumber === poResult.purchaseOrderNumber, 'Linked PO number preserved');
  assert(createdBill.hasDiscrepancy === true, 'Discrepancy flag detected and preserved');
  assert(Boolean(createdBill.discrepancyNotes), `Discrepancy notes recorded: ${createdBill.discrepancyNotes}`);
  assert(createdBill.verificationStatus === 'Pending Review', 'Bill initially in "Pending Review" queue');

  // =========================================================================
  // 5. Purchase Manager View-Only Supplier Bills Verification
  // =========================================================================
  console.log('\n👉 STEP 5: Verify Purchase Manager View-Only Bills List');
  const allBills = await purchaseService.getPurchaseInvoices(undefined, testCompanyId);
  const pmViewBill = allBills.find(b => b.id === createdBill.id);

  assert(Boolean(pmViewBill), 'Bill visible in Purchase Manager Supplier Bills list');
  assert(pmViewBill?.purchaseOrderNumber === poResult.purchaseOrderNumber, 'Purchase Order Number column populated');
  assert(pmViewBill?.supplierInvoiceNumber === supplierDeliveryBillNo, 'Supplier Invoice Number column populated');
  assert(pmViewBill?.hasDiscrepancy === true, 'Discrepancy alert badge active in PM view');
  assert(pmViewBill?.paymentStatus === 'Unpaid', 'Payment status is "Unpaid"');

  // =========================================================================
  // 6. Accountant Review & Verification
  // =========================================================================
  console.log('\n👉 STEP 6: Automatic Transfer to Accountant Review Queue');
  const accountantSummary = await supplierBillService.getSupplierBills(testCompanyId, {
    tab: 'Pending Review'
  });

  const accountantPendingBill = accountantSummary.bills.find(b => b.id === createdBill.id);
  assert(Boolean(accountantPendingBill), 'Bill automatically transferred to Accountant "Pending Review" queue');
  assert(accountantPendingBill?.balanceDue === grandTotal, `Balance due equals grand total (₹${grandTotal})`);
  assert(accountantPendingBill?.hasDiscrepancy === true, 'Accountant receives prominent discrepancy alert');

  // Accountant verifies and approves the bill for payment disbursement
  console.log('   Accountant reviews discrepancy & authorizes payment release...');
  const verifiedBill = await supplierBillService.verifySupplierBill(
    {
      billId: createdBill.id,
      status: 'Approved for Payment',
      notes: 'Reviewed discrepancy: Price hike authorized due to urgent dispatch freight.',
      userProfile: accountantUser
    },
    testCompanyId
  );

  assert(verifiedBill.verificationStatus === 'Approved for Payment', 'Bill verified as "Approved for Payment"');

  // =========================================================================
  // 7. Accountant Payment Disbursements & Balance Tracking
  // =========================================================================
  console.log('\n👉 STEP 7: Record Payments with Real-Time Balance Tracking');

  // Test Partial Payment (e.g. ₹4,000)
  const partialPaymentAmount = 4000;
  const expectedRemaining = grandTotal - partialPaymentAmount;

  const { payment: pmt1, updatedBill: billAfterPmt1 } = await supplierBillService.recordSupplierBillPayment(
    {
      billId: createdBill.id,
      amount: partialPaymentAmount,
      paymentMethod: 'Bank Transfer',
      reference: 'NEFT-UB-48201',
      notes: 'First installment payment',
      userProfile: accountantUser
    },
    testCompanyId
  );

  assert(Boolean(pmt1.id), `Payment record #1 created: ${pmt1.paymentNumber}`);
  assert(pmt1.amount === partialPaymentAmount, `Payment amount recorded: ₹${partialPaymentAmount}`);
  assert(billAfterPmt1.paymentStatus === 'Partially Paid', 'Bill payment status updated to "Partially Paid"');
  assert(billAfterPmt1.balanceDue === expectedRemaining, `Remaining balance due correctly computed (₹${expectedRemaining})`);

  // Verify payment history shows installment
  const paymentHistory = await supplierBillService.getBillPaymentHistory(createdBill.id, testCompanyId);
  assert(paymentHistory.length === 1, 'Payment history contains recorded installment');
  assert(paymentHistory[0].reference === 'NEFT-UB-48201', 'Payment reference saved in history');

  // Test Overpayment Prevention
  console.log('   Testing overpayment prevention...');
  let overpaymentPrevented = false;
  try {
    await supplierBillService.recordSupplierBillPayment(
      {
        billId: createdBill.id,
        amount: expectedRemaining + 500, // exceeds remaining
        paymentMethod: 'Bank Transfer',
        userProfile: accountantUser
      },
      testCompanyId
    );
  } catch (err: any) {
    overpaymentPrevented = true;
    assert(true, `Overpayment prevented as expected: "${err.message}"`);
  }
  if (!overpaymentPrevented) {
    assert(false, 'Overpayment was NOT prevented!');
  }

  // Pay Remaining Balance
  console.log('   Recording final payment to clear outstanding balance...');
  const { payment: pmt2, updatedBill: billAfterPmt2 } = await supplierBillService.recordSupplierBillPayment(
    {
      billId: createdBill.id,
      amount: expectedRemaining,
      paymentMethod: 'Bank Transfer',
      reference: 'NEFT-UB-48202',
      notes: 'Final settlement payment',
      userProfile: accountantUser
    },
    testCompanyId
  );

  assert(billAfterPmt2.paymentStatus === 'Paid', 'Bill payment status updated to "Paid"');
  assert(billAfterPmt2.balanceDue === 0, 'Balance due is exactly ₹0');

  const finalPaymentHistory = await supplierBillService.getBillPaymentHistory(createdBill.id, testCompanyId);
  assert(finalPaymentHistory.length === 2, 'All 2 disbursements tracked in payment history');

  // Re-query from purchaseService to verify persistence
  const reloadedBill = (await purchaseService.getPurchaseInvoices(undefined, testCompanyId)).find(
    b => b.id === createdBill.id
  );
  assert(reloadedBill?.paymentStatus === 'Paid', 'Payment status "Paid" persisted');
  assert(reloadedBill?.purchaseOrderNumber === poResult.purchaseOrderNumber, 'PO reference persisted');
  assert(reloadedBill?.supplierInvoiceNumber === supplierDeliveryBillNo, 'Supplier invoice number persisted');

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runEndToEndPurchaseWorkflow().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
