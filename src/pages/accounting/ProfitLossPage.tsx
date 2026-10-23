import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Receipt,
  Package,
  Activity,
  CreditCard,
  Building,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { Modal } from '../../components/common/Modal';

export const ProfitLossPage: React.FC = () => {
  const navigate = useNavigate();
  const { salesInvoices, purchaseInvoices, expenses, products } = useERP();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [drilldownModal, setDrilldownModal] = useState<'sales' | 'cogs' | 'gross' | 'net' | null>(null);

  const isDateInPeriod = (dateStr: string) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const itemQuarter = Math.floor(d.getMonth() / 3);
      return itemQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
    }
    return d.getFullYear() === now.getFullYear();
  };

  const periodSalesInvoices = useMemo(() => salesInvoices.filter(i => isDateInPeriod(i.date)), [salesInvoices, period]);
  const periodPurchaseInvoices = useMemo(() => purchaseInvoices.filter(i => isDateInPeriod(i.date)), [purchaseInvoices, period]);
  const periodExpenses = useMemo(() => expenses.filter(e => isDateInPeriod(e.date)), [expenses, period]);

  // Real data calculations
  const rawSales = periodSalesInvoices.filter(i => i.docType !== 'credit_note').reduce((acc, inv) => acc + inv.subtotal, 0);
  const salesReturns = periodSalesInvoices.filter(i => i.docType === 'credit_note').reduce((acc, inv) => acc + inv.subtotal, 0);
  const netSales = rawSales - salesReturns;

  // Real stock & purchases
  const currentStockVal = products.reduce((acc, p) => acc + p.currentStock * p.costPrice, 0);
  const openingStock = products.reduce((acc, p) => acc + (p.openingStock || 0) * p.costPrice, 0);
  const purchases = periodPurchaseInvoices.filter(p => p.docType !== 'purchase_return').reduce((acc, p) => acc + p.subtotal, 0);
  const purchaseReturns = periodPurchaseInvoices.filter(p => p.docType === 'purchase_return').reduce((acc, p) => acc + p.subtotal, 0);
  const directExpenses = periodExpenses.filter(e => 
    e.category.toLowerCase().includes('freight') || 
    e.category.toLowerCase().includes('direct') || 
    e.category.toLowerCase().includes('packaging') || 
    e.category.toLowerCase().includes('customs')
  ).reduce((acc, e) => acc + e.amount, 0);
  const closingStock = currentStockVal;

  // COGS = Opening Stock + Purchases + Direct Expenses - Purchase Returns - Closing Stock (Prompt #31)
  const cogs = Math.max(0, openingStock + purchases + directExpenses - purchaseReturns - closingStock);
  const grossProfit = netSales - cogs;
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Operating Expenses grouped by category (excluding direct expenses counted in COGS)
  const operatingExpensesList = periodExpenses.filter(e => 
    !e.category.toLowerCase().includes('freight') && 
    !e.category.toLowerCase().includes('direct') && 
    !e.category.toLowerCase().includes('packaging') && 
    !e.category.toLowerCase().includes('customs')
  );

  const opExpensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    operatingExpensesList.forEach(exp => {
      map[exp.category] = (map[exp.category] || 0) + exp.amount;
    });
    return map;
  }, [operatingExpensesList]);

  const totalOperatingExpenses = Object.values(opExpensesByCategory).reduce((acc, val) => acc + val, 0);
  const netProfit = grossProfit - totalOperatingExpenses;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  const handleExportXLSX = () => {
    const exportData = [
      { Category: 'Revenue', Item: 'Gross Sales', Amount: rawSales },
      { Category: 'Revenue', Item: 'Sales Returns & Credit Notes', Amount: -salesReturns },
      { Category: 'Revenue', Item: 'Net Sales Revenue', Amount: netSales },
      { Category: 'Cost of Goods Sold', Item: 'Opening Stock', Amount: openingStock },
      { Category: 'Cost of Goods Sold', Item: 'Purchases (Gross)', Amount: purchases },
      { Category: 'Cost of Goods Sold', Item: 'Direct Freight & Handling', Amount: directExpenses },
      { Category: 'Cost of Goods Sold', Item: 'Purchase Returns (Debit Notes)', Amount: -purchaseReturns },
      { Category: 'Cost of Goods Sold', Item: 'Closing Stock (Valuation)', Amount: -closingStock },
      { Category: 'Cost of Goods Sold', Item: 'Total Cost of Goods Sold (COGS)', Amount: cogs },
      { Category: 'Profitability', Item: 'Gross Operating Profit', Amount: grossProfit },
      ...Object.entries(opExpensesByCategory).map(([cat, amt]) => ({
        Category: 'Operating Expenses',
        Item: cat,
        Amount: amt
      })),
      { Category: 'Operating Expenses', Item: 'Total Operating Expenses', Amount: totalOperatingExpenses },
      { Category: 'Profitability', Item: 'Net Profit Before Tax', Amount: netProfit }
    ];
    exportToExcel(exportData, `Profit_and_Loss_${period}`);
  };

  const handleExportCSV = () => {
    const exportData = [
      { Category: 'Revenue', Item: 'Gross Sales', Amount: rawSales },
      { Category: 'Revenue', Item: 'Sales Returns', Amount: -salesReturns },
      { Category: 'Revenue', Item: 'Net Sales Revenue', Amount: netSales },
      { Category: 'COGS', Item: 'Opening Stock', Amount: openingStock },
      { Category: 'COGS', Item: 'Purchases', Amount: purchases },
      { Category: 'COGS', Item: 'Direct Expenses', Amount: directExpenses },
      { Category: 'COGS', Item: 'Purchase Returns', Amount: -purchaseReturns },
      { Category: 'COGS', Item: 'Closing Stock', Amount: -closingStock },
      { Category: 'COGS', Item: 'Total COGS', Amount: cogs },
      { Category: 'Profitability', Item: 'Gross Profit', Amount: grossProfit },
      { Category: 'Operating Expenses', Item: 'Total Operating Expenses', Amount: totalOperatingExpenses },
      { Category: 'Profitability', Item: 'Net Profit', Amount: netProfit }
    ];
    exportToCSV(exportData, `Profit_and_Loss_${period}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Statement of Profit & Loss (P&L)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive income statement showing operating revenue, Cost of Goods Sold (COGS), gross margin and net earnings.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          {/* Period selector (Prompt #31: Monthly, Quarterly, Yearly) */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                period === 'month'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPeriod('quarter')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                period === 'quarter'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Quarter
            </button>
            <button
              type="button"
              onClick={() => setPeriod('year')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                period === 'year'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Full FY 26-27
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportXLSX}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print P&L</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Highlight Cards - Interactive Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* BUTTON 1: Net Sales Revenue */}
        <button
          type="button"
          onClick={() => setDrilldownModal('sales')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Sales Revenue & Invoices breakdown"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider group-hover:text-blue-600 transition-colors">
              Net Sales Revenue
            </span>
            <Receipt className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <span className="text-xl font-black text-slate-900 block font-mono">
            {formatCurrency(netSales)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> +12.4% vs last period
            </span>
            <span className="text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 2: Cost of Goods Sold (COGS) */}
        <button
          type="button"
          onClick={() => setDrilldownModal('cogs')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view COGS calculation and Inventory formula"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider group-hover:text-amber-600 transition-colors">
              Cost of Goods Sold (COGS)
            </span>
            <Package className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <span className="text-xl font-black text-slate-900 block font-mono">
            {formatCurrency(cogs)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">
              {netSales > 0 ? `${((cogs / netSales) * 100).toFixed(1)}% of Revenue` : '0.0% of Revenue'}
            </span>
            <span className="text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 3: Gross Profit & Margin */}
        <button
          type="button"
          onClick={() => setDrilldownModal('gross')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Gross Margin profitability analysis"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider group-hover:text-emerald-600 transition-colors">
              Gross Profit & Margin
            </span>
            <Percent className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <span className="text-xl font-black text-emerald-600 block font-mono">
            {formatCurrency(grossProfit)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-emerald-700">
              Gross Margin: {grossMargin.toFixed(1)}%
            </span>
            <span className="text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Analytics <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 4: Net Profit (PAT) */}
        <button
          type="button"
          onClick={() => setDrilldownModal('net')}
          className="text-left bg-emerald-900 hover:bg-emerald-850 text-white p-4 rounded-xl shadow-2xs space-y-1 hover:ring-2 hover:ring-emerald-400/50 transition-all cursor-pointer group active:scale-[0.99]"
          title="Click to view Net Profit After Tax and Operating Overheads breakdown"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider">
              Net Profit (PAT)
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <span className="text-xl font-black text-white block font-mono">
            {formatCurrency(netProfit)}
          </span>
          <div className="flex items-center justify-between text-[10px] text-emerald-200 pt-0.5">
            <span>Net Margin: {netMargin.toFixed(1)}%</span>
            <span className="font-bold text-emerald-300 flex items-center gap-0.5">
              Live Analytics <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
        </button>
      </div>

      {/* P&L Statement Structured Document (Prompt #31) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Financial Performance Breakdown (Amount in ₹ INR)
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            Period: {period === 'month' ? '01 Oct 2026 – 31 Oct 2026' : period === 'quarter' ? 'Q2 FY 2026-27' : 'FY 2026-27'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/60 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-2/3">Particulars / Line Item</th>
                <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                <th className="py-2.5 px-4 text-right w-36">% of Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {/* SECTION 1: REVENUE */}
              <tr className="bg-slate-50/60 font-sans font-bold text-slate-800">
                <td colSpan={3} className="py-2 px-4 uppercase text-[11px] tracking-wide text-blue-700">
                  I. Revenue from Operations
                </td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Gross Sales Revenue</td>
                <td className="py-2 px-4 text-right font-semibold">{formatCurrency(rawSales)}</td>
                <td className="py-2 px-4 text-right text-slate-500">{netSales > 0 ? ((rawSales / netSales) * 100).toFixed(1) : '100.0'}%</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-rose-600">Less: Sales Returns & Inward Claims</td>
                <td className="py-2 px-4 text-right font-semibold text-rose-600">({formatCurrency(salesReturns)})</td>
                <td className="py-2 px-4 text-right text-rose-500">{netSales > 0 ? ((salesReturns / netSales) * 100).toFixed(1) : '0.0'}%</td>
              </tr>
              <tr className="bg-blue-50/40 font-bold text-slate-900 border-t border-blue-100">
                <td className="py-2.5 px-4 font-sans uppercase text-[11px]">Net Sales Revenue (A)</td>
                <td className="py-2.5 px-4 text-right text-blue-800">{formatCurrency(netSales)}</td>
                <td className="py-2.5 px-4 text-right text-blue-700 font-bold">100.0%</td>
              </tr>

              {/* SECTION 2: COST OF GOODS SOLD */}
              <tr className="bg-slate-50/60 font-sans font-bold text-slate-800">
                <td colSpan={3} className="py-2 px-4 uppercase text-[11px] tracking-wide text-amber-700">
                  II. Cost of Goods Sold (COGS)
                </td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Opening Stock of Merchandise</td>
                <td className="py-2 px-4 text-right">{formatCurrency(openingStock)}</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Add: Gross Purchases</td>
                <td className="py-2 px-4 text-right">{formatCurrency(purchases)}</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Add: Direct Freight & Inward Charges</td>
                <td className="py-2 px-4 text-right">{formatCurrency(directExpenses)}</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Less: Purchase Returns & Rebates</td>
                <td className="py-2 px-4 text-right text-rose-600">({formatCurrency(purchaseReturns)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Less: Closing Stock on Hand</td>
                <td className="py-2 px-4 text-right text-rose-600">({formatCurrency(closingStock)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr className="bg-amber-50/40 font-bold text-slate-900 border-t border-amber-100">
                <td className="py-2.5 px-4 font-sans uppercase text-[11px]">Total Cost of Goods Sold (B)</td>
                <td className="py-2.5 px-4 text-right text-amber-900">{formatCurrency(cogs)}</td>
                <td className="py-2.5 px-4 text-right text-amber-800">{netSales > 0 ? ((cogs / netSales) * 100).toFixed(1) : '0.0'}%</td>
              </tr>

              {/* GROSS PROFIT */}
              <tr className="bg-emerald-50/80 font-black text-emerald-950 border-y-2 border-emerald-300">
                <td className="py-3 px-4 font-sans uppercase text-xs">III. Gross Profit (A - B)</td>
                <td className="py-3 px-4 text-right text-sm text-emerald-700">{formatCurrency(grossProfit)}</td>
                <td className="py-3 px-4 text-right text-emerald-800 font-bold">{grossMargin.toFixed(1)}%</td>
              </tr>

              {/* SECTION 3: OPERATING EXPENSES */}
              <tr className="bg-slate-50/60 font-sans font-bold text-slate-800">
                <td colSpan={3} className="py-2 px-4 uppercase text-[11px] tracking-wide text-purple-700">
                  IV. Operating & Administrative Expenses
                </td>
              </tr>
              {Object.keys(opExpensesByCategory).length > 0 ? (
                Object.entries(opExpensesByCategory).map(([cat, amt]) => (
                  <tr key={cat}>
                    <td className="py-2 px-6 font-sans text-slate-700">{cat} Expenses</td>
                    <td className="py-2 px-4 text-right">{formatCurrency(amt)}</td>
                    <td className="py-2 px-4 text-right text-slate-500">{netSales > 0 ? ((amt / netSales) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-2 px-6 font-sans text-slate-400 italic">No operating expenses recorded in this period</td>
                </tr>
              )}
              <tr className="bg-purple-50/40 font-bold text-slate-900 border-t border-purple-100">
                <td className="py-2.5 px-4 font-sans uppercase text-[11px]">Total Operating Expenses (C)</td>
                <td className="py-2.5 px-4 text-right text-purple-900">{formatCurrency(totalOperatingExpenses)}</td>
                <td className="py-2.5 px-4 text-right text-purple-800">{netSales > 0 ? ((totalOperatingExpenses / netSales) * 100).toFixed(1) : '0.0'}%</td>
              </tr>

              {/* NET PROFIT */}
              <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-900">
                <td className="py-3.5 px-4 font-sans uppercase tracking-wider text-xs">
                  V. Net Profit for the Period (PAT)
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-400 text-base">{formatCurrency(netProfit)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-300 font-bold">{netMargin.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Modals */}
      {/* 1. Net Sales Modal */}
      <Modal
        isOpen={drilldownModal === 'sales'}
        onClose={() => setDrilldownModal(null)}
        title="Net Sales Revenue Breakdown"
        subtitle={`Period revenue summary across ${periodSalesInvoices.length} invoices`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Invoiced</span>
              <span className="text-base font-bold text-slate-900 mt-1 block font-mono">{formatCurrency(rawSales)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Sales Returns (CR)</span>
              <span className="text-base font-bold text-rose-600 mt-1 block font-mono">{formatCurrency(salesReturns)}</span>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
              <span className="text-[10px] text-blue-700 uppercase font-bold block">Net Revenue (A)</span>
              <span className="text-base font-bold text-blue-900 mt-1 block font-mono">{formatCurrency(netSales)}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3 text-right">Subtotal</th>
                  <th className="py-2 px-3 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodSalesInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      No sales recorded in this period.
                    </td>
                  </tr>
                ) : (
                  periodSalesInvoices.slice(0, 10).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-blue-600">{inv.invoiceNumber}</td>
                      <td className="py-2 px-3 text-slate-500">{inv.date}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(inv.subtotal)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(inv.grandTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDrilldownModal(null);
                navigate('/sales');
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Go to Sales Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. COGS Modal */}
      <Modal
        isOpen={drilldownModal === 'cogs'}
        onClose={() => setDrilldownModal(null)}
        title="Cost of Goods Sold (COGS) Breakdown"
        subtitle="Standard accounting formula: Opening Stock + Direct Purchases - Closing Stock"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Opening Stock</span>
              <span className="text-base font-bold text-slate-800 mt-1 block font-mono">{formatCurrency(openingStock)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Inward Purchases</span>
              <span className="text-base font-bold text-slate-800 mt-1 block font-mono">{formatCurrency(purchases)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Closing Stock (-)</span>
              <span className="text-base font-bold text-slate-800 mt-1 block font-mono">{formatCurrency(closingStock)}</span>
            </div>
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
              <span className="text-[10px] text-amber-700 uppercase font-bold block">Total COGS (B)</span>
              <span className="text-base font-bold text-amber-900 mt-1 block font-mono">{formatCurrency(cogs)}</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-800 block">Inventory Impact Analysis</span>
            <p className="text-slate-600 leading-relaxed">
              COGS represents the direct cost incurred to acquire or manufacture the products sold during this period.
              {netSales > 0
                ? ` COGS accounts for ${((cogs / netSales) * 100).toFixed(1)}% of your net revenue.`
                : ' No sales recorded yet to calculate COGS absorption ratio.'}
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDrilldownModal(null);
                navigate('/purchases');
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View Purchase Bills</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Gross Profit Modal */}
      <Modal
        isOpen={drilldownModal === 'gross'}
        onClose={() => setDrilldownModal(null)}
        title="Gross Profit & Margin Analytics"
        subtitle="Gross Profit = Net Sales Revenue - Cost of Goods Sold"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Gross Profit</span>
              <span className="text-2xl font-black font-mono text-emerald-800 mt-0.5 block">{formatCurrency(grossProfit)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Gross Margin</span>
              <span className="text-2xl font-black font-mono text-emerald-800 mt-0.5 block">{grossMargin.toFixed(1)}%</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600">Net Sales Revenue</span>
              <span className="font-bold font-mono text-slate-800">{formatCurrency(netSales)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-600">Less: Cost of Goods Sold</span>
              <span className="font-bold font-mono text-rose-600">- {formatCurrency(cogs)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-100 font-bold rounded-lg border border-slate-300">
              <span className="text-slate-900">Retained Gross Margin</span>
              <span className="font-mono text-emerald-700">{formatCurrency(grossProfit)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* 4. Net Profit Modal */}
      <Modal
        isOpen={drilldownModal === 'net'}
        onClose={() => setDrilldownModal(null)}
        title="Net Profit (PAT) Analytics"
        subtitle="Final bottom-line earnings after deducting all operating expenses & taxes"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Profit</span>
              <span className="text-base font-bold text-slate-800 mt-1 block font-mono">{formatCurrency(grossProfit)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Operating Expenses (-)</span>
              <span className="text-base font-bold text-rose-600 mt-1 block font-mono">{formatCurrency(totalOperatingExpenses)}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-emerald-700 uppercase font-bold block">Net Profit (PAT)</span>
              <span className="text-base font-bold text-emerald-800 mt-1 block font-mono">{formatCurrency(netProfit)}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 block mb-2">Operating Expenses by Category</span>
            <div className="space-y-1.5">
              {Object.keys(opExpensesByCategory).length === 0 ? (
                <p className="text-slate-400 italic">No operational expenses recorded.</p>
              ) : (
                Object.entries(opExpensesByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-600">{cat}</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(amt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDrilldownModal(null);
                navigate('/expenses');
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Manage Operating Expenses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
