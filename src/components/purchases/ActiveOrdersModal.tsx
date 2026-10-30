import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  CheckCircle2,
  Calendar,
  Building2,
  Package,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Search,
  Warehouse as WarehouseIcon,
  AlertCircle
} from 'lucide-react';
import { formatNumber, formatDate } from '../../utils/formatters';
import { Supplier, Warehouse, Product, PurchaseRequest } from '../../types';

export interface DetailedOrderItem {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  outstandingQty: number;
  rate?: number;
}

export interface DetailedPurchaseOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string;
  isOverdue: boolean;
  supplierId: string;
  supplierName: string;
  supplierContact: string;
  supplierEmail?: string;
  supplierGstin?: string;
  warehouseId: string;
  warehouseName: string;
  status: 'Active' | 'Delivered';
  totalOrderedQty: number;
  totalReceivedQty: number;
  totalOutstandingQty: number;
  items: DetailedOrderItem[];
}

export interface SupplierOrderGroup {
  supplierId: string;
  supplierName: string;
  contact: string;
  email?: string;
  gstin?: string;
  activeOrdersCount: number;
  deliveredOrdersCount: number;
  totalOutstandingQty: number;
  orders: DetailedPurchaseOrder[];
}

interface ActiveOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrders: any[];
  purchaseRequests: PurchaseRequest[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products?: Product[];
  initialFilter?: 'Active' | 'Delivered';
}

export const ActiveOrdersModal: React.FC<ActiveOrdersModalProps> = ({
  isOpen,
  onClose,
  purchaseOrders,
  purchaseRequests,
  suppliers,
  warehouses,
  initialFilter = 'Active'
}) => {
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Delivered'>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Reset filter when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatusFilter(initialFilter);
      setSearchQuery('');
      setExpandedOrders({});
    }
  }, [isOpen, initialFilter]);

  // Support closing with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Compile and deduplicate all purchase orders from database & linked purchase requests
  const compiledOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const ordersMap = new Map<string, DetailedPurchaseOrder>();

    // 1. Process Database Orders (from purchase_orders or purchases)
    (purchaseOrders || []).forEach(po => {
      const orderNum = po.order_number || po.invoice_number || po.id;
      if (!orderNum) return;
      const orderKey = String(orderNum).trim().toLowerCase();
      if (ordersMap.has(orderKey)) return;

      const rawStatus = (po.status || 'Active').trim().toLowerCase();
      if (rawStatus === 'cancelled' || rawStatus === 'rejected') return;

      const matchedSupp = suppliers.find(
        s => s.id === po.supplier_id || (po.supplier_name && s.name.toLowerCase() === po.supplier_name.toLowerCase())
      );
      const supplierName = po.supplier_name || matchedSupp?.name || 'Authorized Supplier';
      const supplierContact = matchedSupp?.phone || 'Not available';
      const supplierEmail = matchedSupp?.email || undefined;
      const supplierGstin = po.supplier_gstin || matchedSupp?.gstin || undefined;
      const supplierId = po.supplier_id || matchedSupp?.id || `sup-${supplierName.toLowerCase().replace(/\s+/g, '-')}`;

      const matchedWh = warehouses.find(
        w => w.id === po.warehouse_id || (po.warehouse_name && w.name.toLowerCase() === po.warehouse_name.toLowerCase())
      );
      const warehouseName = po.warehouse_name || matchedWh?.name || po.warehouse || 'Central Distribution Godown';
      const warehouseId = po.warehouse_id || matchedWh?.id || 'wh-default';

      const expDate = po.expected_delivery || po.due_date || po.expectedDelivery;
      const cleanExpDate = expDate && typeof expDate === 'string' && expDate.trim() ? expDate.trim().split('T')[0] : 'Not available';

      const itemsRaw = po.purchase_order_items || po.items || [];
      const itemsList: DetailedOrderItem[] = [];
      let totalOrdered = 0;
      let totalReceived = 0;

      if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
        itemsRaw.forEach((it: any) => {
          const oq = Number(it.qty || it.quantity || it.orderedQty || it.requestedQty || 0);
          const rq = Number(it.receivedQty || it.received_qty || 0);
          const outstanding = Math.max(0, oq - rq);
          totalOrdered += oq;
          totalReceived += rq;
          itemsList.push({
            id: it.id,
            productId: it.product_id || it.productId || 'prod-custom',
            productName: it.product_name || it.productName || 'Order Product',
            sku: it.sku || undefined,
            unit: it.unit || 'Piece',
            orderedQty: oq,
            receivedQty: rq,
            outstandingQty: outstanding,
            rate: it.rate || it.purchase_price
          });
        });
      } else {
        const oq = Number(po.qty || 1);
        const rq = Number(po.received_qty || 0);
        totalOrdered = oq;
        totalReceived = rq;
        itemsList.push({
          productId: 'prod-default',
          productName: po.notes || 'Purchased Products',
          unit: 'Units',
          orderedQty: oq,
          receivedQty: rq,
          outstandingQty: Math.max(0, oq - rq)
        });
      }

      const totalOutstanding = Math.max(0, totalOrdered - totalReceived);
      const isDelivered = totalOutstanding === 0 && totalOrdered > 0;
      const status: 'Active' | 'Delivered' = isDelivered ? 'Delivered' : 'Active';
      const isOverdue = status === 'Active' && cleanExpDate !== 'Not available' && cleanExpDate < today && totalOutstanding > 0;

      ordersMap.set(orderKey, {
        id: po.id || `po-${orderNum}`,
        orderNumber: String(orderNum),
        orderDate: po.date || po.created_at?.split('T')[0] || today,
        expectedDeliveryDate: cleanExpDate,
        isOverdue,
        supplierId,
        supplierName,
        supplierContact,
        supplierEmail,
        supplierGstin,
        warehouseId,
        warehouseName,
        status,
        totalOrderedQty: totalOrdered,
        totalReceivedQty: totalReceived,
        totalOutstandingQty: totalOutstanding,
        items: itemsList
      });
    });

    // 2. Process Purchase Requests in active ordered or partially received states
    (purchaseRequests || []).forEach(req => {
      const orderNum = req.purchaseOrderNumber || req.purchaseOrderId;
      const statusLower = (req.status || '').toLowerCase();
      if (statusLower === 'cancelled' || statusLower === 'rejected') return;

      const orderKey = orderNum ? String(orderNum).trim().toLowerCase() : `req-${req.id}`;
      if (ordersMap.has(orderKey)) return;

      // If database purchase orders were cleared, do not synthesize ghost orders from requests
      if (!orderNum || (purchaseOrders && purchaseOrders.length === 0)) return;

      // Extract vendor name from history if not explicit
      let suppName: string | null = req.supplierName || null;
      if (!suppName && req.history) {
        for (const h of req.history) {
          if (h.comments && h.comments.includes('Vendor:')) {
            const match = h.comments.match(/Vendor:\s*([^)]+)/);
            if (match && match[1]) {
              suppName = match[1].trim();
              break;
            }
          }
        }
      }

      const matchedSupp = suppliers.find(
        s => (req.supplierId && s.id === req.supplierId) || (suppName && s.name.toLowerCase() === suppName.toLowerCase())
      );
      const supplierName = suppName || matchedSupp?.name || req.supplierName || 'Authorized Supplier';
      const supplierContact = matchedSupp?.phone || 'Not available';
      const supplierEmail = matchedSupp?.email || undefined;
      const supplierGstin = req.supplierGstin || matchedSupp?.gstin || undefined;
      const supplierId = req.supplierId || matchedSupp?.id || `sup-${supplierName.toLowerCase().replace(/\s+/g, '-')}`;

      const matchedWh = warehouses.find(w => w.id === req.warehouseId);
      const warehouseName = req.warehouseName || matchedWh?.name || 'Central Distribution Godown';
      const warehouseId = req.warehouseId || 'wh-default';

      const expDate = req.requestedDeliveryDate;
      const cleanExpDate = expDate && typeof expDate === 'string' && expDate.trim() ? expDate.trim().split('T')[0] : 'Not available';

      const itemsRaw = req.items || [];
      const itemsList: DetailedOrderItem[] = [];
      let totalOrdered = 0;
      let totalReceived = 0;

      itemsRaw.forEach(it => {
        const oq = Number(it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty || 0);
        const rq = Number(it.receivedQty || 0);
        const outstanding = Math.max(0, oq - rq);
        totalOrdered += oq;
        totalReceived += rq;
        itemsList.push({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          unit: it.unit || 'Piece',
          orderedQty: oq,
          receivedQty: rq,
          outstandingQty: outstanding,
          rate: it.estimatedCost
        });
      });

      const totalOutstanding = Math.max(0, totalOrdered - totalReceived);
      const isDelivered = (statusLower === 'completed' || statusLower === 'delivered') || (totalOutstanding === 0 && totalOrdered > 0);
      const status: 'Active' | 'Delivered' = isDelivered ? 'Delivered' : 'Active';
      const isOverdue = status === 'Active' && cleanExpDate !== 'Not available' && cleanExpDate < today && totalOutstanding > 0;

      ordersMap.set(orderKey, {
        id: req.purchaseOrderId || `po-${req.id}`,
        orderNumber: req.purchaseOrderNumber || `PO-${req.requestNumber.replace('PR-', '')}`,
        orderDate: req.createdAt ? req.createdAt.split('T')[0] : today,
        expectedDeliveryDate: cleanExpDate,
        isOverdue,
        supplierId,
        supplierName,
        supplierContact,
        supplierEmail,
        supplierGstin,
        warehouseId,
        warehouseName,
        status,
        totalOrderedQty: totalOrdered,
        totalReceivedQty: totalReceived,
        totalOutstandingQty: totalOutstanding,
        items: itemsList
      });
    });

    return Array.from(ordersMap.values());
  }, [purchaseOrders, purchaseRequests, suppliers, warehouses]);

  // Overall counts
  const totalActiveOrdersCount = useMemo(() => {
    return compiledOrders.filter(o => o.status === 'Active').length;
  }, [compiledOrders]);

  const totalDeliveredOrdersCount = useMemo(() => {
    return compiledOrders.filter(o => o.status === 'Delivered').length;
  }, [compiledOrders]);

  // Group orders by actual Supplier
  const supplierGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groupsMap = new Map<string, SupplierOrderGroup>();

    compiledOrders
      .filter(order => order.status === statusFilter)
      .forEach(order => {

      // Search filter
      if (q) {
        const matchSupplier = order.supplierName.toLowerCase().includes(q);
        const matchPo = order.orderNumber.toLowerCase().includes(q);
        const matchWh = order.warehouseName.toLowerCase().includes(q);
        const matchItems = order.items.some(i => i.productName.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)));
        if (!matchSupplier && !matchPo && !matchWh && !matchItems) {
          return;
        }
      }

      const key = order.supplierId;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          contact: order.supplierContact,
          email: order.supplierEmail,
          gstin: order.supplierGstin,
          activeOrdersCount: 0,
          deliveredOrdersCount: 0,
          totalOutstandingQty: 0,
          orders: []
        });
      }

      const group = groupsMap.get(key)!;
      group.orders.push(order);
      if (order.status === 'Active') {
        group.activeOrdersCount += 1;
        group.totalOutstandingQty += order.totalOutstandingQty;
      } else {
        group.deliveredOrdersCount += 1;
      }
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
      if (statusFilter === 'Active') {
        if (b.totalOutstandingQty !== a.totalOutstandingQty) {
          return b.totalOutstandingQty - a.totalOutstandingQty;
        }
      }
      return a.supplierName.localeCompare(b.supplierName);
    });
  }, [compiledOrders, statusFilter, searchQuery]);

  const totalFilteredOrders = useMemo(() => {
    return supplierGroups.reduce((acc, g) => acc + g.orders.length, 0);
  }, [supplierGroups]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Background Dimmed Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shadow-2xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Purchase Orders by Supplier
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200/80">
                  {statusFilter === 'Active' ? `${totalActiveOrdersCount} Active` : `${totalDeliveredOrdersCount} Delivered`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review active and delivered purchase orders grouped by vendor with fulfillment details.
              </p>
            </div>
          </div>

          {/* Red outlined X close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 transition-colors cursor-pointer shadow-2xs"
            title="Close (ESC)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Search Bar Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Status Filter Tabs (Active vs Delivered Only) */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('Active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'Active'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Active Orders</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'Active' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalActiveOrdersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Delivered')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'Delivered'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Delivered Orders</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalDeliveredOrdersCount}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search supplier, PO #, product, or warehouse..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Modal Content: Independently Scrollable Supplier-Wise Orders List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {supplierGroups.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                {statusFilter === 'Active' ? <Truck className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {searchQuery
                  ? `No orders matching "${searchQuery}"`
                  : statusFilter === 'Active'
                  ? 'No Active Purchase Orders'
                  : 'No Delivered Purchase Orders'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {statusFilter === 'Active'
                  ? 'All purchase orders have been received or no active procurement is currently outstanding with suppliers.'
                  : 'Delivered and fulfilled purchase orders will appear here once goods receipts are confirmed.'}
              </p>
            </div>
          ) : (
            supplierGroups.map(group => (
              <div
                key={group.supplierId}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
              >
                {/* Supplier Header Box */}
                <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 mt-0.5">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm">
                          {group.supplierName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          {group.orders.length} {group.orders.length === 1 ? 'Order' : 'Orders'}
                        </span>
                        {group.totalOutstandingQty > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
                            {formatNumber(group.totalOutstandingQty)} Units Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        {group.contact && group.contact !== 'Not available' && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{group.contact}</span>
                          </span>
                        )}
                        {group.email && (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{group.email}</span>
                          </span>
                        )}
                        {group.gstin && (
                          <span className="text-[10px] font-mono text-slate-400">
                            GSTIN: {group.gstin}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Purchase Orders Under This Supplier */}
                <div className="divide-y divide-slate-100">
                  {group.orders.map(order => {
                    const isExpanded = Boolean(expandedOrders[order.id]);
                    return (
                      <div key={order.id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Order Identification & Warehouse */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-blue-600 text-xs">
                                {order.orderNumber}
                              </span>
                              {/* Strict Two Order Status Badges Only: Active or Delivered */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  order.status === 'Active'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {order.status === 'Active' ? (
                                  <>
                                    <Truck className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span>Active</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Delivered</span>
                                  </>
                                )}
                              </span>

                              {order.isOverdue && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>Overdue</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-medium">
                                <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>{order.warehouseName}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>Order Date: {formatDate(order.orderDate)}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[11px] text-slate-500">
                                Expected: <strong className={order.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                  {order.expectedDeliveryDate !== 'Not available' ? formatDate(order.expectedDeliveryDate) : 'Not available'}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* Quantities & Expand Button */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                            <div className="text-right">
                              <div className="text-xs font-mono">
                                <span className="text-slate-500">Ordered: </span>
                                <strong className="text-slate-900">{formatNumber(order.totalOrderedQty)}</strong>
                                <span className="text-slate-400 mx-1">|</span>
                                <span className="text-slate-500">Recv: </span>
                                <strong className="text-emerald-600">{formatNumber(order.totalReceivedQty)}</strong>
                                <span className="text-slate-400 mx-1">|</span>
                                <span className="text-slate-500">Pending: </span>
                                <strong className={order.totalOutstandingQty > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                  {formatNumber(order.totalOutstandingQty)}
                                </strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleOrderExpand(order.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Package className="w-3.5 h-3.5 text-slate-500" />
                              <span>{order.items.length} {order.items.length === 1 ? 'Product' : 'Products'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Product Details Line Items */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/70 rounded-xl p-3 animate-in fade-in duration-150">
                            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Ordered Products ({order.items.length})
                            </h4>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <th className="py-2 px-3">Product Name</th>
                                    <th className="py-2 px-2 text-right">Ordered Qty</th>
                                    <th className="py-2 px-2 text-right">Received Qty</th>
                                    <th className="py-2 px-2 text-right">Outstanding Qty</th>
                                    <th className="py-2 px-3 text-center">Unit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {order.items.map((it, idx) => (
                                    <tr key={it.id || idx} className="hover:bg-slate-50/60">
                                      <td className="py-2 px-3 font-semibold text-slate-800">
                                        <div>
                                          <span>{it.productName}</span>
                                          {it.sku && (
                                            <span className="text-[10px] text-slate-400 font-mono block">
                                              SKU: {it.sku}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                                        {formatNumber(it.orderedQty)}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">
                                        {formatNumber(it.receivedQty)}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono font-bold">
                                        <span className={it.outstandingQty > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                          {formatNumber(it.outstandingQty)}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center text-slate-500">
                                        {it.unit}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 text-xs">
          <div className="text-slate-500">
            Showing <strong className="text-slate-800">{totalFilteredOrders}</strong> {statusFilter.toLowerCase()} purchase orders across <strong className="text-slate-800">{supplierGroups.length}</strong> suppliers
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer self-end sm:self-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
