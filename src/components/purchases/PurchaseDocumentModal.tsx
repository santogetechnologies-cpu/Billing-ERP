import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ShoppingBag,
  Building2,
  Plus,
  Trash2,
  Check,
  Printer,
  Sparkles,
  AlertTriangle,
  Building
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Product, PurchaseInvoice, PurchaseDocType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { normalizeUniversalUnit } from '../../utils/universalUnitSystem';
import { UNIVERSAL_BUILTIN_UNITS } from '../../data/unitsData';

interface PurchaseDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'purchase_order' | 'standard_invoice';
  onSaved?: (purchase: PurchaseInvoice) => void;
}

export const PurchaseDocumentModal: React.FC<PurchaseDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  onSaved
}) => {
  const { profile } = useAuth();
  const {
    products,
    suppliers,
    warehouses,
    company,
    units,
    createPurchaseInvoice,
    getWarehouseStock
  } = useERP();

  const isPO = documentType === 'purchase_order';

  const generateAutoRef = useCallback(() => {
    const timestamp = Date.now().toString().slice(-6);
    return isPO ? `PO-REF-${timestamp}` : `BILL-REF-${timestamp}`;
  }, [isPO]);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouseName, setWarehouseName] = useState(warehouses[0]?.name || 'Main Warehouse');
  const [supplierBillNo, setSupplierBillNo] = useState(() =>
    isPO
      ? `PO-REF-${Date.now().toString().slice(-6)}`
      : `BILL-REF-${Date.now().toString().slice(-6)}`
  );
  const [items, setItems] = useState<PurchaseInvoice['items']>([]);
  const [notes, setNotes] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedDocument, setSavedDocument] = useState<PurchaseInvoice | null>(null);

  // Selected warehouse object for dynamic stock lookups
  const selectedWarehouse = useMemo(() => {
    return (
      warehouses.find(w => w.name === warehouseName || w.id === warehouseName) ||
      warehouses.find(w => w.isDefault && (w.isActive ?? true)) ||
      warehouses[0]
    );
  }, [warehouses, warehouseName]);

  // Stock status calculation based on selected warehouse
  const getProductStockStatus = useCallback(
    (productId: string, isUnregistered?: boolean): {
      status: 'In Stock' | 'Limited Stock' | 'Out of Stock';
      stock: number;
    } => {
      if (isUnregistered || !productId || productId.startsWith('unregistered-')) {
        return { status: 'Out of Stock', stock: 0 };
      }

      const prod = products.find(p => p.id === productId);
      if (!prod) {
        return { status: 'Out of Stock', stock: 0 };
      }

      const stock = getWarehouseStock(selectedWarehouse?.id, prod.id);

      if (stock <= 0) {
        return { status: 'Out of Stock', stock: 0 };
      }

      // Check low stock threshold
      const limit =
        prod.reorderLevel !== null && prod.reorderLevel !== undefined && !isNaN(Number(prod.reorderLevel))
          ? Number(prod.reorderLevel)
          : prod.minStockLevel !== null && prod.minStockLevel !== undefined && !isNaN(Number(prod.minStockLevel))
          ? Number(prod.minStockLevel)
          : prod.stockWarningLimit !== null && prod.stockWarningLimit !== undefined && !isNaN(Number(prod.stockWarningLimit))
          ? Number(prod.stockWarningLimit)
          : null;

      if (limit !== null) {
        if (stock <= limit) {
          return { status: 'Limited Stock', stock };
        }
        return { status: 'In Stock', stock };
      }

      return { status: 'In Stock', stock };
    },
    [products, selectedWarehouse, getWarehouseStock]
  );

  // Quick Add Item Modal State (Temporary / Unregistered PO-Only Item)
  const [isAddNewItemModalOpen, setIsAddNewItemModalOpen] = useState(false);
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('Piece');

  // Units list
  const unitList = useMemo(() => {
    const defaultUnits = ['Piece', 'Box', 'Kg', 'Gram', 'Ltr', 'Ml', 'Meter', 'Packet', 'Set', 'Dozen', 'Pair', 'Roll'];
    const builtinNames = (UNIVERSAL_BUILTIN_UNITS || []).map(u => u.name);
    const customNames = (units || []).map(u => u.name);
    return Array.from(new Set([...defaultUnits, ...builtinNames, ...customNames])).filter(Boolean);
  }, [units]);

  const handleCreateAndAddUnregisteredItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setNewItemError('Product / Item Name is required.');
      return;
    }

    const qty = parseFloat(newItemQty);
    if (isNaN(qty) || qty <= 0) {
      setNewItemError('Valid quantity greater than 0 is required.');
      return;
    }

    const unregisteredItem = {
      productId: `unregistered-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productName: trimmedName,
      qty,
      unit: newItemUnit.trim() || 'Piece',
      rate: 0,
      discount: 0,
      taxRate: 0,
      taxAmt: 0,
      total: 0,
      isUnregistered: true,
      isTemporary: true
    };

    setItems(prev => [unregisteredItem, ...prev]);
    setIsAddNewItemModalOpen(false);
  };

  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
    if (warehouses.length > 0 && !warehouseName) {
      setWarehouseName(warehouses.find(w => w.isDefault)?.name || warehouses[0].name);
    }
  }, [suppliers, warehouses]);

  // Autogenerate Supplier Invoice / Ref # on modal open
  useEffect(() => {
    if (isOpen) {
      setSavedDocument(null);
      setErrorMsg(null);
      setSupplierBillNo(generateAutoRef());
    }
  }, [isOpen, generateAutoRef]);

  const handleAddItem = (product: Product) => {
    const unit = normalizeUniversalUnit(product.primaryUnit) || 'Piece';
    const rate = isPO ? 0 : (product.costPrice || product.purchasePrice || 0);
    const taxRate = isPO ? 0 : (product.taxRate || 0);
    const lineTotal = rate * 1;
    const taxAmt = lineTotal * (taxRate / 100);

    setItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          qty: (next[existingIdx].qty || 0) + 1
        };
        return next;
      }
      return [
        {
          productId: product.id,
          productName: product.name,
          qty: 1,
          unit,
          rate,
          discount: 0,
          taxRate,
          taxAmt,
          total: lineTotal + taxAmt
        },
        ...prev
      ];
    });
    setSelectedProductToAdd('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.rate || 0) * (item.qty || 0), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.taxAmt || 0), 0);
  const grandTotal = subtotal + taxTotal;

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Please add at least one item line to this purchase order.');
      return;
    }

    const invalidQtyItem = items.find(it => !it.qty || Number(it.qty) <= 0);
    if (invalidQtyItem) {
      setErrorMsg(`Please specify a valid quantity greater than 0 for "${invalidQtyItem.productName}".`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const supplier = suppliers.find(s => s.id === supplierId);
    const prefix = isPO ? 'PO-' : 'PB-';
    const invoiceNumber = `${prefix}${Date.now().toString().slice(-6)}`;

    // Prepare items with zero rates/taxes for PO and attached stock status snapshot
    const preparedItems = items.map(it => {
      const stockInfo = getProductStockStatus(it.productId, it.isUnregistered || it.isTemporary);
      return {
        ...it,
        qty: Number(it.qty) || 1,
        rate: isPO ? 0 : (it.rate || 0),
        discount: isPO ? 0 : (it.discount || 0),
        taxRate: isPO ? 0 : (it.taxRate || 0),
        taxAmt: isPO ? 0 : (it.taxAmt || 0),
        total: isPO ? 0 : (it.total || 0),
        stockStatusAtOrder: stockInfo.status
      };
    });

    const finalSupplierInvoiceNumber = supplierBillNo.trim() || generateAutoRef();

    const payload: Omit<PurchaseInvoice, 'id' | 'createdAt'> = {
      invoiceNumber,
      docType: isPO ? 'purchase_order' : 'standard_invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      supplierId,
      supplierName: supplier?.name || 'Primary Supplier',
      supplierGstin: supplier?.gstin || '',
      supplierInvoiceNumber: finalSupplierInvoiceNumber,
      items: preparedItems,
      subtotal: isPO ? 0 : subtotal,
      taxTotal: isPO ? 0 : taxTotal,
      freightCharges: 0,
      otherCharges: 0,
      grandTotal: isPO ? 0 : grandTotal,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      warehouse: warehouseName,
      notes: notes.trim()
    };

    try {
      const created = await createPurchaseInvoice(payload);
      setSavedDocument(created);
      onSaved?.(created);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save purchase document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const docTitle = isPO ? 'New Purchase Order (PO)' : 'New Purchase Bill';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {savedDocument ? 'Document Saved' : docTitle}
              </h2>
              <p className="text-xs text-slate-500">Universal 5-Step Purchasing Flow</p>
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
                {savedDocument.invoiceNumber} recorded successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Supplier: <strong>{savedDocument.supplierName}</strong> | Ref #: <strong>{savedDocument.supplierInvoiceNumber || supplierBillNo}</strong> | Receiving Warehouse: <strong>{savedDocument.warehouse || warehouseName}</strong> | Items: <strong>{savedDocument.items?.length || 0} line(s)</strong>
                {!isPO && (
                  <> | Total: <strong className="font-mono">{formatCurrency(savedDocument.grandTotal)}</strong></>
                )}
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
                  setSupplierBillNo(generateAutoRef());
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Another</span>
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
          <form onSubmit={handleSavePurchase} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: SELECT Supplier & Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Vendor *
                </label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.companyName || 'Vendor'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Receiving Warehouse
                </label>
                <select
                  value={warehouseName}
                  onChange={e => setWarehouseName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Invoice / Ref #
                  </label>
                  <button
                    type="button"
                    onClick={() => setSupplierBillNo(generateAutoRef())}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer transition-colors"
                    title="Autogenerate Reference #"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={isPO ? 'PO-REF-...' : 'Optional bill ref...'}
                  value={supplierBillNo}
                  onChange={e => setSupplierBillNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Step 2: ENTER Line Items */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Purchased Items ({items.length})
              </label>

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
                  <option value="">Select a product to add to purchase...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {isPO
                        ? `${p.name} (${p.primaryUnit || 'Piece'})`
                        : `${p.name} (Cost: ${formatCurrency(p.costPrice || p.purchasePrice || 0)} / ${p.primaryUnit})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Small Action Button below Dropdown */}
              <div className="flex items-center gap-2 justify-start pt-0.5 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setNewItemError(null);
                    setNewItemName('');
                    setNewItemQty('1');
                    setNewItemUnit('Piece');
                    setIsAddNewItemModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800/80 rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
                  title="Add temporary or unregistered product to this purchase order only"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5]" />
                  <span>+ Add New Item</span>
                </button>
              </div>

              {/* Items List / Table */}
              {isPO ? (
                /* PO Mode: Redesigned 4-column layout without pricing (Product Name | Stock Status | Required Quantity | Action) */
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <div className="col-span-5">Product Name</div>
                    <div className="col-span-3">Stock Status</div>
                    <div className="col-span-3">Required Quantity</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                    {items.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        No items added yet. Select a product above to add lines.
                      </div>
                    ) : (
                      items.map((item, idx) => {
                        const stockInfo = getProductStockStatus(
                          item.productId,
                          item.isUnregistered || item.isTemporary
                        );
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            {/* 1. Product Name */}
                            <div className="col-span-5 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                  {item.productName}
                                </span>
                                {(item.isUnregistered || (item.productId && item.productId.startsWith('unregistered-')) || !item.productId) && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">
                                    PO Only
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Unit: {item.unit || 'Piece'}
                              </p>
                            </div>

                            {/* 2. Stock Status */}
                            <div className="col-span-3">
                              {stockInfo.status === 'In Stock' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>In Stock</span>
                                </span>
                              )}
                              {stockInfo.status === 'Limited Stock' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span>Limited Stock</span>
                                </span>
                              )}
                              {stockInfo.status === 'Out of Stock' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                  <span>Out of Stock</span>
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 block">
                                {stockInfo.stock} in stock
                              </span>
                            </div>

                            {/* 3. Required Quantity */}
                            <div className="col-span-3 flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={item.qty === 0 ? '' : item.qty}
                                onChange={e => {
                                  const val = e.target.value;
                                  const parsed = parseFloat(val);
                                  setItems(prev => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      qty: val === '' ? ('' as any) : isNaN(parsed) ? 1 : parsed
                                    };
                                    return next;
                                  });
                                }}
                                onBlur={() => {
                                  setItems(prev => {
                                    const next = [...prev];
                                    if (!next[idx].qty || Number(next[idx].qty) <= 0) {
                                      next[idx] = { ...next[idx], qty: 1 };
                                    }
                                    return next;
                                  });
                                }}
                                className="w-20 px-2.5 py-1 text-xs font-bold font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {item.unit || 'Piece'}
                              </span>
                            </div>

                            {/* 4. Action */}
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Non-PO Mode: Standard Line Items with Pricing */
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No items added yet. Select a product above to add lines.
                    </div>
                  ) : (
                    items.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{item.productName}</p>
                            {(item.isUnregistered || (item.productId && item.productId.startsWith('unregistered-')) || !item.productId) && (
                              <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">
                                PO Only
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatCurrency(item.rate)} × {item.qty} {item.unit} (+{item.taxRate}% tax)
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Cost:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.rate}
                              onChange={e => {
                                const newRate = parseFloat(e.target.value) || 0;
                                setItems(prev => {
                                  const next = [...prev];
                                  const cur = next[idx];
                                  const total = cur.qty * newRate;
                                  const taxAmt = total * (cur.taxRate / 100);
                                  next[idx] = { ...cur, rate: newRate, taxAmt, total: total + taxAmt };
                                  return next;
                                });
                              }}
                              className="w-20 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-right"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Qty:</span>
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
                          </div>

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
              )}
            </div>

            {/* Step 3: REVIEW Summary Card (Non-PO only: completely removed for PO) */}
            {!isPO && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal (Excl. Tax):</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Input Tax Credit (GST):</span>
                  <span className="font-mono">{formatCurrency(taxTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-purple-600 text-base">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            )}

            {/* Purchase Order Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Purchase Order Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Optional supplier instructions or payment terms..."
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

      {/* Small Modal for "+ Add New Item" (Temporary / Unregistered Item) */}
      {isAddNewItemModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md my-auto overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Add New Item (PO Only)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Temporary item for this order — not saved in Product Master
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddNewItemModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAndAddUnregisteredItem} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
              {newItemError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{newItemError}</span>
                </div>
              )}

              {/* 1. Product / Item Name (Required) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product / Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Order Gear Bearing"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  autoFocus
                />
              </div>

              {/* 2. Quantity & Unit - Side by side in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    placeholder="1"
                    value={newItemQty}
                    onChange={e => setNewItemQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    {unitList.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-400">
                  Not saved in Product Master
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddNewItemModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newItemName.trim() || !newItemQty || parseFloat(newItemQty) <= 0}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add to Order</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

