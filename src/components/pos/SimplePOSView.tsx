import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Check,
  Printer,
  CreditCard,
  QrCode,
  DollarSign,
  MessageSquare,
  Sparkles,
  ShoppingBag,
  Zap,
  Tag,
  Phone,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Product, InvoiceItem, Customer, SalesInvoice } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface SimplePOSViewProps {
  products: Product[];
  customers: Customer[];
  companyName: string;
  companyPhone?: string;
  selectedCustomerId: string;
  onSelectCustomerId: (id: string) => void;
  onCheckout: (params: {
    cart: InvoiceItem[];
    paymentMethod: 'Cash' | 'UPI' | 'Credit' | 'Card';
    discountPct: number;
    tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D';
    sendWhatsApp: boolean;
  }) => Promise<SalesInvoice | void>;
  onSwitchToAdvanced: () => void;
}

export const SimplePOSView: React.FC<SimplePOSViewProps> = ({
  products,
  customers,
  companyName,
  companyPhone,
  selectedCustomerId,
  onSelectCustomerId,
  onCheckout,
  onSwitchToAdvanced
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<{ product: Product; qty: number; unitRate: number }[]>([]);
  const [selectedTier, setSelectedTier] = useState<'Rate A' | 'Rate B' | 'Rate C' | 'Rate D'>('Rate A');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBilledInvoice, setLastBilledInvoice] = useState<SalesInvoice | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Compute price based on active Rate Tier
  const getProductPrice = (prod: Product, tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D') => {
    if (tier === 'Rate B' && prod.rateB && prod.rateB > 0) return prod.rateB;
    if (tier === 'Rate C' && prod.rateC && prod.rateC > 0) return prod.rateC;
    if (tier === 'Rate D' && prod.rateD && prod.rateD > 0) return prod.rateD;
    if (prod.rateA && prod.rateA > 0) return prod.rateA;
    return prod.salePrice ?? prod.sellingPrice;
  };

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (!p.isActive) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.manufacturerBarcode && p.manufacturerBarcode.toLowerCase().includes(q))
      );
    });
  }, [products, search, selectedCategory]);

  // Add product to cart (or increment if already added)
  const handleAddToCart = (prod: Product) => {
    const rate = getProductPrice(prod, selectedTier);
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [{ product: prod, qty: 1, unitRate: rate }, ...prev];
    });
  };

  const handleUpdateQty = (prodId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === prodId) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: Product; qty: number; unitRate: number }[];
    });
  };

  const handleRemoveItem = (prodId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== prodId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Switch Rate Tier and re-evaluate prices in cart
  const handleSwitchTier = (tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D') => {
    setSelectedTier(tier);
    setCart(prev =>
      prev.map(item => ({
        ...item,
        unitRate: getProductPrice(item.product, tier)
      }))
    );
  };

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty * item.unitRate, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPct) / 100;
  }, [subtotal, discountPct]);

  const taxTotal = useMemo(() => {
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    // Standard effective GST estimation (average 18% or product weighted)
    return Math.round(taxableSubtotal * 0.05); // 5% average standard retail slab
  }, [subtotal, discountAmount]);

  const grandTotal = Math.max(0, Math.round(subtotal - discountAmount + taxTotal));

  // Customer selected
  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  // Quick 1-Click Checkout Handler
  const handlePay = async (method: 'Cash' | 'UPI' | 'Credit', sendWhatsApp: boolean = false) => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    try {
      const invoiceItems: InvoiceItem[] = cart.map((item, idx) => {
        const itemTotal = item.qty * item.unitRate;
        const discRatio = subtotal > 0 ? discountAmount / subtotal : 0;
        const itemDisc = itemTotal * discRatio;
        const lineTax = (itemTotal - itemDisc) * 0.05;

        return {
          id: `item-${Date.now()}-${idx}`,
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku || item.product.code,
          barcode: item.product.barcode || item.product.manufacturerBarcode || '',
          hsn: item.product.hsn || '9999',
          qty: item.qty,
          unit: item.product.primaryUnit || 'PCS',
          rate: item.unitRate,
          discountPct: discountPct,
          discountAmt: itemDisc,
          taxRate: 5,
          taxAmt: lineTax,
          cgstAmt: lineTax / 2,
          sgstAmt: lineTax / 2,
          igstAmt: 0,
          total: Math.round(itemTotal - itemDisc + lineTax),
          costPrice: item.product.purchasePrice || 0
        };
      });

      const inv = await onCheckout({
        cart: invoiceItems,
        paymentMethod: method,
        discountPct,
        tier: selectedTier,
        sendWhatsApp
      });

      if (inv) {
        setLastBilledInvoice(inv);
        setCart([]);
        setDiscountPct(0);

        if (sendWhatsApp && activeCustomer?.phone) {
          const cleanPhone = activeCustomer.phone.replace(/[^0-9]/g, '');
          const waText = encodeURIComponent(
            `*${companyName}* - Invoice #${inv.invoiceNumber}\n` +
            `Date: ${inv.date}\n` +
            `Items: ${inv.items.length} items\n` +
            `*Grand Total: ${formatCurrency(inv.grandTotal)}* (Paid via ${method})\n` +
            `Thank you for shopping with us!`
          );
          window.open(`https://wa.me/${cleanPhone}?text=${waText}`, '_blank');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] animate-fadeIn">
      {/* LEFT: TOUCH PRODUCT CATALOG & SEARCH */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {/* Top Control Bar: Search & Tier Selector */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tap to search by item name, SKU, or scan barcode..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onSwitchToAdvanced}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
              title="Switch to detailed batch & serial grid"
            >
              Advanced Mode
            </button>
          </div>

          {/* Pricing Tier Selector (Requirement 5) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Rate Tier:</span>
              {(['Rate A', 'Rate B', 'Rate C', 'Rate D'] as const).map(tier => {
                const isSelected = selectedTier === tier;
                const labels = {
                  'Rate A': 'Rate A (Retail)',
                  'Rate B': 'Rate B (Wholesale)',
                  'Rate C': 'Rate C (Dealer)',
                  'Rate D': 'Rate D (Bulk/Dist.)'
                };
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => handleSwitchTier(tier)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {labels[tier]}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline shrink-0">
              {filteredProducts.length} items
            </span>
          </div>

          {/* Category Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Touch Grid: 1-Tap Add */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-10 h-10 stroke-1 mb-2" />
              <p className="text-sm font-semibold">No products found</p>
              <p className="text-xs mt-1">Try another keyword or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {filteredProducts.map(prod => {
                const price = getProductPrice(prod, selectedTier);
                const inCartItem = cart.find(item => item.product.id === prod.id);

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddToCart(prod)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none active:scale-97 relative ${
                      inCartItem
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-slate-700 shadow-2xs'
                    }`}
                  >
                    {inCartItem && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                        {inCartItem.qty}
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                        {prod.category}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5 leading-snug">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                        {formatCurrency(price)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        prod.currentStock <= 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {formatNumber(prod.currentStock)} {prod.primaryUnit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: BILL BASKET & 1-CLICK TENDER (CASH / UPI / KHATA) */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {/* Customer Select Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
            <select
              value={selectedCustomerId}
              onChange={e => onSelectCustomerId(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer focus:outline-none"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id} className="dark:bg-slate-900">
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Clear bill basket"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Zap className="w-8 h-8 text-amber-500 mb-2 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Bill Ready</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tap any product on the left to add to bill immediately
              </p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.product.name}
                  </h5>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span className="font-mono">{formatCurrency(item.unitRate)}</span>
                    <span>×</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.qty} {item.product.primaryUnit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.product.id, -1)}
                      className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 rounded cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold font-mono">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.product.id, 1)}
                      className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 rounded cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="w-16 text-right font-bold text-xs font-mono text-slate-900 dark:text-white">
                    {formatCurrency(item.qty * item.unitRate)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.product.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Discount, Totals & 1-Click Tender */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          {/* Quick Discount Selector (0% - 100%) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-500">Discount: {discountPct}%</span>
              {discountAmount > 0 && (
                <span className="font-mono text-emerald-600 font-bold">
                  - {formatCurrency(discountAmount)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[0, 5, 10, 20, 50, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountPct(pct)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    discountPct === pct
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Grand Total Display */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount</span>
              <span className="text-[11px] text-slate-500">{cart.length} line items (incl. GST)</span>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(grandTotal)}
            </div>
          </div>

          {/* 1-Click Tender Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handlePay('Cash', false)}
              className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-97 cursor-pointer"
            >
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
              <span>CASH (Exact)</span>
            </button>

            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handlePay('UPI', false)}
              className="py-3 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition-all active:scale-97 cursor-pointer"
            >
              <QrCode className="w-4 h-4 stroke-[2.5]" />
              <span>UPI / QR</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handlePay('Credit', false)}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Khata / Credit</span>
            </button>

            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handlePay('Cash', true)}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Bill & Share on customer WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Pay & WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

