import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  AlertTriangle,
  CreditCard,
  Bell,
  CheckCircle,
  FileText,
  Mail,
  Send
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Customer, SalesInvoice } from '../../types';

export const ReceivablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, salesInvoices } = useERP();

  const [activeView, setActiveView] = useState<'customer' | 'invoice'>('customer');
  const [reminderSent, setReminderSent] = useState<string | null>(null);

  // Unpaid invoices
  const unpaidInvoices = useMemo(() => {
    return salesInvoices.filter(inv => inv.paymentStatus !== 'Paid');
  }, [salesInvoices]);

  const totalReceivables = customers.reduce((acc, c) => acc + c.currentOutstanding, 0);

  // Aging Buckets based on real customer sales invoice due dates
  const agingBuckets = useMemo(() => {
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
    const today = new Date().getTime();
    unpaidInvoices.forEach(inv => {
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
  }, [unpaidInvoices]);

  const handleSendReminder = (name: string) => {
    setReminderSent(name);
    setTimeout(() => setReminderSent(null), 3000);
  };

  const customerColumns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-[220px]">
            {row.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {row.phone} • {row.type}
          </span>
        </div>
      )
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      align: 'right',
      render: row => formatCurrency(row.creditLimit)
    },
    {
      key: 'creditDays',
      header: 'Credit Days',
      align: 'center',
      render: row => `${row.creditDays} Days`
    },
    {
      key: 'currentOutstanding',
      header: 'Total Outstanding',
      align: 'right',
      render: row => (
        <span
          className={`font-black ${
            row.currentOutstanding > row.creditLimit && row.creditLimit > 0
              ? 'text-rose-600'
              : 'text-amber-600'
          }`}
        >
          {formatCurrency(row.currentOutstanding)}
        </span>
      )
    }
  ];

  const invoiceColumns: Column<SalesInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.invoiceNumber}</span>
      )
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: row => <span className="font-semibold text-slate-900">{row.customerName}</span>
    },
    {
      key: 'date',
      header: 'Invoice Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: row => (
        <span className="text-rose-600 font-semibold">{formatDate(row.dueDate)}</span>
      )
    },
    {
      key: 'grandTotal',
      header: 'Invoice Total',
      align: 'right',
      render: row => formatCurrency(row.grandTotal)
    },
    {
      key: 'balanceDue',
      header: 'Unpaid Balance',
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
            <Clock className="w-5 h-5 text-purple-600" />
            Accounts Receivable (AR) & Aging Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track customer outstanding, collection aging cycles, payment reminders and overdue invoices.
          </p>
        </div>

        <button
          onClick={() => navigate('/payments')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Record Receipt</span>
        </button>
      </div>

      {reminderSent && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Automated payment reminder SMS & WhatsApp dispatched to {reminderSent}!</span>
        </div>
      )}

      {/* 5 Aging Buckets (Prompt #26) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">
            Current (Within Terms)
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.current)}
          </span>
          <span className="text-[10px] text-slate-400">Not overdue</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-600 block">
            1 – 30 Days Overdue
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days1_30)}
          </span>
          <span className="text-[10px] text-slate-400">Grace period</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">
            31 – 60 Days Overdue
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days31_60)}
          </span>
          <span className="text-[10px] text-slate-400">Reminder sent</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-600 block">
            61 – 90 Days Overdue
          </span>
          <span className="text-lg font-black text-slate-900 block">
            {formatCurrency(agingBuckets.days61_90)}
          </span>
          <span className="text-[10px] text-slate-400">Strict follow-up</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-700 block">
            90+ Days Critical
          </span>
          <span className="text-lg font-black text-rose-700 block">
            {formatCurrency(agingBuckets.days90Plus)}
          </span>
          <span className="text-[10px] text-slate-400">Account on hold</span>
        </div>
      </div>

      {/* View Switcher: Customer-Wise vs Invoice-Wise */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveView('customer')}
          className={`py-2 px-3 text-xs font-bold border-b-2 ${
            activeView === 'customer'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Customer-Wise Receivables
        </button>

        <button
          onClick={() => setActiveView('invoice')}
          className={`py-2 px-3 text-xs font-bold border-b-2 ${
            activeView === 'invoice'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoice-Wise Outstanding
        </button>
      </div>

      {activeView === 'customer' ? (
        <DataTable
          title="Customer Outstanding Register"
          columns={customerColumns}
          data={customers.filter(c => c.currentOutstanding > 0)}
          searchPlaceholder="Search customer..."
          searchKeys={['name', 'phone']}
          actions={row => (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => handleSendReminder(row.name)}
                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Reminder
              </button>
              <button
                onClick={() => navigate('/payments')}
                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold"
              >
                Receive
              </button>
            </div>
          )}
        />
      ) : (
        <DataTable
          title="Unsettled Invoices Ledger"
          columns={invoiceColumns}
          data={unpaidInvoices}
          searchPlaceholder="Search invoice #, customer..."
          searchKeys={['invoiceNumber', 'customerName']}
        />
      )}
    </div>
  );
};
