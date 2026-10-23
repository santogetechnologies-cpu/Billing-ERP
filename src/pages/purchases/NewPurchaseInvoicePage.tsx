import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { PurchaseInvoice, PurchaseDocType } from '../../types';

export const NewPurchaseInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, products, warehouses, purchaseInvoices, createPurchaseInvoice } = useERP();

  const nextPurchaseNumber = useMemo(() => {
    let maxSeq = 1000;
    purchaseInvoices.forEach(p => {
      const match = (p.invoiceNumber || '').match(/PUR-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    return `PUR-2026-${maxSeq + 1}`;
  }, [purchaseInvoices]);

  const [docType, setDocType] = useState<PurchaseDocType>('purchase_invoice');
  const [invoiceNumber, setInvoiceNumber] = useState(nextPurchaseNumber);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouse, setWarehouse] = useState(warehouses[0]?.id || '');
  const [freightCharges, setFreightCharges] = useState<string>('');
  const [otherCharges, setOtherCharges] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<Array<{
    productId: string;
    productName: string;
    qty: number | string;
    unit: string;
    rate: number | string;
    discount: number | string;
    taxRate: number;
  }>>([]);

  const activeSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];

  // Live calculations
  const calculatedItems = useMemo(() => {
    return items.map(item => {
      const iQty = Number(item.qty) || 0;
      const iRate = Number(item.rate) || 0;
      const iDisc = Number(item.discount) || 0;
      const taxable = iQty * iRate - iDisc;
      const taxAmt = (taxable * (Number(item.taxRate) || 0)) / 100;
      const total = taxable + taxAmt;
      return { ...item, qty: iQty, rate: iRate, discount: iDisc, taxAmt, total };
    });
  }, [items]);

  const subtotal = calculatedItems.reduce((acc, i) => acc + (Number(i.qty) || 0) * (Number(i.rate) || 0) - (Number(i.discount) || 0), 0);
  const taxTotal = calculatedItems.reduce((acc, i) => acc + i.taxAmt, 0);
  const numFreight = Number(freightCharges) || 0;
  const numOther = Number(otherCharges) || 0;
  const grandTotal = Math.round(subtotal + taxTotal + numFreight + numOther);

  const addItemRow = () => {
    const prod = products[0];
    if (!prod) {
      alert('Please add products to your inventory catalog first.');
      return;
    }
    setItems(prev => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        qty: 1,
        unit: prod.primaryUnit,
        rate: prod.costPrice || prod.purchasePrice || 0,
        discount: 0,
        taxRate: prod.taxRate || 0
      }
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i === idx) {
          if (field === 'productId') {
            const p = products.find(prod => prod.id === val);
            if (p) {
              return {
                ...item,
                productId: p.id,
                productName: p.name,
                unit: p.primaryUnit,
                rate: p.purchasePrice,
                taxRate: p.taxRate
              };
            }
          }
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const numPaid = Number(paidAmount) || 0;
      let paymentStatus: PurchaseInvoice['paymentStatus'] = 'Unpaid';
      if (numPaid >= grandTotal) paymentStatus = 'Paid';
      else if (numPaid > 0) paymentStatus = 'Partially Paid';

      await createPurchaseInvoice({
        invoiceNumber,
        docType,
        date,
        supplierId: activeSupplier?.id || '',
        supplierName: activeSupplier?.company || activeSupplier?.name || 'Supplier',
        supplierGstin: activeSupplier?.gstin,
        warehouse,
        items: calculatedItems,
        subtotal,
        taxTotal,
        freightCharges: numFreight,
        otherCharges: numOther,
        grandTotal,
        paidAmount: numPaid,
        paymentStatus,
        notes
      });

      navigate('/purchases');
    } catch (err: any) {
      alert(`Error saving purchase bill: ${err?.message || 'Failed to save bill'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Create Supplier Purchase Bill / PO
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record supplier bill, automatically update on-hand stock and increase accounts payable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || calculatedItems.length === 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Purchase Bill</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Supplier & Bill Details */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          Supplier Procurement Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Select Supplier</label>
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.company} ({s.name}) — Payable: {formatCurrency(s.currentOutstanding)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Purchase Bill #</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
            >
              <option value="purchase_invoice">Purchase Invoice (Bill)</option>
              <option value="purchase_order">Purchase Order (PO)</option>
              <option value="purchase_receipt">Goods Receipt (GRN)</option>
              <option value="purchase_quotation">Supplier Quotation</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Bill Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Receiving Warehouse</label>
            <select
              value={warehouse}
              onChange={e => setWarehouse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
            >
              {warehouses.filter(w => w.isActive ?? true).map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code}){w.isDefault ? ' — Primary Hub' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          Inward Line Items & Procurement Rates
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-2 w-8 text-center">#</th>
                <th className="py-2.5 px-2 min-w-[220px]">Product</th>
                <th className="py-2.5 px-2 w-28 text-right">Inward Qty</th>
                <th className="py-2.5 px-2 w-20">Unit</th>
                <th className="py-2.5 px-2 w-32 text-right">Purchase Rate (₹)</th>
                <th className="py-2.5 px-2 w-20 text-right">GST %</th>
                <th className="py-2.5 px-2 w-32 text-right">Tax (₹)</th>
                <th className="py-2.5 px-2 w-36 text-right">Total (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <select
                      value={item.productId}
                      onChange={e => updateItem(idx, 'productId', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.currentStock} {p.primaryUnit})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.qty}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { updateItem(idx, 'qty', ''); return; }
                        if (raw.includes('-')) return;
                        updateItem(idx, 'qty', raw.replace(/^0+(?=\d)/, ''));
                      }}
                      placeholder="1"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-slate-900 text-right"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-slate-600 font-medium px-2 py-1 bg-slate-100 rounded block text-center">
                      {item.unit}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.rate}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { updateItem(idx, 'rate', ''); return; }
                        if (raw.includes('-')) return;
                        updateItem(idx, 'rate', raw.replace(/^0+(?=\d)/, ''));
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900 text-right"
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <select
                      value={item.taxRate}
                      onChange={e => updateItem(idx, 'taxRate', Number(e.target.value))}
                      className="w-full px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-right font-medium"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-slate-700">
                    {formatCurrency(item.taxAmt)}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-900">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addItemRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
        >
          <Plus className="w-3.5 h-3.5" /> Add Product Item
        </button>
      </div>

      {/* Summary and Settlement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Freight Charges (₹)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={freightCharges}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setFreightCharges(''); return; }
                if (raw.includes('-')) return;
                setFreightCharges(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Other Handling Charges (₹)
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={otherCharges}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setOtherCharges(''); return; }
                if (raw.includes('-')) return;
                setOtherCharges(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">PO Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Inward consignment received via Gati transport LR #49102"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3 text-xs text-slate-700">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Purchase Bill Grand Summary
          </h3>

          <div className="flex justify-between">
            <span>Subtotal (Net):</span>
            <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>GST Input Tax (ITC Eligible):</span>
            <span className="font-semibold text-slate-900">{formatCurrency(taxTotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>Freight & Shipping:</span>
            <span>{formatCurrency(numFreight)}</span>
          </div>

          <div className="flex justify-between py-2 border-t-2 border-slate-900 text-base font-black text-slate-900">
            <span>TOTAL BILL AMOUNT:</span>
            <span className="text-indigo-600">{formatCurrency(grandTotal)}</span>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="font-bold text-slate-800">Amount Paid to Supplier Today:</span>
            <input
              type="number"
              step="any"
              min="0"
              value={paidAmount}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setPaidAmount(''); return; }
                if (raw.includes('-')) return;
                setPaidAmount(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-right text-emerald-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || calculatedItems.length === 0}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                <span>Processing & Saving Bill...</span>
              </>
            ) : (
              <span>Record Purchase & Update Inventory</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
