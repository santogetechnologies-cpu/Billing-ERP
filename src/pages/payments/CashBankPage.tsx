import React, { useState } from 'react';
import {
  Landmark,
  Coins,
  ArrowRightLeft,
  CheckCircle,
  Plus,
  RefreshCw,
  Building,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const CashBankPage: React.FC = () => {
  const { bankAccounts, cashAccounts, payments } = useERP();
  const [activeTab, setActiveTab] = useState<'bank' | 'cash' | 'reconciliation'>('bank');

  const [reconciledItems, setReconciledItems] = useState<Record<string, boolean>>({});

  const toggleReconcile = (id: string) => {
    setReconciledItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const reconTransactions = React.useMemo(() => {
    return payments.map(p => ({
      id: p.id,
      date: p.date,
      particulars: `${p.type === 'Received' ? 'Receipt' : 'Payment'} - ${p.partyName} (${p.paymentMethod})`,
      debit: p.type === 'Received' ? p.amount : 0,
      credit: p.type === 'Paid' ? p.amount : 0,
      bankStatementMatched: Boolean(reconciledItems[p.id])
    }));
  }, [payments, reconciledItems]);

  const totalBankBalance = bankAccounts.reduce((acc, b) => acc + b.currentBalance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            Cash Accounts & Bank Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain multi-drawer cash floats, corporate bank ledgers, and reconcile bank statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('reconciliation')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Bank Reconciliation</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('bank')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 ${
            activeTab === 'bank'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 ${
            activeTab === 'cash'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Cash Drawers & Floats</span>
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 ${
            activeTab === 'reconciliation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Bank Reconciliation Statement (BRS)</span>
        </button>
      </div>

      {/* Bank Accounts Grid */}
      {activeTab === 'bank' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
          {bankAccounts.map(b => (
            <div
              key={b.id}
              className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Corporate Current Account
                  </span>
                  <h3 className="font-bold text-base text-slate-900 mt-0.5">{b.bankName}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{b.accountName}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">A/C Number:</span>
                  <span className="font-bold text-slate-800">{b.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IFSC Code:</span>
                  <span className="font-bold text-slate-800">{b.ifsc}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                <span className="font-medium text-slate-500">Ledger Balance:</span>
                <span className="text-lg font-black text-slate-900">
                  {formatCurrency(b.currentBalance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cash Accounts Grid */}
      {activeTab === 'cash' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
          {cashAccounts.map(c => (
            <div
              key={c.id}
              className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">{c.name}</h3>
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <Coins className="w-4 h-4" />
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Opening Float:</span>
                  <span>{formatCurrency(c.openingBalance)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-100">
                  <span>Current Cash:</span>
                  <span className="text-emerald-600">{formatCurrency(c.currentBalance)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bank Reconciliation Statement (BRS) */}
      {activeTab === 'reconciliation' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Bank Reconciliation Statement (BRS)
              </h2>
              <p className="text-xs text-slate-500">
                Match internal ERP book entries against uploaded bank statement clearances
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600">
                Book Balance: <strong>{formatCurrency(totalBankBalance)}</strong>
              </span>
              <span className="text-slate-600">
                Bank Passbook: <strong>{formatCurrency(totalBankBalance)}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Reconciled
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {reconTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <span>No bank transactions available to reconcile yet. Record receipts and payments to view here.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Reconciled</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Particulars & Transaction Ref</th>
                    <th className="py-2.5 px-3 text-right">Debit (Inward)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Outward)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconTransactions.map(item => {
                    const isChecked = Boolean(reconciledItems[item.id]);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleReconcile(item.id)}
                        className={`hover:bg-slate-50 cursor-pointer ${
                          isChecked ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleReconcile(item.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDate(item.date)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.particulars}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                          {item.debit > 0 ? formatCurrency(item.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          {item.credit > 0 ? formatCurrency(item.credit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isChecked
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isChecked ? 'Cleared in Bank' : 'Pending Clearance'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
