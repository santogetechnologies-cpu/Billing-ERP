import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  CreditCard,
  Truck,
  PackageCheck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PurchaseInvoice, PaymentRecord } from '../../types';
import { supplierBillService } from '../../services/supplierBillService';
import { Modal } from '../../components/common/Modal';
import { PurchaseDocumentModal } from '../../components/purchases/PurchaseDocumentModal';
import { PurchaseOrdersTab } from '../../components/purchases/PurchaseOrdersTab';
import { PurchaseGoodsReceivedTab } from '../../components/purchases/PurchaseGoodsReceivedTab';
import { PurchaseReturnsTab } from '../../components/purchases/PurchaseReturnsTab';
import { PurchasePaymentsMadeTab } from '../../components/purchases/PurchasePaymentsMadeTab';

type PurchaseBillItem = PurchaseInvoice['items'][number] & { id?: string };

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    purchaseInvoices = [],
    purchaseRequests = [],
    warehouses = [],
    company,
    payments = []
  } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'bills');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [billPaymentHistory, setBillPaymentHistory] = useState<PaymentRecord[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);

  // Document modal for creating PO or Standard Bill
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalType, setDocumentModalType] = useState<'purchase_order' | 'standard_invoice'>('standard_invoice');
  const [selectedPOForReceiving, setSelectedPOForReceiving] = useState<PurchaseInvoice | null>(null);

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Tab definitions (Part C: Purchases: Orders (PO) · Goods Received (GRN) · Bills · Returns · Payments made)
  const purchaseOrders = useMemo(() => purchaseInvoices.filter(i => i.docType === 'purchase_order'), [purchaseInvoices]);
  const standardBills = useMemo(() => purchaseInvoices.filter(i => i.docType === 'purchase_invoice' || !i.docType), [purchaseInvoices]);
  const purchaseReturnsList = useMemo(() => purchaseInvoices.filter(i => i.docType === 'purchase_return'), [purchaseInvoices]);
  const outwardPaymentsList = useMemo(() => payments.filter(p => p.type === 'Paid' || p.partyType === 'Supplier'), [payments]);

  const purchaseTabs: TabItem[] = [
    { id: 'orders', label: 'Orders (PO)', count: purchaseOrders.length, icon: Truck },
    { id: 'grn', label: 'Goods Received (GRN)', count: purchaseOrders.length, icon: PackageCheck },
    { id: 'bills', label: 'Bills', count: standardBills.length, icon: FileText },
    { id: 'returns', label: 'Returns', count: purchaseReturnsList.length, icon: RotateCcw },
    { id: 'payments', label: 'Payments made', count: outwardPaymentsList.length, icon: CreditCard }
  ];

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

  const handlePrint = () => {
    const originalTitle = document.title;
    const invNo = selectedInvoice?.supplierInvoiceNumber || selectedInvoice?.invoiceNumber || 'Bill';
    document.title = `Supplier_Invoice_${invNo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

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
      return { text: 'Pending Delivery', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    if (row.purchaseOrderNumber || row.purchaseOrderId) {
      return { text: 'Pending Delivery', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    return { text: 'Direct Receipt', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  const billColumns: Column<PurchaseInvoice>[] = [
    {
      key: 'supplierInvoiceNumber',
      header: 'Supplier Bill #',
      render: row => (
        <div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setSelectedInvoice(row);
            }}
            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
          >
            <span>{row.supplierInvoiceNumber || row.invoiceNumber}</span>
          </button>
          {row.purchaseOrderNumber && (
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              PO: {row.purchaseOrderNumber}
            </span>
          )}
        </div>
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
      key: 'date',
      header: 'Invoice Date',
      render: row => <span className="text-slate-600 text-xs whitespace-nowrap">{formatDate(row.date)}</span>
    },
    {
      key: 'grandTotal',
      header: 'Bill Amount',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(row.grandTotal)}</span>
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
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Purchases & Inward Goods
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage purchase orders, goods receipt notes (GRN), vendor bills, debit notes, and payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'orders' ? (
            <button
              onClick={() => {
                setDocumentModalType('purchase_order');
                setIsDocumentModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Purchase Order</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setDocumentModalType('standard_invoice');
                setIsDocumentModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Part C: In-Page Tabs (Orders · Goods Received · Bills · Returns · Payments made) */}
      <Tabs
        tabs={purchaseTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Orders (PO) */}
      {activeTab === 'orders' && (
        <PurchaseOrdersTab
          onNewPO={() => {
            setDocumentModalType('purchase_order');
            setIsDocumentModalOpen(true);
          }}
          onReceivePO={po => {
            setSelectedPOForReceiving(po);
            setActiveTab('grn');
            setSearchParams({ tab: 'grn' });
          }}
        />
      )}

      {/* Tab 2: Goods Received (GRN) */}
      {activeTab === 'grn' && (
        <PurchaseGoodsReceivedTab initialSelectedPO={selectedPOForReceiving} />
      )}

      {/* Tab 3: Bills (Purchase Invoices) */}
      {activeTab === 'bills' && (
        <DataTable
          title="Supplier Purchase Bills"
          subtitle={`Total ${standardBills.length} purchase invoices recorded`}
          columns={billColumns}
          data={standardBills}
          searchPlaceholder="Search bill #, supplier name, GSTIN..."
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
      )}

      {/* Tab 4: Returns (Debit Notes) */}
      {activeTab === 'returns' && <PurchaseReturnsTab />}

      {/* Tab 5: Payments made */}
      {activeTab === 'payments' && <PurchasePaymentsMadeTab />}

      {/* Document Creator Modal (5-Step Flow) */}
      <PurchaseDocumentModal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        documentType={documentModalType}
      />

      {/* Complete Supplier Invoice / Bill Details Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Supplier Bill: ${selectedInvoice.supplierInvoiceNumber || selectedInvoice.invoiceNumber}`}
          subtitle="Original supplier bill details, itemization, and payment status."
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
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'Copied' : 'Copy #'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">Supplier:</span>
                <span className="font-semibold text-slate-800">{selectedInvoice.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Date:</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedInvoice.date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Receiving:</span>
                <span className="font-semibold text-blue-700">{getReceivingBadge(selectedInvoice).text}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment:</span>
                <StatusBadge status={selectedInvoice.paymentStatus} size="sm" />
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Tax</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedInvoice.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800">{it.productName}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{it.qty} {it.unit}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(it.rate)}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(it.taxAmt || 0)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Total:</span>
                <span>{formatCurrency(selectedInvoice.taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-blue-700">{formatCurrency(selectedInvoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Paid:</span>
                <span>{formatCurrency(selectedInvoice.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Balance Due:</span>
                <span>{formatCurrency(Math.max(0, selectedInvoice.grandTotal - (selectedInvoice.paidAmount || 0)))}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
