import React, { useState } from 'react';
import {
  X,
  PackageCheck,
  AlertTriangle,
  Check,
  Building2,
  Calendar,
  Store,
  Clock,
  ArrowRight
} from 'lucide-react';
import { PurchaseInvoice } from '../../types';
import { formatDate } from '../../utils/formatters';

interface ConfirmReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseInvoice | null;
  onConfirm: () => Promise<void>;
  onOpenUpdateModal?: () => void;
  isSaved?: boolean;
}

export const ConfirmReceivedModal: React.FC<ConfirmReceivedModalProps> = ({
  isOpen,
  onClose,
  po,
  onConfirm,
  onOpenUpdateModal,
  isSaved = true
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !po) return null;

  // Evaluation of items and received quantities
  const evaluatedItems = po.items.map(it => {
    const ordered = it.orderedQty ?? it.qty;
    const received = it.receivedQty !== undefined ? it.receivedQty : 0;
    const pending = Math.max(0, ordered - received);
    const isFull = received >= ordered && ordered > 0;
    const isPartial = received > 0 && received < ordered;
    return {
      ...it,
      ordered,
      received,
      pending,
      isFull,
      isPartial
    };
  });

  const hasAnyReceived = evaluatedItems.some(it => it.received > 0);
  const allFullyReceived = evaluatedItems.every(it => it.isFull);
  const totalOutstanding = evaluatedItems.reduce((sum, it) => sum + it.pending, 0);

  const handleConfirm = async () => {
    if (!hasAnyReceived) {
      setErrorMsg('No received quantities have been entered. Please enter actual received quantities before confirming receipt.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to confirm receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <PackageCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Goods Receipt
              </h2>
              <p className="text-xs text-slate-500">
                Verify supplier delivery and update warehouse inventory
              </p>
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
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier & Order Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Supplier
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                {po.supplierName}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                PO Number
              </span>
              <p className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs mt-0.5">
                {po.invoiceNumber}
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
          </div>

          {/* Products & Actual Received Quantities Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Products & Actual Received Quantities
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
                  {evaluatedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {item.productName}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-slate-600 dark:text-slate-300">
                        {item.ordered}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.received}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500">
                        {item.unit || 'Piece'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium">
                        {item.isFull ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Complete
                          </span>
                        ) : item.isPartial ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            Partial ({item.pending} pending)
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold">
                            0 Received
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery information saved confirmation */}
          {isSaved && (
            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 rounded-xl flex items-center gap-2.5 text-purple-900 dark:text-purple-300">
              <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 stroke-[2.5]" />
              <span className="text-[11px] font-medium">
                Delivery and billing details have been saved successfully.
              </span>
            </div>
          )}

          {/* Validation Notice or Confirmation Banner */}
          {!hasAnyReceived ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-2">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Received quantities have not been entered</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    You cannot confirm receipt until actual received quantities have been specified. Please open the Update form to enter the received quantities delivered by the supplier.
                  </p>
                </div>
              </div>
              {onOpenUpdateModal && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUpdateModal();
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Update Received Quantities</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : allFullyReceived ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
              <span className="text-[11px] font-medium">
                All ordered items are marked as fully received. Inventory in <strong>{po.warehouse || 'Main Warehouse'}</strong> will be incremented and PO status updated to <strong>RECEIVED</strong>.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium">
                Partial delivery detected: <strong>{totalOutstanding} items</strong> remain outstanding. Inventory will be updated for the received portion and PO status set to <strong>PARTIALLY RECEIVED</strong>.
              </span>
            </div>
          )}

          <p className="text-center text-slate-600 dark:text-slate-300 font-medium text-xs pt-1">
            Are you sure you want to confirm goods receipt? This will add products to inventory.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !hasAnyReceived}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? (
              <span>Confirming...</span>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm Receipt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
