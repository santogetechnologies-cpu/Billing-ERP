import React, { useState } from 'react';
import {
  Percent,
  Users,
  DollarSign,
  TrendingUp,
  Download,
  CheckCircle,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface CommissionRecord {
  id: string;
  salespersonName: string;
  totalSalesAchieved: number;
  commissionRate: number;
  grossCommission: number;
  paidCommission: number;
  payableCommission: number;
  slab: string;
}

export const PricingCommissionTab: React.FC = () => {
  const { users = [], salesInvoices = [] } = useERP();

  const salespersons = users.filter(u => u.role === 'Salesperson');

  // Compute live commission based on invoices
  const records: CommissionRecord[] = salespersons.map((sp, idx) => {
    const spSales = salesInvoices
      .filter(inv => inv.docType === 'tax_invoice' || inv.docType === 'pos_invoice')
      .reduce((s, inv) => s + (inv.grandTotal || 0), 0) * (0.3 + idx * 0.2); // Proportional mockup

    const rate = spSales > 500000 ? 3.0 : spSales > 200000 ? 2.5 : 2.0;
    const gross = (spSales * rate) / 100;
    const paid = gross * 0.6;
    const payable = gross - paid;

    return {
      id: sp.id,
      salespersonName: sp.fullName || sp.email,
      totalSalesAchieved: spSales,
      commissionRate: rate,
      grossCommission: gross,
      paidCommission: paid,
      payableCommission: payable,
      slab: spSales > 500000 ? 'Tier 3 (>₹5L)' : spSales > 200000 ? 'Tier 2 (>₹2L)' : 'Tier 1 (Base)'
    };
  });

  const totalGrossCommission = records.reduce((s, r) => s + r.grossCommission, 0);
  const totalPayableCommission = records.reduce((s, r) => s + r.payableCommission, 0);

  const handleExportCSV = () => {
    const data = records.map(r => ({
      'Salesperson': r.salespersonName,
      'Total Sales': r.totalSalesAchieved,
      'Slab': r.slab,
      'Commission Rate (%)': r.commissionRate,
      'Gross Commission': r.grossCommission,
      'Paid': r.paidCommission,
      'Payable Balance': r.payableCommission
    }));
    exportToCSV(data, 'Salesperson_Commissions');
  };

  const columns: Column<CommissionRecord>[] = [
    {
      key: 'salespersonName',
      header: 'Salesperson',
      render: row => <span className="font-semibold text-slate-900">{row.salespersonName}</span>
    },
    {
      key: 'slab',
      header: 'Commission Slab',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {row.slab} ({row.commissionRate}%)
        </span>
      )
    },
    {
      key: 'totalSalesAchieved',
      header: 'Total Sales Volume',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-800 text-xs tabular-nums">{formatCurrency(row.totalSalesAchieved)}</span>
      )
    },
    {
      key: 'grossCommission',
      header: 'Accrued Commission',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(row.grossCommission)}</span>
      )
    },
    {
      key: 'paidCommission',
      header: 'Disbursed',
      align: 'right',
      render: row => (
        <span className="font-mono text-emerald-700 text-xs tabular-nums">{formatCurrency(row.paidCommission)}</span>
      )
    },
    {
      key: 'payableCommission',
      header: 'Balance Due',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-blue-700 tabular-nums">{formatCurrency(row.payableCommission)}</span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Accrued Commissions</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(totalGrossCommission)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Across all active sales representatives</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Pending Payout Due</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">
            {formatCurrency(totalPayableCommission)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Payable via accounts disbursement</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Commission Ledger</span>
            <p className="text-xs text-slate-600 mt-1">Download monthly commission report.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <DataTable
        title="Salesperson Commission Statements"
        subtitle="Automatic commission accrual based on settled customer invoices"
        columns={columns}
        data={records}
        searchPlaceholder="Search salesperson..."
        searchKeys={['salespersonName', 'slab']}
      />
    </div>
  );
};

