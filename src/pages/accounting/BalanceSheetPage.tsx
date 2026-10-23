import React, { useState, useMemo } from 'react';
import {
  Landmark,
  CheckCircle,
  AlertCircle,
  Printer,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const BalanceSheetPage: React.FC = () => {
  const { accounts, products, customers, suppliers, bankAccounts, cashAccounts, salesInvoices, purchaseInvoices, expenses } = useERP();
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split('T')[0]);

  // Dynamically calculate asset values from live subsystems & created accounts
  const cashTotal = cashAccounts.reduce((sum, c) => sum + c.currentBalance, 0);
  const bankTotal = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
  const receivablesTotal = customers.reduce((sum, c) => sum + c.currentOutstanding, 0);
  const inventoryTotal = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
  const fixedAssets = accounts.filter(a => a.category === 'Assets' && a.code?.startsWith('15')).reduce((sum, a) => sum + a.balance, 0);
  const otherAssets = accounts.filter(a => a.category === 'Assets' && !['10', '11', '12', '13', '14', '15'].some(prefix => a.code?.startsWith(prefix))).reduce((sum, a) => sum + a.balance, 0);
  const gstInputAssets = accounts.filter(a => a.category === 'Assets' && a.code?.startsWith('14')).reduce((sum, a) => sum + a.balance, 0);

  const totalAssets = cashTotal + bankTotal + receivablesTotal + inventoryTotal + fixedAssets + otherAssets + gstInputAssets;

  // Liabilities
  const payablesTotal = suppliers.reduce((sum, s) => sum + s.currentOutstanding, 0);
  const gstPayable = accounts.filter(a => a.category === 'Liabilities' && a.code?.startsWith('21')).reduce((sum, a) => sum + a.balance, 0);
  const bankLoan = accounts.filter(a => a.category === 'Liabilities' && (a.code?.startsWith('22') || a.name.toLowerCase().includes('loan'))).reduce((sum, a) => sum + a.balance, 0);
  const otherLiabilities = accounts.filter(a => a.category === 'Liabilities' && !['20', '21', '22'].some(prefix => a.code?.startsWith(prefix))).reduce((sum, a) => sum + a.balance, 0);

  const totalLiabilities = payablesTotal + gstPayable + bankLoan + otherLiabilities;

  // Real Net Profit Calculation from P&L (Prompt #32 - NEVER a balancing plug)
  const totalSales = salesInvoices.filter(i => i.docType !== 'credit_note').reduce((sum, i) => sum + i.subtotal, 0);
  const salesReturns = salesInvoices.filter(i => i.docType === 'credit_note').reduce((sum, i) => sum + i.subtotal, 0);
  const netSales = totalSales - salesReturns;

  const openingStockVal = products.reduce((sum, p) => sum + ((p.openingStock || 0) * p.costPrice), 0);
  const totalPurchases = purchaseInvoices.filter(p => p.docType !== 'purchase_return').reduce((sum, p) => sum + p.subtotal, 0);
  const purchaseReturns = purchaseInvoices.filter(p => p.docType === 'purchase_return').reduce((sum, p) => sum + p.subtotal, 0);
  const cogs = Math.max(0, openingStockVal + totalPurchases - purchaseReturns - inventoryTotal);
  const grossProfit = Math.max(0, netSales - cogs);
  const totalOpExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currentProfit = grossProfit - totalOpExpenses;

  // Equity: Capital + Retained Earnings + Actual Current Profit
  const ownerCapital = accounts.filter(a => a.category === 'Equity' && a.code?.startsWith('30')).reduce((sum, a) => sum + a.balance, 0);
  const retainedEarnings = accounts.filter(a => a.category === 'Equity' && a.code?.startsWith('31')).reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = ownerCapital + retainedEarnings + currentProfit;

  // Fundamental Accounting Equation: ASSETS = LIABILITIES + EQUITY
  const equationDifference = totalAssets - (totalLiabilities + totalEquity);
  const isBalanced = Math.abs(equationDifference) < 1;

  const handleExportXLSX = () => {
    const exportData = [
      { Section: 'Assets', Item: 'Cash in Hand', Amount: cashTotal },
      { Section: 'Assets', Item: 'Bank Balances', Amount: bankTotal },
      { Section: 'Assets', Item: 'Trade Receivables', Amount: receivablesTotal },
      { Section: 'Assets', Item: 'Merchandise Inventory', Amount: inventoryTotal },
      { Section: 'Assets', Item: 'Input GST Receivables', Amount: gstInputAssets },
      { Section: 'Assets', Item: 'Fixed Assets', Amount: fixedAssets },
      { Section: 'Assets', Item: 'Other Assets', Amount: otherAssets },
      { Section: 'Assets Total', Item: 'TOTAL ASSETS', Amount: totalAssets },
      { Section: 'Liabilities', Item: 'Trade Payables', Amount: payablesTotal },
      { Section: 'Liabilities', Item: 'GST Output Payable', Amount: gstPayable },
      { Section: 'Liabilities', Item: 'Bank Loans & Borrowings', Amount: bankLoan },
      { Section: 'Liabilities', Item: 'Other Liabilities', Amount: otherLiabilities },
      { Section: 'Liabilities Total', Item: 'TOTAL LIABILITIES', Amount: totalLiabilities },
      { Section: 'Equity', Item: 'Owner Capital', Amount: ownerCapital },
      { Section: 'Equity', Item: 'Retained Earnings', Amount: retainedEarnings },
      { Section: 'Equity', Item: 'Current Period Net Profit (P&L)', Amount: currentProfit },
      { Section: 'Equity Total', Item: 'TOTAL EQUITY', Amount: totalEquity },
      { Section: 'Summary', Item: 'Total Liabilities + Equity', Amount: totalLiabilities + totalEquity },
      { Section: 'Summary', Item: 'Equilibrium Variance', Amount: equationDifference }
    ];
    exportToExcel(exportData, `Balance_Sheet_${asOnDate}`);
  };

  const handleExportCSV = () => {
    const exportData = [
      { Section: 'Assets', Item: 'Cash in Hand', Amount: cashTotal },
      { Section: 'Assets', Item: 'Bank Balances', Amount: bankTotal },
      { Section: 'Assets', Item: 'Trade Receivables', Amount: receivablesTotal },
      { Section: 'Assets', Item: 'Merchandise Inventory', Amount: inventoryTotal },
      { Section: 'Assets', Item: 'Input GST Receivables', Amount: gstInputAssets },
      { Section: 'Assets', Item: 'Fixed Assets', Amount: fixedAssets },
      { Section: 'Assets', Item: 'Other Assets', Amount: otherAssets },
      { Section: 'Assets Total', Item: 'TOTAL ASSETS', Amount: totalAssets },
      { Section: 'Liabilities', Item: 'Trade Payables', Amount: payablesTotal },
      { Section: 'Liabilities', Item: 'GST Output Payable', Amount: gstPayable },
      { Section: 'Liabilities', Item: 'Bank Loans & Borrowings', Amount: bankLoan },
      { Section: 'Liabilities', Item: 'Other Liabilities', Amount: otherLiabilities },
      { Section: 'Liabilities Total', Item: 'TOTAL LIABILITIES', Amount: totalLiabilities },
      { Section: 'Equity', Item: 'Owner Capital', Amount: ownerCapital },
      { Section: 'Equity', Item: 'Retained Earnings', Amount: retainedEarnings },
      { Section: 'Equity', Item: 'Current Period Net Profit (P&L)', Amount: currentProfit },
      { Section: 'Equity Total', Item: 'TOTAL EQUITY', Amount: totalEquity }
    ];
    exportToCSV(exportData, `Balance_Sheet_${asOnDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            Balance Sheet (Statement of Financial Position)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Summary of company assets, liabilities, and owner equity demonstrating financial solvency.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>As on Date:</span>
            <input
              type="date"
              value={asOnDate}
              onChange={e => setAsOnDate(e.target.value)}
              className="px-2 py-0.5 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white font-medium"
            />
          </div>

          <button
            type="button"
            onClick={handleExportXLSX}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap cursor-pointer select-none hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Visual Balance Banner (Prompt #32 - Genuine equation check) */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isBalanced
            ? 'bg-blue-50/70 border-blue-200 text-blue-950'
            : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white ${
              isBalanced ? 'bg-blue-600' : 'bg-rose-600'
            }`}
          >
            {isBalanced ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {isBalanced ? 'Accounting Equation Balanced!' : `Balance Sheet difference of ${formatCurrency(Math.abs(equationDifference))}`}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded-full text-white ${
                  isBalanced ? 'bg-blue-600' : 'bg-rose-600'
                }`}
              >
                ASSETS = LIABILITIES + EQUITY
              </span>
            </div>
            <p className="text-xs mt-0.5 text-slate-700">
              {isBalanced
                ? 'Net company assets are fully funded through third-party debt and retained shareholder equity without discrepancies.'
                : `Variance detected: Assets (${formatCurrency(totalAssets)}) do not equal Liabilities + Equity (${formatCurrency(totalLiabilities + totalEquity)}). Review unposted journal entries or capital transactions.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono self-end md:self-auto text-xs sm:text-sm">
          <div className="text-right">
            <span className="text-[10px] text-blue-700 uppercase font-sans font-bold block">Assets</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(totalAssets)}</span>
          </div>
          <div className={`text-lg font-light ${isBalanced ? 'text-blue-600' : 'text-rose-600'}`}>
            {isBalanced ? '=' : '≠'}
          </div>
          <div className="text-right">
            <span className="text-[10px] text-blue-700 uppercase font-sans font-bold block">Liabilities ({formatCurrency(totalLiabilities)}) + Equity ({formatCurrency(totalEquity)})</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(totalLiabilities + totalEquity)}</span>
          </div>
        </div>
      </div>

      {/* Two Column Balance Sheet Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS COLUMN */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                Assets (Application of Funds)
              </h2>
              <span className="text-xs font-mono font-bold text-blue-700">{formatCurrency(totalAssets)}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Current Assets */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">
                  1. Current Assets
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Cash in Hand & Counter Drawers</span>
                    <span className="font-mono font-semibold">{formatCurrency(cashTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Bank Balances (Operating & Savings)</span>
                    <span className="font-mono font-semibold">{formatCurrency(bankTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Trade Receivables (Customers)</span>
                    <span className="font-mono font-semibold">{formatCurrency(receivablesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Merchandise Stock (Valuation)</span>
                    <span className="font-mono font-semibold">{formatCurrency(inventoryTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Input GST Tax Credit Assets</span>
                    <span className="font-mono font-semibold">{formatCurrency(gstInputAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Non-Current Assets */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">
                  2. Non-Current / Fixed Assets
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Warehouse Equipment & Fixtures</span>
                    <span className="font-mono font-semibold">{formatCurrency(fixedAssets)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Other Long-Term Assets & Deposits</span>
                    <span className="font-mono font-semibold">{formatCurrency(otherAssets)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-900">
            <span>Total Assets</span>
            <span className="font-mono text-sm text-blue-700">{formatCurrency(totalAssets)}</span>
          </div>
        </div>

        {/* LIABILITIES & EQUITY COLUMN */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-700 inline-block"></span>
                Liabilities & Equity (Source of Funds)
              </h2>
              <span className="text-xs font-mono font-bold text-slate-800">{formatCurrency(totalLiabilities + totalEquity)}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Current Liabilities */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">
                  1. Current Liabilities
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Trade Payables (Suppliers)</span>
                    <span className="font-mono font-semibold">{formatCurrency(payablesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>GST Output Tax Payable</span>
                    <span className="font-mono font-semibold">{formatCurrency(gstPayable)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Other Short-Term Liabilities</span>
                    <span className="font-mono font-semibold">{formatCurrency(otherLiabilities)}</span>
                  </div>
                </div>
              </div>

              {/* Non-Current Liabilities */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">
                  2. Non-Current Liabilities
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Bank Loans & Term Borrowings</span>
                    <span className="font-mono font-semibold">{formatCurrency(bankLoan)}</span>
                  </div>
                </div>
              </div>

              {/* Shareholder Equity */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">
                  3. Shareholder Equity
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Owner / Share Capital</span>
                    <span className="font-mono font-semibold">{formatCurrency(ownerCapital)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Retained Earnings & Reserves</span>
                    <span className="font-mono font-semibold">{formatCurrency(retainedEarnings)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Current Period Net Profit (P&L)</span>
                    <span className="font-mono font-semibold text-emerald-600">{formatCurrency(currentProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-900">
            <span>Total Liabilities & Equity</span>
            <span className="font-mono text-sm text-slate-900">{formatCurrency(totalLiabilities + totalEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
