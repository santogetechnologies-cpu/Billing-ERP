import React, { useMemo } from 'react';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const AccountsTaxTab: React.FC = () => {
  const { salesInvoices = [], purchaseInvoices = [] } = useERP();

  // Output Tax (collected on sales)
  const outputTaxes = useMemo(() => {
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let total = 0;

    salesInvoices.forEach(s => {
      cgst += s.cgstTotal || 0;
      sgst += s.sgstTotal || 0;
      igst += s.igstTotal || 0;
      total += s.taxTotal || 0;
    });

    return { cgst, sgst, igst, total };
  }, [salesInvoices]);

  // Input Tax Credit (paid on purchases)
  const inputTaxCredit = useMemo(() => {
    let total = 0;
    purchaseInvoices.forEach(p => {
      total += p.taxTotal || 0;
    });
    return {
      cgst: total / 2,
      sgst: total / 2,
      igst: 0,
      total
    };
  }, [purchaseInvoices]);

  const netGstPayable = Math.max(0, outputTaxes.total - inputTaxCredit.total);
  const excessItc = Math.max(0, inputTaxCredit.total - outputTaxes.total);

  const handleExportCSV = () => {
    const data = [
      { 'Component': 'CGST (Central Tax)', 'Output Tax (Sales)': outputTaxes.cgst, 'Input Tax Credit (ITC)': inputTaxCredit.cgst, 'Net': outputTaxes.cgst - inputTaxCredit.cgst },
      { 'Component': 'SGST (State Tax)', 'Output Tax (Sales)': outputTaxes.sgst, 'Input Tax Credit (ITC)': inputTaxCredit.sgst, 'Net': outputTaxes.sgst - inputTaxCredit.sgst },
      { 'Component': 'IGST (Integrated Tax)', 'Output Tax (Sales)': outputTaxes.igst, 'Input Tax Credit (ITC)': inputTaxCredit.igst, 'Net': outputTaxes.igst - inputTaxCredit.igst },
      { 'Component': 'TOTAL GST', 'Output Tax (Sales)': outputTaxes.total, 'Input Tax Credit (ITC)': inputTaxCredit.total, 'Net': outputTaxes.total - inputTaxCredit.total }
    ];
    exportToCSV(data, 'GST_Tax_Computation_Report');
  };

  return (
    <div className="space-y-4">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Output GST Liability (Collected on Sales)</span>
          <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">
            {formatCurrency(outputTaxes.total)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Tax collected from customer sales</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Input Tax Credit (ITC Paid on Purchases)</span>
          <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatCurrency(inputTaxCredit.total)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Tax paid on supplier procurement</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Net GST Payable to Government</span>
          <div className={`text-xl font-bold mt-1 tabular-nums ${netGstPayable > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {netGstPayable > 0 ? formatCurrency(netGstPayable) : `₹0 (Excess ITC: ${formatCurrency(excessItc)})`}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Estimated liability for GSTR-3B filing</span>
        </div>
      </div>

      {/* Tax Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">GST Breakdown & Reconciliation Matrix</h3>
            <p className="text-xs text-slate-500">Component-wise summary for statutory tax return filing.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Statement</span>
          </button>
        </div>

        <table className="w-full text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 text-left">GST Component</th>
              <th className="py-2.5 px-3 text-right">Output Tax (Sales Liability)</th>
              <th className="py-2.5 px-3 text-right">Input Tax Credit (ITC Available)</th>
              <th className="py-2.5 px-4 text-right">Net Tax Payable / (Credit)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900">CGST (Central GST)</td>
              <td className="py-3 px-3 text-right font-mono text-slate-800">{formatCurrency(outputTaxes.cgst)}</td>
              <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatCurrency(inputTaxCredit.cgst)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                {formatCurrency(Math.max(0, outputTaxes.cgst - inputTaxCredit.cgst))}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900">SGST (State GST)</td>
              <td className="py-3 px-3 text-right font-mono text-slate-800">{formatCurrency(outputTaxes.sgst)}</td>
              <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatCurrency(inputTaxCredit.sgst)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                {formatCurrency(Math.max(0, outputTaxes.sgst - inputTaxCredit.sgst))}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900">IGST (Inter-State GST)</td>
              <td className="py-3 px-3 text-right font-mono text-slate-800">{formatCurrency(outputTaxes.igst)}</td>
              <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatCurrency(inputTaxCredit.igst)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                {formatCurrency(Math.max(0, outputTaxes.igst - inputTaxCredit.igst))}
              </td>
            </tr>
            <tr className="bg-slate-50/80 font-bold">
              <td className="py-3 px-4 text-slate-900">Total Tax Summary</td>
              <td className="py-3 px-3 text-right font-mono text-rose-700">{formatCurrency(outputTaxes.total)}</td>
              <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatCurrency(inputTaxCredit.total)}</td>
              <td className="py-3 px-4 text-right font-mono text-blue-700 text-sm">
                {formatCurrency(netGstPayable)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

