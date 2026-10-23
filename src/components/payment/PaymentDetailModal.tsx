import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Receipt,
  Check,
  Building2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Calendar,
  CheckCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { PaymentRecord, SalesInvoice } from '../../types';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate, numberToWordsIndian } from '../../utils/formatters';
import { ModalCloseButton } from '../common/ModalCloseButton';

interface PaymentDetailModalProps {
  payment: PaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onViewInvoice?: (invoice: SalesInvoice) => void;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
  payment,
  isOpen,
  onClose,
  onViewInvoice
}) => {
  const { company, salesInvoices } = useERP();
  const [copied, setCopied] = useState(false);

  // Link to associated invoice if present
  const associatedInvoice = useMemo(() => {
    if (!payment?.invoiceId) return null;
    return salesInvoices.find(inv => inv.id === payment.invoiceId) || null;
  }, [payment, salesInvoices]);

  // Lock body scroll during modal display
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('invoice-modal-open');
      return () => {
        document.body.classList.remove('invoice-modal-open');
      };
    }
  }, [isOpen]);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyVoucherNumber = () => {
    if (payment.paymentNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(payment.paymentNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const amountInWords = numberToWordsIndian(payment.amount);
  const isReceived = payment.type === 'Received';

  return (
    <div
      className="invoice-modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:inset-auto print:z-auto print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible print:block print:w-full print:h-auto"
      onClick={onClose}
    >
      <div
        className="invoice-modal-container relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:bg-white print:static print:block"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Action Bar (Hidden during print) */}
        <div className="no-print px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Receipt className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-800">Payment Voucher</h3>
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {payment.paymentNumber}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Official ERP financial settlement voucher</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyVoucherNumber}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy Voucher Number"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Receipt className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Voucher #'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>

            <ModalCloseButton onClose={onClose} />
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible">
          {/* Header Banner */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-slate-700" />
                <h1 className="text-lg font-black text-slate-900 tracking-tight">{company.name}</h1>
              </div>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{company.address}</p>
              <div className="text-[11px] text-slate-500 font-mono mt-1 space-x-3">
                {company.gstin && <span>GSTIN: <strong>{company.gstin}</strong></span>}
                {company.phone && <span>Tel: <strong>{company.phone}</strong></span>}
              </div>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isReceived
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {isReceived ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                {isReceived ? 'Receipt Voucher' : 'Payment Voucher'}
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 mt-2">
                #{payment.paymentNumber}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Date: {formatDate(payment.date)}
              </p>
            </div>
          </div>

          {/* Amount Showcase Card */}
          <div className="bg-linear-to-br from-slate-50 to-slate-100 p-5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {isReceived ? 'Amount Received' : 'Amount Paid'}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                {formatCurrency(payment.amount)}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" />
                Settled & Verified
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium italic mt-2 border-t border-slate-200/80 pt-2">
              Rupees {amountInWords} Only
            </p>
          </div>

          {/* Transaction Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Party Information
              </span>
              <div>
                <span className="text-slate-400 text-[11px] block">{payment.partyType}:</span>
                <span className="text-sm font-bold text-slate-900 block truncate">{payment.partyName}</span>
              </div>
              {payment.partyId && (
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  ID: {payment.partyId}
                </div>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Banking & Settlement Details
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">Payment Mode</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    {payment.paymentMethod}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Account</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {payment.account || 'Main Cash Drawer'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">UTR / Ref / Cheque No.</span>
                <span className="font-mono font-bold text-slate-700 text-xs">
                  {payment.reference || 'Direct Counter Receipt'}
                </span>
              </div>
            </div>
          </div>

          {/* Associated Invoice Section */}
          {associatedInvoice && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Associated Sales Invoice: #{associatedInvoice.invoiceNumber}
                </span>
                {onViewInvoice && (
                  <button
                    onClick={() => onViewInvoice(associatedInvoice)}
                    className="no-print text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Invoice</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-700 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Invoice Total</span>
                  <span className="font-bold">{formatCurrency(associatedInvoice.grandTotal)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Paid</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(associatedInvoice.paidAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Status</span>
                  <span className="font-semibold">{associatedInvoice.paymentStatus}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes & Description */}
          {payment.notes && (
            <div className="text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Remarks / Description
              </span>
              <p className="text-slate-700 leading-relaxed">{payment.notes}</p>
            </div>
          )}

          {/* Authorization & Signatures */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">
                Customer / Depositor Signature
              </span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-300" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-1 block font-semibold text-slate-600">
                For {company.name} (Authorized Signatory)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="no-print px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            System Verified Transaction
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
