import React, { useState } from 'react';
import {
  Clock,
  User,
  DollarSign,
  Download,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportToCSV } from '../../utils/exportUtils';

interface ShiftAuditEntry {
  id: string;
  shiftCode: string;
  cashierName: string;
  terminal: string;
  startTime: string;
  endTime: string;
  openingFloat: number;
  expectedCash: number;
  actualCounted: number;
  variance: number;
  status: 'Balanced' | 'Shortage' | 'Surplus';
}

export const ReportCashierShiftsTab: React.FC = () => {
  const [shifts] = useState<ShiftAuditEntry[]>([
    {
      id: 'sh-1',
      shiftCode: 'SHIFT-2026-102',
      cashierName: 'Aarti Sharma',
      terminal: 'Counter POS 1',
      startTime: '2026-10-31 09:00 AM',
      endTime: '2026-10-31 05:00 PM',
      openingFloat: 2000,
      expectedCash: 24350,
      actualCounted: 24350,
      variance: 0,
      status: 'Balanced'
    },
    {
      id: 'sh-2',
      shiftCode: 'SHIFT-2026-101',
      cashierName: 'Ramesh Kumar',
      terminal: 'Counter POS 2',
      startTime: '2026-10-31 09:30 AM',
      endTime: '2026-10-31 05:30 PM',
      openingFloat: 2000,
      expectedCash: 18700,
      actualCounted: 18650,
      variance: -50,
      status: 'Shortage'
    },
    {
      id: 'sh-3',
      shiftCode: 'SHIFT-2026-099',
      cashierName: 'Priya Patel',
      terminal: 'Express Checkout',
      startTime: '2026-10-30 10:00 AM',
      endTime: '2026-10-30 06:00 PM',
      openingFloat: 1500,
      expectedCash: 31200,
      actualCounted: 31250,
      variance: 50,
      status: 'Surplus'
    }
  ]);

  const handleExportCSV = () => {
    const data = shifts.map(s => ({
      'Shift Code': s.shiftCode,
      'Cashier': s.cashierName,
      'Terminal': s.terminal,
      'Start': s.startTime,
      'End': s.endTime,
      'Opening Float': s.openingFloat,
      'Expected Cash': s.expectedCash,
      'Counted Cash': s.actualCounted,
      'Variance': s.variance,
      'Status': s.status
    }));
    exportToCSV(data, 'Cashier_Shift_Audit_Log');
  };

  const columns: Column<ShiftAuditEntry>[] = [
    {
      key: 'shiftCode',
      header: 'Shift Code',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.shiftCode}</span>
    },
    {
      key: 'cashierName',
      header: 'Cashier & Terminal',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.cashierName}</span>
          <span className="text-[10px] text-slate-400">{row.terminal}</span>
        </div>
      )
    },
    {
      key: 'startTime',
      header: 'Shift Duration',
      render: row => (
        <span className="text-xs text-slate-600 whitespace-nowrap">
          {row.startTime.split(' ')[1]} {row.startTime.split(' ')[2]} → {row.endTime.split(' ')[1]} {row.endTime.split(' ')[2]}
        </span>
      )
    },
    {
      key: 'openingFloat',
      header: 'Opening Float',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs tabular-nums">{formatCurrency(row.openingFloat)}</span>
    },
    {
      key: 'expectedCash',
      header: 'System Expected',
      align: 'right',
      render: row => <span className="font-mono text-slate-800 text-xs font-semibold tabular-nums">{formatCurrency(row.expectedCash)}</span>
    },
    {
      key: 'actualCounted',
      header: 'Counted Cash',
      align: 'right',
      render: row => <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">{formatCurrency(row.actualCounted)}</span>
    },
    {
      key: 'variance',
      header: 'Variance',
      align: 'right',
      render: row => (
        <span className={`font-mono font-bold text-xs tabular-nums ${
          row.variance === 0 ? 'text-emerald-600' : row.variance > 0 ? 'text-blue-600' : 'text-rose-600'
        }`}>
          {row.variance === 0 ? '₹0.00' : `${row.variance > 0 ? '+' : ''}${formatCurrency(row.variance)}`}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Audit Status',
      align: 'center',
      render: row => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Balanced'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : row.status === 'Surplus'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-xs text-slate-500 font-medium">
          Cashier shift reconciliation log with drawer counts and variance tracking
        </span>

        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      <DataTable
        title="Cashier Shift & Drawer Variance Register"
        subtitle="End-of-day register closing and physical cash audit trail"
        columns={columns}
        data={shifts}
        searchPlaceholder="Search shift code, cashier, terminal..."
        searchKeys={['shiftCode', 'cashierName', 'terminal']}
      />
    </div>
  );
};

