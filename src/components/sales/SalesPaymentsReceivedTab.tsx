import React, { useState } from 'react';
import { CreditCard, Search, Check, Clock, User, ArrowDownRight } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const SalesPaymentsReceivedTab: React.FC = () => {
  const { salesInvoices } = useERP();
  const [search, setSearch] = useState('');

  const paidInvoices = salesInvoices.filter(
    inv => inv.docType !== 'credit_note' && inv.paidAmount > 0
  );

  const filtered = paidInvoices.filter(inv => {
    const s = search.toLowerCase();
    return inv.invoiceNumber.toLowerCase().includes(s) || inv.customerName.toLowerCase().includes(s);
  });

  const totalCollected = filtered.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search & Metrics Summary */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search payments by bill # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Total Payments Filtered:</span>
          <span className="text-sm font-bold font-mono text-emerald-600">
            {formatCurrency(totalCollected)}
          </span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Receipt / Bill #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3 text-right">Invoice Total</th>
                <th className="px-4 py-3 text-right text-emerald-600">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No payment receipts found.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {p.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {p.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {formatDate(p.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        {p.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">
                      {formatCurrency(p.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(p.paidAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

