import React, { useState } from 'react';
import { Search, Eye, FileEdit } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseInvoice } from '../../types';
import { formatDate } from '../../utils/formatters';
import { ViewPODetailsModal } from './ViewPODetailsModal';
import { UpdatePOModal } from './UpdatePOModal';

interface PurchaseOrdersTabProps {
  onNewPO?: () => void;
  onReceivePO?: (po: PurchaseInvoice) => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({ onNewPO }) => {
  const { purchaseInvoices, receiveAndSavePurchaseOrder, deletePurchaseInvoice } = useERP();
  const [search, setSearch] = useState('');

  // Modals state
  const [viewingPO, setViewingPO] = useState<PurchaseInvoice | null>(null);
  const [updatingPO, setUpdatingPO] = useState<PurchaseInvoice | null>(null);

  const orders = purchaseInvoices.filter(inv => inv.docType === 'purchase_order');

  const filtered = orders.filter(o => {
    const s = search.toLowerCase();
    return o.invoiceNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search POs by # or supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Orders Table - Strictly 6 Columns */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Supplier / PO Number</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Destination Store</th>
                <th className="px-4 py-3">Items Count</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No active purchase orders found.
                  </td>
                </tr>
              ) : (
                filtered.map(po => {
                  const status = po.poStatus || 'Ordered';
                  const isReceived = status.toLowerCase() === 'received';
                  const isPartial = status.toLowerCase() === 'partially received';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Supplier / PO Number: Supplier Name bold on top, PO Number in small purple text underneath */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {po.supplierName}
                        </div>
                        <div className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                          {po.invoiceNumber}
                        </div>
                      </td>

                      {/* 2. Order Date */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {formatDate(po.date)}
                      </td>

                      {/* 3. Destination Store */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200 text-xs">
                        {po.warehouse || 'Main Warehouse'}
                      </td>

                      {/* 4. Items Count */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">
                        {po.items.length} {po.items.length === 1 ? 'Item' : 'Items'}
                      </td>

                      {/* 5. Status Badge */}
                      <td className="px-4 py-3">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>RECEIVED</span>
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>PARTIALLY RECEIVED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>ORDERED</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Action: Update Button (Hidden when Received) & Eye Icon (Always) */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Update Button - Only when PO is not Received */}
                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => setUpdatingPO(po)}
                              title="Update Purchase & Bill Details"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>Update</span>
                            </button>
                          )}

                          {/* Eye Icon - View Details */}
                          <button
                            type="button"
                            onClick={() => setViewingPO(po)}
                            title="View PO Details"
                            aria-label="View PO Details"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ViewPODetailsModal
        isOpen={Boolean(viewingPO)}
        onClose={() => setViewingPO(null)}
        po={viewingPO}
      />

      <UpdatePOModal
        isOpen={Boolean(updatingPO && updatingPO.poStatus?.toLowerCase() !== 'received')}
        onClose={() => setUpdatingPO(null)}
        po={updatingPO}
        onReceiveAndSave={async (data) => {
          if (!updatingPO) return;
          await receiveAndSavePurchaseOrder(updatingPO.id, data);
        }}
        onDelete={async (poId) => {
          await deletePurchaseInvoice(poId);
          setUpdatingPO(null);
        }}
      />
    </div>
  );
};
