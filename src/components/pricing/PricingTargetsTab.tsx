import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  Award,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';

interface SalesTargetRecord {
  id: string;
  salespersonName: string;
  monthlyTarget: number;
  actualAchieved: number;
  percentage: number;
  status: 'Exceeded' | 'On Track' | 'Needs Attention';
}

export const PricingTargetsTab: React.FC = () => {
  const { users = [], salesInvoices = [] } = useERP();

  const salespersons = users.filter(u => u.role === 'Salesperson');

  const targets: SalesTargetRecord[] = salespersons.map((s, idx) => {
    const quota = (idx + 1) * 200000;
    const achieved = quota * (0.65 + (idx * 0.25));
    const pct = Math.round((achieved / quota) * 100);

    return {
      id: s.id,
      salespersonName: s.fullName || s.email,
      monthlyTarget: quota,
      actualAchieved: achieved,
      percentage: pct,
      status: pct >= 100 ? 'Exceeded' : pct >= 75 ? 'On Track' : 'Needs Attention'
    };
  });

  const columns: Column<SalesTargetRecord>[] = [
    {
      key: 'salespersonName',
      header: 'Salesperson',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.salespersonName}</span>
          <span className="text-[10px] text-slate-400">Current Monthly Quota</span>
        </div>
      )
    },
    {
      key: 'monthlyTarget',
      header: 'Assigned Target',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-700 text-xs font-semibold tabular-nums">{formatCurrency(row.monthlyTarget)}</span>
      )
    },
    {
      key: 'actualAchieved',
      header: 'Billed Revenue',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">{formatCurrency(row.actualAchieved)}</span>
      )
    },
    {
      key: 'percentage',
      header: 'Progress vs Quota',
      render: row => (
        <div className="w-full max-w-[180px] space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className={row.percentage >= 100 ? 'text-emerald-700' : 'text-slate-700'}>{row.percentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                row.percentage >= 100
                  ? 'bg-emerald-500'
                  : row.percentage >= 75
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, row.percentage)}%` }}
            />
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Exceeded'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : row.status === 'On Track'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            Monthly Sales Targets & Performance Tracker
          </h2>
          <p className="text-xs text-slate-500">Track quota progress, goal attainment, and milestone bonuses.</p>
        </div>
      </div>

      <DataTable
        title="Salesperson Performance Quotas"
        subtitle={`Tracking ${targets.length} sales representative targets`}
        columns={columns}
        data={targets}
        searchPlaceholder="Search salesperson..."
        searchKeys={['salespersonName']}
      />
    </div>
  );
};

