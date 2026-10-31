import React, { useState } from 'react';
import { X, Play, Trash2, Clock, User, Package, Search } from 'lucide-react';
import { HeldInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface POSHeldBillsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  heldInvoices: HeldInvoice[];
  onResume: (held: HeldInvoice) => void;
  onDelete: (id: string) => void;
}

export const POSHeldBillsDrawer: React.FC<POSHeldBillsDrawerProps> = ({
  isOpen,
  onClose,
  heldInvoices,
  onResume,
  onDelete
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = heldInvoices.filter(h => {
    const q = search.toLowerCase();
    const customer = (h.customerName || '').toLowerCase();
    const note = (h.note || '').toLowerCase();
    return customer.includes(q) || note.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-slideInRight">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Held / Parked Bills ({heldInvoices.length})
            </h3>
            <p className="text-xs text-slate-500">Resume paused customer baskets instantly.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name or note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* List of Held Invoices */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-xs">No held bills found.</p>
              <p className="text-[11px] text-slate-400">Press F4 while billing to hold an in-progress bill.</p>
            </div>
          ) : (
            filtered.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-500 transition-all space-y-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.customerName || 'Walk-in Customer'}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {formatCurrency(item.grandTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>{item.items.length} {item.items.length === 1 ? 'line item' : 'line items'}</span>
                  {item.note && <span className="truncate max-w-[150px] italic">"{item.note}"</span>}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onResume(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Bill (F5)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Discard held bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

