import React, { useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  ShoppingCart,
  Users
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { SalesInvoice } from '../../types';

export const ReportSalesTab: React.FC = () => {
  const { salesInvoices = [] } = useERP();

  const totalSalesRevenue = useMemo(() => {
    return salesInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  }, [salesInvoices]);

  const totalTaxCollected = useMemo(() => {
    return salesInvoices.reduce((sum, inv) => sum + (inv.taxTotal || 0), 0);
  }, [salesInvoices]);

  const handleExportCSV = () => {
    const data = salesInvoices.map(s => ({
      'Invoice #': s.invoiceNumber,
      'Date': s.date,
      'Customer': s.customerName,
      'Tax Amount': s.taxTotal,
      'Invoice Total': s.grandTotal,
      'Payment Status': s.paymentStatus,
      'Payment Mode': s.paymentMethod
    }));
    exportToCSV(data, 'Sales_Summary_Report');
  };

  const columns: Column<SalesInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.invoiceNumber}</span>
    },
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-xs text-slate-700">{formatDate(row.date)}</span>
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: row => <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.customerName}</span>
    },
    {
      key: 'taxTotal',
      header: 'Tax',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs tabular-nums">{formatCurrency(row.taxTotal || 0)}</span>
    },
    {
      key: 'grandTotal',
      header: 'Total Revenue',
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
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Billed Revenue</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(totalSalesRevenue)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{salesInvoices.length} invoices generated</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total GST Collected</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">
            {formatCurrency(totalTaxCollected)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Statutory indirect tax output</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Export Statement</span>
            <p className="text-xs text-slate-600 mt-1">Export transaction sales register.</p>
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
        title="Sales Register & Turnover Ledger"
        subtitle={`Showing ${salesInvoices.length} billed invoices`}
        columns={columns}
        data={salesInvoices}
        searchPlaceholder="Search invoice #, customer name..."
        searchKeys={['invoiceNumber', 'customerName', 'paymentStatus']}
      />
    </div>
  );
};

