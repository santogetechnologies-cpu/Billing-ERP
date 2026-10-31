import React, { useMemo } from 'react';
import {
  ShoppingBag,
  Download,
  Calendar,
  Building2,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { PurchaseInvoice } from '../../types';

export const ReportPurchasesTab: React.FC = () => {
  const { purchaseInvoices = [] } = useERP();

  const standardBills = useMemo(() => {
    return purchaseInvoices.filter(p => p.docType !== 'purchase_return');
  }, [purchaseInvoices]);

  const totalProcurementSpend = useMemo(() => {
    return standardBills.reduce((s, p) => s + (p.grandTotal || 0), 0);
  }, [standardBills]);

  const totalInwardTax = useMemo(() => {
    return standardBills.reduce((s, p) => s + (p.taxTotal || 0), 0);
  }, [standardBills]);

  const handleExportCSV = () => {
    const data = standardBills.map(p => ({
      'Bill #': p.supplierInvoiceNumber || p.invoiceNumber,
      'Date': p.date,
      'Supplier': p.supplierName,
      'GSTIN': p.supplierGstin || 'Unregistered',
      'Tax Amount': p.taxTotal,
      'Total Amount': p.grandTotal,
      'Payment Status': p.paymentStatus
    }));
    exportToCSV(data, 'Purchases_Spend_Report');
  };

  const columns: Column<PurchaseInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Bill #',
      render: row => (
        <span className="font-mono font-bold text-blue-600 text-xs">
          {row.supplierInvoiceNumber || row.invoiceNumber}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-xs text-slate-700">{formatDate(row.date)}</span>
    },
    {
      key: 'supplierName',
      header: 'Supplier Vendor',
      render: row => <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.supplierName}</span>
    },
    {
      key: 'taxTotal',
      header: 'Inward Tax (ITC)',
      align: 'right',
      render: row => <span className="font-mono text-emerald-700 text-xs tabular-nums">{formatCurrency(row.taxTotal || 0)}</span>
    },
    {
      key: 'grandTotal',
      header: 'Total Spend',
      align: 'right',
      render: row => <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">{formatCurrency(row.grandTotal)}</span>
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {row.paymentStatus}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Procurement Spend</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(totalProcurementSpend)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{standardBills.length} vendor bills recorded</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total ITC Paid (Inward Tax)</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">
            {formatCurrency(totalInwardTax)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Eligible Input Tax Credit</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Spend Analysis</span>
            <p className="text-xs text-slate-600 mt-1">Export vendor procurement report.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <DataTable
        title="Procurement Spend & Supplier Bill Register"
        subtitle={`Showing ${standardBills.length} purchase invoices`}
        columns={columns}
        data={standardBills}
        searchPlaceholder="Search bill #, supplier..."
        searchKeys={['invoiceNumber', 'supplierName', 'paymentStatus']}
      />
    </div>
  );
};

