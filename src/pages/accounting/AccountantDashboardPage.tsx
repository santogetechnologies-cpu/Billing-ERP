import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Building2,
  BookOpen,
  Receipt,
  FileSpreadsheet,
  ArrowUpRight,
  TrendingUp,
  Percent
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { supplierBillService, SupplierBillSummary } from '../../services/supplierBillService';
import { SupplierBillsSection } from '../../components/accounting/SupplierBillsSection';

export const AccountantDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { company } = useERP();

  const [summary, setSummary] = useState<SupplierBillSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await supplierBillService.getSupplierBills(company?.id);
        if (mounted) setSummary(data);
      } catch (e) {
        console.warn('Failed to load accountant summary:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [company?.id]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-2 border border-blue-400/30">
            Accountant Financial Workspace
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Accounts Payable & Supplier Bill Settlement
          </h1>
          <p className="text-xs text-blue-200/80 mt-1 max-w-2xl">
            Streamlined workflow connecting Warehouse Manager purchase requests and Purchase Manager orders directly to the finance desk for invoice verification and payment disbursement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/cash-bank')}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-blue-300" />
            <span>Cash & Bank Balances</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/accounting/ledger')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>General Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Pending Review */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Pending Review
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {summary ? summary.counts.pendingReview : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Amount: <strong className="text-slate-800">{summary ? formatCurrency(summary.totals.pendingReviewAmount) : '—'}</strong>
          </div>
        </div>

        {/* 2. Approved for Payment */}
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Ready to Pay
            </span>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {summary ? summary.counts.approvedForPayment : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Payable: <strong className="text-blue-700">{summary ? formatCurrency(summary.totals.approvedAmount) : '—'}</strong>
          </div>
        </div>

        {/* 3. Partially Paid */}
        <div className="bg-white p-4 rounded-xl border border-purple-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              Partially Paid
            </span>
            <Receipt className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {summary ? summary.counts.partiallyPaid : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Balance: <strong className="text-purple-700">{summary ? formatCurrency(summary.totals.partiallyPaidAmount) : '—'}</strong>
          </div>
        </div>

        {/* 4. Overdue */}
        <div className={`p-4 rounded-xl border shadow-2xs ${
          (summary?.counts.overdue || 0) > 0 ? 'bg-rose-50/50 border-rose-300' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Overdue Bills
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700">
            {summary ? summary.counts.overdue : '—'}
          </div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            Due: <strong>{summary ? formatCurrency(summary.totals.overdueAmount) : '—'}</strong>
          </div>
        </div>

        {/* 5. Paid */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Settled / Paid
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {summary ? summary.counts.paid : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Disbursed: <strong className="text-emerald-700">{summary ? formatCurrency(summary.totals.paidAmount) : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Main Supplier Bills & Payments Section */}
      <SupplierBillsSection initialTab="Pending Review" />
    </div>
  );
};
