import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  Eye,
  ArrowUpRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { PaymentMethod, PurchaseInvoice } from '../../types';
import { exportSupplierPaymentsToExcel } from '../../utils/exportUtils';
import { SupplierBillInvoiceModal } from './SupplierBillInvoiceModal';

/**
 * Generates standalone, pixel-perfect A4 Landscape Supplier Payment History HTML for clean browser printing.
 */
function generateSupplierPaymentHistoryPrintHTML(
  payments: any[],
  company: any,
  totalPaidAmount: number
): string {
  const companyName = company?.companyName || company?.name || 'Universal ERP Enterprise';
  const companyAddressParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.pincode
  ].filter(Boolean);
  const companyAddressStr = companyAddressParts.length > 0 ? companyAddressParts.join(', ') : '';
  const companyGstin = company?.gstin || '';
  const companyPhone = company?.phone || '';

  const now = new Date();
  const printDateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ', ' + now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const rowsHTML = payments.map((p, idx) => {
    const voucherNo = p.paymentNumber || (p.id ? `PV-${p.id.slice(0, 6).toUpperCase()}` : '—');
    const supplierName = p.partyName || '—';
    const supplierInvNo = p.supplierInvoiceNumber || '—';
    const poNumber = p.purchaseOrderNumber || '—';
    const paymentDate = p.date ? formatDate(p.date) : '—';
    const paymentMethod = p.paymentMethod || '—';
    const txRef = p.reference || '—';
    const numAmount = Number(p.amount || 0);
    const amountFormatted = `- ${formatCurrency(numAmount)}`;
    const isCompleted = p.billPaymentStatus === 'Paid' || p.paymentStatus === 'Paid';
    const statusLabel = isCompleted ? 'COMPLETED' : 'PARTIALLY PAID';
    const badgeClass = isCompleted ? 'badge-completed' : 'badge-partial';

    return `
      <tr>
        <td class="text-center font-mono" style="width: 4%; color: #64748b;">${idx + 1}</td>
        <td class="text-left font-mono text-blue-700 font-bold nowrap" style="width: 10%;">${voucherNo}</td>
        <td class="text-left font-bold text-slate-900" style="width: 13%;">${supplierName}</td>
        <td class="text-left font-mono font-semibold text-purple-700" style="width: 14%;">${supplierInvNo}</td>
        <td class="text-left font-mono text-slate-600" style="width: 11%;">${poNumber}</td>
        <td class="text-center text-slate-800 nowrap" style="width: 10%;">${paymentDate}</td>
        <td class="text-center text-slate-700 font-medium" style="width: 9%;">${paymentMethod}</td>
        <td class="text-left font-mono text-slate-600" style="width: 14%;">${txRef}</td>
        <td class="text-right font-mono font-bold text-rose-600 nowrap" style="width: 9%;">${amountFormatted}</td>
        <td class="text-center" style="width: 6%;">
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Supplier Payment History</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5px;
      line-height: 1.35;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    }
    .print-container {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 2px solid #0f172a;
      width: 100%;
      box-sizing: border-box;
    }
    .company-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .company-meta {
      font-size: 9px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-title-block {
      text-align: right;
    }
    .doc-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-subtitle {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 600;
    }
    table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse;
      table-layout: fixed;
      box-sizing: border-box;
      margin: 0;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #0f172a;
      font-weight: 700;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 6px 4px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      box-sizing: border-box;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    td {
      padding: 5px 4px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      box-sizing: border-box;
      overflow-wrap: anywhere;
      word-break: break-word;
      font-size: 9px;
      line-height: 1.25;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .text-blue-700 { color: #1d4ed8; }
    .text-purple-700 { color: #6d28d9; }
    .text-rose-600 { color: #e11d48; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-800 { color: #1e293b; }
    .text-slate-700 { color: #334155; }
    .text-slate-600 { color: #475569; }
    .text-slate-500 { color: #64748b; }
    .nowrap { white-space: nowrap; }
    .badge {
      display: inline-block;
      padding: 2px 3px;
      border-radius: 3px;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.1px;
      line-height: 1.1;
      text-align: center;
      max-width: 100%;
      box-sizing: border-box;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .badge-completed {
      background-color: #dcfce7 !important;
      color: #15803d !important;
      border: 1px solid #86efac;
    }
    .badge-partial {
      background-color: #dbeafe !important;
      color: #1d4ed8 !important;
      border: 1px solid #93c5fd;
    }
    .print-doc-footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #94a3b8;
      width: 100%;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-header">
      <div>
        <div class="company-title">${companyName}</div>
        <div class="company-meta">
          ${[companyAddressStr, companyGstin && `GSTIN: ${companyGstin}`, companyPhone && `Phone: ${companyPhone}`].filter(Boolean).join(' | ')}
        </div>
      </div>
      <div class="doc-title-block">
        <div class="doc-title">Supplier Payment History</div>
        <div class="doc-subtitle">Total ${payments.length} payment records | Printed on ${printDateStr}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width: 4%;" />
        <col style="width: 10%;" />
        <col style="width: 13%;" />
        <col style="width: 14%;" />
        <col style="width: 11%;" />
        <col style="width: 10%;" />
        <col style="width: 9%;" />
        <col style="width: 14%;" />
        <col style="width: 9%;" />
        <col style="width: 6%;" />
      </colgroup>
      <thead>
        <tr>
          <th class="text-center" style="width: 4%;">S.No</th>
          <th class="text-left" style="width: 10%;">Voucher Number</th>
          <th class="text-left" style="width: 13%;">Supplier Name</th>
          <th class="text-left" style="width: 14%;">Supplier Invoice Number</th>
          <th class="text-left" style="width: 11%;">PO Number</th>
          <th class="text-center" style="width: 10%;">Payment Date</th>
          <th class="text-center" style="width: 9%;">Payment Method</th>
          <th class="text-left" style="width: 14%;">Transaction Reference</th>
          <th class="text-right" style="width: 9%;">Amount Paid</th>
          <th class="text-center" style="width: 6%;">Payment Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
      </tbody>
      <tfoot>
        <tr style="background-color: #f1f5f9; font-weight: 700; border-top: 2px solid #0f172a;">
          <td colspan="8" class="text-right font-bold text-slate-900" style="padding: 6px 6px;">
            Total Disbursed to Suppliers (${payments.length} vouchers):
          </td>
          <td class="text-right font-mono font-bold text-rose-600 nowrap" style="padding: 6px 4px;">
            - ${formatCurrency(totalPaidAmount)}
          </td>
          <td class="text-center" style="background-color: #f1f5f9;"></td>
        </tr>
      </tfoot>
    </table>

    <div class="print-doc-footer">
      <span>Supplier Payment History &mdash; Official Disbursement Register</span>
      <span>Page printed on ${printDateStr}</span>
    </div>
  </div>
</body>
</html>`;
}

export interface PurchasePaymentsMadeTabProps {
  isRecordPaymentOpen?: boolean;
  onCloseRecordPayment?: () => void;
}

export const PurchasePaymentsMadeTab: React.FC<PurchasePaymentsMadeTabProps> = ({
  isRecordPaymentOpen,
  onCloseRecordPayment
}) => {
  const { payments = [], purchaseInvoices = [], suppliers = [], recordPurchasePayment, company } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [account, setAccount] = useState('Primary Bank Account');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  const [selectedBillForView, setSelectedBillForView] = useState<PurchaseInvoice | null>(null);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<any | null>(null);

  // Supplier outward payments (augmented with linked bill & PO numbers)
  const outwardPayments = useMemo(() => {
    return payments
      .filter(p => p.type === 'Paid' || p.partyType === 'Supplier')
      .map(p => {
        let linkedBill: PurchaseInvoice | null = null;
        if (p.invoiceId) {
          linkedBill = purchaseInvoices.find(b => b.id === p.invoiceId) || null;
        }
        if (!linkedBill && p.reference) {
          const cleanRef = p.reference.replace(/^Bill:\s*/i, '').trim().toLowerCase();
          linkedBill = purchaseInvoices.find(
            b => (b.invoiceNumber && (p.reference.toLowerCase().includes(b.invoiceNumber.toLowerCase()) || b.invoiceNumber.toLowerCase().includes(cleanRef))) ||
                 (b.supplierInvoiceNumber && (p.reference.toLowerCase().includes(b.supplierInvoiceNumber.toLowerCase()) || b.supplierInvoiceNumber.toLowerCase().includes(cleanRef))) ||
                 (b.purchaseOrderNumber && p.reference.toLowerCase().includes(b.purchaseOrderNumber.toLowerCase()))
          ) || null;
        }
        if (!linkedBill && p.partyId) {
          linkedBill = purchaseInvoices.find(b => b.supplierId === p.partyId && Math.abs(Number(b.grandTotal) - Number(p.amount)) < 1) || null;
        }

        return {
          ...p,
          linkedBill,
          supplierInvoiceNumber: linkedBill?.supplierInvoiceNumber || linkedBill?.invoiceNumber || '',
          purchaseOrderNumber: linkedBill?.purchaseOrderNumber || '',
          billPaymentStatus: linkedBill?.paymentStatus || 'Paid'
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, purchaseInvoices]);

  // Robust bill resolver: looks up original PurchaseInvoice by invoiceId, reference, supplierInvoiceNumber, PO #, or supplier
  const findBillForPayment = (paymentRow: any): PurchaseInvoice | null => {
    if (!paymentRow) return null;

    // 1. Direct attached bill
    if (paymentRow.linkedBill) return paymentRow.linkedBill;

    // 2. Direct match by invoiceId
    if (paymentRow.invoiceId) {
      const byId = purchaseInvoices.find(b => b.id === paymentRow.invoiceId);
      if (byId) return byId;
    }

    // 3. Match by reference (e.g. "Bill: PB-967067" -> "PB-967067")
    const ref = (paymentRow.reference || '').trim();
    if (ref) {
      const cleanRef = ref.replace(/^Bill:\s*/i, '').trim();
      const byRef = purchaseInvoices.find(b =>
        (b.invoiceNumber && (b.invoiceNumber.toLowerCase() === cleanRef.toLowerCase() || ref.toLowerCase().includes(b.invoiceNumber.toLowerCase()) || b.invoiceNumber.toLowerCase().includes(cleanRef.toLowerCase()))) ||
        (b.supplierInvoiceNumber && (b.supplierInvoiceNumber.toLowerCase() === cleanRef.toLowerCase() || ref.toLowerCase().includes(b.supplierInvoiceNumber.toLowerCase()))) ||
        (b.purchaseOrderNumber && (b.purchaseOrderNumber.toLowerCase() === cleanRef.toLowerCase() || ref.toLowerCase().includes(b.purchaseOrderNumber.toLowerCase())))
      );
      if (byRef) return byRef;
    }

    // 4. Match by supplierInvoiceNumber
    if (paymentRow.supplierInvoiceNumber && paymentRow.supplierInvoiceNumber !== '—') {
      const supInv = paymentRow.supplierInvoiceNumber.trim().toLowerCase();
      const bySupInv = purchaseInvoices.find(b =>
        (b.supplierInvoiceNumber && b.supplierInvoiceNumber.toLowerCase() === supInv) ||
        (b.invoiceNumber && b.invoiceNumber.toLowerCase() === supInv)
      );
      if (bySupInv) return bySupInv;
    }

    // 5. Match by purchaseOrderNumber
    if (paymentRow.purchaseOrderNumber && paymentRow.purchaseOrderNumber !== '—') {
      const poNum = paymentRow.purchaseOrderNumber.trim().toLowerCase();
      const byPO = purchaseInvoices.find(b =>
        b.purchaseOrderNumber && b.purchaseOrderNumber.toLowerCase() === poNum
      );
      if (byPO) return byPO;
    }

    // 6. Match by partyId (Supplier) with matching grandTotal
    if (paymentRow.partyId) {
      const byPartyAmount = purchaseInvoices.find(b =>
        b.supplierId === paymentRow.partyId && Math.abs(Number(b.grandTotal) - Number(paymentRow.amount)) < 1
      );
      if (byPartyAmount) return byPartyAmount;

      const byParty = purchaseInvoices.find(b => b.supplierId === paymentRow.partyId);
      if (byParty) return byParty;
    }

    // 7. Match by partyName
    if (paymentRow.partyName) {
      const byPartyName = purchaseInvoices.find(b =>
        b.supplierName && b.supplierName.toLowerCase() === paymentRow.partyName.toLowerCase()
      );
      if (byPartyName) return byPartyName;
    }

    // 8. Fallback synthesis for standalone or legacy test disbursements
    const billNum = (paymentRow.supplierInvoiceNumber && paymentRow.supplierInvoiceNumber !== '—' ? paymentRow.supplierInvoiceNumber : '') ||
      (paymentRow.reference?.replace(/^Bill:\s*/i, '').trim() || '') ||
      `BILL-${(paymentRow.paymentNumber || paymentRow.id || 'REF').replace(/[^a-zA-Z0-9]/g, '')}`;

    return {
      id: paymentRow.invoiceId || `syn-${paymentRow.id}`,
      invoiceNumber: billNum,
      docType: 'purchase_invoice',
      date: paymentRow.date || new Date().toISOString().split('T')[0],
      supplierId: paymentRow.partyId || '',
      supplierName: paymentRow.partyName || 'Supplier',
      supplierInvoiceNumber: billNum,
      purchaseOrderNumber: paymentRow.purchaseOrderNumber || '',
      warehouse: 'Main Warehouse',
      subtotal: Number(paymentRow.amount || 0),
      taxTotal: 0,
      freightCharges: 0,
      otherCharges: 0,
      grandTotal: Number(paymentRow.amount || 0),
      paidAmount: Number(paymentRow.amount || 0),
      paymentStatus: paymentRow.billPaymentStatus === 'COMPLETED' || paymentRow.billPaymentStatus === 'Paid' ? 'Paid' : 'Partially Paid',
      createdAt: paymentRow.createdAt || new Date().toISOString(),
      notes: paymentRow.notes || `Disbursement against voucher ${paymentRow.paymentNumber || paymentRow.id}`,
      items: [
        {
          productId: 'prod-supplies',
          productName: 'Procured Supplies & Goods',
          qty: 1,
          orderedQty: 1,
          receivedQty: 1,
          unit: 'Lot',
          rate: Number(paymentRow.amount || 0),
          discount: 0,
          taxRate: 0,
          taxAmt: 0,
          total: Number(paymentRow.amount || 0)
        }
      ]
    };
  };

  const handleViewBill = (row: any) => {
    const bill = findBillForPayment(row);
    if (bill) {
      setSelectedBillForView(bill);
      setSelectedPaymentForView(row);
    }
  };

  // Outstanding bills for the selected supplier
  const unpaidBills = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchaseInvoices.filter(
      b => b.supplierId === selectedSupplierId &&
      (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') &&
      b.docType !== 'purchase_return'
    );
  }, [purchaseInvoices, selectedSupplierId]);

  const activeBill = useMemo(() => {
    return unpaidBills.find(b => b.id === selectedInvoiceId);
  }, [unpaidBills, selectedInvoiceId]);

  const activeBalanceDue = activeBill ? Math.max(0, activeBill.grandTotal - (activeBill.paidAmount || 0)) : 0;

  // Total supplier payables across all bills
  const totalOutstandingPayables = useMemo(() => {
    return purchaseInvoices
      .filter(b => b.docType !== 'purchase_return')
      .reduce((acc, b) => acc + Math.max(0, b.grandTotal - (b.paidAmount || 0)), 0);
  }, [purchaseInvoices]);

  const totalPaidSupplierAmount = useMemo(() => {
    return outwardPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [outwardPayments]);

  const handleOpenModal = () => {
    const firstSupplierWithDue = suppliers.find(s =>
      purchaseInvoices.some(b => b.supplierId === s.id && b.paymentStatus !== 'Paid' && b.docType !== 'purchase_return')
    ) || suppliers[0];

    const supId = firstSupplierWithDue?.id || '';
    setSelectedSupplierId(supId);

    const firstDueBill = purchaseInvoices.find(
      b => b.supplierId === supId && (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') && b.docType !== 'purchase_return'
    );

    setSelectedInvoiceId(firstDueBill?.id || '');
    if (firstDueBill) {
      const due = Math.max(0, firstDueBill.grandTotal - (firstDueBill.paidAmount || 0));
      setAmount(due > 0 ? due.toString() : '');
    } else {
      setAmount('');
    }

    setPaymentMethod('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setNotes('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    onCloseRecordPayment?.();
  };

  useEffect(() => {
    if (isRecordPaymentOpen) {
      handleOpenModal();
    }
  }, [isRecordPaymentOpen]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (!selectedInvoiceId) {
      setErrorMessage('Please select an outstanding supplier bill.');
      return;
    }
    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (activeBill && numAmount > activeBalanceDue + 0.01) {
      setErrorMessage(`Payment amount cannot exceed the balance due of ${formatCurrency(activeBalanceDue)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      await recordPurchasePayment({
        purchaseId: selectedInvoiceId,
        amount: numAmount,
        paymentMethod,
        date: paymentDate,
        reference: reference.trim() || undefined,
        account,
        notes: notes.trim() || undefined
      });

      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to record supplier payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportSelectedExcel = (selectedRows: any[]) => {
    if (!selectedRows || selectedRows.length === 0) {
      alert('Please select at least one payment record to export.');
      return;
    }
    exportSupplierPaymentsToExcel(selectedRows, `Supplier_Payment_History_Selected_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintTable = () => {
    const html = generateSupplierPaymentHistoryPrintHTML(outwardPayments, company, totalPaidSupplierAmount);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 250);
    } else {
      window.print();
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'paymentNumber',
      header: 'Voucher #',
      width: '13%',
      render: row => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
          {row.paymentNumber || `PV-${row.id.slice(0, 6).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'partyName',
      header: 'Supplier Name',
      width: '25%',
      render: row => (
        <div className="min-w-0">
          <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
            {row.partyName}
          </div>
          {row.supplierInvoiceNumber ? (
            <div className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5 truncate">
              {row.supplierInvoiceNumber}
            </div>
          ) : null}
        </div>
      )
    },
    {
      key: 'paymentMethod',
      header: 'Payment Method',
      width: '13%',
      render: row => (
        <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium border border-slate-200/60 dark:border-slate-700 whitespace-nowrap">
          {row.paymentMethod}
        </span>
      )
    },
    {
      key: 'reference',
      header: 'Transaction Reference',
      width: '19%',
      render: row => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate block">
          {row.reference || '—'}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      align: 'right',
      width: '14%',
      render: row => (
        <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums text-xs whitespace-nowrap">
          - {formatCurrency(row.amount)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Payment Status',
      width: '16%',
      render: row => {
        const isPaid = row.billPaymentStatus === 'Paid';
        return isPaid ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>COMPLETED</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>PARTIALLY PAID</span>
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* On-Screen Supplier Payment History UI (Hidden during window.print) */}
      <div className="space-y-4 no-print">
        {/* Top metrics summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Total Paid to Suppliers</span>
            <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(totalPaidSupplierAmount)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{outwardPayments.length} payment vouchers issued</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Total Outstanding Payables</span>
            <div className="text-xl font-bold text-amber-600 mt-1 tabular-nums">
              {formatCurrency(totalOutstandingPayables)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Across all pending supplier bills</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 sm:col-span-2 lg:col-span-1 flex flex-col justify-center">
            <span className="text-xs text-slate-500 font-medium">Quick Disbursement</span>
            <p className="text-xs text-slate-600 mt-1">Make direct payment against an approved supplier bill.</p>
          </div>
        </div>

        <DataTable
          title="Supplier Payment History"
          subtitle={`Total ${outwardPayments.length} payment records`}
          columns={columns}
          data={outwardPayments}
          searchPlaceholder="Search voucher #, supplier, invoice #, PO #, or reference..."
          searchKeys={['paymentNumber', 'partyName', 'supplierInvoiceNumber', 'purchaseOrderNumber', 'reference', 'account']}
          onRowClick={row => handleViewBill(row)}
          onPrint={handlePrintTable}
          hideHorizontalScroll={true}
          actionsWidth="76px"
          actions={row => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewBill(row);
              }}
              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
              title="View Bill"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          bulkActions={(selectedRows) => (
            <button
              type="button"
              onClick={() => handleExportSelectedExcel(selectedRows)}
              className="px-2.5 py-1 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-50 font-medium cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Export Selected records to Excel"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Selected</span>
            </button>
          )}
        />
      </div>

      {/* Modal: Record Supplier Payment */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title="Record Supplier Payment"
          subtitle="Disburse funds against an outstanding purchase bill."
          size="lg"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => {
                    const supId = e.target.value;
                    setSelectedSupplierId(supId);
                    const bills = purchaseInvoices.filter(
                      b => b.supplierId === supId && (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') && b.docType !== 'purchase_return'
                    );
                    setSelectedInvoiceId(bills[0]?.id || '');
                    if (bills[0]) {
                      const due = Math.max(0, bills[0].grandTotal - (bills[0].paidAmount || 0));
                      setAmount(due.toString());
                    } else {
                      setAmount('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gstin || 'Unregistered'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outstanding Purchase Bill <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={e => {
                    const invId = e.target.value;
                    setSelectedInvoiceId(invId);
                    const bill = unpaidBills.find(b => b.id === invId);
                    if (bill) {
                      const due = Math.max(0, bill.grandTotal - (bill.paidAmount || 0));
                      setAmount(due.toString());
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {unpaidBills.length === 0 ? (
                    <option value="">No pending bills for this supplier</option>
                  ) : (
                    unpaidBills.map(b => {
                      const due = Math.max(0, b.grandTotal - (b.paidAmount || 0));
                      return (
                        <option key={b.id} value={b.id}>
                          {b.invoiceNumber} — Total: {formatCurrency(b.grandTotal)} (Due: {formatCurrency(due)})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            {activeBill && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-blue-700 font-semibold block">Bill: {activeBill.invoiceNumber}</span>
                  <span className="text-blue-500">Total: {formatCurrency(activeBill.grandTotal)} • Paid so far: {formatCurrency(activeBill.paidAmount || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Balance Due:</span>
                  <span className="font-bold text-blue-900 text-sm">{formatCurrency(activeBalanceDue)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount to Pay (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums font-semibold"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank / Cash Account
                </label>
                <input
                  type="text"
                  value={account}
                  onChange={e => setAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. HDFC Current Account"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / UTR / Cheque #
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. UTR12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes or remittance details..."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedInvoiceId}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Recording...' : 'Confirm & Disburse'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: View Payment Voucher */}
      {viewingPayment && (
        <Modal
          isOpen={Boolean(viewingPayment)}
          onClose={() => setViewingPayment(null)}
          title={`Payment Voucher: ${viewingPayment.paymentNumber || viewingPayment.id.slice(0, 8)}`}
          subtitle={`Paid to ${viewingPayment.partyName} on ${formatDate(viewingPayment.date)}`}
          size="md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-semibold text-slate-900">{viewingPayment.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-medium text-slate-800">{formatDate(viewingPayment.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-blue-700">{viewingPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference / UTR:</span>
                <span className="font-mono text-slate-800">{viewingPayment.reference || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disbursed From:</span>
                <span className="text-slate-800">{viewingPayment.account || 'Primary Bank'}</span>
              </div>
              {viewingPayment.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Notes:</span>
                  <span className="text-slate-700 italic">{viewingPayment.notes}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-sm">
              <span className="font-semibold text-emerald-900">Amount Disbursed:</span>
              <span className="font-bold text-emerald-700 text-lg tabular-nums">
                {formatCurrency(viewingPayment.amount)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: View Supplier Bill */}
      <SupplierBillInvoiceModal
        isOpen={Boolean(selectedBillForView)}
        onClose={() => {
          setSelectedBillForView(null);
          setSelectedPaymentForView(null);
        }}
        bill={selectedBillForView}
        payment={selectedPaymentForView}
      />

      {/* ========================================================= */}
      {/* DEDICATED IN-PAGE PRINT CONTAINER (A4 Landscape)          */}
      {/* ========================================================= */}
      <div className="hidden print:block supplier-payment-history-print-container font-sans bg-white text-slate-900 p-2 text-xs leading-normal">
        <div className="flex justify-between items-end pb-3 mb-3 border-b-2 border-slate-900 w-full">
          <div>
            <h1 className="text-base font-black uppercase text-slate-900 tracking-tight">
              {company?.companyName || company?.name || 'Universal ERP Enterprise'}
            </h1>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {[company?.address, company?.city, company?.state, company?.gstin && `GSTIN: ${company.gstin}`].filter(Boolean).join(' | ')}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-black uppercase text-slate-900 tracking-wider">
              Supplier Payment History
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
              Total {outwardPayments.length} payment records
            </p>
          </div>
        </div>

        <table className="w-full text-xs text-left border-collapse border border-slate-300 table-fixed">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300" style={{ display: 'table-header-group' }}>
            <tr>
              <th className="py-1.5 px-1 text-center border border-slate-300 w-[4%] text-[9px] uppercase tracking-wide">S.No</th>
              <th className="py-1.5 px-1.5 text-left border border-slate-300 w-[10%] text-[9px] uppercase tracking-wide">Voucher Number</th>
              <th className="py-1.5 px-1.5 text-left border border-slate-300 w-[13%] text-[9px] uppercase tracking-wide">Supplier Name</th>
              <th className="py-1.5 px-1.5 text-left border border-slate-300 w-[14%] text-[9px] uppercase tracking-wide">Supplier Invoice Number</th>
              <th className="py-1.5 px-1.5 text-left border border-slate-300 w-[11%] text-[9px] uppercase tracking-wide">PO Number</th>
              <th className="py-1.5 px-1 text-center border border-slate-300 w-[10%] text-[9px] uppercase tracking-wide">Payment Date</th>
              <th className="py-1.5 px-1 text-center border border-slate-300 w-[9%] text-[9px] uppercase tracking-wide">Payment Method</th>
              <th className="py-1.5 px-1.5 text-left border border-slate-300 w-[14%] text-[9px] uppercase tracking-wide">Transaction Reference</th>
              <th className="py-1.5 px-1.5 text-right border border-slate-300 w-[9%] text-[9px] uppercase tracking-wide">Amount Paid</th>
              <th className="py-1.5 px-1 text-center border border-slate-300 w-[6%] text-[9px] uppercase tracking-wide">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {outwardPayments.map((p, idx) => {
              const isPaid = p.billPaymentStatus === 'Paid';
              return (
                <tr key={p.id || idx} className="border-b border-slate-200 print-avoid-break">
                  <td className="py-1.5 px-1 text-center border border-slate-300 font-mono text-slate-500 text-[9px]">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-1.5 text-left border border-slate-300 font-mono font-bold text-blue-700 whitespace-nowrap text-[9px]">
                    {p.paymentNumber || (p.id ? `PV-${p.id.slice(0, 6).toUpperCase()}` : '—')}
                  </td>
                  <td className="py-1.5 px-1.5 text-left border border-slate-300 font-bold text-slate-900 break-words text-[9px]">
                    {p.partyName || '—'}
                  </td>
                  <td className="py-1.5 px-1.5 text-left border border-slate-300 font-mono font-semibold text-purple-700 break-words text-[9px]">
                    {p.supplierInvoiceNumber || '—'}
                  </td>
                  <td className="py-1.5 px-1.5 text-left border border-slate-300 font-mono text-slate-600 break-words text-[9px]">
                    {p.purchaseOrderNumber || '—'}
                  </td>
                  <td className="py-1.5 px-1 text-center border border-slate-300 text-slate-800 whitespace-nowrap text-[9px]">
                    {p.date ? formatDate(p.date) : '—'}
                  </td>
                  <td className="py-1.5 px-1 text-center border border-slate-300 text-slate-700 font-medium text-[9px]">
                    {p.paymentMethod || '—'}
                  </td>
                  <td className="py-1.5 px-1.5 text-left border border-slate-300 font-mono text-slate-600 break-words text-[9px]">
                    {p.reference || '—'}
                  </td>
                  <td className="py-1.5 px-1.5 text-right border border-slate-300 font-mono font-bold text-rose-600 whitespace-nowrap text-[9px]">
                    - {formatCurrency(p.amount)}
                  </td>
                  <td className="py-1.5 px-1 text-center border border-slate-300 font-bold text-[7.5px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-bold leading-tight ${isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                      {isPaid ? 'COMPLETED' : 'PARTIALLY PAID'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{ display: 'table-footer-group' }}>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
              <td colSpan={8} className="py-2 px-2 text-right text-slate-900 font-bold border border-slate-300 text-[9px]">
                Total Disbursed ({outwardPayments.length} records):
              </td>
              <td className="py-2 px-1.5 text-right font-mono font-bold text-rose-600 border border-slate-300 whitespace-nowrap text-[9px]">
                - {formatCurrency(totalPaidSupplierAmount)}
              </td>
              <td className="border border-slate-300 bg-slate-100" />
            </tr>
          </tfoot>
        </table>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 8mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
          .supplier-payment-history-print-container {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            box-sizing: border-box !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          th, td {
            box-sizing: border-box !important;
            overflow-wrap: anywhere !important;
          }
        }
      `}</style>
    </div>
  );
};

