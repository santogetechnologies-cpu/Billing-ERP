import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { sortProductsAZ } from '../../utils/sortUtils';
import { PurchaseInvoice, PurchaseDocType } from '../../types';
import { supabase } from '../../lib/supabase';
import { isTableMarkedMissing } from '../../utils/schemaDetector';

export const NewPurchaseInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { company, suppliers, products, warehouses, purchaseInvoices, purchaseRequests, createPurchaseInvoice } = useERP();

  const targetPoId = searchParams.get('poId');
  const targetRequestId = searchParams.get('requestId');
  const queryDocType = searchParams.get('docType');
  const initialDocType: PurchaseDocType = queryDocType === 'purchase_order' ? 'purchase_order' : 'purchase_invoice';

  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>(targetPoId || '');
  const [linkedPoNumber, setLinkedPoNumber] = useState<string>('');
  const [linkedRequestId, setLinkedRequestId] = useState<string>(targetRequestId || '');
  const [linkedRequestNumber, setLinkedRequestNumber] = useState<string>('');

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

  const nextPoNumber = useMemo(() => {
    let maxSeq = 1000;
    purchaseInvoices.forEach(p => {
      const match = (p.invoiceNumber || '').match(/PO-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    return `PO-2026-${maxSeq + 1}`;
  }, [purchaseInvoices]);

  const [docType, setDocType] = useState<PurchaseDocType>(initialDocType);
  const [invoiceNumber, setInvoiceNumber] = useState(() => initialDocType === 'purchase_order' ? nextPoNumber : nextPurchaseNumber);

  useEffect(() => {
    if (docType === 'purchase_order') {
      setInvoiceNumber(prev => (prev.startsWith('PUR-') || !prev ? nextPoNumber : prev));
    } else {
      setInvoiceNumber(prev => (prev.startsWith('PO-') || !prev ? nextPurchaseNumber : prev));
    }
  }, [docType, nextPoNumber, nextPurchaseNumber]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouse, setWarehouse] = useState(warehouses[0]?.id || '');
  const [freightCharges, setFreightCharges] = useState<string>('');
  const [otherCharges, setOtherCharges] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalPoItems, setOriginalPoItems] = useState<Record<string, { orderedQty: number; rate: number; productName: string }>>({});

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

  // Load purchase orders to allow linking
  const fetchPurchaseOrders = useCallback(async () => {
    const compId = company?.id || '00000000-0000-0000-0000-000000000001';
    let ordersList: any[] = [];

    if (!isTableMarkedMissing('purchase_orders')) {
      try {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('*, purchase_order_items (*)')
          .eq('company_id', compId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          ordersList = data;
        }
      } catch {}
    }

    try {
      const { data: pData } = await supabase
        .from('purchases')
        .select('*')
        .eq('company_id', compId)
        .eq('doc_type', 'purchase_order')
        .order('date', { ascending: false });
      if (pData) {
        ordersList = [...ordersList, ...pData];
      }
    } catch {}

    // Merge with purchaseRequests that have purchaseOrderId
    purchaseRequests.forEach(req => {
      if (req.purchaseOrderId && !ordersList.some(o => o.id === req.purchaseOrderId || o.order_number === req.purchaseOrderNumber)) {
        ordersList.push({
          id: req.purchaseOrderId,
          order_number: req.purchaseOrderNumber || `PO-${req.requestNumber}`,
          supplier_id: (req as any).supplierId || null,
          supplier_name: (req as any).supplierName || 'Supplier',
          linked_request_id: req.id,
          linked_request_number: req.requestNumber,
          warehouse_id: req.warehouseId,
          items: req.items.map(it => ({
            product_id: it.productId,
            product_name: it.productName,
            qty: it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty,
            rate: it.estimatedCost || 0,
            unit: it.unit
          }))
        });
      }
    });

    setAvailableOrders(ordersList);

    const target = targetPoId || targetRequestId;
    if (target) {
      const matched = ordersList.find(o => o.id === target || o.order_number === target || o.linked_request_id === target);
      if (matched) {
        applyPoDetails(matched);
      }
    }
  }, [company?.id, purchaseRequests, targetPoId, targetRequestId]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const applyPoDetails = (po: any) => {
    if (!po) {
      setSelectedPoId('');
      setLinkedPoNumber('');
      setLinkedRequestId('');
      setLinkedRequestNumber('');
      setOriginalPoItems({});
      return;
    }

    const poId = po.id || '';
    const poNum = po.order_number || po.invoice_number || `PO-${po.id?.slice(0, 6)}`;
    setSelectedPoId(poId);
    setLinkedPoNumber(poNum);

    const linkedReq = purchaseRequests.find(r => r.purchaseOrderId === poId || r.id === po.linked_request_id);
    const reqId = po.linked_request_id || linkedReq?.id || targetRequestId || '';
    const reqNum = po.linked_request_number || linkedReq?.requestNumber || '';
    setLinkedRequestId(reqId);
    setLinkedRequestNumber(reqNum);

    if (po.supplier_id) {
      setSelectedSupplierId(po.supplier_id);
    } else if (po.supplier_name) {
      const matchSup = suppliers.find(s => s.name?.toLowerCase() === po.supplier_name?.toLowerCase() || s.company?.toLowerCase() === po.supplier_name?.toLowerCase());
      if (matchSup) setSelectedSupplierId(matchSup.id);
    }

    if (po.warehouse_id) {
      setWarehouse(po.warehouse_id);
    }

    const rawItems = po.purchase_order_items || po.items || [];
    const poItemMap: Record<string, { orderedQty: number; rate: number; productName: string }> = {};

    if (rawItems.length > 0) {
      const mappedItems = rawItems.map((it: any) => {
        const prod = products.find(p => p.id === (it.product_id || it.productId));
        const qty = Number(it.qty || it.ordered_qty || it.requestedQty || 1);
        const rate = Number(it.rate || it.unit_cost || prod?.costPrice || prod?.purchasePrice || 0);
        const taxRate = Number(it.tax_rate || it.taxRate || prod?.taxRate || 18);
        const pId = prod?.id || it.product_id || it.productId;
        const pName = prod?.name || it.product_name || it.productName || 'Procured Item';

        if (pId) {
          poItemMap[pId] = {
            orderedQty: qty,
            rate,
            productName: pName
          };
        }

        return {
          productId: pId,
          productName: pName,
          qty,
          unit: it.unit || prod?.primaryUnit || 'Piece',
          rate,
          discount: 0,
          taxRate
        };
      });
      setItems(mappedItems);
    }
    setOriginalPoItems(poItemMap);
  };

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

  // Discrepancy matching against linked PO
  const discrepancyList = useMemo(() => {
    if (!linkedPoNumber || Object.keys(originalPoItems).length === 0) return [];
    const list: Array<{ productId: string; productName: string; type: 'rate' | 'qty' | 'both'; message: string }> = [];

    calculatedItems.forEach(item => {
      const orig = originalPoItems[item.productId];
      if (orig) {
        const itemRate = Number(item.rate) || 0;
        const itemQty = Number(item.qty) || 0;
        const isRateDiff = orig.rate > 0 && Math.abs(itemRate - orig.rate) > 0.01;
        const isQtyDiff = itemQty > orig.orderedQty;

        if (isRateDiff && isQtyDiff) {
          list.push({
            productId: item.productId,
            productName: item.productName,
            type: 'both',
            message: `${item.productName}: Invoiced rate (₹${itemRate.toFixed(2)}) differs from PO rate (₹${orig.rate.toFixed(2)}), and Invoiced Qty (${itemQty}) exceeds PO Qty (${orig.orderedQty})`
          });
        } else if (isRateDiff) {
          list.push({
            productId: item.productId,
            productName: item.productName,
            type: 'rate',
            message: `${item.productName}: Invoiced unit rate (₹${itemRate.toFixed(2)}) differs from agreed PO rate (₹${orig.rate.toFixed(2)})`
          });
        } else if (isQtyDiff) {
          list.push({
            productId: item.productId,
            productName: item.productName,
            type: 'qty',
            message: `${item.productName}: Invoiced quantity (${itemQty}) exceeds PO ordered quantity (${orig.orderedQty})`
          });
        }
      }
    });
    return list;
  }, [calculatedItems, originalPoItems, linkedPoNumber]);

  const hasDiscrepancy = discrepancyList.length > 0;
  const discrepancyNotes = discrepancyList.map(d => d.message).join('; ');

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

    const finalSupplierInv = supplierInvoiceNumber.trim() || invoiceNumber;

    // Prevent duplicate bill submissions
    const isDuplicate = purchaseInvoices.some(
      p => p.supplierId === activeSupplier?.id &&
           ((p.supplierInvoiceNumber && p.supplierInvoiceNumber.trim().toLowerCase() === finalSupplierInv.toLowerCase()) ||
            (p.invoiceNumber && p.invoiceNumber.trim().toLowerCase() === finalSupplierInv.toLowerCase()))
    );

    if (isDuplicate) {
      alert(`Duplicate Submission Prevented: A supplier bill with invoice #${finalSupplierInv} already exists for ${activeSupplier?.company || activeSupplier?.name}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const numPaid = Number(paidAmount) || 0;
      let paymentStatus: PurchaseInvoice['paymentStatus'] = 'Unpaid';
      if (numPaid >= grandTotal && grandTotal > 0) paymentStatus = 'Paid';
      else if (numPaid > 0) paymentStatus = 'Partially Paid';

      await createPurchaseInvoice({
        invoiceNumber,
        supplierInvoiceNumber: finalSupplierInv,
        docType,
        date,
        dueDate,
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
        notes,
        purchaseOrderId: selectedPoId || undefined,
        purchaseOrderNumber: linkedPoNumber || undefined,
        purchaseRequestId: linkedRequestId || undefined,
        purchaseRequestNumber: linkedRequestNumber || undefined,
        verificationStatus: 'Pending Review',
        hasDiscrepancy,
        discrepancyNotes: hasDiscrepancy ? discrepancyNotes : undefined
      });

      if (docType === 'purchase_order') {
        navigate('/purchases/orders');
      } else {
        navigate('/purchases');
      }
    } catch (err: any) {
      alert(`Error saving purchase document: ${err?.message || 'Failed to save document'}`);
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
            onClick={() => navigate(docType === 'purchase_order' ? '/purchases/orders' : '/purchases')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {docType === 'purchase_order' ? 'Create Direct Purchase Order' : 'Create Supplier Purchase Bill'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {docType === 'purchase_order'
                ? 'Create a direct purchase order for supplier delivery tracking and destination warehouse receipt.'
                : 'Record actual supplier invoice against purchase orders and automatically transfer to Accountant for payment review.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(docType === 'purchase_order' ? '/purchases/orders' : '/purchases')}
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
                <span>{docType === 'purchase_order' ? 'Save Purchase Order' : 'Save & Transfer to Accountant'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Linked Purchase Order Banner & Discrepancies */}
      {linkedPoNumber && (
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-2xl p-4.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Linked to Purchase Order</span>
                  <span className="font-mono font-bold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-lg text-xs">
                    {linkedPoNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-filled line items, quantities, and agreed vendor pricing from order.
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-lg">
                Active Order
              </span>
            </div>
          </div>

          {hasDiscrepancy && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Price / Quantity Discrepancies Flagged Against Purchase Order</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800/90 pl-1">
                {discrepancyList.map((d, i) => (
                  <li key={i}>{d.message}</li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-700 font-medium pt-1 border-t border-amber-200/70">
                Notice: Discrepancies will be prominently reported to the Accountant in their review queue before payment disbursement.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Supplier & Bill Details */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          Supplier Procurement Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
            <label className="block font-medium text-slate-700 mb-1">
              Supplier Invoice # <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={supplierInvoiceNumber}
              onChange={e => setSupplierInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-8812"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Bill Reference #</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
            />
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
            <label className="block font-medium text-slate-700 mb-1">Payment Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
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
            <label className="block font-medium text-slate-700 mb-1">{docType === 'purchase_order' ? 'Destination Warehouse' : 'Receiving Warehouse'}</label>
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
                      {sortProductsAZ(products).map(p => (
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
            <label className="block font-medium text-slate-700 mb-1">Delivery Charges (₹)</label>
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
