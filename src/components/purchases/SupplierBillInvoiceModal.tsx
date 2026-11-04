import React, { useEffect } from 'react';
import { X, Printer, FileText, CheckCircle2, Clock, Building2 } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SupplierBillInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: PurchaseInvoice | null;
}

export const SupplierBillInvoiceModal: React.FC<SupplierBillInvoiceModalProps> = ({
  isOpen,
  onClose,
  bill
}) => {
  const { company, suppliers = [], payments = [] } = useERP();

  // Isolate document in print mode: hides sidebar, header, nav, dashboard
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('invoice-modal-open');
      return () => {
        document.body.classList.remove('invoice-modal-open');
      };
    }
  }, [isOpen]);

  if (!isOpen || !bill) return null;

  // Resolve linked Supplier record
  const supplierRecord = suppliers.find(
    s => s.id === bill.supplierId || (s.name && s.name.toLowerCase() === bill.supplierName?.toLowerCase())
  );

  // Resolve linked payment record
  const linkedPayment = payments.find(
    p => p.invoiceId === bill.id || (p.reference && p.reference.includes(bill.invoiceNumber))
  );

  const isCompleted = bill.paymentStatus === 'Paid';
  const supplierName = bill.supplierName;
  const supplierAddress = supplierRecord?.address || '—';
  const supplierPhone = supplierRecord?.phone || '—';
  const supplierGstin = bill.supplierGstin || supplierRecord?.gstin || '';

  const companyName = company?.companyName || company?.name || 'Universal Billing Platform';
  const companyLogo = company?.logo;
  const companyAddressParts = [
    company?.address,
    company?.city,
    company?.state,
    company?.pincode
  ].filter(Boolean);
  const companyAddressStr = companyAddressParts.length > 0 ? companyAddressParts.join(', ') : 'Corporate Office';
  const companyPhone = company?.phone || '';
  const companyEmail = company?.email || '';
  const companyGstin = company?.gstin || '';
  const companyTerms =
    company?.termsAndConditions ||
    '1. All goods received are verified against purchase order specifications.\n2. Payment terms are subject to mutually agreed billing terms and invoice verification.\n3. Discrepancies, if any, must be reported within 7 business days.';

  const handlePrint = () => {
    const originalTitle = document.title;
    const invNo = bill.supplierInvoiceNumber || bill.invoiceNumber || 'Bill';
    document.title = `Purchase_Invoice_${invNo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto invoice-modal-backdrop">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-modal-backdrop {
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
          }
          .invoice-modal-container {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .purchase-invoice-screen-view {
            display: none !important;
          }
          .purchase-invoice-print-document {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="invoice-modal-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:h-auto print:shadow-none print:border-none print:m-0 print:p-0 print:max-w-none print:rounded-none">
        {/* ========================================================= */}
        {/* SCREEN ACTION BAR (Top Control Header - Hidden in Print)  */}
        {/* ========================================================= */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Purchase Invoice</span>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  #{bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ON-SCREEN MODAL PREVIEW (Hidden during Print)            */}
        {/* ========================================================= */}
        <div className="purchase-invoice-screen-view p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 no-print">
          {/* Header with Company Information & Invoice Metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-10 max-w-[160px] object-contain mb-2"
                />
              )}
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {companyName}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {companyAddressStr}
              </p>
              {companyGstin && (
                <p className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                  GSTIN: {companyGstin}
                </p>
              )}
              {(companyPhone || companyEmail) && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {[companyPhone && `Phone: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join(' | ')}
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs uppercase tracking-wider mb-2">
                PURCHASE INVOICE
              </span>
              <div className="space-y-0.5 font-mono text-xs">
                <div>
                  <span className="text-slate-400">Supplier Invoice Number: </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {bill.supplierInvoiceNumber || bill.invoiceNumber}
                  </span>
                </div>
                {bill.purchaseOrderNumber && (
                  <div>
                    <span className="text-slate-400">Purchase Order Number: </span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {bill.purchaseOrderNumber}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Invoice Date: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {formatDate(bill.date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Destination Warehouse: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {bill.warehouse || 'Main Warehouse'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Information & Destination Store */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Supplier Details (Vendor)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {supplierName}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {supplierAddress}
              </p>
              <div className="mt-2 space-y-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                {supplierGstin && <div>GSTIN: {supplierGstin}</div>}
                <div>Phone: {supplierPhone}</div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Destination Store (Delivery Accepted)
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {bill.warehouse || 'Main Warehouse'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {companyAddressStr}
              </p>
              <div className="mt-2 text-[11px] text-slate-500">
                Goods verified and accepted into inventory
              </div>
            </div>
          </div>

          {/* Product Details Table (Screen) */}
          <div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">S.No</th>
                    <th className="px-3.5 py-2.5">Product Name</th>
                    <th className="px-3 py-2.5 text-center w-28">Quantity</th>
                    <th className="px-2.5 py-2.5 text-center w-16">Unit</th>
                    <th className="px-3 py-2.5 text-right w-28">Cost / Item</th>
                    <th className="px-3 py-2.5 text-right w-28">Total Cost</th>
                    <th className="px-3 py-2.5 text-center w-20">GST %</th>
                    <th className="px-3 py-2.5 text-right w-28">GST Amount</th>
                    <th className="px-3.5 py-2.5 text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(bill.items || []).map((it, idx) => {
                    const ord = it.orderedQty !== undefined ? it.orderedQty : it.qty;
                    const recv = it.receivedQty !== undefined ? it.receivedQty : it.qty;
                    const rate = Number(it.rate) || 0;
                    const totalCost = recv * rate;
                    const taxRate = Number(it.taxRate) || 0;
                    const taxAmt = it.taxAmt !== undefined ? Number(it.taxAmt) : (totalCost * taxRate) / 100;
                    const lineTotal = it.total !== undefined ? Number(it.total) : totalCost + taxAmt;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-900 dark:text-white">
                          <div>{it.productName}</div>
                          {it.isUnregistered && (
                            <span className="text-[10px] text-purple-600 font-mono">PO Only</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">{recv}</span>
                          {ord !== undefined && ord !== recv && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              (Ord: {ord})
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center text-slate-500 font-medium">
                          {it.unit || 'PCS'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(rate)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(totalCost)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600 dark:text-slate-400">
                          {taxRate}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(taxAmt)}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Summary & Payment Information (Screen) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Payment Information */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Payment Details
              </h4>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>COMPLETED</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>PENDING</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(bill.paidAmount || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Balance Due:</span>
                  <span className="font-mono font-bold text-amber-600">
                    {formatCurrency(Math.max(0, bill.grandTotal - (bill.paidAmount || 0)))}
                  </span>
                </div>

                {isCompleted && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Date:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(linkedPayment?.date || bill.dueDate || bill.date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {linkedPayment?.paymentMethod || 'Bank Transfer'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                Bill Summary
              </h4>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Subtotal (Before GST):</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.subtotal)}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Total GST:</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.taxTotal)}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Additional Charges:</span>
                <span className="font-mono font-semibold">{formatCurrency(bill.otherCharges || bill.freightCharges || 0)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                  Grand Total:
                </span>
                <span className="font-mono font-extrabold text-base text-purple-600 dark:text-purple-400">
                  {formatCurrency(bill.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DEDICATED PROFESSIONAL A4 PRINT DOCUMENT (Print Only)    */}
        {/* ========================================================= */}
        <div className="hidden print:block purchase-invoice-print-document bg-white text-slate-900 font-sans p-4 sm:p-6 text-xs leading-normal">
          {/* 1. Header – Company Details (Top-Left) & PURCHASE INVOICE (Top-Right) */}
          <div className="flex justify-between items-start pb-5 border-b-2 border-slate-800 gap-6">
            <div className="flex items-start gap-4">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-16 max-w-[180px] object-contain shrink-0"
                />
              )}
              <div className="space-y-1">
                <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {companyName}
                </h1>
                <p className="text-xs text-slate-700 max-w-sm leading-relaxed">
                  {companyAddressStr}
                </p>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  {companyPhone && <div><strong>Phone:</strong> {companyPhone}</div>}
                  {companyEmail && <div><strong>Email:</strong> {companyEmail}</div>}
                  {companyGstin && <div><strong>GSTIN:</strong> {companyGstin}</div>}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <h2 className="text-2xl font-black text-slate-900 tracking-wider uppercase mb-2">
                PURCHASE INVOICE
              </h2>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Invoice No: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {bill.supplierInvoiceNumber || bill.invoiceNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Date: </span>
                  <span className="font-semibold text-slate-900">
                    {formatDate(bill.date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Supplier & Invoice Information (Neatly Aligned 2-Column Layout) */}
          <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-300 text-xs">
            {/* Supplier Details */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Supplier Details
              </span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {supplierName}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed mb-2">
                {supplierAddress}
              </p>
              <div className="space-y-0.5 text-[11px] text-slate-600">
                <div><strong>Phone:</strong> {supplierPhone}</div>
                {supplierGstin && <div><strong>GSTIN:</strong> {supplierGstin}</div>}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Invoice Details
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">Supplier Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900">
                  {bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Purchase Order Number:</span>
                <span className="font-mono font-bold text-slate-900">
                  {bill.purchaseOrderNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Date:</span>
                <span className="font-semibold text-slate-900">{formatDate(bill.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Destination Warehouse:</span>
                <span className="font-semibold text-slate-900">{bill.warehouse || 'Main Warehouse'}</span>
              </div>
            </div>
          </div>

          {/* 3. Product Details Table (Clean Borders & Exact 9 Columns) */}
          <div className="py-4">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-2 text-center border-r border-slate-300 w-10">S.No</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Product Name</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-300 w-20">Quantity</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-300 w-14">Unit</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-300 w-24">Cost / Item</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-300 w-24">Total Cost</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-300 w-16">GST %</th>
                  <th className="py-2.5 px-2.5 text-right border-r border-slate-300 w-24">GST Amount</th>
                  <th className="py-2.5 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(bill.items || []).map((it, idx) => {
                  const ord = it.orderedQty !== undefined ? it.orderedQty : it.qty;
                  const recv = it.receivedQty !== undefined ? it.receivedQty : it.qty;
                  const rate = Number(it.rate) || 0;
                  const totalCost = recv * rate;
                  const taxRate = Number(it.taxRate) || 0;
                  const taxAmt = it.taxAmt !== undefined ? Number(it.taxAmt) : (totalCost * taxRate) / 100;
                  const lineTotal = it.total !== undefined ? Number(it.total) : totalCost + taxAmt;

                  return (
                    <tr key={idx} className="border-b border-slate-200 print-avoid-break">
                      <td className="py-2 px-2 text-center border-r border-slate-300 font-mono text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-900">
                        <div>{it.productName}</div>
                        {it.isUnregistered && (
                          <span className="text-[9px] text-purple-700 font-mono">PO Only Item</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-300 font-mono">
                        <span className="font-bold text-slate-900">{recv}</span>
                        {ord !== undefined && ord !== recv && (
                          <span className="text-[9px] text-slate-500 block font-mono">
                            (Ord: {ord})
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-300 text-slate-700">
                        {it.unit || 'PCS'}
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-300 font-mono text-slate-800">
                        {formatCurrency(rate)}
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-300 font-mono font-semibold text-slate-900">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-slate-300 font-mono text-slate-700">
                        {taxRate}%
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-300 font-mono text-slate-800">
                        {formatCurrency(taxAmt)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4. Payment Details & Bill Summary (Side-by-Side) */}
          <div className="grid grid-cols-2 gap-6 pt-2 items-start print-avoid-break">
            {/* Payment Details */}
            <div className="p-3.5 rounded border border-slate-300 bg-slate-50/60 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Payment Details
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-600">Payment Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] tracking-wide ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isCompleted ? 'COMPLETED' : 'PENDING'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Amount Paid:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(bill.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Balance Due:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(Math.max(0, bill.grandTotal - (bill.paidAmount || 0)))}
                  </span>
                </div>
                {isCompleted && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-600">Payment Date:</span>
                      <span className="font-mono text-slate-900">
                        {formatDate(linkedPayment?.date || bill.dueDate || bill.date)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-600">Payment Method:</span>
                      <span className="text-slate-900 font-medium">
                        {linkedPayment?.paymentMethod || 'Bank Transfer'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="p-3.5 rounded border border-slate-300 bg-slate-50/60 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Bill Summary
              </h4>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Subtotal (Before GST):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Total GST:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(bill.taxTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Additional Charges:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(bill.otherCharges || bill.freightCharges || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
                  <span className="font-black text-slate-900 text-sm uppercase">Grand Total:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    {formatCurrency(bill.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Footer – Terms & Conditions, Notes & Authorized Signatures */}
          <div className="pt-6 border-t border-slate-300 mt-6 space-y-6 print-avoid-break">
            <div className="grid grid-cols-2 gap-6 text-[10px] text-slate-600">
              <div>
                <span className="font-bold uppercase text-slate-800 block mb-1">Terms & Conditions</span>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">{companyTerms}</p>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-800 block mb-1">Notes / Remarks</span>
                <p className="whitespace-pre-line leading-relaxed text-slate-600">
                  {bill.notes || 'Goods received and accepted in store inventory with verified purchase costs and tax itemization.'}
                </p>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-6 pt-10">
              <div className="flex flex-col items-center">
                <div className="w-52 border-b border-slate-400 mb-1.5" />
                <span className="text-xs font-semibold text-slate-800">Supplier / Carrier Signature</span>
                <span className="text-[10px] text-slate-500">Authorized Delivery Representative</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-52 border-b border-slate-400 mb-1.5" />
                <span className="text-xs font-semibold text-slate-900">Authorized Signature</span>
                <span className="text-[10px] text-slate-600 font-medium">For {companyName}</span>
              </div>
            </div>

            <div className="text-center pt-3 border-t border-slate-200 text-[9px] text-slate-400">
              This is a computer-generated Purchase Invoice.
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL FOOTER (Hidden during Print)                       */}
        {/* ========================================================= */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Bill</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
