import React, { useState } from 'react';
import { Truck, ArrowRight, Plus, Search, Building2, PackageCheck } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface PurchaseOrdersTabProps {
  onNewPO: () => void;
  onReceivePO: (po: PurchaseInvoice) => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({ onNewPO, onReceivePO }) => {
  const { purchaseInvoices, createPurchaseInvoice } = useERP();
  const [search, setSearch] = useState('');

  const orders = purchaseInvoices.filter(inv => inv.docType === 'purchase_order');

  const filtered = orders.filter(o => {
    const s = search.toLowerCase();
    return o.invoiceNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search Bar & Action */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search POs by # or supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={onNewPO}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>New Purchase Order (PO)</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Destination Store</th>
                <th className="px-4 py-3 text-right">Items Count</th>
                <th className="px-4 py-3 text-right">Estimated Total</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No active purchase orders. Click "+ New Purchase Order" to generate supplier orders.
                  </td>
                </tr>
              ) : (
                filtered.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                      {po.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {po.supplierName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {formatDate(po.date)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {po.warehouse || 'Main Warehouse'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {po.items.length} items
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(po.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onReceivePO(po)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Receive Goods (GRN)</span>
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

