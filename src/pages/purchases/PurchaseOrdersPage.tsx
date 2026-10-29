import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Warehouse as WarehouseIcon,
  Building2,
  Calendar,
  FileText,
  PackageCheck,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Check,
  RotateCcw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canAccessRoute } from '../../utils/rbac';
import { StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { PurchaseRequest } from '../../types';
import { sortProductsAZ } from '../../utils/sortUtils';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../../utils/schemaDetector';

export interface PurchaseOrderItemRow {
  id: string;
  orderNumber: string;
  date: string;
  expectedDelivery: string | null;
  supplierId: string | null;
  supplierName: string;
  supplierContact: string;
  supplierEmail?: string;
  supplierGstin?: string;
  warehouseId: string | null;
  warehouseName: string;
  status: 'Active' | 'Delivered' | 'Cancelled';
  grandTotal: number;
  totalQty: number;
  receivedQty: number;
  pendingQty: number;
  isOverdue: boolean;
  notes?: string;
  linkedRequestId?: string;
  items: Array<{
    id?: string;
    productId: string;
    productName: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
    unit: string;
    rate: number;
    taxRate?: number;
    total?: number;
  }>;
}

export const PurchaseOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    company,
    purchaseRequests,
    suppliers,
    warehouses,
    recordGoodsReceipt,
    refreshPurchaseRequests,
    refreshData
  } = useERP();

  // Filters & State
  const [tabFilter, setTabFilter] = useState<string>(() => {
    const statusParam = searchParams.get('status');
    if (!statusParam) return 'Active';
    if (statusParam.toLowerCase() === 'active') return 'Active';
    if (statusParam.toLowerCase() === 'all') return 'All';
    return statusParam;
  });
  const [warehouseFilter, setWarehouseFilter] = useState<string>('All');
  const [supplierFilter, setSupplierFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dbOrders, setDbOrders] = useState<any[]>([]);

  // Selected Order for Modal
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderItemRow | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const ordersTableRef = useRef<HTMLDivElement>(null);

  // Card & Tab Filter Click Handler
  const handleCardFilterClick = (filterId: string) => {
    if (tabFilter === filterId && !searchQuery && warehouseFilter === 'All' && supplierFilter === 'All') {
      // Clicking the already-active card toggles to 'All'
      setTabFilter('All');
    } else {
      setTabFilter(filterId);
      setWarehouseFilter('All');
      setSupplierFilter('All');
      setSearchQuery('');
    }
    // Smoothly scroll down to the orders table so the results are immediately visible
    setTimeout(() => {
      ordersTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Inward Goods Receiving (GRN) Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [receiveTargetOrder, setReceiveTargetOrder] = useState<PurchaseOrderItemRow | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});
  const [receiptWarehouseId, setReceiptWarehouseId] = useState<string>('');
  const [invoiceReference, setInvoiceReference] = useState<string>('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch purchase orders from database
  const fetchDbOrders = useCallback(async () => {
    const targetCompId = company?.id || '00000000-0000-0000-0000-000000000001';
    if (!isTableMarkedMissing('purchase_orders')) {
      try {
        const { data: poData, error: poErr } = await supabase
          .from('purchase_orders')
          .select('*, purchase_order_items(*)')
          .eq('company_id', targetCompId)
          .order('created_at', { ascending: false });

        if (!poErr && poData) {
          setDbOrders(poData);
          return;
        }
        if (poErr && isTableNotFoundError(poErr)) {
          markTableMissing('purchase_orders');
        }
      } catch (err) {
        if (isTableNotFoundError(err)) {
          markTableMissing('purchase_orders');
        }
      }
    }

    try {
      const { data: pData } = await supabase
        .from('purchases')
        .select('*')
        .eq('company_id', targetCompId)
        .eq('doc_type', 'purchase_order')
        .order('date', { ascending: false });

      if (pData) {
        setDbOrders(pData);
      }
    } catch {}
  }, [company?.id]);

  useEffect(() => {
    fetchDbOrders();
  }, [fetchDbOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setFeedbackMessage(null);
    try {
      if (refreshPurchaseRequests) await refreshPurchaseRequests();
      if (refreshData) await refreshData();
      await fetchDbOrders();
    } catch (err: any) {
      console.warn('Purchase orders refresh warning:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compile Unified Purchase Orders List
  const allOrders: PurchaseOrderItemRow[] = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const results: PurchaseOrderItemRow[] = [];
    const processedKeys = new Set<string>();

    // 1. Process Database Orders (from purchase_orders or purchases)
    (dbOrders || []).forEach(po => {
      const orderNum = po.order_number || po.invoice_number || po.id;
      if (!orderNum) return;
      const key = String(orderNum).trim().toLowerCase();
      if (processedKeys.has(key)) return;
      processedKeys.add(key);

      const matchedSupp = suppliers.find(
        s => s.id === po.supplier_id || (po.supplier_name && s.name.toLowerCase() === po.supplier_name.toLowerCase())
      );
      const supplierName = po.supplier_name || matchedSupp?.name || 'Authorized Supplier';
      const supplierContact = matchedSupp?.phone || 'Not available';
      const supplierEmail = matchedSupp?.email || undefined;
      const supplierGstin = po.supplier_gstin || matchedSupp?.gstin || undefined;

      const rawStatus = (po.status || 'Active').trim();
      let normalizedStatus: 'Active' | 'Delivered' | 'Cancelled' = 'Active';
      const sLower = rawStatus.toLowerCase();
      if (sLower === 'completed' || sLower === 'delivered') normalizedStatus = 'Delivered';
      else if (sLower === 'cancelled' || sLower === 'rejected') normalizedStatus = 'Cancelled';
      else normalizedStatus = 'Active';

      const expDate = po.expected_delivery || po.due_date || po.expectedDelivery || null;
      const cleanExpDate = expDate ? String(expDate).split('T')[0] : null;

      const itemsRaw = po.purchase_order_items || po.items || [];
      let totalQty = 0;
      let receivedQty = 0;
      const mappedItems: PurchaseOrderItemRow['items'] = [];

      if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
        itemsRaw.forEach((it: any) => {
          const oq = Number(it.qty || it.orderedQty || it.requestedQty || 0);
          const rq = Number(it.receivedQty || it.received_qty || 0);
          const pq = Math.max(0, oq - rq);
          totalQty += oq;
          receivedQty += rq;
          mappedItems.push({
            id: it.id,
            productId: it.product_id || it.productId || 'prod-custom',
            productName: it.product_name || it.productName || 'Order Item',
            orderedQty: oq,
            receivedQty: rq,
            pendingQty: pq,
            unit: it.unit || 'Units',
            rate: Number(it.rate || it.unitPrice || 0),
            taxRate: Number(it.tax_rate || it.taxRate || 0),
            total: Number(it.total || oq * (it.rate || 0))
          });
        });
      } else {
        totalQty = Number(po.qty || 1);
        receivedQty = Number(po.received_qty || 0);
      }

      const pendingQty = Math.max(0, totalQty - receivedQty);
      if (pendingQty === 0 && totalQty > 0 && normalizedStatus !== 'Cancelled') {
        normalizedStatus = 'Delivered';
      }

      const isOverdue = !!(cleanExpDate && cleanExpDate < today && pendingQty > 0 && normalizedStatus !== 'Delivered');

      results.push({
        id: po.id,
        orderNumber: String(orderNum),
        date: po.date || po.created_at?.split('T')[0] || today,
        expectedDelivery: cleanExpDate,
        supplierId: po.supplier_id || matchedSupp?.id || null,
        supplierName,
        supplierContact,
        supplierEmail,
        supplierGstin,
        warehouseId: po.warehouse_id || null,
        warehouseName: po.warehouse_name || po.warehouse || 'Central Distribution Godown',
        status: normalizedStatus,
        grandTotal: Number(po.grand_total || po.total_amount || po.grandTotal || 0),
        totalQty,
        receivedQty,
        pendingQty,
        isOverdue,
        notes: po.notes || undefined,
        linkedRequestId: po.request_id || undefined,
        items: sortProductsAZ(mappedItems)
      });
    });

    // 2. Process Purchase Requests in Ordered / In Transit / Partially Received state
    (purchaseRequests || []).forEach(req => {
      const orderNum = req.purchaseOrderNumber || req.purchaseOrderId;
      const statusLower = (req.status || '').toLowerCase();
      const isOrderStage =
        statusLower === 'ordered' ||
        (statusLower as string) === 'active' ||
        statusLower === 'partially received' ||
        (statusLower === 'completed' && req.purchaseOrderNumber) ||
        ((statusLower as string) === 'delivered' && req.purchaseOrderNumber);

      if (!isOrderStage) return;

      const orderKey = orderNum ? String(orderNum).trim().toLowerCase() : `req-${req.id}`;
      if (processedKeys.has(orderKey)) {
        // Order was already indexed from DB table, but attach linkedRequestId if missing
        const existing = results.find(r => r.orderNumber.toLowerCase() === orderKey);
        if (existing && !existing.linkedRequestId) {
          existing.linkedRequestId = req.id;
        }
        return;
      }
      processedKeys.add(orderKey);

      // Extract vendor name from history comments if available
      let suppName: string | null = null;
      if (req.history) {
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
        s => (suppName && s.name.toLowerCase() === suppName.toLowerCase())
      );
      const supplierName = suppName || matchedSupp?.name || 'Authorized Supplier';
      const supplierContact = matchedSupp?.phone || 'Not available';

      let totalQty = 0;
      let receivedQty = 0;
      const mappedItems: PurchaseOrderItemRow['items'] = [];

      (req.items || []).forEach(it => {
        const oq = Number(it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty || 0);
        const rq = Number(it.receivedQty || 0);
        const pq = Math.max(0, oq - rq);
        totalQty += oq;
        receivedQty += rq;
        mappedItems.push({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          orderedQty: oq,
          receivedQty: rq,
          pendingQty: pq,
          unit: it.unit || 'Units',
          rate: Number(it.estimatedCost || 0),
          total: oq * Number(it.estimatedCost || 0)
        });
      });

      const pendingQty = Math.max(0, totalQty - receivedQty);
      let normalizedStatus: 'Active' | 'Delivered' | 'Cancelled' = 'Active';
      if (statusLower === 'completed' || (statusLower as string) === 'delivered' || (totalQty > 0 && pendingQty === 0)) {
        normalizedStatus = 'Delivered';
      } else {
        normalizedStatus = 'Active';
      }

      const expDate = req.requestedDeliveryDate ? req.requestedDeliveryDate.split('T')[0] : null;
      const isOverdue = !!(expDate && expDate < today && pendingQty > 0 && normalizedStatus !== 'Delivered');

      results.push({
        id: req.purchaseOrderId || `po-${req.id}`,
        orderNumber: req.purchaseOrderNumber || `PO-${req.requestNumber.replace('PR-', '')}`,
        date: req.createdAt ? req.createdAt.split('T')[0] : today,
        expectedDelivery: expDate,
        supplierId: matchedSupp?.id || null,
        supplierName,
        supplierContact,
        supplierEmail: matchedSupp?.email,
        supplierGstin: matchedSupp?.gstin,
        warehouseId: req.warehouseId,
        warehouseName: req.warehouseName || 'Warehouse Hub',
        status: normalizedStatus,
        grandTotal: mappedItems.reduce((sum, it) => sum + (it.total || 0), 0),
        totalQty,
        receivedQty,
        pendingQty,
        isOverdue,
        notes: req.reason || `Linked to PR #${req.requestNumber}`,
        linkedRequestId: req.id,
        items: sortProductsAZ(mappedItems)
      });
    });

    return results;
  }, [dbOrders, purchaseRequests, suppliers]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // Tab Status Filter
      if (tabFilter === 'Active') {
        if (order.status !== 'Active') return false;
      } else if (tabFilter === 'Delivered' || tabFilter === 'Completed') {
        if (order.status !== 'Delivered') return false;
      } else if (tabFilter === 'Items to Deliver' || tabFilter === 'Pending') {
        if (order.pendingQty <= 0 || order.status !== 'Active') return false;
      } else if (tabFilter === 'Overdue') {
        if (!order.isOverdue || order.status !== 'Active') return false;
      } else if (tabFilter !== 'All') {
        if (order.status.toLowerCase() !== tabFilter.toLowerCase()) return false;
      }

      // Warehouse Filter
      if (warehouseFilter !== 'All' && order.warehouseId !== warehouseFilter) {
        return false;
      }

      // Supplier Filter
      if (supplierFilter !== 'All' && order.supplierName !== supplierFilter) {
        return false;
      }

      // Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = order.orderNumber.toLowerCase().includes(q);
        const matchSupp = order.supplierName.toLowerCase().includes(q);
        const matchWh = order.warehouseName.toLowerCase().includes(q);
        const matchItem = order.items.some(it => it.productName.toLowerCase().includes(q));
        if (!matchNum && !matchSupp && !matchWh && !matchItem) return false;
      }

      return true;
    });
  }, [allOrders, tabFilter, warehouseFilter, supplierFilter, searchQuery]);

  // Statistics KPI counts
  const stats = useMemo(() => {
    const active = allOrders.filter(o => o.status === 'Active');
    const itemsToDeliver = active.reduce((sum, o) => sum + o.pendingQty, 0);
    const overdueCount = active.filter(o => o.isOverdue).length;
    const completedCount = allOrders.filter(o => o.status === 'Delivered').length;
    return {
      activeOrdersCount: active.length,
      itemsToDeliver,
      overdueCount,
      completedCount
    };
  }, [allOrders]);

  // Open Details Modal
  const handleOpenDetailModal = (order: PurchaseOrderItemRow) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  // Open Goods Receipt Modal
  const handleOpenReceiveModal = (order: PurchaseOrderItemRow) => {
    setReceiveTargetOrder(order);
    setReceiptWarehouseId(order.warehouseId || (warehouses[0]?.id || ''));
    setInvoiceReference('');
    const initialQtys: Record<string, number> = {};
    order.items.forEach(it => {
      const remaining = it.pendingQty;
      initialQtys[it.id || it.productId] = remaining > 0 ? remaining : 0;
    });
    setReceiptQuantities(initialQtys);
    setIsReceiveModalOpen(true);
    setFeedbackMessage(null);
  };

  // Submit Goods Receipt (GRN)
  const handleSubmitReceipt = async () => {
    if (!receiveTargetOrder) return;
    if (!receiptWarehouseId) {
      alert('Please select a receiving warehouse destination.');
      return;
    }

    // Identify linked request
    const linkedReq = purchaseRequests.find(
      r => r.id === receiveTargetOrder.linkedRequestId || r.purchaseOrderNumber === receiveTargetOrder.orderNumber
    );

    if (!linkedReq) {
      alert('Goods Receipt (GRN) requires an active linked purchase request. You can record a purchase bill under New Purchase Bill.');
      return;
    }

    setIsSubmittingReceipt(true);
    try {
      const itemsPayload = (linkedReq.items || []).map(it => {
        const enteredQty = receiptQuantities[it.id] ?? receiptQuantities[it.productId] ?? 0;
        return {
          itemId: it.id,
          productId: it.productId,
          receivedQty: Number(enteredQty)
        };
      });

      await recordGoodsReceipt({
        requestId: linkedReq.id,
        receivedItems: itemsPayload,
        receivingWarehouseId: receiptWarehouseId,
        invoiceNumber: invoiceReference.trim() || undefined
      });

      setFeedbackMessage({
        type: 'success',
        text: `Inward goods receipt confirmed for PO #${receiveTargetOrder.orderNumber}. Inventory updated.`
      });

      setTimeout(async () => {
        setIsReceiveModalOpen(false);
        setReceiveTargetOrder(null);
        setIsSubmittingReceipt(false);
        if (refreshPurchaseRequests) await refreshPurchaseRequests();
        await fetchDbOrders();
      }, 1200);
    } catch (err: any) {
      alert(`Goods Receipt Error: ${err.message || 'Failed to record receipt'}`);
      setIsSubmittingReceipt(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchases/dashboard')}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Back to Purchase Manager Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <span>Purchase Orders & Active Order Tracking</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor vendor purchase orders, track in-transit deliveries, view supplier contact details, and record inward goods receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 self-start sm:self-auto">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-2xs"
            title="Refresh order records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {hasPermission(profile?.role, 'purchases', 'create') && (
            <button
              onClick={() => navigate('/purchases/new')}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Record Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Orders"
          value={formatNumber(stats.activeOrdersCount)}
          subtitle="Orders currently in procurement"
          icon={Truck}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => handleCardFilterClick('Active')}
          isSelected={tabFilter === 'Active'}
          selectedColor="blue"
        />
        <StatCard
          title="Items to Deliver"
          value={`${formatNumber(stats.itemsToDeliver)} Units`}
          subtitle="Pending delivery across all suppliers"
          icon={PackageCheck}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={() => handleCardFilterClick('Items to Deliver')}
          isSelected={tabFilter === 'Items to Deliver'}
          selectedColor="indigo"
        />
        <StatCard
          title="Overdue Deliveries"
          value={formatNumber(stats.overdueCount)}
          subtitle="Orders past expected arrival date"
          icon={AlertTriangle}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          onClick={() => handleCardFilterClick('Overdue')}
          isSelected={tabFilter === 'Overdue'}
          selectedColor="rose"
        />
        <StatCard
          title="Delivered Orders"
          value={formatNumber(stats.completedCount)}
          subtitle="Fully delivered and stocked"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => handleCardFilterClick('Delivered')}
          isSelected={tabFilter === 'Delivered' || tabFilter === 'Completed'}
          selectedColor="emerald"
        />
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Warehouse destination filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1 max-w-[180px]"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PO #, supplier name, product, or warehouse..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div ref={ordersTableRef} className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Purchase Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {tabFilter === 'Active'
                ? 'There are currently no active purchase orders in progress. Convert approved purchase requests into purchase orders to begin delivery tracking.'
                : 'No orders match your current filter parameters. Try resetting your search or filter options.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setTabFilter('All');
                  setWarehouseFilter('All');
                  setSupplierFilter('All');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Clear Filters
              </button>
              <button
                onClick={() => navigate('/purchases/requests')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                View Purchase Requests
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order # & Date</th>
                  <th className="py-3 px-4">Supplier / Contact</th>
                  <th className="py-3 px-4">Destination Hub</th>
                  <th className="py-3 px-4 text-center">Quantities (Ord / Rec / Pend)</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Order Value</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-600 block">
                        {order.orderNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(order.date)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block truncate max-w-[200px]">
                        {order.supplierName}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono">{order.supplierContact}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        <WarehouseIcon className="w-3 h-3 text-slate-400" />
                        {order.warehouseName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="font-mono font-semibold text-slate-700">
                        <span className="text-slate-900 font-bold">{order.totalQty}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-emerald-600">{order.receivedQty}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className={`font-bold ${order.pendingQty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {order.pendingQty}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} listed
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {order.expectedDelivery ? (
                        <div>
                          <span className={`font-medium text-xs block ${order.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {formatDate(order.expectedDelivery)}
                          </span>
                          {order.isOverdue && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
                              <AlertCircle className="w-3 h-3" />
                              <span>Overdue</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Standard Delivery</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : order.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {order.status === 'Delivered' && <CheckCircle2 className="w-3 h-3" />}
                        {order.status === 'Active' && <Truck className="w-3 h-3" />}
                        <span>{order.status}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {order.grandTotal > 0 ? formatCurrency(order.grandTotal) : '—'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetailModal(order)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {hasPermission(profile?.role, 'purchases', 'create') && order.status !== 'Cancelled' && (
                          <button
                            onClick={() => navigate(`/purchases/new?poId=${order.id}${order.linkedRequestId ? `&requestId=${order.linkedRequestId}` : ''}`)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Record Supplier Invoice against this Purchase Order"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Bill</span>
                          </button>
                        )}

                        {order.pendingQty > 0 && order.status === 'Active' && (
                          <button
                            onClick={() => handleOpenReceiveModal(order)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Record Inward Goods Receipt (GRN)"
                          >
                            <PackageCheck className="w-3 h-3" />
                            <span>Receive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && isDetailModalOpen && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Purchase Order #${selectedOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            {/* Order Header Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Supplier</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">{selectedOrder.supplierName}</span>
                <span className="text-[11px] text-slate-500 font-mono">{selectedOrder.supplierContact}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Destination</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedOrder.warehouseName}</span>
                <span className="text-[11px] text-slate-500">Order Date: {formatDate(selectedOrder.date)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Expected Delivery</span>
                <span className={`font-semibold text-xs mt-0.5 block ${selectedOrder.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                  {selectedOrder.expectedDelivery ? formatDate(selectedOrder.expectedDelivery) : 'Standard Delivery'}
                </span>
                <span className="text-[11px] text-slate-500">Status: {selectedOrder.status}</span>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <h4 className="font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Ordered Products ({selectedOrder.items.length})</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Ordered: <strong>{selectedOrder.totalQty}</strong> | Received: <strong>{selectedOrder.receivedQty}</strong> | Pending: <strong>{selectedOrder.pendingQty}</strong>
                </span>
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-2 text-right">Ordered</th>
                      <th className="py-2 px-2 text-right">Received</th>
                      <th className="py-2 px-2 text-right">Pending</th>
                      <th className="py-2 px-3 text-right">Unit Rate</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {item.productName}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {item.orderedQty} {item.unit}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-600 font-semibold">
                          {item.receivedQty} {item.unit}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-600">
                          {item.pendingQty} {item.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {item.rate > 0 ? formatCurrency(item.rate) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {item.total ? formatCurrency(item.total) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-blue-900 text-xs">
                <span className="font-bold block text-[10px] uppercase text-blue-700">Order Notes</span>
                <p className="mt-0.5">{selectedOrder.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedOrder.pendingQty > 0 && selectedOrder.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenReceiveModal(selectedOrder);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Record Goods Receipt</span>
                  </button>
                )}
                {hasPermission(profile?.role, 'purchases', 'create') && (
                  <button
                    type="button"
                    onClick={() => navigate(`/purchases/new?poId=${selectedOrder.id}${selectedOrder.linkedRequestId ? `&requestId=${selectedOrder.linkedRequestId}` : ''}`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Purchase Bill</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Inward Goods Receipt (GRN) Modal */}
      {receiveTargetOrder && isReceiveModalOpen && (
        <Modal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          title={`Inward Goods Receipt (GRN) — PO #${receiveTargetOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Record physical items delivered by <strong className="text-slate-900">{receiveTargetOrder.supplierName}</strong>. Confirmed received quantities will immediately increase available stock in the selected warehouse.
            </p>

            {feedbackMessage && (
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${
                feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {feedbackMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span className="font-semibold">{feedbackMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Receiving Warehouse / Hub <span className="text-rose-500">*</span>
                </label>
                <select
                  value={receiptWarehouseId}
                  onChange={e => setReceiptWarehouseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor Delivery Challan / Invoice # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. DC-98432 or INV-1002"
                  value={invoiceReference}
                  onChange={e => setInvoiceReference(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Line items input */}
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Delivered Product Quantities:</span>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-2 text-right">Ordered</th>
                      <th className="py-2 px-2 text-right">Pending</th>
                      <th className="py-2 px-3 text-right w-28">Received Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiveTargetOrder.items.map((item, idx) => {
                      const itemKey = item.id || item.productId;
                      const currentVal = receiptQuantities[itemKey] ?? item.pendingQty;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {item.productName}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {item.orderedQty} {item.unit}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-amber-600">
                            {item.pendingQty} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={item.pendingQty}
                              value={currentVal}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setReceiptQuantities(prev => ({
                                  ...prev,
                                  [itemKey]: val
                                }));
                              }}
                              className="w-20 p-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReceipt}
                onClick={handleSubmitReceipt}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm Stock Receipt</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
