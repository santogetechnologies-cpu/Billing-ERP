import React from 'react';
import { X, ShoppingBag, Truck, Calendar, Store, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { PurchaseInvoice } from '../../types';
import { formatDate } from '../../utils/formatters';

interface ViewPODetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseInvoice | null;
}

export const ViewPODetailsModal: React.FC<ViewPODetailsModalProps> = ({ isOpen, onClose, po }) => {
  if (!isOpen || !po) return null;

  const status = po.poStatus || 'Ordered';

  const getStatusBadge = () => {
    if (status === 'Received') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>RECEIVED</span>
        </span>
      );
    }
    if (status === 'Partially Received') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>PARTIALLY RECEIVED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span>ORDERED</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Purchase Order Details
                </h2>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  #{po.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">View-only Purchase Order and Delivery Summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Top Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Supplier Name
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                {po.supplierName}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Order Date
              </span>
              <p className="font-mono font-medium text-slate-700 dark:text-slate-200 text-xs mt-0.5">
                {formatDate(po.date)}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Destination Store
              </span>
              <p className="font-medium text-slate-700 dark:text-slate-200 text-xs mt-0.5 truncate">
                {po.warehouse || 'Main Warehouse'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Supplier Ref #
              </span>
              <p className="font-mono font-semibold text-purple-600 dark:text-purple-400 text-xs mt-0.5 truncate">
                {po.supplierInvoiceNumber || '—'}
              </p>
            </div>
          </div>

          {/* Delivery Status Card */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">Current Delivery Status</span>
              <span className="text-[10px] text-slate-400">
                {status === 'Received'
                  ? 'All ordered goods confirmed received into inventory'
                  : status === 'Partially Received'
                  ? 'Delivery partially completed; remaining items pending'
                  : 'Order placed with supplier; pending delivery confirmation'}
              </span>
            </div>
            <div>{getStatusBadge()}</div>
          </div>

          {/* Ordered Products Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Ordered Products ({po.items.length})
              </h3>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Product Name</th>
                    <th className="px-3.5 py-2.5 text-center">Ordered Qty</th>
                    <th className="px-3.5 py-2.5 text-center">Received Qty</th>
                    <th className="px-3.5 py-2.5">Unit</th>
                    <th className="px-3.5 py-2.5 text-right">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {po.items.map((item, idx) => {
                    const ordered = item.orderedQty ?? item.qty;
                    const received = item.receivedQty !== undefined ? item.receivedQty : (status === 'Received' ? ordered : 0);
                    const isFullyRecv = received >= ordered && ordered > 0;
                    const isPartRecv = received > 0 && received < ordered;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.productName}
                            </span>
                            {(item.isUnregistered || !item.productId || String(item.productId).startsWith('unregistered-')) && (
                              <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">
                                PO Only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {ordered}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                          {received}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500">
                          {item.unit || 'Piece'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {isFullyRecv ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Delivered</span>
                            </span>
                          ) : isPartRecv ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Partial ({ordered - received} left)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          {po.notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Purchase Order Remarks
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-xs whitespace-pre-wrap">
                {po.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

