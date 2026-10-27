import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  RotateCcw,
  Eye,
  Building2,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Printer,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canAccessRoute } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PurchaseInvoice, PaymentRecord } from '../../types';
import { supplierBillService } from '../../services/supplierBillService';
import { Modal } from '../../components/common/Modal';

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { purchaseInvoices, purchaseRequests = [], company } = useERP();

  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [billPaymentHistory, setBillPaymentHistory] = useState<PaymentRecord[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);

  // Helper: compute receiving status badge from linked PR or PO
  const getReceivingBadge = (row: PurchaseInvoice) => {
    const linkedPr = purchaseRequests.find(pr =>
      (row.purchaseRequestId && pr.id === row.purchaseRequestId) ||
      (row.purchaseRequestNumber && pr.requestNumber === row.purchaseRequestNumber) ||
      (row.purchaseOrderId && (pr.purchaseOrderId === row.purchaseOrderId || pr.id === row.purchaseOrderId)) ||
      (row.purchaseOrderNumber && pr.purchaseOrderNumber === row.purchaseOrderNumber)
    );

    if (linkedPr) {
      if (linkedPr.status === 'Completed') {
        return { text: 'Fully Received', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      if (linkedPr.status === 'Partially Received') {
        return { text: 'Partially Received', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      }
      const totalOrdered = (linkedPr.items || []).reduce((s, it) => s + (it.approvedQty || it.requestedQty || 0), 0);
      const totalReceived = (linkedPr.items || []).reduce((s, it) => s + (it.receivedQty || 0), 0);
      if (totalReceived >= totalOrdered && totalOrdered > 0) {
        return { text: 'Fully Received', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      if (totalReceived > 0) {
        return { text: 'Partially Received', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      }
      return { text: 'Pending Delivery', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    if (row.purchaseOrderNumber || row.purchaseOrderId) {
      return { text: 'Pending Delivery', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    return { text: 'Direct Receipt', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  // Fetch payment history when selectedInvoice changes
  useEffect(() => {
    if (!selectedInvoice?.id) {
      setBillPaymentHistory([]);
      return;
    }
    let isMounted = true;
    setIsLoadingPaymentHistory(true);
    supplierBillService.getBillPaymentHistory(selectedInvoice.id, company?.id)
      .then(history => {
        if (isMounted) setBillPaymentHistory(history);
      })
      .catch(() => {
        if (isMounted) setBillPaymentHistory([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPaymentHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedInvoice?.id, company?.id]);

  // Required 7 Columns for Purchase Manager Supplier Bills:
  // 1. Purchase Order Number, 2. Supplier Name, 3. Supplier Invoice Number, 4. Invoice Date,
  // 5. Bill Amount, 6. Receiving Status, 7. Payment Status (+ Actions managed separately)
  const columns: Column<PurchaseInvoice>[] = [
    {
      key: 'purchaseOrderNumber',
      header: 'Purchase Order #',
      render: row => (
        <span className="font-mono font-semibold text-slate-800 text-xs">
          {row.purchaseOrderNumber ? (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-bold">
              {row.purchaseOrderNumber}
            </span>
          ) : (
            <span className="text-slate-400">Direct</span>
          )}
        </span>
      )
    },
    {
      key: 'supplierName',
      header: 'Supplier Name',
      render: row => (
        <div>
          <span className="font-semibold text-slate-800 block truncate max-w-[200px]">
            {row.supplierName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            GSTIN: {row.supplierGstin || 'Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'supplierInvoiceNumber',
      header: 'Supplier Invoice #',
      render: row => (
        <div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setSelectedInvoice(row);
            }}
            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
            title="View Bill Details"
          >
            <span>{row.supplierInvoiceNumber || row.invoiceNumber}</span>
          </button>
          {row.hasDiscrepancy && (
            <span className="inline-block px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-semibold mt-0.5">
              Discrepancy
            </span>
          )}
        </div>
      )
    },
    {
      key: 'date',
      header: 'Invoice Date',
      render: row => <span className="text-slate-600 text-xs whitespace-nowrap">{formatDate(row.date)}</span>
    },
    {
      key: 'grandTotal',
      header: 'Bill Amount',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.grandTotal)}</span>
      )
    },
    {
      key: 'id',
      header: 'Receiving Status',
      align: 'center',
      render: row => {
        const badge = getReceivingBadge(row);
        return (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
            {badge.text}
          </span>
        );
      }
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      align: 'center',
      render: row => <StatusBadge status={row.paymentStatus} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Purchases & Inward Goods Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier purchase invoices, goods receipt notes (GRN), purchase orders and payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAccessRoute(profile?.role, '/purchases/returns') && (
            <button
              onClick={() => navigate('/purchases/returns')}
              className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Purchase Returns</span>
            </button>
          )}

          {hasPermission(profile?.role, 'purchases', 'create') && (
            <button
              onClick={() => navigate('/purchases/new')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Supplier Purchase Bills Table */}
      <DataTable
        title="Supplier Purchase Bills"
        subtitle={`Total ${purchaseInvoices.length} purchase invoices recorded`}
        columns={columns}
        data={purchaseInvoices}
        searchPlaceholder="Search purchase bill #, supplier name, GSTIN..."
        searchKeys={['invoiceNumber', 'supplierName', 'supplierGstin', 'paymentStatus']}
        onRowClick={row => setSelectedInvoice(row)}
        actionsWidth="80px"
        actions={row => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setSelectedInvoice(row);
              }}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="View Bill Details"
              aria-label="View Bill Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}
        filters={[
          {
            key: 'paymentStatus',
            label: 'Payment Status',
            options: [
              { label: 'Paid', value: 'Paid' },
              { label: 'Partially Paid', value: 'Partially Paid' },
              { label: 'Unpaid', value: 'Unpaid' }
            ]
          }
        ]}
      />

      {/* Bill Details Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Supplier Bill: ${selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber}`}
          subtitle={`Recorded on ${formatDate(selectedInvoice.createdAt || selectedInvoice.date)} • Supplier: ${selectedInvoice.supplierName} • Internal Ref #${selectedInvoice.invoiceNumber}`}
          size="xl"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'Copied Invoice #' : 'Copy Invoice #'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Strictly View-Only • Payments authorized by Accountant
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Status Badges Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[11px] font-bold tracking-wide">
                  {selectedInvoice.docType || 'Purchase Bill'}
                </span>
                <StatusBadge status={selectedInvoice.paymentStatus} size="sm" />
                {(() => {
                  const badge = getReceivingBadge(selectedInvoice);
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                      Receiving: {badge.text}
                    </span>
                  );
                })()}
                {selectedInvoice.verificationStatus && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedInvoice.verificationStatus === 'Approved for Payment'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedInvoice.verificationStatus === 'Correction Requested'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    Verification: {selectedInvoice.verificationStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Recorded: {formatDate(selectedInvoice.createdAt || selectedInvoice.date)}</span>
              </div>
            </div>

            {/* Discrepancy Warning Alert Banner if present */}
            {Boolean(selectedInvoice.hasDiscrepancy || selectedInvoice.discrepancyNotes) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-[11px] uppercase tracking-wide text-amber-800">
                    Discrepancy Warning Flagged Against PO
                  </h5>
                  <p className="text-[11px] mt-0.5 text-amber-800">
                    {selectedInvoice.discrepancyNotes ||
                      'Invoiced rates or quantities differ from the approved Purchase Order. This bill is queued for Accountant review.'}
                  </p>
                </div>
              </div>
            )}

            {/* Verification Alert Banner if present */}
            {selectedInvoice.verificationStatus === 'Correction Requested' && selectedInvoice.correctionNotes && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-[11px]">Accountant Correction Request</h5>
                  <p className="text-[11px] mt-0.5">{selectedInvoice.correctionNotes}</p>
                </div>
              </div>
            )}
            {selectedInvoice.verificationStatus === 'Approved for Payment' && selectedInvoice.verifiedByName && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Authorized and approved for payment release by <strong>{selectedInvoice.verifiedByName}</strong>
                  {selectedInvoice.verifiedAt ? ` on ${formatDate(selectedInvoice.verifiedAt)}` : ''}.
                </span>
              </div>
            )}

            {/* 4-Card Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Supplier Info */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  Supplier / Vendor
                </span>
                <p className="font-bold text-slate-900 text-sm truncate" title={selectedInvoice.supplierName}>
                  {selectedInvoice.supplierName}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  GSTIN: {selectedInvoice.supplierGstin || 'Unregistered'}
                </p>
                {selectedInvoice.supplierId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoice(null);
                      navigate(`/suppliers/${selectedInvoice.supplierId}`);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 mt-1 cursor-pointer"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Dates */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Dates
                </span>
                <div className="flex justify-between text-[11px] pt-0.5">
                  <span className="text-slate-500">Invoice Date:</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedInvoice.date)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Due Date:</span>
                  <span className={`font-semibold ${selectedInvoice.dueDate && new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.paymentStatus !== 'Paid' ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                    {selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : 'Immediate'}
                  </span>
                </div>
              </div>

              {/* Linked References */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  References & PO
                </span>
                <div className="flex justify-between text-[11px] pt-0.5">
                  <span className="text-slate-500">Purchase Order:</span>
                  <span className="font-mono font-semibold text-blue-600">
                    {selectedInvoice.purchaseOrderNumber || selectedInvoice.referenceNumber || 'Direct Purchase'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Supplier Inv #:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Warehouse:</span>
                  <span className="text-slate-700 font-medium truncate max-w-[110px]" title={selectedInvoice.warehouse}>
                    {selectedInvoice.warehouse || 'Main Warehouse'}
                  </span>
                </div>
              </div>

              {/* Financial Balance Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Payment Summary
                </span>
                <div className="flex justify-between text-[11px] pt-0.5">
                  <span className="text-slate-300">Bill Total:</span>
                  <span className="font-bold text-white">{formatCurrency(selectedInvoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Amount Paid:</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(selectedInvoice.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-700">
                  <span className="text-slate-300 font-medium">Balance Due:</span>
                  <span className="font-bold text-rose-400">
                    {formatCurrency(Math.max(0, (selectedInvoice.grandTotal || 0) - (selectedInvoice.paidAmount || 0)))}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>Purchased Line Items</span>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
                    {selectedInvoice.items?.length || 0}
                  </span>
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Item / Description</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      {selectedInvoice.items?.some(it => (it.discount || 0) > 0) && (
                        <th className="py-2.5 px-3 text-right">Disc</th>
                      )}
                      <th className="py-2.5 px-3 text-right">Tax Rate</th>
                      <th className="py-2.5 px-3 text-right">Tax Amt</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(!selectedInvoice.items || selectedInvoice.items.length === 0) ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                          No itemized products recorded for this bill.
                        </td>
                      </tr>
                    ) : (
                      selectedInvoice.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            {item.qty} {item.unit || 'pcs'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {formatCurrency(item.rate)}
                          </td>
                          {selectedInvoice.items?.some(it => (it.discount || 0) > 0) && (
                            <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                              {item.discount ? formatCurrency(item.discount) : '—'}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {item.taxRate}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {formatCurrency(item.taxAmt || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals Calculation Box */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              {/* Notes / Terms */}
              <div className="w-full sm:w-1/2">
                {selectedInvoice.notes ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Invoice Notes & Remarks
                    </span>
                    <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                      {selectedInvoice.notes}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No special instructions or remarks noted on this purchase invoice.
                  </div>
                )}
              </div>

              {/* Amounts Breakdown */}
              <div className="w-full sm:w-1/2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Subtotal (Taxable Value):</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatCurrency(selectedInvoice.subtotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Tax Total (GST):</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatCurrency(selectedInvoice.taxTotal || 0)}
                  </span>
                </div>
                {(selectedInvoice.freightCharges || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Freight & Shipping:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatCurrency(selectedInvoice.freightCharges)}
                    </span>
                  </div>
                )}
                {(selectedInvoice.otherCharges || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Other Charges:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatCurrency(selectedInvoice.otherCharges)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-blue-600 font-mono text-base">
                    {formatCurrency(selectedInvoice.grandTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-emerald-700 pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-rose-600 pt-1 border-t border-slate-200">
                  <span>Balance Outstanding:</span>
                  <span className="font-mono">
                    {formatCurrency(Math.max(0, (selectedInvoice.grandTotal || 0) - (selectedInvoice.paidAmount || 0)))}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History Section (View Only for Purchase Manager) */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Payment History & Disbursements</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
                    {billPaymentHistory.length}
                  </span>
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">
                  Authorized & recorded by Accountant
                </span>
              </div>

              {isLoadingPaymentHistory ? (
                <div className="py-4 text-center text-slate-400 text-xs">
                  Loading payment history...
                </div>
              ) : billPaymentHistory.length === 0 ? (
                <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs flex items-center justify-between">
                  <span>No payment disbursements recorded yet. This bill is in the Accountant review queue.</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {selectedInvoice.paymentStatus || 'Unpaid'}
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Receipt / Pay #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Account / Ref</th>
                        <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {billPaymentHistory.map((pmt, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">
                            {pmt.paymentNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {formatDate(pmt.date)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-medium">
                            {pmt.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {pmt.reference || pmt.account || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                            {formatCurrency(pmt.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PurchaseInvoicesPage;
