import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface DayBookEntry {
  id: string;
  time: string;
  type: 'Sale' | 'Purchase' | 'Receipt' | 'Payment' | 'Expense';
  refNumber: string;
  partyName: string;
  account: string;
  debit: number;
  credit: number;
  notes: string;
}

export const AccountsDayBookTab: React.FC = () => {
  const { salesInvoices = [], purchaseInvoices = [], expenses = [], payments = [] } = useERP();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Merge today's financial entries into chronological journal
  const dayEntries: DayBookEntry[] = useMemo(() => {
    const list: DayBookEntry[] = [];

    // Sales
    salesInvoices.forEach(s => {
      const sDate = (s.date || s.createdAt || '').split('T')[0];
      if (sDate === selectedDate) {
        list.push({
          id: `sale-${s.id}`,
          time: s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
          type: 'Sale',
          refNumber: s.invoiceNumber,
          partyName: s.customerName || 'Counter Sale',
          account: s.paymentMethod || 'Cash',
          debit: s.paidAmount || 0,
          credit: s.grandTotal,
          notes: `Sales Invoice (${s.paymentStatus})`
        });
      }
    });

    // Purchases
    purchaseInvoices.forEach(p => {
      const pDate = (p.date || p.createdAt || '').split('T')[0];
      if (pDate === selectedDate) {
        list.push({
          id: `pur-${p.id}`,
          time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '11:00 AM',
          type: 'Purchase',
          refNumber: p.supplierInvoiceNumber || p.invoiceNumber,
          partyName: p.supplierName,
          account: 'Accounts Payable',
          debit: p.grandTotal,
          credit: p.paidAmount || 0,
          notes: `Supplier Bill (${p.paymentStatus})`
        });
      }
    });

    // Expenses
    expenses.forEach(e => {
      const eDate = (e.date || e.createdAt || '').split('T')[0];
      if (eDate === selectedDate) {
        list.push({
          id: `exp-${e.id}`,
          time: e.createdAt ? new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
          type: 'Expense',
          refNumber: e.expenseNumber || e.referenceNo || e.id.slice(0, 8),
          partyName: e.category,
          account: e.paymentAccount,
          debit: e.amount,
          credit: 0,
          notes: e.description
        });
      }
    });

    // Payments
    payments.forEach(pay => {
      const payDate = (pay.date || pay.createdAt || '').split('T')[0];
      if (payDate === selectedDate) {
        list.push({
          id: `pay-${pay.id}`,
          time: pay.createdAt ? new Date(pay.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '02:00 PM',
          type: pay.type === 'Received' ? 'Receipt' : 'Payment',
          refNumber: pay.paymentNumber || pay.id.slice(0, 8),
          partyName: pay.partyName,
          account: pay.account || pay.paymentMethod,
          debit: pay.type === 'Received' ? pay.amount : 0,
          credit: pay.type === 'Paid' ? pay.amount : 0,
          notes: pay.reference ? `Ref: ${pay.reference}` : 'Settlement'
        });
      }
    });

    return list.sort((a, b) => b.time.localeCompare(a.time));
  }, [salesInvoices, purchaseInvoices, expenses, payments, selectedDate]);

  const totalDebits = dayEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = dayEntries.reduce((s, e) => s + e.credit, 0);

  const handleExportCSV = () => {
    const data = dayEntries.map(e => ({
      'Time': e.time,
      'Entry Type': e.type,
      'Reference #': e.refNumber,
      'Party / Particulars': e.partyName,
      'Account': e.account,
      'Debit (Dr)': e.debit,
      'Credit (Cr)': e.credit,
      'Narration': e.notes
    }));
    exportToCSV(data, `Day_Book_${selectedDate}`);
  };

  const columns: Column<DayBookEntry>[] = [
    {
      key: 'time',
      header: 'Time',
      render: row => <span className="font-mono text-xs text-slate-500">{row.time}</span>
    },
    {
      key: 'type',
      header: 'Type',
      render: row => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          row.type === 'Sale' || row.type === 'Receipt' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {row.type}
        </span>
      )
    },
    {
      key: 'refNumber',
      header: 'Doc Ref #',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.refNumber}</span>
    },
    {
      key: 'partyName',
      header: 'Particulars / Account',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.partyName}</span>
          <span className="text-[10px] text-slate-400">{row.account}</span>
        </div>
      )
    },
    {
      key: 'notes',
      header: 'Narration',
      render: row => <span className="text-xs text-slate-600 truncate max-w-xs block">{row.notes}</span>
    },
    {
      key: 'debit',
      header: 'Debit (Dr)',
      align: 'right',
      render: row => (
        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
          {row.debit > 0 ? formatCurrency(row.debit) : '—'}
        </span>
      )
    },
    {
      key: 'credit',
      header: 'Credit (Cr)',
      align: 'right',
      render: row => (
        <span className="font-mono text-xs font-bold text-blue-700 tabular-nums">
          {row.credit > 0 ? formatCurrency(row.credit) : '—'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-slate-400">Total Entries: </span>
            <span className="font-bold text-slate-800">{dayEntries.length}</span>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Daily Balances Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-500">Total Day Debits (Dr)</span>
            <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{formatCurrency(totalDebits)}</div>
          </div>
          <TrendingUp className="w-6 h-6 text-emerald-500" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-500">Total Day Credits (Cr)</span>
            <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">{formatCurrency(totalCredits)}</div>
          </div>
          <TrendingDown className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      <DataTable
        title={`Financial Day Book — ${formatDate(selectedDate)}`}
        subtitle="Chronological audit journal of all transactional movements for the selected day"
        columns={columns}
        data={dayEntries}
        searchPlaceholder="Search ref #, party, or account..."
        searchKeys={['refNumber', 'partyName', 'account', 'notes']}
      />
    </div>
  );
};

