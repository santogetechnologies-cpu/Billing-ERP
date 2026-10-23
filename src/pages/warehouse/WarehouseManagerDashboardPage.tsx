import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Package,
  AlertTriangle,
  AlertOctagon,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  Send,
  Eye,
  Trash2,
  RotateCcw,
  Sparkles,
  RefreshCw,
  UserCheck,
  Calendar,
  Warehouse as WarehouseIcon,
  Check,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { UserProfileModal } from '../../components/auth/UserProfileModal';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import {
  Product,
  Warehouse,
  PurchaseRequest,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
  CreatePurchaseRequestInput,
  InventoryTransaction
} from '../../types';

interface EnrichedLowStockProduct {
  id: string;
  product: Product;
  name: string;
  sku: string;
  category: string;
  warehouseName: string;
  currentStock: number;
  unit: string;
  warningLimit: number | null;
  suggestedQty: number;
  stockStatus: 'Out of Stock' | 'Limited Stock' | 'Active';
  lastMovementDate?: string;
  lastMovementType?: string;
}

interface MultiRequestItem {
  product: Product;
  currentStock: number;
  warningLimit: number | null;
  unit: string;
  suggestedQty: number;
  requestedQty: number;
  estimatedCost: number;
}

export const WarehouseManagerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    warehouses,
    products,
    inventoryTransactions,
    purchaseRequests,
    createPurchaseRequest,
    refreshData,
    getWarehouseStock,
    company
  } = useERP();

  const isExecutive = profile?.role === 'Owner' || profile?.role === 'Admin';
  const isWarehouseManager = profile?.role === 'Warehouse Manager';

  // 1. Warehouse Access Scope: restrict to assigned warehouses for Warehouse Manager
  const authorizedWarehouses = useMemo(() => {
    if (isExecutive) return warehouses;
    if (!user?.id) return warehouses;
    const assigned = warehouses.filter(
      w => w.managerId === user.id || w.managerIds?.includes(user.id)
    );
    return assigned.length > 0 ? assigned : warehouses;
  }, [warehouses, user?.id, isExecutive]);

  // Selected Warehouse State (defaults to first authorized warehouse or ALL if multiple authorized)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    if (authorizedWarehouses.length === 1) {
      return authorizedWarehouses[0].id;
    }
    return 'ALL';
  });

  // Keep selectedWarehouseId valid if warehouses update
  useEffect(() => {
    if (authorizedWarehouses.length === 1 && selectedWarehouseId !== authorizedWarehouses[0].id) {
      setSelectedWarehouseId(authorizedWarehouses[0].id);
    }
  }, [authorizedWarehouses, selectedWarehouseId]);

  // Modals & Drawers
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<PurchaseRequest | null>(null);

  // Table Filters & Pagination for Low Stock & Reorder
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LIMITED_STOCK'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'stock' | 'suggestedQty' | 'name'>('stock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-Selection State for Bulk Purchase Request
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Modal State for Create Purchase Request Workflow
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestItems, setRequestItems] = useState<MultiRequestItem[]>([]);
  const [requestWarehouseId, setRequestWarehouseId] = useState<string>('');
  const [priority, setPriority] = useState<PurchaseRequestPriority>('High');
  const [reason, setReason] = useState<string>('Inventory stock replenishment for warning-level threshold');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [additionalProductId, setAdditionalProductId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Replenishment Reason input auto-selection refs & handlers
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const isReasonEditedRef = useRef<boolean>(false);
  const shouldSelectOnMouseUpRef = useRef<boolean>(false);

  useEffect(() => {
    if (isRequestModalOpen) {
      isReasonEditedRef.current = false;
      shouldSelectOnMouseUpRef.current = false;
    }
  }, [isRequestModalOpen]);

  const handleReasonFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isReasonEditedRef.current) {
      e.currentTarget.select();
    }
  };

  const handleReasonMouseDown = () => {
    if (!isReasonEditedRef.current && document.activeElement !== reasonInputRef.current) {
      shouldSelectOnMouseUpRef.current = true;
    }
  };

  const handleReasonMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (shouldSelectOnMouseUpRef.current) {
      shouldSelectOnMouseUpRef.current = false;
      e.currentTarget.select();
    }
  };

  const handleReasonKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isReasonEditedRef.current) {
      // Allow navigation and shortcut keys
      if (e.key === 'Tab' || e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      // If typing immediately after focus, ensure full selection so the key replaces default text
      const input = e.currentTarget;
      if (input.selectionStart !== 0 || input.selectionEnd !== input.value.length) {
        input.select();
      }
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isReasonEditedRef.current = true;
    setReason(e.target.value);
  };


  // Current localized date string
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // Helper: Get available stock for a product in the selected warehouse scope (strictly non-negative)
  const getProductStockInScope = (product: Product, whId: string): number => {
    let stockVal = 0;
    if (whId === 'ALL') {
      if (authorizedWarehouses.length === warehouses.length) {
        stockVal = Number(product.currentStock || 0);
      } else {
        // Sum only across authorized warehouses
        stockVal = authorizedWarehouses.reduce((acc, wh) => {
          return acc + getWarehouseStock(product.id, wh.code);
        }, 0);
      }
    } else {
      const wh = warehouses.find(w => w.id === whId);
      if (!wh) stockVal = Number(product.currentStock || 0);
      else stockVal = getWarehouseStock(product.id, wh.code);
    }
    // Strict non-negative floor: available stock can never be negative
    return Math.max(0, stockVal);
  };

  // Helper: Last stock movement for a product
  const getProductLastMovement = (product: Product): { date?: string; type?: string } => {
    const tx = inventoryTransactions.find(
      t => t.productName?.toLowerCase() === product.name.toLowerCase() || (t as any).productId === product.id
    );
    if (!tx) return {};
    return { date: tx.date, type: tx.type };
  };

  // Enriched catalog data for the selected warehouse
  const enrichedCatalog = useMemo(() => {
    const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId);
    const whLabel = selectedWarehouseId === 'ALL'
      ? (authorizedWarehouses.length === 1 ? authorizedWarehouses[0].name : 'All Authorized Hubs')
      : (activeWarehouse?.name || 'Selected Warehouse');

    return products.map(p => {
      const currentStock = getProductStockInScope(p, selectedWarehouseId);
      const limit = p.reorderLevel !== null && p.reorderLevel !== undefined ? Number(p.reorderLevel) : null;
      
      let stockStatus: 'Out of Stock' | 'Limited Stock' | 'Active' = 'Active';
      if (currentStock <= 0) {
        stockStatus = 'Out of Stock';
      } else if (limit !== null && currentStock <= limit) {
        stockStatus = 'Limited Stock';
      }

      // Suggested reorder quantity formula
      let suggestedQty = 0;
      if (currentStock <= 0) {
        const target = limit && limit > 0 ? limit * 2 : 20;
        suggestedQty = target;
      } else if (limit !== null && currentStock <= limit) {
        suggestedQty = Math.max(1, (limit * 2) - currentStock);
      }

      const movement = getProductLastMovement(p);

      return {
        id: p.id,
        product: p,
        name: p.name,
        sku: p.sku || '—',
        category: p.category || 'General',
        warehouseName: whLabel,
        currentStock,
        unit: p.primaryUnit || 'Piece',
        warningLimit: limit,
        suggestedQty,
        stockStatus,
        lastMovementDate: movement.date,
        lastMovementType: movement.type
      } as EnrichedLowStockProduct;
    });
  }, [products, selectedWarehouseId, authorizedWarehouses, warehouses, inventoryTransactions]);

  // 2. Summary Metrics Calculations
  const metrics = useMemo(() => {
    const totalProducts = enrichedCatalog.length;
    const outOfStockCount = enrichedCatalog.filter(p => p.stockStatus === 'Out of Stock').length;
    const lowStockCount = enrichedCatalog.filter(p => p.stockStatus === 'Limited Stock').length;
    const activeHealthyCount = Math.max(0, totalProducts - outOfStockCount - lowStockCount);

    // Pending purchase requests count (filtered to warehouse if not ALL)
    const pendingPRCount = purchaseRequests.filter(req => {
      const isPendingStatus =
        req.status === 'Pending Approval' ||
        req.status === 'Pending Review' ||
        req.status === 'Under Review' ||
        req.status === 'Clarification Requested';

      if (!isPendingStatus) return false;
      if (selectedWarehouseId === 'ALL') {
        // Must belong to authorized warehouses
        return authorizedWarehouses.some(w => w.id === req.warehouseId || w.name === req.warehouseName);
      }
      return req.warehouseId === selectedWarehouseId;
    }).length;

    return {
      totalProducts,
      outOfStockCount,
      lowStockCount,
      activeHealthyCount,
      pendingPRCount
    };
  }, [enrichedCatalog, purchaseRequests, selectedWarehouseId, authorizedWarehouses]);

  // 3. Stock Status Donut Chart Percentages
  const chartData = useMemo(() => {
    const total = metrics.totalProducts;
    if (total === 0) {
      return {
        activePct: 0,
        limitedPct: 0,
        outPct: 0,
        slices: [
          { label: 'Active', count: 0, pct: 0, color: '#10b981', textColor: 'text-emerald-700', bgDot: 'bg-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Limited', count: 0, pct: 0, color: '#f59e0b', textColor: 'text-amber-700', bgDot: 'bg-amber-500', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Out of Stock', count: 0, pct: 0, color: '#f43f5e', textColor: 'text-rose-700', bgDot: 'bg-rose-500', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' }
        ]
      };
    }

    const activePct = Math.round((metrics.activeHealthyCount / total) * 100);
    const limitedPct = Math.round((metrics.lowStockCount / total) * 100);
    const outPct = Math.max(0, 100 - activePct - limitedPct);

    const slices = [
      { label: 'Active', count: metrics.activeHealthyCount, pct: activePct, color: '#10b981', textColor: 'text-emerald-700', bgDot: 'bg-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { label: 'Limited', count: metrics.lowStockCount, pct: limitedPct, color: '#f59e0b', textColor: 'text-amber-700', bgDot: 'bg-amber-500', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
      { label: 'Out of Stock', count: metrics.outOfStockCount, pct: outPct, color: '#f43f5e', textColor: 'text-rose-700', bgDot: 'bg-rose-500', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200' }
    ];

    return {
      activePct,
      limitedPct,
      outPct,
      slices
    };
  }, [metrics]);

  // 4. Low Stock & Reorder Products List (Out of Stock + Limited Stock)
  const lowStockProducts = useMemo(() => {
    return enrichedCatalog.filter(
      p => p.stockStatus === 'Out of Stock' || p.stockStatus === 'Limited Stock'
    );
  }, [enrichedCatalog]);

  // Filtered & Sorted Low Stock List
  const filteredLowStockProducts = useMemo(() => {
    let result = lowStockProducts;

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      result = result.filter(
        p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'OUT_OF_STOCK') {
      result = result.filter(p => p.stockStatus === 'Out of Stock');
    } else if (statusFilter === 'LIMITED_STOCK') {
      result = result.filter(p => p.stockStatus === 'Limited Stock');
    }

    // Sorting
    return [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'stock') {
        comparison = a.currentStock - b.currentStock;
      } else if (sortField === 'suggestedQty') {
        comparison = a.suggestedQty - b.suggestedQty;
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [lowStockProducts, tableSearch, statusFilter, sortField, sortOrder]);

  // Pagination for Low Stock Table
  const totalPages = Math.max(1, Math.ceil(filteredLowStockProducts.length / pageSize));
  const paginatedLowStock = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLowStockProducts.slice(start, start + pageSize);
  }, [filteredLowStockProducts, currentPage, pageSize]);

  // 5. Recent Purchase Requests (filtered to authorized warehouses, sorted latest first)
  const recentPurchaseRequests = useMemo(() => {
    return [...purchaseRequests]
      .filter(req => {
        if (selectedWarehouseId === 'ALL') {
          return authorizedWarehouses.some(w => w.id === req.warehouseId || w.name === req.warehouseName);
        }
        return req.warehouseId === selectedWarehouseId;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [purchaseRequests, selectedWarehouseId, authorizedWarehouses]);

  // Helper: Extract concise product and quantity summary for purchase request list
  const getRequestSummary = (req: PurchaseRequest) => {
    if (!req.items || req.items.length === 0) {
      return {
        productSummary: req.reason || 'General replenishment',
        quantitySummary: null,
        fullProductsTooltip: req.reason || 'General replenishment'
      };
    }

    const firstItem = req.items[0];
    const totalCount = req.items.length;
    const totalQty = req.items.reduce((acc, it) => acc + (Number(it.requestedQty) || 0), 0);

    const productSummary = totalCount === 1
      ? firstItem.productName
      : `${firstItem.productName} +${totalCount - 1} more`;

    const quantitySummary = totalCount === 1
      ? `${formatNumber(firstItem.requestedQty)} ${firstItem.unit || 'Units'}`
      : `${formatNumber(totalQty)} Units (${totalCount} items)`;

    const fullProductsTooltip = req.items
      .map(i => `${i.productName}: ${formatNumber(i.requestedQty)} ${i.unit || 'Units'}`)
      .join(', ');

    return { productSummary, quantitySummary, fullProductsTooltip };
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      console.warn('Dashboard refresh error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Checkbox Selection
  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleToggleSelectAllOnPage = () => {
    const pageIds = paginatedLowStock.map(p => p.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedProductIds.has(id));

    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Open Create Purchase Request Modal
  const openPurchaseRequestModal = (itemsToRequest: Product[]) => {
    const targetWhId = selectedWarehouseId !== 'ALL'
      ? selectedWarehouseId
      : (authorizedWarehouses[0]?.id || warehouses[0]?.id || '');
    setRequestWarehouseId(targetWhId);

    const items: MultiRequestItem[] = itemsToRequest.map(p => {
      const currentStock = getProductStockInScope(p, targetWhId);
      const limit = p.reorderLevel !== null && p.reorderLevel !== undefined ? Number(p.reorderLevel) : null;
      const target = limit && limit > 0 ? limit * 2 : 20;
      const suggested = currentStock <= 0 ? target : Math.max(1, target - currentStock);

      return {
        product: p,
        currentStock,
        warningLimit: limit,
        unit: p.primaryUnit || 'Piece',
        suggestedQty: suggested,
        requestedQty: suggested > 0 ? suggested : 10,
        estimatedCost: p.costPrice || p.purchasePrice || 0
      };
    });

    setRequestItems(items);
    setPriority(items.some(i => i.currentStock <= 0) ? 'Urgent' : 'High');
    setReason(
      items.some(i => i.currentStock <= 0)
        ? 'Critical inventory replenishment: Items are out of stock'
        : 'Stock replenishment: Inventory at or below configured warning limits'
    );
    setSubmitSuccessMsg(null);
    isReasonEditedRef.current = false;
    shouldSelectOnMouseUpRef.current = false;
    setIsRequestModalOpen(true);
  };

  // Open modal from Bulk Action Button
  const handleOpenBulkRequestModal = () => {
    if (selectedProductIds.size === 0) {
      if (filteredLowStockProducts.length > 0) {
        openPurchaseRequestModal(filteredLowStockProducts.map(p => p.product));
      } else {
        alert('No low stock items currently available to replenish.');
      }
      return;
    }
    const selectedProds = products.filter(p => selectedProductIds.has(p.id));
    openPurchaseRequestModal(selectedProds);
  };

  // Open modal for single product
  const handleOpenSingleRequestModal = (product: Product) => {
    openPurchaseRequestModal([product]);
  };

  // Line item handlers in modal
  const handleUpdateItemQty = (productId: string, qty: number) => {
    setRequestItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, requestedQty: Math.max(1, qty) } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setRequestItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleAddAdditionalProduct = () => {
    if (!additionalProductId) return;
    const prod = products.find(p => p.id === additionalProductId);
    if (!prod) return;

    if (requestItems.some(i => i.product.id === prod.id)) {
      alert(`"${prod.name}" is already included in this request.`);
      return;
    }

    const currentStock = getProductStockInScope(prod, requestWarehouseId);
    const limit = prod.reorderLevel !== null && prod.reorderLevel !== undefined ? Number(prod.reorderLevel) : null;
    const target = limit && limit > 0 ? limit * 2 : 20;
    const suggested = currentStock <= 0 ? target : Math.max(1, target - currentStock);

    const newItem: MultiRequestItem = {
      product: prod,
      currentStock,
      warningLimit: limit,
      unit: prod.primaryUnit || 'Piece',
      suggestedQty: suggested,
      requestedQty: suggested > 0 ? suggested : 10,
      estimatedCost: prod.costPrice || prod.purchasePrice || 0
    };

    setRequestItems(prev => [...prev, newItem]);
    setAdditionalProductId('');
  };

  // Submit Purchase Request
  const handleSubmitPurchaseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestItems.length === 0) {
      alert('Please include at least one product in the purchase request.');
      return;
    }

    for (const item of requestItems) {
      if (!item.requestedQty || item.requestedQty <= 0) {
        alert(`Requested quantity for "${item.product.name}" must be greater than zero.`);
        return;
      }
    }

    const targetWh = warehouses.find(w => w.id === requestWarehouseId) || warehouses[0];
    if (!targetWh) {
      alert('Please select an authorized receiving warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePurchaseRequestInput = {
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        priority,
        reason: reason.trim() || 'Inventory replenishment for low stock items',
        requestedDeliveryDate: deliveryDate,
        notes: notes.trim(),
        items: requestItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          currentStock: Number(item.currentStock || 0),
          warningLimit: item.warningLimit,
          requestedQty: Number(item.requestedQty),
          unit: item.unit,
          estimatedCost: Number(item.estimatedCost || 0)
        }))
      };

      const created = await createPurchaseRequest(payload);
      setSubmitSuccessMsg(
        `Purchase Request #${created.requestNumber} created successfully with ${requestItems.length} products! Sent to Purchase Manager for review.`
      );
      setSelectedProductIds(new Set());

      setTimeout(() => {
        setIsRequestModalOpen(false);
        setIsSubmitting(false);
        setSubmitSuccessMsg(null);
      }, 1600);
    } catch (err: any) {
      alert(`Failed to submit purchase request: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Request status badge styling
  const getRequestStatusBadgeClass = (status: PurchaseRequestStatus) => {
    switch (status) {
      case 'Pending Approval':
      case 'Pending Review':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Under Review':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Clarification Requested':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Approved':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Ordered':
      case 'Partially Received':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadgeClass = (prio: PurchaseRequestPriority) => {
    switch (prio) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'Normal':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* 1. Dashboard Header */}
      <div className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left Column: Breadcrumb & Date (Row 1), Title & Subtitle (Row 2) */}
        <div className="min-w-0 space-y-1">
          {/* Breadcrumb & Date Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium flex-wrap">
            <div className="flex items-center gap-1.5">
              <WarehouseIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Dashboard</span>
              <span>/</span>
              <span className="text-slate-600 font-semibold">Warehouse Operations</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-600 text-[11px] font-medium border border-slate-200/60 shrink-0">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{formattedToday}</span>
            </div>
          </div>


          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              Warehouse Manager Dashboard
            </h1>
            <p className="text-xs text-slate-500 max-w-xl mt-0.5">
              Monitor stock levels, manage replenishment and keep warehouse operations running smoothly.
            </p>
          </div>
        </div>

        {/* Right Column: Action Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs disabled:opacity-50 shrink-0"
            title="Refresh Inventory Balances & Requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* User Profile Menu Button */}

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs shrink-0"
            title="View Profile"
          >
            <div className="w-5 h-5 rounded-lg bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {(profile?.full_name || user?.email || 'W')[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-800 truncate max-w-[100px]">
              {profile?.full_name || 'warehouse'}
            </span>
          </button>

          {/* Primary Action Button: Create Purchase Request */}
          <button
            onClick={handleOpenBulkRequestModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Create a new purchase request for inventory replenishment"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Create Purchase Request</span>
          </button>
        </div>
      </div>

      {/* 2. Four Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <StatCard
          title="Total Products"
          value={formatNumber(metrics.totalProducts)}
          subtitle={selectedWarehouseId === 'ALL' ? 'Across authorized hubs' : 'In selected hub'}
          icon={Boxes}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => navigate('/inventory')}
        />

        {/* Low Stock Items */}
        <StatCard
          title="Low Stock Items"
          value={`${formatNumber(metrics.lowStockCount)} Products`}
          subtitle="At or below warning limit"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => {
            setStatusFilter('LIMITED_STOCK');
            const el = document.getElementById('low-stock-table-card');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Out of Stock Items */}
        <StatCard
          title="Out of Stock Items"
          value={`${formatNumber(metrics.outOfStockCount)} Products`}
          subtitle="Zero or negative on-hand"
          icon={AlertOctagon}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          onClick={() => {
            setStatusFilter('OUT_OF_STOCK');
            const el = document.getElementById('low-stock-table-card');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Pending Purchase Requests */}
        <StatCard
          title="Pending Purchase Requests"
          value={`${formatNumber(metrics.pendingPRCount)} Requests`}
          subtitle="Awaiting purchase manager review"
          icon={ClipboardList}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={() => navigate('/inventory/purchase-requests')}
        />
      </div>

      {/* 3. Middle Section: Stock Status Overview (Donut Chart) + Recent Purchase Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Stock Status Overview Donut Chart (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Stock Status Overview</h2>
              <p className="text-xs text-slate-400">Inventory health distribution across catalog</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
              {formatNumber(metrics.totalProducts)} {metrics.totalProducts === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {/* Two-column layout: Donut Chart on LEFT, Stock Status Details on RIGHT */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-1">
            {/* LEFT SIDE — Donut Chart */}
            <div className="shrink-0 flex items-center justify-center">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {/* Subtle track ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="13"
                  />
                  {(() => {
                    let accumulated = 0;
                    return chartData.slices.map((slice, idx) => {
                      if (slice.pct === 0) return null;
                      const strokeDash = `${slice.pct} ${100 - slice.pct}`;
                      const strokeDashoffset = -accumulated;
                      accumulated += slice.pct;

                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="13"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={strokeDashoffset}
                          pathLength="100"
                          className="transition-all duration-300"
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Center Content: Number + TOTAL PRODUCTS */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900 block leading-tight">
                    {formatNumber(metrics.totalProducts)}
                  </span>
                  <span className="text-[8px] sm:text-[8.5px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">
                    TOTAL PRODUCTS
                  </span>
                </div>
              </div>
            </div>

            {/* Subtle Vertical Divider between chart and details */}
            <div className="hidden sm:block w-px self-stretch bg-slate-100 my-0.5 shrink-0" />
            <div className="sm:hidden w-full h-px bg-slate-100" />

            {/* RIGHT SIDE — Stock Status Details (shifted inward with balanced spacing from card border) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2 sm:pl-3 sm:pr-2">
              {chartData.slices.map((slice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-50/80 transition-colors text-xs"
                >
                  {/* Colored circular status indicator + Status name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${slice.bgDot}`} />
                    <span className="font-semibold text-xs text-slate-800 truncate">
                      {slice.label}
                    </span>
                  </div>

                  {/* Actual count of products + Percentage badge aligned on far right */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      {formatNumber(slice.count)} {slice.count === 1 ? 'item' : 'items'}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[38px] font-bold font-mono px-2 py-0.5 rounded-md text-[11px] border ${slice.badgeBg}`}
                    >
                      {slice.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent Purchase Requests Card (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Purchase Requests</h2>
              <p className="text-xs text-slate-400">Track replenishment orders sent to purchasing</p>
            </div>
            <button
              onClick={() => navigate('/inventory/purchase-requests')}
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 transition-colors cursor-pointer px-1 py-1 group"
              title="Navigate to complete purchase requests page"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {recentPurchaseRequests.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-center">
              <p className="text-xs text-slate-400 font-medium">
                No recent purchase requests found.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto max-h-[155px] scrollbar-thin divide-y divide-slate-100 pr-0.5">
              {recentPurchaseRequests.map(req => {
                const { productSummary, quantitySummary, fullProductsTooltip } = getRequestSummary(req);

                return (
                  <div
                    key={req.id}
                    onClick={() => {
                      if (hasPermission(profile?.role, 'inventory', 'view')) {
                        navigate(`/inventory/purchase-requests?id=${req.id}`);
                      } else {
                        setSelectedRequestDetails(req);
                      }
                    }}
                    className="py-2 px-1.5 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-lg transition-colors cursor-pointer group"
                    title={`Click to view details of #${req.requestNumber}`}
                  >
                    {/* Left Details: Request Number, Badges, Product Summary, Quantity */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-blue-600 group-hover:text-blue-700">
                          #{req.requestNumber}
                        </span>

                        {req.priority && (
                          <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getPriorityBadgeClass(req.priority)}`}>
                            {req.priority}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-300">•</span>

                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(req.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0 flex-wrap">
                        <span
                          className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-[260px]"
                          title={fullProductsTooltip}
                        >
                          {productSummary}
                        </span>

                        {quantitySummary && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500 font-mono shrink-0">
                              Qty: <strong className="font-semibold text-slate-700">{quantitySummary}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Details: Status Badge & Link Arrow */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getRequestStatusBadgeClass(req.status)}`}>
                        {req.status}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-all group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Prominent Table: Low Stock & Reorder Products */}
      <div id="low-stock-table-card" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        {/* Table Header: Title on Left, Search Input on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Low Stock & Reorder Products
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                {lowStockProducts.length} requiring reorder
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Items at or below warning limit, including completely out-of-stock products
            </p>
          </div>

          {/* Search Input positioned in former top-right button location */}
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={tableSearch}
              onChange={e => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Table Controls Toolbar: Status Filter Tabs on Left */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Status Filter Tabs on Left */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Low ({lowStockProducts.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('OUT_OF_STOCK');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Out of Stock ({metrics.outOfStockCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('LIMITED_STOCK');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'LIMITED_STOCK' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Limited ({metrics.lowStockCount})
              </button>
            </div>

            {selectedProductIds.size > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium animate-fadeIn">
                <span>{selectedProductIds.size} selected</span>
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(new Set())}
                  className="text-[11px] text-blue-500 hover:text-blue-800 underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Content */}
        {filteredLowStockProducts.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-700">All inventory items are currently well stocked!</p>
            <p className="text-[11px] text-slate-400">
              No products are at or below their configured warning limits in the selected warehouse scope.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }} className="px-2 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={paginatedLowStock.length > 0 && paginatedLowStock.every(p => selectedProductIds.has(p.id))}
                      onChange={handleToggleSelectAllOnPage}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th style={{ minWidth: '200px' }} className="px-3.5 py-3">
                    <button
                      onClick={() => {
                        setSortField('name');
                        setSortOrder(s => s === 'asc' ? 'desc' : 'asc');
                      }}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>Product</span>
                      {sortField === 'name' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3">SKU</th>
                  <th style={{ width: '180px', minWidth: '150px' }} className="px-3 py-3">Warehouse</th>
                                    <th style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-right">
                    <button
                      onClick={() => {
                        setSortField('stock');
                        setSortOrder(s => s === 'asc' ? 'desc' : 'asc');
                      }}
                      className="flex items-center justify-end gap-1 hover:text-slate-900 w-full"
                    >
                      <span>Available Stock</span>
                      {sortField === 'stock' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th style={{ width: '120px', minWidth: '100px' }} className="px-3 py-3 text-right">Warning Limit</th>
                  <th style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-center">Status</th>
                  <th style={{ width: '90px', minWidth: '80px' }} className="px-2 py-3 text-center">Priority</th>
                  <th style={{ width: '150px', minWidth: '130px' }} className="px-3 py-3 text-right">
                    <button
                      onClick={() => {
                        setSortField('suggestedQty');
                        setSortOrder(s => s === 'asc' ? 'desc' : 'asc');
                      }}
                      className="flex items-center justify-end gap-1 hover:text-slate-900 w-full"
                    >
                      <span>Suggested Reorder</span>
                      {sortField === 'suggestedQty' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLowStock.map(p => {
                  const isSelected = selectedProductIds.has(p.id);
                  const safeStock = Math.max(0, p.currentStock);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }} className="px-2 py-3 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(p.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Product */}
                      <td style={{ minWidth: '200px' }} className="px-3.5 py-3 align-middle">
                        <div className="font-semibold text-slate-900 leading-snug break-words" title={p.name}>
                          {p.name}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{p.category}</span>
                      </td>

                      {/* SKU */}
                      <td style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 font-mono text-[11px] font-semibold text-blue-600 align-middle">
                        {p.sku}
                      </td>

                      {/* Warehouse */}
                      <td style={{ width: '180px', minWidth: '150px' }} className="px-3 py-3 text-slate-700 align-middle">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium truncate max-w-full"
                          title={p.warehouseName}
                        >
                          <span className="truncate">{p.warehouseName}</span>
                        </span>
                      </td>

                                            {/* Available Stock */}
                      <td style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-right align-middle">
                        <span className={`text-xs font-mono font-bold whitespace-nowrap ${
                          safeStock <= 0 ? 'text-rose-600 font-extrabold' : p.stockStatus === 'Limited Stock' ? 'text-amber-700' : 'text-slate-700'
                        }`}>
                          {formatNumber(safeStock)} {p.unit}
                        </span>
                      </td>

                      {/* Low-Stock Threshold */}
                      <td style={{ width: '120px', minWidth: '100px' }} className="px-3 py-3 text-right align-middle">
                        <span className="text-xs font-mono text-slate-700 font-semibold whitespace-nowrap">
                          {p.warningLimit !== null ? `${formatNumber(p.warningLimit)} ${p.unit}` : <span className="text-slate-400 italic font-normal text-[11px]">Not set</span>}
                        </span>
                      </td>

                      {/* Stock Status */}
                      <td style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-center align-middle">
                        {p.stockStatus === 'Out of Stock' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Out of Stock
                          </span>
                        ) : p.stockStatus === 'Limited Stock' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Limited
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td style={{ width: '90px', minWidth: '80px' }} className="px-2 py-3 text-center align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          safeStock <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {safeStock <= 0 ? 'Critical' : 'High'}
                        </span>
                      </td>

                      {/* Suggested Reorder */}
                      <td style={{ width: '150px', minWidth: '130px' }} className="px-3 py-3 text-right font-mono font-bold text-indigo-600 align-middle">
                        +{formatNumber(p.suggestedQty)} {p.unit}
                      </td>

                      {/* Actions: View Product & Request */}
                      <td style={{ width: '130px', minWidth: '110px' }} className="px-3 py-3 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate('/products?search=' + encodeURIComponent(p.sku || p.name))}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View product in catalog"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSingleRequestModal(p.product)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-transparent font-semibold text-[11px] transition-all cursor-pointer"
                            title={`Create purchase request for ${p.name}`}
                          >
                            <Send className="w-3 h-3" />
                            <span>Request</span>
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

        {/* Pagination Footer */}
        {filteredLowStockProducts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="font-semibold text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="font-semibold text-slate-900">
                  {Math.min(currentPage * pageSize, filteredLowStockProducts.length)}
                </strong>{' '}
                of <strong className="font-semibold text-slate-900">{filteredLowStockProducts.length}</strong> items
              </span>
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-slate-700 font-medium text-xs cursor-pointer shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium shadow-2xs cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="px-2.5 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded-md text-xs shadow-2xs">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium shadow-2xs cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal: Create Multi-Product Purchase Request */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => !isSubmitting && setIsRequestModalOpen(false)}
        title="Create Purchase Request"
        subtitle={`Bundle ${requestItems.length} replenishment ${requestItems.length === 1 ? 'item' : 'items'} for Purchase Manager authorization`}
        size="2xl"
      >
        <form onSubmit={handleSubmitPurchaseRequest} className="space-y-4 py-1">
          {submitSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{submitSuccessMsg}</span>
            </div>
          )}

          {/* Receiving Warehouse, Priority, Date, Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Receiving Hub <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={requestWarehouseId}
                onChange={e => setRequestWarehouseId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {authorizedWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Normal">Normal — Routine replenishment</option>
                <option value="High">High — Threshold approaching</option>
                <option value="Urgent">Urgent — Out of stock / Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Required By Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Replenishment Reason <span className="text-rose-500">*</span>
              </label>
              <input
                ref={reasonInputRef}
                type="text"
                required
                data-testid="replenishment-reason-input"
                placeholder="e.g. Stock at warning limit"
                value={reason}
                onChange={handleReasonChange}
                onFocus={handleReasonFocus}
                onMouseDown={handleReasonMouseDown}
                onMouseUp={handleReasonMouseUp}
                onKeyDown={handleReasonKeyDown}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Requested Products ({requestItems.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Adjust quantities or remove items before sending
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2.5">SKU</th>
                    <th className="py-2.5 px-3 text-right">Stock On Hand</th>
                    <th className="py-2.5 px-3 text-right">Suggested Reorder</th>
                    <th className="py-2.5 px-3 text-right w-36">Requested Qty</th>
                    <th className="py-2.5 px-2 text-center w-12">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No products in this request. Please add products below.
                      </td>
                    </tr>
                  ) : (
                    requestItems.map(item => {
                      const safeStock = Math.max(0, item.currentStock);
                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title={item.product.name}>
                            {item.product.name}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono text-[11px] text-blue-600 font-semibold">
                            {item.product.sku || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={safeStock <= 0 ? 'text-rose-600' : 'text-slate-700'}>
                              {formatNumber(safeStock)} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-bold">
                            +{formatNumber(item.suggestedQty)} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                required
                                value={item.requestedQty}
                                onChange={e => handleUpdateItemQty(item.product.id, Number(e.target.value))}
                                className="w-20 px-2 py-1 bg-white border border-blue-300 rounded-lg text-right font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                              />
                              <span className="text-[11px] text-slate-500 font-medium">{item.unit}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove this item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Additional Product Dropdown */}
          <div className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-semibold text-slate-700 shrink-0">Add Another Product:</span>
            <select
              value={additionalProductId}
              onChange={e => setAdditionalProductId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Select a product to add...</option>
              {products
                .filter(p => !requestItems.some(i => i.product.id === p.id))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || 'No SKU'}) — Available: {p.currentStock} {p.primaryUnit || 'Pcs'}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!additionalProductId}
              onClick={handleAddAdditionalProduct}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
            >
              Add Item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Instructions & Notes for Purchase Manager
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please expedite shipment due to high customer backlog..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Footer with Submit Button */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Total Units:{' '}
              <strong className="text-slate-900 font-bold font-mono">
                {formatNumber(requestItems.reduce((acc, i) => acc + Number(i.requestedQty || 0), 0))}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsRequestModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || requestItems.length === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Purchase Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Purchase Request Details Viewer */}
      {selectedRequestDetails && (
        <Modal
          isOpen={!!selectedRequestDetails}
          onClose={() => setSelectedRequestDetails(null)}
          title={`Purchase Request #${selectedRequestDetails.requestNumber}`}
          subtitle={`Submitted on ${formatDate(selectedRequestDetails.createdAt)} by ${selectedRequestDetails.requesterName || 'Warehouse Manager'}`}
          size="lg"
        >
          <div className="space-y-4 py-1 text-xs">
            {/* Header info card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getRequestStatusBadgeClass(selectedRequestDetails.status)}`}>
                  {selectedRequestDetails.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Priority</span>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] border ${getPriorityBadgeClass(selectedRequestDetails.priority)}`}>
                  {selectedRequestDetails.priority}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Warehouse</span>
                <span className="font-semibold text-slate-800 block truncate mt-0.5">
                  {selectedRequestDetails.warehouseName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Required By</span>
                <span className="font-semibold text-slate-800 block mt-0.5 font-mono">
                  {selectedRequestDetails.requestedDeliveryDate || 'Immediate'}
                </span>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Reason</span>
              <p className="text-slate-800">{selectedRequestDetails.reason || 'Replenishment for depleted stock items'}</p>
              {selectedRequestDetails.notes && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Instructions</span>
                  <p className="text-slate-600 italic">{selectedRequestDetails.notes}</p>
                </div>
              )}
            </div>

            {/* Line items table */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Requested Items ({selectedRequestDetails.items.length})
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-2">SKU</th>
                      <th className="py-2 px-2 text-right">Current Stock</th>
                      <th className="py-2 px-2 text-right">Requested Qty</th>
                      <th className="py-2 px-2 text-right">Approved Qty</th>
                      <th className="py-2 px-2 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequestDetails.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.productName}</td>
                        <td className="py-2 px-2 font-mono text-blue-600 text-[11px]">{item.sku || '—'}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatNumber(item.currentStock)}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {formatNumber(item.requestedQty)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                          {item.approvedQty !== null && item.approvedQty !== undefined ? formatNumber(item.approvedQty) : '—'}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal action */}
            <div className="flex items-center justify-start pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const reqId = selectedRequestDetails.id;
                  setSelectedRequestDetails(null);
                  navigate(`/inventory/purchase-requests?id=${reqId}`);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Open in Full Requests Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
    </div>
  );
};
