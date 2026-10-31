import React, { useState } from 'react';
import { FileText, ArrowRight, Check, Printer, Clock, Search } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { SalesInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SalesQuotationsTabProps {
  onNewQuotation: () => void;
}

export const SalesQuotationsTab: React.FC<SalesQuotationsTabProps> = ({ onNewQuotation }) => {
  const { salesInvoices, createSalesInvoice } = useERP();
  const [search, setSearch] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const quotations = salesInvoices.filter(inv => inv.docType === 'quotation');

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase();
    return q.invoiceNumber.toLowerCase().includes(s) || q.customerName.toLowerCase().includes(s);
  });

  const handleConvertToInvoice = async (quote: SalesInvoice) => {
    setConvertingId(quote.id);
    try {
      const invoicePayload: Omit<SalesInvoice, 'id' | 'createdAt'> = {
        ...quote,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        docType: 'tax_invoice',
        date: new Date().toISOString().split('T')[0],
        paymentStatus: 'Unpaid'
      };
      await createSalesInvoice(invoicePayload);
      alert(`Quotation ${quote.invoiceNumber} successfully converted to Tax Invoice!`);
    } catch (err: any) {
      alert(`Error converting quotation: ${err?.message}`);
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotations by quote # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={onNewQuotation}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Quotations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Items Count</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No quotations found. Click "+ New Quotation" to create price quotes.
                  </td>
                </tr>
              ) : (
                filtered.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {q.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {q.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {formatDate(q.date)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {q.items.length} items
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(q.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={convertingId === q.id}
                        onClick={() => handleConvertToInvoice(q)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Convert to Invoice</span>
                      </button>
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

