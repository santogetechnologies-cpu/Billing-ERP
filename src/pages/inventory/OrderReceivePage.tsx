import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  Search,
  Filter,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Building2,
  Calendar,
  Layers,
  Eye,
  RefreshCw,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Boxes
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { formatDate } from '../../utils/formatters';
import {
  orderReceiveService,
  OrderReceiveItem,
  OrderReceiveProductItem,
  OrderDeliveryStatus
} from '../../services/orderReceiveService';

export const OrderReceivePage: React.FC = () => {
  const {
    purchaseRequests,
    purchaseInvoices,
    suppliers,
    warehouses,
    products,
    recordGoodsReceipt,
    refreshData
  } = useERP();
  const { user, profile } = useAuth();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderDeliveryStatus>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail Modal State (Eye Icon)
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<OrderReceiveItem | null>(null);

  // Receive Form Modal State (Receive Button)
  const [receivingOrder, setReceivingOrder] = useState<OrderReceiveItem | null>(null);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveInvoiceNumber, setReceiveInvoiceNumber] = useState('');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<string, { arrivedQty: number; damagedQty: number }>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Compute Order Receive items
  const allOrders: OrderReceiveItem[] = useMemo(() => {
    return orderReceiveService.getOrderReceiveList({
      purchaseRequests: purchaseRequests || [],
      purchaseInvoices: purchaseInvoices || [],
      suppliers: suppliers || [],
      warehouses: warehouses || [],
      products: products || []
    });
  }, [purchaseRequests, purchaseInvoices, suppliers, warehouses, products]);

  // KPI Statistics
  const kpiStats = useMemo(() => {
    let pendingCount = 0;
    let partialCount = 0;
    let completedCount = 0;
    let overdueCount = 0;

    allOrders.forEach(o => {
      if (o.deliveryStatus === 'Pending') pendingCount++;
      else if (o.deliveryStatus === 'Partially Received') partialCount++;
      else if (o.deliveryStatus === 'Received / Completed') completedCount++;

      if (o.isOverdue) overdueCount++;
    });

    const awaitingReceiptCount = pendingCount + partialCount;

    return {
      awaitingReceiptCount,
      pendingCount,
      partialCount,
      completedCount,
      overdueCount
    };
  }, [allOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // Status filter
      if (statusFilter !== 'ALL' && order.deliveryStatus !== statusFilter) {
        return false;
      }

      // Warehouse filter
      if (warehouseFilter !== 'ALL' && order.warehouseId !== warehouseFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesNumber = order.orderNumber.toLowerCase().includes(query);
        const matchesSupplier = order.supplierName.toLowerCase().includes(query);
        const matchesInvoice = order.supplierInvoiceNumber.toLowerCase().includes(query);
        const matchesProducts = order.orderedProductsSummary.toLowerCase().includes(query);
        const matchesContact = order.supplierContact.toLowerCase().includes(query);

        if (!matchesNumber && !matchesSupplier && !matchesInvoice && !matchesProducts && !matchesContact) {
          return false;
        }
      }

      return true;
    });
  }, [allOrders, statusFilter, warehouseFilter, searchTerm]);

  // Handle Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      console.warn('Failed to refresh data:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Open Receive Form Modal
  const handleOpenReceive = (order: OrderReceiveItem) => {
    setReceivingOrder(order);
    setReceiveWarehouseId(order.warehouseId || (warehouses?.[0]?.id ?? ''));
    setReceiveInvoiceNumber(order.hasSupplierBill ? order.supplierInvoiceNumber : '');
    setReceiveRemarks('');
    setFormError(null);

    // Initialize quantities for each item to 0 arrived, 0 damaged
    // Default arrived qty to pendingQty (or orderedQty if pending is not set) for convenience, but editable
    const initialQtys: Record<string, { arrivedQty: number; damagedQty: number }> = {};
    const itemsToReceive = order.items && order.items.length > 0 ? [...order.items] : [];

    if (itemsToReceive.length === 0) {
      const fallbackId = `item-fallback-${order.id}`;
      itemsToReceive.push({
        id: fallbackId,
        productId: 'gen-prod-001',
        productName: 'General Order Items / Goods',
        sku: 'GEN-001',
        unit: 'Piece',
        orderedQty: 1,
        previouslyReceivedQty: 0,
        pendingQty: 1,
        currentStock: 0,
        rate: 0
      });
      order.items = itemsToReceive;
    }

    itemsToReceive.forEach(it => {
      initialQtys[it.id] = {
        arrivedQty: it.pendingQty > 0 ? it.pendingQty : (it.orderedQty > 0 ? it.orderedQty : 1),
        damagedQty: 0
      };
    });
    setReceiveQuantities(initialQtys);
  };

  // Update Arrived / Received Qty
  const handleArrivedQtyChange = (itemId: string, maxPending: number, val: number) => {
    setFormError(null);
    const validVal = isNaN(val) ? 0 : Math.max(0, val);
    // Prevent negative quantities and prevent exceeding pending order quantity
    const cappedVal = maxPending > 0 ? Math.min(validVal, maxPending) : validVal;
    setReceiveQuantities(prev => {
      const current = prev[itemId] || { arrivedQty: 0, damagedQty: 0 };
      // Ensure damaged doesn't exceed arrived
      const adjustedDamaged = Math.min(current.damagedQty, cappedVal);
      return {
        ...prev,
        [itemId]: {
          arrivedQty: cappedVal,
          damagedQty: adjustedDamaged
        }
      };
    });
  };

  // Update Damaged / Rejected Qty
  const handleDamagedQtyChange = (itemId: string, arrived: number, val: number) => {
    setFormError(null);
    const validVal = isNaN(val) ? 0 : Math.max(0, val);
    // Damaged quantity cannot be negative and cannot exceed arrived quantity
    const cappedDamaged = Math.min(validVal, Math.max(0, arrived));
    setReceiveQuantities(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { arrivedQty: arrived }),
        damagedQty: cappedDamaged
      }
    }));
  };

  // Validate and Proceed to Confirmation
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingOrder) return;

    let totalArrived = 0;
    let hasOverReceipt = false;
    let overReceiptMessage = '';

    for (const it of receivingOrder.items) {
      const qty = receiveQuantities[it.id] || { arrivedQty: 0, damagedQty: 0 };
      const arrived = Number(qty.arrivedQty) || 0;
      const damaged = Number(qty.damagedQty) || 0;

      if (it.pendingQty > 0 && arrived > it.pendingQty) {
        hasOverReceipt = true;
        overReceiptMessage = `Received quantity for "${it.productName}" (${arrived}) exceeds outstanding pending quantity (${it.pendingQty}). Over-receipt is not permitted.`;
        break;
      }

      if (damaged > arrived) {
        setFormError(`Damaged quantity cannot exceed arrived quantity for "${it.productName}".`);
        return;
      }

      totalArrived += arrived;
    }

    if (hasOverReceipt) {
      setFormError(overReceiptMessage);
      return;
    }

    if (totalArrived <= 0) {
      setFormError('Please enter at least one positive received quantity to record inward goods.');
      return;
    }

    setFormError(null);
    setShowConfirmModal(true);
  };

  // Confirm and Submit Goods Receipt
  const handleConfirmSubmit = async () => {
    if (!receivingOrder) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const receivedItemsPayload = receivingOrder.items.map(it => {
        const q = receiveQuantities[it.id] || { arrivedQty: 0, damagedQty: 0 };
        const arrived = Math.max(0, Number(q.arrivedQty) || 0);
        const damaged = Math.max(0, Number(q.damagedQty) || 0);
        const accepted = Math.max(0, arrived - damaged);
        return {
          itemId: it.id,
          productId: it.productId,
          receivedQty: arrived,
          damagedQty: damaged,
          acceptedQty: accepted
        };
      });

      // Submit via ERPContext recordGoodsReceipt
      await recordGoodsReceipt({
        requestId: receivingOrder.purchaseRequestId || receivingOrder.purchaseOrderId || receivingOrder.id,
        receivedItems: receivedItemsPayload,
        receivingWarehouseId: receiveWarehouseId || receivingOrder.warehouseId,
        invoiceNumber: receiveInvoiceNumber.trim() || undefined,
        notes: receiveRemarks.trim() || undefined
      });

      setShowConfirmModal(false);
      setReceivingOrder(null);
      setSuccessToast(`Goods receipt successfully recorded for Order #${receivingOrder.orderNumber}! Stock has been updated.`);

      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    } catch (err: any) {
      console.error('Failed to confirm goods receipt:', err);
      setFormError(err.message || 'Failed to record goods receipt. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper badge renderers
  const renderStatusBadge = (status: OrderDeliveryStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Partially Received
          </span>
        );
      case 'Received / Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
            Received / Completed
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="p-1 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Order Receive
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Verify incoming supplier deliveries, record received quantities, and update warehouse stock
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Refresh order delivery status"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Awaiting Receipt */}
        <div
          onClick={() => setStatusFilter('ALL')}
          role="button"
          tabIndex={0}
          className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs cursor-pointer select-none group ${
            statusFilter === 'ALL'
              ? 'border-indigo-400 ring-2 ring-indigo-500/15 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug group-hover:text-slate-700 transition-colors">
              Awaiting Receipt
            </h2>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {kpiStats.awaitingReceiptCount}
            </span>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Active incoming purchase orders
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div
          onClick={() => setStatusFilter('Pending')}
          role="button"
          tabIndex={0}
          className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs cursor-pointer select-none group ${
            statusFilter === 'Pending'
              ? 'border-amber-400 ring-2 ring-amber-500/15 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug group-hover:text-slate-700 transition-colors">
              Pending Deliveries
            </h2>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {kpiStats.pendingCount}
            </span>
            <p className="text-xs text-slate-500 font-medium mt-1">
              0% received so far
            </p>
          </div>
        </div>

        {/* Partially Received */}
        <div
          onClick={() => setStatusFilter('Partially Received')}
          role="button"
          tabIndex={0}
          className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs cursor-pointer select-none group ${
            statusFilter === 'Partially Received'
              ? 'border-blue-400 ring-2 ring-blue-500/15 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug group-hover:text-slate-700 transition-colors">
              Partially Received
            </h2>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {kpiStats.partialCount}
            </span>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Outstanding remaining quantities
            </p>
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setStatusFilter('Received / Completed')}
          role="button"
          tabIndex={0}
          className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs cursor-pointer select-none group ${
            statusFilter === 'Received / Completed'
              ? 'border-emerald-400 ring-2 ring-emerald-500/15 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug group-hover:text-slate-700 transition-colors">
              Received / Completed
            </h2>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {kpiStats.completedCount}
            </span>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Fully received & accepted
            </p>
          </div>
        </div>
      </div>

      {/* Main Filter & Table Card */}
      <div className="bg-white rounded-[20px] border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by PO#, supplier, invoice#, or product..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50/75 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Warehouse Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
                <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={warehouseFilter}
                  onChange={e => setWarehouseFilter(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses?.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 sm:px-4 text-left">Purchase Order / Bill #</th>
                <th className="py-3 px-3 sm:px-4 text-left">Supplier Name</th>
                <th className="py-3 px-3 sm:px-4 text-left">Supplier Contact</th>
                <th className="py-3 px-3 sm:px-4 text-left">Expected Delivery</th>
                <th className="py-3 px-3 sm:px-4 text-center">Delivery Status</th>
                <th className="py-3 px-3 sm:px-4 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">No supplier deliveries found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm || statusFilter !== 'ALL' || warehouseFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or status filter.'
                          : 'There are currently no purchase orders awaiting goods receipt.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isEligibleToReceive = order.deliveryStatus !== 'Received / Completed';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. PO / Bill Number */}
                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-600 font-mono font-bold">{order.orderNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                          {order.warehouseName}
                        </span>
                      </td>

                      {/* 2. Supplier Name */}
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-800">
                        <span className="block truncate max-w-[180px] sm:max-w-[220px] xl:max-w-xs" title={order.supplierName}>
                          {order.supplierName}
                        </span>
                        {order.supplierGstin && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            GSTIN: {order.supplierGstin}
                          </span>
                        )}
                      </td>

                      {/* 3. Supplier Contact */}
                      <td className="py-3 px-3 sm:px-4 text-slate-600 font-medium whitespace-nowrap">
                        {order.supplierContact}
                      </td>

                      {/* 4. Expected Delivery Date */}
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className={`font-medium ${order.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {formatDate(order.expectedDeliveryDate)}
                          </span>
                        </div>
                        {order.isOverdue && (
                          <span className="inline-block text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded mt-0.5">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* 5. Delivery Status */}
                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        {renderStatusBadge(order.deliveryStatus)}
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Eye Icon Button: View Full Details */}
                          <button
                            onClick={() => setSelectedDetailOrder(order)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="View Full Order Details (Products, Quantities & History)"
                            aria-label="View Full Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Receive Button */}
                          {isEligibleToReceive ? (
                            <button
                              onClick={() => handleOpenReceive(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                              title="Receive Goods into Warehouse"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Receive</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Received</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Eye Icon — View Full Details Modal                                    */}
      {/* ========================================================================= */}
      {selectedDetailOrder && (
        <Modal
          isOpen={Boolean(selectedDetailOrder)}
          onClose={() => setSelectedDetailOrder(null)}
          title={`Order Delivery Details — ${selectedDetailOrder.orderNumber}`}
          size="2xl"
        >
          <div className="p-6 space-y-6">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Supplier Card */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <span>Supplier Information</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {selectedDetailOrder.supplierName}
                </div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p><span className="font-semibold text-slate-500">Contact:</span> {selectedDetailOrder.supplierContact}</p>
                  {selectedDetailOrder.supplierPhone && (
                    <p><span className="font-semibold text-slate-500">Phone:</span> {selectedDetailOrder.supplierPhone}</p>
                  )}
                  {selectedDetailOrder.supplierEmail && (
                    <p><span className="font-semibold text-slate-500">Email:</span> {selectedDetailOrder.supplierEmail}</p>
                  )}
                  {selectedDetailOrder.supplierGstin && (
                    <p><span className="font-semibold text-slate-500">GSTIN:</span> {selectedDetailOrder.supplierGstin}</p>
                  )}
                  {selectedDetailOrder.supplierAddress && (
                    <p><span className="font-semibold text-slate-500">Address:</span> {selectedDetailOrder.supplierAddress}</p>
                  )}
                </div>
              </div>

              {/* Order & Invoice Details */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Purchase & Invoice</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1.5">
                  <p>
                    <span className="font-semibold text-slate-500">PO Number:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">{selectedDetailOrder.orderNumber}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Supplier Invoice:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">
                      {selectedDetailOrder.supplierInvoiceNumber}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Order Created:</span>{' '}
                    {formatDate(selectedDetailOrder.createdAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Destination:</span>{' '}
                    <span className="font-semibold text-slate-800">{selectedDetailOrder.warehouseName}</span>
                  </p>
                </div>
              </div>

              {/* Delivery Status Card */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  <span>Delivery Status</span>
                </div>
                <div>
                  {renderStatusBadge(selectedDetailOrder.deliveryStatus)}
                </div>
                <div className="text-xs text-slate-600 space-y-1 mt-2">
                  <p>
                    <span className="font-semibold text-slate-500">Expected Delivery:</span>{' '}
                    <span className={selectedDetailOrder.isOverdue ? 'text-rose-600 font-bold' : 'font-medium'}>
                      {formatDate(selectedDetailOrder.expectedDeliveryDate)}
                      {selectedDetailOrder.isOverdue && ' (Overdue)'}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Ordered Qty:</span>{' '}
                    {selectedDetailOrder.orderedQuantity.toLocaleString()}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Received Qty:</span>{' '}
                    {selectedDetailOrder.previouslyReceivedQuantity.toLocaleString()}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Pending Qty:</span>{' '}
                    <span className="font-bold text-amber-600">
                      {selectedDetailOrder.pendingQuantity.toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Products Breakdown Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Ordered Products Breakdown
              </h3>
              <div className="border border-slate-200/90 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Previously Received</th>
                      <th className="py-2.5 px-3 text-right">Pending Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedDetailOrder.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.productName}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{item.sku}</td>
                        <td className="py-2 px-3 text-slate-500">{item.unit}</td>
                        <td className="py-2 px-3 text-right font-semibold">{item.orderedQty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{item.previouslyReceivedQty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-bold">
                          <span className={item.pendingQty > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                            {item.pendingQty.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Goods Receipt Audit History */}
            {selectedDetailOrder.history && selectedDetailOrder.history.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Goods Receipt Audit History
                </h3>
                <div className="space-y-2 border border-slate-200/90 rounded-xl p-3 bg-slate-50/50 max-h-48 overflow-y-auto">
                  {selectedDetailOrder.history.map(h => (
                    <div key={h.id} className="text-xs p-2.5 bg-white border border-slate-200/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <span className="font-bold text-slate-800">{h.receivedBy}</span>{' '}
                        {h.role && <span className="text-[10px] text-slate-400">({h.role})</span>}
                        <p className="text-slate-600 text-xs mt-0.5">{h.comments || 'Status update'}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap self-start sm:self-auto">
                        {formatDate(h.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              {selectedDetailOrder.deliveryStatus !== 'Received / Completed' && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = selectedDetailOrder;
                    setSelectedDetailOrder(null);
                    handleOpenReceive(ord);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Receive Goods</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 4. Receive Button — Receiving Form Modal                                */}
      {/* ========================================================================= */}
      {receivingOrder && (
        <Modal
          isOpen={Boolean(receivingOrder)}
          onClose={() => setReceivingOrder(null)}
          title={`Receive Goods — Order #${receivingOrder.orderNumber}`}
          size="2xl"
        >
          <form onSubmit={handleProceedToConfirm} className="p-6 space-y-6">
            {/* Order Overview Header Banner */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Supplier Delivery
                </span>
                <span className="text-sm font-black text-slate-900">
                  {receivingOrder.supplierName}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Contact: {receivingOrder.supplierContact}
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Outstanding Quantity
                </span>
                <span className="text-lg font-black text-amber-600">
                  {receivingOrder.pendingQuantity.toLocaleString()} units remaining
                </span>
              </div>
            </div>

            {/* Form Fields: Destination Warehouse & Supplier Invoice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Destination Warehouse <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <WarehouseIcon className="w-4 h-4 text-slate-400" />
                  <select
                    value={receiveWarehouseId}
                    onChange={e => setReceiveWarehouseId(e.target.value)}
                    required
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {warehouses?.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Supplier Invoice / Bill Number
                </label>
                <input
                  type="text"
                  value={receiveInvoiceNumber}
                  onChange={e => setReceiveInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-9041 (if provided by carrier)"
                  className="w-full px-3 py-2 text-xs font-mono font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Error Message Alert */}
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Product Quantities Entry Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Record Inward Products
                </h3>
                <span className="text-[11px] text-slate-400">
                  Stock increases only for <span className="font-bold text-emerald-600">Accepted Qty</span>
                </span>
              </div>

              <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Product Name</th>
                      <th className="py-2.5 px-3 text-right">Ordered Quantity</th>
                      <th className="py-2.5 px-3 text-right">Previously Received</th>
                      <th className="py-2.5 px-3 text-right">Pending Quantity</th>
                      <th className="py-2.5 px-3 text-center w-28">Received Quantity</th>
                      <th className="py-2.5 px-3 text-center w-36">Damaged / Rejected Quantity</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-700">Accepted Into Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {receivingOrder.items.map(item => {
                      const q = receiveQuantities[item.id] || { arrivedQty: 0, damagedQty: 0 };
                      const arrived = Number(q.arrivedQty) || 0;
                      const damaged = Number(q.damagedQty) || 0;
                      const accepted = Math.max(0, arrived - damaged);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          {/* 1. Product Name (Read-only) */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku} • Unit: {item.unit}
                            </div>
                          </td>

                          {/* 2. Ordered Quantity (Read-only, determined by Purchase Manager) */}
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className="inline-block font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200/60"
                              title="Original Ordered Quantity from Purchase Order (Controlled by Purchase Manager)"
                            >
                              {item.orderedQty.toLocaleString()} {item.unit}
                            </span>
                          </td>

                          {/* 3. Previously Received (Read-only) */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                            {item.previouslyReceivedQty.toLocaleString()} {item.unit}
                          </td>

                          {/* 4. Pending Quantity (Read-only) */}
                          <td className="py-2.5 px-3 text-right font-bold text-amber-600">
                            {item.pendingQty.toLocaleString()} {item.unit}
                          </td>

                          {/* 5. Received Quantity (Warehouse Manager Input) */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.pendingQty > 0 ? item.pendingQty : undefined}
                              value={q.arrivedQty === 0 ? '' : q.arrivedQty}
                              onChange={e => handleArrivedQtyChange(item.id, item.pendingQty, parseInt(e.target.value, 10))}
                              placeholder="0"
                              className="w-24 px-2.5 py-1.5 text-center font-bold text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </td>

                          {/* 6. Damaged / Rejected Quantity (Warehouse Manager Input) */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={arrived}
                              value={q.damagedQty === 0 ? '' : q.damagedQty}
                              onChange={e => handleDamagedQtyChange(item.id, arrived, parseInt(e.target.value, 10))}
                              placeholder="0"
                              className="w-24 px-2.5 py-1.5 text-center font-bold text-xs border border-amber-300 bg-amber-50/30 text-amber-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </td>

                          {/* 7. Accepted Into Stock (Auto-calculated: Received Quantity - Damaged/Rejected) */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-black text-sm text-emerald-600 block">
                              +{accepted.toLocaleString()} {item.unit}
                            </span>
                            {damaged > 0 && (
                              <span className="text-[10px] text-amber-600 font-medium block">
                                ({damaged} rejected)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Delivery Notes / Remarks (Optional)
              </label>
              <textarea
                value={receiveRemarks}
                onChange={e => setReceiveRemarks(e.target.value)}
                rows={2}
                placeholder="Record carrier vehicle number, waybill/consignment details, or damage specifics..."
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceivingOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 5. Confirmation Dialog Before Saving Receipt                              */}
      {/* ========================================================================= */}
      {showConfirmModal && receivingOrder && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => {
            if (!isSubmitting) setShowConfirmModal(false);
          }}
          title="Confirm Goods Receipt"
          size="md"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-800">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
              <div className="text-xs">
                <p className="font-bold">Confirmation Required</p>
                <p className="mt-0.5 text-amber-700">
                  Please review carefully. Once saved, this receipt updates inventory stock and records a verified Goods Receipt Note.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Order Number:</span>
                <span className="font-mono font-bold text-slate-900">{receivingOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Supplier:</span>
                <span className="font-bold text-slate-900">{receivingOrder.supplierName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Destination Warehouse:</span>
                <span className="font-bold text-slate-900">
                  {warehouses?.find(w => w.id === receiveWarehouseId)?.name || receivingOrder.warehouseName}
                </span>
              </div>
              {receiveInvoiceNumber.trim() && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Supplier Invoice #:</span>
                  <span className="font-mono font-bold text-slate-800">{receiveInvoiceNumber.trim()}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Accepted Stock Addition:</span>
                <span className="font-bold text-emerald-600">
                  +{receivingOrder.items.reduce((sum, item) => {
                    const q = receiveQuantities[item.id] || { arrivedQty: 0, damagedQty: 0 };
                    return sum + Math.max(0, (Number(q.arrivedQty) || 0) - (Number(q.damagedQty) || 0));
                  }, 0).toLocaleString()} units
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Damaged / Rejected:</span>
                <span className="font-bold text-slate-600">
                  {receivingOrder.items.reduce((sum, item) => {
                    const q = receiveQuantities[item.id] || { arrivedQty: 0, damagedQty: 0 };
                    return sum + Math.max(0, Number(q.damagedQty) || 0);
                  }, 0).toLocaleString()} units (excluded from stock)
                </span>
              </div>
            </div>

            {/* Per-item Breakdown in Confirmation */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-center">Received</th>
                    <th className="py-2 px-3 text-center">Damaged</th>
                    <th className="py-2 px-3 text-right text-emerald-700 font-bold">Accepted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receivingOrder.items.map(it => {
                    const q = receiveQuantities[it.id] || { arrivedQty: 0, damagedQty: 0 };
                    const arrived = Number(q.arrivedQty) || 0;
                    const damaged = Number(q.damagedQty) || 0;
                    const accepted = Math.max(0, arrived - damaged);
                    return (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{it.productName}</td>
                        <td className="py-2 px-3 text-center font-medium text-slate-700">{arrived} {it.unit}</td>
                        <td className="py-2 px-3 text-center font-medium text-amber-700">{damaged > 0 ? `${damaged} ${it.unit}` : '0'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">+{accepted} {it.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Receipt...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Update Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
