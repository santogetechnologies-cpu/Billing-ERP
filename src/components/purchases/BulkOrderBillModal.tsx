import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Save,
  Plus,
  Trash2,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Percent,
  Tag,
  Sparkles,
  RotateCcw,
  Receipt,
  Search,
  Warehouse as WarehouseIcon,
  Check,
  ChevronDown
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { supabase } from '../../lib/supabase';
import { Customer, Product } from '../../types';
import { formatCurrency, formatNumber, formatDate, numberToWordsIndian } from '../../utils/formatters';
import { sortProductsAZ } from '../../utils/sortUtils';

export interface BulkOrderLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  quantity: number;
  unit: string;
  originalUnitPrice: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discountPerUnit: number;
  discountedUnitPrice: number;
  taxRate: number;
  taxAmt: number;
  totalAmount: number;
}

export interface BulkOrderBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (orderData?: any) => void;
}

export const BulkOrderBillModal: React.FC<BulkOrderBillModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const { company, products: contextProducts, warehouses, refreshData } = useERP();
  const { profile } = useAuth();

  // Mode: 'form' | 'preview'
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const docType = 'quotation';

  // Customer State
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [warehouseId, setWarehouseId] = useState<string>('');

  // Bill & Order Metadata
  const [billNumber, setBillNumber] = useState<string>(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `QT-${dateStr}-${random}`;
  });
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [additionalChargesNote, setAdditionalChargesNote] = useState<string>('Delivery Charges');
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [termsAndConditions, setTermsAndConditions] = useState<string>(() => {
    return company?.termsAndConditions || '1. 100% advance or agreed credit terms apply for bulk pricing.\n2. Goods once sold are backed by standard manufacturer warranty.\n3. Delivery timelines are subject to warehouse dispatch clearance.';
  });
  const [notes, setNotes] = useState<string>('Special quotation proposal rates negotiated and approved.');

  // Line items state
  const [lineItems, setLineItems] = useState<BulkOrderLineItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);

  // Products from catalog
  const catalogProducts = useMemo(() => {
    return sortProductsAZ(contextProducts || []);
  }, [contextProducts]);

  // Load existing customers on modal open
  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      if (warehouses && warehouses.length > 0 && !warehouseId) {
        setWarehouseId(warehouses[0].id);
      }
      // Initialize with at least 1 empty row if items are empty
      if (lineItems.length === 0) {
        addLineItem();
      }
      setSaveSuccess(null);
      setErrorMessage(null);
    }
  }, [isOpen, warehouses]);

  const loadCustomers = async () => {
    try {
      const data = await customerService.getCustomers({ limit: 100 }, company?.id);
      setCustomersList(data || []);
    } catch (err) {
      console.warn('Could not load customers for bulk order modal:', err);
    }
  };

  // Handle Customer Selection
  const handleSelectCustomer = (cId: string) => {
    setSelectedCustomerId(cId);
    if (!cId) return;
    const found = customersList.find(c => c.id === cId);
    if (found) {
      setCustomerName(found.name || '');
      setCustomerPhone(found.phone || '');
      setCustomerEmail(found.email || '');
      setCustomerAddress(found.address || '');
      setCustomerGstin(found.gstin || '');
    }
  };

  // Add Product Line Item
  const addLineItem = (prod?: Product) => {
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    if (prod) {
      const origPrice = Number(prod.sellingPrice || prod.retailPrice || prod.costPrice || 0);
      const taxRate = Number(prod.taxRate || 18);
      const defaultQty = 50; // standard bulk order starter
      const discountType = 'fixed';
      const discountVal = Math.round(origPrice * 0.05); // 5% default bulk discount
      const discountPerUnit = Math.min(origPrice, Math.max(0, discountVal));
      const discountedUnit = Math.max(0, origPrice - discountPerUnit);
      const totalAmt = defaultQty * discountedUnit;
      const taxAmt = (totalAmt * taxRate) / 100;

      const newItem: BulkOrderLineItem = {
        id,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || prod.code || 'SKU-GEN',
        availableStock: Number(prod.currentStock || 0),
        quantity: defaultQty,
        unit: prod.primaryUnit || 'Piece',
        originalUnitPrice: origPrice,
        discountType,
        discountValue: discountVal,
        discountPerUnit,
        discountedUnitPrice: discountedUnit,
        taxRate,
        taxAmt,
        totalAmount: totalAmt
      };
      setLineItems(prev => [...prev, newItem]);
    } else {
      const newItem: BulkOrderLineItem = {
        id,
        productId: '',
        productName: '',
        sku: '',
        availableStock: 0,
        quantity: 100,
        unit: 'Piece',
        originalUnitPrice: 0,
        discountType: 'fixed',
        discountValue: 0,
        discountPerUnit: 0,
        discountedUnitPrice: 0,
        taxRate: 18,
        taxAmt: 0,
        totalAmount: 0
      };
      setLineItems(prev => [...prev, newItem]);
    }
  };

  // Update Line Item Field
  const updateLineItem = (id: string, updates: Partial<BulkOrderLineItem>) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const merged = { ...item, ...updates };

        // Recalculate discounts and totals
        const orig = Math.max(0, Number(merged.originalUnitPrice || 0));
        const qty = Math.max(1, Number(merged.quantity || 1));
        const discVal = Math.max(0, Number(merged.discountValue || 0));
        const taxRate = Math.max(0, Number(merged.taxRate ?? 18));

        let discPerUnit = 0;
        if (merged.discountType === 'percentage') {
          discPerUnit = (orig * discVal) / 100;
        } else {
          discPerUnit = discVal;
        }
        // Cap discount so unit price cannot be negative
        discPerUnit = Math.min(orig, Math.max(0, discPerUnit));
        const discountedUnit = Math.max(0, orig - discPerUnit);
        const lineTotal = qty * discountedUnit;
        const taxAmt = (lineTotal * taxRate) / 100;

        return {
          ...merged,
          originalUnitPrice: orig,
          quantity: qty,
          discountValue: discVal,
          discountPerUnit: Math.round(discPerUnit * 100) / 100,
          discountedUnitPrice: Math.round(discountedUnit * 100) / 100,
          totalAmount: Math.round(lineTotal * 100) / 100,
          taxAmt: Math.round(taxAmt * 100) / 100
        };
      })
    );
  };

  // Search and Filter Matching Products for Searchable Input
  const getMatchingProducts = (currentText: string) => {
    const query = (currentText || '').trim().toLowerCase();
    if (!query) {
      return catalogProducts.slice(0, 8);
    }
    return catalogProducts
      .filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.includes(query))
      )
      .slice(0, 8);
  };

  // Direct Product Selection from Master / Stock Suggestions
  const handleProductSelectDirect = (id: string, prod: any) => {
    const origPrice = Number(prod.sellingPrice || prod.retailPrice || prod.costPrice || 0);
    const taxRate = Number(prod.taxRate ?? 18);
    const stock = Number(prod.currentStock || 0);

    updateLineItem(id, {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku || prod.code || 'SKU-GEN',
      availableStock: stock,
      unit: prod.primaryUnit || 'Piece',
      originalUnitPrice: origPrice,
      taxRate: taxRate
    });
    setActiveSearchRowId(null);
  };

  // Manual or Typing Product Name
  const handleProductNameChange = (id: string, text: string) => {
    setActiveSearchRowId(id);
    const exactMatch = catalogProducts.find(
      p => p.name?.toLowerCase() === text.trim().toLowerCase()
    );

    if (exactMatch) {
      const origPrice = Number(exactMatch.sellingPrice || exactMatch.retailPrice || exactMatch.costPrice || 0);
      const taxRate = Number(exactMatch.taxRate ?? 18);
      const stock = Number(exactMatch.currentStock || 0);

      updateLineItem(id, {
        productId: exactMatch.id,
        productName: text,
        sku: exactMatch.sku || exactMatch.code || 'SKU-GEN',
        availableStock: stock,
        unit: exactMatch.primaryUnit || 'Piece',
        originalUnitPrice: origPrice,
        taxRate: taxRate
      });
    } else {
      updateLineItem(id, {
        productName: text,
        productId: ''
      });
    }
  };

  // Clear Selected Product
  const clearProduct = (id: string) => {
    updateLineItem(id, {
      productId: '',
      productName: '',
      sku: '',
      availableStock: 0,
      originalUnitPrice: 0,
      discountValue: 0
    });
  };

  // Remove Line Item
  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      clearProduct(id);
      return;
    }
    setLineItems(prev => prev.filter(i => i.id !== id));
  };

  // Live Summary Calculations
  const summary = useMemo(() => {
    let grossSubtotal = 0;
    let totalBulkDiscount = 0;
    let netSubtotal = 0;
    let totalTax = 0;
    let totalQty = 0;

    lineItems.forEach(item => {
      const origLine = item.quantity * item.originalUnitPrice;
      const discLine = item.quantity * item.discountPerUnit;
      const netLine = item.totalAmount;
      const taxLine = item.taxAmt;

      grossSubtotal += origLine;
      totalBulkDiscount += discLine;
      netSubtotal += netLine;
      totalTax += taxLine;
      totalQty += item.quantity;
    });

    const addCharges = Math.max(0, Number(additionalCharges || 0));
    const grandTotal = Math.round((netSubtotal + totalTax + addCharges) * 100) / 100;
    const advance = Math.min(grandTotal, Math.max(0, Number(advancePayment || 0)));
    const balanceDue = Math.max(0, Math.round((grandTotal - advance) * 100) / 100);

    const effectiveDiscountPercent = grossSubtotal > 0 ? (totalBulkDiscount / grossSubtotal) * 100 : 0;

    return {
      grossSubtotal: Math.round(grossSubtotal * 100) / 100,
      totalBulkDiscount: Math.round(totalBulkDiscount * 100) / 100,
      netSubtotal: Math.round(netSubtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      additionalCharges: addCharges,
      grandTotal,
      advancePayment: advance,
      balanceDue,
      totalQty,
      effectiveDiscountPercent: Math.round(effectiveDiscountPercent * 10) / 10
    };
  }, [lineItems, additionalCharges, advancePayment]);

  // Handle Save (Draft or Bulk Order)
  const handleSave = async (isDraft: boolean) => {
    setErrorMessage(null);

    // Validation
    if (!customerName.trim()) {
      setErrorMessage('Please enter or select a customer name.');
      return;
    }

    const validItems = lineItems.filter(i => i.productName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one product with a valid name and quantity.');
      return;
    }

    setIsSaving(true);
    try {
      const targetCompanyId = company?.id || '00000000-0000-0000-0000-000000000001';
      const orderStatus = isDraft ? 'Draft' : 'Ordered';
      const actualDocType = isDraft ? 'quotation' : (docType === 'quotation' ? 'quotation' : 'bulk_order');

      // Prepare rich JSON metadata
      const bulkMeta = {
        isBulkOrder: true,
        docType: actualDocType,
        orderStatus,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        customerAddress: customerAddress.trim(),
        customerGstin: customerGstin.trim(),
        warehouseId: warehouseId || null,
        warehouseName: warehouses.find(w => w.id === warehouseId)?.name || 'Central Godown',
        grossSubtotal: summary.grossSubtotal,
        totalBulkDiscount: summary.totalBulkDiscount,
        effectiveDiscountPercent: summary.effectiveDiscountPercent,
        netSubtotal: summary.netSubtotal,
        additionalCharges: summary.additionalCharges,
        additionalChargesNote,
        taxTotal: summary.totalTax,
        grandTotal: summary.grandTotal,
        advancePayment: summary.advancePayment,
        balanceDue: summary.balanceDue,
        paymentMethod,
        termsAndConditions,
        specialNotes: notes
      };

      const metaPrefix = '<!-- UB_BULK_ORDER_META:';
      const metaSuffix = ' -->';
      const combinedNotes = `${notes.trim()}\n${metaPrefix}${JSON.stringify(bulkMeta)}${metaSuffix}`;

      // Insert into purchases table
      const purchasePayload = {
        company_id: targetCompanyId,
        invoice_number: billNumber,
        doc_type: actualDocType,
        date: orderDate,
        due_date: deliveryDate,
        supplier_id: null,
        supplier_name: customerName.trim(),
        supplier_gstin: customerGstin.trim() || null,
        warehouse_id: warehouseId && warehouseId.length === 36 ? warehouseId : null,
        subtotal: summary.netSubtotal,
        tax_total: summary.totalTax,
        freight_charges: summary.additionalCharges,
        other_charges: 0,
        grand_total: summary.grandTotal,
        paid_amount: summary.advancePayment,
        payment_status: summary.balanceDue === 0 && summary.grandTotal > 0 ? 'Paid' : summary.advancePayment > 0 ? 'Partial' : 'Unpaid',
        notes: combinedNotes
      };

      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert(purchasePayload)
        .select()
        .single();

      if (purchaseError || !purchaseData) {
        throw new Error(purchaseError?.message || 'Failed to save order to database.');
      }

      // Insert line items into purchase_items table
      const purchaseItemsPayload = validItems.map(item => ({
        purchase_id: purchaseData.id,
        product_id: item.productId && item.productId.length === 36 ? item.productId : null,
        product_name: item.productName.trim(),
        qty: item.quantity,
        unit: item.unit || 'Piece',
        rate: item.discountedUnitPrice, // negotiated discounted unit rate
        discount: Math.round(item.quantity * item.discountPerUnit * 100) / 100, // total bulk discount
        tax_rate: item.taxRate,
        tax_amt: item.taxAmt,
        total: item.totalAmount
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItemsPayload);

      if (itemsError) {
        console.warn('Items insert warning:', itemsError.message);
      }

      // If customer is not existing and user entered info, auto-save customer for convenience
      if (!selectedCustomerId && customerName.trim()) {
        try {
          await supabase.from('customers').insert({
            company_id: targetCompanyId,
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            email: customerEmail.trim() || null,
            address: customerAddress.trim() || null,
            gstin: customerGstin.trim() || null,
            customer_type: 'Wholesale'
          });
        } catch (custErr) {
          // non-blocking
        }
      }

      setSaveSuccess(
        isDraft
          ? `Quotation Draft #${billNumber} saved successfully!`
          : `Quotation #${billNumber} saved successfully and added to Active Order Tracking!`
      );

      if (refreshData) {
        try {
          await refreshData();
        } catch {}
      }

      setTimeout(() => {
        if (onSaved) onSaved(purchaseData);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving quotation.');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Bill / Generate PDF Handler
  const handlePrint = () => {
    setActiveTab('preview');
    setTimeout(() => {
      window.print();
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        
        {/* Top Header - Hidden in Print */}
        <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Quotation System
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Quotation
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Create commercial quotations with volume pricing, negotiated discounts, tax calculations, and formal proposal exports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Form vs Preview Tab */}
            <div className="flex bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quotation Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Quotation Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback / Alert Banners */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 px-6 shrink-0 print:hidden animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 px-6 shrink-0 print:hidden animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 print:p-0 print:overflow-visible">
          {activeTab === 'form' ? (
            <>
              {/* Top Configuration Bar: Quotation Number, Date, Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quotation Number
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={e => setBillNumber(e.target.value)}
                    className="w-full h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quotation Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={e => setOrderDate(e.target.value)}
                    className="w-full h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fulfillment Warehouse
                  </label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.code ? `(${w.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 1: Customer Information */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Customer Information & Procurement Details
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Customer Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Apex Infrastructures Ltd"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="w-full h-8.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="+91 98765 43210"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          className="w-full h-8.5 pl-8 pr-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Billing / Delivery Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Plot No. 45, MIDC Industrial Estate, Mumbai, MH"
                        value={customerAddress}
                        onChange={e => setCustomerAddress(e.target.value)}
                        className="w-full h-8.5 pl-8 pr-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Products & Bulk Discount Line Items */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Product Selection & Discount Pricing
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Select products from master, specify order volumes, and apply negotiated fixed or percentage discounts.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addLineItem()}
                    className="h-8 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product Item</span>
                  </button>
                </div>

                {/* Example Explainer Banner */}
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/70 text-[11px] text-blue-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Bulk Discount Formula:</strong> Discounted Unit Price = Original Unit Price − Bulk Discount.
                      (e.g., ₹400 − ₹20 = ₹380/unit × 100 qty = ₹38,000 total). Negative prices are prevented automatically.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-blue-700 shrink-0">
                    {lineItems.length} Product{lineItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Products Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto min-h-[220px]">
                  <table className="w-full text-left text-xs min-w-[780px]">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center font-bold">#</th>
                        <th className="py-2.5 px-3 min-w-[260px] font-bold">Product Name</th>
                        <th className="py-2.5 px-2 text-center w-24 font-bold">Quantity</th>
                        <th className="py-2.5 px-2 text-center w-20 font-bold">Unit</th>
                        <th className="py-2.5 px-2 text-right w-28 font-bold">Original Price</th>
                        <th className="py-2.5 px-2 text-center w-40 font-bold">Bulk Discount</th>
                        <th className="py-2.5 px-2 text-right w-28 font-bold">Net Rate</th>
                        <th className="py-2.5 px-3 text-right w-28 font-bold">Total</th>
                        <th className="py-2.5 px-2 text-center w-12 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((item, idx) => {
                        const matchingProds = getMatchingProducts(item.productName);
                        const isSearchOpen = activeSearchRowId === item.id;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* 1. # */}
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                              {idx + 1}
                            </td>

                            {/* 2. Product Name (Single Combined Searchable & Manual Field) */}
                            <td className="py-2.5 px-3 relative">
                              <div className="relative">
                                <div className="relative flex items-center">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={item.productName}
                                    onChange={e => handleProductNameChange(item.id, e.target.value)}
                                    onFocus={() => setActiveSearchRowId(item.id)}
                                    onBlur={() => setTimeout(() => setActiveSearchRowId(null), 250)}
                                    placeholder="Search product master or type custom name..."
                                    className="w-full h-8 pl-8 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                  {item.productName && (
                                    <button
                                      type="button"
                                      onClick={() => clearProduct(item.id)}
                                      className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                      title="Clear product"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Autocomplete Suggestion Dropdown */}
                                {isSearchOpen && (
                                  <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[320px] max-w-[420px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto">
                                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                      <span>Stock Catalog Matches</span>
                                      <span>{matchingProds.length} available</span>
                                    </div>
                                    {matchingProds.length > 0 ? (
                                      matchingProds.map(p => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onMouseDown={e => {
                                            e.preventDefault();
                                            handleProductSelectDirect(item.id, p);
                                          }}
                                          className="w-full px-3 py-2 text-left hover:bg-blue-50/80 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-2 group cursor-pointer"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                                              {p.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                              {p.sku && (
                                                <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">
                                                  {p.sku}
                                                </span>
                                              )}
                                              {p.primaryUnit && <span>{p.primaryUnit}</span>}
                                              {p.currentStock !== undefined && (
                                                <span className={`font-medium ${p.currentStock > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                  Stock: {p.currentStock}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-mono font-bold text-xs text-slate-900 block">
                                              ₹{formatNumber(p.sellingPrice || p.retailPrice || p.costPrice || 0)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              GST: {p.taxRate || 18}%
                                            </span>
                                          </div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="p-3 text-center text-xs text-slate-500">
                                        No stock product matching &ldquo;{item.productName}&rdquo;.
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          Manual entry: you can specify unit and price directly.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Stock Item Badge */}
                                {item.productId && (
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1 px-0.5">
                                    <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium">
                                      <Check className="w-2.5 h-2.5" /> Master Linked
                                    </span>
                                    {item.sku && <span>SKU: {item.sku}</span>}
                                    {item.availableStock !== undefined && item.availableStock > 0 && (
                                      <span className="text-emerald-600">Stock: {item.availableStock}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 3. Quantity */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                                className="w-20 h-8 px-2 text-center font-mono font-bold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </td>

                            {/* 4. Unit */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={e => updateLineItem(item.id, { unit: e.target.value })}
                                className="w-16 h-8 px-1 text-center font-medium text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Pcs"
                              />
                            </td>

                            {/* 5. Original Price */}
                            <td className="py-2.5 px-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.originalUnitPrice || ''}
                                onChange={e => updateLineItem(item.id, { originalUnitPrice: Number(e.target.value) })}
                                className="w-24 h-8 px-2 text-right font-mono font-semibold text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="0"
                              />
                            </td>

                            {/* 6. Bulk Discount (Clean Dropdown + Value, No Automatic Buttons) */}
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1 justify-center">
                                <select
                                  value={item.discountType}
                                  onChange={e => updateLineItem(item.id, { discountType: e.target.value as any })}
                                  className="h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                >
                                  <option value="percentage">% / unit</option>
                                  <option value="fixed">₹ / unit</option>
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step={item.discountType === 'percentage' ? '0.1' : '1'}
                                  value={item.discountValue || ''}
                                  onChange={e => updateLineItem(item.id, { discountValue: Number(e.target.value) })}
                                  className="w-16 h-8 px-2 text-right font-mono font-bold text-xs rounded-lg border border-slate-200 text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="0"
                                />
                              </div>
                            </td>

                            {/* 7. Net Rate */}
                            <td className="py-2.5 px-2 text-right">
                              <span className="font-mono font-bold text-slate-900 block text-xs">
                                ₹{formatNumber(item.discountedUnitPrice)}
                              </span>
                              {item.discountPerUnit > 0 && (
                                <span className="text-[10px] text-emerald-600 font-mono block">
                                  -₹{formatNumber(item.discountPerUnit)} off
                                </span>
                              )}
                            </td>

                            {/* 8. Total */}
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-blue-600 block text-xs">
                                ₹{formatNumber(item.totalAmount)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Tax: {item.taxRate}%
                              </span>
                            </td>

                            {/* 9. Action */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Summary, Delivery Charges & Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Terms & Conditions, Notes & Advance Payment */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3 text-xs">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Terms & Conditions
                    </label>
                    <textarea
                      rows={3}
                      value={termsAndConditions}
                      onChange={e => setTermsAndConditions(e.target.value)}
                      placeholder="Enter payment and delivery conditions."
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Notes
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Enter any special instructions."
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="Bank Transfer">Bank Transfer / NEFT</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Credit / Later">Credit / 30 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Advance Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={advancePayment}
                        onChange={e => setAdvancePayment(Number(e.target.value))}
                        className="w-full h-8 px-2.5 text-right font-mono font-bold text-xs rounded-lg border border-slate-200 text-emerald-700 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Quotation Summary */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 shadow-2xs space-y-2.5 text-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                      <span className="font-bold">Quotation Summary</span>
                      <span className="text-[11px] text-slate-500 font-mono font-normal">
                        Total Products: {summary.totalQty}
                      </span>
                    </h3>

                    <div className="space-y-2 pt-2 text-slate-700 font-medium">
                      {/* Original Amount */}
                      <div className="flex justify-between items-center">
                        <span>Original Amount:</span>
                        <span className="font-mono text-slate-900">₹{formatNumber(summary.grossSubtotal)}</span>
                      </div>

                      {/* Discount */}
                      <div className="flex justify-between items-center text-emerald-600 font-semibold">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          <span>Discount{summary.effectiveDiscountPercent > 0 ? ` (${summary.effectiveDiscountPercent}%)` : ''}:</span>
                        </span>
                        <span className="font-mono">- ₹{formatNumber(summary.totalBulkDiscount)}</span>
                      </div>

                      {/* Amount After Discount */}
                      <div className="flex justify-between items-center text-slate-900 font-semibold pt-1 border-t border-slate-200/80">
                        <span>Amount After Discount:</span>
                        <span className="font-mono">₹{formatNumber(summary.netSubtotal)}</span>
                      </div>

                      {/* Delivery Charges */}
                      <div className="flex justify-between items-center">
                        <span>Delivery Charges:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-mono">+ ₹</span>
                          <input
                            type="number"
                            min="0"
                            value={additionalCharges}
                            onChange={e => setAdditionalCharges(Number(e.target.value))}
                            className="w-20 h-7 px-2 text-right font-mono text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* GST */}
                      <div className="flex justify-between items-center">
                        <span>GST:</span>
                        <span className="font-mono text-slate-800">+ ₹{formatNumber(summary.totalTax)}</span>
                      </div>

                      {/* Final Amount */}
                      <div className="flex justify-between items-center p-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs my-2">
                        <span className="tracking-tight uppercase text-xs font-bold text-blue-100">Final Amount:</span>
                        <span className="font-mono text-base font-bold">₹{formatNumber(summary.grandTotal)}</span>
                      </div>

                      {/* Advance Paid & Balance to Pay */}
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <div className="flex justify-between items-center text-emerald-600 font-semibold">
                          <span>Advance Paid:</span>
                          <span className="font-mono">₹{formatNumber(summary.advancePayment)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-900 font-bold text-xs pt-1 border-t border-slate-200/60">
                          <span>Balance to Pay:</span>
                          <span className={`font-mono text-sm ${summary.balanceDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            ₹{formatNumber(summary.balanceDue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Professional Printable Bill Layout */
            <div id="printable-bulk-bill" className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 max-w-4xl mx-auto text-slate-900 space-y-6 print:border-none print:p-0 print:m-0 print:max-w-none">
              
              {/* Document Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {company?.name || 'UNIVERSAL ENTERPRISE ERP'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {company?.address || 'Industrial Area Phase 2, Mumbai, MH - 400001'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Phone: {company?.phone || '+91 98765 00000'} | Email: {company?.email || 'sales@universalbilling.com'}
                  </p>
                  {company?.gstin && (
                    <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                      GSTIN: {company.gstin}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 mb-2">
                    COMMERCIAL QUOTATION
                  </span>
                  <div className="text-xs space-y-0.5 font-mono">
                    <p className="font-bold text-slate-900 text-sm">
                      {billNumber}
                    </p>
                    <p className="text-slate-500">Date: {formatDate(orderDate)}</p>
                  </div>
                </div>
              </div>

              {/* Customer & Delivery Parties */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Billed To / Customer Details
                  </span>
                  <p className="font-bold text-slate-900 text-sm">{customerName || 'Valued Customer'}</p>
                  {customerPhone && <p className="text-slate-600 mt-0.5">Phone: {customerPhone}</p>}
                  {customerAddress && <p className="text-slate-600 mt-0.5">{customerAddress}</p>}
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Fulfillment & Shipping Logistics
                  </span>
                  <p className="font-bold text-slate-800">
                    Warehouse: {warehouses.find(w => w.id === warehouseId)?.name || 'Central Godown'}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Dispatch Terms: Standard Surface Freight
                  </p>
                  <p className="text-slate-600">
                    Payment Method: {paymentMethod}
                  </p>
                  <p className="font-medium text-blue-700 mt-1">
                    Status: Commercial Quotation / Proposal
                  </p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Orig. Rate</th>
                      <th className="py-2.5 px-2 text-right">Discount</th>
                      <th className="py-2.5 px-2 text-right">Net Rate</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems
                      .filter(i => i.productName.trim())
                      .map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-500">
                            ₹{formatNumber(item.originalUnitPrice)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600 font-semibold">
                            {item.discountPerUnit > 0 ? `-₹${formatNumber(item.discountPerUnit)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            ₹{formatNumber(item.discountedUnitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{formatNumber(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="text-xs space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Terms & Conditions
                    </span>
                    <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                      {termsAndConditions}
                    </p>
                  </div>

                  {notes && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Notes
                      </span>
                      <p className="text-slate-600 text-[11px]">
                        {notes}
                      </p>
                    </div>
                  )}

                  <div className="pt-8">
                    <div className="w-44 border-b border-slate-300 mb-1"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Authorized Signatory
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Original Amount:</span>
                    <span className="font-mono">₹{formatNumber(summary.grossSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span className="font-mono">- ₹{formatNumber(summary.totalBulkDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                    <span>Amount After Discount:</span>
                    <span className="font-mono">₹{formatNumber(summary.netSubtotal)}</span>
                  </div>
                  {summary.additionalCharges > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Charges:</span>
                      <span className="font-mono">+ ₹{formatNumber(summary.additionalCharges)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>GST:</span>
                    <span className="font-mono">+ ₹{formatNumber(summary.totalTax)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-900 p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span>Final Amount:</span>
                    <span className="font-mono text-base text-blue-700 font-bold">₹{formatNumber(summary.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold pt-1">
                    <span>Advance Paid:</span>
                    <span className="font-mono">₹{formatNumber(summary.advancePayment)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                    <span>Balance to Pay:</span>
                    <span className={`font-mono ${summary.balanceDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      ₹{formatNumber(summary.balanceDue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thank You Note */}
              <div className="text-center pt-4 border-t border-slate-100 text-xs text-slate-400">
                Thank you for your business. For any queries regarding this quotation, please reach out to our procurement desk.
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Bar - Hidden in Print */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Quotation</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Generate PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="h-9 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Quotation...' : 'Save Quotation'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
