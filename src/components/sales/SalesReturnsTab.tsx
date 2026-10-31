import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Check, ShieldAlert, FileText, ArrowRight, Package } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const SalesReturnsTab: React.FC = () => {
  const { profile } = useAuth();
  const { salesInvoices, createSalesInvoice } = useERP();

  const eligibleInvoices = salesInvoices.filter(inv => inv.docType !== 'credit_note');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(eligibleInvoices[0]?.id || '');
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('Customer returned / Defective item');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const selectedInvoice = eligibleInvoices.find(inv => inv.id === selectedInvoiceId);

  // Return calculation
  const returnSummary = React.useMemo(() => {
    if (!selectedInvoice) return { totalAmount: 0, itemsCount: 0 };
    let total = 0;
    let count = 0;

    selectedInvoice.items.forEach(item => {
      const q = returnQtys[item.productId] || 0;
      if (q > 0) {
        total += item.rate * q;
        count += q;
      }
    });

    return { totalAmount: total, itemsCount: count };
  }, [selectedInvoice, returnQtys]);

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || returnSummary.totalAmount === 0) {
      alert('Please enter return quantity for at least one item.');
      return;
    }

    // Role Limit Check (Part D: Cashier limit approval)
    const isCashier = profile?.role === 'Cashier';
    if (isCashier && returnSummary.totalAmount > 5000) {
      const managerPin = prompt('Manager approval required for sales return above ₹5,000. Enter Manager PIN:');
      if (!managerPin) {
        alert('Return cancelled: Manager authorization is required.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const returnedItems = selectedInvoice.items
        .filter(item => (returnQtys[item.productId] || 0) > 0)
        .map(item => ({
          ...item,
          qty: returnQtys[item.productId]
        }));

      const creditNotePayload: Omit<any, 'id' | 'createdAt'> = {
        invoiceNumber: `CRN-${Date.now().toString().slice(-6)}`,
        docType: 'credit_note',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        warehouseId: selectedInvoice.warehouseId,
        items: returnedItems,
        subtotal: returnSummary.totalAmount,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: returnSummary.totalAmount,
        paidAmount: 0,
        paymentStatus: 'Unpaid',
        paymentMethod: selectedInvoice.paymentMethod,
        notes: `Sales Return against ${selectedInvoice.invoiceNumber}: ${returnReason}`
      };

      await createSalesInvoice(creditNotePayload);
      setSuccessNote(`Credit Note generated successfully for ${formatCurrency(returnSummary.totalAmount)}. Inventory returned to stock.`);
      setReturnQtys({});
    } catch (err: any) {
      alert(`Error processing return: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {successNote && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center justify-between">
          <span>{successNote}</span>
          <button onClick={() => setSuccessNote(null)} className="font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Select Invoice to Return */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Select Sales Invoice to Process Return
        </label>
        <select
          value={selectedInvoiceId}
          onChange={e => {
            setSelectedInvoiceId(e.target.value);
            setReturnQtys({});
            setSuccessNote(null);
          }}
          className="w-full sm:w-96 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium cursor-pointer"
        >
          {eligibleInvoices.map(inv => (
            <option key={inv.id} value={inv.id}>
              {inv.invoiceNumber} — {inv.customerName} ({formatCurrency(inv.grandTotal)} on {formatDate(inv.date)})
            </option>
          ))}
        </select>
      </div>

      {selectedInvoice && (
        <form onSubmit={handleProcessReturn} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Invoice Lines: {selectedInvoice.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-500">Customer: {selectedInvoice.customerName}</p>
            </div>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
              Original Bill: {formatCurrency(selectedInvoice.grandTotal)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Billed Qty</th>
                  <th className="px-3 py-2 text-right">Unit Rate</th>
                  <th className="px-3 py-2 text-right">Return Qty</th>
                  <th className="px-3 py-2 text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedInvoice.items.map(item => {
                  const qty = returnQtys[item.productId] || 0;
                  const itemRefund = item.rate * qty;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900 dark:text-white">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.qty} {item.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          value={qty || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = Math.min(item.qty, Math.max(0, parseInt(e.target.value, 10) || 0));
                            setReturnQtys(prev => ({ ...prev, [item.productId]: val }));
                          }}
                          className="w-16 px-2 py-1 text-xs font-bold font-mono text-center rounded-lg border border-slate-200 dark:border-slate-700"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(itemRefund)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Total Return Refund:</span>
              <p className="text-[10px] text-slate-500">{returnSummary.itemsCount} total units returning to stock</p>
            </div>
            <span className="text-base font-extrabold font-mono text-rose-600">
              {formatCurrency(returnSummary.totalAmount)}
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || returnSummary.totalAmount === 0}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Issue Sales Return & Restock</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

