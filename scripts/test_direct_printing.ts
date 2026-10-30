/**
 * Test Suite: Direct Printing for Bills and Barcode Stickers
 * Universal Billing System
 *
 * Verifies:
 * 1. Print Bridge daemon connection & status (/status)
 * 2. Installed printer discovery (/printers)
 * 3. 58mm & 80mm receipt text formatting
 * 4. Barcode sticker text formatting & sizing
 * 5. Direct print spooling (/print) with multiple copies
 * 6. Direct test page execution (/test) for receipts & barcode stickers
 * 7. Error handling & configuration error detection
 * 8. Graceful browser print fallback logic
 * 9. Safeguards: Invoice reprint idempotency (no duplicate invoices or stock deduction)
 * 10. Safeguards: Barcode printing non-mutability (does not touch products or stock)
 */

import http from 'http';
import { directPrintService } from '../src/services/directPrintService';
import { SalesInvoice, CompanyProfile, Product } from '../src/types';

const BRIDGE_URL = 'http://127.0.0.1:9191';

// Sample Company
const mockCompany: CompanyProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'METRO RETAIL SUPERMART',
  legalName: 'Metro Retail Supermart Pvt Ltd',
  email: 'contact@metroretail.com',
  phone: '+91 98765 43210',
  address: 'Shop 12-14, Commercial Plaza, MG Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'India',
  gstin: '27AABCM1234F1Z5',
  pan: 'AABCM1234F',
  bankName: 'HDFC Bank',
  accountNumber: '50200012345678',
  ifscCode: 'HDFC0001234',
  upiId: 'metroretail@hdfcbank',
  financialYear: '2026-2027',
  currency: 'INR',
  currencySymbol: '₹',
  termsAndConditions: 'Goods once sold can be exchanged within 7 days with original invoice.',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

// Sample Saved Invoice
const mockInvoice: SalesInvoice = {
  id: 'inv-test-9901',
  invoiceNumber: 'POS-2026-1042',
  docType: 'pos_invoice',
  date: '2026-10-24',
  dueDate: '2026-10-24',
  customerId: 'cust-101',
  customerName: 'Aarav Sharma',
  customerPhone: '+91 91234 56789',
  customerGstin: '27ABCDE1234F1Z9',
  warehouseId: 'wh-main-01',
  items: [
    {
      id: 'item-1',
      productId: 'prod-001',
      productName: 'Wireless Bluetooth Headphone Pro',
      sku: 'SKU-WHP-01',
      qty: 2,
      unit: 'Pcs',
      rate: 1499.00,
      discountPct: 10,
      discountAmt: 299.80,
      taxRate: 18,
      taxAmt: 485.68,
      total: 3183.88
    },
    {
      id: 'item-2',
      productId: 'prod-002',
      productName: 'USB-C Fast Charging Cable 2M',
      sku: 'SKU-CBL-02',
      qty: 1,
      unit: 'Pcs',
      rate: 299.00,
      discountPct: 0,
      discountAmt: 0,
      taxRate: 18,
      taxAmt: 53.82,
      total: 352.82
    }
  ],
  subtotal: 3298.00,
  discountTotal: 299.80,
  taxTotal: 539.50,
  cgstTotal: 269.75,
  sgstTotal: 269.75,
  igstTotal: 0,
  roundOff: -0.20,
  grandTotal: 3537.00,
  paidAmount: 3537.00,
  paymentStatus: 'Paid',
  paymentMethod: 'Cash',
  notes: 'Tendered: ₹4000.00 | Change: ₹463.00',
  terms: 'Thank you for shopping with Metro Supermart!',
  createdAt: '2026-10-24T17:30:00Z',
  updatedAt: '2026-10-24T17:30:00Z'
};

async function runTests() {
  console.log('================================================================');
  console.log('   UNIVERSAL BILLING: DIRECT PRINTING & BARCODE TEST SUITE     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Check Print Bridge Health (/status)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Print Bridge Daemon Health ---');
  try {
    const res = await fetch(`${BRIDGE_URL}/status`);
    const data = await res.json();
    assert(res.ok && data.status === 'online', 'Print bridge daemon is online and responsive');
    assert(typeof data.version === 'string', `Reported bridge version: v${data.version}`);
    assert(Boolean(data.platform), `Platform detected: ${data.platform}`);
  } catch (err: any) {
    assert(false, 'Print bridge daemon connection', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Discover Installed OS Printers (/printers)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Installed System Printers Discovery ---');
  try {
    const res = await fetch(`${BRIDGE_URL}/printers`);
    const data = await res.json();
    assert(res.ok && data.success === true, 'Successfully queried OS spooler printers');
    assert(Array.isArray(data.printers) && data.printers.length > 0, `Discovered ${data.printers?.length || 0} installed printers`);
    console.log(`    Discovered printers: ${data.printers.map((p: any) => p.name).join(', ')}`);
  } catch (err: any) {
    assert(false, 'Installed printer discovery', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Receipt Formatting for 58mm & 80mm
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: ESC/POS Bill Receipt Formatting ---');
  // 58 mm
  const text58 = directPrintService.formatReceiptText(mockInvoice, mockCompany, '58mm');
  assert(text58.includes('METRO RETAIL SUPERMART'), '58mm text includes shop name');
  assert(text58.includes('POS-2026-1042'), '58mm text includes invoice number');
  assert(text58.includes('Aarav Sharma'), '58mm text includes customer details');
  assert(text58.includes('Wireless Bluetooth Headphone Pro'), '58mm text includes product item');
  assert(text58.includes('GRAND TOTAL:'), '58mm text includes grand total');
  assert(text58.includes('3,537.00'), '58mm text contains correct calculated total');
  assert(text58.includes('Cash Tendered:'), '58mm text includes tendered amount');
  assert(text58.includes('Change Returned:'), '58mm text includes change returned');

  // 80 mm
  const text80 = directPrintService.formatReceiptText(mockInvoice, mockCompany, '80mm');
  assert(text80.includes('TAX INVOICE:'), '80mm text includes tax invoice title');
  assert(text80.includes('CGST:') && text80.includes('SGST:'), '80mm text includes CGST & SGST taxes');
  assert(text80.includes('GSTIN: 27AABCM1234F1Z5'), '80mm text includes company GSTIN');
  assert(text80.length > text58.length, '80mm format has wider column layout than 58mm');

  // --------------------------------------------------------------------------
  // TEST 4: Barcode Sticker Formatting & Sizing
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Barcode Sticker Label Formatting ---');
  const stickerData = {
    name: 'Wireless Bluetooth Headphone Pro',
    barcode: '8901234567890',
    sku: 'SKU-WHP-01',
    sellingPrice: 1499.00,
    mrp: 1999.00,
    category: 'Electronics'
  };

  const sticker50x25 = directPrintService.formatBarcodeStickerText(stickerData, 50, 25);
  assert(sticker50x25.includes('Wireless Bluetooth Headphone Pro'), 'Sticker text includes product name');
  assert(sticker50x25.includes('SKU-WHP-01'), 'Sticker text includes SKU');
  assert(sticker50x25.includes('8901234567890'), 'Sticker text includes scannable barcode number');
  assert(sticker50x25.includes('1,499.00'), 'Sticker text includes selling price');
  assert(sticker50x25.includes('1,999.00'), 'Sticker text includes MRP');

  // --------------------------------------------------------------------------
  // TEST 5: Direct Print Job Spooling via HTTP Bridge
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Direct Spooling Job to Printer Bridge ---');
  try {
    const printRes = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobType: 'receipt',
        title: `Bill ${mockInvoice.invoiceNumber}`,
        copies: 1,
        content: text58
      })
    });
    const printData = await printRes.json();
    assert(printRes.ok && printData.success === true, 'Successfully spooled direct bill print job to OS printer');
    assert(typeof printData.printer === 'string', `Target OS printer: "${printData.printer}"`);
  } catch (err: any) {
    assert(false, 'Direct print job spooling', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Barcode Sticker Spooling with Multiple Copies
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Barcode Sticker Spooling with Multiple Copies ---');
  try {
    const labelRes = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobType: 'barcode',
        title: `Barcode ${stickerData.barcode}`,
        copies: 3,
        content: sticker50x25
      })
    });
    const labelData = await labelRes.json();
    assert(labelRes.ok && labelData.success === true, 'Successfully spooled 3 copies of barcode label to label printer');
    assert(labelData.copiesPrinted === 3, `Verified copies printed count: ${labelData.copiesPrinted}`);
  } catch (err: any) {
    assert(false, 'Barcode sticker multiple copies spooling', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Test Page Endpoint (/test)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Built-in Printer Hardware Diagnostic Endpoints ---');
  try {
    // Receipt test
    const testReceiptRes = await fetch(`${BRIDGE_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType: 'receipt', paperSize: '80mm' })
    });
    const testReceiptData = await testReceiptRes.json();
    assert(testReceiptRes.ok && testReceiptData.success === true, 'Successfully executed receipt hardware test page');

    // Barcode label test
    const testBarcodeRes = await fetch(`${BRIDGE_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType: 'barcode', widthMm: 50, heightMm: 25 })
    });
    const testBarcodeData = await testBarcodeRes.json();
    assert(testBarcodeRes.ok && testBarcodeData.success === true, 'Successfully executed barcode label hardware test page');
  } catch (err: any) {
    assert(false, 'Printer diagnostic endpoints', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Error Detection & Validation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Error Detection & Helpful Messaging ---');
  try {
    const badRes = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobType: 'receipt' /* missing content */ })
    });
    const badData = await badRes.json();
    assert(badRes.status === 400 && badData.success === false, 'Detects empty/missing print content and rejects cleanly with HTTP 400');
    assert(badData.error.includes('required'), `Helpful error returned: "${badData.error}"`);
  } catch (err: any) {
    assert(false, 'Error detection test', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Graceful Browser Fallback Logic
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Graceful Browser Print Fallback ---');
  // Configure mock direct print service with offline URL
  const offlineCheck = await directPrintService.checkBridgeStatus('http://127.0.0.1:9999');
  assert(offlineCheck.online === false, 'Correctly identifies offline/unreachable bridge without throwing unhandled exceptions');
  assert(typeof offlineCheck.error === 'string', `Reported offline reason: "${offlineCheck.error}"`);

  // --------------------------------------------------------------------------
  // TEST 10: Safeguards: Invoice Reprint Idempotency
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Safeguards: Invoice Reprint Idempotency ---');
  // Verify that calling formatReceiptText and spooling does not mutate invoice ID, invoiceNumber, or items
  const originalInvoiceId = mockInvoice.id;
  const originalGrandTotal = mockInvoice.grandTotal;
  const originalItemsCount = mockInvoice.items.length;

  directPrintService.formatReceiptText(mockInvoice, mockCompany, '80mm');
  directPrintService.formatReceiptText(mockInvoice, mockCompany, '58mm');

  assert(mockInvoice.id === originalInvoiceId, 'Reprinting retains original saved invoice ID');
  assert(mockInvoice.grandTotal === originalGrandTotal, 'Reprinting retains original grand total without modification');
  assert(mockInvoice.items.length === originalItemsCount, 'Reprinting does not re-add or duplicate item line records');

  // --------------------------------------------------------------------------
  // TEST 11: Safeguards: Barcode Printing Non-Mutability
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Safeguards: Barcode Printing Non-Mutability ---');
  const sampleProduct: Product = {
    id: 'prod-safe-01',
    name: 'Precision Barcode Sample',
    sku: 'SKU-SAFE-01',
    barcode: '8909999888877',
    category: 'Test Category',
    costPrice: 500,
    sellingPrice: 799,
    retailPrice: 799,
    mrp: 999,
    taxRate: 18,
    primaryUnit: 'Piece',
    currentStock: 45,
    reorderLevel: 10,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const initialStock = sampleProduct.currentStock;
  const initialBarcode = sampleProduct.barcode;

  // Format and generate label
  directPrintService.formatBarcodeStickerText({
    name: sampleProduct.name,
    barcode: sampleProduct.barcode!,
    sku: sampleProduct.sku,
    sellingPrice: sampleProduct.sellingPrice,
    mrp: sampleProduct.mrp
  }, 50, 25);

  assert(sampleProduct.currentStock === initialStock, 'Barcode sticker printing did not mutate product stock balance');
  assert(sampleProduct.barcode === initialBarcode, 'Barcode sticker printing did not mutate product barcode');

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED               `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
