import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Search,
  Filter,
  Plus,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpDown,
  FileText,
  Clock,
  Send,
  Loader2,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  Building2,
  Package
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Product, StockStatusType, CreatePurchaseRequestInput, PurchaseRequestPriority } from '../../types';
import { calculateStockStatus } from '../../utils/inventoryUtils';

interface MultiRequestItem {
  product: Product;
  currentStock: number;
  warningLimit: number | null;
  unit: string;
  suggestedQty: number;
  requestedQty: number;
  estimatedCost: number;
}

interface SummaryCardProps {
  title: string;
  count: number;
  description: string;
  icon: React.ElementType;
  iconBgColor: string;
  iconTextColor: string;
  isLoading?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  badgeTooltip?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  count,
  description,
  icon: Icon,
  iconBgColor,
  iconTextColor,
  isLoading,
  isSelected,
  onClick,
  badgeTooltip
}) => {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs min-w-0 ${
        isSelected
          ? 'border-indigo-400 ring-2 ring-indigo-500/15 shadow-xs'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
      } ${onClick ? 'cursor-pointer select-none group' : ''}`}
      title={badgeTooltip || title}
    >
      {/* Top Header: Title at top-left (uppercase, muted blue-gray) & Icon in light-tinted rounded square at top-right */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug group-hover:text-slate-700 transition-colors">
          {title}
        </h2>
        <div
          className={`w-10 h-10 rounded-xl ${iconBgColor} ${iconTextColor} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Numeric count beneath title */}
      <div className="my-3 min-w-0 flex items-baseline">
        {isLoading ? (
          <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight leading-none">
            {formatNumber(count)}
          </span>
        )}
      </div>

      {/* Thin horizontal divider & short explanatory description */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 font-medium leading-relaxed truncate" title={description}>
          {description}
        </p>
        {onClick && (
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition-all shrink-0 -translate-x-0.5 group-hover:translate-x-0" />
        )}
      </div>
    </div>
  );
};

export const StockAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    products,
    warehouses,
    suppliers,
    inventoryTransactions,
    getWarehouseStock,
    createPurchaseRequest,
    purchaseRequests,
    refreshData,
    isLoading,
    error
  } = useERP();

  const isExecutive = profile?.role === 'Owner' || profile?.role === 'Admin';
  const isWarehouseManager = profile?.role === 'Warehouse Manager';

  // 1. Warehouse Scoping: default to assigned warehouse for Warehouse Manager
  const userWarehouse = useMemo(() => {
    if (!isWarehouseManager || !user?.id) return null;
    return warehouses.find(w => w.managerId === user.id || w.managerIds?.includes(user.id)) || null;
  }, [warehouses, user?.id, isWarehouseManager]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    userWarehouse ? userWarehouse.id : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LIMITED_STOCK' | 'ACTIVE' | 'REPLENISHMENT_REQUIRED'>('REPLENISHMENT_REQUIRED');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'stock' | 'warningLimit' | 'name' | 'suggestedQty' | 'movementDate'>('stock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Multi-Selection State for Bulk Purchase Request
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Modal State for Multi-Product Purchase Request
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestItems, setRequestItems] = useState<MultiRequestItem[]>([]);
  const [requestWarehouseId, setRequestWarehouseId] = useState<string>('');
  const [priority, setPriority] = useState<PurchaseRequestPriority>('High');
  const [reason, setReason] = useState<string>('Stock replenishment due to inventory reaching warning limit');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [additionalProductId, setAdditionalProductId] = useState<string>('');
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

  // Helper: Get available stock for a product in the selected warehouse (or aggregated)
  const getProductStock = (product: Product, whId: string): number => {
    let stockVal = 0;
    if (whId === 'ALL') {
      stockVal = Number(product.currentStock || 0);
    } else {
      const wh = warehouses.find(w => w.id === whId);
      if (!wh) stockVal = Number(product.currentStock || 0);
      else stockVal = getWarehouseStock(product.id, wh.code);
    }
    return Math.max(0, stockVal);
  };

  // Helper: Get last movement date for a product
  const getLastMovementDate = (productId: string, whId: string): string | null => {
    const txns = inventoryTransactions.filter(t => {
      if (t.productId !== productId) return false;
      if (whId !== 'ALL') {
        const wh = warehouses.find(w => w.id === whId);
        if (wh && (t as any).warehouseId && (t as any).warehouseId !== wh.id) return false;
      }
      return true;
    });

    if (txns.length === 0) return null;
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  };

  // Extract unique categories and suppliers
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Process and compute stock status for each product
  const enrichedProducts = useMemo(() => {
    return products.map(product => {
      const stock = getProductStock(product, selectedWarehouseId);
      const limit = product.reorderLevel !== undefined && product.reorderLevel !== null
        ? Number(product.reorderLevel)
        : null;

      const status: StockStatusType = calculateStockStatus(stock, limit);

      // Suggested reorder quantity formula:
      // If out of stock: 2x warning limit (minimum 10)
      // If limited stock: (2x warning limit) - currentStock
      // If active: 0
      let suggestedQty = 0;
      const targetLimit = limit && limit > 0 ? limit : 10;
      if (stock <= 0) {
        suggestedQty = Math.max(1, targetLimit * 2);
      } else if (limit !== null && stock <= limit) {
        suggestedQty = Math.max(1, (targetLimit * 2) - stock);
      }

      const lastMovement = getLastMovementDate(product.id, selectedWarehouseId);
      const whName = selectedWarehouseId === 'ALL'
        ? 'All Warehouses'
        : (warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Default Godown');

      return {
        ...product,
        effectiveStock: stock,
        effectiveLimit: limit,
        stockStatus: status,
        suggestedReorderQty: suggestedQty,
        lastMovementDate: lastMovement,
        warehouseName: whName
      };
    });
  }, [products, selectedWarehouseId, warehouses, inventoryTransactions]);

  // Filtered & Sorted List
  const filteredProducts = useMemo(() => {
    let result = enrichedProducts.filter(p => {
      // Status filter
      if (statusFilter === 'OUT_OF_STOCK' && p.stockStatus !== 'Out of Stock') return false;
      if (statusFilter === 'LIMITED_STOCK' && p.stockStatus !== 'Limited Stock') return false;
      if (statusFilter === 'ACTIVE' && p.stockStatus !== 'Active') return false;
      if (statusFilter === 'REPLENISHMENT_REQUIRED' && p.stockStatus !== 'Out of Stock' && p.stockStatus !== 'Limited Stock') return false;

      // Category filter
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;

      // Supplier filter
      if (supplierFilter !== 'ALL' && p.supplierId !== supplierFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku && p.sku.toLowerCase().includes(q);
        const matchesCat = p.category && p.category.toLowerCase().includes(q);
        const matchesBrand = p.brand && p.brand.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCat && !matchesBrand) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'stock') {
        comparison = a.effectiveStock - b.effectiveStock;
      } else if (sortField === 'warningLimit') {
        comparison = (a.effectiveLimit || 0) - (b.effectiveLimit || 0);
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'suggestedQty') {
        comparison = a.suggestedReorderQty - b.suggestedReorderQty;
      } else if (sortField === 'movementDate') {
        const dateA = a.lastMovementDate ? new Date(a.lastMovementDate).getTime() : 0;
        const dateB = b.lastMovementDate ? new Date(b.lastMovementDate).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [enrichedProducts, statusFilter, categoryFilter, supplierFilter, searchQuery, sortField, sortOrder]);

  // Statistics
  const outOfStockCount = useMemo(() => enrichedProducts.filter(p => p.stockStatus === 'Out of Stock').length, [enrichedProducts]);
  const limitedStockCount = useMemo(() => enrichedProducts.filter(p => p.stockStatus === 'Limited Stock').length, [enrichedProducts]);
  const activeStockCount = useMemo(() => enrichedProducts.filter(p => p.stockStatus === 'Active').length, [enrichedProducts]);
  const pendingRequestsCount = useMemo(() => purchaseRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Pending Review' || r.status === 'Under Review').length, [purchaseRequests]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  // Toggle selection for a single product
  const handleToggleSelect = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Toggle select all on current page
  const handleToggleSelectAll = () => {
    const allPageIds = paginatedProducts.map(p => p.id);
    const allSelected = allPageIds.length > 0 && allPageIds.every(id => selectedProductIds.has(id));

    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allPageIds.forEach(id => next.delete(id));
      } else {
        allPageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Select all products currently matching the replenishment filter
  const handleSelectAllReplenishment = () => {
    const replenishmentIds = enrichedProducts
      .filter(p => p.stockStatus === 'Out of Stock' || p.stockStatus === 'Limited Stock')
      .map(p => p.id);
    setSelectedProductIds(new Set(replenishmentIds));
  };

  // Build Multi-Product Request Items and Open Modal
  const openPurchaseRequestModalWithProducts = (prods: Product[]) => {
    const whId = selectedWarehouseId !== 'ALL'
      ? selectedWarehouseId
      : (userWarehouse?.id || warehouses[0]?.id || '');
    setRequestWarehouseId(whId);

    const items: MultiRequestItem[] = prods.map(p => {
      const currentStock = getProductStock(p, whId);
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
        ? 'Replenishment for depleted stock items reaching warning thresholds'
        : 'Routine inventory replenishment for stock at warning levels'
    );
    setSubmitSuccessMsg(null);
    isReasonEditedRef.current = false;
    shouldSelectOnMouseUpRef.current = false;
    setIsRequestModalOpen(true);
  };

  // Open modal from Top Button or Bulk Action Bar
  const handleOpenMultiRequestModal = () => {
    if (selectedProductIds.size === 0) {
      // If nothing selected, prompt or select all currently filtered replenishment items
      const lowStockItems = filteredProducts.filter(p => p.stockStatus === 'Out of Stock' || p.stockStatus === 'Limited Stock');
      if (lowStockItems.length > 0) {
        openPurchaseRequestModalWithProducts(lowStockItems);
      } else if (filteredProducts.length > 0) {
        openPurchaseRequestModalWithProducts([filteredProducts[0]]);
      } else {
        alert('No replenishment products available to create a purchase request.');
      }
      return;
    }

    const selectedProds = products.filter(p => selectedProductIds.has(p.id));
    openPurchaseRequestModalWithProducts(selectedProds);
  };

  // Open modal for a single product from table row
  const handleOpenSingleProductRequest = (product: Product) => {
    openPurchaseRequestModalWithProducts([product]);
  };

  // Update requested quantity for a line item in modal
  const handleUpdateItemQty = (productId: string, qty: number) => {
    setRequestItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, requestedQty: Math.max(1, qty) } : item
      )
    );
  };

  // Remove a line item from modal
  const handleRemoveItem = (productId: string) => {
    setRequestItems(prev => {
      const next = prev.filter(item => item.product.id !== productId);
      return next;
    });
  };

  // Add additional product to modal line items
  const handleAddAdditionalProduct = () => {
    if (!additionalProductId) return;
    const prod = products.find(p => p.id === additionalProductId);
    if (!prod) return;

    if (requestItems.some(i => i.product.id === prod.id)) {
      alert(`"${prod.name}" is already included in this request.`);
      return;
    }

    const currentStock = getProductStock(prod, requestWarehouseId);
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

  // Refresh latest balances
  const handleRefreshBalances = async () => {
    setIsRefreshing(true);
    try {
      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      console.warn('Failed to refresh inventory balances:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Submit Multi-Product Purchase Request
  const handleSubmitPurchaseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestItems.length === 0) {
      alert('Please add at least one product to the purchase request.');
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
      alert('Please select a valid receiving warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePurchaseRequestInput = {
        warehouseId: targetWh.id,
        warehouseName: targetWh.name,
        priority,
        reason: reason.trim() || 'Inventory replenishment for low-stock items',
        requestedDeliveryDate: deliveryDate,
        notes: '',
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
      setSubmitSuccessMsg(`Purchase Request #${created.requestNumber} containing ${requestItems.length} products submitted successfully to Purchase Manager!`);
      setSelectedProductIds(new Set());

      setTimeout(() => {
        setIsRequestModalOpen(false);
        setIsSubmitting(false);
        setSubmitSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert(`Failed to submit purchase request: ${err.message}`);
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Low Stock & Reorder
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock monitoring, warning limit thresholds, and automated replenishment workflows
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await refreshData();
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh inventory counts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Database Error Banner if any */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={() => refreshData()}
            className="text-xs font-semibold text-rose-800 underline hover:text-rose-950 shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Four Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <SummaryCard
          title="OUT OF STOCK"
          count={outOfStockCount}
          description="Zero or negative available balance"
          icon={AlertCircle}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          isLoading={isLoading}
          isSelected={statusFilter === 'OUT_OF_STOCK'}
          onClick={() => {
            setStatusFilter(prev => prev === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK');
            setCurrentPage(1);
          }}
          badgeTooltip="Filter by Out of Stock products"
        />
        <SummaryCard
          title="LIMITED STOCK"
          count={limitedStockCount}
          description="At or below warning threshold"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          isLoading={isLoading}
          isSelected={statusFilter === 'LIMITED_STOCK'}
          onClick={() => {
            setStatusFilter(prev => prev === 'LIMITED_STOCK' ? 'ALL' : 'LIMITED_STOCK');
            setCurrentPage(1);
          }}
          badgeTooltip="Filter by Limited Stock products"
        />
        <SummaryCard
          title="HEALTHY STOCK"
          count={activeStockCount}
          description="Adequate stock above limit"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          isLoading={isLoading}
          isSelected={statusFilter === 'ACTIVE'}
          onClick={() => {
            setStatusFilter(prev => prev === 'ACTIVE' ? 'ALL' : 'ACTIVE');
            setCurrentPage(1);
          }}
          badgeTooltip="Filter by Healthy Stock products"
        />
        <SummaryCard
          title="PENDING PURCHASE REQUESTS"
          count={pendingRequestsCount}
          description="Awaiting Purchase Manager review"
          icon={Clock}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          isLoading={isLoading}
          onClick={() => navigate('/purchases/requests')}
          badgeTooltip="View Purchase Requests in review workflow"
        />
      </div>

      {/* Bulk Selection Sticky Bar */}
      {selectedProductIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-950 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {selectedProductIds.size}
            </span>
            <div>
              <span className="font-bold text-slate-900 block text-xs">
                {selectedProductIds.size} {selectedProductIds.size === 1 ? 'Product' : 'Products'} Selected for Replenishment
              </span>
              <span className="text-[11px] text-slate-600">
                You can bundle these products into a single purchase request for the Purchase Manager.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectedProductIds(new Set())}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={handleOpenMultiRequestModal}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Create Purchase Request ({selectedProductIds.size} Items)</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products by name, SKU, category, brand..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedWarehouseId}
                onChange={e => {
                  setSelectedWarehouseId(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Warehouses / Godowns</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={categoryFilter}
                onChange={e => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Filter */}
            {suppliers && suppliers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={supplierFilter}
                  onChange={e => {
                    setSupplierFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortField}
                onChange={e => setSortField(e.target.value as any)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="stock">Sort by Stock Overview</option>
                <option value="warningLimit">Sort by Warning Limit</option>
                <option value="suggestedQty">Sort by Suggested Reorder</option>
                <option value="name">Sort by Product Name</option>
                <option value="movementDate">Sort by Movement Date</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-1 cursor-pointer"
                title="Toggle Sort Direction"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => { setStatusFilter('REPLENISHMENT_REQUIRED'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'REPLENISHMENT_REQUIRED'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Replenishment Required ({outOfStockCount + limitedStockCount})
            </button>
            <button
              onClick={() => { setStatusFilter('OUT_OF_STOCK'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'OUT_OF_STOCK'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
            <button
              onClick={() => { setStatusFilter('LIMITED_STOCK'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'LIMITED_STOCK'
                  ? 'bg-white text-amber-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Limited Stock ({limitedStockCount})
            </button>
            <button
              onClick={() => { setStatusFilter('ACTIVE'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Stock ({activeStockCount})
            </button>
            <button
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Products ({enrichedProducts.length})
            </button>
          </div>


        </div>
      </div>

      {/* Low Stock & Reorder Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                {/* Select All Checkbox */}
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.has(p.id))}
                    onChange={handleToggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    title="Select all on this page"
                  />
                </th>
                <th className="py-3 px-4 min-w-[200px]">Product Name</th>
                <th className="py-3 px-3 whitespace-nowrap">SKU / Code</th>
                <th className="py-3 px-3 whitespace-nowrap">Warehouse</th>
                <th className="py-3 px-3.5 whitespace-nowrap min-w-[140px] text-left">Stock Overview</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Suggested Reorder</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No products match current criteria</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {statusFilter === 'REPLENISHMENT_REQUIRED'
                        ? 'All products currently have healthy stock above their warning limits.'
                        : 'Try adjusting your search query, warehouse, or category filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map(product => {
                  const isZeroOrNegative = product.effectiveStock <= 0;
                  const isLimited = product.stockStatus === 'Limited Stock';
                  const isSelected = selectedProductIds.has(product.id);

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/60'
                          : isZeroOrNegative
                          ? 'bg-rose-50/30'
                          : isLimited
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Product Name */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 block truncate" title={product.name}>
                              {product.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.brand && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {product.brand}
                                </span>
                              )}
                              {product.category && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {product.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU / Code */}
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {product.sku || '—'}
                      </td>

                      {/* Warehouse */}
                      <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{product.warehouseName}</span>
                        </div>
                      </td>

                      {/* Stock Overview (Status on Top, Quantity + Unit Centered Below Badge) */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="inline-flex flex-col items-center gap-1">
                          <StatusBadge status={product.stockStatus} size="sm" />
                          <span
                            className={`font-mono font-bold text-xs tabular-nums text-center leading-tight whitespace-nowrap ${
                              isZeroOrNegative
                                ? 'text-rose-600'
                                : isLimited
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {formatNumber(Math.max(0, product.effectiveStock))} {product.primaryUnit || 'Piece'}
                          </span>
                        </div>
                      </td>

                      {/* Suggested Reorder Qty */}
                      <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                        {product.suggestedReorderQty > 0 ? (
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            +{formatNumber(product.suggestedReorderQty)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Quick Action: Request Replenishment */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenSingleProductRequest(product)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition-colors cursor-pointer"
                          title="Create replenishment request for this product"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Request</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-slate-50/60 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} items
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-bold px-2 text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Multi-Product Purchase Request */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => !isSubmitting && setIsRequestModalOpen(false)}
        title="Create Purchase Request"
        subtitle={`Bundle ${requestItems.length} replenishment ${requestItems.length === 1 ? 'item' : 'items'} for Purchase Manager authorization`}
        size="2xl"
        noBodyScroll={true}
        bodyClassName="p-4 sm:p-5 flex flex-col"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsRequestModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="create-purchase-request-form"
              disabled={isSubmitting || requestItems.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Purchase Manager</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <form
          id="create-purchase-request-form"
          onSubmit={handleSubmitPurchaseRequest}
          className="flex flex-col flex-1 min-h-0 space-y-3"
        >
          {submitSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium animate-fadeIn shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{submitSuccessMsg}</span>
            </div>
          )}

          {/* Receiving Warehouse, Priority, Date, Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs shrink-0">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Receiving Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={requestWarehouseId}
                onChange={e => setRequestWarehouseId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {warehouses.map(w => (
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
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                placeholder="e.g. Low stock alert threshold"
                value={reason}
                onChange={handleReasonChange}
                onFocus={handleReasonFocus}
                onMouseDown={handleReasonMouseDown}
                onMouseUp={handleReasonMouseUp}
                onKeyDown={handleReasonKeyDown}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Requested Products ({requestItems.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                You can adjust quantities or remove items before sending
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-auto flex-1 min-h-[140px] max-h-[46vh] shadow-2xs">
              <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                <thead className="bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase text-[10px] sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2.5 whitespace-nowrap">SKU</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Current Stock</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Warning Limit</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">Unit</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Suggested</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap w-36">Requested Qty</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap w-12">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No products in this request. Please add products below.
                      </td>
                    </tr>
                  ) : (
                    requestItems.map(item => (
                      <tr key={item.product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900" title={item.product.name}>
                          {item.product.name}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-blue-600 whitespace-nowrap">
                          {item.product.sku || '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                          <span className={item.currentStock <= 0 ? 'text-rose-600' : 'text-slate-700'}>
                            {formatNumber(item.currentStock)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                          {item.warningLimit !== null ? formatNumber(item.warningLimit) : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {item.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-indigo-600 font-semibold whitespace-nowrap">
                          +{formatNumber(item.suggestedQty)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              required
                              value={item.requestedQty}
                              onChange={e => handleUpdateItemQty(item.product.id, Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-white border border-indigo-300 rounded-lg text-right font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-xs"
                            />
                            <span className="text-[10px] text-slate-500 font-medium min-w-[32px] text-left">{item.unit}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove this item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Additional Product on the fly */}
          <div className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs shrink-0">
            <span className="font-semibold text-slate-700 shrink-0">Add Another Product:</span>
            <select
              value={additionalProductId}
              onChange={e => setAdditionalProductId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="">Select a product to add...</option>
              {products
                .filter(p => !requestItems.some(i => i.product.id === p.id))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || 'No SKU'}) — Stock: {p.currentStock} {p.primaryUnit || 'Pcs'}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={handleAddAdditionalProduct}
              disabled={!additionalProductId}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 font-semibold rounded-lg text-xs shrink-0 cursor-pointer"
            >
              + Add Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockAlertsPage;
