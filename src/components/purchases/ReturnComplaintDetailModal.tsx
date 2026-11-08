import React, { useState } from 'react';
import {
  X,
  Eye,
  FileText,
  User,
  Phone,
  Calendar,
  Package,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ZoomIn,
  ShieldAlert,
  Layers,
  ArrowRight
} from 'lucide-react';
import { CustomerReturn } from '../../types';
import { formatDate } from '../../utils/formatters';

interface ReturnComplaintDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnRecord: CustomerReturn | null;
  onStatusChange?: (returnId: string, newStatus: 'Approved' | 'Rejected', remarks?: string) => Promise<void>;
  canManageStatus?: boolean;
}

export const ReturnComplaintDetailModal: React.FC<ReturnComplaintDetailModalProps> = ({
  isOpen,
  onClose,
  returnRecord,
  onStatusChange,
  canManageStatus = false
}) => {
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!isOpen || !returnRecord) return null;

  const photos = returnRecord.photos || [];
  const returnProblem = returnRecord.returnProblem || returnRecord.reason || 'General Return';
  const complaintDescription = returnRecord.complaintDescription || returnRecord.notes || 'No description provided by customer.';
  const purchaseDate = returnRecord.purchaseDate || returnRecord.createdAt;
  const status = returnRecord.returnStatus || 'Pending';

  const getStatusBadge = (st: string) => {
    const norm = st.toLowerCase();
    if (norm.includes('approved')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved</span>
        </span>
      );
    }
    if (norm.includes('rejected')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5" />
          <span>Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="w-3.5 h-3.5" />
        <span>Pending</span>
      </span>
    );
  };

  const handleUpdateStatus = async (newStatus: 'Approved' | 'Rejected') => {
    if (!onStatusChange) return;
    try {
      setIsUpdatingStatus(true);
      await onStatusChange(returnRecord.id, newStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Return Complaint Details
                </h3>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  {returnRecord.returnNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer product return inspection, complaint reason & attached photos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(status)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 dark:text-slate-300">
          {/* Section 1: Customer Information */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
              <User className="w-4 h-4 text-blue-600" />
              <span>Customer Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Customer Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {returnRecord.customerName || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Phone Number</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {returnRecord.customerPhone || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Original Invoice / Bill #</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                  {returnRecord.originalInvoiceNumber || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Product Information */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
              <Package className="w-4 h-4 text-purple-600" />
              <span>Product Information</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Product Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {returnRecord.productName}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Product ID / SKU</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {returnRecord.sku || returnRecord.productId?.slice(0, 8) || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Purchase Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(purchaseDate)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Return Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(returnRecord.returnDate)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Purchased Quantity</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {returnRecord.soldQty || 1} {returnRecord.unit || 'PCS'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Return Quantity</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {returnRecord.returnedQty} {returnRecord.unit || 'PCS'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Complaint Information */}
          <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Return Complaint Information</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                {returnProblem}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                Complete Complaint Description:
              </span>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-100 dark:border-rose-950/40 text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap shadow-2xs">
                "{complaintDescription}"
              </div>
            </div>

            {/* Attached Product Photos */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Attached Product Photos ({photos.length}):</span>
              </span>

              {photos.length === 0 ? (
                <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-400 text-xs">
                  No photos were attached with this return complaint.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photos.map((photoUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEnlargedPhoto(photoUrl)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-xs hover:border-purple-400 transition-all"
                      title="Click to view larger photo"
                    >
                      <img
                        src={photoUrl}
                        alt={`Return photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                        <ZoomIn className="w-4 h-4" />
                        <span>Enlarge</span>
                      </div>
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/70 text-[10px] text-white font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Return Summary & Tracking Information */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Return Information</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Return Reference</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {returnRecord.returnNumber}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Return Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {status}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Submitted Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDate(returnRecord.createdAt || returnRecord.returnDate)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Remarks</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {returnRecord.notes || 'Awaiting authorized condition review.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {canManageStatus && (status === 'Pending' || status === 'Pending Review') ? (
              <span>Review product condition before accepting or rejecting.</span>
            ) : (
              <span>Read-only customer return record.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManageStatus && (status === 'Pending' || status === 'Pending Review') && (
              <>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateStatus('Rejected')}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                >
                  Reject Return
                </button>
                <button
                  type="button"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateStatus('Approved')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Approve Return
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Enlarged Photo Lightbox Modal */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent">
            <button
              type="button"
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close Enlarged Photo"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={enlargedPhoto}
              alt="Enlarged return product photo"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

