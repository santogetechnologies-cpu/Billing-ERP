import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
  Plus,
  TrendingUp,
  Building,
  Clock,
  Search,
  ArrowRight,
  Package,
  DollarSign,
  AlertCircle,
  Filter,
  CheckCircle2,
  Eye,
  Receipt,
  ShoppingCart
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { InventoryTransaction } from '../../types';
import { Modal } from '../../components/common/Modal';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { sortNotifications } from '../../services/notificationService';
import { SalespersonInventoryPage } from './SalespersonInventoryPage';

export const InventoryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  // Strict Least-Privilege Scoping: Salespersons are served a dedicated, view-only stock directory
  if (profile?.role === 'Salesperson') {
    return <SalespersonInventoryPage />;
  }

  const {
    products,
    inventoryTransactions,
    warehouses,
    adjustStock,
    batches,
    purchaseInvoices,
    getWarehouseStock,
    notifications,
    markNotificationAsRead
  } = useERP();

  const { user } = useAuth();
  const isExecutive = profile?.role === 'Owner' || profile?.role === 'Admin';
  const isWarehouseManager = profile?.role === 'Warehouse Manager';

  const managedWarehouseIds = useMemo(() => {
    if (isExecutive) return warehouses.map(w => w.id);
    return warehouses
      .filter(w => w.managerId === user?.id || w.managerIds?.includes(user?.id || ''))
      .map(w => w.id);
  }, [warehouses, user?.id, isExecutive]);

  // Low stock alerts targeted strictly to the warehouses this manager is authorized to oversee
  const relevantStockAlerts = useMemo(() => {
    const list = notifications.filter(n => {
      const isAlert = n.type === 'low_stock' || n.type === 'limited_stock' || n.type === 'out_of_stock';
      if (!isAlert) return false;
      if (n.userId && user?.id) return n.userId === user.id;
      if (n.warehouseId && managedWarehouseIds.includes(n.warehouseId)) return true;
      return false;
    });
    return sortNotifications(list);
  }, [notifications, user?.id, managedWarehouseIds]);

  const [valuationMethod, setValuationMethod] = useState<'FIFO' | 'Weighted Average'>('FIFO');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Drilldown Modal for 6 KPI Cards + 3 Valuation Drilldowns
  const [stockModal, setStockModal] = useState<
    | 'total_stock'
    | 'stock_value'
    | 'low_stock'
    | 'out_of_stock'
    | 'overstocked'
    | 'expiring'
    | 'opening_stock'
    | 'period_purchases'
    | 'valuation_cogs'
    | null
  >(null);
  const [stockModalSearch, setStockModalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalKpiTab, setModalKpiTab] = useState<'units' | 'skus' | 'warehouses' | 'valuation'>('units');
  const [modalWarehouseFilter, setModalWarehouseFilter] = useState<string>('ALL');
  const [valuationSearch, setValuationSearch] = useState('');
  const [openingSearch, setOpeningSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');

  // Main Page View Mode: Operational Stock vs Movement Ledger
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');

  // Operational Stock Filters & Pagination
  const [opSearch, setOpSearch] = useState('');
  const [opWarehouse, setOpWarehouse] = useState('ALL');
  const [opCategory, setOpCategory] = useState('ALL');
  const [opStatus, setOpStatus] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [opSort, setOpSort] = useState<'qty_desc' | 'qty_asc' | 'name_asc' | 'threshold_desc'>('qty_desc');
  const [opPage, setOpPage] = useState(1);
  const opPageSize = 10;
  const [movementProductFilter, setMovementProductFilter] = useState<string | null>(null);

  // Adjustment Modal State
  const [adjustProductId, setAdjustProductId] = useState(products[0]?.id || '');
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState('Physical audit variance / Damage write-off');
  const [adjustWarehouse, setAdjustWarehouse] = useState(warehouses[0]?.code || warehouses[0]?.name || '');

  // Helper to open adjustment modal for a specific product
  const openAdjustForProduct = (productId: string) => {
    setAdjustProductId(productId);
    setAdjustQty('');
    setStockModal(null);
    setIsAdjustModalOpen(true);
  };

  // Preserve originating route when opened through /inventory/adjustments route
  const originatingRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname === '/inventory/adjustments') {
      if (!originatingRouteRef.current) {
        const fromState = (location.state as any)?.from;
        let savedRoute: string | null = null;
        try {
          savedRoute = sessionStorage.getItem('ub_originating_route');
        } catch {}
        const resolved = fromState || (savedRoute && savedRoute !== '/inventory/adjustments' ? savedRoute : null);
        originatingRouteRef.current = resolved;
      }
      setIsAdjustModalOpen(true);
    } else {
      originatingRouteRef.current = null;
    }
  }, [location.pathname, location.state]);

  const handleCloseAdjustModal = () => {
    setIsAdjustModalOpen(false);
    setAdjustQty('');
    if (location.pathname === '/inventory/adjustments') {
      const target = originatingRouteRef.current;
      originatingRouteRef.current = null;
      if (target && target !== '/inventory/adjustments') {
        navigate(target, { replace: true });
      } else if (window.history.length > 1) {
        navigate(-1);
      }
    }
  };

  // Inventory Cards Metrics (Prompt #18)
  const totalStockUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + p.currentStock, 0);
  }, [products]);

  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + p.currentStock * p.costPrice, 0);
  }, [products]);

  // Authentic FIFO vs Weighted Average Cost Valuation Engine (AS-2 / Ind AS 2)
  const valuationData = useMemo(() => {
    const purchasesInPeriod = purchaseInvoices
      .filter(p => p.docType !== 'purchase_return')
      .reduce((acc, p) => acc + (p.grandTotal || 0), 0);

    const openingStockVal = products.reduce(
      (acc, p) => acc + (p.openingStock || 0) * (p.costPrice || 0),
      0
    );

    // Inward purchases map
    const purchasesByProduct = new Map<string, { totalQty: number; totalCost: number; latestUnitPrice: number }>();
    purchaseInvoices.forEach(pur => {
      if (pur.docType !== 'purchase_return') {
        pur.items?.forEach(item => {
          const qty = item.qty || 1;
          const unitPrice = item.rate || (qty > 0 ? (item.total || 0) / qty : 0);
          const totalCost = item.total || qty * unitPrice;
          const existing = purchasesByProduct.get(item.productId) || {
            totalQty: 0,
            totalCost: 0,
            latestUnitPrice: unitPrice
          };
          purchasesByProduct.set(item.productId, {
            totalQty: existing.totalQty + qty,
            totalCost: existing.totalCost + totalCost,
            latestUnitPrice: unitPrice || existing.latestUnitPrice
          });
        });
      }
    });

    // Batches map (if batch tracked)
    const batchesByProduct = new Map<string, { totalQty: number; totalCost: number; latestBatchCost: number }>();
    batches.forEach(b => {
      const bQty = b.qty || 0;
      const bCost = b.cost || 0;
      const existing = batchesByProduct.get(b.productId) || {
        totalQty: 0,
        totalCost: 0,
        latestBatchCost: bCost
      };
      batchesByProduct.set(b.productId, {
        totalQty: existing.totalQty + bQty,
        totalCost: existing.totalCost + bQty * bCost,
        latestBatchCost: bCost || existing.latestBatchCost
      });
    });

    // Per-SKU valuation calculations
    const items = products.map(prod => {
      const opQty = prod.openingStock || 0;
      const opCost = opQty * (prod.costPrice || 0);

      const purInfo = purchasesByProduct.get(prod.id);
      const purQty = purInfo?.totalQty || 0;
      const purCost = purInfo?.totalCost || 0;

      const batchInfo = batchesByProduct.get(prod.id);
      const batchQty = batchInfo?.totalQty || 0;
      const batchCost = batchInfo?.totalCost || 0;

      const totalInwardUnits = opQty + purQty + batchQty;
      const totalInwardCost = opCost + purCost + batchCost;

      // Weighted Average Unit Cost = Total Inward Cost / Total Inward Units
      const weightedAvgCost = totalInwardUnits > 0 ? totalInwardCost / totalInwardUnits : (prod.costPrice || 0);

      // FIFO Unit Cost (Recent acquisition cost, falling back to base cost price)
      const fifoCost = purInfo?.latestUnitPrice || batchInfo?.latestBatchCost || (prod.costPrice || 0);

      const fifoValue = prod.currentStock * fifoCost;
      const weightedAvgValue = prod.currentStock * weightedAvgCost;

      return {
        product: prod,
        currentStock: prod.currentStock,
        openingStock: opQty,
        costPrice: prod.costPrice || 0,
        openingValue: opCost,
        fifoCost,
        weightedAvgCost,
        fifoValue,
        weightedAvgValue,
        activeValue: valuationMethod === 'FIFO' ? fifoValue : weightedAvgValue,
        activeUnitCost: valuationMethod === 'FIFO' ? fifoCost : weightedAvgCost,
        variance: fifoValue - weightedAvgValue
      };
    });

    const totalFifoVal = items.reduce((acc, i) => acc + i.fifoValue, 0);
    const totalWeightedAvgVal = items.reduce((acc, i) => acc + i.weightedAvgValue, 0);
    const closingStockVal = valuationMethod === 'FIFO' ? totalFifoVal : totalWeightedAvgVal;
    const computedCogs = Math.max(0, openingStockVal + purchasesInPeriod - closingStockVal);

    return {
      purchasesInPeriod,
      openingStockVal,
      totalFifoVal,
      totalWeightedAvgVal,
      closingStockVal,
      computedCogs,
      items
    };
  }, [products, purchaseInvoices, batches, valuationMethod]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => calculateStockStatus(p.currentStock, p.reorderLevel) === 'Limited Stock');
  }, [products]);

  const lowStockCount = lowStockProducts.length;

  const outOfStockProducts = useMemo(() => {
    return products.filter(p => p.currentStock <= 0);
  }, [products]);

  const outOfStockCount = outOfStockProducts.length;

  const overstockProducts = useMemo(() => {
    return products.filter(p => p.reorderLevel !== null && p.reorderLevel !== undefined && p.currentStock > p.reorderLevel * 4);
  }, [products]);

  const overstockCount = overstockProducts.length;

  const expiringBatchesList = useMemo(() => {
    return batches.filter(b => b.status === 'Expiring Soon' || b.status === 'Expired');
  }, [batches]);

  const expiringCount = expiringBatchesList.length;

  // Filtered products for Total Stock and Valuation modals
  const filteredModalProducts = useMemo(() => {
    let list = products.filter(p => {
      const matchesSearch =
        !stockModalSearch ||
        p.name.toLowerCase().includes(stockModalSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(stockModalSearch.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(stockModalSearch.toLowerCase());
      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;

      let matchesWarehouse = true;
      if (modalWarehouseFilter !== 'ALL') {
        const whStock = getWarehouseStock(modalWarehouseFilter, p.id);
        matchesWarehouse = whStock > 0;
      }

      return matchesSearch && matchesCat && matchesWarehouse;
    });

    if (modalKpiTab === 'units') {
      return [...list].sort((a, b) => b.currentStock - a.currentStock);
    } else if (modalKpiTab === 'valuation') {
      return [...list].sort((a, b) => b.currentStock * b.costPrice - a.currentStock * a.costPrice);
    } else if (modalKpiTab === 'skus') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (modalKpiTab === 'warehouses' && modalWarehouseFilter !== 'ALL') {
      return [...list].sort(
        (a, b) => getWarehouseStock(modalWarehouseFilter, b.id) - getWarehouseStock(modalWarehouseFilter, a.id)
      );
    }
    return list;
  }, [products, stockModalSearch, categoryFilter, modalKpiTab, modalWarehouseFilter, getWarehouseStock]);

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredOperationalStock = useMemo(() => {
    let list = products.map(prod => {
      let availableQty = 0;
      let warehouseLabel = 'All Hubs';
      if (opWarehouse === 'ALL') {
        availableQty = Number(prod.currentStock || 0);
      } else {
        const wh = warehouses.find(w => w.id === opWarehouse || w.code === opWarehouse);
        warehouseLabel = wh ? wh.name : 'Selected Hub';
        availableQty = getWarehouseStock(opWarehouse, prod.id);
      }

      const status = calculateStockStatus(availableQty, prod.reorderLevel);

      return {
        product: prod,
        availableQty,
        warehouseLabel,
        status,
        reorderLevel: prod.reorderLevel ?? null
      };
    });

    // Filter by search
    if (opSearch.trim()) {
      const q = opSearch.toLowerCase();
      list = list.filter(item =>
        item.product.name.toLowerCase().includes(q) ||
        (item.product.sku && item.product.sku.toLowerCase().includes(q)) ||
        (item.product.barcode && item.product.barcode.toLowerCase().includes(q)) ||
        (item.product.category && item.product.category.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (opCategory !== 'ALL') {
      list = list.filter(item => item.product.category === opCategory);
    }

    // Filter by stock status
    if (opStatus === 'IN_STOCK') {
      list = list.filter(item => item.status === 'Active');
    } else if (opStatus === 'LOW_STOCK') {
      list = list.filter(item => item.status === 'Limited Stock');
    } else if (opStatus === 'OUT_OF_STOCK') {
      list = list.filter(item => item.status === 'Out of Stock');
    }

    // Sort
    list.sort((a, b) => {
      if (opSort === 'qty_desc') return b.availableQty - a.availableQty;
      if (opSort === 'qty_asc') return a.availableQty - b.availableQty;
      if (opSort === 'name_asc') return a.product.name.localeCompare(b.product.name);
      if (opSort === 'threshold_desc') return (b.reorderLevel || 0) - (a.reorderLevel || 0);
      return 0;
    });

    return list;
  }, [products, opWarehouse, opSearch, opCategory, opStatus, opSort, warehouses, getWarehouseStock]);

  const totalOpPages = Math.ceil(filteredOperationalStock.length / opPageSize) || 1;
  const paginatedOpStock = useMemo(() => {
    const start = (opPage - 1) * opPageSize;
    return filteredOperationalStock.slice(start, start + opPageSize);
  }, [filteredOperationalStock, opPage, opPageSize]);

  const displayMovementTransactions = useMemo(() => {
    if (!movementProductFilter) return inventoryTransactions;
    const q = movementProductFilter.toLowerCase();
    return inventoryTransactions.filter(t =>
      (t.productName && t.productName.toLowerCase().includes(q)) ||
      (t.productId && t.productId.toLowerCase() === q)
    );
  }, [inventoryTransactions, movementProductFilter]);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adjustQty.trim();
    if (!adjustProductId || trimmed === '' || trimmed === '-' || trimmed === '+') {
      alert('Please specify an adjustment quantity (positive to add, negative to write-off).');
      return;
    }

    const num = Number(trimmed);
    if (isNaN(num) || num === 0) {
      alert('Please specify a valid non-zero adjustment quantity (e.g. +10 or -5).');
      return;
    }

    adjustStock(adjustProductId, num, adjustReason, adjustWarehouse);
    handleCloseAdjustModal();
  };

  const columns: Column<InventoryTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: row => new Date(row.date).getTime(),
      width: '11%',
      minWidth: '115px',
      align: 'left',
      render: row => (
        <span
          className="font-medium text-slate-700 whitespace-nowrap block text-xs"
          title={formatDate(row.date)}
        >
          {formatDate(row.date)}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: row => row.type,
      width: '12%',
      minWidth: '125px',
      align: 'left',
      render: row => {
        const typeStyleMap: Record<string, { bg: string; text: string; border: string }> = {
          'Sale': {
            bg: 'bg-rose-50',
            text: 'text-rose-700',
            border: 'border-rose-200'
          },
          'Purchase': {
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            border: 'border-emerald-200'
          },
          'Opening Stock': {
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            border: 'border-emerald-200'
          },
          'Stock Transfer': {
            bg: 'bg-indigo-50',
            text: 'text-indigo-700',
            border: 'border-indigo-200'
          },
          'Stock Adjustment': {
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            border: 'border-amber-200'
          },
          'Sales Return': {
            bg: 'bg-sky-50',
            text: 'text-sky-700',
            border: 'border-sky-200'
          },
          'Purchase Return': {
            bg: 'bg-orange-50',
            text: 'text-orange-700',
            border: 'border-orange-200'
          },
          'Stock Consumption': {
            bg: 'bg-purple-50',
            text: 'text-purple-700',
            border: 'border-purple-200'
          }
        };

        const style = typeStyleMap[row.type] || {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200'
        };

        return (
          <span
            className={`inline-flex items-center justify-center px-2 py-0.5 min-h-[22px] rounded-md text-[11px] font-semibold border whitespace-nowrap tracking-wide leading-none ${style.bg} ${style.text} ${style.border}`}
            title={row.type}
          >
            {row.type}
          </span>
        );
      }
    },
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      sortValue: row => row.productName?.toLowerCase(),
      width: '19%',
      minWidth: '160px',
      align: 'left',
      render: row => (
        <span
          className="font-semibold text-slate-900 text-xs block truncate"
          title={row.productName}
        >
          {row.productName}
        </span>
      )
    },
    {
      key: 'qty',
      header: 'Movement',
      sortable: true,
      sortValue: row => {
        let q = Number(row.qty) || 0;
        if (
          (row.type === 'Sale' || row.type === 'Purchase Return' || row.type === 'Stock Consumption') &&
          q > 0
        ) {
          q = -q;
        }
        return q;
      },
      align: 'center',
      width: '12%',
      minWidth: '100px',
      render: row => {
        let rawQty = Number(row.qty) || 0;
        // Sales, Purchase Returns, and Stock Consumptions are outward stock movements
        if (
          (row.type === 'Sale' || row.type === 'Purchase Return' || row.type === 'Stock Consumption') &&
          rawQty > 0
        ) {
          rawQty = -rawQty;
        }

        const isPositive = rawQty > 0;
        const isNegative = rawQty < 0;
        const absQtyFormatted = formatNumber(Math.abs(rawQty));

        const prefix = isPositive ? '+' : isNegative ? '-' : '';
        const colorClass = isPositive
          ? 'text-emerald-600 font-bold'
          : isNegative
          ? 'text-rose-600 font-bold'
          : 'text-slate-500 font-medium';

        const unit = row.unit || 'Piece';

        return (
          <div className="flex flex-col items-center justify-center gap-0.5 whitespace-nowrap text-center py-0.5">
            <span className={`text-xs font-mono font-bold tabular-nums leading-tight ${colorClass}`}>
              {prefix}{absQtyFormatted}
            </span>
            <span className="text-[11px] font-sans font-medium text-slate-500 leading-tight">
              {unit}
            </span>
          </div>
        );
      }
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      sortable: true,
      sortValue: row => {
        const wh = warehouses.find(w => w.id === row.warehouse || w.code === row.warehouse);
        return (wh ? wh.name : row.warehouse || 'Central').toLowerCase();
      },
      width: '15%',
      minWidth: '140px',
      align: 'left',
      render: row => {
        const wh = warehouses.find(w => w.id === row.warehouse || w.code === row.warehouse);
        const whLabel = wh ? wh.name : row.warehouse || 'Central';
        return (
          <span
            className="inline-flex items-center px-2.5 py-0.5 h-6 rounded-md bg-slate-100 text-slate-700 border border-slate-200/90 text-[11px] font-medium max-w-full truncate"
            title={wh ? `${wh.name} (${wh.code || ''})` : whLabel}
          >
            <span className="truncate">{whLabel}</span>
          </span>
        );
      }
    },
    {
      key: 'referenceDoc',
      header: 'Reference',
      sortable: true,
      sortValue: row => (row.referenceDoc || '').toLowerCase(),
      width: '14%',
      minWidth: '145px',
      align: 'left',
      render: row => (
        <span
          className="font-mono text-xs font-semibold text-slate-800 whitespace-nowrap block truncate"
          title={row.referenceDoc || '—'}
        >
          {row.referenceDoc || '—'}
        </span>
      )
    },
    {
      key: 'notes',
      header: 'Remarks',
      sortable: true,
      sortValue: row => (row.notes || '').toLowerCase(),
      width: '17%',
      minWidth: '150px',
      align: 'left',
      render: row => (
        <span
          className="text-xs text-slate-600 block truncate"
          title={row.notes || '—'}
        >
          {row.notes || '—'}
        </span>
      )
    }
  ];




  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="truncate">Stock Overview & Operational Inventory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Real-time physical stock levels, multi-warehouse availability, reorder thresholds, and movement audit ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            onClick={() => navigate('/inventory/valuation')}
            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Stock Valuation</span>
          </button>

          <button
            onClick={() => navigate('/inventory/warehouses')}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Warehouses ({warehouses.length})</span>
          </button>

          <button
            onClick={() => navigate('/inventory/transfers')}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Stock Transfers</span>
          </button>

          <button
            onClick={() => {
              setAdjustQty('');
              setIsAdjustModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* Targeted Low Stock & Limited Stock Alerts for Assigned Warehouse Manager */}
      {relevantStockAlerts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Low Stock Alerts ({relevantStockAlerts.filter(a => !a.read).length} Unread)</span>
              <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {isExecutive ? 'All Managed Hubs' : 'Your Assigned Warehouses'}
              </span>
            </div>
            <button
              onClick={() => {
                relevantStockAlerts.forEach(a => markNotificationAsRead(a.id));
              }}
              className="text-xs text-amber-800 hover:text-amber-950 font-semibold underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {relevantStockAlerts.slice(0, 6).map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border transition-all bg-white flex flex-col justify-between ${
                  alert.read ? 'border-amber-200/60 opacity-75' : 'border-amber-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900 truncate">{alert.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{alert.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                </div>
                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-xs">
                  {alert.link && (
                    <button
                      onClick={() => navigate(alert.link!)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Product
                    </button>
                  )}
                  {!alert.read && (
                    <button
                      onClick={() => markNotificationAsRead(alert.id)}
                      className="text-slate-500 hover:text-slate-800 ml-auto font-medium"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 Inventory KPI Summary Cards - Interactive Action Buttons (Prompt #18) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-stretch">
        <StatCard
          title="Total Stock"
          value={`${formatNumber(totalStockUnits)} Units`}
          subtitle="Across All Hubs"
          icon={Boxes}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => setStockModal('total_stock')}
        />
        <StatCard
          title="Stock Value"
          value={formatCurrency(valuationData.closingStockVal)}
          subtitle={`${valuationMethod} Asset Value`}
          icon={Boxes}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => setStockModal('stock_value')}
        />
        <StatCard
          title="Low Stock"
          value={`${lowStockCount} Products`}
          subtitle="Below safety buffer"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => setStockModal('low_stock')}
        />
        <StatCard
          title="Out of Stock"
          value={`${outOfStockCount} Products`}
          subtitle="Zero on-hand balance"
          icon={AlertTriangle}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          onClick={() => setStockModal('out_of_stock')}
        />
        <StatCard
          title="Overstocked"
          value={`${overstockCount} SKUs`}
          subtitle="Excess working capital"
          icon={Layers}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          onClick={() => setStockModal('overstocked')}
        />
        <StatCard
          title="Expiring Batches"
          value={`${expiringCount} Batches`}
          subtitle="Requires priority dispatch"
          icon={Clock}
          iconBgColor="bg-orange-50"
          iconTextColor="text-orange-600"
          onClick={() => setStockModal('expiring')}
        />
      </div>

      {/* Financial Valuation Banner (Directs to Stock Valuation) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-4.5 rounded-xl border border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Financial Inventory Valuation Report
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {valuationMethod} Cost Basis
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Closing Stock Valuation: <strong className="text-emerald-400 font-mono">{formatCurrency(valuationData.closingStockVal)}</strong> • Period COGS: <strong className="text-blue-300 font-mono">{formatCurrency(valuationData.computedCogs)}</strong> • Inward Purchases: <strong className="text-slate-200 font-mono">{formatCurrency(valuationData.purchasesInPeriod)}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/inventory/valuation')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <span>Open Full Stock Valuation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Operational View Switcher / Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-4 pt-3 gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Physical Stock & Availability</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                activeTab === 'stock' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {filteredOperationalStock.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'movements'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Stock Movement Ledger</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                activeTab === 'movements' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {displayMovementTransactions.length}
              </span>
            </button>
          </div>

          {activeTab === 'movements' && movementProductFilter && (
            <div className="flex items-center gap-2 pb-2 text-xs">
              <span className="text-slate-600">
                Filtered: <strong className="text-slate-900 font-semibold">{movementProductFilter}</strong>
              </span>
              <button
                onClick={() => setMovementProductFilter(null)}
                className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Physical Stock & Availability */}
        {activeTab === 'stock' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filters Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search product name, SKU, barcode..."
                  value={opSearch}
                  onChange={e => {
                    setOpSearch(e.target.value);
                    setOpPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Dropdowns Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Warehouse Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={opWarehouse}
                    onChange={e => {
                      setOpWarehouse(e.target.value);
                      setOpPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Hubs & Godowns</option>
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
                    value={opCategory}
                    onChange={e => {
                      setOpCategory(e.target.value);
                      setOpPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {productCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Status Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={opStatus}
                    onChange={e => {
                      setOpStatus(e.target.value as any);
                      setOpPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Stock Statuses</option>
                    <option value="IN_STOCK">In Stock</option>
                    <option value="LOW_STOCK">Low Stock</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                  </select>
                </div>

                {/* Sort Option */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <select
                    value={opSort}
                    onChange={e => {
                      setOpSort(e.target.value as any);
                      setOpPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="qty_desc">Sort: Stock Qty (High to Low)</option>
                    <option value="qty_asc">Sort: Stock Qty (Low to High)</option>
                    <option value="name_asc">Sort: Product Name (A–Z)</option>
                    <option value="threshold_desc">Sort: Reorder Threshold</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Operational Inventory Table */}
            <div className="overflow-x-auto scrollbar-thin rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <colgroup>
                  {isWarehouseManager ? (
                    <>
                      <col className="w-[36%]" />
                      <col className="w-[38%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                    </>
                  ) : (
                    <>
                      <col className="w-[24%]" />
                      <col className="w-[10%]" />
                      <col className="w-[24%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </>
                  )}
                </colgroup>
                <thead className="bg-slate-50/90 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className={`py-3 px-4 ${isWarehouseManager ? 'w-[36%] min-w-[240px]' : ''}`}>Product Name & SKU</th>
                    {!isWarehouseManager && (
                      <th className="py-3 px-3">Category</th>
                    )}
                    <th className={`py-3 px-3 ${isWarehouseManager ? 'w-[38%] min-w-[260px]' : ''}`}>Warehouse Stock Breakdown</th>
                    {!isWarehouseManager && (
                      <th className="py-3 px-3 text-right">Available Quantity</th>
                    )}
                    {!isWarehouseManager && (
                      <th className="py-3 px-3 text-center">Low-Stock Threshold</th>
                    )}
                    <th className={`py-3 px-3 text-center ${isWarehouseManager ? 'w-[12%] min-w-[120px]' : ''}`}>Stock Status</th>
                    <th className={`py-3 px-4 text-right ${isWarehouseManager ? 'w-[14%] min-w-[140px]' : ''}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOpStock.length === 0 ? (
                    <tr>
                      <td colSpan={isWarehouseManager ? 4 : 7} className="py-12 text-center text-slate-500">
                        <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-xs text-slate-700">No products matching the selected filters</p>
                        <p className="text-[11px] text-slate-400 mt-1">Adjust search query or filter options.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOpStock.map(item => {
                      const isLowStock = item.status === 'Limited Stock';
                      const isOutOfStock = item.status === 'Out of Stock';

                      // Find breakdown across warehouses
                      const whBreakdown = warehouses
                        .map(w => ({
                          warehouse: w,
                          stock: getWarehouseStock(w.id, item.product.id)
                        }))
                        .filter(entry => entry.stock > 0);

                      return (
                        <tr key={item.product.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Product Name & SKU */}
                          <td className="py-3 px-4 align-middle">
                            <span className="font-bold text-slate-900 block truncate" title={item.product.name}>
                              {item.product.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono block truncate" title={item.product.sku || '—'}>
                              SKU: {item.product.sku || '—'} {item.product.barcode ? `• Barcode: ${item.product.barcode}` : ''}
                            </span>
                          </td>

                          {/* Category */}
                          {!isWarehouseManager && (
                            <td className="py-3 px-3 align-middle text-slate-600">
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100">
                                {item.product.category || 'General'}
                              </span>
                            </td>
                          )}

                          {/* Warehouse Breakdown */}
                          <td className="py-3 px-3 align-middle text-slate-700">
                            {opWarehouse !== 'ALL' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px]">
                                <Building className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{item.warehouseLabel}: <strong>{formatNumber(item.availableQty)} {item.product.primaryUnit || 'Units'}</strong></span>
                              </span>
                            ) : whBreakdown.length > 0 ? (
                              <div className={`flex flex-wrap gap-1 ${isWarehouseManager ? 'max-w-md' : 'max-w-xs'}`}>
                                {whBreakdown.slice(0, isWarehouseManager ? 4 : 2).map(({ warehouse, stock }) => (
                                  <span
                                    key={warehouse.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700"
                                    title={`${warehouse.name}: ${stock} ${item.product.primaryUnit || 'Units'}`}
                                  >
                                    <span className="truncate max-w-[80px]">{warehouse.name}:</span>
                                    <strong className="font-mono">{formatNumber(stock)}</strong>
                                  </span>
                                ))}
                                {whBreakdown.length > (isWarehouseManager ? 4 : 2) && (
                                  <span className="text-[10px] font-bold text-slate-500 self-center">
                                    +{whBreakdown.length - (isWarehouseManager ? 4 : 2)} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No warehouse stock allocated</span>
                            )}
                          </td>

                          {/* Available Quantity */}
                          {!isWarehouseManager && (
                            <td className="py-3 px-3 text-right align-middle">
                              <span className={`text-sm font-black font-mono ${
                                isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'
                              }`}>
                                {formatNumber(item.availableQty)}
                              </span>{' '}
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.product.primaryUnit || 'Piece'}
                              </span>
                            </td>
                          )}

                          {/* Low-Stock Threshold */}
                          {!isWarehouseManager && (
                            <td className="py-3 px-3 text-center align-middle">
                              {item.reorderLevel !== null && item.reorderLevel !== undefined ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-mono font-bold text-slate-700">
                                    {formatNumber(item.reorderLevel)} {item.product.primaryUnit || 'Units'}
                                  </span>
                                  {item.availableQty <= item.reorderLevel && (
                                    <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Reorder point reached
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Not configured</span>
                              )}
                            </td>
                          )}

                          {/* Stock Status */}
                          <td className="py-3 px-3 text-center align-middle">
                            <div className="flex justify-center">
                              <StatusBadge
                              status={
                                item.status === 'Active'
                                  ? 'In Stock'
                                  : item.status === 'Limited Stock'
                                  ? 'Low Stock'
                                  : 'Out of Stock'
                              }
                            />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openAdjustForProduct(item.product.id)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Adjust physical stock balance"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adjust</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMovementProductFilter(item.product.name);
                                  setActiveTab('movements');
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="View transaction ledger"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                                <span>Movements</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalOpPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                <span>
                  Showing {(opPage - 1) * opPageSize + 1}–{Math.min(opPage * opPageSize, filteredOperationalStock.length)} of {filteredOperationalStock.length} products
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={opPage === 1}
                    onClick={() => setOpPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    Page {opPage} of {totalOpPages}
                  </span>
                  <button
                    disabled={opPage === totalOpPages}
                    onClick={() => setOpPage(p => Math.min(totalOpPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Stock Movement Ledger */}
        {activeTab === 'movements' && (
          <div className="p-4 sm:p-5">
            <DataTable
              title="Stock Movement Ledger"
              subtitle="Complete chronological audit trail of all warehouse receipts, dispatches, returns and adjustments"
              columns={columns}
              data={displayMovementTransactions}
              searchPlaceholder="Search by product, warehouse or reference doc..."
              searchKeys={['productName', 'warehouse', 'referenceDoc', 'type', 'notes']}
              defaultSortKey="date"
              defaultSortDir="desc"
              pageSize={10}
              tableFixed={true}
              minTableWidth="980px"
              filters={[
                {
                  key: 'type',
                  label: 'Transaction Type',
                  options: [
                    { label: 'Sale', value: 'Sale' },
                    { label: 'Purchase', value: 'Purchase' },
                    { label: 'Opening Stock', value: 'Opening Stock' },
                    { label: 'Stock Adjustment', value: 'Stock Adjustment' },
                    { label: 'Stock Transfer', value: 'Stock Transfer' },
                    { label: 'Sales Return', value: 'Sales Return' },
                    { label: 'Purchase Return', value: 'Purchase Return' },
                    { label: 'Stock Consumption', value: 'Stock Consumption' }
                  ]
                }
              ]}
            />
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={handleCloseAdjustModal}
        title="Stock Adjustment Entry"
        subtitle="Correct physical counts, write-off breakages, or record found stock"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCloseAdjustModal}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Apply Stock Adjustment
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Product</label>
            <select
              value={adjustProductId}
              onChange={e => setAdjustProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.currentStock} {p.primaryUnit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Warehouse</label>
            <select
              value={adjustWarehouse}
              onChange={e => setAdjustWarehouse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Quantity Adjustment (+ to add, - to reduce)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={adjustQty}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') {
                  setAdjustQty('');
                  return;
                }
                if (/^[+-]?\d*\.?\d*$/.test(raw)) {
                  const sanitized = raw.replace(/^([+-]?)0+(?=\d)/, '$1');
                  setAdjustQty(sanitized);
                }
              }}
              placeholder="e.g. -5 or +10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Reason / Justification</label>
            <input
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="Audit variance, water leakage damage, physical count discrepancy..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 1: Total Stock Breakdown */}
      <Modal
        isOpen={stockModal === 'total_stock'}
        onClose={() => setStockModal(null)}
        title="Total Stock Inventory Breakdown"
        subtitle="Real-time stock balance across all product categories and warehouse hubs"
        size="xl"
      >
        <div className="space-y-4 pb-2">
          {/* Top KPI Cards (Now fully interactive and functional) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. Total Units */}
            <button
              type="button"
              onClick={() => {
                setModalKpiTab('units');
                setModalWarehouseFilter('ALL');
                setStockModalSearch('');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                modalKpiTab === 'units'
                  ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-blue-50/30 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-bold block ${
                    modalKpiTab === 'units' ? 'text-blue-700' : 'text-slate-500 group-hover:text-blue-600'
                  }`}
                >
                  Total Units
                </span>
                <Boxes
                  className={`w-3.5 h-3.5 ${
                    modalKpiTab === 'units' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'
                  }`}
                />
              </div>
              <span className="text-base font-black text-blue-900 font-mono block mt-0.5">
                {formatNumber(totalStockUnits)}
              </span>
              <span className="text-[10px] text-blue-600/80 font-medium block">
                {modalKpiTab === 'units' ? '● Active: All Units' : 'Click to filter units'}
              </span>
            </button>

            {/* 2. Catalog SKUs */}
            <button
              type="button"
              onClick={() => {
                setModalKpiTab('skus');
                setModalWarehouseFilter('ALL');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                modalKpiTab === 'skus'
                  ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-indigo-50/30 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-bold block ${
                    modalKpiTab === 'skus' ? 'text-indigo-700' : 'text-slate-500 group-hover:text-indigo-600'
                  }`}
                >
                  Catalog SKUs
                </span>
                <Package
                  className={`w-3.5 h-3.5 ${
                    modalKpiTab === 'skus' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'
                  }`}
                />
              </div>
              <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                {products.length} Products
              </span>
              <span className="text-[10px] text-indigo-600/80 font-medium block">
                {modalKpiTab === 'skus' ? '● Active: A-Z SKUs' : 'Click to inspect catalog'}
              </span>
            </button>

            {/* 3. Warehouse Hubs */}
            <button
              type="button"
              onClick={() => {
                setModalKpiTab('warehouses');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                modalKpiTab === 'warehouses'
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-amber-50/30 hover:border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-bold block ${
                    modalKpiTab === 'warehouses' ? 'text-amber-700' : 'text-slate-500 group-hover:text-amber-600'
                  }`}
                >
                  Warehouse Hubs
                </span>
                <Building
                  className={`w-3.5 h-3.5 ${
                    modalKpiTab === 'warehouses' ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-500'
                  }`}
                />
              </div>
              <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                {warehouses.length} Active
              </span>
              <span className="text-[10px] text-amber-600/80 font-medium block">
                {modalKpiTab === 'warehouses' ? '● Active: Warehouse Hubs' : 'Click for warehouse hubs'}
              </span>
            </button>

            {/* 4. Total Asset Value */}
            <button
              type="button"
              onClick={() => {
                setModalKpiTab('valuation');
                setModalWarehouseFilter('ALL');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                modalKpiTab === 'valuation'
                  ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-emerald-50/30 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] uppercase font-bold block ${
                    modalKpiTab === 'valuation' ? 'text-emerald-700' : 'text-slate-500 group-hover:text-emerald-600'
                  }`}
                >
                  Total Asset Value
                </span>
                <DollarSign
                  className={`w-3.5 h-3.5 ${
                    modalKpiTab === 'valuation' ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'
                  }`}
                />
              </div>
              <span className="text-base font-black text-emerald-700 font-mono block mt-0.5">
                {formatCurrency(totalStockValue)}
              </span>
              <span className="text-[10px] text-emerald-600/80 font-medium block">
                {modalKpiTab === 'valuation' ? '● Active: Ranked by Value' : 'Click for asset valuation'}
              </span>
            </button>
          </div>

          {/* Warehouse location pills when Warehouse Hubs is active */}
          {modalKpiTab === 'warehouses' && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  Filter Inventory by Warehouse Location
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStockModal(null);
                    navigate('/inventory/warehouses');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Open Warehouse Master</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalWarehouseFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    modalWarehouseFilter === 'ALL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  All Hubs ({formatNumber(totalStockUnits)})
                </button>
                {warehouses.map(w => {
                  let whUnits = 0;
                  products.forEach(p => {
                    whUnits += getWarehouseStock(w.id, p.id);
                  });
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setModalWarehouseFilter(w.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        modalWarehouseFilter === w.id
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <span>{w.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          modalWarehouseFilter === w.id ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {formatNumber(whUnits)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search product name, SKU, or barcode..."
                value={stockModalSearch}
                onChange={e => setStockModalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-500 transition-colors"
              />
            </div>
            {productCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="ALL">All Categories</option>
                {productCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Products Table */}
          {filteredModalProducts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">No products matching filter</p>
              <p className="text-[11px] text-slate-400">Try adjusting your search query or category filter.</p>
            </div>
          ) : (
            <div className="w-full rounded-xl border border-slate-200 max-h-72 overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[11%]" />
                  <col className="w-[14%]" />
                  <col className="w-[15%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-left w-[23%]">Product Name & SKU</th>
                    <th className="py-2.5 px-2 text-center w-[13%] whitespace-nowrap">Category</th>
                    <th className="py-2.5 px-2 text-right w-[15%] whitespace-nowrap">
                      {modalWarehouseFilter !== 'ALL'
                        ? `Available (${warehouses.find(w => w.id === modalWarehouseFilter)?.name || 'Hub'})`
                        : 'Available Stock'}
                    </th>
                    <th className="py-2.5 px-2 text-right w-[11%] whitespace-nowrap">Cost Price</th>
                    <th className="py-2.5 px-2 text-right w-[14%] whitespace-nowrap">Total Asset Value</th>
                    <th className="py-2.5 px-2 text-center w-[15%] whitespace-nowrap">Stock Status</th>
                    <th className="py-2.5 px-3 text-right w-[9%] whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredModalProducts.map(p => {
                    const effectiveQty =
                      modalWarehouseFilter !== 'ALL'
                        ? getWarehouseStock(modalWarehouseFilter, p.id)
                        : p.currentStock;
                    const effectiveValuation = effectiveQty * p.costPrice;
                    const status = calculateStockStatus(effectiveQty, p.reorderLevel);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-sans overflow-hidden align-middle">
                          <span className="font-semibold text-slate-900 block truncate" title={p.name}>
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate" title={p.sku || p.barcode || '—'}>
                            {p.sku || p.barcode || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-sans text-slate-600 overflow-hidden align-middle">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 block truncate text-center" title={p.category || 'General'}>
                            {p.category || 'General'}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-right font-bold overflow-hidden truncate align-middle ${effectiveQty <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatNumber(effectiveQty)} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 overflow-hidden truncate align-middle">
                          {formatCurrency(p.costPrice)}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-emerald-700 overflow-hidden truncate align-middle">
                          {formatCurrency(effectiveValuation)}
                        </td>
                        <td className="py-2 px-2 text-center font-sans whitespace-nowrap align-middle">
                          <StatusBadge status={status} size="sm" />
                        </td>
                        <td className="py-2 px-3 text-right font-sans overflow-hidden align-middle">
                          <button
                            onClick={() => openAdjustForProduct(p.id)}
                            className="px-2.5 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                          >
                            Adjust
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
      </Modal>

      {/* DRILLDOWN MODAL 2: Stock Value Analysis & FIFO / WAC Audit */}
      <Modal
        isOpen={stockModal === 'stock_value'}
        onClose={() => setStockModal(null)}
        title="Inventory Asset Valuation Audit Sheet"
        subtitle={`Cost-basis valuation breakdown under ${valuationMethod} accounting standards`}
        size="xl"
      >
        <div className="space-y-4 pb-2">
          {/* Method Selector inside Modal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Valuation Standard Applied</span>
              <span className="text-[11px] text-slate-500">Switch method to recalculate valuation instantly</span>
            </div>
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setValuationMethod('FIFO')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  valuationMethod === 'FIFO' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                FIFO (First-In, First-Out)
              </button>
              <button
                onClick={() => setValuationMethod('Weighted Average')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  valuationMethod === 'Weighted Average'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Weighted Average Cost
              </button>
            </div>
          </div>

          {/* Main Valuation Summary Card */}
          <div className="p-4 bg-emerald-950 text-white rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">
                Total Closing Stock Asset Value ({valuationMethod})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ind AS-2 Compliant
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              {formatCurrency(valuationData.closingStockVal)}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-900 text-xs">
              <div>
                <span className="text-emerald-400/80 block text-[10px]">Total Stock Units</span>
                <span className="font-mono font-bold text-white">{formatNumber(totalStockUnits)} Units</span>
              </div>
              <div>
                <span className="text-emerald-400/80 block text-[10px]">FIFO Valuation</span>
                <span className="font-mono font-bold text-white">{formatCurrency(valuationData.totalFifoVal)}</span>
              </div>
              <div>
                <span className="text-emerald-400/80 block text-[10px]">Weighted Avg Valuation</span>
                <span className="font-mono font-bold text-white">{formatCurrency(valuationData.totalWeightedAvgVal)}</span>
              </div>
            </div>
          </div>

          {/* Search bar & SKU Audit Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                SKU-Wise Asset Valuation Table
              </h3>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={valuationSearch}
                  onChange={e => setValuationSearch(e.target.value)}
                  placeholder="Filter by SKU or name..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="w-full rounded-xl border border-slate-200 max-h-80 overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-left w-[40%]">Product Name & SKU</th>
                    <th className="py-2.5 px-3 text-center w-[14%] whitespace-nowrap">In Stock</th>
                    <th className="py-2.5 px-3 text-right w-[14%] whitespace-nowrap">FIFO Cost</th>
                    <th className="py-2.5 px-3 text-right w-[14%] whitespace-nowrap">WAC Cost</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800 w-[18%] whitespace-nowrap">
                      Asset Value ({valuationMethod === 'Weighted Average' ? 'WAC' : 'FIFO'})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(() => {
                    const filtered = valuationData.items.filter(i =>
                      !valuationSearch ||
                      i.product.name.toLowerCase().includes(valuationSearch.toLowerCase()) ||
                      i.product.sku?.toLowerCase().includes(valuationSearch.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                            No products match &ldquo;{valuationSearch}&rdquo;
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map(i => (
                      <tr key={i.product.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-sans overflow-hidden align-middle">
                          <span className="font-semibold text-slate-900 block truncate" title={i.product.name}>
                            {i.product.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase block truncate" title={i.product.sku || '—'}>
                            {i.product.sku || '—'}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-center font-medium overflow-hidden whitespace-nowrap truncate align-middle ${i.currentStock <= 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {formatNumber(i.currentStock)} {i.product.primaryUnit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 overflow-hidden whitespace-nowrap truncate align-middle">
                          {formatCurrency(i.fifoCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 overflow-hidden whitespace-nowrap truncate align-middle">
                          {formatCurrency(i.weightedAvgCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 overflow-hidden whitespace-nowrap truncate align-middle">
                          {formatCurrency(i.activeValue)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL: Opening Stock Breakdown */}
      <Modal
        isOpen={stockModal === 'opening_stock'}
        onClose={() => setStockModal(null)}
        title="Opening Stock Valuation Breakdown"
        subtitle="Baseline registered stock and valuation at period start"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Total Opening Asset Value: <strong>{formatCurrency(valuationData.openingStockVal)}</strong>
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Opening Valuation</span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {formatCurrency(valuationData.openingStockVal)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Opening Units</span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {formatNumber(products.reduce((acc, p) => acc + (p.openingStock || 0), 0))} Units
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Products with Opening Stock</h3>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={openingSearch}
                  onChange={e => setOpeningSearch(e.target.value)}
                  placeholder="Filter opening stock..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[40%]">Product Name & SKU</th>
                    <th className="py-2.5 px-3 text-right w-[20%]">Opening Qty</th>
                    <th className="py-2.5 px-3 text-right w-[20%]">Cost Price</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900 w-[20%]">Opening Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {products
                    .filter(p => (p.openingStock || 0) > 0)
                    .filter(p =>
                      !openingSearch ||
                      p.name.toLowerCase().includes(openingSearch.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(openingSearch.toLowerCase())
                    )
                    .map(p => {
                      const val = (p.openingStock || 0) * (p.costPrice || 0);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-sans overflow-hidden">
                            <span className="font-semibold text-slate-900 block truncate" title={p.name}>{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase block truncate" title={p.sku}>{p.sku}</span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 overflow-hidden truncate">
                            {formatNumber(p.openingStock || 0)} {p.primaryUnit}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 overflow-hidden truncate">
                            {formatCurrency(p.costPrice || 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 overflow-hidden truncate">
                            {formatCurrency(val)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL: Purchases in Period */}
      <Modal
        isOpen={stockModal === 'period_purchases'}
        onClose={() => setStockModal(null)}
        title="Purchases in Period (Inward Inventory)"
        subtitle="Inward purchase invoices and vendor bills absorbed into inventory"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/purchases');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>All Purchases</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Inward Purchases</span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {formatCurrency(valuationData.purchasesInPeriod)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Inward Invoices</span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {purchaseInvoices.filter(p => p.docType !== 'purchase_return').length} Invoices
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Inward Purchase Invoices</h3>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={purchaseSearch}
                  onChange={e => setPurchaseSearch(e.target.value)}
                  placeholder="Filter by invoice or vendor..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {purchaseInvoices.filter(p => p.docType !== 'purchase_return').length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Inward Purchases in Current Period</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Purchases registered will automatically contribute to Weighted Average Cost calculations.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStockModal(null);
                    navigate('/purchases/new');
                  }}
                  className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Purchase Invoice</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs table-fixed">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-[22%]">Invoice #</th>
                      <th className="py-2.5 px-3 w-[18%]">Date</th>
                      <th className="py-2.5 px-3 w-[32%]">Vendor / Supplier</th>
                      <th className="py-2.5 px-3 text-center w-[10%]">Items</th>
                      <th className="py-2.5 px-3 text-right w-[18%]">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {purchaseInvoices
                      .filter(p => p.docType !== 'purchase_return')
                      .filter(p =>
                        !purchaseSearch ||
                        (p.invoiceNumber || '').toLowerCase().includes(purchaseSearch.toLowerCase()) ||
                        (p.supplierName || '').toLowerCase().includes(purchaseSearch.toLowerCase())
                      )
                      .map(pur => (
                        <tr key={pur.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-blue-700 overflow-hidden truncate" title={pur.invoiceNumber}>{pur.invoiceNumber}</td>
                          <td className="py-2 px-3 text-slate-600 font-sans overflow-hidden truncate">{formatDate(pur.date)}</td>
                          <td className="py-2 px-3 text-slate-900 font-sans font-medium overflow-hidden truncate" title={pur.supplierName}>{pur.supplierName}</td>
                          <td className="py-2 px-3 text-center text-slate-600 overflow-hidden truncate">{pur.items?.length || 0}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 overflow-hidden truncate">{formatCurrency(pur.grandTotal)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL: Computed COGS & P&L Impact */}
      <Modal
        isOpen={stockModal === 'valuation_cogs'}
        onClose={() => setStockModal(null)}
        title="Cost of Goods Sold (COGS) Calculation Audit"
        subtitle="Standard accounting formula determining gross margin impact on Profit & Loss"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/accounting/profit-loss');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Open Profit & Loss Report</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-950 text-white rounded-xl space-y-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-blue-300">
              Total Computed COGS (Impact on Gross Margin)
            </span>
            <div className="text-3xl font-black font-mono text-blue-400">
              {formatCurrency(valuationData.computedCogs)}
            </div>
            <p className="text-xs text-blue-200/80 pt-1 border-t border-blue-900">
              Calculated using standard <strong>AS-2 Inventory Valuation</strong> formula applied across active accounting periods.
            </p>
          </div>

          {/* Mathematical Equation Breakdown Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Standard Accounting Formula:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Opening Stock (+)</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{formatCurrency(valuationData.openingStockVal)}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Purchases (+)</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{formatCurrency(valuationData.purchasesInPeriod)}</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Closing Stock (-)</span>
                <span className="text-sm font-bold text-emerald-700 mt-1 block">{formatCurrency(valuationData.closingStockVal)}</span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-[10px] text-blue-800 uppercase font-sans font-bold block">= COGS Result</span>
                <span className="text-sm font-bold text-blue-900 mt-1 block">{formatCurrency(valuationData.computedCogs)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 3: Low Stock Alert */}
      <Modal
        isOpen={stockModal === 'low_stock'}
        onClose={() => setStockModal(null)}
        title="Low Stock Alert & Reorder Assistant"
        subtitle="Products currently below safety reorder threshold requiring replenishment"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/purchases/new');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Create Purchase Order (Restock)</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top Banner */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-900">
                  {lowStockCount} Products Running Below Safety Stock
                </h3>
                <p className="text-[11px] text-amber-700">
                  Order replenishment now to prevent stockouts and missed sales opportunities.
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          {lowStockProducts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">All Stock Levels Healthy</p>
              <p className="text-[11px] text-slate-400">
                No products are currently below their reorder threshold buffer.
              </p>
            </div>
          ) : (
            <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[28%]">Product Name & SKU</th>
                    <th className="py-2.5 px-3 text-right w-[15%]">Current Stock</th>
                    <th className="py-2.5 px-3 text-right w-[15%]">Reorder Level</th>
                    <th className="py-2.5 px-3 text-right w-[14%]">Deficit</th>
                    <th className="py-2.5 px-3 text-right w-[14%]">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right w-[14%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {lowStockProducts.map(p => {
                    const deficit = Math.max(0, (p.reorderLevel ?? 0) - p.currentStock);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900 overflow-hidden">
                          <span className="block truncate" title={p.name}>{p.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono truncate" title={p.sku || '—'}>{p.sku || '—'}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-600 overflow-hidden truncate">
                          {p.currentStock} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 overflow-hidden truncate">
                          {p.reorderLevel} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600 overflow-hidden truncate">
                          -{deficit} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 overflow-hidden truncate">{formatCurrency(p.costPrice)}</td>
                        <td className="py-2 px-3 text-right font-sans overflow-hidden">
                          <button
                            onClick={() => {
                              setStockModal(null);
                              navigate('/purchases/new');
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                          >
                            Order
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
      </Modal>

      {/* DRILLDOWN MODAL 4: Out of Stock */}
      <Modal
        isOpen={stockModal === 'out_of_stock'}
        onClose={() => setStockModal(null)}
        title="Out of Stock Critical Items"
        subtitle="Zero on-hand balance — sales halted and fulfillment impacted"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/purchases/new');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Order from Supplier (PO)</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-rose-900">
                {outOfStockCount} Products Have Zero Available Units
              </h3>
              <p className="text-[11px] text-rose-700">
                These items cannot be billed in sales orders or POS without creating backorders.
              </p>
            </div>
          </div>

          {outOfStockProducts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Zero Stockouts!</p>
              <p className="text-[11px] text-slate-400">All products in the catalog have active on-hand inventory.</p>
            </div>
          ) : (
            <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[28%]">Product Name & SKU</th>
                    <th className="py-2.5 px-3 w-[14%]">Category</th>
                    <th className="py-2.5 px-3 text-right w-[15%]">Selling Price</th>
                    <th className="py-2.5 px-3 text-right w-[15%]">Cost Price</th>
                    <th className="py-2.5 px-3 text-right w-[14%]">Reorder Buffer</th>
                    <th className="py-2.5 px-3 text-right w-[14%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {outOfStockProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900 overflow-hidden">
                        <span className="block truncate" title={p.name}>{p.name}</span>
                        <span className="block text-[10px] text-slate-400 font-mono truncate" title={p.sku || '—'}>{p.sku || '—'}</span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 overflow-hidden truncate" title={p.category || 'General'}>{p.category || 'General'}</td>
                      <td className="py-2 px-3 text-right text-slate-900 font-bold overflow-hidden truncate">{formatCurrency(p.sellingPrice)}</td>
                      <td className="py-2 px-3 text-right text-slate-600 overflow-hidden truncate">{formatCurrency(p.costPrice)}</td>
                      <td className="py-2 px-3 text-right text-slate-500 overflow-hidden truncate">{p.reorderLevel} {p.primaryUnit}</td>
                      <td className="py-2 px-3 text-right font-sans overflow-hidden">
                        <button
                          onClick={() => openAdjustForProduct(p.id)}
                          className="px-2 py-0.5 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors mr-1.5"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => {
                            setStockModal(null);
                            navigate('/purchases/new');
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                        >
                          Procure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 5: Overstocked SKUs */}
      <Modal
        isOpen={stockModal === 'overstocked'}
        onClose={() => setStockModal(null)}
        title="Overstocked SKUs & Capital Efficiency"
        subtitle="Inventory holding more than 4x reorder buffer, locking up company working capital"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/sales/new');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Create Clearance Sale / Discount</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                Working Capital Optimization
              </span>
              <span className="font-mono text-xs font-black text-purple-900">
                {overstockCount} SKUs Overstocked
              </span>
            </div>
            <p className="text-[11px] text-purple-700">
              Consider running bundle sales or temporary price markdowns to convert idle merchandise into liquid operating cash.
            </p>
          </div>

          {overstockProducts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No Excess Inventory</p>
              <p className="text-[11px] text-slate-400">All products are within optimal turnover ratios.</p>
            </div>
          ) : (
            <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[32%]">Product Name & SKU</th>
                    <th className="py-2.5 px-3 text-right w-[17%]">Current Stock</th>
                    <th className="py-2.5 px-3 text-right w-[17%]">Reorder Threshold</th>
                    <th className="py-2.5 px-3 text-right w-[17%]">Excess Units</th>
                    <th className="py-2.5 px-3 text-right w-[17%]">Locked Capital (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {overstockProducts.map(p => {
                    const excess = Math.max(0, p.currentStock - (p.reorderLevel ?? 0) * 2);
                    const locked = excess * p.costPrice;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900 overflow-hidden">
                          <span className="block truncate" title={p.name}>{p.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono truncate" title={p.sku || '—'}>{p.sku || '—'}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-purple-700 overflow-hidden truncate">
                          {p.currentStock} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 overflow-hidden truncate">
                          {p.reorderLevel !== null && p.reorderLevel !== undefined ? `${p.reorderLevel} ${p.primaryUnit}` : 'Not Set'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-purple-600 overflow-hidden truncate">
                          +{formatNumber(excess)} {p.primaryUnit}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-700 overflow-hidden truncate">
                          {formatCurrency(locked)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* DRILLDOWN MODAL 6: Expiring Batches */}
      <Modal
        isOpen={stockModal === 'expiring'}
        onClose={() => setStockModal(null)}
        title="Expiring & Expired Batches Watchlist"
        subtitle="Batches requiring First-Expiry-First-Out (FEFO) clearance or write-off"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => {
                setStockModal(null);
                navigate('/inventory/batches');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Full Batch Tracking Hub</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">Expired Batches</span>
              <span className="text-base font-black text-rose-900 font-mono block">
                {batches.filter(b => b.status === 'Expired').length} Batches
              </span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Expiring Soon</span>
              <span className="text-base font-black text-amber-900 font-mono block">
                {batches.filter(b => b.status === 'Expiring Soon').length} Batches
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Batches</span>
              <span className="text-base font-black text-slate-900 font-mono block">
                {batches.length} Tracked
              </span>
            </div>
          </div>

          {expiringBatchesList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No Expired or Expiring Batches</p>
              <p className="text-[11px] text-slate-400">All batch inventory remains well within expiration thresholds.</p>
            </div>
          ) : (
            <div className="overflow-x-hidden no-scrollbar w-full rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[20%]">Batch #</th>
                    <th className="py-2.5 px-3 w-[30%]">Product</th>
                    <th className="py-2.5 px-3 w-[18%]">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right w-[12%]">Available Qty</th>
                    <th className="py-2.5 px-3 text-center w-[10%]">Status</th>
                    <th className="py-2.5 px-3 text-right w-[10%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {expiringBatchesList.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-900 overflow-hidden truncate" title={b.batchNumber}>{b.batchNumber}</td>
                      <td className="py-2 px-3 font-sans text-slate-800 overflow-hidden truncate" title={b.productName}>{b.productName}</td>
                      <td className="py-2 px-3 text-slate-600 overflow-hidden truncate">{formatDate(b.expiryDate)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 overflow-hidden truncate">{b.qty}</td>
                      <td className="py-2 px-3 text-center font-sans overflow-hidden">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block truncate ${
                            b.status === 'Expired'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-sans overflow-hidden">
                        <button
                          onClick={() => {
                            setStockModal(null);
                            navigate('/sales/new');
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        >
                          Dispatch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
