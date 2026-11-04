import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, AlertCircle, CheckCircle2, ArrowRight, Wallet } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { PurchaseInvoice, PaymentMethod } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface PaySupplierBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: PurchaseInvoice | null;
  onSuccess?: () => void;
}

export const PaySupplierBillModal: React.FC<PaySupplierBillModalProps> = ({
  isOpen,
  onClose,
  bill,
  onSuccess
}) => {
  const { recordPurchasePayment } = useERP();
  const { profile } = useAuth();

  // Role verification: Only Accountant, Admin, or Owner can confirm payments
  const isAuthorizedAccountant =
    profile?.role === 'Accountant' ||
    profile?.role === 'Admin' ||
    profile?.role === 'Owner';

  const grandTotal = Number(bill?.grandTotal || 0);
  const alreadyPaid = Number(bill?.paidAmount || 0);
  const balanceDue = Math.max(0, grandTotal - alreadyPaid);

  // Form states
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{
    amount: number;
    paymentNumber: string;
    newStatus: string;
  } | null>(null);

  // Initialize form when bill opens
  useEffect(() => {
    if (isOpen && bill) {
      const due = Math.max(0, Number(bill.grandTotal || 0) - Number(bill.paidAmount || 0));
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAmount(due > 0 ? due.toString() : '');
      setPaymentMethod('Bank Transfer');
      setReference('');
      setNotes('');
      setErrorMessage('');
      setSuccessInfo(null);
      setIsSubmitting(false);
    }
  }, [isOpen, bill]);

  if (!isOpen || !bill) return null;

  const numAmount = Number(amount) || 0;
  const remainingBalanceAfterPayment = Math.max(0, balanceDue - numAmount);
  const willBeFullyPaid = numAmount >= balanceDue && balanceDue > 0;

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate authorization
    if (!isAuthorizedAccountant) {
      setErrorMessage(
        `Unauthorized (403): Only authorized Accountant users can process payments. Your current role is '${profile?.role || 'Guest'}'.`
      );
      return;
    }

    // 2. Validate payment amount
    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (numAmount > balanceDue + 0.001) {
      setErrorMessage(
        `Payment amount (${formatCurrency(numAmount)}) cannot exceed the outstanding balance due of ${formatCurrency(balanceDue)}.`
      );
      return;
    }

    if (!paymentDate) {
      setErrorMessage('Please specify a valid payment date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      // 3. Save payment transaction in Supabase and update ERPContext
      const res = await recordPurchasePayment({
        purchaseId: bill.id,
        amount: numAmount,
        paymentMethod,
        date: paymentDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        account: 'Primary Bank Account'
      });

      const newStatus = res.updatedPurchase.paymentStatus === 'Paid' ? 'COMPLETED' : 'PARTIALLY PAID';

      // 4. Show success confirmation
      setSuccessInfo({
        amount: numAmount,
        paymentNumber: res.payment.paymentNumber,
        newStatus
      });

      if (onSuccess) {
        onSuccess();
      }

      // Close modal after brief confirmation display
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to record supplier payment. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl my-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pay Supplier Bill</span>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  #{bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Disburse outward payment and update bill settlement status.
              </p>
            </div>
          </div>

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

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Success Notification Banner */}
          {successInfo && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-start gap-3 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">Payment Successfully Recorded!</h4>
                <p className="text-[11px] mt-0.5">
                  Voucher <strong>{successInfo.paymentNumber}</strong> for{' '}
                  <strong>{formatCurrency(successInfo.amount)}</strong> was confirmed.
                  Bill status updated to <strong>{successInfo.newStatus}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Role Warning Banner if Unauthorized */}
          {!isAuthorizedAccountant && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Accountant Authorization Required</span>
                <span className="text-[11px]">
                  Only authorized Accountant users can confirm supplier payments. You are signed in as{' '}
                  <strong>{profile?.role || 'Guest'}</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Bill Information Section (Read-Only Card) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Bill Information
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Supplier Name</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {bill.supplierName}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Supplier Invoice #</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 block truncate">
                  {bill.supplierInvoiceNumber || bill.invoiceNumber}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">PO Number</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block truncate">
                  {bill.purchaseOrderNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Bill Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 block">
                  {formatDate(bill.date)}
                </span>
              </div>
            </div>

            {/* Financial Totals Row */}
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Grand Total</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Amount Paid</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {formatCurrency(alreadyPaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-amber-600 uppercase font-bold block">Balance Due</span>
                <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Payment Details Form */}
          <form onSubmit={handleConfirmPayment} className="space-y-3.5">
            <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Payment Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Payment Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                {balanceDue > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAmount(balanceDue.toFixed(2))}
                      className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Pay Full Due ({formatCurrency(balanceDue)})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAmount((balanceDue / 2).toFixed(2))}
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Pay 50%
                    </button>
                  </div>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                placeholder={`Max: ₹${balanceDue.toFixed(2)}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />

              {/* Dynamic Calculation Indicator */}
              {numAmount > 0 && (
                <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">
                    Remaining Balance After Payment:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(remainingBalanceAfterPayment)}
                    </span>
                    {willBeFullyPaid ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        PARTIALLY PAID
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transaction / Reference Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. UTR #, Cheque #, or UPI Transaction ID"
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Remarks <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Add any remarks, payment vouchers, or accounts notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !isAuthorizedAccountant || numAmount <= 0 || numAmount > balanceDue}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Confirm Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

