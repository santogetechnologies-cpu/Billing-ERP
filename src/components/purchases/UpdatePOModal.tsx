import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileEdit,
  AlertTriangle,
  Check,
  Info,
  PackageCheck,
  CheckCircle2
} from 'lucide-react';
import { PurchaseInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface UpdatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseInvoice | null;
  onReceiveAndSave: (data: {
    supplierInvoiceNumber: string;
    items: Array<{
      productId: string;
      productName: string;
      orderedQty: number;
      receivedQty: number;
      unit: string;
      rate: number;
      taxRate: number;
      taxAmt: number;
      total: number;
      isUnregistered?: boolean;
      isTemporary?: boolean;
    }>;
    additionalCharges: number;
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    notes?: string;
  }) => Promise<void>;
}

interface EditablePOItem {
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: string;
  unit: string;
  rate: string; // Purchase Cost (initially empty)
  taxRate: string; // GST % (initially empty)
  isUnregistered?: boolean;
  isTemporary?: boolean;
}

export const UpdatePOModal: React.FC<UpdatePOModalProps> = ({
  isOpen,
  onClose,
  po,
  onReceiveAndSave
}) => {
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState('');
  const [items, setItems] = useState<EditablePOItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isFullyReceived = po?.poStatus === 'Received';

  // Initialize form state from original PO
  useEffect(() => {
    if (po && isOpen) {
      setSupplierInvoiceNumber(po.supplierInvoiceNumber || '');
      setAdditionalCharges(po.otherCharges && po.otherCharges > 0 ? String(po.otherCharges) : '');
      setErrorMsg(null);
      setIsSuccess(false);

      const mapped: EditablePOItem[] = po.items.map(it => {
        const ordered = it.orderedQty ?? it.qty;
        const defaultRecv = it.receivedQty !== undefined ? String(it.receivedQty) : String(ordered);
        // Purchase cost & GST % initially empty if 0
        const rateStr = it.rate && it.rate > 0 ? String(it.rate) : '';
        const taxRateStr = it.taxRate && it.taxRate > 0 ? String(it.taxRate) : '';

        return {
          productId: it.productId,
          productName: it.productName,
          orderedQty: ordered,
          receivedQty: defaultRecv,
          unit: it.unit || 'Piece',
          rate: rateStr,
          taxRate: taxRateStr,
          isUnregistered: it.isUnregistered,
          isTemporary: it.isTemporary
        };
      });

      setItems(mapped);
    }
  }, [po, isOpen]);

  // Dynamic Line & Summary Calculations
  const calculated = useMemo(() => {
    let subtotal = 0;
    let totalGst = 0;

    const lineCalculations = items.map(it => {
      const recv = parseFloat(it.receivedQty) || 0;
      const rate = parseFloat(it.rate) || 0;
      const taxRate = parseFloat(it.taxRate) || 0;

      const totalCost = recv * rate;
      const gstAmount = totalCost * (taxRate / 100);
      const lineTotal = totalCost + gstAmount;

      subtotal += totalCost;
      totalGst += gstAmount;

      return { totalCost, gstAmount, lineTotal, lineSub: totalCost, lineTax: gstAmount };
    });

    const addCharges = parseFloat(additionalCharges) || 0;
    const grandTotal = subtotal + totalGst + addCharges;

    // Completeness check for purchase bill integration
    const allHaveCosts = items.length > 0 && items.every(it => parseFloat(it.rate) > 0);
    const hasSupplierInv = Boolean(supplierInvoiceNumber.trim());
    const isBillComplete = allHaveCosts && hasSupplierInv && grandTotal > 0;

    return {
      subtotal,
      totalGst,
      addCharges,
      grandTotal,
      lineCalculations,
      isBillComplete
    };
  }, [items, additionalCharges, supplierInvoiceNumber]);

  if (!isOpen || !po) return null;

  const handleItemChange = (idx: number, field: keyof EditablePOItem, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const preparePayload = () => {
    const preparedItems = items.map((it, idx) => {
      const recv = parseFloat(it.receivedQty) || 0;
      const rate = parseFloat(it.rate) || 0;
      const taxRate = parseFloat(it.taxRate) || 0;
      const { gstAmount, lineTotal } = calculated.lineCalculations[idx] || { gstAmount: 0, lineTotal: 0 };

      return {
        productId: it.productId,
        productName: it.productName,
        orderedQty: it.orderedQty,
        receivedQty: recv,
        unit: it.unit,
        rate,
        taxRate,
        taxAmt: gstAmount,
        total: lineTotal,
        isUnregistered: it.isUnregistered,
        isTemporary: it.isTemporary
      };
    });

    return {
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      items: preparedItems,
      additionalCharges: calculated.addCharges,
      subtotal: calculated.subtotal,
      taxTotal: calculated.totalGst,
      grandTotal: calculated.grandTotal,
      notes: po?.notes
    };
  };

  // Received Button: Performs both validation, saving details, and goods receipt in one unified action
  const handleReceivedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;

    if (items.length === 0) {
      setErrorMsg('No items in purchase order.');
      return;
    }

    // 1. Validate supplier invoice number
    if (!supplierInvoiceNumber.trim()) {
      setErrorMsg('Please enter the Supplier Invoice Number.');
      return;
    }

    // 2. Validate received quantities
    for (const it of items) {
      const recv = parseFloat(it.receivedQty);
      if (isNaN(recv) || recv < 0) {
        setErrorMsg(`Invalid received quantity for "${it.productName}". Please enter a valid non-negative number.`);
        return;
      }
    }

    const hasAnyReceived = items.some(it => (parseFloat(it.receivedQty) || 0) > 0);
    if (!hasAnyReceived) {
      setErrorMsg('Please enter actual received quantities greater than 0 before confirming receipt.');
      return;
    }

    // 3. Validate cost per item and GST for all received products
    for (const it of items) {
      const recv = parseFloat(it.receivedQty) || 0;
      if (recv > 0) {
        const rate = parseFloat(it.rate);
        if (!it.rate.trim() || isNaN(rate) || rate <= 0) {
          setErrorMsg(`Please specify a valid cost per item (> ₹0.00) for received product "${it.productName}".`);
          return;
        }
        const tax = parseFloat(it.taxRate);
        if (!it.taxRate.trim() || isNaN(tax) || tax < 0 || tax > 100) {
          setErrorMsg(`Please specify a valid GST percentage (0-100%) for received product "${it.productName}".`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 4 & 5. Save all supplier, product, quantity, cost and billing details and confirm goods receipt
      const payload = preparePayload();
      await onReceiveAndSave(payload);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save details and confirm receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Update Purchase & Bill Details
                </h2>
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  #{po.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Update received quantities, item costs, GST rates, and confirm goods receipt
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

        {/* Successful Confirmation Screen */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Goods Receipt Confirmed!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Purchase Order <strong>{po.invoiceNumber}</strong> has been updated to{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">RECEIVED</span>.
                Warehouse inventory in <strong>{po.warehouse || 'Main Warehouse'}</strong> has been increased and the linked supplier bill has been saved.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleReceivedSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Supplier Information */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5">
                Supplier & Order Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={po.supplierName}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier Invoice # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026-901"
                    value={supplierInvoiceNumber}
                    onChange={e => setSupplierInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Purchase Order Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={po.invoiceNumber}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-purple-600 dark:text-purple-400 font-mono font-bold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Destination Store
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={po.warehouse || 'Main Warehouse'}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* 2. Product Details Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Product Details ({items.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Enter actual received quantities, unit cost, and GST %
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[860px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5 min-w-[150px]">Product Name</th>
                        <th className="px-3 py-2.5 text-center w-24">Ordered Qty</th>
                        <th className="px-3 py-2.5 text-center w-28">Received Qty</th>
                        <th className="px-2.5 py-2.5 text-center w-16">Unit</th>
                        <th className="px-3 py-2.5 w-32">Cost per Item (₹)</th>
                        <th className="px-3 py-2.5 text-right w-28">Total Cost (₹)</th>
                        <th className="px-3 py-2.5 w-24">GST %</th>
                        <th className="px-3 py-2.5 text-right w-28">GST Amount (₹)</th>
                        <th className="px-3.5 py-2.5 text-right w-32">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((item, idx) => {
                        const { totalCost, gstAmount, lineTotal } = calculated.lineCalculations[idx] || {
                          totalCost: 0,
                          gstAmount: 0,
                          lineTotal: 0
                        };
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            {/* 1. Product Name */}
                            <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white min-w-[150px]">
                              <div>{item.productName}</div>
                              {(item.isUnregistered || item.isTemporary) && (
                                <span className="inline-block mt-0.5 text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                                  PO Only
                                </span>
                              )}
                            </td>

                            {/* 2. Ordered Qty (read-only) */}
                            <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/20">
                              {item.orderedQty}
                            </td>

                            {/* 3. Received Qty (editable) */}
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.receivedQty}
                                onChange={e => handleItemChange(idx, 'receivedQty', e.target.value)}
                                className="h-7 w-20 px-2 py-1 text-center text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </td>

                            {/* 4. Unit */}
                            <td className="px-2.5 py-2.5 text-center text-slate-500 font-medium">
                              {item.unit || 'PCS'}
                            </td>

                            {/* 5. Cost per Item (editable) */}
                            <td className="px-3 py-2.5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1 text-slate-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.rate}
                                  onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                                  className="h-7 w-full pl-6 pr-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                            </td>

                            {/* 6. Total Cost (auto-calculated, read-only) */}
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatCurrency(totalCost)}
                            </td>

                            {/* 7. GST % (editable) */}
                            <td className="px-3 py-2.5">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="any"
                                  placeholder="0"
                                  value={item.taxRate}
                                  onChange={e => handleItemChange(idx, 'taxRate', e.target.value)}
                                  className="h-7 w-full pr-5 pl-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <span className="absolute right-2 top-1 text-slate-400 text-xs">%</span>
                              </div>
                            </td>

                            {/* 8. GST Amount (auto-calculated, read-only) */}
                            <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-600 dark:text-slate-300">
                              {formatCurrency(gstAmount)}
                            </td>

                            {/* 9. Line Total (auto-calculated, read-only) */}
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. Bill Summary Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5">
                Bill Summary
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 text-[11px] block">Subtotal (Total Cost before GST):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                    {formatCurrency(calculated.subtotal)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Total GST:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                    {formatCurrency(calculated.totalGst)}
                  </span>
                </div>

                <div>
                  <label className="text-slate-500 text-[11px] block mb-0.5">
                    Additional Charges:
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={additionalCharges}
                      onChange={e => setAdditionalCharges(e.target.value)}
                      className="h-7 w-full pl-6 pr-2 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-center">
                  <span className="text-slate-500 text-[11px]">Grand Total:</span>
                  <span className="font-mono font-extrabold text-purple-600 dark:text-purple-400 text-base mt-0.5">
                    {formatCurrency(calculated.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Bill Completion Status Notice */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>
                    {calculated.isBillComplete
                      ? 'All mandatory billing details complete. Linked Purchase Bill will be marked Complete.'
                      : 'Enter Supplier Invoice #, Cost per Item, and GST % to complete bill and confirm receipt.'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                    calculated.isBillComplete
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {calculated.isBillComplete ? 'Bill Complete' : 'Bill Not Complete'}
                </span>
              </div>
            </div>

            {/* Form Action Buttons: [Cancel] [Received] ONLY */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Note: Confirming receipt saves billing details and updates inventory.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {isFullyReceived ? (
                  <button
                    type="button"
                    disabled
                    title="Order has already been fully received"
                    className="px-5 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-xs flex items-center gap-1.5 cursor-not-allowed opacity-75"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Received</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSubmitting ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <PackageCheck className="w-4 h-4 stroke-[2]" />
                        <span>Received</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
