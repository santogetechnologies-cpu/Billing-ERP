import React, { useState } from 'react';
import {
  Phone,
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  Truck,
  User,
  ShoppingBag,
  DollarSign,
  MapPin,
  ArrowRight,
  Printer
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { InboundCustomerOrder, Product, InvoiceItem, StaffMember } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../common/Modal';

export const InboundOrdersTab: React.FC = () => {
  const {
    inboundOrders,
    createInboundOrder,
    updateInboundOrderStatus,
    createSalesInvoice,
    products,
    staffMembers,
    company
  } = useERP();

  const [isTakeCallOrderOpen, setIsTakeCallOrderOpen] = useState(false);

  // New Phone Call Order Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderChannel, setOrderChannel] = useState<'Phone Call' | 'WhatsApp'>('Phone Call');
  const [orderCart, setOrderCart] = useState<{ product: Product; qty: number }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffMembers[0]?.id || '');
  const [searchProd, setSearchProd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available delivery personnel
  const deliveryStaff = staffMembers.filter(
    (s: StaffMember) => s.role.toLowerCase().includes('delivery') || s.role.toLowerCase().includes('sales')
  );

  const handleAddCallItem = (prod: Product) => {
    setOrderCart(prev => {
      const idx = prev.findIndex(i => i.product.id === prod.id);
      if (idx >= 0) {
        return prev.map(i => (i.product.id === prod.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product: prod, qty: 1 }];
    });
  };

  const handleUpdateCallQty = (prodId: string, delta: number) => {
    setOrderCart(prev =>
      prev
        .map(i => (i.product.id === prodId ? { ...i, qty: i.qty + delta } : i))
        .filter(i => i.qty > 0)
    );
  };

  const callSubtotal = orderCart.reduce((sum, item) => {
    const price = item.product.salePrice ?? item.product.sellingPrice;
    return sum + item.qty * price;
  }, 0);

  const handleCreateCallOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || orderCart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const assigned = staffMembers.find((s: StaffMember) => s.id === selectedStaffId);

      const items: InvoiceItem[] = orderCart.map((item, idx) => {
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
          taxAmt: item.qty * price * 0.05,
          cgstAmt: (item.qty * price * 0.05) / 2,
          sgstAmt: (item.qty * price * 0.05) / 2,
          igstAmt: 0,
          total: Math.round(item.qty * price * 1.05),
          costPrice: item.product.purchasePrice || 0
        };
      });

      // 1. Create Inbound Order
      const newOrder = await createInboundOrder({
                customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim() || 'Customer Address',
        channel: orderChannel,
        items,
        subtotal: callSubtotal,
        taxTotal: Math.round(callSubtotal * 0.05),
        grandTotal: Math.round(callSubtotal * 1.05),
        status: 'Assigned for Delivery',
        assignedDeliveryPersonId: assigned?.id,
        assignedDeliveryPersonName: assigned?.name,
        paymentStatus: 'Cash on Delivery',
        notes: `Taken over ${orderChannel} by Manager/Cashier`
      });

      // 2. Automatically generate Sales Invoice with Home Delivery assignment
      await createSalesInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        docType: 'tax_invoice',
        orderSource: orderChannel === 'WhatsApp' ? 'whatsapp' : 'call',
        deliveryType: 'home_delivery',
        deliveryAddress: deliveryAddress.trim(),
        assignedDeliveryPersonId: assigned?.id,
        assignedDeliveryPersonName: assigned?.name,
        deliveryStatus: 'pending',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerId: 'walk-in',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: deliveryAddress.trim(),
        warehouseId: company.defaultWarehouseId || 'main',
        items,
        subtotal: callSubtotal,
        discountTotal: 0,
        taxTotal: Math.round(callSubtotal * 0.05),
        cgstTotal: Math.round(callSubtotal * 0.025),
        sgstTotal: Math.round(callSubtotal * 0.025),
        igstTotal: 0,
        roundOff: 0,
        grandTotal: Math.round(callSubtotal * 1.05),
        paidAmount: 0,
        paymentStatus: 'Unpaid',
        paymentMethod: 'Cash',
        notes: `Call Order #${newOrder.orderNumber} assigned to ${assigned?.name || 'Delivery Staff'}`
      });

      setIsTakeCallOrderOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setOrderCart([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Banner & Take Order Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600" />
            <span>Call & WhatsApp Delivery Dispatch Queue</span>
          </h3>
          <p className="text-xs text-slate-500">
            Orders taken over phone calls or WhatsApp, automatically billed and assigned to delivery staff.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsTakeCallOrderOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Take New Call / WhatsApp Order</span>
        </button>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inboundOrders.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 space-y-2">
            <ShoppingBag className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No active inbound orders</p>
            <p className="text-[11px]">
              Tap "Take New Call Order" when a customer calls the shop to place a home delivery.
            </p>
          </div>
        ) : (
          inboundOrders.map((order: InboundCustomerOrder) => (
            <div
              key={order.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600">{order.orderNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    order.channel === 'WhatsApp'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                  }`}>
                    {order.channel}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                  {order.customerName}
                </h4>
                <p className="text-xs text-slate-500 font-mono">{order.customerPhone}</p>

                <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{order.deliveryAddress}</span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{order.items?.length || 0} items</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(order.grandTotal)}
                  </span>
                </div>

                <div className="mt-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] flex items-center justify-between">
                  <span className="text-slate-500">Assigned Delivery:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {order.assignedDeliveryPersonName || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">{formatDate(order.createdAt)}</span>
                <span className="font-bold text-blue-600">{order.status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Take Inbound Phone Order */}
      <Modal
        isOpen={isTakeCallOrderOpen}
        onClose={() => setIsTakeCallOrderOpen(false)}
        title="Take Call / WhatsApp Customer Order"
        size="2xl"
      >
        <form onSubmit={handleCreateCallOrder} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Delivery Address
            </label>
            <textarea
              rows={2}
              required
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              placeholder="Flat 402, Sunshine Apts, MG Road"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          {/* Product Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Add Products to Order
            </label>
            <input
              type="text"
              value={searchProd}
              onChange={e => setSearchProd(e.target.value)}
              placeholder="Search catalog products..."
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs mb-2"
            />
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              {products
                .filter(p => !searchProd || p.name.toLowerCase().includes(searchProd.toLowerCase()))
                .slice(0, 10)
                .map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddCallItem(prod)}
                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-left text-xs font-bold flex items-center justify-between hover:border-blue-500 cursor-pointer"
                  >
                    <span className="truncate">{prod.name}</span>
                    <span className="text-blue-600 font-mono shrink-0 ml-1">
                      {formatCurrency(prod.salePrice ?? prod.sellingPrice)}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Cart preview */}
          {orderCart.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase">Selected Items:</span>
              {orderCart.map(i => (
                <div key={i.product.id} className="flex items-center justify-between text-xs">
                  <span>{i.product.name} × {i.qty}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleUpdateCallQty(i.product.id, -1)} className="px-1 text-slate-500 font-bold">-</button>
                    <button type="button" onClick={() => handleUpdateCallQty(i.product.id, 1)} className="px-1 text-slate-500 font-bold">+</button>
                    <span className="font-mono font-bold">{formatCurrency(i.qty * (i.product.salePrice ?? i.product.sellingPrice))}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-blue-200 dark:border-blue-900 flex justify-between text-xs font-bold">
                <span>Total:</span>
                <span className="font-mono">{formatCurrency(callSubtotal)}</span>
              </div>
            </div>
          )}

          {/* Assign Delivery Person */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Assign Delivery Person (Salesperson)
            </label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              {staffMembers.map((s: StaffMember) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role}) - {s.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTakeCallOrderOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || orderCart.length === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
            >
              Generate Bill & Assign to Staff
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
