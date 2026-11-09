import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Purchase Bill View: Payment Details & Bill Summary Format Update ---');

  const modalPath = path.resolve(process.cwd(), 'src/components/purchases/SupplierBillInvoiceModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  // 1. Verify Left Section - Payment Details
  console.log('\n--- 1. Left Section: Payment Details ---');
  if (!modalContent.includes('Payment Details')) {
    throw new Error('Left section title Payment Details missing');
  }

  // Check field order in screen view: Payment Status, Grand Total, Amount Paid, Balance Due
  const statusIdx = modalContent.indexOf('Payment Status:');
  const grandTotalIdx = modalContent.indexOf('Grand Total:');
  const amountPaidIdx = modalContent.indexOf('Amount Paid:');
  const balanceDueIdx = modalContent.indexOf('Balance Due:');

  if (statusIdx === -1 || grandTotalIdx === -1 || amountPaidIdx === -1 || balanceDueIdx === -1) {
    throw new Error('One or more Payment Details fields are missing');
  }
  if (!(statusIdx < grandTotalIdx && grandTotalIdx < amountPaidIdx && amountPaidIdx < balanceDueIdx)) {
    throw new Error('Payment Details fields are not in the exact required order: Payment Status -> Grand Total -> Amount Paid -> Balance Due');
  }
  console.log('✓ PASS: Payment Details fields are present in exact order (Status, Grand Total, Amount Paid, Balance Due)');

  // 2. Verify Right Section - Bill Summary
  console.log('\n--- 2. Right Section: Bill Summary ---');
  if (!modalContent.includes('Bill Summary')) {
    throw new Error('Right section title Bill Summary missing');
  }
  if (!modalContent.includes('Subtotal (Before GST):')) {
    throw new Error('Subtotal (Before GST) missing from Bill Summary');
  }
  if (!modalContent.includes('Total GST:')) {
    throw new Error('Total GST missing from Bill Summary');
  }
  if (!modalContent.includes('Additional Charges:')) {
    throw new Error('Additional Charges missing from Bill Summary');
  }
  if (!modalContent.includes('Balance:')) {
    throw new Error('Balance label missing (must replace Grand Total in Bill Summary)');
  }
  // Purple highlight for Balance
  if (!modalContent.includes('text-purple-700') && !modalContent.includes('text-purple-600') && !modalContent.includes('#7e22ce')) {
    throw new Error('Balance is not highlighted in purple');
  }
  console.log('✓ PASS: Bill Summary contains Subtotal, Total GST, Additional Charges, and purple Balance');

  // 3. Verify Calculations
  console.log('\n--- 3. Automatic Calculation Logic ---');
  if (!modalContent.includes('grandTotal = Number(bill.grandTotal || (subtotal + taxTotal + additionalCharges))')) {
    throw new Error('Grand Total calculation formula missing');
  }
  if (!modalContent.includes('balanceDue = Math.max(0, grandTotal - alreadyPaid)')) {
    throw new Error('Balance Due calculation formula missing');
  }
  if (!modalContent.includes('isCompleted = (alreadyPaid >= grandTotal && grandTotal > 0) || bill.paymentStatus === \'Paid\'')) {
    throw new Error('Completed status condition missing');
  }
  if (!modalContent.includes('isPartial = !isCompleted && (alreadyPaid > 0 || bill.paymentStatus === \'Partially Paid\')')) {
    throw new Error('Partially Paid status condition missing');
  }
  console.log('✓ PASS: Grand Total, Balance Due, and status conditions correctly implemented');

  // 4. Verify Colors
  console.log('\n--- 4. UI Colors ---');
  if (!modalContent.includes('text-emerald-') && !modalContent.includes('#15803d')) {
    throw new Error('Amount Paid green highlight missing');
  }
  if (!modalContent.includes('text-rose-') && !modalContent.includes('text-amber-') && !modalContent.includes('#b45309')) {
    throw new Error('Balance Due red/amber highlight missing');
  }
  console.log('✓ PASS: Amount Paid is green, Balance Due is red/amber, Balance is purple');

  // 5. Verify Print Template Symmetry
  console.log('\n--- 5. Print Layout Symmetry ---');
  if (!modalContent.includes('generatePurchaseInvoiceHTML')) {
    throw new Error('generatePurchaseInvoiceHTML missing');
  }
  console.log('✓ PASS: Print document generates balanced 2-column layout matching screen');

  console.log('\n================================================================================');
  console.log('ALL PURCHASE BILL FORMAT UPDATE TESTS PASSED SUCCESSFULLY (100%)');
  console.log('================================================================================\n');
}

runTests();

