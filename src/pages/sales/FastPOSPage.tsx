import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap,
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  Printer,
  CreditCard,
  QrCode,
  DollarSign,
  User,
  Check,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Loader2,
  AlertTriangle,
  X,
  Building,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Product, InvoiceItem, SalesInvoice, HeldInvoice, PaymentMethod } from '../../types';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { POSStepIndicator, TransactionStep } from '../../components/pos/POSStepIndicator';
import { POSKeyboardBar } from '../../components/pos/POSKeyboardBar';
import { POSQuantitySelector } from '../../components/pos/POSQuantitySelector';
import { POSHeldBillsDrawer } from '../../components/pos/POSHeldBillsDrawer';
import { POSShiftPanel } from '../../components/pos/POSShiftPanel';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { SimplePOSView } from '../../components/pos/SimplePOSView';
import { directPrintService } from '../../services/directPrintService';
import {
  parseNaturalQuantityInput,
  normalizeUniversalUnit,
  formatUnitQuantity,
  calculateCutStrip
} from '../../utils/universalUnitSystem';
import { sortProductsAZ } from '../../utils/sortUtils';

const POS_DRAFT_KEY = 'universal_billing_pos_draft_cart';

export const FastPOSPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    products,
    customers,
    createSalesInvoice,
    heldInvoices,
    holdInvoice,
    resumeInvoice,
    removeHeldInvoice,
    company,
    warehouses,
    getWarehouseStock,
    refreshStockBalances
  } = useERP();

  // In-Page Navigation Tabs (Part C)
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'billing');
  const [posMode, setPosMode] = useState<'simple' | 'advanced'>('simple');

  // Universal 5-Step Transaction State (Part B1)
  const [currentStep, setCurrentStep] = useState<TransactionStep>('select');

  // Customer & Store Selection (Step 1: SELECT)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    const walkIn = customers.find(c => c.name.toLowerCase().includes('walk-in')) || customers[0];
    return walkIn?.id || '';
  });

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || '';
  });

  // Basket Lines (Step 2: ENTER)
  const [cart, setCart] = useState<InvoiceItem[]>(() => {
    try {
      const saved = localStorage.getItem(POS_DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Selected line for F6 keyboard line editing
  const [selectedLineIndex, setSelectedLineIndex] = useState<number>(0);

  // Search & Barcode
  const [productSearch, setProductSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Modals & Drawers
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHeldDrawerOpen, setIsHeldDrawerOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Payment Options (Step 4: CONFIRM)
  const [tenderMethod, setTenderMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(0);

  // Undo Toast (Part B1: "Undo over confirm for reversible actions")
  const [undoToast, setUndoToast] = useState<{
    message: string;
    action: () => void;
  } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // Auto-save drafts into localStorage (Part B1)
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(cart));
      } else {
        localStorage.removeItem(POS_DRAFT_KEY);
      }
    } catch {}
  }, [cart]);

  // Compute live step in universal flow
  useEffect(() => {
    if (completedInvoice) {
      setCurrentStep('done');
    } else if (isPaymentModalOpen) {
      setCurrentStep('confirm');
    } else if (cart.length > 0) {
      setCurrentStep('review');
    } else {
      setCurrentStep('select');
    }
  }, [cart.length, isPaymentModalOpen, completedInvoice]);

  // Auto-focus barcode scanner
  useEffect(() => {
    if (activeTab === 'billing' && !isPaymentModalOpen && !isHeldDrawerOpen) {
      barcodeInputRef.current?.focus();
    }
  }, [activeTab, isPaymentModalOpen, isHeldDrawerOpen]);

  // Trigger undo toast for 8 seconds
  const triggerUndo = (message: string, undoAction: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, action: undoAction });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 8000);
  };

  // Add Product to Cart (<200ms performance budget)
  const handleAddToCart = useCallback((product: Product, quantity = 1) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const cur = next[existingIdx];
        const nextQty = cur.qty + quantity;
        const total = nextQty * cur.rate;
        const taxAmt = total * (cur.taxRate / 100);
        next[existingIdx] = {
          ...cur,
          qty: nextQty,
          taxAmt,
          total: total + taxAmt
        };
        return next;
      }

      // New line item
      const unit = normalizeUniversalUnit(product.primaryUnit);
      const rate = product.sellingPrice || 0;
      const taxRate = product.taxRate || 0;
      const lineSubtotal = rate * quantity;
      const taxAmt = lineSubtotal * (taxRate / 100);

      const newLine: InvoiceItem = {
        id: `pos-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        hsn: product.hsn,
        qty: quantity,
        unit,
        rate,
        discountPct: 0,
        discountAmt: 0,
        taxRate,
        taxAmt,
        cgstAmt: taxAmt / 2,
        sgstAmt: taxAmt / 2,
        igstAmt: 0,
        total: lineSubtotal + taxAmt,
        costPrice: product.costPrice || product.purchasePrice || 0
      };

      return [newLine, ...prev];
    });
  }, []);

  // Barcode Submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    // Fast indexed match: barcode, SKU, or exact code
    const matched = products.find(
      p => p.barcode === raw || p.sku.toLowerCase() === raw.toLowerCase() || p.code === raw
    );

    if (matched) {
      handleAddToCart(matched, 1);
      setBarcodeInput('');
    } else {
      // Check for partial name match
      const nameMatch = products.find(p => p.name.toLowerCase().includes(raw.toLowerCase()));
      if (nameMatch) {
        handleAddToCart(nameMatch, 1);
        setBarcodeInput('');
      } else {
        alert(`No product found matching code or barcode: "${raw}"`);
      }
    }
  };

  // Live Totals Calculations (Step 3: REVIEW)
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.rate * item.qty, 0);
  }, [cart]);

  const cartTaxTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.taxAmt || 0), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (cartSubtotal * globalDiscountPct) / 100;
  }, [cartSubtotal, globalDiscountPct]);

  const grandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal + cartTaxTotal - discountAmount);
  }, [cartSubtotal, cartTaxTotal, discountAmount]);

  // Remove Line with Undo
  const handleRemoveLine = (index: number) => {
    const removedItem = cart[index];
    const prevCart = [...cart];
    setCart(cart.filter((_, idx) => idx !== index));

    triggerUndo(`Removed "${removedItem.productName}" from bill.`, () => {
      setCart(prevCart);
    });
  };

  // Clear Bill with Undo
  const handleClearBill = () => {
    if (cart.length === 0) return;
    const prevCart = [...cart];
    setCart([]);
    triggerUndo('Cleared bill basket.', () => {
      setCart(prevCart);
    });
  };

  // Hold In-Progress Bill (F4)
  const handleHoldBill = () => {
    if (cart.length === 0) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    holdInvoice({
      id: `HOLD-${Date.now()}`,
      customerId: selectedCustomerId,
      heldAt: new Date().toISOString(),
      customerName: customer?.name || 'Walk-in Customer',
      items: cart,
      subtotal: cartSubtotal,
      taxTotal: cartTaxTotal,
      grandTotal,
      note: 'Held from POS terminal'
    });
    setCart([]);
    triggerUndo('Bill placed on hold.', () => {
      setCart(cart);
    });
  };

  // Resume Bill (F5)
  const handleResumeBill = (held: HeldInvoice) => {
    resumeInvoice(held.id);
    setCart(held.items);
    if (held.customerId) setSelectedCustomerId(held.customerId);
    setIsHeldDrawerOpen(false);
  };

  // Complete Payment & Confirm (Step 4 & 5: CONFIRM → DONE)
  const handleConfirmPayment = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const customer = customers.find(c => c.id === selectedCustomerId);
    const invoicePrefix = company.invoicePrefix || 'INV-';
    const invoiceNumber = `${invoicePrefix}${Date.now().toString().slice(-6)}`;

    const newInvoice: Omit<SalesInvoice, 'id' | 'createdAt'> = {
      invoiceNumber,
      docType: 'tax_invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      customerId: selectedCustomerId,
      customerName: customer?.name || 'Walk-in Customer',
      customerPhone: customer?.phone || '',
      customerGstin: customer?.gstin || '',
      customerAddress: customer?.address || '',
      warehouseId: selectedWarehouseId,
      items: cart,
      subtotal: cartSubtotal,
      discountTotal: discountAmount,
      taxTotal: cartTaxTotal,
      cgstTotal: cartTaxTotal / 2,
      sgstTotal: cartTaxTotal / 2,
      igstTotal: 0,
      roundOff: 0,
      grandTotal,
      paidAmount: grandTotal,
      paymentStatus: 'Paid',
      paymentMethod: tenderMethod,
      notes: `POS Terminal Sale (${profile?.fullName || 'Cashier'})`
    };

    try {
      const created = await createSalesInvoice(newInvoice);
      setCompletedInvoice(created);
      setCart([]);
      setIsPaymentModalOpen(false);
      localStorage.removeItem(POS_DRAFT_KEY);

      // Attempt silent background thermal printing via local print bridge (port 9191)
      try {
        await directPrintService.printReceipt(created, company);
      } catch {}
    } catch (err: any) {
      alert(`Error saving bill: ${err?.message || 'Transaction failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard Shortcuts Listener (Part B6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === 'F5') {
        e.preventDefault();
        setIsHeldDrawerOpen(prev => !prev);
      } else if (e.key === 'F8') {
        e.preventDefault();
        const discount = prompt('Enter bill discount percentage %:', String(globalDiscountPct));
        if (discount !== null) setGlobalDiscountPct(Math.max(0, Math.min(100, parseFloat(discount) || 0)));
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentModalOpen(true);
      } else if (e.key === 'Escape') {
        if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        else if (isHeldDrawerOpen) setIsHeldDrawerOpen(false);
        else if (isCustomerModalOpen) setIsCustomerModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, globalDiscountPct, isPaymentModalOpen, isHeldDrawerOpen]);

  // Tab definitions (Part C: Billing (POS): Full-screen billing · Held bills drawer · Shift panel)
  const posTabs: TabItem[] = [
    { id: 'billing', label: 'Billing Counter', icon: Zap },
    { id: 'held', label: 'Held Bills', count: heldInvoices.length, icon: Pause },
    { id: 'shift', label: 'Cashier Shift', icon: Clock }
  ];

  // 1-Tap Simple Counter POS Checkout
  const handleSimpleCheckout = async (params: {
    cart: InvoiceItem[];
    paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
    discountPct: number;
    tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D';
    sendWhatsApp: boolean;
  }) => {
    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const subtotal = params.cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
      const discountTotal = (subtotal * params.discountPct) / 100;
      const grandTotal = Math.max(0, subtotal - discountTotal);
      const invoicePrefix = company.invoicePrefix || 'POS-';
      const invoiceNumber = `${invoicePrefix}${Date.now().toString().slice(-6)}`;

      const newInvoice: Omit<SalesInvoice, 'id' | 'createdAt'> = {
        invoiceNumber,
        docType: 'pos_invoice',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Walk-in Customer',
        customerPhone: customer?.phone || '',
        customerGstin: customer?.gstin || '',
        customerAddress: customer?.address || '',
        warehouseId: selectedWarehouseId,
        items: params.cart,
        subtotal,
        discountTotal,
        taxTotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        roundOff: 0,
        grandTotal,
        paidAmount: grandTotal,
        paymentStatus: 'Paid',
        paymentMethod: params.paymentMethod,
        priceTierApplied: params.tier,
        notes: `Simple 1-Tap Counter POS (${profile?.fullName || 'Cashier'})`
      };

      const created = await createSalesInvoice(newInvoice);
      setCompletedInvoice(created);
      setCurrentStep('done');

      // Attempt silent background thermal printing
      try {
        await directPrintService.printReceipt(created, company);
      } catch {}
    } catch (err: any) {
      alert(`Error completing POS sale: ${err?.message || 'Transaction failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'held') setIsHeldDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] -m-3 sm:-m-5 lg:-m-6 overflow-hidden bg-slate-100/70 dark:bg-slate-950 font-sans select-none">
      {/* Top Header: Step Flow Indicator + In-Page Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-4 py-2 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <Tabs
            tabs={posTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="pills"
          />
        </div>

        {/* Universal 5-Step Indicator (Part B1) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPosMode(prev => prev === 'simple' ? 'advanced' : 'simple')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-2xs hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{posMode === 'simple' ? 'Switch to Full Grid' : '⚡ 1-Tap Counter POS'}</span>
          </button>
          <POSStepIndicator currentStep={currentStep} className="shrink-0" />
        </div>
      </div>

      {/* Main Work Area */}
      <div className="flex-1 overflow-hidden p-3 flex gap-3 min-h-0">
        {activeTab === 'shift' ? (
          <div className="flex-1 overflow-y-auto p-4">
            <POSShiftPanel />
          </div>
        ) : posMode === 'simple' && activeTab === 'billing' && !completedInvoice ? (
          <div className="flex-1 overflow-hidden">
            <SimplePOSView
              products={products}
              customers={customers}
              companyName={company.name}
              companyPhone={company.phone}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomerId={setSelectedCustomerId}
              onCheckout={handleSimpleCheckout}
              onSwitchToAdvanced={() => setPosMode('advanced')}
            />
          </div>
        ) : completedInvoice ? (
          /* Step 5: DONE Success Screen (Part B1) */
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Payment Received: {formatCurrency(completedInvoice.grandTotal)}
              </h2>
              <p className="text-sm text-slate-500 font-mono">
                Bill #{completedInvoice.invoiceNumber} | Customer: {completedInvoice.customerName}
              </p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                Receipt spooled to thermal printer via Direct Print Bridge.
              </p>
            </div>

            {/* Next Best Actions (Part B1) */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 max-w-md">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Print / Preview (Ctrl+P)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedInvoice(null);
                  setCart([]);
                  barcodeInputRef.current?.focus();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Bill (F2)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 1 & 2: Main POS Billing Counter */
          <>
            {/* Left Column: Product Search, Scanner & Fast Item Grid */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden min-w-0">
              {/* Barcode Scanner & Search Bar */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="w-4 h-4 absolute left-3 top-2.5 text-blue-600" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Scan barcode or type product name/SKU... (Press F2)"
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    Add Line
                  </button>
                </form>
              </div>

              {/* Fast Touch Catalogue Grid */}
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {products.filter(p => p.isActive).slice(0, 40).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddToCart(p, 1)}
                    className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-blue-400 hover:shadow-xs text-left transition-all flex flex-col justify-between cursor-pointer group active:scale-98"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {p.primaryUnit}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(p.sellingPrice)}
                      </span>
                      <span className="w-5 h-5 rounded-md bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Customer Bar, Cart Lines Table, Review & Confirm */}
            <div className="w-96 lg:w-[420px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden shrink-0">
              {/* Customer Selector (Step 1: SELECT) */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer truncate"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'Retail'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleHoldBill}
                    disabled={cart.length === 0}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Hold Bill (F4)"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBill}
                    disabled={cart.length === 0}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                    title="Clear Bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cart Line Items Table (Step 2: ENTER) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                    <ShoppingBag className="w-10 h-10 opacity-30" />
                    <p className="text-xs font-medium">Cart is empty</p>
                    <p className="text-[11px] text-slate-400">Scan barcode or click items to build basket.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedLineIndex(idx)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                        idx === selectedLineIndex
                          ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(item.rate)} / {item.unit} {item.taxRate > 0 ? `(+${item.taxRate}%)` : ''}
                        </p>
                      </div>

                      {/* Quantity Selector Component with Unit Parser */}
                      <POSQuantitySelector
                        item={item}
                        itemStock={999}
                        isOutOfStock={false}
                        isInsufficient={false}
                        decimalAllowed={['KG', 'LTR', 'MTR', 'SQF'].includes(item.unit)}
                        onUpdateQty={delta => {
                          const nextQty = Math.max(1, item.qty + delta);
                          setCart(prev => {
                            const next = [...prev];
                            const cur = next[idx];
                            const total = nextQty * cur.rate;
                            const taxAmt = total * (cur.taxRate / 100);
                            next[idx] = { ...cur, qty: nextQty, taxAmt, total: total + taxAmt };
                            return next;
                          });
                        }}
                        onSetQty={newQty => {
                          const parsed = typeof newQty === 'string' ? parseFloat(newQty) : newQty;
                          if (isNaN(parsed) || parsed <= 0) return { success: false };
                          setCart(prev => {
                            const next = [...prev];
                            const cur = next[idx];
                            const total = parsed * cur.rate;
                            const taxAmt = total * (cur.taxRate / 100);
                            next[idx] = { ...cur, qty: parsed, taxAmt, total: total + taxAmt };
                            return next;
                          });
                          return { success: true };
                        }}
                      />

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block">
                          {formatCurrency(item.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Step 3: REVIEW Summary Card */}
              <div className="p-3.5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Lines: {cart.length} | Items: {cart.reduce((s, i) => s + i.qty, 0)}</span>
                  <span>Subtotal: {formatCurrency(cartSubtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Tax Total:</span>
                  <span>{formatCurrency(cartTaxTotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-600 font-semibold">
                    <span>Discount ({globalDiscountPct}%):</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {/* Grand Total (32px+ Typography per Part B3) */}
                <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Grand Total
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>

                {/* Step 4: CONFIRM — ONE Primary Large Action Button (Part B1) */}
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4 stroke-[2.5]" />
                  <span>PAY {formatCurrency(grandTotal)} (F10)</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Undo Toast Notification (8 Seconds Duration - Part B1) */}
      {undoToast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs animate-fadeIn">
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={() => {
              undoToast.action();
              setUndoToast(null);
            }}
            className="text-amber-400 font-bold hover:underline cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {/* Bottom POS Keyboard Hint Bar (Part B6) */}
      <POSKeyboardBar
        onF2Search={() => barcodeInputRef.current?.focus()}
        onF3Customer={() => setIsCustomerModalOpen(true)}
        onF4Hold={handleHoldBill}
        onF5Resume={() => setIsHeldDrawerOpen(true)}
        onF8Discount={() => {
          const discount = prompt('Enter discount %:', String(globalDiscountPct));
          if (discount !== null) setGlobalDiscountPct(parseFloat(discount) || 0);
        }}
        onF10Pay={() => {
          if (cart.length > 0) setIsPaymentModalOpen(true);
        }}
        onEscClear={handleClearBill}
        heldCount={heldInvoices.length}
      />

      {/* Payment Confirmation Modal (Step 4: CONFIRM) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Complete Payment</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-2">
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Amount Due</span>
              <p className="text-3xl font-extrabold text-blue-600 font-mono mt-1">
                {formatCurrency(grandTotal)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Card'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTenderMethod(m)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    tenderMethod === m
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {tenderMethod === 'Cash' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Cash Tendered by Customer
                </label>
                <input
                  type="number"
                  placeholder={String(grandTotal)}
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold font-mono rounded-xl border border-slate-200 dark:border-slate-700 text-center"
                />
                {cashTendered && parseFloat(cashTendered) >= grandTotal && (
                  <p className="text-xs font-bold text-emerald-600 text-center mt-2">
                    Change Due: {formatCurrency(parseFloat(cashTendered) - grandTotal)}
                  </p>
                )}
              </div>
            )}

            {/* Confirm Payment Action Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmPayment}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Posting Invoice...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm Payment & Print Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Held Invoices Drawer */}
      <POSHeldBillsDrawer
        isOpen={isHeldDrawerOpen}
        onClose={() => setIsHeldDrawerOpen(false)}
        heldInvoices={heldInvoices}
        onResume={handleResumeBill}
        onDelete={id => removeHeldInvoice(id)}
      />

      {/* Invoice Print Modal */}
      {completedInvoice && (
        <InvoicePrintModal
          isOpen={isPrintModalOpen}
          invoice={completedInvoice}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
