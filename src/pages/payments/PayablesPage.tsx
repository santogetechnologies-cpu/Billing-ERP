import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CreditCard,
  Building2,
  CheckCircle,
  FileText,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Supplier, PurchaseInvoice } from '../../types';

export const PayablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, purchaseInvoices } = useERP();

  const [activeView, setActiveView] = useState<'supplier' | 'invoice'>('supplier');

  // Unpaid or partially paid purchase invoices
  const unpaidPurchases = useMemo(() => {
    return purchaseInvoices.filter(inv => inv.paymentStatus !== 'Paid');
  }, [purchaseInvoices]);

  const totalPayables = suppliers.reduce((acc, s) => acc + s.currentOutstanding, 0);

  // Aging Buckets based on real purchase invoice due dates
  const agingBuckets = useMemo(() => {
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
    const today = new Date().getTime();
    unpaidPurchases.forEach(inv => {
      const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
      const dueDate = new Date(inv.dueDate || inv.date).getTime();
      const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) buckets.current += balance;
      else if (diffDays <= 30) buckets.days1_30 += balance;
      else if (diffDays <= 60) buckets.days31_60 += balance;
      else if (diffDays <= 90) buckets.days61_90 += balance;
      else buckets.days90Plus += balance;
    });
    return buckets;
  }, [unpaidPurchases]);

  const supplierColumns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-[220px]">
            {row.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {row.company} • {row.phone}
          </span>
        </div>
      )
    },
    {
      key: 'creditDays',
      header: 'Credit Terms',
      align: 'center',
      render: row => (
        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
          {row.creditDays} Days
        </span>
      )
    },
    {
      key: 'bankDetails',
      header: 'Bank Details',
      render: row => (
        <span className="text-xs text-slate-600 font-mono">
          {row.bankDetails?.bankName ? `${row.bankDetails.bankName} (${row.bankDetails.accountNumber.slice(-4)})` : 'N/A'}
        </span>
      )
    },
    {
      key: 'currentOutstanding',
      header: 'Total Payable',
      align: 'right',
      render: row => (
        <span className="font-bold text-rose-600">
          {formatCurrency(row.currentOutstanding)}
        </span>
      )
    }
  ];

  const purchaseColumns: Column<PurchaseInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Bill / Inv #',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.invoiceNumber}</span>
      )
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      render: row => <span className="font-semibold text-slate-900">{row.supplierName}</span>
    },
    {
      key: 'date',
      header: 'Bill Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: row => (
        <span className="text-rose-600 font-semibold">{formatDate(row.dueDate || row.date)}</span>
      )
    },
    {
      key: 'grandTotal',
      header: 'Bill Total',
      align: 'right',
      render: row => formatCurrency(row.grandTotal)
    },
    {
      key: 'balanceDue',
      header: 'Amount Payable',
      align: 'right',
      render: row => (
        <span className="font-bold text-rose-600">
          {formatCurrency(row.grandTotal - (row.paidAmount || 0))}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Accounts Payable (AP) & Vendor Aging
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor supplier bills, payment due cycles, credit terms compliance, and outgoing cash commitments.
          </p>
        </div>

        <button
          onClick={() => navigate('/payments')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Make Payment</span>
        </button>
      </div>

      {/* 5 Aging Buckets (Prompt #27) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">
            Current (Within Terms)
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.current)}
          </span>
          <span className="text-[10px] text-slate-400">Regular term bills</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-600 block">
            1 – 30 Days Due
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days1_30)}
          </span>
          <span className="text-[10px] text-slate-400">Approaching schedule</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">
            31 – 60 Days Overdue
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days31_60)}
          </span>
          <span className="text-[10px] text-slate-400">Priority settlement</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-600 block">
            61 – 90 Days Overdue
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days61_90)}
          </span>
          <span className="text-[10px] text-slate-400">Vendor hold risk</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-700 block">
            90+ Days Critical
          </span>
          <span className="text-lg font-black text-rose-700 block">
            {formatCurrency(agingBuckets.days90Plus)}
          </span>
          <span className="text-[10px] text-slate-400">Urgent clearance needed</span>
        </div>
      </div>

      {/* View Switcher: Supplier-Wise vs Invoice-Wise */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveView('supplier')}
          className={`py-2 px-3 text-xs font-bold border-b-2 ${
            activeView === 'supplier'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Supplier-Wise Payables
        </button>

        <button
          onClick={() => setActiveView('invoice')}
          className={`py-2 px-3 text-xs font-bold border-b-2 ${
            activeView === 'invoice'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bill-Wise Outstanding
        </button>
      </div>

      {activeView === 'supplier' ? (
        <DataTable
          title="Supplier Payables Register"
          columns={supplierColumns}
          data={suppliers.filter(s => s.currentOutstanding > 0)}
          searchPlaceholder="Search supplier..."
          searchKeys={['name', 'company', 'phone']}
          actions={row => (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => navigate('/payments')}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold flex items-center gap-1"
              >
                <ArrowUpRight className="w-3 h-3" /> Pay Now
              </button>
            </div>
          )}
        />
      ) : (
        <DataTable
          title="Unsettled Purchase Bills Ledger"
          columns={purchaseColumns}
          data={unpaidPurchases}
          searchPlaceholder="Search bill #, supplier..."
          searchKeys={['invoiceNumber', 'supplierName']}
          actions={row => (
            <button
              onClick={() => navigate('/payments')}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold"
            >
              Clear Bill
            </button>
          )}
        />
      )}
    </div>
  );
};
