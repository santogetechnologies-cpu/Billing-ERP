import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  TrendingUp,
  Building2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X,
  Truck,
  ScanBarcode,
  Package,
  Layers,
  ArrowRight,
  ClipboardList,
  Calendar,
  Warehouse as WarehouseIcon,
  HelpCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { UserProfileModal } from '../../components/auth/UserProfileModal';
import { ApprovePurchaseRequestModal } from '../../components/purchases/ApprovePurchaseRequestModal';
import { ActiveOrdersModal } from '../../components/purchases/ActiveOrdersModal';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { canManageBarcodeOverride } from '../../utils/rbac';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../../utils/schemaDetector';
import {
  PurchaseRequest,
  PurchaseInvoice,
  Product,
  Supplier,
  Warehouse as WarehouseModel,
  PurchaseRequestStatus
} from '../../types';

export interface SupplierDeliveryItem {
  supplierId: string;
  supplierName: string;
  contact: string;
  activeOrders: number;
  itemsToDeliver: number;
  expectedDelivery: string;
  deliveryStatus: 'Pending' | 'In Transit' | 'Partially Delivered' | 'Overdue' | 'Delivered';
  isOverdue: boolean;
  supplierStatus: 'Active' | 'Inactive';
}

/**
 * Computes live supplier delivery overview telemetry from database supplier master records,
 * purchase orders, and linked procurement requests.
 */
export function computeSupplierDeliveries(params: {
  suppliers: Supplier[];
  purchaseOrders: any[];
  purchaseRequests: PurchaseRequest[];
  todayStr?: string;
}): SupplierDeliveryItem[] {
  const { suppliers, purchaseOrders, purchaseRequests, todayStr } = params;
  const today = todayStr || new Date().toISOString().split('T')[0];

  const supplierMap = new Map<string, {
    supplierId: string;
    supplierName: string;
    contact: string;
    activeOrders: number;
    itemsToDeliver: number;
    expectedDates: string[];
    hasPartiallyDelivered: boolean;
    hasInTransit: boolean;
    hasPending: boolean;
    hasOverdue: boolean;
  }>();

  // Initialize with registered suppliers
  (suppliers || []).forEach(sup => {
    const contact = (sup.phone && sup.phone.trim()) || (sup.email && sup.email.trim()) || 'Not available';
    supplierMap.set(sup.id, {
      supplierId: sup.id,
      supplierName: sup.name,
      contact,
      activeOrders: 0,
      itemsToDeliver: 0,
      expectedDates: [],
      hasPartiallyDelivered: false,
      hasInTransit: false,
      hasPending: false,
      hasOverdue: false
    });
  });

  const getOrCreateSupplierEntry = (suppId?: string | null, suppName?: string | null) => {
    if (suppId && supplierMap.has(suppId)) {
      return supplierMap.get(suppId)!;
    }
    if (suppName) {
      const match = Array.from(supplierMap.values()).find(
        s => s.supplierName.trim().toLowerCase() === suppName.trim().toLowerCase()
      );
      if (match) return match;
    }
    const newId = suppId || (suppName ? `sup-${suppName.toLowerCase().replace(/\s+/g, '-')}` : 'unknown-supplier');
    const name = suppName || 'Unknown Supplier';
    const entry = {
      supplierId: newId,
      supplierName: name,
      contact: 'Not available',
      activeOrders: 0,
      itemsToDeliver: 0,
      expectedDates: [],
      hasPartiallyDelivered: false,
      hasInTransit: false,
      hasPending: false,
      hasOverdue: false
    };
    supplierMap.set(newId, entry);
    return entry;
  };

  const processedOrderKeys = new Set<string>();

  // Process purchase_orders / purchases
  (purchaseOrders || []).forEach(po => {
    const orderKey = po.order_number || po.invoice_number || po.id;
    if (orderKey) processedOrderKeys.add(String(orderKey).trim().toLowerCase());

    const entry = getOrCreateSupplierEntry(po.supplier_id || po.supplierId, po.supplier_name || po.supplierName);
    const rawStatus = (po.status || 'Ordered').trim();
    const statusLower = rawStatus.toLowerCase();

    let orderedQty = 0;
    let receivedQty = 0;

    const items = po.purchase_order_items || po.items || [];
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((it: any) => {
        const oq = Number(it.qty || it.orderedQty || it.requestedQty || 0);
        const rq = Number(it.receivedQty || it.received_qty || 0);
        orderedQty += oq;
        receivedQty += rq;
      });
    } else {
      orderedQty = Number(po.qty || 1);
      receivedQty = Number(po.received_qty || 0);
    }

    const pendingQty = Math.max(0, orderedQty - receivedQty);
    const isCompleted = statusLower === 'completed' || statusLower === 'delivered' || (orderedQty > 0 && pendingQty === 0);
    const isCancelled = statusLower === 'cancelled' || statusLower === 'rejected';

    if (isCancelled || isCompleted) return;

    entry.activeOrders += 1;
    entry.itemsToDeliver += pendingQty;

    const expDate = po.expected_delivery || po.due_date || po.expectedDelivery;
    if (expDate && typeof expDate === 'string' && expDate.trim()) {
      const cleanDate = expDate.trim().split('T')[0];
      entry.expectedDates.push(cleanDate);
      if (cleanDate < today && pendingQty > 0) {
        entry.hasOverdue = true;
      }
    }

    if (receivedQty > 0 && pendingQty > 0) {
      entry.hasPartiallyDelivered = true;
    } else if (statusLower === 'in transit' || statusLower === 'in_transit') {
      entry.hasInTransit = true;
    } else {
      entry.hasPending = true;
    }
  });

  // Process purchaseRequests in 'Ordered' or 'Partially Received' state
  (purchaseRequests || []).forEach(req => {
    const poNum = req.purchaseOrderNumber || req.purchaseOrderId;
    if (poNum && processedOrderKeys.has(String(poNum).trim().toLowerCase())) {
      return;
    }

    const statusLower = (req.status || '').toLowerCase();
    const isOrdered = statusLower === 'ordered' || statusLower === 'partially received';
    if (!isOrdered) return;

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

    const entry = getOrCreateSupplierEntry(null, suppName);

    let orderedQty = 0;
    let receivedQty = 0;
    (req.items || []).forEach(it => {
      const targetQty = it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty;
      orderedQty += Number(targetQty || 0);
      receivedQty += Number(it.receivedQty || 0);
    });

    const pendingQty = Math.max(0, orderedQty - receivedQty);
    if (pendingQty > 0 || statusLower === 'ordered') {
      entry.activeOrders += 1;
      entry.itemsToDeliver += pendingQty;

      if (req.requestedDeliveryDate) {
        const cleanDate = req.requestedDeliveryDate.split('T')[0];
        entry.expectedDates.push(cleanDate);
        if (cleanDate < today && pendingQty > 0) {
          entry.hasOverdue = true;
        }
      }

      if (receivedQty > 0 && pendingQty > 0) {
        entry.hasPartiallyDelivered = true;
      } else {
        entry.hasPending = true;
      }
    }
  });

  const results: SupplierDeliveryItem[] = Array.from(supplierMap.values()).map(e => {
    let expectedDelivery = 'Not available';
    if (e.expectedDates.length > 0) {
      const sorted = [...e.expectedDates].sort();
      expectedDelivery = sorted[0];
    }

    let deliveryStatus: 'Pending' | 'In Transit' | 'Partially Delivered' | 'Overdue' | 'Delivered' = 'Delivered';
    if (e.hasOverdue) {
      deliveryStatus = 'Overdue';
    } else if (e.hasPartiallyDelivered) {
      deliveryStatus = 'Partially Delivered';
    } else if (e.hasInTransit) {
      deliveryStatus = 'In Transit';
    } else if (e.activeOrders > 0) {
      deliveryStatus = 'Pending';
    } else {
      deliveryStatus = 'Delivered';
    }

    const supplierStatus: 'Active' | 'Inactive' = (e.activeOrders > 0 || e.itemsToDeliver > 0) ? 'Active' : 'Inactive';

    return {
      supplierId: e.supplierId,
      supplierName: e.supplierName,
      contact: e.contact,
      activeOrders: e.activeOrders,
      itemsToDeliver: e.itemsToDeliver,
      expectedDelivery,
      deliveryStatus,
      isOverdue: e.hasOverdue,
      supplierStatus
    };
  });

  return results.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.activeOrders > 0 && b.activeOrders === 0) return -1;
    if (a.activeOrders === 0 && b.activeOrders > 0) return 1;
    return a.supplierName.localeCompare(b.supplierName);
  });
}

/**
 * Validates whether a purchase request status represents an item awaiting Purchase Manager review/action.
 * Includes initial submissions ('Pending Approval'), alternate pending reviews ('Pending Review'),
 * active evaluations ('Under Review'), and queries in clarification ('Clarification Requested').
 */
export const isAwaitingPurchaseManagerReview = (status: string | PurchaseRequestStatus): boolean => {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === 'pending approval' ||
    s === 'pending review' ||
    s === 'under review' ||
    s === 'clarification requested'
  );
};

/**
 * Role-based visibility check for the Low Stock Items dashboard card.
 * The Low Stock Items card is completely hidden for the Purchase Manager role,
 * while remaining visible and functional for Owner, Admin, and Warehouse Manager.
 */
export const shouldShowLowStockCard = (role?: string | null): boolean => {
  if (!role) return false;
  return role !== 'Purchase Manager';
};

export interface ActiveInTransitOrder {
  id: string;
  orderNumber: string;
  date: string;
  supplierName: string;
  warehouseName: string;
  totalItems: number;
  orderedQty: number;
  receivedQty: number;
  status: 'Ordered' | 'In Transit' | 'Partially Received';
}

/**
 * Compiles active purchase orders currently in transit from suppliers to destination warehouses.
 * Filters out completed, cancelled, delivered, or unrelated purchase orders.
 */
export function computeActiveInTransitOrders(params: {
  purchaseOrders: any[];
  purchaseRequests: PurchaseRequest[];
  suppliers: Supplier[];
  warehouses: WarehouseModel[];
  todayStr?: string;
}): ActiveInTransitOrder[] {
  const { purchaseOrders, purchaseRequests, suppliers, warehouses, todayStr } = params;
  const today = todayStr || new Date().toISOString().split('T')[0];
  const results: ActiveInTransitOrder[] = [];
  const processedKeys = new Set<string>();

  // 1. Process Database Orders (from purchase_orders or purchases)
  (purchaseOrders || []).forEach(po => {
    const orderNum = po.order_number || po.invoice_number || po.id;
    if (!orderNum) return;
    const key = String(orderNum).trim().toLowerCase();
    if (processedKeys.has(key)) return;
    processedKeys.add(key);

    const matchedSupp = suppliers.find(
      s => s.id === po.supplier_id || (po.supplier_name && s.name.toLowerCase() === po.supplier_name.toLowerCase())
    );
    const supplierName = po.supplier_name || matchedSupp?.name || 'Authorized Supplier';

    const rawStatus = (po.status || 'Ordered').trim();
    let normalizedStatus: 'Ordered' | 'In Transit' | 'Partially Received' | 'Completed' | 'Cancelled' = 'Ordered';
    const sLower = rawStatus.toLowerCase();
    if (sLower === 'completed' || sLower === 'delivered') normalizedStatus = 'Completed';
    else if (sLower === 'partially received' || sLower === 'partially_received') normalizedStatus = 'Partially Received';
    else if (sLower === 'in transit' || sLower === 'in_transit') normalizedStatus = 'In Transit';
    else if (sLower === 'cancelled' || sLower === 'rejected') normalizedStatus = 'Cancelled';

    const itemsRaw = po.purchase_order_items || po.items || [];
    let totalQty = 0;
    let receivedQty = 0;
    let totalItems = 0;

    if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
      totalItems = itemsRaw.length;
      itemsRaw.forEach((it: any) => {
        const oq = Number(it.qty || it.quantity || it.orderedQty || it.requestedQty || 0);
        const rq = Number(it.receivedQty || it.received_qty || 0);
        totalQty += oq;
        receivedQty += rq;
      });
    } else {
      totalItems = 1;
      totalQty = Number(po.qty || 1);
      receivedQty = Number(po.received_qty || 0);
    }

    const pendingQty = Math.max(0, totalQty - receivedQty);
    if (pendingQty === 0 && totalQty > 0 && normalizedStatus !== 'Cancelled') {
      normalizedStatus = 'Completed';
    }

    // Filter: Display only active purchase orders currently in transit
    // Exclude completed, cancelled, or delivered purchase orders
    if (normalizedStatus === 'Completed' || normalizedStatus === 'Cancelled') {
      return;
    }

    const matchedWh = warehouses.find(
      w => w.id === po.warehouse_id || (po.warehouse_name && w.name.toLowerCase() === po.warehouse_name.toLowerCase())
    );
    const warehouseName = po.warehouse_name || matchedWh?.name || po.warehouse || 'Central Distribution Godown';

    results.push({
      id: po.id || `po-${orderNum}`,
      orderNumber: String(orderNum),
      date: po.date || po.created_at?.split('T')[0] || today,
      supplierName,
      warehouseName,
      totalItems,
      orderedQty: totalQty,
      receivedQty,
      status: normalizedStatus as 'Ordered' | 'In Transit' | 'Partially Received'
    });
  });

  // 2. Process Purchase Requests in Ordered / In Transit / Partially Received state
  (purchaseRequests || []).forEach(req => {
    const orderNum = req.purchaseOrderNumber || req.purchaseOrderId;
    const statusLower = (req.status || '').toLowerCase();
    const isOrderStage =
      statusLower === 'ordered' ||
      statusLower === 'partially received';

    if (!isOrderStage) return;

    const orderKey = orderNum ? String(orderNum).trim().toLowerCase() : `req-${req.id}`;
    if (processedKeys.has(orderKey)) {
      return;
    }
    processedKeys.add(orderKey);

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

    let totalQty = 0;
    let receivedQty = 0;
    const itemsList = req.items || [];
    const totalItems = itemsList.length > 0 ? itemsList.length : 1;

    itemsList.forEach(it => {
      const oq = Number(it.approvedQty !== null && it.approvedQty !== undefined ? it.approvedQty : it.requestedQty || 0);
      const rq = Number(it.receivedQty || 0);
      totalQty += oq;
      receivedQty += rq;
    });

    const pendingQty = Math.max(0, totalQty - receivedQty);
    if (pendingQty === 0 && totalQty > 0) {
      return;
    }

    let normalizedStatus: 'Ordered' | 'In Transit' | 'Partially Received' = 'Ordered';
    if (statusLower === 'partially received' || (receivedQty > 0 && pendingQty > 0)) {
      normalizedStatus = 'Partially Received';
    } else {
      normalizedStatus = 'Ordered';
    }

    const matchedWh = warehouses.find(w => w.id === req.warehouseId);
    const warehouseName = req.warehouseName || matchedWh?.name || 'Central Distribution Godown';

    results.push({
      id: req.purchaseOrderId || `po-${req.id}`,
      orderNumber: req.purchaseOrderNumber || `PO-${req.requestNumber.replace('PR-', '')}`,
      date: req.createdAt ? req.createdAt.split('T')[0] : today,
      supplierName,
      warehouseName,
      totalItems,
      orderedQty: totalQty,
      receivedQty,
      status: normalizedStatus
    });
  });

  return results.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

export const PurchaseManagerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const showLowStockCard = shouldShowLowStockCard(profile?.role);
  const {
    company,
    purchaseRequests,
    purchaseInvoices,
    suppliers,
    products,
    warehouses,
    updatePurchaseRequestStatus,
    refreshPurchaseRequests,
    refreshData,
    isLoading: contextLoading,
    error: contextError
  } = useERP();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review & Approval Modal state
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Current localized date string
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);


  const displayName = useMemo(() => {
    if (profile?.full_name && profile.full_name.trim() !== '') {
      return profile.full_name;
    }
    const raw = user?.email?.split('@')[0] || '';
    return raw || 'Purchase Manager';
  }, [profile?.full_name, user?.email]);

  // State for purchase orders fetched from database
  const [purchaseOrdersData, setPurchaseOrdersData] = useState<any[]>([]);
  const [isPurchaseOrdersLoading, setIsPurchaseOrdersLoading] = useState(false);
  const [isActiveOrdersModalOpen, setIsActiveOrdersModalOpen] = useState(false);

  const fetchPurchaseOrders = useCallback(async () => {
    const targetCompId = company?.id || '00000000-0000-0000-0000-000000000001';
    setIsPurchaseOrdersLoading(true);
    if (!isTableMarkedMissing('purchase_orders')) {
      try {
        const { data: poData, error: poErr } = await supabase
          .from('purchase_orders')
          .select('*, purchase_order_items(*)')
          .eq('company_id', targetCompId)
          .order('created_at', { ascending: false });

        if (!poErr && poData) {
          setPurchaseOrdersData(poData);
          setIsPurchaseOrdersLoading(false);
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
        setPurchaseOrdersData(pData);
      }
    } catch {} finally {
      setIsPurchaseOrdersLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  // Manual Refresh Handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      if (refreshPurchaseRequests) {
        await refreshPurchaseRequests();
      }
      if (refreshData) {
        await refreshData();
      }
      await fetchPurchaseOrders();
    } catch (err: any) {
      console.warn('Dashboard refresh warning:', err);
      setErrorMessage(err?.message || 'Failed to refresh procurement records. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshPurchaseRequests, refreshData, fetchPurchaseOrders]);

  // Synchronize freshest purchase requests on dashboard mount (single run per mount)
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    let isMounted = true;
    const syncRequests = async () => {
      try {
        if (refreshPurchaseRequests) {
          await refreshPurchaseRequests();
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Dashboard mount purchase request fetch warning:', err);
        }
      }
    };
    syncRequests();
    return () => {
      isMounted = false;
    };
  }, [refreshPurchaseRequests]);

  // Supplier Delivery Overview Telemetry
  const supplierDeliveries = useMemo(() => {
    const ordersList = purchaseOrdersData.length > 0
      ? purchaseOrdersData
      : purchaseInvoices.filter(p => p.docType === 'purchase_order');

    return computeSupplierDeliveries({
      suppliers,
      purchaseOrders: ordersList,
      purchaseRequests
    });
  }, [suppliers, purchaseOrdersData, purchaseInvoices, purchaseRequests]);

  const totalActiveDeliveries = useMemo(() => {
    return supplierDeliveries.reduce((sum, s) => sum + s.activeOrders, 0);
  }, [supplierDeliveries]);

  // Active purchase orders currently in transit
  const activeInTransitOrders = useMemo(() => {
    const ordersList = purchaseOrdersData.length > 0
      ? purchaseOrdersData
      : purchaseInvoices.filter(p => p.docType === 'purchase_order');

    return computeActiveInTransitOrders({
      purchaseOrders: ordersList,
      purchaseRequests,
      suppliers,
      warehouses
    });
  }, [purchaseOrdersData, purchaseInvoices, purchaseRequests, suppliers, warehouses]);

  // 1. KPI Metrics
  const metrics = useMemo(() => {
    // Current month identifier
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Spend this month
    const thisMonthInvoices = purchaseInvoices.filter(inv => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const monthSpend = thisMonthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    // Pending requests awaiting review / approval (sorted newest first)
    const pendingRequests = purchaseRequests
      .filter(r => isAwaitingPurchaseManagerReview(r.status))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Low stock products needing replenishment
    const lowStockItems = products.filter(p => {
      const limit = p.stockWarningLimit ?? p.reorderLevel;
      return limit !== null && limit !== undefined && p.currentStock <= limit;
    });

    // Active suppliers count: vendors with pending delivery obligations
    const activeSuppliersCount = supplierDeliveries.filter(s => s.supplierStatus === 'Active').length;

    return {
      monthSpend,
      monthInvoicesCount: thisMonthInvoices.length,
      pendingRequestsCount: pendingRequests.length,
      pendingRequestsList: pendingRequests,
      activeOrdersCount: activeInTransitOrders.length,
      lowStockCount: lowStockItems.length,
      lowStockList: lowStockItems.slice(0, 5),
      activeSuppliersCount
    };
  }, [purchaseRequests, purchaseInvoices, products, supplierDeliveries, activeInTransitOrders]);

  // Recent Invoices (Latest 5)
  const recentInvoices = useMemo(() => {
    return [...purchaseInvoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [purchaseInvoices]);

  // Quick Approve Handler
  const handleApproveConfirm = async () => {
    if (!selectedRequest) return;
    setIsSubmittingAction(true);
    setErrorMessage(null);
    try {
      await updatePurchaseRequestStatus({
        requestId: selectedRequest.id,
        status: 'Approved',
        comments: approvalNotes.trim() || 'Approved by Purchase Manager'
      });
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
      setApprovalNotes('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to approve purchase request.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Rejection Handler
  const handleRejectConfirm = async () => {
    if (!selectedRequest || !rejectionReason.trim()) return;
    setIsSubmittingAction(true);
    setErrorMessage(null);
    try {
      await updatePurchaseRequestStatus({
        requestId: selectedRequest.id,
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        comments: `Rejected by Purchase Manager: ${rejectionReason.trim()}`
      });
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reject purchase request.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header */}
      <div className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left Column: Breadcrumb & Date (Row 1), Title & Subtitle (Row 2) */}
        <div className="min-w-0 space-y-1">
          {/* Breadcrumb & Date Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium flex-wrap">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Dashboard</span>
              <span>/</span>
              <span className="text-slate-600 font-semibold">Procurement Operations</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 text-[11px] font-medium border border-slate-200/60 shrink-0">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{formattedToday}</span>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              Purchase Manager Dashboard
            </h1>
            <p className="text-xs text-slate-500 max-w-xl mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">{company.name || 'Universal ERP Enterprise'}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{formattedToday}</span>
            </p>
          </div>
        </div>

        {/* Right Column: Action Controls Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 shrink-0"
            title="Refresh Procurement Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* User Profile Menu Button */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="h-9 flex items-center gap-2 pl-2 pr-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs shrink-0"
            title="View Profile"
          >
            <div className="w-5 h-5 rounded-lg bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {(profile?.full_name || user?.email || 'P')[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
              {displayName}
            </span>
          </button>

          {canManageBarcodeOverride(profile?.role) && (
            <button
              onClick={() => navigate('/purchases/barcode-management')}
              className="h-9 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Assign or override supplier barcodes"
            >
              <ScanBarcode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Barcode Override</span>
            </button>
          )}

          {/* New Purchase Bill Button */}
          <button
            onClick={() => navigate('/purchases/new')}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Create new vendor purchase bill"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* Error Alert with Retry */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Procurement Summary KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showLowStockCard ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <StatCard
          title="Pending Requests"
          value={formatNumber(metrics.pendingRequestsCount)}
          subtitle="Warehouse PRs awaiting review"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => navigate('/purchases/requests?status=Pending+Review')}
        />
        <StatCard
          title="Month Purchases"
          value={formatCurrency(metrics.monthSpend)}
          subtitle={`${metrics.monthInvoicesCount} vendor invoices recorded`}
          icon={TrendingUp}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={() => navigate('/purchases')}
        />
        <StatCard
          title="Active Orders"
          value={formatNumber(metrics.activeOrdersCount)}
          subtitle="Purchase orders in-transit"
          icon={Truck}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => setIsActiveOrdersModalOpen(true)}
        />
        <StatCard
          title="Active Suppliers"
          value={formatNumber(metrics.activeSuppliersCount)}
          subtitle="Registered vendor directory"
          icon={Building2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => navigate('/suppliers')}
        />
        {showLowStockCard && (
          <StatCard
            title="Low Stock Items"
            value={formatNumber(metrics.lowStockCount)}
            subtitle="Catalog items below warning limits"
            icon={AlertTriangle}
            iconBgColor="bg-rose-50"
            iconTextColor="text-rose-600"
            onClick={() => navigate('/inventory/alerts')}
          />
        )}
      </div>



      {/* 3. Action Required: Pending Purchase Requests Section */}
      <div id="pending-requests-section" className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              <span>Pending Purchase Requests Awaiting Your Review</span>
              {metrics.pendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {metrics.pendingRequestsCount} Actionable
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review stock replenishment requests from warehouse managers, verify requested quantities, and approve for PO creation.
            </p>
          </div>

          <button
            onClick={() => navigate('/purchases/requests')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Requests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {contextLoading || isRefreshing ? (
          <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading procurement requests...</span>
          </div>
        ) : (contextError || errorMessage) ? (
          <div className="p-8 text-center bg-rose-50/40 border-t border-rose-100">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Failed to Load Purchase Requests</p>
            <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">
              {errorMessage || contextError || 'Unable to retrieve pending requests. Please check your network connection.'}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : metrics.pendingRequestsList.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">All Clear! No Pending Requests</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              There are currently no warehouse replenishment requests awaiting review. Warehouse managers submit new requests as stock levels deplete.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Request # & Date</th>
                  <th className="py-3 px-4">Requested Product & Qty</th>
                  <th className="py-3 px-4">Warehouse Hub</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Estimated Cost</th>
                  <th className="py-3 px-4 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.pendingRequestsList.slice(0, 8).map(req => {
                  const itemsCount = req.items?.length || 0;
                  const firstItem = req.items?.[0];
                  const otherItemsCount = itemsCount - 1;
                  const estCost = req.items?.reduce((sum, it) => sum + ((it.estimatedCost ?? 0) * (it.requestedQty || 0)), 0) || 0;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-600 block">
                          #{req.requestNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(req.createdAt)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {firstItem ? (
                          <div>
                            <span className="font-semibold text-slate-900 block truncate max-w-[220px]" title={firstItem.productName}>
                              {firstItem.productName}
                            </span>
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                {formatNumber(firstItem.requestedQty)} {firstItem.unit || 'Piece'}
                              </span>
                              {otherItemsCount > 0 && (
                                <span className="text-[10px] text-indigo-600 font-medium">
                                  +{otherItemsCount} more {otherItemsCount === 1 ? 'item' : 'items'}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No items</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-800 font-medium flex items-center gap-1.5">
                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{req.warehouseName || 'All Hubs'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.priority === 'Urgent'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : req.priority === 'High'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                        {estCost > 0 ? formatCurrency(estCost) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setApprovalNotes('');
                              setIsApproveModalOpen(true);
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title="Approve Request"
                            aria-label="Approve Request"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setRejectionReason('');
                              setIsRejectModalOpen(true);
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title="Reject Request"
                            aria-label="Reject Request"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => navigate(`/purchases/requests?id=${req.id}`)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Inspect Request Details"
                            aria-label="Inspect Request Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Lower Grid: Recent Invoices (~40%) & Supplier Delivery Overview (~60%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* Left Column: Recent Vendor Purchase Invoices (~40% width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Recent Purchase Bills</h3>
              </div>
              <button
                onClick={() => navigate('/purchases')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No supplier purchase bills recorded yet. Click &quot;New Purchase Bill&quot; to add one.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {recentInvoices.map(inv => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-blue-600 block truncate">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-[11px] text-slate-600 truncate block">
                        {inv.supplierName}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 block">
                        {formatCurrency(inv.grandTotal)}
                      </span>
                      <StatusBadge status={inv.paymentStatus} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium truncate">Total Bills: {purchaseInvoices.length}</span>
            <button
              onClick={() => navigate('/purchases/new')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer shrink-0 ml-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Bill</span>
            </button>
          </div>
        </div>

        {/* Right Column: Supplier Delivery Overview (~60% width) */}
        <div id="supplier-delivery-overview-section" className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Supplier Delivery Overview</h3>
              </div>
              <button
                onClick={() => navigate('/suppliers')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View All Suppliers</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {supplierDeliveries.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <Truck className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">No Suppliers Registered</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Active vendor purchase orders and delivery tracking will appear here once suppliers and orders are recorded.
                </p>
                <button
                  onClick={() => navigate('/suppliers')}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Manage Supplier Directory
                </button>
              </div>
            ) : (
              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                        <th className="py-2.5 px-3">Supplier Name</th>
                        <th className="py-2.5 px-2">Contact</th>
                        <th className="py-2.5 px-1.5 text-center">Active Orders</th>
                        <th className="py-2.5 px-2 text-right">Items to Deliver</th>
                        <th className="py-2.5 px-2">Expected Delivery</th>
                        <th className="py-2.5 px-2 text-center">Delivery Status</th>
                        <th className="py-2.5 px-2.5 text-center">Supplier Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierDeliveries.slice(0, 5).map((item) => (
                        <tr key={item.supplierId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <span className="block truncate max-w-[110px] xl:max-w-[140px]" title={item.supplierName}>
                              {item.supplierName}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px]">
                            <span className="block truncate max-w-[85px] xl:max-w-[110px]" title={item.contact}>
                              {item.contact !== 'Not available' ? item.contact : <span className="text-slate-400 font-sans">Not available</span>}
                            </span>
                          </td>
                          <td className="py-2.5 px-1.5 text-center whitespace-nowrap font-mono font-bold text-slate-700">
                            {item.activeOrders}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap font-mono font-bold text-slate-800">
                            {item.itemsToDeliver > 0 ? `${formatNumber(item.itemsToDeliver)} Units` : '0'}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap text-slate-600 text-[11px]">
                            {item.expectedDelivery !== 'Not available' ? formatDate(item.expectedDelivery) : <span className="text-slate-400">Not available</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.deliveryStatus === 'Delivered' || (item.activeOrders === 0 && item.itemsToDeliver === 0)
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {item.deliveryStatus === 'Delivered' || (item.activeOrders === 0 && item.itemsToDeliver === 0) ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Delivered</span>
                                </>
                              ) : (
                                <>
                                  <Truck className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>Active</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.supplierStatus === 'Active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.supplierStatus === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                              }`} />
                              <span>{item.supplierStatus}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">
              Total Active Orders: {totalActiveDeliveries}
            </span>
            <button
              onClick={() => setIsActiveOrdersModalOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      {selectedRequest && isApproveModalOpen && (
        <ApprovePurchaseRequestModal
          isOpen={isApproveModalOpen}
          onClose={() => {
            setIsApproveModalOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onApprovalSuccess={async () => {
            setIsApproveModalOpen(false);
            setSelectedRequest(null);
            await refreshPurchaseRequests();
            await refreshData();
          }}
        />
      )}

      {/* Reject Modal */}
      {selectedRequest && isRejectModalOpen && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title={`Reject Purchase Request #${selectedRequest.requestNumber}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Please state why this replenishment request is being rejected. The requester will be notified.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Stock transfer available from East Godown. Procurement not required."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction || !rejectionReason.trim()}
                onClick={handleRejectConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Active Orders Popup Modal */}
      <ActiveOrdersModal
        isOpen={isActiveOrdersModalOpen}
        onClose={() => setIsActiveOrdersModalOpen(false)}
        purchaseOrders={purchaseOrdersData.length > 0 ? purchaseOrdersData : purchaseInvoices.filter(p => p.docType === 'purchase_order')}
        purchaseRequests={purchaseRequests}
        suppliers={suppliers}
        warehouses={warehouses}
        products={products}
        initialFilter="Active"
      />
    </div>
  );
};
