import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  MessageSquare,
  Phone,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  Store,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Send
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Product, InvoiceItem } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export const CustomerPortalPage: React.FC = () => {
  const { products, company, createInboundOrder } = useERP();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Customer Contact Info for delivery
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderPlacedMsg, setOrderPlacedMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (!p.isActive) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [products, search, selectedCategory]);

  const handleAddToCart = (prod: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === prod.id);
      if (idx >= 0) {
        return prev.map(item => item.product.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product: prod, qty: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQty = (prodId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => (item.product.id === prodId ? { ...item, qty: item.qty + delta } : item))
        .filter(item => item.qty > 0)
    );
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product.salePrice ?? item.product.sellingPrice;
      return sum + item.qty * price;
    }, 0);
  }, [cart]);

  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Order via WhatsApp (Requirement 8)
  const handleOrderViaWhatsApp = () => {
    if (cart.length === 0) return;
    const shopNumber = (company.phone || company.whatsappBusinessNumber || '919876543210').replace(/[^0-9]/g, '');

    let text = `*New Order for ${company.name || 'Store'}*\n`;
    text += `Customer: ${customerName || 'Customer'}\n`;
    text += `Phone: ${customerPhone || 'Not provided'}\n`;
    text += `Address: ${deliveryAddress || 'Self Pickup'}\n\n`;
    text += `*Order Items:*\n`;

    cart.forEach((item, i) => {
      const price = item.product.salePrice ?? item.product.sellingPrice;
      text += `${i + 1}. ${item.product.name} × ${item.qty} ${item.product.primaryUnit} = ${formatCurrency(item.qty * price)}\n`;
    });

    text += `\n*Estimated Total: ${formatCurrency(cartSubtotal)}*\n`;
    text += `Please confirm order availability and dispatch time. Thank you!`;

    window.open(`https://wa.me/${shopNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Submit Inbound App Order
  const handlePlaceAppOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please enter your Name and Phone Number for delivery.');
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceItems: InvoiceItem[] = cart.map((item, idx) => {
        const price = item.product.salePrice ?? item.product.sellingPrice;
        return {
          id: `item-${Date.now()}-${idx}`,
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode || '',
          hsn: item.product.hsn || '9999',
          qty: item.qty,
          unit: item.product.primaryUnit,
          rate: price,
          discountPct: 0,
          discountAmt: 0,
          taxRate: 5,
          taxAmt: (item.qty * price) * 0.05,
          cgstAmt: (item.qty * price) * 0.025,
          sgstAmt: (item.qty * price) * 0.025,
          igstAmt: 0,
          total: Math.round(item.qty * price * 1.05),
          costPrice: item.product.purchasePrice || 0
        };
      });

      const order = await createInboundOrder({
                customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim() || 'Store Pickup',
        channel: 'Customer Portal',
        items: invoiceItems,
        subtotal: cartSubtotal,
        taxTotal: Math.round(cartSubtotal * 0.05),
        grandTotal: Math.round(cartSubtotal * 1.05),
        status: 'Pending Confirmation',
        paymentStatus: 'Pending',
        notes: 'Placed via Online Customer Portal'
      });

      setOrderPlacedMsg(`Order #${order.orderNumber} placed successfully! The store manager will confirm and assign for delivery.`);
      setCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Customer Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-3xl shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                <Store className="w-5 h-5 text-amber-300" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">{company.name || 'Store Catalog'}</h1>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              Browse products, view prices, and order easily via WhatsApp, Phone Call, or Online Delivery.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-300" />
                <span>Call Store: {company.phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="pt-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or category..."
              className="w-full pl-9 pr-4 py-2.5 bg-white text-slate-900 rounded-2xl text-xs sm:text-sm font-medium shadow-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {orderPlacedMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{orderPlacedMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderPlacedMsg(null)}
            className="text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Grid: Products + Cart Drawer */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Products */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {filteredProducts.map(prod => {
            const price = prod.salePrice ?? prod.sellingPrice;
            const inCart = cart.find(i => i.product.id === prod.id);

            return (
              <div
                key={prod.id}
                className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3 hover:border-blue-300 transition-all"
              >
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    {prod.category}
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                    {prod.name}
                  </h3>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400">
                      {formatCurrency(price)}
                    </span>
                    {prod.mrp > price && (
                      <span className="text-[11px] text-slate-400 line-through">
                        {formatCurrency(prod.mrp)}
                      </span>
                    )}
                  </div>

                  {inCart ? (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(prod.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs font-mono text-blue-700 dark:text-blue-300">
                        {inCart.qty} {prod.primaryUnit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(prod.id, 1)}
                        className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(prod)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Basket</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Cart / Checkout Column */}
        {cart.length > 0 && (
          <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md p-4 space-y-4 shrink-0 sticky top-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Your Order ({cartTotalItems} items)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-slate-400 hover:text-rose-600 text-xs cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Cart Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map(item => {
                const price = item.product.salePrice ?? item.product.sellingPrice;
                return (
                  <div key={item.product.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.product.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {item.qty} × {formatCurrency(price)}
                      </p>
                    </div>
                    <span className="font-bold font-mono text-slate-900 dark:text-white shrink-0 ml-2">
                      {formatCurrency(item.qty * price)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Subtotal */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Order Subtotal:</span>
              <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                {formatCurrency(cartSubtotal)}
              </span>
            </div>

            {/* Delivery Inputs */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                placeholder="Your Name"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
              <input
                type="tel"
                placeholder="Phone Number (for delivery)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
              <textarea
                rows={2}
                placeholder="Delivery Address / House Details"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            {/* Order Action Buttons: WhatsApp vs App Order */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleOrderViaWhatsApp}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Order via WhatsApp</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePlaceAppOrder}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Submit Online App Order</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
