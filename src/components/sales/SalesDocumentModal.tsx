import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  User,
  Plus,
  Trash2,
  Check,
  Printer,
  Sparkles,
  AlertTriangle,
  Building,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Product, InvoiceItem, SalesInvoice, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { normalizeUniversalUnit } from '../../utils/universalUnitSystem';
import { POSQuantitySelector } from '../pos/POSQuantitySelector';

interface SalesDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'tax_invoice' | 'quotation' | 'sales_order';
  onSaved?: (invoice: SalesInvoice) => void;
}

export const SalesDocumentModal: React.FC<SalesDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  onSaved
}) => {
  const { profile } = useAuth();
  const {
    products,
    customers,
    warehouses,
    company,
    createSalesInvoice
  } = useERP();

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedDocument, setSavedDocument] = useState<SalesInvoice | null>(null);

  // Sync defaults
  useEffect(() => {
    if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses.find(w => w.isDefault)?.id || warehouses[0].id);
    }
  }, [customers, warehouses]);

  const handleAddItem = (product: Product) => {
    const unit = normalizeUniversalUnit(product.primaryUnit);
    const rate = product.sellingPrice || 0;
    const taxRate = product.taxRate || 0;
    const lineTotal = rate * 1;
    const taxAmt = lineTotal * (taxRate / 100);

    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      hsn: product.hsn,
      qty: 1,
      unit,
      rate,
      discountPct: 0,
      discountAmt: 0,
      taxRate,
      taxAmt,
      cgstAmt: taxAmt / 2,
      sgstAmt: taxAmt / 2,
      igstAmt: 0,
      total: lineTotal + taxAmt,
      costPrice: product.costPrice || product.purchasePrice || 0
    };

    setItems(prev => [newItem, ...prev]);
    setSelectedProductToAdd('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.rate * item.qty, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmt, 0);
  const grandTotal = subtotal + taxTotal;

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Please add at least one line item to the document.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const customer = customers.find(c => c.id === customerId);
    const prefix = documentType === 'quotation' ? 'QTN-' : documentType === 'sales_order' ? 'SO-' : (company.invoicePrefix || 'INV-');
    const invoiceNumber = `${prefix}${Date.now().toString().slice(-6)}`;

    const payload: Omit<SalesInvoice, 'id' | 'createdAt'> = {
      invoiceNumber,
      docType: documentType as any,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      customerId,
      customerName: customer?.name || 'Walk-in Customer',
      customerPhone: customer?.phone || '',
      customerGstin: customer?.gstin || '',
      customerAddress: customer?.address || '',
      warehouseId,
      items,
      subtotal,
      discountTotal: 0,
      taxTotal,
      cgstTotal: taxTotal / 2,
      sgstTotal: taxTotal / 2,
      igstTotal: 0,
      roundOff: 0,
      grandTotal,
      paidAmount: documentType === 'tax_invoice' ? grandTotal : 0,
      paymentStatus: documentType === 'tax_invoice' ? 'Paid' : 'Unpaid',
      paymentMethod,
      notes: notes.trim()
    };

    try {
      const created = await createSalesInvoice(payload);
      setSavedDocument(created);
      onSaved?.(created);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const docTitle =
    documentType === 'quotation'
      ? 'New Quotation / Proforma'
      : documentType === 'sales_order'
      ? 'New Sales Order'
      : 'New Tax Invoice';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {savedDocument ? 'Document Saved' : docTitle}
              </h2>
              <p className="text-xs text-slate-500">Universal 5-Step Document Creator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedDocument ? (
          /* Step 5: DONE Success View */
          <div className="p-8 text-center space-y-4 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {savedDocument.invoiceNumber} created successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Customer: <strong>{savedDocument.customerName}</strong> | Amount: <strong className="font-mono">{formatCurrency(savedDocument.grandTotal)}</strong>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Print Document</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSavedDocument(null);
                  setItems([]);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Another</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveDocument} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: SELECT Party & Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Client *
                </label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || 'Retail'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatch Store / Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: ENTER Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Line Items ({items.length})
                </label>
              </div>

              {/* Add Item Bar */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedProductToAdd}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    if (prod) handleAddItem(prod);
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="">Search / Add a product to document...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.sellingPrice)} / {p.primaryUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No items added yet. Select a product above to add lines.
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(item.rate)} × {item.qty} {item.unit} (+{item.taxRate}% tax)
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={e => {
                            const newQty = Math.max(1, parseFloat(e.target.value) || 1);
                            setItems(prev => {
                              const next = [...prev];
                              const cur = next[idx];
                              const total = newQty * cur.rate;
                              const taxAmt = total * (cur.taxRate / 100);
                              next[idx] = { ...cur, qty: newQty, taxAmt, total: total + taxAmt };
                              return next;
                            });
                          }}
                          className="w-16 px-2 py-1 text-xs font-bold font-mono rounded-lg border border-slate-200 dark:border-slate-700 text-center"
                        />
                        <span className="font-bold font-mono text-slate-900 dark:text-white w-20 text-right">
                          {formatCurrency(item.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Step 3: REVIEW Summary Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Taxes Total (GST):</span>
                <span className="font-mono">{formatCurrency(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-600 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Terms / Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional customer notes or delivery instructions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Step 4: CONFIRM Action Button */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save {docTitle}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

