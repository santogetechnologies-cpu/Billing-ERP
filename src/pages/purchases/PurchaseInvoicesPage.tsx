import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  RotateCcw,
  FileText,
  CreditCard,
  Truck,
  Search
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { formatDate } from '../../utils/formatters';
import { PurchaseInvoice } from '../../types';
import { PurchaseDocumentModal } from '../../components/purchases/PurchaseDocumentModal';
import { PurchaseOrdersTab } from '../../components/purchases/PurchaseOrdersTab';
import { PurchaseReturnsTab } from '../../components/purchases/PurchaseReturnsTab';
import { PurchasePaymentsMadeTab } from '../../components/purchases/PurchasePaymentsMadeTab';
import { SupplierBillInvoiceModal } from '../../components/purchases/SupplierBillInvoiceModal';
import { PaySupplierBillModal } from '../../components/purchases/PaySupplierBillModal';

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    purchaseInvoices = [],
    payments = []
  } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'bills');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [payingBill, setPayingBill] = useState<PurchaseInvoice | null>(null);
  const [billsSearch, setBillsSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All' | 'Pending' | 'Partially Paid' | 'Completed'>('All');

  // Document modal for creating PO or Standard Bill
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalType, setDocumentModalType] = useState<'purchase_order' | 'standard_invoice'>('standard_invoice');

  // Sync ?tab= in URL (gracefully redirect legacy grn tab to orders)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'grn') {
      setActiveTab('orders');
      setSearchParams({ tab: 'orders' });
    } else if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams, setSearchParams]);

  // Tab definitions (Purchases: Orders (PO) · Bills · Returns · Payments made)
  const purchaseOrders = useMemo(() => purchaseInvoices.filter(i => i.docType === 'purchase_order'), [purchaseInvoices]);
  const standardBills = useMemo(
    () =>
      purchaseInvoices.filter(
        i =>
          (i.docType === 'purchase_invoice' || !i.docType) &&
          (!i.purchaseOrderId || i.billStatus === 'Complete')
      ),
    [purchaseInvoices]
  );
  const purchaseReturnsList = useMemo(() => purchaseInvoices.filter(i => i.docType === 'purchase_return'), [purchaseInvoices]);
  const outwardPaymentsList = useMemo(() => payments.filter(p => p.type === 'Paid' || p.partyType === 'Supplier'), [payments]);

  const purchaseTabs: TabItem[] = [
    { id: 'orders', label: 'Orders (PO)', count: purchaseOrders.length, icon: Truck },
    { id: 'bills', label: 'Bills', count: standardBills.length, icon: FileText },
    { id: 'returns', label: 'Returns', count: purchaseReturnsList.length, icon: RotateCcw },
    { id: 'payments', label: 'Payments made', count: outwardPaymentsList.length, icon: CreditCard }
  ];

  // Filtered bills for Tab 2: Bills (Search + Payment Status)
  const filteredBills = useMemo(() => {
    return standardBills.filter(bill => {
      const s = billsSearch.toLowerCase();
      const matchesSearch =
        !billsSearch ||
        bill.supplierName.toLowerCase().includes(s) ||
        (bill.purchaseOrderNumber && bill.purchaseOrderNumber.toLowerCase().includes(s)) ||
        (bill.supplierInvoiceNumber && bill.supplierInvoiceNumber.toLowerCase().includes(s)) ||
        bill.invoiceNumber.toLowerCase().includes(s);

      const isCompleted = bill.paymentStatus === 'Paid' || (Number(bill.paidAmount) >= Number(bill.grandTotal) && Number(bill.grandTotal) > 0);
      const isPartial = !isCompleted && (bill.paymentStatus === 'Partially Paid' || Number(bill.paidAmount) > 0);
      const isPending = !isCompleted && !isPartial;

      const matchesStatus =
        paymentStatusFilter === 'All' ||
        (paymentStatusFilter === 'Completed' && isCompleted) ||
        (paymentStatusFilter === 'Partially Paid' && isPartial) ||
        (paymentStatusFilter === 'Pending' && isPending);

      return matchesSearch && matchesStatus;
    });
  }, [standardBills, billsSearch, paymentStatusFilter]);

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Purchases & PO
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage purchase orders, vendor bills, debit notes, and payments.
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

      {/* Tabs (Orders · Bills · Returns · Payments made) */}
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
        />
      )}

      {/* Tab 2: Bills (Purchase Invoices) */}
      {activeTab === 'bills' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Search Bar & Payment Status Filter Pills */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search bills by supplier or PO #..."
                value={billsSearch}
                onChange={e => setBillsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(['All', 'Pending', 'Partially Paid', 'Completed'] as const).map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setPaymentStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    paymentStatusFilter === status
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Bills Table - Strictly 6 Columns matching Orders (PO) Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Supplier / PO Number</th>
                    <th className="px-4 py-3">Bill Date</th>
                    <th className="px-4 py-3">Destination Store</th>
                    <th className="px-4 py-3">Items Count</th>
                    <th className="px-4 py-3">Payment Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No purchase bills found.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(bill => {
                      const isCompleted = bill.paymentStatus === 'Paid' || (Number(bill.paidAmount) >= Number(bill.grandTotal) && Number(bill.grandTotal) > 0);
                      const isPartial = !isCompleted && (bill.paymentStatus === 'Partially Paid' || Number(bill.paidAmount) > 0);
                      const itemsCount = bill.items?.length || 0;
                      const poDisplay = bill.purchaseOrderNumber || bill.invoiceNumber;

                      return (
                        <tr
                          key={bill.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* 1. Supplier / PO Number: Supplier Name bold on top, PO Number in small purple text underneath */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {bill.supplierName}
                            </div>
                            <div className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                              {poDisplay}
                            </div>
                          </td>

                          {/* 2. Bill Date */}
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {formatDate(bill.date)}
                          </td>

                          {/* 3. Destination Store */}
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200 text-xs">
                            {bill.warehouse || 'Main Warehouse'}
                          </td>

                          {/* 4. Items Count */}
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">
                            {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                          </td>

                          {/* 5. Payment Status */}
                          <td className="px-4 py-3">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>COMPLETED</span>
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span>PARTIALLY PAID</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>PENDING</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Action: Bill Button & Pay Button */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Bill Button - Opens professional invoice modal */}
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(bill)}
                                title="View Professional Bill"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold text-xs transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Bill</span>
                              </button>

                              {/* Pay Button - Opens payment form (Hidden once fully COMPLETED) */}
                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => setPayingBill(bill)}
                                  title="Pay Supplier Bill"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
      <SupplierBillInvoiceModal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        bill={selectedInvoice}
      />

      {/* Pay Supplier Bill Modal */}
      <PaySupplierBillModal
        isOpen={Boolean(payingBill)}
        onClose={() => setPayingBill(null)}
        bill={payingBill}
      />
    </div>
  );
};
