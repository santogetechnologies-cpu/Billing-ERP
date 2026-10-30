import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Product, InvoiceItem, SalesInvoice, HeldInvoice, PaymentMethod } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { barcodeService } from '../../services/barcodeService';
import { POSQuantitySelector } from '../../components/pos/POSQuantitySelector';
import { UNIVERSAL_BUILTIN_UNITS } from '../../data/unitsData';
import { ModalCloseButton } from '../../components/common/ModalCloseButton';
import { UserPresenceBadge } from '../../components/common/UserPresenceBadge';
import { sortProductsAZ } from '../../utils/sortUtils';
import { StockStatusBadge } from '../../components/common/StatusBadge';

export const FastPOSPage: React.FC = () => {
  const navigate = useNavigate();
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
    salesInvoices,
    units,
    getWarehouseStock,
    isLoading,
    error,
    refreshData,
    refreshStockBalances
  } = useERP();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [productSearch, setProductSearch] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [stockWarningMessage, setStockWarningMessage] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Synchronize and persist authorized warehouse selection across page refreshes
  const warehouseStorageKey = `universal_billing_pos_warehouse_${company.id || 'default'}`;

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(warehouseStorageKey);
        if (saved) return saved;
      }
    } catch {}
    return warehouses.find(w => w.isDefault && (w.isActive ?? true))?.id ||
           warehouses.find(w => (w.isActive ?? true))?.id ||
           warehouses[0]?.id || '';
  });

  // Ensure selectedWarehouseId synchronizes when warehouses finish loading from database
  useEffect(() => {
    if (warehouses.length === 0) return;

    setSelectedWarehouseId(prev => {
      // 1. Keep if currently valid in active warehouses list
      if (prev && warehouses.some(w => w.id === prev && (w.isActive ?? true))) {
        return prev;
      }
      // 2. Check localStorage
      try {
        const saved = localStorage.getItem(warehouseStorageKey);
        if (saved && warehouses.some(w => w.id === saved && (w.isActive ?? true))) {
          return saved;
        }
      } catch {}
      // 3. Fall back to authorized default warehouse or first active warehouse
      const defaultWh = warehouses.find(w => w.isDefault && (w.isActive ?? true)) ||
                        warehouses.find(w => (w.isActive ?? true)) ||
                        warehouses[0];
      return defaultWh?.id || '';
    });
  }, [warehouses, warehouseStorageKey]);

  // Persist warehouse selection whenever cashier changes it
  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(warehouseStorageKey, whId);
      }
    } catch {}
  };

  // Authoritative active warehouse ID guarantee: always resolves to authorized warehouse
  const activeWarehouseId = useMemo(() => {
    if (selectedWarehouseId && warehouses.some(w => w.id === selectedWarehouseId && (w.isActive ?? true))) {
      return selectedWarehouseId;
    }
    const defaultWh = warehouses.find(w => w.isDefault && (w.isActive ?? true)) ||
                      warehouses.find(w => (w.isActive ?? true)) ||
                      warehouses[0];
    return defaultWh?.id || selectedWarehouseId || '';
  }, [selectedWarehouseId, warehouses]);

  // Cart State
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    const walkIn = customers.find(c => c.name.toLowerCase().includes('walk-in')) || customers[0];
    return walkIn?.id || '';
  });

  // Synchronize customer selection once customers load
  useEffect(() => {
    if (customers.length === 0) return;
    setSelectedCustomerId(prev => {
      if (prev && customers.some(c => c.id === prev)) return prev;
      const walkIn = customers.find(c => c.name.toLowerCase().includes('walk-in')) || customers[0];
      return walkIn?.id || '';
    });
  }, [customers]);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [holdDrawerOpen, setHoldDrawerOpen] = useState(false);

  // Printed Invoice
  const [completedInvoice, setCompletedInvoice] = useState<SalesInvoice | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  // Auto-focus barcode input
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Keyboard shortcut listener for POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) setPaymentModalOpen(true);
      } else if (e.key === 'Escape') {
        setPaymentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered Products (sorted A-Z)
  const filteredProducts = useMemo(() => {
    const list = products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode.includes(productSearch);
      return matchCat && matchSearch && p.isActive;
    });
    return sortProductsAZ(list);
  }, [products, selectedCategory, productSearch]);

  // Display stock alert warning message
  const showStockWarning = (msg: string) => {
    setStockWarningMessage(msg);
  };

  // Add Product to Cart with strict available stock validation
  const addToCart = (product: Product, quantity = 1) => {
    const available = getWarehouseStock(activeWarehouseId, product.id);
    const existing = cart.find(item => item.productId === product.id);
    const currentQty = existing ? existing.qty : 0;
    const targetQty = currentQty + quantity;

    // Strict validation rule 1: Zero or negative available stock
    if (available <= 0) {
      showStockWarning('Out of Stock — This product cannot be billed because no stock is available.');
      return;
    }

    // Strict validation rule 2: Insufficient available quantity
    if (targetQty > available) {
      showStockWarning(`Insufficient stock. Available: ${available} ${product.primaryUnit}.`);
      return;
    }

    setStockWarningMessage(null);
    setCart(prev => {
      const existingInCart = prev.find(item => item.productId === product.id);
      if (existingInCart) {
        return prev.map(item => {
          if (item.productId === product.id) {
            const newQty = item.qty + quantity;
            const taxable = newQty * item.rate * (1 - item.discountPct / 100);
            const tax = (taxable * item.taxRate) / 100;
            return {
              ...item,
              qty: newQty,
              taxAmt: tax,
              cgstAmt: tax / 2,
              sgstAmt: tax / 2,
              total: taxable + tax
            };
          }
          return item;
        });
      }

      const taxable = quantity * product.sellingPrice;
      const tax = (taxable * product.taxRate) / 100;
      const newItem: InvoiceItem = {
        id: 'cart-' + Date.now() + Math.random().toString(36).substring(2, 5),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        hsn: product.hsn,
        qty: quantity,
        unit: product.primaryUnit,
        rate: product.sellingPrice,
        discountPct: 0,
        discountAmt: 0,
        taxRate: product.taxRate,
        taxAmt: tax,
        cgstAmt: tax / 2,
        sgstAmt: tax / 2,
        igstAmt: 0,
        total: taxable + tax,
        costPrice: product.costPrice
      };
      return [...prev, newItem];
    });
  };

  // Barcode scanner auto add with strict stock validation
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim();
    const parsed = await barcodeService.parseVariableBarcode(query, products);

    const product = parsed.product;
    if (product) {
      const available = getWarehouseStock(activeWarehouseId, product.id);
      const existing = cart.find(item => item.productId === product.id);
      const currentQty = existing ? existing.qty : 0;
      const targetQty = currentQty + parsed.parsedQuantity;

      if (available <= 0) {
        showStockWarning('Out of Stock — This product cannot be billed because no stock is available.');
        setBarcodeInput('');
        return;
      }

      if (targetQty > available) {
        showStockWarning(`Insufficient stock. Available: ${available} ${product.primaryUnit}.`);
        setBarcodeInput('');
        return;
      }

      addToCart(product, parsed.parsedQuantity);
      setBarcodeInput('');
    } else {
      alert(`Barcode "${query}" not recognized in product master.`);
    }
  };

  // Check whether a product's unit of measurement permits decimal quantities (Kg, Litre, Meter, etc.)
  const isDecimalUnitAllowed = (unitStr?: string): boolean => {
    if (!unitStr) return true;
    const normalized = unitStr.toLowerCase().trim();
    // 1. Check registered ERP units or universal built-in units
    const foundUnit =
      (units || []).find(u => u.name.toLowerCase() === normalized || u.symbol.toLowerCase() === normalized) ||
      UNIVERSAL_BUILTIN_UNITS.find(u => u.name.toLowerCase() === normalized || u.symbol.toLowerCase() === normalized);

    if (foundUnit) {
      return ['Weight', 'Volume', 'Length', 'Area', 'Volume Dimension'].includes(foundUnit.category);
    }

    // 2. Discrete units (Count / Packaging) strictly require integers
    const discreteUnits = [
      'piece', 'pcs', 'piece (pcs)', 'pair', 'pr', 'set', 'dozen', 'dzn',
      'box', 'carton', 'ctn', 'pack', 'bundle', 'bdl', 'roll', 'bag', 'bottle', 'btl', 'can'
    ];
    if (discreteUnits.includes(normalized)) {
      return false;
    }

    // 3. Decimal units
    const decimalKeywords = [
      'kg', 'kilogram', 'gram', 'ton', 'quintal', 'litre', 'liter', 'ml',
      'meter', 'metre', 'cm', 'feet', 'ft', 'inch', 'sq', 'cu'
    ];
    return decimalKeywords.some(keyword => normalized.includes(keyword));
  };

  // Directly set cart item quantity with strict stock limit, unit decimal validation, and recalculation
  const updateCartItemQuantity = (id: string, targetQtyInput: number | string): { success: boolean; message?: string } => {
    const item = cart.find(i => i.id === id);
    if (!item) return { success: false, message: 'Item not found in cart' };

    const parsedQty = typeof targetQtyInput === 'number' ? targetQtyInput : parseFloat(String(targetQtyInput).trim());

    if (isNaN(parsedQty) || !isFinite(parsedQty)) {
      const msg = 'Invalid quantity. Please enter a valid number.';
      showStockWarning(msg);
      return { success: false, message: msg };
    }

    if (parsedQty <= 0) {
      const msg = 'Quantity must be greater than zero.';
      showStockWarning(msg);
      return { success: false, message: msg };
    }

    const available = getWarehouseStock(activeWarehouseId, item.productId);

    if (available <= 0) {
      const msg = 'Out of Stock — This product cannot be billed because no stock is available.';
      showStockWarning(msg);
      return { success: false, message: msg };
    }

    if (parsedQty > available) {
      const msg = `Insufficient stock. Available: ${available} ${item.unit}.`;
      showStockWarning(msg);
      return { success: false, message: msg };
    }

    const decimalAllowed = isDecimalUnitAllowed(item.unit);
    if (!decimalAllowed && !Number.isInteger(parsedQty)) {
      const msg = `Quantity for ${item.unit} must be a whole number (integer).`;
      showStockWarning(msg);
      return { success: false, message: msg };
    }

    // Clean rounding for decimals (up to 3 decimal places) or exact integer
    const finalQty = decimalAllowed ? Math.round(parsedQty * 1000) / 1000 : Math.round(parsedQty);

    setStockWarningMessage(null);
    setCart(prev =>
      prev.map(i => {
        if (i.id === id) {
          const discountAmt = (finalQty * i.rate * (i.discountPct || 0)) / 100;
          const taxable = finalQty * i.rate - discountAmt;
          const tax = (taxable * i.taxRate) / 100;
          return {
            ...i,
            qty: finalQty,
            discountAmt,
            taxAmt: tax,
            cgstAmt: tax / 2,
            sgstAmt: tax / 2,
            total: taxable + tax
          };
        }
        return i;
      })
    );

    return { success: true };
  };

  // Adjust cart item quantity via plus/minus step buttons
  const updateQty = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    const targetQty = item.qty + delta;
    if (targetQty <= 0) {
      removeCartItem(id);
      return;
    }

    updateCartItemQuantity(id, targetQty);
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, i) => acc + i.qty * i.rate, 0);
  const discountTotal = cart.reduce((acc, i) => acc + i.discountAmt, 0);
  const taxTotal = cart.reduce((acc, i) => acc + i.taxAmt, 0);
  const rawGrandTotal = subtotal - discountTotal + taxTotal;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = grandTotal - rawGrandTotal;

  // Selected customer object
  const activeCustomer = useMemo(() => {
    return (
      customers.find(c => c.id === selectedCustomerId) ||
      customers.find(c => c.name.includes('Walk-in')) ||
      customers[0]
    );
  }, [customers, selectedCustomerId]);

  // Hold active invoice
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const held: HeldInvoice = {
      id: 'hold-' + Date.now(),
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: activeCustomer?.name || 'Walk-in Customer',
      items: cart,
      subtotal,
      taxTotal,
      grandTotal
    };
    holdInvoice(held);
    setCart([]);
  };

  // Resume held cart or prepared sales order handed over by Sales Person
  const handleResumeCart = (id: string) => {
    const resumed = resumeInvoice(id);
    if (resumed) {
      setCart(resumed.items);
      setHoldDrawerOpen(false);
      return;
    }
    const matchingOrder = salesInvoices.find(s => s.id === id || s.invoiceNumber === id);
    if (matchingOrder) {
      setCart(matchingOrder.items);
      if (matchingOrder.customerId) {
        setSelectedCustomerId(matchingOrder.customerId);
      }
      setHoldDrawerOpen(false);
    }
  };

  // Finalize POS Sale & Checkout with Pre-Transaction Stock Validation
  const handleCheckout = async () => {
    // Requirement 7: If the invoice has already been saved, printing it again must reuse the same saved invoice ID and invoice number. Never create another invoice or deduct stock again.
    if (completedInvoice && completedInvoice.id) {
      setPaymentModalOpen(false);
      setPrintModalOpen(true);
      return;
    }

    // Requirement 8: Prevent duplicate save operations from repeated clicks, print callbacks or page refreshes.
    if (cart.length === 0 || isSavingRef.current || isSubmitting) return;

    // Strict validation immediately before confirming transaction
    for (const item of cart) {
      const available = getWarehouseStock(activeWarehouseId, item.productId);
      if (available <= 0) {
        showStockWarning('Out of Stock — This product cannot be billed because no stock is available.');
        alert('Out of Stock — This product cannot be billed because no stock is available.');
        return;
      }
      if (item.qty > available) {
        const msg = `Insufficient stock. Available: ${available} ${item.unit}.`;
        showStockWarning(msg);
        alert(msg);
        return;
      }
    }

    isSavingRef.current = true;
    setIsSubmitting(true);
    try {
      let maxSeq = 1000;
      salesInvoices.forEach(s => {
        const match = (s.invoiceNumber || '').match(/POS-.*?(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      const invoiceNumber = `POS-${(company.financialYear || '2026-2027').split('-')[0]}-${maxSeq + 1}`;

      console.log(`[POS Checkout] Initiating checkout. Company: ${company.id}, Invoice: ${invoiceNumber}, Total: ₹${grandTotal}`);

      const tenderedNum = tenderMethod === 'Cash' && cashTendered ? Number(cashTendered) : grandTotal;
      const changeNum = tenderedNum > grandTotal ? tenderedNum - grandTotal : 0;
      const checkoutNotes = changeNum > 0
        ? `Tendered: ₹${tenderedNum.toFixed(2)} | Change: ₹${changeNum.toFixed(2)}`
        : `Payment settled via ${tenderMethod}`;

      const newInvoice = await createSalesInvoice({
        invoiceNumber,
        docType: 'pos_invoice',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerId: activeCustomer?.id || '',
        customerName: activeCustomer?.name || 'Walk-in Retail Counter Customer',
        customerGstin: activeCustomer?.gstin,
        warehouseId: activeWarehouseId || warehouses[0]?.id || '',
        items: cart,
        subtotal,
        discountTotal,
        taxTotal,
        cgstTotal: taxTotal / 2,
        sgstTotal: taxTotal / 2,
        igstTotal: 0,
        roundOff,
        grandTotal,
        paidAmount: grandTotal,
        paymentStatus: 'Paid',
        paymentMethod: tenderMethod,
        notes: checkoutNotes,
        terms: 'Thank you for your visit! Goods once sold can be exchanged within 7 days with bill.'
      });

      console.log(`[POS Checkout Success] Completed for invoice: ${newInvoice.invoiceNumber} (ID: ${newInvoice.id})`);

      await refreshStockBalances();
      setCart([]);
      setCashTendered('');
      setPaymentModalOpen(false);
      setCompletedInvoice(newInvoice);
      // Requirement 9: Show a clear success message such as "Invoice saved successfully" after the database confirms the save.
      setSaveSuccessMessage(`Invoice saved successfully (${newInvoice.invoiceNumber})`);
      // Requirement 2: After successful saving, open or remain on a dedicated Saved Invoice Preview screen instead of automatically navigating back to the billing page.
      setPrintModalOpen(true);
      setStockWarningMessage(null);
    } catch (err: any) {
      console.error(`[POS Checkout Error] Company: ${company.id}, Error: ${err?.message || err}`);
      // Requirement 10: If saving fails, show an error and do not display a false success message.
      const errMsg = err?.message || 'Database transaction error';
      showStockWarning(errMsg);
      setSaveSuccessMessage(null);
      setCompletedInvoice(null);
      alert(`POS Checkout failed: ${errMsg}`);
    } finally {
      isSavingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Prepared sales orders handed over by Sales Persons awaiting cashier checkout
  const handedOverSalesOrders = useMemo(() => {
    return salesInvoices.filter(
      s => (s.docType === 'sales_order' || s.docType === 'quotation') && s.paymentStatus !== 'Paid'
    );
  }, [salesInvoices]);

  const totalHeldCount = heldInvoices.length + handedOverSalesOrders.length;

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 -my-4 sm:-my-5 lg:-my-6 bg-slate-100 overflow-hidden">
      {/* Top POS Header Toolbar */}
      <div className="h-14 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500 text-white">
              <Zap className="w-4 h-4" />
            </span>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              Fast Billing / POS Counter
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Retail Showroom
            </span>
            <UserPresenceBadge size="sm" />
            {completedInvoice && (
              <button
                type="button"
                id="pos-reprint-saved-btn"
                onClick={() => setPrintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                title="View and reprint saved bill"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved Bill: #{completedInvoice.invoiceNumber}</span>
              </button>
            )}
          </div>
        </div>

        {/* Barcode scanner input */}
        <form onSubmit={handleBarcodeScan} className="flex-1 max-w-md mx-4">
          <div className="relative">
            <ScanBarcode className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Barcode Scanner Ready... (Scan or enter SKU and press Enter)"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {/* Warehouse / Store Counter Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 hidden md:inline">Counter:</span>
            <select
              value={activeWarehouseId}
              onChange={e => handleWarehouseChange(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold cursor-pointer focus:outline-none"
            >
              {warehouses.filter(w => w.isActive ?? true).map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code}){w.isDefault ? ' — Primary' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                await refreshStockBalances();
                await refreshData();
              }}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh Live Stock Balances from Database"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {/* Held invoices indicator button */}
          <button
            onClick={() => setHoldDrawerOpen(true)}
            className="relative px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 text-amber-600" />
            <span>Held Orders</span>
            {totalHeldCount > 0 && (
              <span className="w-4 h-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {totalHeldCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Product Catalog | Right Cart & Billing */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT: Product Grid & Search ================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 border-r border-slate-200">
          {/* Search & Category Filter Tabs */}
          <div className="p-3 bg-white border-b border-slate-200 space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products by name, SKU or barcode..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category horizontal scrolling tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading && products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-700">Loading Products & Live Stock...</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Fetching current catalog and warehouse balances from the database.
                </p>
              </div>
            ) : error && products.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <AlertTriangle className="w-8 h-8 text-rose-500 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-800">Unable to Load Products & Stock</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mb-3">{error}</p>
                <button
                  type="button"
                  onClick={() => refreshData()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <ShoppingBag className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No products available</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Create products in the Products Catalog or clear your search to ring up sales.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2.5 auto-rows-max">
                {filteredProducts.map(prod => {
                  const stockInWh = getWarehouseStock(activeWarehouseId, prod.id);
                  const isOutOfStock = stockInWh <= 0;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        if (isOutOfStock) {
                          showStockWarning('Out of Stock — This product cannot be billed because no stock is available.');
                          return;
                        }
                        addToCart(prod);
                      }}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between group select-none overflow-hidden ${
                        isOutOfStock
                          ? 'bg-slate-50/80 border-slate-200 opacity-65 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm cursor-pointer active:scale-[0.98]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400 truncate uppercase flex-1 min-w-0">
                            {prod.sku}
                          </span>
                          <StockStatusBadge
                            status={
                              isOutOfStock
                                ? 'Out of Stock'
                                : prod.reorderLevel !== null && prod.reorderLevel !== undefined && stockInWh <= prod.reorderLevel
                                ? 'Limited'
                                : 'In Stock'
                            }
                            currentStock={stockInWh}
                            unit={prod.primaryUnit}
                            size="sm"
                            align="right"
                            className="shrink-0"
                          />
                        </div>
                        <h4 className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 mt-1">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                            {formatCurrency(prod.sellingPrice)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium truncate leading-tight mt-0.5">
                            /{prod.primaryUnit}
                          </div>
                        </div>
                        {isOutOfStock ? (
                          <span className="shrink-0 px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="shrink-0 p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT: Active Cart, Customer & Checkout ================= */}
        <div className="w-96 lg:w-[420px] bg-white flex flex-col shrink-0 shadow-lg z-10">
          {/* Customer Selection Bar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer truncate"
              >
                <option value="">-- Counter / Walk-in Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-semibold shrink-0">
              Bal: {formatCurrency(activeCustomer?.currentOutstanding || 0)}
            </span>
          </div>

          {/* Stock Warning Banner */}
          {stockWarningMessage && (
            <div className="mx-3 mt-3 p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-rose-800 text-xs font-semibold shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{stockWarningMessage}</span>
              </div>
              <button
                onClick={() => setStockWarningMessage(null)}
                className="p-1 hover:bg-rose-100 rounded text-rose-500"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <ShoppingBag className="w-12 h-12 text-slate-300 stroke-1 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Billing Cart is Empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Scan a barcode or tap products from the left to start billing.
                </p>
              </div>
            ) : (
              cart.map(item => {
                const itemStock = getWarehouseStock(activeWarehouseId, item.productId);
                const isOutOfStock = itemStock <= 0;
                const isInsufficient = item.qty > itemStock;

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                      isOutOfStock
                        ? 'bg-rose-50/80 border-rose-200'
                        : isInsufficient
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className="font-semibold text-xs text-slate-900 truncate">
                        {item.productName}
                      </h5>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>{formatCurrency(item.rate)}</span>
                        <span>•</span>
                        <span>GST {item.taxRate}%</span>
                      </div>
                      {isOutOfStock ? (
                        <div className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>Out of Stock — This product cannot be billed because no stock is available.</span>
                        </div>
                      ) : isInsufficient ? (
                        <div className="text-[10px] text-amber-800 font-bold mt-1 flex items-center flex-wrap gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Insufficient stock. Available: {itemStock} {item.unit}.</span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, itemStock)}
                            className="ml-1 px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-[9px] font-extrabold cursor-pointer"
                          >
                            Set to {itemStock}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Directly editable quantity control */}
                    <POSQuantitySelector
                      item={item}
                      itemStock={itemStock}
                      isOutOfStock={isOutOfStock}
                      isInsufficient={isInsufficient}
                      decimalAllowed={isDecimalUnitAllowed(item.unit)}
                      onUpdateQty={(delta) => updateQty(item.id, delta)}
                      onSetQty={(newVal) => updateCartItemQuantity(item.id, newVal)}
                    />

                    <div className="text-right shrink-0 w-20">
                      <span className="font-bold text-xs text-slate-900 block">
                        {formatCurrency(item.total)}
                      </span>
                      <button
                        onClick={() => removeCartItem(item.id)}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Bottom Summary & Checkout Tender */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3 shrink-0">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST Tax (CGST+SGST):</span>
                <span className="font-medium text-slate-800">{formatCurrency(taxTotal)}</span>
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Round off:</span>
                  <span>{roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-t border-slate-200 text-base font-black text-slate-900">
                <span>TOTAL:</span>
                <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="py-2 px-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                Clear Cart
              </button>
              <button
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="py-2 px-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-semibold text-amber-800 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Pause className="w-3.5 h-3.5" /> Hold
              </button>
              <button
                onClick={() => {
                  for (const item of cart) {
                    const available = getWarehouseStock(selectedWarehouseId, item.productId);
                    if (available <= 0) {
                      showStockWarning('Out of Stock — This product cannot be billed because no stock is available.');
                      alert('Out of Stock — This product cannot be billed because no stock is available.');
                      return;
                    }
                    if (item.qty > available) {
                      const msg = `Insufficient stock. Available: ${available} ${item.unit}.`;
                      showStockWarning(msg);
                      alert(msg);
                      return;
                    }
                  }
                  setCashTendered(String(grandTotal));
                  setPaymentModalOpen(true);
                }}
                disabled={cart.length === 0}
                className="col-span-1 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm disabled:opacity-40"
              >
                <span>Pay (F4)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PAYMENT TENDER MODAL ================= */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tender Payment & Settle</h3>
                <p className="text-xs text-slate-500">Total Due: {formatCurrency(grandTotal)}</p>
              </div>
              <ModalCloseButton onClose={() => setPaymentModalOpen(false)} autoHandleEscape={true} />
            </div>

            <div className="p-6 space-y-4">
              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTenderMethod(mode)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        tenderMethod === mode
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {mode === 'Cash' && <DollarSign className="w-5 h-5 text-emerald-600" />}
                      {mode === 'UPI' && <QrCode className="w-5 h-5 text-indigo-600" />}
                      {mode === 'Card' && <CreditCard className="w-5 h-5 text-blue-600" />}
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Change Calculator */}
              {tenderMethod === 'Cash' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Cash Received from Customer:</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cashTendered}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { setCashTendered(''); return; }
                        if (raw.includes('-')) return;
                        setCashTendered(raw.replace(/^0+(?=\d)/, ''));
                      }}
                      placeholder={String(grandTotal)}
                      className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-emerald-700"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Change to Return:</span>
                    <span
                      className={`font-black text-sm ${
                        (Number(cashTendered) || 0) >= grandTotal ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(Math.max(0, (Number(cashTendered) || 0) - grandTotal))}
                    </span>
                  </div>
                </div>
              )}

              {/* UPI Instant QR Code preview */}
              {tenderMethod === 'UPI' && (
                <div className="text-center p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
                  <BarcodeCanvas
                    value={`upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.name)}&am=${grandTotal}&cu=INR`}
                    type="QR Code"
                    height={100}
                    showText={false}
                  />
                  <p className="text-xs font-semibold text-slate-700">
                    Ask customer to scan with PhonePe / GPay / Paytm
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">UPI ID: {company.upiId}</p>
                </div>
              )}

              {/* Confirm & Print Receipt Button */}
              <button
                type="button"
                id="pos-confirm-print-btn"
                disabled={isSubmitting}
                onClick={handleCheckout}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Settlement & Saving...</span>
                  </>
                ) : completedInvoice ? (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Print Bill ({completedInvoice.invoiceNumber})</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Complete Settlement & Print Thermal Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HELD INVOICES DRAWER ================= */}
      {holdDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setHoldDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-80 bg-white shadow-2xl p-4 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900">Held Customer Invoices</h3>
                <ModalCloseButton onClose={() => setHoldDrawerOpen(false)} autoHandleEscape={true} />
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {totalHeldCount === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">No held orders found.</p>
                ) : (
                  <>
                    {/* In-memory held POS carts */}
                    {heldInvoices.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                          Held Counter Carts ({heldInvoices.length})
                        </span>
                        {heldInvoices.map(h => (
                          <div
                            key={h.id}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-xs text-slate-800">{h.customerName}</span>
                              <span className="text-[10px] text-slate-400">{h.heldAt}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>{h.items.length} items</span>
                              <span className="font-bold text-slate-900">{formatCurrency(h.grandTotal)}</span>
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-slate-200">
                              <button
                                onClick={() => handleResumeCart(h.id)}
                                className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" /> Resume Cart
                              </button>
                              <button
                                onClick={() => removeHeldInvoice(h.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sales Orders Handed Over by Sales Person */}
                    {handedOverSalesOrders.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block px-1">
                          Sales Person Handover Orders ({handedOverSalesOrders.length})
                        </span>
                        {handedOverSalesOrders.map(order => (
                          <div
                            key={order.id}
                            className="p-3 rounded-lg border border-blue-200 bg-blue-50/70 space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-xs text-slate-900 block">{order.customerName}</span>
                                <span className="text-[10px] font-mono text-blue-600 font-semibold">{order.invoiceNumber}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{formatDate(order.date)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>{order.items?.length || 0} items</span>
                              <span className="font-bold text-slate-900 font-mono">{formatCurrency(order.grandTotal)}</span>
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-blue-200/80">
                              <button
                                onClick={() => handleResumeCart(order.id)}
                                className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Play className="w-3 h-3" /> Load Order &amp; Bill
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMPLETED INVOICE PRINT MODAL ================= */}
      <InvoicePrintModal
        invoice={completedInvoice}
        isOpen={printModalOpen}
        defaultFormat="Thermal"
        showSuccessBanner={true}
        preventBackdropClose={true}
        closeButtonLabel="Close / Back to Billing"
        onClose={() => {
          setPrintModalOpen(false);
          // Return to billing page without navigating away
          setCompletedInvoice(null);
          setSaveSuccessMessage(null);
        }}
      />
    </div>
  );
};
