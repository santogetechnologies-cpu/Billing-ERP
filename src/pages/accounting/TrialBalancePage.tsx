import React, { useState, useMemo } from 'react';
import {
  Scale,
  CheckCircle,
  AlertCircle,
  Printer,
  Download,
  Calendar,
  Layers,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const TrialBalancePage: React.FC = () => {
  const { accounts } = useERP();
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate Trial Balance rows
  const trialBalanceRows = useMemo(() => {
    return accounts.map(acc => {
      const isDebitAcc = acc.category === 'Assets' || acc.category === 'Expenses';
      const balance = acc.balance || 0;

      const openingDr = isDebitAcc ? balance : 0;
      const openingCr = !isDebitAcc ? balance : 0;
      const currentPeriodDr = 0;
      const currentPeriodCr = 0;
      const closingDr = isDebitAcc ? balance : 0;
      const closingCr = !isDebitAcc ? balance : 0;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        subCategory: acc.subCategory,
        openingDr,
        openingCr,
        periodDr: currentPeriodDr,
        periodCr: currentPeriodCr,
        closingDr,
        closingCr
      };
    });
  }, [accounts]);

  const filteredRows = useMemo(() => {
    return trialBalanceRows.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.includes(searchTerm) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [trialBalanceRows, searchTerm]);

  // Compute genuine totals (Prompt #30 - NEVER artificially force debit and credit to be equal)
  const totalOpeningDr = trialBalanceRows.reduce((sum, r) => sum + r.openingDr, 0);
  const totalOpeningCr = trialBalanceRows.reduce((sum, r) => sum + r.openingCr, 0);
  const totalPeriodDr = trialBalanceRows.reduce((sum, r) => sum + r.periodDr, 0);
  const totalPeriodCr = trialBalanceRows.reduce((sum, r) => sum + r.periodCr, 0);
  
  const totalClosingDr = trialBalanceRows.reduce((sum, r) => sum + r.closingDr, 0);
  const totalClosingCr = trialBalanceRows.reduce((sum, r) => sum + r.closingCr, 0);

  const diff = Math.abs(totalClosingDr - totalClosingCr);
  const isBalanced = diff < 0.01;

  const handleExportXLSX = () => {
    const exportData = filteredRows.map(r => ({
      'Account Code': r.code,
      'Account Title': r.name,
      'Category': r.category,
      'Opening Dr': r.openingDr,
      'Opening Cr': r.openingCr,
      'Period Dr': r.periodDr,
      'Period Cr': r.periodCr,
      'Closing Dr': r.closingDr,
      'Closing Cr': r.closingCr
    }));
    exportToExcel(exportData, `Trial_Balance_${asOnDate}`);
  };

  const handleExportCSV = () => {
    const exportData = filteredRows.map(r => ({
      'Account Code': r.code,
      'Account Title': r.name,
      'Category': r.category,
      'Opening Dr': r.openingDr,
      'Opening Cr': r.openingCr,
      'Period Dr': r.periodDr,
      'Period Cr': r.periodCr,
      'Closing Dr': r.closingDr,
      'Closing Cr': r.closingCr
    }));
    exportToCSV(exportData, `Trial_Balance_${asOnDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-600" />
            Trial Balance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verification statement of debit and credit ledger balances for financial period closing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Visual Balance Indicator Banner (Prompt #30 - Genuine unbalance detection) */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isBalanced
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
            : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white ${
              isBalanced ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {isBalanced ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {isBalanced ? 'Books are Perfectly Balanced!' : `Trial Balance is unbalanced by ${formatCurrency(diff)}`}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded-full text-white ${
                  isBalanced ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {isBalanced ? 'Debit Total = Credit Total' : totalClosingDr > totalClosingCr ? 'Dr Exceeds Cr' : 'Cr Exceeds Dr'}
              </span>
            </div>
            <p className="text-xs mt-0.5 text-slate-700">
              {isBalanced
                ? 'The fundamental accounting equation holds. All journal entries and general ledger vouchers are in mathematical equilibrium.'
                : `Action required: Discrepancy of ${formatCurrency(diff)} identified between total ledger debits and credits. Review recent journals and unposted batches.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono self-end sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Total Debit (Dr)</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(totalClosingDr)}</span>
          </div>
          <div className={`text-xl font-light ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isBalanced ? '=' : '≠'}
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Total Credit (Cr)</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(totalClosingCr)}</span>
          </div>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>As on Date:</span>
            <input
              type="date"
              value={asOnDate}
              onChange={e => setAsOnDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            />
          </div>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500 font-medium">Financial Year: 2026-2027</span>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search account name or code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Multi-Period Trial Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">Code</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">Account Title</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200">Category</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-slate-100/70">
                  Opening Balance
                </th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-slate-100/70">
                  Transactions (Period)
                </th>
                <th colSpan={2} className="py-2 px-3 text-center bg-slate-100/70">
                  Closing Balance
                </th>
              </tr>
              <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-mono">
                <th className="py-1.5 px-3 text-right border-r border-slate-200">Debit (Dr)</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200">Credit (Cr)</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200">Debit (Dr)</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200">Credit (Cr)</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200 font-bold text-slate-800">Debit (Dr)</th>
                <th className="py-1.5 px-3 text-right font-bold text-slate-800">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-600 border-r border-slate-100">
                    {row.code}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900 border-r border-slate-100">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500 border-r border-slate-100">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">
                      {row.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-100 text-slate-600">
                    {row.openingDr > 0 ? formatCurrency(row.openingDr) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-100 text-slate-600">
                    {row.openingCr > 0 ? formatCurrency(row.openingCr) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-100 text-slate-600">
                    {row.periodDr > 0 ? formatCurrency(row.periodDr) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-100 text-slate-600">
                    {row.periodCr > 0 ? formatCurrency(row.periodCr) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-100 font-bold text-emerald-700 bg-emerald-50/20">
                    {row.closingDr > 0 ? formatCurrency(row.closingDr) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-rose-700 bg-rose-50/20">
                    {row.closingCr > 0 ? formatCurrency(row.closingCr) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-mono font-bold text-xs">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider font-sans font-bold">
                  Total Trial Balance Equilibrium:
                </td>
                <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(totalOpeningDr)}</td>
                <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(totalOpeningCr)}</td>
                <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(totalPeriodDr)}</td>
                <td className="py-3 px-3 text-right text-slate-300">{formatCurrency(totalPeriodCr)}</td>
                <td className="py-3 px-3 text-right text-emerald-400 font-black">{formatCurrency(totalClosingDr)}</td>
                <td className="py-3 px-3 text-right text-emerald-400 font-black">{formatCurrency(totalClosingCr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
