import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { exportSupplierPaymentsToExcel } from '../src/utils/exportUtils';

console.log('================================================================================');
console.log('TEST SUITE: FIX SUPPLIER PAYMENT HISTORY – EXPORT SELECTED TO EXCEL');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const tabPath = path.resolve('src/components/purchases/PurchasePaymentsMadeTab.tsx');
  const dataTablePath = path.resolve('src/components/common/DataTable.tsx');
  const exportUtilsPath = path.resolve('src/utils/exportUtils.ts');

  const tabCode = fs.readFileSync(tabPath, 'utf8');
  const dataTableCode = fs.readFileSync(dataTablePath, 'utf8');
  const exportUtilsCode = fs.readFileSync(exportUtilsPath, 'utf8');

  // --- Group 1: Code Verification in PurchasePaymentsMadeTab.tsx ---
  console.log('--- 1. PurchasePaymentsMadeTab.tsx Bulk Actions & Export Mapping ---');
  runTest('Imports exportSupplierPaymentsToExcel in PurchasePaymentsMadeTab', () => {
    assert(tabCode.includes('exportSupplierPaymentsToExcel'), 'Must import exportSupplierPaymentsToExcel');
  });

  runTest('Defines handleExportSelectedExcel with zero-selection check', () => {
    assert(tabCode.includes('handleExportSelectedExcel'), 'Must define handleExportSelectedExcel');
    assert(tabCode.includes('Please select at least one payment record to export'), 'Must guard against empty selection');
  });

  runTest('DataTable is provided with bulkActions for Export Selected', () => {
    assert(tabCode.includes('bulkActions='), 'Must pass bulkActions to DataTable');
    assert(tabCode.includes('Export Selected'), 'Must render Export Selected button in bulkActions');
    assert(tabCode.includes('handleExportSelectedExcel(selectedRows)'), 'Must pass selectedRows to handleExportSelectedExcel');
  });

  // --- Group 2: DataTable.tsx Excel Export Fix ---
  console.log('\n--- 2. DataTable.tsx Excel Export Support ---');
  runTest('DataTable imports exportToExcel and defines exportExcel', () => {
    assert(dataTableCode.includes("import { exportToExcel } from '../../utils/exportUtils';"), 'Must import exportToExcel');
    assert(dataTableCode.includes('const exportExcel ='), 'Must define exportExcel function');
  });

  runTest('DataTable export menu and bulk actions use real Excel export', () => {
    assert(dataTableCode.includes('onClick={() => exportExcel(false)}'), 'Export Excel menu option must call exportExcel');
    assert(dataTableCode.includes('onClick={() => exportExcel(true)}'), 'Default bulk action must call exportExcel');
  });

  // --- Group 3: Functional Excel File Generation with 2 Selected Records ---
  console.log('\n--- 3. Testing Excel File Generation with Two Selected Records ---');

  const mockSelectedPayments = [
    {
      id: 'pay-uuid-001',
      paymentNumber: 'PAY-0042',
      partyName: 'Mijilash M',
      supplierInvoiceNumber: 'PO-REF-955046',
      purchaseOrderNumber: 'PO-967067',
      date: '2026-11-08',
      paymentMethod: 'Cash',
      reference: 'Bill: PB-967067',
      amount: 169.05,
      billPaymentStatus: 'Partially Paid'
    },
    {
      id: 'pay-uuid-002',
      paymentNumber: 'PAY-0040',
      partyName: 'Mijilash M',
      supplierInvoiceNumber: '12345',
      purchaseOrderNumber: 'PO-514490',
      date: '2026-11-04',
      paymentMethod: 'Bank Transfer',
      reference: 'Bill: PB-514490',
      amount: 461.04,
      billPaymentStatus: 'Paid'
    }
  ];

  // Call exportSupplierPaymentsToExcel with output filename
  const testFileName = 'test_exported_supplier_payments.xlsx';
  if (fs.existsSync(testFileName)) {
    fs.unlinkSync(testFileName);
  }

  exportSupplierPaymentsToExcel(mockSelectedPayments, 'test_exported_supplier_payments');

  runTest('Excel file generated on disk with .xlsx extension', () => {
    assert(fs.existsSync(testFileName), 'Excel file must exist on disk');
  });

  const fileBuffer = fs.readFileSync(testFileName);
  const capturedWorkbook = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });

  runTest('Excel file generated with workbook and Payment History sheet', () => {
    assert(capturedWorkbook !== null, 'Workbook must be created');
    assert(capturedWorkbook.SheetNames.includes('Payment History'), 'Sheet must be named Payment History');
  });

  const sheet = capturedWorkbook!.Sheets['Payment History'];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  runTest('Excel file contains exactly 2 data rows for the 2 selected payments', () => {
    assert.strictEqual(jsonData.length, 2, 'Must export exactly 2 records for 2 selected rows');
  });

  runTest('Excel file contains all 9 required column headings', () => {
    const requiredHeaders = [
      'Voucher Number',
      'Supplier Name',
      'Supplier Invoice Number',
      'PO Number',
      'Payment Date',
      'Payment Method',
      'Transaction Reference',
      'Amount Paid',
      'Payment Status'
    ];

    const actualHeaders = Object.keys(jsonData[0] || {});
    for (const header of requiredHeaders) {
      assert(actualHeaders.includes(header), `Missing expected header: ${header}`);
    }
    assert.strictEqual(actualHeaders.length, 9, 'Must contain exactly 9 columns');
  });

  runTest('Row 1 data is complete and accurate', () => {
    const row1 = jsonData[0];
    assert.strictEqual(row1['Voucher Number'], 'PAY-0042');
    assert.strictEqual(row1['Supplier Name'], 'Mijilash M');
    assert.strictEqual(row1['Supplier Invoice Number'], 'PO-REF-955046');
    assert.strictEqual(row1['PO Number'], 'PO-967067');
    assert(row1['Payment Date'].includes('08') || row1['Payment Date'].includes('Nov'), 'Date must be formatted');
    assert.strictEqual(row1['Payment Method'], 'Cash');
    assert.strictEqual(row1['Transaction Reference'], 'Bill: PB-967067');
    assert.strictEqual(row1['Amount Paid'], '₹169.05');
    assert.strictEqual(row1['Payment Status'], 'PARTIALLY PAID');
  });

  runTest('Row 2 data is complete and accurate', () => {
    const row2 = jsonData[1];
    assert.strictEqual(row2['Voucher Number'], 'PAY-0040');
    assert.strictEqual(row2['Supplier Name'], 'Mijilash M');
    assert.strictEqual(row2['Supplier Invoice Number'], '12345');
    assert.strictEqual(row2['PO Number'], 'PO-514490');
    assert(row2['Payment Date'].includes('04') || row2['Payment Date'].includes('Nov'), 'Date must be formatted');
    assert.strictEqual(row2['Payment Method'], 'Bank Transfer');
    assert.strictEqual(row2['Transaction Reference'], 'Bill: PB-514490');
    assert.strictEqual(row2['Amount Paid'], '₹461.04');
    assert.strictEqual(row2['Payment Status'], 'COMPLETED');
  });

  runTest('Text fields are preserved as string cells in worksheet', () => {
    // Check cell types in worksheet: row 2 cell A (Voucher Number) and cell C (Invoice #)
    assert.strictEqual(sheet['A2'].t, 's', 'Voucher Number must have string type');
    assert.strictEqual(sheet['C2'].t, 's', 'Supplier Invoice Number must have string type');
    assert.strictEqual(sheet['D2'].t, 's', 'PO Number must have string type');
    assert.strictEqual(sheet['G2'].t, 's', 'Transaction Reference must have string type');
  });

  runTest('Column widths (!cols) are configured for all 9 columns', () => {
    const cols = sheet['!cols'];
    assert(Array.isArray(cols), 'sheet["!cols"] must be defined');
    assert.strictEqual(cols.length, 9, 'Must define widths for all 9 columns');
    assert(cols.every(c => c.wch && c.wch >= 14), 'Each column width must be sufficiently wide (>=14)');
  });

  // Clean up test file if created
  if (fs.existsSync(testFileName)) {
    fs.unlinkSync(testFileName);
  }

  console.log('\n================================================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
