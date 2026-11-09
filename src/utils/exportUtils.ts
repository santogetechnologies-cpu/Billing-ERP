import * as XLSX from 'xlsx';
import { formatDate } from './formatters';

export const exportToExcel = (data: Record<string, any>[], fileName: string, sheetName: string = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, finalFileName);
};

export const exportToCSV = (data: Record<string, any>[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const finalFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  link.setAttribute('download', finalFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exports supplier payment records (selected or all) to a formatted Excel file (.xlsx)
 * with the exact 9 required columns, custom column widths, currency formatting, and text preservation.
 */
export const exportSupplierPaymentsToExcel = (
  payments: any[],
  fileName: string = 'Supplier_Payment_History'
) => {
  if (!payments || payments.length === 0) {
    alert('Please select at least one payment record to export.');
    return;
  }

  const excelRows = payments.map(p => {
    const voucherNo = String(p.paymentNumber || (p.id ? `PAY-${p.id.slice(0, 6).toUpperCase()}` : '—'));
    const supplierName = String(p.partyName || p.supplierName || '—');
    const supplierInvNo = String(p.supplierInvoiceNumber || '—');
    const poNumber = String(p.purchaseOrderNumber || '—');
    const paymentDate = p.date ? formatDate(p.date) : '—';
    const paymentMethod = String(p.paymentMethod || '—');
    const txRef = String(p.reference || '—');
    const numAmount = Number(p.amount || 0);
    const amountPaidFormatted = `₹${numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    const paymentStatus = (p.billPaymentStatus === 'Paid' || p.paymentStatus === 'Paid')
      ? 'COMPLETED'
      : 'PARTIALLY PAID';

    return {
      'Voucher Number': voucherNo,
      'Supplier Name': supplierName,
      'Supplier Invoice Number': supplierInvNo,
      'PO Number': poNumber,
      'Payment Date': paymentDate,
      'Payment Method': paymentMethod,
      'Transaction Reference': txRef,
      'Amount Paid': amountPaidFormatted,
      'Payment Status': paymentStatus
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Set professional column widths
  worksheet['!cols'] = [
    { wch: 18 }, // Voucher Number
    { wch: 25 }, // Supplier Name
    { wch: 25 }, // Supplier Invoice Number
    { wch: 18 }, // PO Number
    { wch: 16 }, // Payment Date
    { wch: 18 }, // Payment Method
    { wch: 28 }, // Transaction Reference
    { wch: 18 }, // Amount Paid
    { wch: 18 }  // Payment Status
  ];

  // Explicitly ensure text columns are marked as string type ('s')
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:I1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // Col 0: Voucher Number
    const cellVoucher = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
    if (cellVoucher) cellVoucher.t = 's';
    // Col 2: Supplier Invoice Number
    const cellInv = worksheet[XLSX.utils.encode_cell({ r: R, c: 2 })];
    if (cellInv) cellInv.t = 's';
    // Col 3: PO Number
    const cellPO = worksheet[XLSX.utils.encode_cell({ r: R, c: 3 })];
    if (cellPO) cellPO.t = 's';
    // Col 6: Transaction Reference
    const cellRef = worksheet[XLSX.utils.encode_cell({ r: R, c: 6 })];
    if (cellRef) cellRef.t = 's';
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment History');

  const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, finalFileName);
};
