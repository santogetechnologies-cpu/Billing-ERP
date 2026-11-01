import React, { useState, useMemo } from 'react';
import {
  Truck,
  Store,
  Home,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  DollarSign,
  QrCode,
  Tag,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  ChevronRight,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Product, Customer, SalesInvoice, InvoiceItem } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { Tabs, TabItem } from '../../components/common/Tabs';

export const SalespersonHubPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    products,
    customers,
    salesInvoices,
    createSalesInvoice,
    updateDeliveryStatus,
    company
  } = useERP();

  const [activeTab, setActiveTab] = useState<'route_sales' | 'assigned_deliveries'>('route_sales');

  // =========================================================================
  // TAB 1: ROUTE SUPPLY TO NEARBY SMALL SHOPS (RATE A, B, C, D + 0-100% DISCOUNT)
  // =========================================================================
  const [selectedShopId, setSelectedShopId] = useState<string>(customers[0]?.id || '');
  const [selectedTier, setSelectedTier] = useState<'Rate A' | 'Rate B' | 'Rate C' | 'Rate D'>('Rate B');
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [routeSearch, setRouteSearch] = useState('');
  const [routeCart, setRouteCart] = useState<{ product: Product; qty: number; unitRate: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [isBilled, setIsBilled] = useState<SalesInvoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeShop = customers.find(c => c.id === selectedShopId) || customers[0];

  const getTierPrice = (p: Product, tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D') => {
    if (tier === 'Rate B' && p.rateB && p.rateB > 0) return p.rateB;
    if (tier === 'Rate C' && p.rateC && p.rateC > 0) return p.rateC;
    if (tier === 'Rate D' && p.rateD && p.rateD > 0) return p.rateD;
    if (p.rateA && p.rateA > 0) return p.rateA;
    return p.salePrice ?? p.sellingPrice;
  };

  const filteredRouteProducts = useMemo(() => {
    const q = routeSearch.toLowerCase().trim();
    if (!q) return products.slice(0, 40);
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, routeSearch]);

  const handleAddRouteItem = (prod: Product) => {
    const rate = getTierPrice(prod, selectedTier);
    setRouteCart(prev => {
      const existing = prev.find(i => i.product.id === prod.id);
      if (existing) {
        return prev.map(i => i.product.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product: prod, qty: 1, unitRate: rate }];
    });
  };

  const handleUpdateRouteQty = (prodId: string, delta: number) => {
    setRouteCart(prev =>
      prev
        .map(i => (i.product.id === prodId ? { ...i, qty: i.qty + delta } : i))
        .filter(i => i.qty > 0)
    );
  };

  const handleSwitchTier = (tier: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D') => {
    setSelectedTier(tier);
    setRouteCart(prev =>
      prev.map(i => ({
        ...i,
        unitRate: getTierPrice(i.product, tier)
      }))
    );
  };

  const routeSubtotal = useMemo(() => {
    return routeCart.reduce((sum, i) => sum + i.qty * i.unitRate, 0);
  }, [routeCart]);

  const routeDiscountAmount = useMemo(() => {
    return (routeSubtotal * discountPct) / 100;
  }, [routeSubtotal, discountPct]);

  const routeTax = Math.round((routeSubtotal - routeDiscountAmount) * 0.05);
  const routeGrandTotal = Math.max(0, Math.round(routeSubtotal - routeDiscountAmount + routeTax));

  const handleCommitRouteSale = async (sendWhatsApp: boolean) => {
    if (routeCart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const invoicePrefix = company.invoicePrefix || 'INV-';
      const invoiceNumber = `${invoicePrefix}${Date.now().toString().slice(-6)}`;

      const items: InvoiceItem[] = routeCart.map((i, idx) => {
        const lineTotal = i.qty * i.unitRate;
        const lineTax = lineTotal * 0.05;
        return {
          id: `route-${Date.now()}-${idx}`,
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          barcode: i.product.barcode || '',
          hsn: i.product.hsn || '9999',
          qty: i.qty,
          unit: i.product.primaryUnit || 'PCS',
          rate: i.unitRate,
          discountPct: discountPct,
          discountAmt: (lineTotal * discountPct) / 100,
          taxRate: 5,
          taxAmt: lineTax,
          cgstAmt: lineTax / 2,
          sgstAmt: lineTax / 2,
          igstAmt: 0,
          total: Math.round(lineTotal - (lineTotal * discountPct) / 100 + lineTax),
          costPrice: i.product.purchasePrice || 0
        };
      });

      const inv = await createSalesInvoice({
        invoiceNumber,
        docType: 'tax_invoice',
        orderSource: 'salesperson_route',
        deliveryType: 'store_supply',
        deliveryAddress: activeShop?.address || '',
        priceTierApplied: selectedTier,
        assignedDeliveryPersonId: profile?.id || 'salesperson-1',
        assignedDeliveryPersonName: profile?.fullName || profile?.full_name || 'Route Salesperson',
        deliveryStatus: 'delivered',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerId: activeShop?.id || 'walk-in',
        customerName: activeShop?.name || 'Local Retail Shop',
        customerPhone: activeShop?.phone || '',
        customerAddress: activeShop?.address || '',
        warehouseId: company.defaultWarehouseId || 'main',
        items,
        subtotal: routeSubtotal,
        discountTotal: routeDiscountAmount,
        taxTotal: routeTax,
        cgstTotal: routeTax / 2,
        sgstTotal: routeTax / 2,
        igstTotal: 0,
        roundOff: 0,
        grandTotal: routeGrandTotal,
        paidAmount: paymentMethod === 'Credit' ? 0 : routeGrandTotal,
        paymentStatus: paymentMethod === 'Credit' ? 'Unpaid' : 'Paid',
        paymentMethod,
        notes: `Route Wholesale Supply (${selectedTier} - ${discountPct}% Discount)`
      });

      setIsBilled(inv);
      setRouteCart([]);
      setDiscountPct(0);

      if (sendWhatsApp && activeShop?.phone) {
        const cleanPhone = activeShop.phone.replace(/[^0-9]/g, '');
        const text = encodeURIComponent(
          `*${company.name || 'Store'}* - Wholesale Invoice #${inv.invoiceNumber}\n` +
          `Delivered to: ${inv.customerName}\n` +
          `Rate Tier: ${selectedTier}\n` +
          `Items: ${inv.items.length} products\n` +
          `Discount: ${discountPct}%\n` +
          `*Net Payable: ${formatCurrency(inv.grandTotal)}* (${paymentMethod})\n` +
          `Stock verified & received.`
        );
        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // TAB 2: ASSIGNED CUSTOMER HOME DELIVERIES (CALL & WHATSAPP ORDERS)
  // =========================================================================
  const assignedOrders = useMemo(() => {
    return salesInvoices.filter(inv => {
      if (inv.deliveryType === 'home_delivery' || inv.orderSource === 'call' || inv.orderSource === 'whatsapp') {
        return true;
      }
      return Boolean(inv.assignedDeliveryPersonId);
    });
  }, [salesInvoices]);

  const handleUpdateStatus = async (invoiceId: string, nextStatus: NonNullable<SalesInvoice['deliveryStatus']>) => {
    await updateDeliveryStatus(invoiceId, nextStatus || 'pending');
  };

  const handleOpenWhatsAppDelivery = (inv: SalesInvoice) => {
    if (!inv.customerPhone) return;
    const cleanPhone = inv.customerPhone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${inv.customerName},\n` +
      `Your order #${inv.invoiceNumber} from *${company.name || 'Our Store'}* is on its way to your address: ${inv.customerAddress || 'your location'}.\n` +
      `Bill Amount: ${formatCurrency(inv.grandTotal)} (${inv.paymentStatus === 'Paid' ? 'Already Paid' : 'Cash on Delivery'}).`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Salesperson & Delivery Portal
              </h2>
              <p className="text-xs text-slate-500">
                Logged in: <span className="font-semibold text-slate-700 dark:text-slate-300">{profile?.fullName || profile?.full_name || 'Sales Staff'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('route_sales')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'route_sales'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>1. Supply Nearby Small Shops</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assigned_deliveries')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'assigned_deliveries'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>2. Home Deliveries</span>
            {assignedOrders.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {assignedOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'route_sales' ? (
        /* ========================================================================= */
        /* SCENARIO A: ROUTE SALES TO SMALL SHOPS (MULTI-RATE A/B/C/D + DISCOUNT)    */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Product Picker & Tier Selector */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-4 space-y-4">
            {/* Shop & Tier Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Destination Shop / Counter
                </label>
                <select
                  value={selectedShopId}
                  onChange={e => setSelectedShopId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.address ? `- ${c.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Active Price Tier (Configured by Manager)
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['Rate A', 'Rate B', 'Rate C', 'Rate D'] as const).map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => handleSwitchTier(tier)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedTier === tier
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={routeSearch}
                onChange={e => setRouteSearch(e.target.value)}
                placeholder="Search products for shop delivery..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto p-1">
              {filteredRouteProducts.map(p => {
                const price = getTierPrice(p, selectedTier);
                const inCart = routeCart.find(i => i.product.id === p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddRouteItem(p)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                      inCart
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 bg-white dark:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                        {p.category}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Stock: {formatNumber(p.currentStock)} {p.primaryUnit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Bill Summary, Discount & Dispatch */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Shop Delivery Basket
                </h3>
                <span className="text-xs font-bold text-blue-600">{selectedTier}</span>
              </div>

              {/* Items List */}
              <div className="space-y-2 mt-3 max-h-56 overflow-y-auto">
                {routeCart.length === 0 ? (
                  <p className="text-xs text-center py-8 text-slate-400">
                    Tap items on the left to add to shop invoice
                  </p>
                ) : (
                  routeCart.map(item => (
                    <div
                      key={item.product.id}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{item.product.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {formatCurrency(item.unitRate)} × {item.qty} {item.product.primaryUnit}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateRouteQty(item.product.id, -1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 text-slate-600 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold font-mono">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateRouteQty(item.product.id, 1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 text-slate-600 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                        <span className="w-16 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.qty * item.unitRate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Discount Slider & Inputs (Requirement 5: Up to 100% Discount) */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Special Discount ({discountPct}%)
                  </span>
                  <span className="text-[11px] text-emerald-600 font-bold font-mono">
                    - {formatCurrency(routeDiscountAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={discountPct}
                  onChange={e => setDiscountPct(parseInt(e.target.value) || 0)}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  {[0, 10, 25, 50, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPct(pct)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${
                        discountPct === pct
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Cash', 'UPI', 'Credit'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === m
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Net Payable:</span>
                <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(routeGrandTotal)}
                </span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={routeCart.length === 0 || isSubmitting}
                  onClick={() => handleCommitRouteSale(false)}
                  className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deliver & Bill</span>
                </button>

                <button
                  type="button"
                  disabled={routeCart.length === 0 || isSubmitting}
                  onClick={() => handleCommitRouteSale(true)}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  title="Deliver, Bill and send invoice on Shop WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Bill & WhatsApp</span>
                </button>
              </div>

              {isBilled && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                  ✓ Invoice #{isBilled.invoiceNumber} delivered & recorded in store ledger!
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* SCENARIO B: ASSIGNED CUSTOMER HOME DELIVERIES (CALL & WHATSAPP ORDERS)    */
        /* ========================================================================= */
        <div className="space-y-3">
          {assignedOrders.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto stroke-[1.5]" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                All Deliveries Complete!
              </h3>
              <p className="text-xs text-slate-400">
                No pending home delivery orders assigned to you right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {assignedOrders.map(order => {
                const isDelivered = order.deliveryStatus === 'delivered';
                const isOut = order.deliveryStatus === 'out_for_delivery';

                return (
                  <div
                    key={order.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          {order.invoiceNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDelivered
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : isOut
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                        }`}>
                          {order.deliveryStatus || 'Pending'}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {order.customerName}
                      </h4>

                      <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {order.customerAddress || 'Customer Address on Record'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">{order.items?.length || 0} items</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(order.grandTotal)} ({order.paymentStatus})
                        </span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="flex-1 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            <span>Call</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppDelivery(order)}
                          className="flex-1 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      </div>

                      {!isDelivered ? (
                        <div className="flex items-center gap-2">
                          {!isOut && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Start Delivery</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Collect & Delivered</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Delivered & Closed</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
