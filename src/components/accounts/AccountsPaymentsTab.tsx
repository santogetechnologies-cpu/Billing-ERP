import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PaymentRecord } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const AccountsPaymentsTab: React.FC = () => {
  const { payments = [] } = useERP();

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Received' | 'Paid'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
      if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, typeFilter, methodFilter]);

  const totalInflows = useMemo(() => {
    return payments.filter(p => p.type === 'Received').reduce((s, p) => s + (p.amount || 0), 0);
  }, [payments]);

  const totalOutflows = useMemo(() => {
    return payments.filter(p => p.type === 'Paid').reduce((s, p) => s + (p.amount || 0), 0);
  }, [payments]);

  const netCashFlow = totalInflows - totalOutflows;

  const handleExportCSV = () => {
    const data = filteredPayments.map(p => ({
      'Voucher #': p.paymentNumber || p.id.slice(0, 8),
      'Date': p.date,
      'Type': p.type,
      'Party': p.partyName,
      'Method': p.paymentMethod,
      'Account': p.account || 'Bank',
      'Reference': p.reference || '—',
      'Amount': p.amount
    }));
    exportToCSV(data, 'Payments_Cashflow_Ledger');
  };

  const columns: Column<PaymentRecord>[] = [
    {
      key: 'paymentNumber',
      header: 'Voucher #',
      render: row => (
        <span className="font-mono font-bold text-blue-600 text-xs">
          {row.paymentNumber || `V-${row.id.slice(0, 6).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-xs text-slate-700">{formatDate(row.date)}</span>
    },
    {
      key: 'type',
      header: 'Direction',
      render: row => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.type === 'Received' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {row.type === 'Received' ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-rose-600" />}
          <span>{row.type === 'Received' ? 'Inflow (Recv)' : 'Outflow (Paid)'}</span>
        </span>
      )
    },
    {
      key: 'partyName',
      header: 'Party (Customer / Supplier)',
      render: row => <span className="font-medium text-slate-900 block truncate max-w-xs">{row.partyName}</span>
    },
    {
      key: 'paymentMethod',
      header: 'Payment Mode',
      render: row => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
          {row.paymentMethod}
        </span>
      )
    },
    {
      key: 'account',
      header: 'Bank / Cash Account',
      render: row => <span className="text-xs text-slate-600">{row.account || 'Primary Bank'}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: row => (
        <span className={`font-mono font-bold tabular-nums ${row.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {row.type === 'Received' ? '+' : '-'} {formatCurrency(row.amount)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* 3 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Inflows (Collections)</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">
            +{formatCurrency(totalInflows)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Customer receivables & cash sales</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Outflows (Disbursements)</span>
          <div className="text-xl font-bold text-rose-600 mt-1 tabular-nums">
            -{formatCurrency(totalOutflows)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Supplier payments & expenses</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Net Operational Cash Flow</span>
          <div className={`text-xl font-bold mt-1 tabular-nums ${netCashFlow >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {formatCurrency(netCashFlow)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Net liquidity movement</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="ALL">All Directions (In & Out)</option>
            <option value="Received">Inflows Only (Received)</option>
            <option value="Paid">Outflows Only (Paid)</option>
          </select>

          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Card">Card</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Payments Table */}
      <DataTable
        title="Payments & Cashflow Transactions"
        subtitle={`Total ${filteredPayments.length} recorded vouchers`}
        columns={columns}
        data={filteredPayments}
        searchPlaceholder="Search voucher #, party, account, or ref..."
        searchKeys={['paymentNumber', 'partyName', 'account', 'reference']}
      />
    </div>
  );
};

