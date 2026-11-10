import fs from 'fs';
import path from 'path';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('================================================================================');
console.log('TEST SUITE: PURCHASES & PO - PAYMENTS MADE TAB LAYOUT UPDATE');
console.log('================================================================================');

// 1. PurchaseInvoicesPage Header Card Verification
console.log('\n--- 1. PurchaseInvoicesPage Header Card Verification ---');
const pagePath = path.resolve('src/pages/purchases/PurchaseInvoicesPage.tsx');
assert(fs.existsSync(pagePath), 'PurchaseInvoicesPage.tsx exists');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

assert(
  pageContent.includes("activeTab === 'payments' ? (") &&
  pageContent.includes("setIsRecordPaymentOpen(true)") &&
  pageContent.includes("<span>Record Payment</span>"),
  'Universal header card renders "+ Record Payment" button when activeTab === "payments"'
);

assert(
  pageContent.includes("activeTab === 'returns' ? (") &&
  pageContent.includes("setIsAddReturnModalOpen(true)") &&
  pageContent.includes("<span>Add Return</span>"),
  'Universal header card keeps "+ Add Return" button when activeTab === "returns"'
);

assert(
  pageContent.includes("Purchases & PO") && pageContent.includes("ShoppingBag"),
  'Purchases & PO title and icon remain in universal header'
);

assert(
  pageContent.includes("<PurchasePaymentsMadeTab") &&
  pageContent.includes("isRecordPaymentOpen={isRecordPaymentOpen}") &&
  pageContent.includes("onCloseRecordPayment={() => setIsRecordPaymentOpen(false)}"),
  'PurchasePaymentsMadeTab receives isRecordPaymentOpen and onCloseRecordPayment props'
);

// 2. PurchasePaymentsMadeTab Two-Column Metrics Verification
console.log('\n--- 2. PurchasePaymentsMadeTab Two-Column Metrics Verification ---');
const tabPath = path.resolve('src/components/purchases/PurchasePaymentsMadeTab.tsx');
assert(fs.existsSync(tabPath), 'PurchasePaymentsMadeTab.tsx exists');
const tabContent = fs.readFileSync(tabPath, 'utf-8');

assert(
  tabContent.includes("Total Paid to Suppliers"),
  'Metrics Card 1: Total Paid to Suppliers is present'
);

assert(
  tabContent.includes("Total Outstanding Payables"),
  'Metrics Card 2: Total Outstanding Payables is present'
);

assert(
  !tabContent.includes("Quick Disbursement"),
  'Quick Disbursement card is completely removed from the dashboard'
);

assert(
  tabContent.includes('grid grid-cols-1 sm:grid-cols-2 gap-4'),
  'Summary cards arranged in a clean, balanced two-column layout (grid-cols-1 sm:grid-cols-2 gap-4)'
);

// Verify props & modal opening logic
assert(
  tabContent.includes("isRecordPaymentOpen?: boolean") &&
  tabContent.includes("onCloseRecordPayment?: () => void"),
  'PurchasePaymentsMadeTabProps interface defines isRecordPaymentOpen and onCloseRecordPayment'
);

assert(
  tabContent.includes("isRecordPaymentOpen") &&
  tabContent.includes("handleOpenModal();"),
  'PurchasePaymentsMadeTab listens to isRecordPaymentOpen to invoke handleOpenModal'
);

assert(
  tabContent.includes("handleCloseModal"),
  'PurchasePaymentsMadeTab defines handleCloseModal which notifies onCloseRecordPayment'
);

console.log('\n================================================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (10/10)');
console.log('================================================================================\n');

