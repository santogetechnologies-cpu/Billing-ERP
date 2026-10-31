import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Plus,
  Printer,
  Eye,
  CheckCircle,
  AlertCircle,
  Download,
  Calendar,
  RotateCcw,
  Zap,
  ShoppingCart,
  User,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column, DataTableRef } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { SalesInvoice } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { SalesDocumentModal } from '../../components/sales/SalesDocumentModal';
import { SalesQuotationsTab } from '../../components/sales/SalesQuotationsTab';
import { SalesOrdersTab } from '../../components/sales/SalesOrdersTab';
import { SalesReturnsTab } from '../../components/sales/SalesReturnsTab';
import { SalesPaymentsReceivedTab } from '../../components/sales/SalesPaymentsReceivedTab';

export const SalesInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { salesInvoices, company } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'invoices');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<SalesInvoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Document Modal (5-Step Universal Creator)
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalType, setDocumentModalType] = useState<'tax_invoice' | 'quotation' | 'sales_order'>('tax_invoice');

  const tableRef = useRef<DataTableRef | null>(null);

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Tab Definitions (Part C: Sales: Invoices · Quotations · Orders · Returns · Payments received)
  const salesTabs: TabItem[] = [
    { id: 'invoices', label: 'Invoices', count: salesInvoices.filter(i => i.docType === 'tax_invoice').length, icon: FileText },
    { id: 'quotations', label: 'Quotations', count: salesInvoices.filter(i => i.docType === 'quotation').length, icon: FileText },
    { id: 'orders', label: 'Orders', count: salesInvoices.filter(i => i.docType === 'sales_order').length, icon: ShoppingCart },
    { id: 'returns', label: 'Returns', count: salesInvoices.filter(i => i.docType === 'credit_note').length, icon: RotateCcw },
    { id: 'payments', label: 'Payments Received', icon: CreditCard }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const handleOpenCreateModal = () => {
    if (activeTab === 'quotations') {
      setDocumentModalType('quotation');
    } else if (activeTab === 'orders') {
      setDocumentModalType('sales_order');
    } else {
      setDocumentModalType('tax_invoice');
    }
    setIsDocumentModalOpen(true);
  };

  // Invoices list (filtered to tax invoices & bills)
  const invoiceRecords = useMemo(() => {
    return salesInvoices.filter(inv => inv.docType !== 'quotation' && inv.docType !== 'sales_order');
  }, [salesInvoices]);

  const columns: Column<SalesInvoice>[] = [
    {
      header: 'Invoice #',
      accessor: 'invoiceNumber',
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
          {inv.invoiceNumber}
        </span>
      )
    },
    {
      header: 'Customer',
      accessor: 'customerName',
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">{inv.customerName}</p>
          {inv.customerPhone && (
            <p className="text-[10px] text-slate-400">{inv.customerPhone}</p>
          )}
        </div>
      )
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          {formatDate(inv.date)}
        </span>
      )
    },
    {
      header: 'Items',
      accessor: (inv: SalesInvoice) => inv.items?.length || 0,
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {inv.items?.length || 0} lines
        </span>
      )
    },
    {
      header: 'Grand Total',
      accessor: 'grandTotal',
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          {formatCurrency(inv.grandTotal)}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'paymentStatus',
      sortable: true,
      cell: (inv: SalesInvoice) => <StatusBadge status={inv.paymentStatus} />
    },
    {
      header: 'Payment Method',
      accessor: 'paymentMethod',
      sortable: true,
      cell: (inv: SalesInvoice) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {inv.paymentMethod || 'Cash'}
        </span>
      )
    },
    {
      header: 'Actions',
      cell: (inv: SalesInvoice) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedInvoiceForPrint(inv);
              setIsPrintModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Print Invoice"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const primaryButtonLabel =
    activeTab === 'quotations'
      ? '+ New Quotation'
      : activeTab === 'orders'
      ? '+ New Sales Order'
      : activeTab === 'returns'
      ? 'Billing (POS)'
      : '+ New Invoice';

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header: Title & ONE Primary Action Button (Part B1 & B2) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Sales</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Invoices, quotations, sales orders, returns, and customer payment receipts.
          </p>
        </div>

        {/* ONE Primary Button per page (Part B1) */}
        {activeTab !== 'payments' && (
          <button
            type="button"
            onClick={activeTab === 'returns' ? () => navigate('/sales/pos') : handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{primaryButtonLabel}</span>
          </button>
        )}
      </div>

      {/* In-Page Tabs (Part C) */}
      <Tabs
        tabs={salesTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        syncWithUrlQuery="tab"
      />

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
          <DataTable
            ref={tableRef}
            data={invoiceRecords}
            columns={columns}
            searchable
            searchPlaceholder="Search invoices by #, customer, or phone..."
            filterOptions={[
              {
                key: 'paymentStatus',
                label: 'Payment Status',
                options: [
                  { label: 'Paid', value: 'Paid' },
                  { label: 'Unpaid', value: 'Unpaid' },
                  { label: 'Partially Paid', value: 'Partially Paid' }
                ]
              },
              {
                key: 'paymentMethod',
                label: 'Method',
                options: [
                  { label: 'Cash', value: 'Cash' },
                  { label: 'UPI', value: 'UPI' },
                  { label: 'Card', value: 'Card' }
                ]
              }
            ]}
          />
        </div>
      )}

      {/* Tab 2: Quotations */}
      {activeTab === 'quotations' && (
        <SalesQuotationsTab onNewQuotation={handleOpenCreateModal} />
      )}

      {/* Tab 3: Orders */}
      {activeTab === 'orders' && (
        <SalesOrdersTab onNewOrder={handleOpenCreateModal} />
      )}

      {/* Tab 4: Returns */}
      {activeTab === 'returns' && <SalesReturnsTab />}

      {/* Tab 5: Payments Received */}
      {activeTab === 'payments' && <SalesPaymentsReceivedTab />}

      {/* Universal 5-Step Sales Document Modal */}
      <SalesDocumentModal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        documentType={documentModalType}
        onSaved={invoice => {
          setSelectedInvoiceForPrint(invoice);
          setIsPrintModalOpen(true);
        }}
      />

      {/* Invoice Print Modal */}
      {selectedInvoiceForPrint && (
        <InvoicePrintModal
          isOpen={isPrintModalOpen}
          invoice={selectedInvoiceForPrint}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedInvoiceForPrint(null);
          }}
        />
      )}
    </div>
  );
};
