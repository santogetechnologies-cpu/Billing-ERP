import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Package,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  FileText,
  Boxes,
  Percent,
  CreditCard
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const SalesReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const { salesInvoices, products, customers, processSalesReturn } = useERP();

  // Filter invoices eligible for return (exclude credit notes)
  const eligibleInvoices = useMemo(() => {
    return salesInvoices.filter(inv => inv.docType !== 'credit_note');
  }, [salesInvoices]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    eligibleInvoices[0]?.id || ''
  );

  const selectedInvoice = useMemo(() => {
    return eligibleInvoices.find(inv => inv.id === selectedInvoiceId);
  }, [eligibleInvoices, selectedInvoiceId]);

  // Quantities to return for each item in the invoice
  const [returnQtys, setReturnQtys] = useState<Record<string, number | string>>({});
  const [returnReason, setReturnReason] = useState('Damaged in transit / Customer specification mismatch');
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize returnQtys when invoice changes
  React.useEffect(() => {
    if (selectedInvoice) {
      const initial: Record<string, number | string> = {};
      selectedInvoice.items.forEach(item => {
        initial[item.productId] = '';
      });
      setReturnQtys(initial);
      setIsSuccess(false);
    }
  }, [selectedInvoice]);

  // Compute live effects of the sales return
  const returnSummary = useMemo(() => {
    if (!selectedInvoice) return { totalReturnAmt: 0, itemsCount: 0, taxReversed: 0, stockAdded: 0 };

    let totalReturnAmt = 0;
    let itemsCount = 0;
    let taxReversed = 0;
    let stockAdded = 0;

    selectedInvoice.items.forEach(item => {
      const qty = Number(returnQtys[item.productId]) || 0;
      if (qty > 0) {
        const itemTotal = (item.total / item.qty) * qty;
        const itemTax = (item.taxAmt / item.qty) * qty;
        totalReturnAmt += itemTotal;
        taxReversed += itemTax;
        stockAdded += qty;
        itemsCount += 1;
      }
    });

    return {
      totalReturnAmt: Math.round(totalReturnAmt),
      itemsCount,
      taxReversed: Math.round(taxReversed),
      stockAdded
    };
  }, [selectedInvoice, returnQtys]);

  const handleFullReturn = () => {
    if (!selectedInvoice) return;
    const full: Record<string, number | string> = {};
    selectedInvoice.items.forEach(item => {
      full[item.productId] = item.qty;
    });
    setReturnQtys(full);
  };

  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || returnSummary.totalReturnAmt === 0) {
      alert('Please specify quantity to return for at least one item.');
      return;
    }

    const returnedItems = Object.entries(returnQtys)
      .map(([productId, val]) => ({ productId, qty: Number(val) || 0 }))
      .filter(({ qty }) => qty > 0)
      .map(({ productId, qty }) => {
        const originalItem = selectedInvoice.items.find(i => i.productId === productId);
        const returnAmt = originalItem ? (originalItem.total / originalItem.qty) * qty : 0;
        return { productId, qty, returnAmt };
      });

    processSalesReturn(selectedInvoice.id, returnedItems, returnReason);
    setIsSuccess(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Process Sales Return & Credit Note
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reverses output tax, restores warehouse stock, adjusts customer balance, and issues credit note.
          </p>
        </div>

        <button
          onClick={() => navigate('/sales')}
          className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
        >
          View Invoices
        </button>
      </div>

      {isSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Sales Return Successfully Processed!</p>
              <p className="text-emerald-700 mt-0.5">
                Credit note generated. Stock restored to warehouse and customer ledger credited with{' '}
                {formatCurrency(returnSummary.totalReturnAmt)}.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
          >
            Go to Invoices
          </button>
        </div>
      )}

      {/* Select Invoice to Return */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Step 1: Select Original Sales Invoice
          </label>
          <button
            type="button"
            onClick={handleFullReturn}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            Mark Full Return (All Items)
          </button>
        </div>

        <select
          value={selectedInvoiceId}
          onChange={e => setSelectedInvoiceId(e.target.value)}
          className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          {eligibleInvoices.map(inv => (
            <option key={inv.id} value={inv.id}>
              {inv.invoiceNumber} — {inv.customerName} ({formatDate(inv.date)}) — Total:{' '}
              {formatCurrency(inv.grandTotal)}
            </option>
          ))}
        </select>
      </div>

      {/* Items return selector */}
      {selectedInvoice && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Step 2: Specify Return Quantities & Reason
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Invoiced Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right">Qty to Return</th>
                  <th className="py-2.5 px-3 text-right">Credit Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedInvoice.items.map(item => {
                  const rawQty = returnQtys[item.productId] !== undefined ? returnQtys[item.productId] : '';
                  const numQty = Number(rawQty) || 0;
                  const itemCredit = item.qty > 0 ? (item.total / item.qty) * numQty : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block">{item.productName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{item.unit}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{formatCurrency(item.rate)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          step="any"
                          value={rawQty}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setReturnQtys(prev => ({ ...prev, [item.productId]: '' }));
                              return;
                            }
                            if (raw.includes('-')) return;
                            const clean = raw.replace(/^0+(?=\d)/, '');
                            const num = Math.min(item.qty, Math.max(0, Number(clean)));
                            setReturnQtys(prev => ({ ...prev, [item.productId]: num > item.qty ? item.qty : clean }));
                          }}
                          placeholder="0"
                          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-900 text-right focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                        {formatCurrency(itemCredit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Return Reason / Notes
            </label>
            <input
              type="text"
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Step 3: Interactive Real-Time Preview of Financial & Stock Effects */}
      {selectedInvoice && (
        <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                Real-Time Telemetry Impact
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                Effects of this Sales Return on ERP State
              </h3>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold border border-amber-500/30">
              Live Preview
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Effect 1: Sales decrease */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <TrendingDown className="w-4 h-4" />
                <span>Sales Revenue Decreases</span>
              </div>
              <p className="text-lg font-black text-white">
                -{formatCurrency(returnSummary.totalReturnAmt)}
              </p>
              <p className="text-[11px] text-slate-400">P&L Operating Revenue reduced</p>
            </div>

            {/* Effect 2: Stock increases */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Boxes className="w-4 h-4" />
                <span>Warehouse Stock Restores</span>
              </div>
              <p className="text-lg font-black text-white">+{returnSummary.stockAdded} Units</p>
              <p className="text-[11px] text-slate-400">Added back to {selectedInvoice.warehouseId}</p>
            </div>

            {/* Effect 3: Tax reverses */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Percent className="w-4 h-4" />
                <span>GST Output Tax Reverses</span>
              </div>
              <p className="text-lg font-black text-white">
                -{formatCurrency(returnSummary.taxReversed)}
              </p>
              <p className="text-[11px] text-slate-400">CGST/SGST liability credited</p>
            </div>

            {/* Effect 4: Customer balance */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                <CreditCard className="w-4 h-4" />
                <span>Customer Ledger Credited</span>
              </div>
              <p className="text-lg font-black text-white">
                -{formatCurrency(returnSummary.totalReturnAmt)}
              </p>
              <p className="text-[11px] text-slate-400">{selectedInvoice.customerName}</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              onClick={handleProcessReturn}
              disabled={returnSummary.totalReturnAmt === 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Confirm & Generate Credit Note</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
