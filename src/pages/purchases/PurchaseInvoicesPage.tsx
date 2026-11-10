import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  RotateCcw,
  FileText,
  CreditCard,
  Truck,
  Search,
  History
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
import { PurchaseOrdersPage } from './PurchaseOrdersPage';

export const PurchaseInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    purchaseInvoices = [],
    payments = [],
    customerReturns = []
  } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'bills');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [payingBill, setPayingBill] = useState<PurchaseInvoice | null>(null);
  const [billsSearch, setBillsSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All' | 'Pending' | 'Partially Paid' | 'Completed'>('All');

  // Document modal for creating PO or Standard Bill
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalType, setDocumentModalType] = useState<'purchase_order' | 'standard_invoice'>('standard_invoice');
  const [isAddReturnModalOpen, setIsAddReturnModalOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);

  // Sync ?tab= in URL (gracefully redirect legacy grn tab to orders, and history tab to dedicated history route)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'grn') {
      setActiveTab('orders');
      setSearchParams({ tab: 'orders' });
    } else if (tab === 'history') {
      navigate('/purchases/history', { replace: true });
    } else if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams, setSearchParams, navigate]);

  // Tab definitions (Purchases: Orders (PO) · Bills · Returns · Payments Made)
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
    { id: 'returns', label: 'Returns', count: customerReturns.length > 0 ? customerReturns.length : purchaseReturnsList.length, icon: RotateCcw },
    { id: 'payments', label: 'Payments Made', count: outwardPaymentsList.length, icon: CreditCard }
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
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-r from-[#f8fbff] via-[#f0f6ff] to-[#e8f1fd] dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 shadow-2xs">
        {/* Subtle curved wave pattern on the right side */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-1/2 pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <svg className="absolute right-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 100" fill="none">
            <path d="M120 0 C180 40, 160 80, 260 100 L400 100 L400 0 Z" fill="#dbeafe" fillOpacity="0.45" />
            <path d="M220 0 C260 35, 240 70, 330 100 L400 100 L400 0 Z" fill="#eff6ff" fillOpacity="0.6" />
          </svg>
        </div>

        {/* Left Column: Icon, Title & Subtitle */}
        <div className="relative z-10">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Purchases &amp; PO
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage purchase orders, vendor bills, debit notes, and payments.
          </p>
        </div>

        {/* Right Column: Clipboard Checklist & Packages Illustration + Action Button */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 relative z-10 self-start sm:self-auto">
          {/* Clipboard Checklist and Stacked Packages Illustration */}
          <div className="hidden sm:flex items-center justify-center shrink-0 -my-2 select-none pointer-events-none drop-shadow-xs" aria-hidden="true">
            <svg width="105" height="82" viewBox="0 0 110 85" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Grounding Shadow */}
              <ellipse cx="60" cy="78" rx="46" ry="4" fill="#bfdbfe" fillOpacity="0.55" />

              {/* 1. Clipboard Checklist */}
              <g id="clipboard">
                {/* Clipboard Outer Board */}
                <rect x="16" y="14" width="46" height="62" rx="6" fill="#2563eb" />
                {/* Paper Sheet */}
                <rect x="18" y="16" width="42" height="58" rx="4" fill="#ffffff" />

                {/* Top Clip Arch / Loop */}
                <path d="M34 14 C34 8 44 8 44 14" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* Top Clamp Bar */}
                <rect x="29" y="12" width="20" height="7" rx="2" fill="#1e40af" />
                <circle cx="39" cy="15.5" r="1.5" fill="#ffffff" opacity="0.9" />

                {/* Checklist Line 1 */}
                <path d="M23 27 L26.5 30.5 L33 24" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="36" y1="27" x2="53" y2="27" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

                {/* Checklist Line 2 */}
                <path d="M23 37 L26.5 40.5 L33 34" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="36" y1="37" x2="53" y2="37" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

                {/* Checklist Line 3 */}
                <path d="M23 47 L26.5 50.5 L33 44" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="36" y1="47" x2="50" y2="47" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

                {/* Checklist Line 4 */}
                <path d="M23 57 L26.5 60.5 L33 54" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="36" y1="57" x2="46" y2="57" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* 2. Stacked Packages (Kraft & Amber Boxes) */}
              {/* Top Box */}
              <g id="top-box">
                <polygon points="65,28 78,23 89,27 76,32" fill="#fde68a" />
                <polygon points="65,28 76,32 76,46 65,42" fill="#f59e0b" />
                <polygon points="76,32 89,27 89,41 76,46" fill="#d97706" />
                <line x1="71.5" y1="25.5" x2="82.5" y2="29.5" stroke="#ffffff" strokeWidth="1.8" opacity="0.9" />
                <line x1="76" y1="32" x2="76" y2="46" stroke="#b45309" strokeWidth="0.8" opacity="0.6" />
              </g>

              {/* Bottom Right Box */}
              <g id="bottom-right-box">
                <polygon points="74,46 89,41 100,46 85,51" fill="#fde68a" />
                <polygon points="74,46 85,51 85,72 74,67" fill="#f59e0b" />
                <polygon points="85,51 100,46 100,67 85,72" fill="#d97706" />
                <line x1="81.5" y1="43.5" x2="92.5" y2="48.5" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
                <line x1="85" y1="51" x2="85" y2="72" stroke="#b45309" strokeWidth="0.8" opacity="0.6" />
                {/* Barcode label */}
                <rect x="88" y="54" width="6" height="4" rx="0.5" fill="#ffffff" opacity="0.9" />
                <line x1="89" y1="56" x2="93" y2="56" stroke="#1e293b" strokeWidth="0.7" opacity="0.7" />
              </g>

              {/* Bottom Left Box */}
              <g id="bottom-left-box">
                <polygon points="49,50 62,45 74,49 61,54" fill="#fde68a" />
                <polygon points="49,50 61,54 61,74 49,70" fill="#f59e0b" />
                <polygon points="61,54 74,49 74,69 61,74" fill="#d97706" />
                <line x1="55.5" y1="47.5" x2="67.5" y2="51.5" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
                <line x1="61" y1="54" x2="61" y2="74" stroke="#b45309" strokeWidth="0.8" opacity="0.6" />
                {/* Barcode label */}
                <rect x="52" y="58" width="5.5" height="3.5" rx="0.5" fill="#ffffff" opacity="0.9" />
                <line x1="53" y1="60" x2="56.5" y2="60" stroke="#1e293b" strokeWidth="0.6" opacity="0.7" />
              </g>
            </svg>
          </div>

          {activeTab === 'orders' ? (
            <button
              onClick={() => {
                setDocumentModalType('purchase_order');
                setIsDocumentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Purchase Order</span>
            </button>
          ) : activeTab === 'bills' ? (
            <button
              onClick={() => {
                setDocumentModalType('standard_invoice');
                setIsDocumentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Purchase Bill</span>
            </button>
          ) : activeTab === 'returns' ? (
            <button
              onClick={() => setIsAddReturnModalOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Return</span>
            </button>
          ) : activeTab === 'payments' ? (
            <button
              onClick={() => setIsRecordPaymentOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record Payment</span>
            </button>
          ) : activeTab === 'history' ? (
            <button
              onClick={() => {
                setDocumentModalType('purchase_order');
                setIsDocumentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Purchase Order</span>
            </button>
          ) : null}
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

                          {/* 6. Action: Pay Button & Bill Button */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
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
      {activeTab === 'returns' && (
        <PurchaseReturnsTab
          isAddModalOpen={isAddReturnModalOpen}
          setIsAddModalOpen={setIsAddReturnModalOpen}
        />
      )}

      {/* Tab 4: Payments Made */}
      {activeTab === 'payments' && (
        <PurchasePaymentsMadeTab
          isRecordPaymentOpen={isRecordPaymentOpen}
          onCloseRecordPayment={() => setIsRecordPaymentOpen(false)}
        />
      )}

      {/* Tab 5: History (Order History) */}
      {activeTab === 'history' && (
        <PurchaseOrdersPage embedded={true} initialTabFilter="History" />
      )}

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
