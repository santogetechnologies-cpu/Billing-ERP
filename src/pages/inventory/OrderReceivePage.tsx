import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  Search,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Building2,
  Calendar,
  Eye,
  RefreshCw,
  FileText,
  ShieldCheck,
  X,
  Boxes,
  Layers,
  Tag
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { formatDate } from '../../utils/formatters';
import {
  orderReceiveService,
  OrderDeliveryStatus
} from '../../services/orderReceiveService';
import {
  SupplierDeliveryGroup,
  SupplierDeliveryProductItem,
  SupplierDeliveryStatus
} from '../../types';

export const OrderReceivePage: React.FC = () => {
  const {
    purchaseRequests,
    purchaseInvoices,
    suppliers,
    warehouses,
    products,
    recordSupplierDelivery,
    refreshData
  } = useERP();
  const { user, profile } = useAuth();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'AWAITING_RECEIPT' | 'ALL' | SupplierDeliveryStatus>('AWAITING_RECEIPT');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail Modal State (Eye Icon)
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<SupplierDeliveryGroup | null>(null);

  // Receive Form Modal State (Receive Button)
  const [receivingGroup, setReceivingGroup] = useState<SupplierDeliveryGroup | null>(null);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveInvoiceNumber, setReceiveInvoiceNumber] = useState('');
  const [receiveRemarks, setReceiveRemarks] = useState('');

  // Quantities & Tracking details per item: key is item.id (e.g. `${orderNumber}_${itemId}`)
  const [receiveItemState, setReceiveItemState] = useState<
    Record<
      string,
      {
        arrivedQty: number | string;
        damagedQty: number | string;
        batchNumber?: string;
        expiryDate?: string;
      }
    >
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Compute Supplier-Wise Delivery Groups
  const supplierGroups: SupplierDeliveryGroup[] = useMemo(() => {
    return orderReceiveService.getSupplierDeliveryGroups({
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

    supplierGroups.forEach(g => {
      if (g.deliveryStatus === 'Pending') pendingCount++;
      else if (g.deliveryStatus === 'Partially Received') partialCount++;
      else if (g.deliveryStatus === 'Received / Completed') completedCount++;

      if (g.isOverdue) overdueCount++;
    });

    const awaitingReceiptCount = pendingCount + partialCount;

    return {
      awaitingReceiptCount,
      pendingCount,
      partialCount,
      completedCount,
      overdueCount
    };
  }, [supplierGroups]);

  // Filtered Supplier Delivery Groups
  const filteredGroups = useMemo(() => {
    return supplierGroups.filter(group => {
      // Exclude empty delivery groups with 0 products or 0 ordered quantity
      if (!group.items || group.items.length === 0 || group.totalOrderedQuantity <= 0) {
        return false;
      }

      // Status filter
      if (statusFilter === 'AWAITING_RECEIPT') {
        if (group.deliveryStatus === 'Received / Completed' || group.totalOutstandingQuantity <= 0) {
          return false;
        }
      } else if (statusFilter === 'Pending') {
        if (group.deliveryStatus !== 'Pending' || group.totalOutstandingQuantity <= 0) {
          return false;
        }
      } else if (statusFilter === 'Partially Received') {
        if (group.deliveryStatus !== 'Partially Received' || group.totalOutstandingQuantity <= 0) {
          return false;
        }
      } else if (statusFilter === 'Received / Completed') {
        if (group.deliveryStatus !== 'Received / Completed' && group.totalOutstandingQuantity > 0) {
          return false;
        }
      }

      // Warehouse filter
      if (warehouseFilter !== 'ALL' && group.warehouseId !== warehouseFilter) {
        return false;
      }

      // Search term (searches across supplier, company, GSTIN, PO numbers, and product names)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesSupplier = group.supplierName.toLowerCase().includes(query);
        const matchesCompany = Boolean(group.supplierCompany && group.supplierCompany.toLowerCase().includes(query));
        const matchesGstin = Boolean(group.supplierGstin && group.supplierGstin.toLowerCase().includes(query));
        const matchesContact = group.supplierContact.toLowerCase().includes(query);
        const matchesPOs = group.purchaseOrderNumbers.some(po => po.toLowerCase().includes(query));
        const matchesProducts = group.items.some(
          it => it.productName.toLowerCase().includes(query) || it.sku.toLowerCase().includes(query)
        );
        const matchesInvoice = Boolean(group.supplierInvoiceNumber && group.supplierInvoiceNumber.toLowerCase().includes(query));

        if (!matchesSupplier && !matchesCompany && !matchesGstin && !matchesContact && !matchesPOs && !matchesProducts && !matchesInvoice) {
          return false;
        }
      }

      return true;
    });
  }, [supplierGroups, statusFilter, warehouseFilter, searchTerm]);

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

  // Open Receive Form Modal for a Supplier Delivery Group
  const handleOpenReceive = (group: SupplierDeliveryGroup) => {
    setReceivingGroup(group);
    setReceiveWarehouseId(group.warehouseId || (warehouses?.[0]?.id ?? ''));
    setReceiveInvoiceNumber(group.supplierInvoiceNumber || '');
    setReceiveRemarks('');
    setFormError(null);

    // Initialize item states:
    // Default arrived quantity to outstanding pending quantity
    const initialStates: Record<
      string,
      { arrivedQty: number | string; damagedQty: number | string; batchNumber?: string; expiryDate?: string }
    > = {};

    group.items.forEach(it => {
      initialStates[it.id] = {
        arrivedQty: it.pendingQty, // Defaults to remaining pending quantity
        damagedQty: 0,
        batchNumber: it.batchNumber || '',
        expiryDate: it.expiryDate || ''
      };
    });

    setReceiveItemState(initialStates);
  };

  // Update Arrived / Received Qty
  const handleArrivedQtyChange = (itemId: string, maxPending: number, rawVal: string | number) => {
    setFormError(null);
    if (rawVal === '') {
      setReceiveItemState(prev => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { damagedQty: 0 }),
          arrivedQty: ''
        }
      }));
      return;
    }

    const parsed = typeof rawVal === 'number' ? rawVal : parseInt(rawVal, 10);
    const validVal = isNaN(parsed) ? 0 : Math.max(0, parsed);

    // Prevent receiving more than the outstanding quantity
    if (maxPending > 0 && validVal > maxPending) {
      setFormError(`Received quantity cannot exceed outstanding pending quantity (${maxPending}).`);
    }

    const cappedVal = maxPending > 0 ? Math.min(validVal, maxPending) : validVal;

    setReceiveItemState(prev => {
      const current = prev[itemId] || { arrivedQty: 0, damagedQty: 0 };
      const currentDamaged = typeof current.damagedQty === 'number'
        ? current.damagedQty
        : (parseInt(String(current.damagedQty), 10) || 0);
      const adjustedDamaged = Math.min(currentDamaged, cappedVal);
      return {
        ...prev,
        [itemId]: {
          ...current,
          arrivedQty: cappedVal,
          damagedQty: adjustedDamaged
        }
      };
    });
  };

  // Update Damaged / Rejected Qty
  const handleDamagedQtyChange = (itemId: string, arrived: number, rawVal: string | number) => {
    setFormError(null);
    if (rawVal === '') {
      setReceiveItemState(prev => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { arrivedQty: arrived }),
          damagedQty: ''
        }
      }));
      return;
    }

    const parsed = typeof rawVal === 'number' ? rawVal : parseInt(rawVal, 10);
    const validVal = isNaN(parsed) ? 0 : Math.max(0, parsed);

    if (validVal > arrived) {
      setFormError(`Damaged quantity cannot exceed received quantity (${arrived}).`);
    }

    const cappedDamaged = Math.min(validVal, Math.max(0, arrived));

    setReceiveItemState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { arrivedQty: arrived }),
        damagedQty: cappedDamaged
      }
    }));
  };

  // Update Batch Number or Expiry Date
  const handleTrackingChange = (itemId: string, field: 'batchNumber' | 'expiryDate', value: string) => {
    setReceiveItemState(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { arrivedQty: 0, damagedQty: 0 }),
        [field]: value
      }
    }));
  };

  // Validate and Proceed to Confirmation
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingGroup) return;

    let totalArrived = 0;
    let hasOverReceipt = false;
    let overReceiptMessage = '';

    for (const it of receivingGroup.items) {
      const state = receiveItemState[it.id] || { arrivedQty: 0, damagedQty: 0 };
      const arrived = Math.max(0, Number(state.arrivedQty) || 0);
      const damaged = Math.max(0, Number(state.damagedQty) || 0);

      if (it.pendingQty > 0 && arrived > it.pendingQty) {
        hasOverReceipt = true;
        overReceiptMessage = `Received quantity for "${it.productName}" on PO #${it.orderNumber} (${arrived}) exceeds outstanding quantity (${it.pendingQty}).`;
        break;
      }

      if (damaged > arrived) {
        setFormError(`Damaged quantity cannot exceed received quantity for "${it.productName}".`);
        return;
      }

      // If batch tracking is required for this product and items arrived, check batch number
      if (it.requiresBatch && arrived > 0 && !state.batchNumber?.trim()) {
        setFormError(`Batch number is required for "${it.productName}" as it has batch tracking enabled.`);
        return;
      }

      totalArrived += arrived;
    }

    if (hasOverReceipt) {
      setFormError(overReceiptMessage);
      return;
    }

    if (totalArrived <= 0) {
      setFormError('Please enter at least one positive received quantity to record inward delivery.');
      return;
    }

    setFormError(null);
    setShowConfirmModal(true);
  };

  // Confirm and Submit Supplier Delivery Receipt
  const handleConfirmSubmit = async () => {
    if (!receivingGroup || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payloadItems = receivingGroup.items.map(it => {
        const state = receiveItemState[it.id] || { arrivedQty: 0, damagedQty: 0 };
        const arrived = Math.max(0, Number(state.arrivedQty) || 0);
        const damaged = Math.max(0, Number(state.damagedQty) || 0);
        const accepted = Math.max(0, arrived - damaged);

        return {
          itemId: it.itemId,
          orderId: it.orderId,
          purchaseOrderId: it.purchaseOrderId,
          purchaseRequestId: it.purchaseRequestId,
          productId: it.productId,
          arrivedQty: arrived,
          damagedQty: damaged,
          acceptedQty: accepted,
          batchNumber: state.batchNumber?.trim() || undefined,
          expiryDate: state.expiryDate || undefined
        };
      });

      // Submit supplier-wise delivery to ERPContext
      const res = await recordSupplierDelivery({
        supplierId: receivingGroup.supplierId,
        receivingWarehouseId: receiveWarehouseId || receivingGroup.warehouseId,
        supplierInvoiceNumber: receiveInvoiceNumber.trim() || undefined,
        deliveryRemarks: receiveRemarks.trim() || undefined,
        receivedItems: payloadItems
      });

      setShowConfirmModal(false);
      setReceivingGroup(null);
      setSuccessToast(
        `Supplier delivery successfully received for ${receivingGroup.supplierName}! ${res.totalAcceptedQty} units added to stock across ${res.updatedOrders.length} purchase orders.`
      );

      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    } catch (err: any) {
      console.error('Failed to confirm supplier delivery:', err);
      setFormError(err.message || 'Failed to record supplier delivery. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper badge renderers
  const renderStatusBadge = (status: SupplierDeliveryStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending</span>
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60">
            <Boxes className="w-3 h-3 text-blue-600" />
            <span>Partially Received</span>
          </span>
        );
      case 'Received / Completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 hover:bg-emerald-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>Inventory</span>
            <span>/</span>
            <span className="text-slate-800">Order Receive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <PackageCheck className="w-7 h-7 text-indigo-600 flex-shrink-0" />
            <span>Supplier Deliveries & Inward Goods</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Supplier-wise inward goods management: inspect and receive deliveries for multiple purchase orders in one action.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/90 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Refresh delivery status"
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
          onClick={() => setStatusFilter('AWAITING_RECEIPT')}
          role="button"
          tabIndex={0}
          className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs cursor-pointer select-none group ${
            statusFilter === 'AWAITING_RECEIPT'
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
              Active incoming supplier deliveries
            </p>
          </div>
        </div>

        {/* Pending Deliveries */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'AWAITING_RECEIPT' : 'Pending')}
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
          onClick={() => setStatusFilter(statusFilter === 'Partially Received' ? 'AWAITING_RECEIPT' : 'Partially Received')}
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
          onClick={() => setStatusFilter(statusFilter === 'Received / Completed' ? 'AWAITING_RECEIPT' : 'Received / Completed')}
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

      {/* Main Filter & Supplier Table Card */}
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
                placeholder="Search by supplier, PO#, GSTIN, or product..."
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

        {/* Supplier Delivery Groups Table: 100% width, no horizontal scrollbar */}
        <div className="w-full">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 sm:px-4 text-left w-[24%]">Supplier</th>
                <th className="py-3 px-2 sm:px-3 text-left w-[13%]">Warehouse</th>
                <th className="py-3 px-2 sm:px-3 text-left w-[18%]">Purchase Orders</th>
                <th className="py-3 px-2 sm:px-3 text-center w-[11%]">Products Pending</th>
                <th className="py-3 px-2 sm:px-3 text-right w-[12%]">Outstanding Qty</th>
                <th className="py-3 px-2 sm:px-3 text-left w-[11%]">Expected Delivery</th>
                <th className="py-3 px-2 sm:px-3 text-center w-[11%]">Delivery Status</th>
                <th className="py-3 px-2 sm:px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">No incoming supplier deliveries</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {statusFilter === 'AWAITING_RECEIPT'
                          ? 'All approved purchase orders have been received and added to stock.'
                          : searchTerm || warehouseFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or warehouse filter.'
                          : 'There are currently no purchase orders matching this status.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGroups.map(group => {
                  const isActionable = group.deliveryStatus !== 'Received / Completed' || group.totalOutstandingQuantity > 0;

                  return (
                    <tr key={group.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* 1. Supplier Information */}
                      <td className="py-3 px-3 sm:px-4 align-middle">
                        <div className="font-bold text-slate-900 text-sm truncate max-w-[200px]" title={group.supplierName}>
                          {group.supplierName || 'Supplier (Unassigned)'}
                        </div>
                        {group.supplierCompany && group.supplierCompany !== group.supplierName && (
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                            {group.supplierCompany}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 truncate max-w-[200px]">
                          {group.supplierGstin && (
                            <span className="font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                              GST: {group.supplierGstin}
                            </span>
                          )}
                          <span className="truncate">{group.supplierContact || 'No contact'}</span>
                        </div>
                      </td>

                      {/* 2. Destination Warehouse */}
                      <td className="py-3 px-2 sm:px-3 align-middle">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs truncate max-w-[130px]" title={group.warehouseName}>
                          <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">{group.warehouseName || 'Main'}</span>
                        </div>
                      </td>

                      {/* 3. Purchase Orders */}
                      <td className="py-3 px-2 sm:px-3 align-middle">
                        <div
                          className="flex items-center gap-1.5"
                          title={group.purchaseOrderNumbers.join(', ')}
                        >
                          {group.purchaseOrderNumbers.length === 0 ? (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          ) : (
                            <>
                              <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100/90 border border-slate-200/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                                {group.purchaseOrderNumbers[0]}
                              </span>
                              {group.purchaseOrderNumbers.length > 1 && (
                                <span
                                  className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/70 whitespace-nowrap cursor-help"
                                  title={group.purchaseOrderNumbers.slice(1).join(', ')}
                                >
                                  +{group.purchaseOrderNumbers.length - 1} more
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                          {group.purchaseOrdersCount} {group.purchaseOrdersCount === 1 ? 'order' : 'orders'}
                        </span>
                      </td>

                      {/* 4. Products Pending */}
                      <td className="py-3 px-2 sm:px-3 align-middle text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                          <span>{group.productsPendingCount}</span>
                          <span className="text-slate-500 font-medium text-[10px]">
                            {group.productsPendingCount === 1 ? 'item' : 'items'}
                          </span>
                        </span>
                      </td>

                      {/* 5. Total Outstanding Quantity */}
                      <td className="py-3 px-2 sm:px-3 align-middle text-right">
                        <span className="font-bold text-xs text-amber-700 block whitespace-nowrap">
                          {group.totalOutstandingQuantity.toLocaleString()} units
                        </span>
                        <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                          of {group.totalOrderedQuantity.toLocaleString()} total
                        </span>
                      </td>

                      {/* 6. Expected Delivery Date */}
                      <td className="py-3 px-2 sm:px-3 align-middle">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className={`text-xs ${group.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-medium'}`}>
                            {formatDate(group.expectedDeliveryDate) || 'Today'}
                          </span>
                        </div>
                        {group.isOverdue && (
                          <span className="inline-block text-[10px] text-rose-600 font-bold bg-rose-50 px-1 py-0.2 rounded mt-0.5 whitespace-nowrap">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* 7. Delivery Status */}
                      <td className="py-3 px-2 sm:px-3 align-middle text-center whitespace-nowrap">
                        {renderStatusBadge(group.deliveryStatus)}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-2 sm:px-3 align-middle text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Eye Button: View Supplier Delivery Details */}
                          <button
                            onClick={() => setSelectedDetailGroup(group)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors cursor-pointer"
                            title="View Supplier Delivery Details & Products"
                            aria-label="View Supplier Delivery Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Receive Delivery Button */}
                          {isActionable ? (
                            <button
                              onClick={() => handleOpenReceive(group)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="Receive Complete Supplier Delivery"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Receive</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 whitespace-nowrap">
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
      {/* 2. Eye Icon — View Supplier Delivery Details Modal                       */}
      {/* ========================================================================= */}
      {selectedDetailGroup && (
        <Modal
          isOpen={Boolean(selectedDetailGroup)}
          onClose={() => setSelectedDetailGroup(null)}
          title={`Supplier Delivery Overview — ${selectedDetailGroup.supplierName}`}
          size="2xl"
        >
          <div className="p-6 space-y-6">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Supplier Card */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <span>Supplier</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{selectedDetailGroup.supplierName}</div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p><span className="font-semibold text-slate-500">Contact:</span> {selectedDetailGroup.supplierContact}</p>
                  {selectedDetailGroup.supplierGstin && (
                    <p><span className="font-semibold text-slate-500">GSTIN:</span> {selectedDetailGroup.supplierGstin}</p>
                  )}
                  {selectedDetailGroup.supplierAddress && (
                    <p><span className="font-semibold text-slate-500">Address:</span> {selectedDetailGroup.supplierAddress}</p>
                  )}
                </div>
              </div>

              {/* Destination Warehouse Card */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <WarehouseIcon className="w-4 h-4 text-indigo-500" />
                  <span>Destination Warehouse</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{selectedDetailGroup.warehouseName}</div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p><span className="font-semibold text-slate-500">Expected:</span> {formatDate(selectedDetailGroup.expectedDeliveryDate)}</p>
                  <p><span className="font-semibold text-slate-500">Status:</span> {selectedDetailGroup.deliveryStatus}</p>
                </div>
              </div>

              {/* Quantities & Value Card */}
              <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  <span>Total Quantities</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ordered Qty:</span>
                    <span className="font-bold text-slate-900">{selectedDetailGroup.totalOrderedQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Previously Received:</span>
                    <span className="font-bold text-slate-700">{selectedDetailGroup.totalPreviouslyReceivedQuantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-amber-700">Outstanding:</span>
                    <span className="font-black text-amber-600 text-sm">{selectedDetailGroup.totalOutstandingQuantity.toLocaleString()} units</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Associated Purchase Orders List */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Associated Purchase Orders ({selectedDetailGroup.purchaseOrders.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                {selectedDetailGroup.purchaseOrders.map((po, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-indigo-600 block">{po.orderNumber}</span>
                      <span className="text-[10px] text-slate-400 block">{po.productsCount} products • {po.pendingQty} pending</span>
                    </div>
                    {renderStatusBadge(po.deliveryStatus)}
                  </div>
                ))}
              </div>
            </div>

            {/* Inward Products Table in View Details */}
            {selectedDetailGroup.items && selectedDetailGroup.items.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    All Products in Delivery ({selectedDetailGroup.items.length})
                  </h3>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3 whitespace-nowrap">PO Reference</th>
                          <th className="py-2.5 px-3">Product Name & SKU</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Unit</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Rate / Value</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Ordered Qty</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Previously Received</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Outstanding Qty</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Tracking</th>
                          <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {selectedDetailGroup.items.map(it => (
                          <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 whitespace-nowrap">
                              {it.orderNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{it.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {it.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="text-slate-600 font-medium">{it.unit}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-medium text-slate-800">₹{Number(it.rate || 0).toLocaleString()}</div>
                              {it.totalValue > 0 && (
                                <div className="text-[10px] text-slate-400">Total: ₹{Number(it.totalValue).toLocaleString()}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                              {it.orderedQty.toLocaleString()} {it.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-600 whitespace-nowrap">
                              {it.previouslyReceivedQty.toLocaleString()} {it.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className={`font-bold ${it.pendingQty > 0 ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60' : 'text-slate-400'}`}>
                                {it.pendingQty.toLocaleString()} {it.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {it.requiresBatch || it.requiresExpiry ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>{it.requiresExpiry ? 'Batch & Expiry' : 'Batch'}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Standard</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {renderStatusBadge(it.receivingStatus)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {selectedDetailGroup.totalOutstandingQuantity > 0 ? (
                  <span>
                    <span className="font-bold text-amber-600">{selectedDetailGroup.totalOutstandingQuantity.toLocaleString()} units</span> awaiting delivery confirmation
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> All goods in this supplier delivery are accounted for
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDetailGroup(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {(selectedDetailGroup.deliveryStatus !== 'Received / Completed' || selectedDetailGroup.totalOutstandingQuantity > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const grp = selectedDetailGroup;
                      setSelectedDetailGroup(null);
                      handleOpenReceive(grp);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Receive Delivery</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 3. Receive Goods — Supplier Delivery Receiving Form Modal                */}
      {/* ========================================================================= */}
      {receivingGroup && (
        <Modal
          isOpen={Boolean(receivingGroup)}
          onClose={() => setReceivingGroup(null)}
          title={`Receive Supplier Delivery — ${receivingGroup.supplierName}`}
          size="2xl"
        >
          <form onSubmit={handleProceedToConfirm} className="p-6 space-y-6">
            {/* Overview Banner */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Supplier Delivery
                </span>
                <span className="text-sm font-black text-slate-900">{receivingGroup.supplierName}</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 max-h-24 overflow-y-auto">
                  <span className="text-xs text-slate-500 font-medium">Purchase Orders:</span>
                  {receivingGroup.purchaseOrderNumbers.slice(0, 4).map((p, idx) => (
                    <span key={idx} className="font-mono text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-700 whitespace-nowrap">
                      {p}
                    </span>
                  ))}
                  {receivingGroup.purchaseOrderNumbers.length > 4 && (
                    <span
                      className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded border border-indigo-200 whitespace-nowrap"
                      title={receivingGroup.purchaseOrderNumbers.slice(4).join(', ')}
                    >
                      +{receivingGroup.purchaseOrderNumbers.length - 4} more
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Outstanding Quantity
                </span>
                <span className="text-lg font-black text-amber-600">
                  {receivingGroup.totalOutstandingQuantity.toLocaleString()} units remaining
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
                  Supplier Invoice / Delivery Challan #
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

            {/* Product Quantities Entry Table across all POs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Record Inward Products ({receivingGroup.items.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Stock increases only for <span className="font-bold text-emerald-600">Accepted Qty</span>
                </span>
              </div>

              <div className="border border-slate-200/90 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-left">PO #</th>
                      <th className="py-2.5 px-3 text-left">Product Name</th>
                      <th className="py-2.5 px-3 text-right">Ordered</th>
                      <th className="py-2.5 px-3 text-right">Prev. Recv</th>
                      <th className="py-2.5 px-3 text-right">Pending</th>
                      <th className="py-2.5 px-3 text-center w-28">Received Qty</th>
                      <th className="py-2.5 px-3 text-center w-32">Damaged Qty</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-700">Accepted</th>
                      <th className="py-2.5 px-3 text-left">Batch / Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {receivingGroup.items.map(item => {
                      const itemState = receiveItemState[item.id] || { arrivedQty: 0, damagedQty: 0 };
                      const arrived = Number(itemState.arrivedQty) || 0;
                      const damaged = Number(itemState.damagedQty) || 0;
                      const accepted = Math.max(0, arrived - damaged);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          {/* 1. PO Number */}
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 whitespace-nowrap">
                            {item.orderNumber}
                          </td>

                          {/* 2. Product Name */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku} • {item.unit}
                            </div>
                          </td>

                          {/* 3. Ordered Quantity (Read-only, determined by Purchase Manager) */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-block font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200/60">
                              {item.orderedQty.toLocaleString()}
                            </span>
                          </td>

                          {/* 4. Previously Received (Read-only) */}
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                            {item.previouslyReceivedQty.toLocaleString()}
                          </td>

                          {/* 5. Pending Quantity (Read-only) */}
                          <td className="py-2.5 px-3 text-right font-bold text-amber-600">
                            {item.pendingQty.toLocaleString()}
                          </td>

                          {/* 6. Received Quantity (Warehouse Manager Input) */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.pendingQty > 0 ? item.pendingQty : undefined}
                              value={itemState.arrivedQty === '' ? '' : itemState.arrivedQty}
                              onChange={e => handleArrivedQtyChange(item.id, item.pendingQty, e.target.value)}
                              placeholder="0"
                              className="w-24 px-2.5 py-1.5 text-center font-bold text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </td>

                          {/* 7. Damaged / Rejected Quantity (Warehouse Manager Input) */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={arrived}
                              value={itemState.damagedQty === '' ? '' : itemState.damagedQty}
                              onChange={e => handleDamagedQtyChange(item.id, arrived, e.target.value)}
                              placeholder="0"
                              className="w-24 px-2.5 py-1.5 text-center font-bold text-xs border border-amber-300 bg-amber-50/30 text-amber-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </td>

                          {/* 8. Accepted Into Stock */}
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-black text-sm text-emerald-600 block">
                              +{accepted.toLocaleString()}
                            </span>
                            {damaged > 0 && (
                              <span className="text-[10px] text-amber-600 font-medium block">
                                ({damaged} rejected)
                              </span>
                            )}
                          </td>

                          {/* 9. Batch & Expiry (Rendered where applicable) */}
                          <td className="py-2.5 px-3">
                            {item.requiresBatch || item.requiresExpiry ? (
                              <div className="space-y-1 w-36">
                                {item.requiresBatch && (
                                  <input
                                    type="text"
                                    value={itemState.batchNumber || ''}
                                    onChange={e => handleTrackingChange(item.id, 'batchNumber', e.target.value)}
                                    placeholder="Batch # *"
                                    className="w-full px-2 py-1 text-[11px] font-mono border border-slate-300 rounded bg-white"
                                  />
                                )}
                                {item.requiresExpiry && (
                                  <input
                                    type="date"
                                    value={itemState.expiryDate || ''}
                                    onChange={e => handleTrackingChange(item.id, 'expiryDate', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] font-mono border border-slate-300 rounded bg-white"
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">N/A</span>
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
                Delivery Remarks / Carrier Notes
              </label>
              <textarea
                value={receiveRemarks}
                onChange={e => setReceiveRemarks(e.target.value)}
                placeholder="e.g. Received intact from transporter carrier, invoice copy verified..."
                rows={2}
                className="w-full px-3 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceivingGroup(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Review & Confirm Receiving</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 4. Review & Confirm Receiving Modal                                      */}
      {/* ========================================================================= */}
      {showConfirmModal && receivingGroup && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Review & Confirm Supplier Delivery Receipt"
          size="lg"
        >
          <div className="p-6 space-y-5">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Supplier:</span>
                <span className="font-bold text-slate-900">{receivingGroup.supplierName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Destination Warehouse:</span>
                <span className="font-bold text-slate-900">
                  {warehouses?.find(w => w.id === receiveWarehouseId)?.name || receivingGroup.warehouseName}
                </span>
              </div>
              {receiveInvoiceNumber.trim() && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Supplier Invoice / Challan #:</span>
                  <span className="font-mono font-bold text-slate-800">{receiveInvoiceNumber.trim()}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Accepted Stock Addition:</span>
                <span className="font-bold text-emerald-600">
                  +{receivingGroup.items.reduce((sum, item) => {
                    const st = receiveItemState[item.id] || { arrivedQty: 0, damagedQty: 0 };
                    return sum + Math.max(0, (Number(st.arrivedQty) || 0) - (Number(st.damagedQty) || 0));
                  }, 0).toLocaleString()} units
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Damaged / Rejected:</span>
                <span className="font-bold text-slate-600">
                  {receivingGroup.items.reduce((sum, item) => {
                    const st = receiveItemState[item.id] || { arrivedQty: 0, damagedQty: 0 };
                    return sum + Math.max(0, Number(st.damagedQty) || 0);
                  }, 0).toLocaleString()} units (excluded from stock)
                </span>
              </div>
            </div>

            {/* Per-item Breakdown in Confirmation */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-60 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">PO #</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-center">Arrived</th>
                    <th className="py-2 px-3 text-center">Damaged</th>
                    <th className="py-2 px-3 text-right text-emerald-700 font-bold">Accepted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receivingGroup.items.map(it => {
                    const st = receiveItemState[it.id] || { arrivedQty: 0, damagedQty: 0 };
                    const arrived = Number(st.arrivedQty) || 0;
                    const damaged = Number(st.damagedQty) || 0;
                    const accepted = Math.max(0, arrived - damaged);
                    return (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-600">{it.orderNumber}</td>
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
                    <span>Saving Receipt & Updating Stock...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Receive Delivery</span>
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
