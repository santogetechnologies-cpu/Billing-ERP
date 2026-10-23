import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Boxes,
  DollarSign,
  Search,
  Download,
  TrendingUp,
  AlertTriangle,
  Building,
  ArrowUpDown,
  Package,
  ShieldCheck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';

export const StockValuationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const {
    products,
    warehouses,
    purchaseInvoices,
    batches,
    getWarehouseStock
  } = useERP();

  const isTotalProductCost = location.pathname === '/inventory/total-cost' || profile?.role === 'Purchase Manager';
  const pageTitle = isTotalProductCost ? 'Total Product Cost' : 'Stock Valuation';
  const pageSubtitle = isTotalProductCost
    ? 'Total cost and valuation of available inventory based on authentic product purchase costs'
    : 'Financial inventory asset ledger, balance sheet reconciliation, and AS-2 costing report';
  const kpiTitle = isTotalProductCost ? 'Total Product Cost' : 'Total Inventory Value';

  // Valuation Date
  const valuationDateFormatted = useMemo(() => formatDate(new Date().toISOString()), []);

  // Costing Method & Filters
  const [valuationMethod, setValuationMethod] = useState<'FIFO' | 'Weighted Average'>('FIFO');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [costStatusFilter, setCostStatusFilter] = useState<'ALL' | 'HAS_COST' | 'MISSING_COST'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'value' | 'cost' | 'qty' | 'name'>('value');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Authoritative Costing Engine (AS-2 / Ind AS 2)
  const valuationEngine = useMemo(() => {
    // 1. Inward purchases map
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

    // 2. Batches map (if batch tracked)
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

    // 3. Compute per-product financial valuation
    const items = products.map(prod => {
      const opQty = prod.openingStock || 0;
      const opCost = opQty * (prod.costPrice || prod.purchasePrice || 0);

      const purInfo = purchasesByProduct.get(prod.id);
      const purQty = purInfo?.totalQty || 0;
      const purCost = purInfo?.totalCost || 0;

      const batchInfo = batchesByProduct.get(prod.id);
      const batchQty = batchInfo?.totalQty || 0;
      const batchCost = batchInfo?.totalCost || 0;

      const totalInwardUnits = opQty + purQty + batchQty;
      const totalInwardCost = opCost + purCost + batchCost;

      // Weighted Average Unit Cost = Total Inward Cost / Total Inward Units
      const weightedAvgCost = totalInwardUnits > 0
        ? totalInwardCost / totalInwardUnits
        : (prod.costPrice || prod.purchasePrice || 0);

      // FIFO Unit Cost = Recent acquisition cost falling back to configured cost price
      const fifoCost = purInfo?.latestUnitPrice || batchInfo?.latestBatchCost || (prod.costPrice || prod.purchasePrice || 0);

      const activeUnitCost = valuationMethod === 'FIFO' ? fifoCost : weightedAvgCost;
      const hasConfiguredCost = activeUnitCost > 0;

      // Authoritative Stock Quantity based on warehouse scope
      let valuationQty = 0;
      let warehouseDisplayName = 'All Warehouses / Godowns';

      if (selectedWarehouseId === 'ALL') {
        valuationQty = Math.max(0, Number(prod.currentStock || 0));
      } else {
        const wh = warehouses.find(w => w.id === selectedWarehouseId);
        warehouseDisplayName = wh ? `${wh.name} (${wh.code})` : 'Warehouse';
        valuationQty = Math.max(0, getWarehouseStock(selectedWarehouseId, prod.id));
      }

      // Formula: Inventory Value = Valuation Quantity × Unit Inventory Cost
      const totalValue = valuationQty * activeUnitCost;

      return {
        product: prod,
        warehouseName: warehouseDisplayName,
        valuationQty,
        unitCost: activeUnitCost,
        hasCost: hasConfiguredCost,
        totalValue,
        fifoCost,
        weightedAvgCost
      };
    });

    return items;
  }, [products, purchaseInvoices, batches, valuationMethod, selectedWarehouseId, warehouses, getWarehouseStock]);

  // Filtered & Sorted Valuation Items
  const filteredItems = useMemo(() => {
    let result = valuationEngine.filter(item => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.product.category !== selectedCategory) {
        return false;
      }

      // Cost status filter
      if (costStatusFilter === 'HAS_COST' && !item.hasCost) return false;
      if (costStatusFilter === 'MISSING_COST' && item.hasCost) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.product.name.toLowerCase().includes(q);
        const matchesSku = item.product.sku && item.product.sku.toLowerCase().includes(q);
        const matchesCat = item.product.category && item.product.category.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCat) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'value') {
        comparison = a.totalValue - b.totalValue;
      } else if (sortField === 'cost') {
        comparison = a.unitCost - b.unitCost;
      } else if (sortField === 'qty') {
        comparison = a.valuationQty - b.valuationQty;
      } else if (sortField === 'name') {
        comparison = a.product.name.localeCompare(b.product.name);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [valuationEngine, selectedCategory, costStatusFilter, searchQuery, sortField, sortOrder]);

  // Aggregate Metrics (strictly reconciling with displayed rows)
  const totalValuationValue = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + item.totalValue, 0);
  }, [filteredItems]);

  const totalValuationUnits = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + item.valuationQty, 0);
  }, [filteredItems]);

  const missingCostCount = useMemo(() => {
    return filteredItems.filter(i => !i.hasCost && i.valuationQty > 0).length;
  }, [filteredItems]);

  const overallAvgUnitCost = useMemo(() => {
    return totalValuationUnits > 0 ? totalValuationValue / totalValuationUnits : 0;
  }, [totalValuationValue, totalValuationUnits]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'Warehouse',
      'Valuation Qty',
      'Unit',
      'Unit Cost (INR)',
      'Total Value (INR)',
      'Costing Method',
      'Cost Status'
    ];

    const rows = filteredItems.map(item => [
      `"${item.product.name.replace(/"/g, '""')}"`,
      `"${item.product.sku || ''}"`,
      `"${item.product.category || 'General'}"`,
      `"${item.warehouseName}"`,
      item.valuationQty,
      `"${item.product.primaryUnit || 'Piece'}"`,
      item.unitCost.toFixed(2),
      item.totalValue.toFixed(2),
      valuationMethod,
      item.hasCost ? 'Configured' : 'Missing Cost'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Valuation_${valuationMethod}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              {pageTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {pageSubtitle}
            </p>
          </div>
        </div>

        {/* Header Right Actions - Horizontally aligned in single row with matching heights */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Costing Method Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold h-9.5">
            <button
              type="button"
              onClick={() => setValuationMethod('FIFO')}
              className={`px-3 py-1 rounded-lg transition-all h-7.5 flex items-center cursor-pointer ${
                valuationMethod === 'FIFO'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="First-In, First-Out costing"
            >
              FIFO Method
            </button>
            <button
              type="button"
              onClick={() => setValuationMethod('Weighted Average')}
              className={`px-3 py-1 rounded-lg transition-all h-7.5 flex items-center cursor-pointer ${
                valuationMethod === 'Weighted Average'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Weighted Average Costing"
            >
              Weighted Average
            </button>
          </div>

          {/* Quick link back to operational Stock Overview */}
          <button
            onClick={() => navigate('/inventory')}
            className="h-9.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer shrink-0"
            title="Switch to Operational Stock Overview"
          >
            <Boxes className="w-3.5 h-3.5 text-blue-600" />
            <span>Stock Overview</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="h-9.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Download Valuation CSV Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>


      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={kpiTitle}
          value={formatCurrency(totalValuationValue)}
          subtitle={`Reconciled ${valuationMethod} Total`}
          icon={DollarSign}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />
        <StatCard
          title="Valuation Stock Units"
          value={`${formatNumber(totalValuationUnits)} Units`}
          subtitle={selectedWarehouseId === 'ALL' ? 'Across All Warehouses' : 'Selected Warehouse'}
          icon={Package}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />
        <StatCard
          title="Average Unit Cost"
          value={formatCurrency(overallAvgUnitCost)}
          subtitle="Weighted across active inventory"
          icon={TrendingUp}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
        />
        <StatCard
          title="Products Evaluated"
          value={`${filteredItems.length} SKUs`}
          subtitle={`${filteredItems.length - missingCostCount} fully costed`}
          icon={ShieldCheck}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU, category..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Building className="w-3.5 h-3.5 text-slate-500" />
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
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
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

            {/* Cost Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={costStatusFilter}
                onChange={e => {
                  setCostStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Cost Statuses</option>
                <option value="HAS_COST">Cost Configured</option>
                <option value="MISSING_COST">Missing Cost</option>
              </select>
            </div>

            {/* Sort Field */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortField}
                onChange={e => {
                  setSortField(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="value">Sort: Total Value</option>
                <option value="cost">Sort: Unit Cost</option>
                <option value="qty">Sort: Available Qty</option>
                <option value="name">Sort: Product Name</option>
              </select>
            </div>

            {/* Sort Direction Toggle */}
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 cursor-pointer"
              title={sortOrder === 'desc' ? 'Highest first' : 'Lowest first'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Financial Inventory Valuation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Financial Inventory Valuation Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Product-level asset valuation: Inventory Value = Valuation Quantity × Unit Inventory Cost ({valuationMethod})
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Valuation Date: <span className="text-slate-900 font-bold">{valuationDateFormatted}</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Product Name & SKU</th>
                <th className="py-3 px-3">Warehouse / Hub</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Valuation Quantity</th>
                <th className="py-3 px-3 text-right">Unit Inventory Cost</th>
                <th className="py-3 px-4 text-right">Total Inventory Value</th>
                <th className="py-3 px-3 text-center">Costing Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-xs text-slate-700">No products matching the selected valuation filters</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting search or category filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => (
                  <tr key={item.product.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Product Name & SKU */}
                    <td className="py-3 px-4 font-sans align-middle">
                      <span className="font-semibold text-slate-900 block truncate" title={item.product.name}>
                        {item.product.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block truncate" title={item.product.sku || '—'}>
                        {item.product.sku || '—'}
                      </span>
                    </td>

                    {/* Warehouse */}
                    <td className="py-3 px-3 font-sans text-slate-700 align-middle">
                      <span className="inline-flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px]" title={item.warehouseName}>
                          {item.warehouseName}
                        </span>
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 font-sans text-slate-600 align-middle">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100">
                        {item.product.category || 'General'}
                      </span>
                    </td>

                    {/* Valuation Quantity */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 align-middle">
                      <span>{formatNumber(item.valuationQty)}</span>{' '}
                      <span className="text-[11px] font-normal text-slate-500 font-sans">
                        {item.product.primaryUnit || 'Piece'}
                      </span>
                    </td>

                    {/* Unit Inventory Cost */}
                    <td className="py-3 px-3 text-right align-middle">
                      {item.hasCost ? (
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(item.unitCost)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-sans font-semibold">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Cost Missing
                        </span>
                      )}
                    </td>

                    {/* Total Inventory Value */}
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700 text-sm align-middle">
                      {formatCurrency(item.totalValue)}
                    </td>

                    {/* Costing Basis */}
                    <td className="py-3 px-3 text-center font-sans align-middle">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {valuationMethod}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Reconciliation Footer: Grand Total strictly equals the sum of rows */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-mono text-xs">
              <tr>
                <td colSpan={3} className="py-3 px-4 font-sans font-bold text-slate-900">
                  Total Valuation Summary ({filteredItems.length} Products)
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-900">
                  {formatNumber(totalValuationUnits)} Units
                </td>
                <td className="py-3 px-3 text-right text-slate-500 font-sans text-[11px]">
                  Avg: {formatCurrency(overallAvgUnitCost)}
                </td>
                <td className="py-3 px-4 text-right font-black text-emerald-800 text-base">
                  {formatCurrency(totalValuationValue)}
                </td>
                <td className="py-3 px-3 text-center text-slate-500 text-[11px] font-sans">
                  {valuationMethod}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockValuationPage;
