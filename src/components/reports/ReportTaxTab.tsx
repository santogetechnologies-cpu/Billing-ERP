import React, { useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Building,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const ReportTaxTab: React.FC = () => {
  const { salesInvoices = [], purchaseInvoices = [] } = useERP();

  const b2bInvoices = useMemo(() => salesInvoices.filter(s => s.customerGstin && s.customerGstin.trim().length > 5), [salesInvoices]);
  const b2cInvoices = useMemo(() => salesInvoices.filter(s => !s.customerGstin || s.customerGstin.trim().length <= 5), [salesInvoices]);

  const b2bTotalTaxable = useMemo(() => b2bInvoices.reduce((s, i) => s + (i.subtotal || 0), 0), [b2bInvoices]);
  const b2bTotalTax = useMemo(() => b2bInvoices.reduce((s, i) => s + (i.taxTotal || 0), 0), [b2bInvoices]);

  const b2cTotalTaxable = useMemo(() => b2cInvoices.reduce((s, i) => s + (i.subtotal || 0), 0), [b2cInvoices]);
  const b2cTotalTax = useMemo(() => b2cInvoices.reduce((s, i) => s + (i.taxTotal || 0), 0), [b2cInvoices]);

  const handleExportCSV = () => {
    const data = [
      { 'Section': 'B2B Registered Tax Invoices (4A, 4B, 4C)', 'Count': b2bInvoices.length, 'Taxable Value': b2bTotalTaxable, 'Tax Amount': b2bTotalTax },
      { 'Section': 'B2C Small Consumer Sales (7)', 'Count': b2cInvoices.length, 'Taxable Value': b2cTotalTaxable, 'Tax Amount': b2cTotalTax },
      { 'Section': 'Total GSTR-1 Outward Supplies', 'Count': salesInvoices.length, 'Taxable Value': b2bTotalTaxable + b2cTotalTaxable, 'Tax Amount': b2bTotalTax + b2cTotalTax }
    ];
    exportToCSV(data, 'GSTR1_Tax_Filing_Summary');
  };

  return (
    <div className="space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">B2B Registered Sales (Table 4)</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{formatCurrency(b2bTotalTaxable)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{b2bInvoices.length} invoices with customer GSTIN</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">B2C Retail Counter Sales (Table 7)</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">{formatCurrency(b2cTotalTaxable)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{b2cInvoices.length} unregistered cash sales</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">GSTR-1 JSON / CSV</span>
            <p className="text-xs text-slate-600 mt-1">Export statutory tax schedule.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export GSTR-1</span>
          </button>
        </div>
      </div>

      {/* Statutory Filing Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-900">GSTR-1 Return Filing Register</h3>
          <p className="text-xs text-slate-500">Government format breakdown for monthly or quarterly filing.</p>
        </div>

        <table className="w-full text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 text-left">GST Schedule Section</th>
              <th className="py-2.5 px-3 text-center">Invoice Count</th>
              <th className="py-2.5 px-3 text-right">Taxable Turnover</th>
              <th className="py-2.5 px-4 text-right">Tax Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900">Table 4: B2B Invoices (Registered Dealers)</td>
              <td className="py-3 px-3 text-center font-mono">{b2bInvoices.length}</td>
              <td className="py-3 px-3 text-right font-mono text-slate-800">{formatCurrency(b2bTotalTaxable)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">{formatCurrency(b2bTotalTax)}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900">Table 7: B2C (Small) Consumer Retail Sales</td>
              <td className="py-3 px-3 text-center font-mono">{b2cInvoices.length}</td>
              <td className="py-3 px-3 text-right font-mono text-slate-800">{formatCurrency(b2cTotalTaxable)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">{formatCurrency(b2cTotalTax)}</td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td className="py-3 px-4 text-slate-900">Total Outward Supplies</td>
              <td className="py-3 px-3 text-center font-mono">{salesInvoices.length}</td>
              <td className="py-3 px-3 text-right font-mono text-slate-900">{formatCurrency(b2bTotalTaxable + b2cTotalTaxable)}</td>
              <td className="py-3 px-4 text-right font-mono text-blue-700">{formatCurrency(b2bTotalTax + b2cTotalTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

