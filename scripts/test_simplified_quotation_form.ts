import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Running Tests for Simplified Quotation Form ---\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${desc}${detail ? ` - ${detail}` : ''}`);
    }
  }

  const modalPath = path.resolve('src/components/purchases/BulkOrderBillModal.tsx');
  const code = fs.readFileSync(modalPath, 'utf8');

  // Test 1: Quotation Details has only Quote #, Date, and Valid Until
  assert(
    'Quotation Details has Quotation Number, Quotation Date, and Valid Until',
    code.includes('Quotation Number') &&
    code.includes('Quotation Date') &&
    code.includes('Valid Until')
  );

  // Test 2: Unnecessary top fields removed (Fulfillment Warehouse removed from details)
  assert(
    'Fulfillment Warehouse dropdown removed from Quotation Details',
    !code.includes('Fulfillment Warehouse')
  );

  // Test 3: Customer Details has Customer Name and Phone Number only
  assert(
    'Customer Details contains Customer Name and Phone Number',
    code.includes('Customer Name') &&
    code.includes('Phone Number')
  );

  // Test 4: Unnecessary customer fields removed (billing address, delivery address, procurement details)
  assert(
    'Billing address, delivery address, and procurement details removed from customer section',
    !code.includes('Billing / Delivery Address') &&
    !code.includes('Procurement Details') &&
    !code.includes('customerAddress') &&
    !code.includes('customerGstin')
  );

  // Test 5: Product Details table columns match user specifications
  const expectedColumns = [
    'Product Name',
    'Quantity',
    'Unit',
    'Original Unit Price',
    'Discount (%)',
    'Discount Amount',
    'Final Unit Price',
    'Total Amount',
    'Action'
  ];
  const allColumnsPresent = expectedColumns.every(col => code.includes(col));
  assert(
    'Product Details table includes all 9 required columns',
    allColumnsPresent
  );

  // Test 6: Automatic Calculations implementation
  // Discount Amount = Original Unit Price * Discount %
  // Final Unit Price = Original Unit Price - Discount Amount
  // Final Total = Quantity * Final Unit Price
  const hasFormulaDiscountAmount = code.includes('((origPrice * discPct) / 100)');
  const hasFormulaFinalUnitPrice = code.includes('(origPrice - discountAmount)');
  const hasFormulaTotalAmount = code.includes('(qty * finalUnitPrice)');
  assert(
    'Automatic Calculations logic correctly implemented in updateLineItem',
    hasFormulaDiscountAmount && hasFormulaFinalUnitPrice && hasFormulaTotalAmount
  );

  // Test 7: Summary displays Subtotal, Total Discount, GST, Grand Total
  assert(
    'Summary displays Subtotal, Total Discount, GST (if applicable), and Grand Total',
    code.includes('Subtotal:') &&
    code.includes('Total Discount:') &&
    code.includes('GST (if applicable):') &&
    code.includes('Grand Total:')
  );

  // Test 8: Quotation Validity mandatory date and notice text
  const noticeText = 'This quotation is valid until the specified date. Prices may change after the validity period.';
  assert(
    'Validity notice text is clearly mentioned in quotation form and preview',
    code.includes(noticeText)
  );

  // Test 9: Expiry handling
  assert(
    'Expired quotation logic and status handling present',
    code.includes('isExpired') &&
    code.includes('todayStr > validUntil') &&
    code.includes('Expired')
  );

  // Test 10: Bottom actions: Keep ONLY Print Quotation and Cancel, remove Save as Draft and Save Quotation
  assert(
    'Bottom action bar has Save as Draft removed completely',
    !code.includes('Save as Draft')
  );

  assert(
    'Bottom action bar has Save Quotation button removed completely',
    !code.includes('>Save Quotation<') &&
    !code.includes('Saving Quotation...')
  );

  assert(
    'Bottom action bar contains Print Quotation and Cancel buttons only',
    code.includes('Print Quotation') &&
    /Cancel\s*<\/button>/.test(code)
  );

  // Test 11: Print and Cancel redirect to Dashboard
  assert(
    'Print Quotation handles afterprint / print completion and redirects to main Dashboard',
    code.includes("navigate('/')") &&
    code.includes('afterprint') &&
    code.includes('window.print()')
  );

  assert(
    'Cancel handler closes form and redirects to main Dashboard',
    code.includes('const handleCancel = () => {') &&
    code.includes("navigate('/')")
  );

  // Test 12: Unnecessary bottom sections removed
  assert(
    'Terms & Conditions, Notes textarea, and Advance Payment input removed from form editor',
    !code.includes('Advance Amount') &&
    !code.includes('Delivery Charges:') &&
    !code.includes('additionalCharges')
  );

  // Test 13: Quotation Preview button/tab removed
  assert(
    'Quotation Preview and tab switcher buttons removed from modal header',
    !code.includes('Quotation Preview') &&
    !code.includes('Quotation Editor')
  );

  console.log(`\nResults: ${passedCount}/${totalCount} tests passed.\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();

