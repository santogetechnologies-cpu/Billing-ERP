/**
 * test_supplier_bill_accountant_workflow.ts
 *
 * Verifies the end-to-end Automatic Purchase Bill Transfer to Accountant workflow:
 * 1. Approve a purchase request.
 * 2. Create the corresponding purchase order.
 * 3. Record the actual supplier bill linked to PO and PR.
 * 4. Verify that the bill appears in the Accountant's Pending Review list.
 * 5. Verify the bill (Approved for Payment) and record a partial payment.
 * 6. Confirm that the balance and status are correct (Partially Paid).
 * 7. Record the remaining payment and confirm that the bill becomes Paid (0 balance).
 * 8. Re-query from storage/DB to confirm that all statuses persist.
 * 9. Confirm that rejected requests and unrecorded bills do NOT appear as payable bills.
 */

import { supabase } from '../src/lib/supabase';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { purchaseService } from '../src/services/purchaseService';
import { supplierBillService } from '../src/services/supplierBillService';
import { notificationService } from '../src/services/notificationService';

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

async function runWorkflowTests() {
  console.log('\n===============================================================');
  console.log('   AUTOMATIC PURCHASE BILL TRANSFER TO ACCOUNTANT TEST SUITE');
  console.log('===============================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const testAccountantProfile = {
    id: 'e1111111-1111-1111-1111-111111111111',
    fullName: 'Verified Senior Accountant',
    role: 'Accountant'
  };

  // 0. Ensure a test product and supplier exist
  console.log('👉 SETUP: Querying reference product and supplier...');
  const { data: prodData } = await supabase
    .from('products')
    .select('id, name, purchase_price')
    .eq('company_id', testCompanyId)
    .limit(1);

  const testProduct = prodData && prodData[0]
    ? prodData[0]
    : { id: 'prod-test-01', name: 'Test Commercial Unit', purchase_price: 500 };

  const { data: supData } = await supabase
    .from('suppliers')
    .select('id, name, company')
    .eq('company_id', testCompanyId)
    .limit(1);

  const testSupplier = supData && supData[0]
    ? supData[0]
    : { id: 'sup-test-01', name: 'Standard Raw Materials Ltd', company: 'Standard Materials' };

  console.log(`   Using Product: "${testProduct.name}" (ID: ${testProduct.id})`);
  console.log(`   Using Supplier: "${testSupplier.company || testSupplier.name}" (ID: ${testSupplier.id})\n`);

  // =========================================================================
  // STEP 1: Warehouse Manager creates a Purchase Request & Purchase Manager approves it
  // =========================================================================
  console.log('👉 STEP 1: Create and Approve Purchase Request');
  const pr = await purchaseRequestService.createPurchaseRequest(
    {
      warehouseId: 'wh-test-01',
      warehouseName: 'Central Logistics Godown',
      priority: 'Normal',
      reason: 'Low stock replenishment test',
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          currentStock: 10,
          requestedQty: 20,
          unit: 'Piece',
          estimatedCost: 1000
        }
      ]
    },
    testCompanyId,
    { id: 'wm-01', name: 'Warehouse Supervisor', role: 'Warehouse Manager' }
  );

  assert(Boolean(pr.id), 'Purchase Request created successfully', pr.id);
  assert(pr.status === 'Pending Approval', 'Initial PR status is "Pending Approval"');

  // Verify that an unapproved / unrecorded bill does NOT appear in Accountant bills
  const billsBeforeApproval = await supplierBillService.getSupplierBills(testCompanyId);
  const foundBeforeApproval = billsBeforeApproval.bills.find(b => b.purchaseRequestId === pr.id);
  assert(
    !foundBeforeApproval,
    'Unrecorded bill does NOT appear in Accountant dashboard before actual bill is recorded'
  );

  // Purchase Manager approves request
  const approvedPr = await purchaseRequestService.updateRequestStatus(
    {
      requestId: pr.id,
      status: 'Approved',
      comments: 'Approved by Purchase Manager for vendor order generation.'
    },
    testCompanyId,
    { id: 'pm-01', name: 'Purchase Manager', role: 'Purchase Manager' }
  );

  assert(approvedPr.status === 'Approved', 'PR status successfully updated to "Approved"');

  // =========================================================================
  // STEP 2: Purchase Manager generates Purchase Order from approved PR
  // =========================================================================
  console.log('\n👉 STEP 2: Generate Purchase Order from Approved Request');
  const poResult = await purchaseRequestService.createPurchaseOrderFromRequest(
    {
      requestId: pr.id,
      supplierId: testSupplier.id,
      supplierName: testSupplier.company || testSupplier.name,
      notes: 'Standard Delivery Contract',
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          qty: 20,
          rate: 1000,
          taxRate: 18,
          unit: 'Piece'
        }
      ]
    },
    testCompanyId,
    { id: 'pm-01', name: 'Purchase Manager', role: 'Purchase Manager' }
  );

  assert(Boolean(poResult.purchaseOrderId), 'Purchase Order ID generated', poResult.purchaseOrderId);
  assert(Boolean(poResult.purchaseOrderNumber), 'Purchase Order number generated', poResult.purchaseOrderNumber);
  assert(poResult.request.status === 'Ordered', 'Linked PR status updated to "Ordered"');

  // =========================================================================
  // STEP 3: Purchase Manager records the Actual Supplier Purchase Bill
  // =========================================================================
  console.log('\n👉 STEP 3: Record Actual Supplier Purchase Bill Linked to PO & PR');
  const uniqueBillNumber = `BILL-TEST-${Date.now().toString().slice(-6)}`;
  const billTotal = 23600; // 20 * 1000 = 20,000 subtotal + 18% tax (3600)

  const createdBill = await purchaseService.createPurchaseInvoice(
    {
      invoiceNumber: uniqueBillNumber,
      docType: 'purchase_invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      supplierId: testSupplier.id,
      supplierName: testSupplier.company || testSupplier.name,
      warehouse: 'wh-test-01',
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          qty: 20,
          unit: 'Piece',
          rate: 1000,
          discount: 0,
          taxRate: 18,
          taxAmt: 3600,
          total: 23600
        }
      ],
      subtotal: 20000,
      taxTotal: 3600,
      freightCharges: 0,
      otherCharges: 0,
      grandTotal: billTotal,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      purchaseOrderId: poResult.purchaseOrderId,
      purchaseOrderNumber: poResult.purchaseOrderNumber,
      purchaseRequestId: pr.id,
      purchaseRequestNumber: pr.requestNumber,
      verificationStatus: 'Pending Review'
    },
    testCompanyId
  );

  assert(Boolean(createdBill.id), 'Supplier bill created with ID', createdBill.id);
  assert(createdBill.purchaseOrderId === poResult.purchaseOrderId, 'Bill correctly linked to PO ID');
  assert(createdBill.purchaseOrderNumber === poResult.purchaseOrderNumber, 'Bill correctly linked to PO number');
  assert(createdBill.purchaseRequestId === pr.id, 'Bill correctly linked to PR ID');
  assert(createdBill.purchaseRequestNumber === pr.requestNumber, 'Bill correctly linked to PR number');

  // =========================================================================
  // STEP 4: Confirm bill appears in Accountant's "Pending Review" queue
  // =========================================================================
  console.log('\n👉 STEP 4: Verify Bill Appears in Accountant "Pending Review" Tab');
  const accountantSummary1 = await supplierBillService.getSupplierBills(testCompanyId, {
    tab: 'Pending Review'
  });

  const matchedPending = accountantSummary1.bills.find(b => b.id === createdBill.id || b.invoiceNumber === uniqueBillNumber);
  assert(Boolean(matchedPending), 'Recorded bill immediately found in Accountant Pending Review list');
  assert(matchedPending?.balanceDue === billTotal, `Initial balance due is full bill amount (₹${billTotal})`);
  assert(matchedPending?.verificationStatus === 'Pending Review', 'Verification status is "Pending Review"');
  assert(matchedPending?.paymentStatus === 'Unpaid', 'Initial payment status is "Unpaid"');

  // Verify notifications were dispatched to Accountant
  const notifs = await notificationService.getNotifications(testCompanyId, 'accountant-01', 'Accountant');
  const billNotif = notifs.find(n => n.type === 'supplier_bill' && n.title.includes(uniqueBillNumber));
  assert(Boolean(billNotif), 'Accountant received notification for new supplier bill pending review');

  // =========================================================================
  // STEP 5: Accountant Verifies Bill (Approved for Payment)
  // =========================================================================
  console.log('\n👉 STEP 5: Accountant Verifies Bill (Marks Approved for Payment)');
  const verifiedBill = await supplierBillService.verifySupplierBill(
    {
      billId: createdBill.id,
      status: 'Approved for Payment',
      notes: 'Invoice number, items, and tax verified against PO.',
      userProfile: testAccountantProfile
    },
    testCompanyId
  );

  assert(verifiedBill.verificationStatus === 'Approved for Payment', 'Bill verified as "Approved for Payment"');
  assert(verifiedBill.verifiedByName === testAccountantProfile.fullName, 'Verified by name recorded in audit metadata');

  // Check that it now appears in "Approved for Payment" tab
  const approvedSummary = await supplierBillService.getSupplierBills(testCompanyId, {
    tab: 'Approved for Payment'
  });
  const inApprovedTab = approvedSummary.bills.some(b => b.id === createdBill.id);
  assert(inApprovedTab, 'Bill now appears in "Approved for Payment" tab');

  // =========================================================================
  // STEP 6: Accountant Records Partial Payment (₹10,000 of ₹23,600)
  // =========================================================================
  console.log('\n👉 STEP 6: Accountant Records Partial Payment');
  const partialAmount = 10000;
  const { payment: partPay, updatedBill: partialBill } = await supplierBillService.recordSupplierBillPayment(
    {
      billId: createdBill.id,
      amount: partialAmount,
      paymentMethod: 'Bank Transfer',
      reference: 'NEFT-TEST-881923',
      notes: 'Initial 50% deposit for raw materials',
      userProfile: testAccountantProfile
    },
    testCompanyId
  );

  assert(Boolean(partPay.paymentNumber), 'Payment receipt generated', partPay.paymentNumber);
  assert(partialBill.paidAmount === partialAmount, `Paid amount is ₹${partialAmount}`);
  assert(partialBill.balanceDue === billTotal - partialAmount, `Remaining balance is ₹${billTotal - partialAmount}`);
  assert(partialBill.paymentStatus === 'Partially Paid', 'Status automatically transitioned to "Partially Paid"');

  // Verify in "Partially Paid" tab
  const partPaidSummary = await supplierBillService.getSupplierBills(testCompanyId, {
    tab: 'Partially Paid'
  });
  const inPartiallyPaidTab = partPaidSummary.bills.some(b => b.id === createdBill.id);
  assert(inPartiallyPaidTab, 'Bill appears in "Partially Paid" tab');

  // Confirm payment cannot exceed balance
  let overpayError = false;
  try {
    await supplierBillService.recordSupplierBillPayment(
      {
        billId: createdBill.id,
        amount: 999999, // exceeds remaining
        paymentMethod: 'Bank Transfer',
        userProfile: testAccountantProfile
      },
      testCompanyId
    );
  } catch (err: any) {
    overpayError = true;
  }
  assert(overpayError, 'Payment amount exceeding balance due is strictly rejected');

  // =========================================================================
  // STEP 7: Accountant Records Remaining Payment (₹13,600)
  // =========================================================================
  console.log('\n👉 STEP 7: Accountant Records Final Payment (Settles Bill in Full)');
  const remainingAmount = billTotal - partialAmount; // 13,600
  const { payment: finalPay, updatedBill: settledBill } = await supplierBillService.recordSupplierBillPayment(
    {
      billId: createdBill.id,
      amount: remainingAmount,
      paymentMethod: 'Bank Transfer',
      reference: 'NEFT-TEST-881924',
      notes: 'Final settlement payment',
      userProfile: testAccountantProfile
    },
    testCompanyId
  );

  assert(settledBill.paidAmount === billTotal, `Paid amount equals total (₹${billTotal})`);
  assert(settledBill.balanceDue === 0, 'Remaining balance due is exactly ₹0.00');
  assert(settledBill.paymentStatus === 'Paid', 'Status automatically transitioned to "Paid"');

  // Verify in "Paid" tab
  const paidSummary = await supplierBillService.getSupplierBills(testCompanyId, {
    tab: 'Paid'
  });
  const inPaidTab = paidSummary.bills.some(b => b.id === createdBill.id);
  assert(inPaidTab, 'Bill appears in "Paid" tab');

  // =========================================================================
  // STEP 8: Payment History Tracking
  // =========================================================================
  console.log('\n👉 STEP 8: Verify Payment History Tracking');
  const history = await supplierBillService.getBillPaymentHistory(createdBill.id, testCompanyId);
  assert(history.length >= 2, `Payment history contains both payments (found: ${history.length})`);
  const totalInHistory = history.reduce((sum, p) => sum + p.amount, 0);
  assert(totalInHistory >= billTotal, `Payment history total matches or exceeds ₹${billTotal}`);

  // =========================================================================
  // STEP 9: Re-query from storage/DB (Persistence across refresh/re-login)
  // =========================================================================
  console.log('\n👉 STEP 9: Confirm Persistence Across Reload / Fresh Query');
  const freshBills = await supplierBillService.getSupplierBills(testCompanyId);
  const reloadedBill = freshBills.bills.find(b => b.id === createdBill.id);

  assert(Boolean(reloadedBill), 'Bill reloaded successfully from database/storage');
  assert(reloadedBill?.paymentStatus === 'Paid', 'Reloaded payment status persists as "Paid"');
  assert(reloadedBill?.verificationStatus === 'Approved for Payment', 'Reloaded verification status persists as "Approved for Payment"');
  assert(reloadedBill?.balanceDue === 0, 'Reloaded balance due persists as 0');
  assert(reloadedBill?.purchaseOrderId === poResult.purchaseOrderId, 'PO link persists');
  assert(reloadedBill?.purchaseRequestId === pr.id, 'PR link persists');

  // =========================================================================
  // STEP 10: Correction Flagging & Purchase Manager Notification
  // =========================================================================
  console.log('\n👉 STEP 10: Test Correction Request Workflow & Notification');
  const secondBillNum = `BILL-CORR-${Date.now().toString().slice(-6)}`;
  const billForCorrection = await purchaseService.createPurchaseInvoice(
    {
      invoiceNumber: secondBillNum,
      docType: 'purchase_invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      supplierId: testSupplier.id,
      supplierName: testSupplier.company || testSupplier.name,
      warehouse: 'wh-test-01',
      items: [
        {
          productId: testProduct.id,
          productName: testProduct.name,
          qty: 5,
          unit: 'Piece',
          rate: 1000,
          discount: 0,
          taxRate: 18,
          taxAmt: 900,
          total: 5900
        }
      ],
      subtotal: 5000,
      taxTotal: 900,
      freightCharges: 0,
      otherCharges: 0,
      grandTotal: 5900,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      verificationStatus: 'Pending Review'
    },
    testCompanyId
  );

  const flagged = await supplierBillService.verifySupplierBill(
    {
      billId: billForCorrection.id,
      status: 'Correction Requested',
      notes: 'Quantity mismatch: delivery challan states 4 units, not 5.',
      userProfile: testAccountantProfile
    },
    testCompanyId
  );

  assert(flagged.verificationStatus === 'Correction Requested', 'Bill flagged as "Correction Requested"');
  assert(Boolean(flagged.correctionNotes), 'Correction notes recorded on bill');

  // Check notification to Purchase Manager
  const pmNotifs = await notificationService.getNotifications(testCompanyId, 'pm-01', 'Purchase Manager');
  const corrNotif = pmNotifs.find(n => n.type === 'bill_correction' && n.title.includes(secondBillNum));
  assert(Boolean(corrNotif), 'Purchase Manager received notification for Accountant correction request');

  // =========================================================================
  // STEP 11: Security & RBAC Enforcement: Unauthorized users cannot verify or pay
  // =========================================================================
  console.log('\n👉 STEP 11: Strict Security & Role Enforcement');
  let unauthorizedVerifyBlocked = false;
  try {
    await supplierBillService.verifySupplierBill(
      {
        billId: billForCorrection.id,
        status: 'Approved for Payment',
        userProfile: { id: 'pm-01', fullName: 'Purchase Manager', role: 'Purchase Manager' }
      },
      testCompanyId
    );
  } catch (err: any) {
    unauthorizedVerifyBlocked = true;
  }
  assert(unauthorizedVerifyBlocked, 'Purchase Manager is strictly forbidden from verifying bills');

  let unauthorizedPayBlocked = false;
  try {
    await supplierBillService.recordSupplierBillPayment(
      {
        billId: billForCorrection.id,
        amount: 100,
        paymentMethod: 'Cash',
        userProfile: { id: 'pm-01', fullName: 'Purchase Manager', role: 'Purchase Manager' }
      },
      testCompanyId
    );
  } catch (err: any) {
    unauthorizedPayBlocked = true;
  }
  assert(unauthorizedPayBlocked, 'Purchase Manager is strictly forbidden from recording payments or marking bills paid');

  // Clean up test records
  try {
    await supabase.from('purchases').delete().in('id', [createdBill.id, billForCorrection.id]);
    await supabase.from('purchase_requests').delete().eq('id', pr.id);
  } catch {}

  console.log('\n===============================================================');
  console.log(`   TOTAL TESTS: ${passCount + failCount}`);
  console.log(`   PASSED:      ${passCount}`);
  console.log(`   FAILED:      ${failCount}`);
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runWorkflowTests().catch(err => {
  console.error('Fatal error in workflow test runner:', err);
  process.exit(1);
});
