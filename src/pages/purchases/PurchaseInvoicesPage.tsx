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
import { supabase } from '../../lib/supabase';

type PurchaseBillItem = PurchaseInvoice['items'][number] & { id?: string };

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { purchaseInvoices, purchaseRequests = [], warehouses = [], company } = useERP();

  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [billPaymentHistory, setBillPaymentHistory] = useState<PaymentRecord[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);
  const [billItems, setBillItems] = useState<PurchaseBillItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

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

  // Ensure line items for selectedInvoice are loaded (fallback to direct purchase_items query for old records)
  useEffect(() => {
    if (!selectedInvoice?.id) {
      setBillItems([]);
      return;
    }

    if (selectedInvoice.items && selectedInvoice.items.length > 0) {
      setBillItems(selectedInvoice.items);
      return;
    }

    let isMounted = true;
    setIsLoadingItems(true);

    const loadItems = async () => {
      try {
        const { data, error } = await supabase
          .from('purchase_items')
          .select('*')
          .eq('purchase_id', selectedInvoice.id);

        if (!isMounted) return;
        if (error) {
          console.warn('Error fetching purchase items:', error.message);
          setBillItems([]);
        } else if (data && data.length > 0) {
          setBillItems(
            data.map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              productName: item.product_name,
              qty: Number(item.qty),
              unit: item.unit || 'Piece',
              rate: Number(item.rate),
              discount: Number(item.discount || 0),
              taxRate: Number(item.tax_rate),
              taxAmt: Number(item.tax_amt),
              total: Number(item.total)
            }))
          );
        } else {
          setBillItems([]);
        }
      } catch (err) {
        if (isMounted) setBillItems([]);
      } finally {
        if (isMounted) setIsLoadingItems(false);
      }
    };

    loadItems();

    return () => {
      isMounted = false;
    };
  }, [selectedInvoice]);

  // Resolved values for selected invoice
  const resolvedWarehouseName = selectedInvoice
    ? warehouses.find(w => w.id === selectedInvoice.warehouse || w.code === selectedInvoice.warehouse)?.name ||
      selectedInvoice.warehouse ||
      'Main Warehouse'
    : 'Main Warehouse';

  const companyGstin = (company?.gstin || '').trim().toUpperCase();
  const supplierGstin = (selectedInvoice?.supplierGstin || '').trim().toUpperCase();
  const isInterState = Boolean(
    companyGstin.length >= 2 &&
    supplierGstin.length >= 2 &&
    companyGstin.slice(0, 2) !== supplierGstin.slice(0, 2)
  );

  const taxTotal = selectedInvoice?.taxTotal || 0;
  const cgst = isInterState ? 0 : taxTotal / 2;
  const sgst = isInterState ? 0 : taxTotal / 2;
  const igst = isInterState ? taxTotal : 0;
  const grandTotal = selectedInvoice?.grandTotal || 0;
  const paidAmount = selectedInvoice?.paidAmount || 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  const handlePrint = () => {
    const originalTitle = document.title;
    const invNo = selectedInvoice?.supplierInvoiceNumber || selectedInvoice?.invoiceNumber || 'Bill';
    document.title = `Supplier_Invoice_${invNo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

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

      {/* Complete Supplier Invoice / Bill Details Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Supplier Bill: ${selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber}`}
          subtitle={`Original supplier bill details, tax breakdown, and itemized fulfillment.`}
          size="2xl"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2.5 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const invNo = selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber;
                    navigator.clipboard.writeText(invNo);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy Supplier Invoice Number"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'Copied Invoice #' : 'Copy Invoice #'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print Supplier Bill"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
                  Strictly View-Only • Payments authorized by Accountant
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          {/* Print Style Injections */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #supplier-invoice-print-area, #supplier-invoice-print-area * {
                visibility: visible !important;
              }
              #supplier-invoice-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 16px !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div id="supplier-invoice-print-area" className="space-y-4 text-xs">
            {/* Invoice Header Section */}
            <div className="bg-slate-50/90 p-4.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200/90">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                      Supplier Tax Invoice
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-500">
                      Internal Reference: <strong className="text-slate-800 font-semibold">#{selectedInvoice.invoiceNumber}</strong>
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mt-1.5">
                    {selectedInvoice.supplierName}
                  </h3>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    GSTIN: <span className="font-semibold text-slate-900">{selectedInvoice.supplierGstin || 'Unregistered'}</span>
                  </p>
                  {selectedInvoice.supplierId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoice(null);
                        navigate(`/suppliers/${selectedInvoice.supplierId}`);
                      }}
                      className="no-print text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <span>View Supplier Profile</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Supplier Bill Number
                  </span>
                  <p className="font-mono text-lg sm:text-xl font-black text-blue-700 tracking-tight">
                    {selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                    <p>
                      Invoice Date: <strong className="text-slate-800 font-semibold">{formatDate(selectedInvoice.date)}</strong>
                    </p>
                    <p>
                      Due Date:{' '}
                      <strong
                        className={`font-semibold ${
                          selectedInvoice.dueDate &&
                          new Date(selectedInvoice.dueDate) < new Date() &&
                          selectedInvoice.paymentStatus !== 'Paid'
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-800'
                        }`}
                      >
                        {selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : 'Immediate'}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* 4-Column Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Linked Purchase Order
                  </span>
                  <p className="font-mono font-bold text-blue-600 mt-0.5 truncate">
                    {selectedInvoice.purchaseOrderNumber || selectedInvoice.referenceNumber || 'Direct Purchase'}
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Destination Warehouse
                  </span>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate" title={resolvedWarehouseName}>
                    {resolvedWarehouseName}
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Receiving Status
                  </span>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        getReceivingBadge(selectedInvoice).bg
                      }`}
                    >
                      {getReceivingBadge(selectedInvoice).text}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Payment Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={selectedInvoice.paymentStatus} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancy Alert Banner if present */}
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

            {/* Purchased Products Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>Purchased Products</span>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
                    {billItems.length}
                  </span>
                </h4>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Product Name / Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      {billItems.some(it => (it.discount || 0) > 0) && (
                        <th className="py-2.5 px-3 text-right">Discount</th>
                      )}
                      <th className="py-2.5 px-3 text-right">Tax Rate (GST %)</th>
                      <th className="py-2.5 px-3 text-right">Tax Amount</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {isLoadingItems ? (
                      <tr>
                        <td
                          colSpan={billItems.some(it => (it.discount || 0) > 0) ? 9 : 8}
                          className="py-6 text-center text-slate-400 text-xs"
                        >
                          Loading bill products...
                        </td>
                      </tr>
                    ) : billItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                          No itemized products recorded for this bill.
                        </td>
                      </tr>
                    ) : (
                      billItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-800 font-mono">
                            {item.qty}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                            {item.unit || 'Piece'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                            {formatCurrency(item.rate)}
                          </td>
                          {billItems.some(it => (it.discount || 0) > 0) && (
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

            {/* Financial Totals & Additional Information */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              {/* Additional Information (Notes & Verification Status) */}
              <div className="w-full sm:w-1/2 space-y-3">
                {selectedInvoice.notes ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Invoice Notes and Remarks
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

                {/* Verification Status Card */}
                {selectedInvoice.verificationStatus && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Verification Status
                    </span>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          selectedInvoice.verificationStatus === 'Approved for Payment'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : selectedInvoice.verificationStatus === 'Correction Requested'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {selectedInvoice.verificationStatus}
                      </span>
                      {selectedInvoice.verifiedByName && (
                        <span className="text-[11px] text-slate-600">
                          by <strong>{selectedInvoice.verifiedByName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bill Summary (Subtotal, CGST/SGST/IGST, Freight, Grand Total, Paid, Balance Due) */}
              <div className="w-full sm:w-1/2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Subtotal / Taxable Value:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatCurrency(selectedInvoice.subtotal || 0)}
                  </span>
                </div>

                {/* CGST / SGST / IGST according to GST rule */}
                {isInterState ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">IGST (Integrated Tax):</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatCurrency(igst)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">CGST (Central Tax):</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatCurrency(cgst)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">SGST (State Tax):</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatCurrency(sgst)}
                      </span>
                    </div>
                  </>
                )}

                {(selectedInvoice.freightCharges || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Freight & Shipping Charges:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatCurrency(selectedInvoice.freightCharges)}
                    </span>
                  </div>
                )}

                {(selectedInvoice.otherCharges || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Other Existing Charges:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formatCurrency(selectedInvoice.otherCharges)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold pt-2.5 border-t border-slate-200 text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-blue-600 font-mono text-base">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>

                <div className="flex justify-between text-xs font-semibold text-emerald-700 pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-mono">{formatCurrency(paidAmount)}</span>
                </div>

                <div className="flex justify-between text-xs font-bold text-rose-600 pt-1 border-t border-slate-200">
                  <span>Balance Due:</span>
                  <span className="font-mono">
                    {formatCurrency(balanceDue)}
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
