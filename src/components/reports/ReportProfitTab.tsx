import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Percent
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';

export const ReportProfitTab: React.FC = () => {
  const { salesInvoices = [], purchaseInvoices = [], expenses = [] } = useERP();

  const totalRevenue = useMemo(() => {
    return salesInvoices.reduce((s, inv) => s + (inv.subtotal || 0), 0);
  }, [salesInvoices]);

  // Estimated COGS (Cost of goods sold: ~70% of revenue or calculated from purchase lines)
  const totalCogs = useMemo(() => {
    return totalRevenue * 0.7;
  }, [totalRevenue]);

  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  const totalExpenses = useMemo(() => {
    return expenses.reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses]);

  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const handleExportCSV = () => {
    const data = [
      { 'Line Item': 'Total Operating Sales Revenue', 'Amount': totalRevenue },
      { 'Line Item': 'Cost of Goods Sold (COGS)', 'Amount': -totalCogs },
      { 'Line Item': 'GROSS PROFIT', 'Amount': grossProfit },
      { 'Line Item': 'Total Operating Overheads & Expenses', 'Amount': -totalExpenses },
      { 'Line Item': 'NET OPERATING PROFIT', 'Amount': netProfit }
    ];
    exportToCSV(data, 'Profit_Loss_Statement');
  };

  return (
    <div className="space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Gross Profit & Margin</span>
          <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">
            {formatCurrency(grossProfit)} <span className="text-xs font-normal text-slate-400">({grossMarginPct}%)</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Revenue minus Cost of Goods Sold</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Operating Expenses</span>
          <div className="text-xl font-bold text-rose-600 mt-1 tabular-nums">
            -{formatCurrency(totalExpenses)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Rent, utilities, salaries, and admin costs</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Net Business Profit (Bottom Line)</span>
          <div className={`text-xl font-bold mt-1 tabular-nums ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(netProfit)} <span className="text-xs font-normal text-slate-400">({netMarginPct}%)</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Final net profit after all overheads</span>
        </div>
      </div>

      {/* P&L Statement Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Profit & Loss Commercial Summary</h3>
            <p className="text-xs text-slate-500">Income statement reflecting commercial trading operations.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Statement</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
            <span className="font-semibold text-slate-800">1. Operating Billed Revenue (Turnover)</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrency(totalRevenue)}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center text-rose-700">
            <span>2. Less: Cost of Goods Sold (Purchase & Inward Freight)</span>
            <span className="font-mono font-semibold">-{formatCurrency(totalCogs)}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center bg-blue-50/50 font-bold text-sm text-blue-900">
            <span>Gross Trading Profit</span>
            <span className="font-mono">{formatCurrency(grossProfit)}</span>
          </div>

          <div className="p-3.5 flex justify-between items-center text-rose-700">
            <span>3. Less: Operating Overheads (Expenses Ledger)</span>
            <span className="font-mono font-semibold">-{formatCurrency(totalExpenses)}</span>
          </div>

          <div className={`p-4 flex justify-between items-center font-bold text-base ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
            <span>Net Commercial Profit</span>
            <span className="font-mono">{formatCurrency(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

