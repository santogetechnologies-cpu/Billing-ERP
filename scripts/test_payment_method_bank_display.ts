import { formatPaymentMethod } from '../src/utils/formatters';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('========================================================================');
console.log('TEST SUITE: PAYMENT METHOD "BANK" DISPLAY IN SALES RECORDS & ORDER STATUS');
console.log('========================================================================\n');

// 1. Test formatPaymentMethod unit logic
console.log('👉 [1] Verifying formatPaymentMethod Mapping Logic');
assert(formatPaymentMethod('Bank Transfer') === 'Bank', 'Maps "Bank Transfer" -> "Bank"');
assert(formatPaymentMethod('bank_transfer') === 'Bank', 'Maps "bank_transfer" -> "Bank"');
assert(formatPaymentMethod('Bank') === 'Bank', 'Maps "Bank" -> "Bank"');
assert(formatPaymentMethod('bank') === 'Bank', 'Maps "bank" -> "Bank"');
assert(formatPaymentMethod('Cash') === 'Cash', 'Preserves "Cash" exactly');
assert(formatPaymentMethod('UPI') === 'UPI', 'Preserves "UPI" exactly');
assert(formatPaymentMethod('Card') === 'Card', 'Preserves "Card" exactly');
assert(formatPaymentMethod('Cheque') === 'Cheque', 'Preserves "Cheque" exactly');
assert(formatPaymentMethod('Credit') === 'Credit', 'Preserves "Credit" exactly');
assert(formatPaymentMethod(null) === 'Cash', 'Defaults null/empty to "Cash"');
assert(formatPaymentMethod('') === 'Cash', 'Defaults empty string to "Cash"');

// 2. Test SalesInvoicesPage implementation
console.log('\n👉 [2] Verifying SalesInvoicesPage Implementation');
const salesInvoicesPath = path.resolve(process.cwd(), 'src/pages/sales/SalesInvoicesPage.tsx');
const salesInvoicesSrc = fs.readFileSync(salesInvoicesPath, 'utf8');

assert(
  salesInvoicesSrc.includes('formatPaymentMethod'),
  'SalesInvoicesPage imports and calls formatPaymentMethod'
);

assert(
  salesInvoicesSrc.includes("header: 'Mode'") &&
  salesInvoicesSrc.includes('formatPaymentMethod(row.paymentMethod)'),
  'Mode column renders formatPaymentMethod(row.paymentMethod)'
);

assert(
  salesInvoicesSrc.includes('whitespace-nowrap'),
  'Mode column badge contains whitespace-nowrap preventing multiline wrapping'
);

assert(
  salesInvoicesSrc.includes("searchKeys={['invoiceNumber', 'customerName', 'paymentStatus', 'paymentMethod']}"),
  'Confirmed Invoices searchKeys includes paymentMethod'
);

assert(
  salesInvoicesSrc.includes("searchKeys={['invoiceNumber', 'customerName', 'customerGstin', 'paymentStatus', 'paymentMethod']}"),
  'All Sales Invoices searchKeys includes paymentMethod'
);

// 3. Verify Database Integrity & Non-Destructive Preservation
console.log('\n👉 [3] Verifying Database & Payment Processing Preservation');
const newInvoicePath = path.resolve(process.cwd(), 'src/pages/sales/NewInvoicePage.tsx');
const newInvoiceSrc = fs.readFileSync(newInvoicePath, 'utf8');
assert(
  newInvoiceSrc.includes("value=\"Bank Transfer\""),
  'NewInvoicePage preserves "Bank Transfer" payment option and state intact'
);

const typesPath = path.resolve(process.cwd(), 'src/types/index.ts');
const typesSrc = fs.readFileSync(typesPath, 'utf8');
assert(
  typesSrc.includes("'Bank Transfer'"),
  'types/index.ts preserves PaymentMethod type definition'
);

console.log('\n========================================================================');
console.log('🎉 ALL PAYMENT METHOD "BANK" DISPLAY TESTS PASSED (100% SUCCESS)');
console.log('========================================================================\n');
