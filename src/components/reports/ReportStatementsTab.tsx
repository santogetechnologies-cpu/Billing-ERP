import React, { useMemo } from 'react';
import {
  FileText,
  Download,
  Building,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const ReportStatementsTab: React.FC = () => {
  const { accounts = [], products = [], customers = [], suppliers = [] } = useERP();

  const totalInventoryAssets = useMemo(() => {
    return products.reduce((s, p) => s + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);
  }, [products]);

  const totalReceivables = useMemo(() => {
    return customers.reduce((s, c) => s + (c.currentOutstanding || 0), 0);
  }, [customers]);

  const totalPayables = useMemo(() => {
    return suppliers.reduce((s, sup) => s + (sup.currentOutstanding || 0), 0);
  }, [suppliers]);

  const currentAssetsTotal = totalInventoryAssets + totalReceivables + 500000; // estimated bank
  const liabilitiesTotal = totalPayables + 200000;
  const equityTotal = currentAssetsTotal - liabilitiesTotal;

  const handleExportCSV = () => {
    const data = [
      { 'Component': 'Current Assets (Cash, Bank, Inventory, Receivables)', 'Amount': currentAssetsTotal },
      { 'Component': 'Liabilities (Trade Payables, Vendor Bills)', 'Amount': liabilitiesTotal },
      { 'Component': 'Owner Equity & Retained Earnings', 'Amount': equityTotal }
    ];
    exportToCSV(data, 'Balance_Sheet_Summary');
  };

  return (
    <div className="space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Current Assets</span>
          <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">{formatCurrency(currentAssetsTotal)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Stock, bank, and customer receivables</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Liabilities</span>
          <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">{formatCurrency(liabilitiesTotal)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Accounts payable to suppliers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Net Equity & Net Worth</span>
          <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{formatCurrency(equityTotal)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Assets minus liabilities</span>
        </div>
      </div>

      {/* Financial Statement Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Summary Balance Sheet (Financial Position)</h3>
            <p className="text-xs text-slate-500">Assets = Liabilities + Equity statement.</p>
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
          <div className="p-3 bg-slate-50 font-bold text-slate-800">1. ASSETS</div>
          <div className="p-3 pl-6 flex justify-between">
            <span className="text-slate-600">Inventory Valuation @ Cost</span>
            <span className="font-mono font-medium text-slate-900">{formatCurrency(totalInventoryAssets)}</span>
          </div>
          <div className="p-3 pl-6 flex justify-between">
            <span className="text-slate-600">Accounts Receivable (Customer Outstandings)</span>
            <span className="font-mono font-medium text-slate-900">{formatCurrency(totalReceivables)}</span>
          </div>
          <div className="p-3 pl-6 flex justify-between">
            <span className="text-slate-600">Liquid Cash & Bank Balances</span>
            <span className="font-mono font-medium text-slate-900">₹5,00,000.00</span>
          </div>
          <div className="p-3.5 flex justify-between font-bold text-blue-900 bg-blue-50/50">
            <span>TOTAL ASSETS</span>
            <span className="font-mono">{formatCurrency(currentAssetsTotal)}</span>
          </div>

          <div className="p-3 bg-slate-50 font-bold text-slate-800">2. LIABILITIES & EQUITY</div>
          <div className="p-3 pl-6 flex justify-between">
            <span className="text-slate-600">Accounts Payable (Supplier Dues)</span>
            <span className="font-mono font-medium text-slate-900">{formatCurrency(totalPayables)}</span>
          </div>
          <div className="p-3 pl-6 flex justify-between">
            <span className="text-slate-600">Owner Equity & Retained Earnings</span>
            <span className="font-mono font-medium text-slate-900">{formatCurrency(equityTotal)}</span>
          </div>
          <div className="p-3.5 flex justify-between font-bold text-emerald-900 bg-emerald-50/50">
            <span>TOTAL LIABILITIES & EQUITY</span>
            <span className="font-mono">{formatCurrency(currentAssetsTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

