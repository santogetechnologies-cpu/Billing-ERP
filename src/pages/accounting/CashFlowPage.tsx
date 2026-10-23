import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Building,
  Wallet,
  ArrowRight,
  Search,
  ExternalLink,
  Receipt,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { Modal } from '../../components/common/Modal';

export const CashFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { payments, expenses, bankAccounts, cashAccounts } = useERP();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Drilldown Modal State for the 4 button cards
  const [drilldownModal, setDrilldownModal] = useState<'opening' | 'inflows' | 'outflows' | 'closing' | null>(null);
  const [inflowSearch, setInflowSearch] = useState('');
  const [outflowSearch, setOutflowSearch] = useState('');
  const [outflowTab, setOutflowTab] = useState<'all' | 'suppliers' | 'expenses'>('all');

  const isDateInPeriod = (dateStr?: string) => {
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

  const periodPayments = useMemo(() => payments.filter(p => isDateInPeriod(p.date)), [payments, period]);
  const periodExpenses = useMemo(() => expenses.filter(e => isDateInPeriod(e.date)), [expenses, period]);

  // Dynamically calculate from real payments & expenses for the period
  const customerReceipts = periodPayments
    .filter(p => p.type === 'Received')
    .reduce((sum, p) => sum + p.amount, 0);

  const supplierPayments = periodPayments
    .filter(p => p.type === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const operatingExpensesPaid = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const taxPaid = periodExpenses
    .filter(e => e.category.toLowerCase().includes('tax') || e.category.toLowerCase().includes('gst'))
    .reduce((sum, e) => sum + e.amount, 0);

  // Operating cash flow = Inflows - Outflows
  const netOperatingCash = customerReceipts - (supplierPayments + operatingExpensesPaid + taxPaid);

  // Investing activities
  const purchaseFixedAssets = periodExpenses
    .filter(e => e.category.toLowerCase().includes('asset') || e.category.toLowerCase().includes('equipment') || e.category.toLowerCase().includes('machinery'))
    .reduce((sum, e) => sum + e.amount, 0);
  const netInvestingCash = -purchaseFixedAssets;

  // Financing activities
  const loanRepayment = periodExpenses
    .filter(e => e.category.toLowerCase().includes('loan') || e.category.toLowerCase().includes('debt'))
    .reduce((sum, e) => sum + e.amount, 0);
  const netFinancingCash = -loanRepayment;

  // Overall cash flow summary
  const currentCashBank =
    cashAccounts.reduce((sum, c) => sum + c.currentBalance, 0) +
    bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  const netCashChange = netOperatingCash + netInvestingCash + netFinancingCash;
  const openingCashBank = currentCashBank - netCashChange;

  const totalInflows = customerReceipts;
  const totalOutflows = supplierPayments + operatingExpensesPaid + taxPaid + purchaseFixedAssets + loanRepayment;

  // Filtered queries for Inflows and Outflows modals
  const filteredInflowPayments = useMemo(() => {
    return periodPayments
      .filter(p => p.type === 'Received')
      .filter(p => {
        if (!inflowSearch) return true;
        const q = inflowSearch.toLowerCase();
        return (
          p.partyName?.toLowerCase().includes(q) ||
          p.paymentNumber?.toLowerCase().includes(q) ||
          p.reference?.toLowerCase().includes(q) ||
          p.paymentMethod?.toLowerCase().includes(q)
        );
      });
  }, [periodPayments, inflowSearch]);

  const inflowByMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    periodPayments
      .filter(p => p.type === 'Received')
      .forEach(p => {
        const method = p.paymentMethod || 'Cash';
        acc[method] = (acc[method] || 0) + p.amount;
      });
    return acc;
  }, [periodPayments]);

  const filteredSupplierPayments = useMemo(() => {
    return periodPayments
      .filter(p => p.type === 'Paid')
      .filter(p => {
        if (!outflowSearch) return true;
        const q = outflowSearch.toLowerCase();
        return (
          p.partyName?.toLowerCase().includes(q) ||
          p.paymentNumber?.toLowerCase().includes(q) ||
          p.reference?.toLowerCase().includes(q) ||
          p.paymentMethod?.toLowerCase().includes(q)
        );
      });
  }, [periodPayments, outflowSearch]);

  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter(e => {
      if (!outflowSearch) return true;
      const q = outflowSearch.toLowerCase();
      return (
        e.category?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.vendor?.toLowerCase().includes(q) ||
        e.paymentAccount?.toLowerCase().includes(q)
      );
    });
  }, [periodExpenses, outflowSearch]);

  const handleExportXLSX = () => {
    const exportData = [
      { Section: 'Operating Activities', Activity: 'Customer Receipts (Inflow)', Amount: customerReceipts },
      { Section: 'Operating Activities', Activity: 'Supplier Payments (Outflow)', Amount: -supplierPayments },
      { Section: 'Operating Activities', Activity: 'Operating Expenses Paid', Amount: -operatingExpensesPaid },
      { Section: 'Operating Activities', Activity: 'Tax Paid to Govt', Amount: -taxPaid },
      { Section: 'Operating Activities Total', Activity: 'Net Cash from Operating Activities', Amount: netOperatingCash },
      { Section: 'Investing Activities', Activity: 'Purchase of Equipment & Assets', Amount: -purchaseFixedAssets },
      { Section: 'Investing Activities Total', Activity: 'Net Cash from Investing Activities', Amount: netInvestingCash },
      { Section: 'Financing Activities', Activity: 'Loan & Debt Repayments', Amount: -loanRepayment },
      { Section: 'Financing Activities Total', Activity: 'Net Cash from Financing Activities', Amount: netFinancingCash },
      { Section: 'Summary', Activity: 'Net Increase/Decrease in Cash', Amount: netCashChange },
      { Section: 'Summary', Activity: 'Opening Cash & Bank Balance', Amount: openingCashBank },
      { Section: 'Summary', Activity: 'Closing Cash & Bank Balance', Amount: currentCashBank }
    ];
    exportToExcel(exportData, `Cash_Flow_${period}`);
  };

  const handleExportCSV = () => {
    const exportData = [
      { Activity: 'Customer Receipts', Amount: customerReceipts },
      { Activity: 'Supplier Payments', Amount: -supplierPayments },
      { Activity: 'Operating Expenses', Amount: -operatingExpensesPaid },
      { Activity: 'Tax Paid', Amount: -taxPaid },
      { Activity: 'Net Operating Cash', Amount: netOperatingCash },
      { Activity: 'Purchase of Assets', Amount: -purchaseFixedAssets },
      { Activity: 'Net Investing Cash', Amount: netInvestingCash },
      { Activity: 'Loan Repayment', Amount: -loanRepayment },
      { Activity: 'Net Financing Cash', Amount: netFinancingCash },
      { Activity: 'Net Cash Change', Amount: netCashChange },
      { Activity: 'Opening Cash & Bank', Amount: openingCashBank },
      { Activity: 'Closing Cash & Bank', Amount: currentCashBank }
    ];
    exportToCSV(exportData, `Cash_Flow_${period}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Cash Flow Statement
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Analysis of cash receipts and cash disbursements across Operating, Investing, and Financing activities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Current Month
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === 'quarter' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === 'year' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              FY 2026-27
            </button>
          </div>

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
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Highlight Cards - Interactive Action Buttons (Prompt #33) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* BUTTON 1: Opening Cash & Bank */}
        <button
          type="button"
          onClick={() => setDrilldownModal('opening')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] select-none"
          title="Click to view Opening Cash & Bank details and accounts breakdown"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider group-hover:text-blue-600 transition-colors">
              Opening Cash & Bank
            </span>
            <Building className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <span className="text-xl font-black text-slate-900 block font-mono">
            {formatCurrency(openingCashBank)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Period Beginning</span>
            <span className="text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 2: Total Cash Inflows (+) */}
        <button
          type="button"
          onClick={() => setDrilldownModal('inflows')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] select-none"
          title="Click to view Cash Inflows, customer receipts and payment channels"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider group-hover:text-emerald-700 transition-colors">
              Total Cash Inflows (+)
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xl font-black text-emerald-700 block font-mono">
            {formatCurrency(totalInflows)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Customer receipts & income
            </span>
            <span className="text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Details <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 3: Total Cash Outflows (-) */}
        <button
          type="button"
          onClick={() => setDrilldownModal('outflows')}
          className="text-left bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] select-none"
          title="Click to view Cash Outflows, vendor disbursements and operational spend"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider group-hover:text-rose-700 transition-colors">
              Total Cash Outflows (-)
            </span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xl font-black text-rose-700 block font-mono">
            {formatCurrency(totalOutflows)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-rose-600 font-semibold flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Suppliers, expenses, debt
            </span>
            <span className="text-rose-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Details <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>

        {/* BUTTON 4: Closing Cash & Bank */}
        <button
          type="button"
          onClick={() => setDrilldownModal('closing')}
          className="text-left bg-slate-900 hover:bg-slate-850 text-white p-4 rounded-xl shadow-2xs space-y-1 hover:ring-2 hover:ring-emerald-400/50 transition-all cursor-pointer group active:scale-[0.99] select-none"
          title="Click to view Closing Cash & Bank position across all accounts"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider group-hover:text-emerald-300 transition-colors">
              Closing Cash & Bank
            </span>
            <Wallet className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-xl font-black text-emerald-400 block font-mono">
            {formatCurrency(currentCashBank)}
          </span>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-300">
              Net Change: {netCashChange >= 0 ? '+' : ''}{formatCurrency(netCashChange)}
            </span>
            <span className="text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Live Position <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>
      </div>

      {/* Structured Cash Flow Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Cash Flow by Activity Classification (Amount in ₹ INR)
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            Method: Direct Cash Receipts & Disbursements
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/60 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-2/3">Activity Description</th>
                <th className="py-2.5 px-4 text-right">Inflow / (Outflow)</th>
                <th className="py-2.5 px-4 text-right">Net Subtotal (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {/* SECTION A: OPERATING ACTIVITIES */}
              <tr className="bg-emerald-50/40 font-sans font-bold text-slate-900">
                <td colSpan={3} className="py-2.5 px-4 uppercase text-[11px] text-emerald-900">
                  A. Cash Flows from Operating Activities
                </td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Cash Received from Customers (Sales Invoices & POS Collections)</td>
                <td className="py-2 px-4 text-right text-emerald-700 font-bold">{formatCurrency(customerReceipts)}</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Cash Paid to Merchandise Suppliers & Vendors</td>
                <td className="py-2 px-4 text-right text-rose-700 font-semibold">({formatCurrency(supplierPayments)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Cash Paid for Warehouse Leases, Wages & Utilities</td>
                <td className="py-2 px-4 text-right text-rose-700 font-semibold">({formatCurrency(operatingExpensesPaid)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Income Tax & Statutory GST Dues Paid</td>
                <td className="py-2 px-4 text-right text-rose-700 font-semibold">({formatCurrency(taxPaid)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr className="bg-emerald-50/70 font-bold text-emerald-950 border-t border-emerald-200">
                <td className="py-2 px-4 font-sans uppercase text-[11px]">Net Cash Provided by Operating Activities (A)</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
                <td className="py-2 px-4 text-right text-emerald-800">{formatCurrency(netOperatingCash)}</td>
              </tr>

              {/* SECTION B: INVESTING ACTIVITIES */}
              <tr className="bg-blue-50/40 font-sans font-bold text-slate-900">
                <td colSpan={3} className="py-2.5 px-4 uppercase text-[11px] text-blue-900">
                  B. Cash Flows from Investing Activities
                </td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Purchase of Warehouse & Office Fixed Assets</td>
                <td className="py-2 px-4 text-right text-rose-700 font-semibold">({formatCurrency(purchaseFixedAssets)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr className="bg-blue-50/70 font-bold text-blue-950 border-t border-blue-200">
                <td className="py-2 px-4 font-sans uppercase text-[11px]">Net Cash Used in Investing Activities (B)</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
                <td className="py-2 px-4 text-right text-rose-700">({formatCurrency(Math.abs(netInvestingCash))})</td>
              </tr>

              {/* SECTION C: FINANCING ACTIVITIES */}
              <tr className="bg-purple-50/40 font-sans font-bold text-slate-900">
                <td colSpan={3} className="py-2.5 px-4 uppercase text-[11px] text-purple-900">
                  C. Cash Flows from Financing Activities
                </td>
              </tr>
              <tr>
                <td className="py-2 px-6 font-sans text-slate-700">Repayment of Loans & Borrowings</td>
                <td className="py-2 px-4 text-right text-rose-700 font-semibold">({formatCurrency(loanRepayment)})</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
              </tr>
              <tr className="bg-purple-50/70 font-bold text-purple-950 border-t border-purple-200">
                <td className="py-2 px-4 font-sans uppercase text-[11px]">Net Cash Used in Financing Activities (C)</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
                <td className="py-2 px-4 text-right text-rose-700">({formatCurrency(Math.abs(netFinancingCash))})</td>
              </tr>

              {/* RECONCILIATION SUMMARY */}
              <tr className="bg-slate-100 font-bold text-slate-900">
                <td className="py-2.5 px-4 font-sans uppercase text-[11px]">Net Increase / (Decrease) in Cash (A + B + C)</td>
                <td className="py-2.5 px-4 text-right text-slate-400">—</td>
                <td className={`py-2.5 px-4 text-right font-black ${netCashChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {netCashChange >= 0 ? '+' : ''}{formatCurrency(netCashChange)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-sans text-slate-600">Cash and Cash Equivalents at Beginning of Period</td>
                <td className="py-2 px-4 text-right text-slate-400">—</td>
                <td className="py-2 px-4 text-right font-semibold text-slate-700">{formatCurrency(openingCashBank)}</td>
              </tr>
              <tr className="bg-slate-900 text-white font-mono font-bold text-xs border-t-2 border-slate-900">
                <td className="py-3 px-4 font-sans uppercase tracking-wider">
                  Cash and Cash Equivalents at End of Period
                </td>
                <td className="py-3 px-4 text-right text-slate-400">—</td>
                <td className="py-3 px-4 text-right text-emerald-400 text-sm font-black">{formatCurrency(currentCashBank)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILLDOWN MODAL 1: Opening Cash & Bank */}
      <Modal
        isOpen={drilldownModal === 'opening'}
        onClose={() => setDrilldownModal(null)}
        title="Opening Cash & Bank Balance Breakdown"
        subtitle="Audited cash equivalents and ledger balances at the start of the selected period"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setDrilldownModal(null);
                navigate('/cash-bank');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Manage Bank & Cash Accounts</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Formula & Summary Callout */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-blue-600" />
                Accounting Reconciliation Formula
              </span>
              <span className="font-mono text-sm">{formatCurrency(openingCashBank)}</span>
            </div>
            <p className="text-xs text-blue-700/90 leading-relaxed font-mono">
              Opening Balance = Closing Balance ({formatCurrency(currentCashBank)}) - Net Period Cash Flow ({netCashChange >= 0 ? '+' : ''}{formatCurrency(netCashChange)})
            </p>
          </div>

          {/* Accounts Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Commercial Bank Accounts ({bankAccounts.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">Reconciled with General Ledger</span>
            </h3>

            {bankAccounts.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                No bank accounts registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Bank & Account Name</th>
                      <th className="py-2 px-3">Account No / IFSC</th>
                      <th className="py-2 px-3 text-right">Opening Balance</th>
                      <th className="py-2 px-3 text-right">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {bankAccounts.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                          {b.bankName}
                          <span className="block text-[11px] font-normal text-slate-500">{b.accountName}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {b.accountNumber}
                          <span className="block text-[10px] text-slate-400 font-sans">{b.ifsc}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-700">
                          {formatCurrency(b.openingBalance || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {formatCurrency(b.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cash Drawers / Petty Cash */}
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pt-2 flex items-center justify-between">
              <span>Cash in Hand & Registers ({cashAccounts.length})</span>
            </h3>

            {cashAccounts.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                No cash registers registered.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Register Name</th>
                      <th className="py-2 px-3 text-right">Opening Balance</th>
                      <th className="py-2 px-3 text-right">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {cashAccounts.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">{c.name}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-700">
                          {formatCurrency(c.openingBalance || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {formatCurrency(c.currentBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 2: Total Cash Inflows (+) */}
      <Modal
        isOpen={drilldownModal === 'inflows'}
        onClose={() => setDrilldownModal(null)}
        title="Total Cash Inflows Breakdown"
        subtitle="Customer invoice settlements, POS collections and operational cash receipts"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDrilldownModal(null);
                  navigate('/sales');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Sales Invoices</span>
              </button>
              <button
                onClick={() => {
                  setDrilldownModal(null);
                  navigate('/payments');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Customer Receipt</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Receipts</span>
              <span className="text-base font-black text-emerald-900 font-mono block">
                {formatCurrency(totalInflows)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Collections Count</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {periodPayments.filter(p => p.type === 'Received').length} Entries
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Cash Collections</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {formatCurrency(inflowByMethod['Cash'] || 0)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">UPI / Bank / Card</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {formatCurrency(
                  totalInflows - (inflowByMethod['Cash'] || 0)
                )}
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer name, voucher #, reference or mode..."
                value={inflowSearch}
                onChange={e => setInflowSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Inflows Table */}
          {filteredInflowPayments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <ArrowUpRight className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">No customer receipts found for this period</p>
              <p className="text-[11px] text-slate-400">
                Customer payments recorded against sales invoices will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer / Party</th>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Inflow Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredInflowPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {p.partyName || 'Counter Customer'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{p.paymentNumber || p.reference || '—'}</td>
                      <td className="py-2 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        +{formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 3: Total Cash Outflows (-) */}
      <Modal
        isOpen={drilldownModal === 'outflows'}
        onClose={() => setDrilldownModal(null)}
        title="Total Cash Outflows Breakdown"
        subtitle="Disbursements across vendor bills, operational expenses, asset capex & debts"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDrilldownModal(null);
                  navigate('/purchases');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Supplier Purchases</span>
              </button>
              <button
                onClick={() => {
                  setDrilldownModal(null);
                  navigate('/expenses');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Expense</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Outflow Category Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">Supplier Payments</span>
              <span className="text-base font-black text-rose-900 font-mono block">
                {formatCurrency(supplierPayments)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Operating Costs</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {formatCurrency(operatingExpensesPaid)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Tax / GST Paid</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {formatCurrency(taxPaid)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">CapEx & Loans</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {formatCurrency(purchaseFixedAssets + loanRepayment)}
              </span>
            </div>
          </div>

          {/* Subtabs & Search Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setOutflowTab('all')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                  outflowTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Disbursements
              </button>
              <button
                onClick={() => setOutflowTab('suppliers')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                  outflowTab === 'suppliers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Suppliers ({periodPayments.filter(p => p.type === 'Paid').length})
              </button>
              <button
                onClick={() => setOutflowTab('expenses')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                  outflowTab === 'expenses' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Expenses ({periodExpenses.length})
              </button>
            </div>

            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search vendor, description or category..."
                value={outflowSearch}
                onChange={e => setOutflowSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:border-rose-400 transition-colors"
              />
            </div>
          </div>

          {/* Outflow Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Payee / Vendor / Category</th>
                  <th className="py-2.5 px-3">Account / Mode</th>
                  <th className="py-2.5 px-3 text-right">Outflow (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Supplier Payments */}
                {(outflowTab === 'all' || outflowTab === 'suppliers') &&
                  filteredSupplierPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-2 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">
                          Supplier
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {p.partyName || 'Vendor Payment'}
                        <span className="block text-[10px] text-slate-400 font-mono">{p.paymentNumber}</span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">{p.paymentMethod}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700">
                        ({formatCurrency(p.amount)})
                      </td>
                    </tr>
                  ))}

                {/* Operating Expenses */}
                {(outflowTab === 'all' || outflowTab === 'expenses') &&
                  filteredExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-600">{formatDate(e.date)}</td>
                      <td className="py-2 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800">
                          Expense
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                        {e.category}
                        <span className="block text-[10px] text-slate-400 font-sans">{e.description || e.vendor}</span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">{e.paymentAccount || 'Cash'}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700">
                        ({formatCurrency(e.amount)})
                      </td>
                    </tr>
                  ))}

                {filteredSupplierPayments.length === 0 && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-sans">
                      No outflow transactions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 4: Closing Cash & Bank */}
      <Modal
        isOpen={drilldownModal === 'closing'}
        onClose={() => setDrilldownModal(null)}
        title="Closing Cash & Bank Position"
        subtitle="Real-time reconciled cash balances across all company accounts and cash drawers"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setDrilldownModal(null);
                navigate('/cash-bank');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Open Cash & Bank Hub</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Main treasury liquidity summary */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                Total Immediate Liquidity
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Reconciled Active
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              {formatCurrency(currentCashBank)}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Net Period Change</span>
                <span className={`font-mono font-bold ${netCashChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netCashChange >= 0 ? '+' : ''}{formatCurrency(netCashChange)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Financial Health</span>
                <span className="font-semibold text-slate-200">
                  {netCashChange >= 0 ? 'Positive Cash Flow (Surplus)' : 'Negative Cash Flow (Burn Rate)'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Holdings List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Liquid Assets Distribution
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {bankAccounts.map(b => (
                <div key={b.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{b.bankName}</p>
                      <p className="text-[11px] text-slate-500">A/C: {b.accountNumber} • {b.accountName}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {formatCurrency(b.currentBalance)}
                  </span>
                </div>
              ))}

              {cashAccounts.map(c => (
                <div key={c.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">Physical Cash Drawer</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {formatCurrency(c.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
