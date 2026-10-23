import React, { useState, useMemo } from 'react';
import {
  BookText,
  Filter,
  Calendar,
  Download,
  Printer,
  Search,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface LedgerRow {
  id: string;
  date: string;
  particulars: string;
  refNo: string;
  type: string;
  partyName?: string;
  debit: number;
  credit: number;
  balance: number;
}

export const GeneralLedgerPage: React.FC = () => {
  const { accounts, salesInvoices, purchaseInvoices, expenses, payments } = useERP();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const currentAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  // Build ledger entries from real transactions in the system
  const ledgerEntries = useMemo(() => {
    if (!currentAccount) return [];

    let runningBalance = currentAccount.balance || 0;
    const rows: LedgerRow[] = [];

    if (runningBalance !== 0) {
      rows.push({
        id: 'ob-1',
        date: new Date().toISOString().split('T')[0],
        particulars: 'Opening Balance b/f',
        refNo: 'OB-INIT',
        type: 'Opening Balance',
        debit: currentAccount.isDebit ? runningBalance : 0,
        credit: !currentAccount.isDebit ? runningBalance : 0,
        balance: runningBalance
      });
    }

    // Bank or Cash account transactions
    if (currentAccount.code.startsWith('10')) {
      // Inflow from sales receipts
      payments.filter(p => p.type === 'Received').forEach(p => {
        const debit = p.amount;
        runningBalance += debit;
        rows.push({
          id: p.id,
          date: p.date,
          particulars: `Received from ${p.partyName} (${p.paymentMethod})`,
          refNo: p.paymentNumber,
          type: 'Receipt',
          partyName: p.partyName,
          debit,
          credit: 0,
          balance: runningBalance
        });
      });

      // Outflow from supplier payments
      payments.filter(p => p.type === 'Paid').forEach(p => {
        const credit = p.amount;
        runningBalance -= credit;
        rows.push({
          id: p.id,
          date: p.date,
          particulars: `Paid to ${p.partyName} (${p.paymentMethod})`,
          refNo: p.paymentNumber,
          type: 'Payment',
          partyName: p.partyName,
          debit: 0,
          credit,
          balance: runningBalance
        });
      });

      // Outflow from expenses
      expenses.forEach(exp => {
        const credit = exp.amount;
        runningBalance -= credit;
        rows.push({
          id: exp.id,
          date: exp.date,
          particulars: `${exp.category} - ${exp.vendor} (${exp.description})`,
          refNo: exp.referenceNo || 'EXP',
          type: 'Expense',
          partyName: exp.vendor,
          debit: 0,
          credit,
          balance: runningBalance
        });
      });
    } else if (currentAccount.code.startsWith('40')) {
      // Sales Income account
      salesInvoices.forEach(inv => {
        const credit = inv.subtotal;
        runningBalance += credit;
        rows.push({
          id: inv.id,
          date: inv.date,
          particulars: `Sales to ${inv.customerName}`,
          refNo: inv.invoiceNumber,
          type: 'Sales Invoice',
          partyName: inv.customerName,
          debit: 0,
          credit,
          balance: runningBalance
        });
      });
    } else if (currentAccount.code.startsWith('50')) {
      // Purchase / Expense accounts
      purchaseInvoices.forEach(pur => {
        const debit = pur.subtotal;
        runningBalance += debit;
        rows.push({
          id: pur.id,
          date: pur.date,
          particulars: `Purchases from ${pur.supplierName}`,
          refNo: pur.invoiceNumber,
          type: 'Purchase Bill',
          partyName: pur.supplierName,
          debit,
          credit: 0,
          balance: runningBalance
        });
      });
    }

    return rows;
  }, [currentAccount, payments, expenses, salesInvoices, purchaseInvoices]);

  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter(row => {
      const matchSearch =
        row.particulars.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.partyName && row.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    });
  }, [ledgerEntries, searchTerm]);

  const totalDebit = filteredEntries.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = filteredEntries.reduce((sum, r) => sum + r.credit, 0);
  const closingBalance = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].balance : 0;

  const handleExportXLSX = () => {
    const data = filteredEntries.map(e => ({
      'Date': formatDate(e.date),
      'Particulars': e.particulars,
      'Ref No': e.refNo,
      'Type': e.type,
      'Debit (Dr)': e.debit,
      'Credit (Cr)': e.credit,
      'Running Balance': e.balance
    }));
    exportToExcel(data, `Ledger_${currentAccount?.code || 'Account'}`);
  };

  const handleExportCSV = () => {
    const data = filteredEntries.map(e => ({
      'Date': formatDate(e.date),
      'Particulars': e.particulars,
      'Ref No': e.refNo,
      'Type': e.type,
      'Debit (Dr)': e.debit,
      'Credit (Cr)': e.credit,
      'Running Balance': e.balance
    }));
    exportToCSV(data, `Ledger_${currentAccount?.code || 'Account'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookText className="w-5 h-5 text-indigo-600" />
            General Ledger Statement
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Running double-entry account statement with real-time debit, credit and balance tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {/* Account Selector & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Select Account */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Select General Ledger Account
          </label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} ({acc.category})
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Date Period
          </label>
          <select
            value={selectedDateFilter}
            onChange={e => setSelectedDateFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="All">All Transactions (FY 2026-27)</option>
            <option value="CurrentMonth">Current Month (October 2026)</option>
            <option value="LastMonth">Last Month (September 2026)</option>
            <option value="Q2">Q2 FY 2026-27</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Search Entries
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search particulars, ref #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Account Info Banner */}
      {currentAccount && (
        <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
              Account Code: {currentAccount.code} • {currentAccount.category} / {currentAccount.subCategory}
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">{currentAccount.name}</h2>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Debits</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(totalDebit)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Credits</span>
              <span className="text-sm font-mono font-bold text-rose-400">{formatCurrency(totalCredit)}</span>
            </div>
            <div className="border-l border-slate-700 pl-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Closing Balance</span>
              <span className="text-base font-mono font-black text-white">{formatCurrency(closingBalance)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table: Date | Particulars | Debit | Credit | Balance (Prompt #29) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars</th>
                <th className="py-3 px-4">Voucher / Ref #</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4 text-right">Debit (Dr)</th>
                <th className="py-3 px-4 text-right">Credit (Cr)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-sans">{formatDate(row.date)}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{row.particulars}</td>
                    <td className="py-3 px-4 text-blue-600 font-bold">{row.refNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">{row.type}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No ledger entries or transactions recorded for this account yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-mono font-bold text-slate-900 text-xs">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider font-sans font-bold">
                  Period Totals & Closing Balance:
                </td>
                <td className="py-3 px-4 text-right text-emerald-700">{formatCurrency(totalDebit)}</td>
                <td className="py-3 px-4 text-right text-rose-700">{formatCurrency(totalCredit)}</td>
                <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
