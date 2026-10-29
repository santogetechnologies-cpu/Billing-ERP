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
  Loader2,
  Search,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { UserProfileModal } from '../../components/auth/UserProfileModal';
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
  destinationWarehouse?: string;
  contact: string;
  activeOrders: number;
  itemsToDeliver: number;
  expectedDelivery: string;
  deliveryStatus: 'Pending' | 'In Transit' | 'Partially Delivered' | 'Overdue' | 'Delivered';
  isOverdue: boolean;
  supplierStatus: 'Active' | 'Delivered' | 'Inactive';
}

/**
 * Computes live supplier delivery overview telemetry from database supplier master records,
 * purchase orders, and linked procurement requests.
 */
export function computeSupplierDeliveries(params: {
  suppliers: Supplier[];
  purchaseOrders: any[];
  purchaseRequests: PurchaseRequest[];
  warehouses?: WarehouseModel[];
  todayStr?: string;
}): SupplierDeliveryItem[] {
  const { suppliers, purchaseOrders, purchaseRequests, warehouses, todayStr } = params;
  const today = todayStr || new Date().toISOString().split('T')[0];

  const supplierMap = new Map<string, {
    supplierId: string;
    supplierName: string;
    destinationWarehouses: string[];
    contact: string;
    activeOrders: number;
    itemsToDeliver: number;
    expectedDates: string[];
    hasPartiallyDelivered: boolean;
    hasInTransit: boolean;
    hasPending: boolean;
    hasOverdue: boolean;
    hasDeliveredOrder: boolean;
  }>();

  // Initialize with registered suppliers
  (suppliers || []).forEach(sup => {
    const contact = (sup.phone && sup.phone.trim()) || (sup.email && sup.email.trim()) || 'Not available';
    supplierMap.set(sup.id, {
      supplierId: sup.id,
      supplierName: sup.name,
      destinationWarehouses: [],
      contact,
      activeOrders: 0,
      itemsToDeliver: 0,
      expectedDates: [],
      hasPartiallyDelivered: false,
      hasInTransit: false,
      hasPending: false,
      hasOverdue: false,
      hasDeliveredOrder: false
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
      destinationWarehouses: [] as string[],
      contact: 'Not available',
      activeOrders: 0,
      itemsToDeliver: 0,
      expectedDates: [],
      hasPartiallyDelivered: false,
      hasInTransit: false,
      hasPending: false,
      hasOverdue: false,
      hasDeliveredOrder: false
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

    if (isCompleted) {
      entry.hasDeliveredOrder = true;
      return;
    }
    if (isCancelled) return;

    entry.activeOrders += 1;
    entry.itemsToDeliver += pendingQty;

    const whId = po.warehouse_id || po.warehouse;
    const matchedWh = warehouses?.find(w => w.id === whId || w.code === whId || (w.name && String(whId).toLowerCase() === w.name.toLowerCase()));
    const whName = matchedWh?.name || po.warehouse_name || (typeof whId === 'string' && !whId.includes('-') && whId.trim() ? whId.trim() : undefined);
    if (whName && !entry.destinationWarehouses.includes(whName)) {
      entry.destinationWarehouses.push(whName);
    }

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

      const matchedWh = warehouses?.find(w => w.id === req.warehouseId);
      const whName = req.warehouseName || matchedWh?.name;
      if (whName && !entry.destinationWarehouses.includes(whName)) {
        entry.destinationWarehouses.push(whName);
      }

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

    let supplierStatus: 'Active' | 'Delivered' | 'Inactive' = 'Inactive';
    if (e.activeOrders > 0 || e.itemsToDeliver > 0) {
      supplierStatus = 'Active';
    } else if (e.hasDeliveredOrder) {
      supplierStatus = 'Delivered';
    } else {
      supplierStatus = 'Inactive';
    }

    return {
      supplierId: e.supplierId,
      supplierName: e.supplierName,
      destinationWarehouse: e.destinationWarehouses.length > 0 ? e.destinationWarehouses.join(', ') : 'Not available',
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
    getWarehouseStock,
    updatePurchaseRequestStatus,
    refreshPurchaseRequests,
    refreshData,
    isLoading: contextLoading,
    error: contextError
  } = useERP();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // State for Warehouse Details section
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedWarehouseForModal, setSelectedWarehouseForModal] = useState<WarehouseModel | null>(null);
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [warehouseModalSearchTerm, setWarehouseModalSearchTerm] = useState('');

  // Warehouse inventory statistics calculation
  const getWarehouseStats = useCallback((whId: string) => {
    let skuCount = 0;
    let totalUnits = 0;
    (products || []).forEach(p => {
      const stock = getWarehouseStock ? getWarehouseStock(whId, p.id) : Number(p.currentStock || 0);
      if (stock > 0) {
        skuCount++;
        totalUnits += stock;
      }
    });
    if (skuCount === 0 && totalUnits === 0 && (products || []).length > 0) {
      skuCount = products.length;
      totalUnits = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);
    }
    return { skuCount, totalUnits };
  }, [products, getWarehouseStock]);

  const filteredDashboardWarehouses = useMemo(() => {
    return (warehouses || []).filter(w => {
      const matchesSearch =
        warehouseSearchTerm === '' ||
        w.name.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
        (w.contactPerson && w.contactPerson.toLowerCase().includes(warehouseSearchTerm.toLowerCase())) ||
        (w.address && w.address.toLowerCase().includes(warehouseSearchTerm.toLowerCase()));

      const isActive = w.isActive ?? true;
      const matchesStatus =
        warehouseStatusFilter === 'All' ||
        (warehouseStatusFilter === 'Active' && isActive) ||
        (warehouseStatusFilter === 'Inactive' && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [warehouses, warehouseSearchTerm, warehouseStatusFilter]);

  const selectedWarehouseProducts = useMemo(() => {
    if (!selectedWarehouseForModal) return [];
    const q = warehouseModalSearchTerm.trim().toLowerCase();
    return (products || [])
      .map(p => ({
        ...p,
        warehouseQuantity: getWarehouseStock ? getWarehouseStock(selectedWarehouseForModal.id, p.id) : (p.currentStock || 0)
      }))
      .filter(p => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.warehouseQuantity - a.warehouseQuantity);
  }, [selectedWarehouseForModal, warehouseModalSearchTerm, products, getWarehouseStock]);

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
      purchaseRequests,
      warehouses
    });
  }, [suppliers, purchaseOrdersData, purchaseInvoices, purchaseRequests, warehouses]);

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

  // All purchase orders list
  const allPurchaseOrders = useMemo(() => {
    return purchaseOrdersData.length > 0
      ? purchaseOrdersData
      : purchaseInvoices.filter(p => p.docType === 'purchase_order');
  }, [purchaseOrdersData, purchaseInvoices]);

  // Recent Purchase Orders mapped for direct tracking
  const recentPurchaseOrders = useMemo(() => {
    return allPurchaseOrders.slice(0, 8).map(po => {
      const poNum = po.order_number || po.invoice_number || po.invoiceNumber || 'PO-2026';
      const poDate = po.date || po.created_at || '';
      const supplierName = po.supplier_name || po.supplierName || 'Supplier';

      const whId = po.warehouse_id || po.warehouse;
      const matchedWh = warehouses.find(w => w.id === whId || w.code === whId);
      const whName = matchedWh?.name || po.warehouse_name || 'Main Warehouse';

      const itemsList = po.items || [];
      const numProducts = itemsList.length;

      let orderedQty = 0;
      let receivedQty = 0;
      itemsList.forEach((it: any) => {
        const ord = Number(it.qty || it.ordered_qty || it.orderedQty || 0);
        const rec = Number(it.received_qty || it.receivedQty || 0);
        orderedQty += ord;
        receivedQty += rec;
      });

      const outstandingQty = Math.max(0, orderedQty - receivedQty);
      const expDelivery = po.expected_delivery || po.due_date || po.expectedDelivery || po.dueDate;

      let deliveryStatus: 'Delivered' | 'In Transit' | 'Partially Delivered' | 'Overdue' = 'In Transit';
      const today = new Date().toISOString().split('T')[0];
      if (outstandingQty === 0 && orderedQty > 0) {
        deliveryStatus = 'Delivered';
      } else if (receivedQty > 0) {
        deliveryStatus = 'Partially Delivered';
      } else if (expDelivery && typeof expDelivery === 'string' && expDelivery.split('T')[0] < today) {
        deliveryStatus = 'Overdue';
      } else {
        deliveryStatus = 'In Transit';
      }

      return {
        id: po.id,
        orderNumber: poNum,
        date: poDate,
        supplierName,
        destinationWarehouse: whName,
        numProducts,
        orderedQty,
        outstandingQty,
        expectedDelivery: expDelivery ? (typeof expDelivery === 'string' ? expDelivery.split('T')[0] : expDelivery) : 'Not available',
        deliveryStatus,
        grandTotal: po.grandTotal || po.grand_total || 0,
        rawOrder: po
      };
    });
  }, [allPurchaseOrders, warehouses]);

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

    // Total Purchase Orders
    const totalOrdersCount = allPurchaseOrders.length;

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
      totalOrdersCount,
      activeOrdersCount: activeInTransitOrders.length,
      lowStockCount: lowStockItems.length,
      lowStockList: lowStockItems.slice(0, 5),
      activeSuppliersCount
    };
  }, [purchaseInvoices, products, supplierDeliveries, activeInTransitOrders, allPurchaseOrders]);

  // Recent Invoices (Latest 5)
  const recentInvoices = useMemo(() => {
    return [...purchaseInvoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [purchaseInvoices]);

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
            <p className="text-xs text-slate-500 max-w-xl mt-0.5">
              Welcome back, <span className="font-semibold text-slate-700">{displayName}</span>! Purchasing, Suppliers & Delivery Operations
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
              {(displayName || 'P')[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
              {displayName}
            </span>
          </button>

          {/* New Purchase Order Button */}
          <button
            onClick={() => navigate('/purchases/new?docType=purchase_order')}
            className="h-9 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
            title="Create new direct purchase order"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>New Purchase Order</span>
          </button>

          {/* New Purchase Bill Button */}
          <button
            onClick={() => navigate('/purchases/new')}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Create new vendor purchase bill"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
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
          title="Total Purchase Orders"
          value={formatNumber(metrics.totalOrdersCount)}
          subtitle={`${metrics.activeOrdersCount} in progress`}
          icon={Truck}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => navigate('/purchases/orders')}
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
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
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

      {/* 3. Direct Procurement: Recent Purchase Orders Section */}
      <div id="recent-orders-section" className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Recent Purchase Orders</span>
              {allPurchaseOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {allPurchaseOrders.length} {allPurchaseOrders.length === 1 ? 'Order' : 'Orders'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct supplier purchase orders, fulfillment progress, and destination warehouse delivery tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate('/purchases/orders')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer mr-2"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate('/purchases/new?docType=purchase_order')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Order</span>
            </button>
          </div>
        </div>

        {isPurchaseOrdersLoading || isRefreshing ? (
          <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading purchase orders...</span>
          </div>
        ) : recentPurchaseOrders.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-2">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No Purchase Orders Created Yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Start purchasing directly by creating your first purchase order for supplier delivery.
            </p>
            <button
              onClick={() => navigate('/purchases/new?docType=purchase_order')}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Purchase Order</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Purchase Order Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Destination Warehouse</th>
                  <th className="py-3 px-4 text-center">Number of Products</th>
                  <th className="py-3 px-4 text-right">Ordered Quantity</th>
                  <th className="py-3 px-4 text-right">Outstanding Quantity</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4 text-center">Delivery Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPurchaseOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-600 block">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {order.date ? formatDate(order.date) : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span className="block truncate max-w-[160px]" title={order.supplierName}>
                        {order.supplierName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-800 font-medium flex items-center gap-1.5">
                        <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[140px]">{order.destinationWarehouse}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-semibold text-slate-700">
                      {order.numProducts} {order.numProducts === 1 ? 'Product' : 'Products'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      {formatNumber(order.orderedQty)} Units
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-amber-700">
                      {order.outstandingQty > 0 ? `${formatNumber(order.outstandingQty)} Units` : '0 Units'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 text-[11px]">
                      {order.expectedDelivery !== 'Not available' ? formatDate(order.expectedDelivery) : <span className="text-slate-400">Not available</span>}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        order.deliveryStatus === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : order.deliveryStatus === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : order.deliveryStatus === 'Partially Delivered'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {order.deliveryStatus === 'Delivered' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <Truck className="w-3 h-3 shrink-0" />
                        )}
                        <span>{order.deliveryStatus}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => navigate('/purchases/orders')}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        title="View Purchase Order Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Lower Grid: Recent Invoices (~35%) & Supplier Delivery Overview (~65%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Recent Vendor Purchase Invoices (4 of 12 columns = ~33.3% width) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between h-full">
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

        {/* Right Column: Supplier Delivery Overview (8 of 12 columns = ~66.7% width) */}
        <div id="supplier-delivery-overview-section" className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between h-full">
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
                        <th className="py-2.5 px-2.5">Contact</th>
                        <th className="py-2.5 px-2 text-center">Active Orders</th>
                        <th className="py-2.5 px-2.5 text-right">Items to Deliver</th>
                        <th className="py-2.5 px-2.5">Expected Delivery</th>
                        <th className="py-2.5 px-2.5 text-center">Delivery Status</th>
                        <th className="py-2.5 px-3 text-center">Supplier Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierDeliveries.slice(0, 5).map((item) => (
                        <tr key={item.supplierId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <span className="block truncate max-w-[140px] xl:max-w-[180px]" title={item.supplierName}>
                              {item.supplierName}
                            </span>
                            {item.destinationWarehouse && item.destinationWarehouse !== 'Not available' && (
                              <span
                                className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[140px]"
                                title={`Destination Warehouse: ${item.destinationWarehouse}`}
                              >
                                <WarehouseIcon className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                <span className="truncate">{item.destinationWarehouse}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-600 font-mono text-[11px]">
                            <span className="block truncate max-w-[110px] xl:max-w-[140px]" title={item.contact}>
                              {item.contact !== 'Not available' ? item.contact : <span className="text-slate-400 font-sans">Not available</span>}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap font-mono font-bold text-slate-700">
                            {item.activeOrders}
                          </td>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap font-mono font-bold text-slate-800">
                            {item.itemsToDeliver > 0 ? `${formatNumber(item.itemsToDeliver)} Units` : '0'}
                          </td>
                          <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                            {item.expectedDelivery !== 'Not available' ? formatDate(item.expectedDelivery) : <span className="text-slate-400">Not available</span>}
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.deliveryStatus === 'Delivered' || (item.activeOrders === 0 && item.itemsToDeliver === 0)
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : item.deliveryStatus === 'Overdue'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : item.deliveryStatus === 'Partially Delivered'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : item.deliveryStatus === 'In Transit'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {item.deliveryStatus === 'Delivered' || (item.activeOrders === 0 && item.itemsToDeliver === 0) ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              ) : (
                                <Truck className="w-3 h-3 shrink-0" />
                              )}
                              <span>{item.deliveryStatus}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
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

      {/* 5. Warehouse Details & Stock Availability Section */}
      <div id="warehouse-details-section" className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Warehouse Details & Stock Availability
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {warehouses.length} {warehouses.length === 1 ? 'Location' : 'Locations'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review existing warehouses, destination facilities, and real-time product quantities stored across hubs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search warehouse..."
                value={warehouseSearchTerm}
                onChange={e => setWarehouseSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={warehouseStatusFilter}
              onChange={e => setWarehouseStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-hidden"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            {/* View Full Directory Link */}
            <button
              onClick={() => navigate('/inventory/warehouses')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer shrink-0 ml-1"
            >
              <span>Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Warehouses Table */}
        {filteredDashboardWarehouses.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No warehouses matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-3">Location / Address</th>
                  <th className="py-3 px-3">Contact Person & Phone</th>
                  <th className="py-3 px-3 text-center">Total Products</th>
                  <th className="py-3 px-3 text-right">Available Stock</th>
                  <th className="py-3 px-3 text-center">Warehouse Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDashboardWarehouses.map(wh => {
                  const isActive = wh.isActive ?? true;
                  const stats = getWarehouseStats(wh.id);
                  const contactPerson = wh.contactPerson || wh.managerName || 'Not available';
                  const phone = wh.phone || 'Not available';
                  const address = wh.address || 'Not available';

                  return (
                    <tr key={wh.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">
                            {wh.code}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 block truncate max-w-[160px]" title={wh.name}>
                              {wh.name}
                            </span>
                            {wh.isDefault && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 inline-block mt-0.5">
                                Primary Hub
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        <span className="block truncate max-w-[160px] xl:max-w-[200px]" title={address}>
                          {address !== 'Not available' ? address : <span className="text-slate-400 font-sans">Not available</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <span className="font-medium block truncate max-w-[140px]" title={contactPerson}>
                          {contactPerson !== 'Not available' ? contactPerson : <span className="text-slate-400 font-sans">Not available</span>}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {phone !== 'Not available' ? phone : <span className="text-slate-400 font-sans">Not available</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-700">
                        {stats.skuCount} {stats.skuCount === 1 ? 'SKU' : 'SKUs'}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                        {formatNumber(stats.totalUnits)} Units
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`} />
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedWarehouseForModal(wh);
                            setWarehouseModalSearchTerm('');
                            setIsWarehouseModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer mx-auto"
                          title="View Products & Stock Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Stock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>



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

      {/* Warehouse Complete Stock Details Modal */}
      {isWarehouseModalOpen && selectedWarehouseForModal && (
        <Modal
          isOpen={isWarehouseModalOpen}
          onClose={() => {
            setIsWarehouseModalOpen(false);
            setSelectedWarehouseForModal(null);
          }}
          title={`Warehouse Details & Stored Products: ${selectedWarehouseForModal.name}`}
          size="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Warehouse Summary Info Header */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Warehouse Code</span>
                <span className="font-mono font-bold text-indigo-700 text-sm mt-0.5 block">{selectedWarehouseForModal.code}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Location / Address</span>
                <span className="font-medium text-slate-800 truncate block mt-0.5" title={selectedWarehouseForModal.address}>
                  {selectedWarehouseForModal.address || 'Not available'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Contact Person</span>
                <span className="font-medium text-slate-800 truncate block mt-0.5">
                  {selectedWarehouseForModal.contactPerson || selectedWarehouseForModal.managerName || 'Not available'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Warehouse Status</span>
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full mt-0.5 ${
                  selectedWarehouseForModal.isActive ?? true ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {selectedWarehouseForModal.isActive ?? true ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Product Search Toolbar */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter products in this warehouse..."
                  value={warehouseModalSearchTerm}
                  onChange={e => setWarehouseModalSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-slate-500 text-[11px] font-medium">
                {selectedWarehouseProducts.length} {selectedWarehouseProducts.length === 1 ? 'Product Listed' : 'Products Listed'}
              </span>
            </div>

            {/* Products Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
              {selectedWarehouseProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No products found stored at this warehouse.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100/95 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3 text-right">Available Quantity</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedWarehouseProducts.map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{prod.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">{prod.sku || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{prod.category || 'General'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{prod.primaryUnit || 'Piece'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatNumber(prod.warehouseQuantity)} {prod.primaryUnit || 'Units'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            prod.warehouseQuantity > 10
                              ? 'bg-emerald-100 text-emerald-800'
                              : prod.warehouseQuantity > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {prod.warehouseQuantity > 10 ? 'In Stock' : prod.warehouseQuantity > 0 ? 'Limited Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsWarehouseModalOpen(false);
                  setSelectedWarehouseForModal(null);
                }}
                className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
