import React, { useState } from 'react';
import {
  Building,
  CreditCard,
  Plus,
  Search,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';

interface BankAccountItem {
  id: string;
  name: string;
  accountType: 'Bank Current' | 'Cash Drawer' | 'Petty Cash' | 'UPI Merchant';
  accountNumber: string;
  bankName: string;
  currentBalance: number;
  status: 'Active' | 'Reconciled';
}

export const AccountsBankTab: React.FC = () => {
  const { company, payments = [] } = useERP();

  const [accounts, setAccounts] = useState<BankAccountItem[]>([
    {
      id: 'b1',
      name: company?.accountName || 'Primary Operating Account',
      accountType: 'Bank Current',
      accountNumber: company?.accountNumber ? `••••${company.accountNumber.slice(-4)}` : '••••8921',
      bankName: company?.bankName || 'HDFC Bank',
      currentBalance: 485200,
      status: 'Reconciled'
    },
    {
      id: 'b2',
      name: 'Counter Cash Drawer (Main Shop)',
      accountType: 'Cash Drawer',
      accountNumber: 'CASH-01',
      bankName: 'Counter Float',
      currentBalance: 24350,
      status: 'Active'
    },
    {
      id: 'b3',
      name: 'Petty Cash Fund',
      accountType: 'Petty Cash',
      accountNumber: 'PC-OFFICE',
      bankName: 'Cash Office',
      currentBalance: 5000,
      status: 'Active'
    },
    {
      id: 'b4',
      name: 'UPI QR Merchant Settlement',
      accountType: 'UPI Merchant',
      accountNumber: company?.upiId || 'billing@upi',
      bankName: 'Instant UPI Settlement',
      currentBalance: 12450,
      status: 'Reconciled'
    }
  ]);

  const totalLiquidity = accounts.reduce((s, a) => s + a.currentBalance, 0);

  const columns: Column<BankAccountItem>[] = [
    {
      key: 'name',
      header: 'Account / Description',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.bankName} • {row.accountNumber}</span>
        </div>
      )
    },
    {
      key: 'accountType',
      header: 'Account Type',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
          {row.accountType}
        </span>
      )
    },
    {
      key: 'currentBalance',
      header: 'Available Balance',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatCurrency(row.currentBalance)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{row.status}</span>
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metric Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-500 font-medium">Total Liquid Capital (Cash & Bank)</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatCurrency(totalLiquidity)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Across all operating cash and bank accounts</span>
        </div>
      </div>

      <DataTable
        title="Cash & Banking Directory"
        subtitle="Current operating bank accounts, liquid cash in hand, and settlement channels"
        columns={columns}
        data={accounts}
        searchPlaceholder="Search bank or account..."
        searchKeys={['name', 'bankName', 'accountType']}
      />
    </div>
  );
};

