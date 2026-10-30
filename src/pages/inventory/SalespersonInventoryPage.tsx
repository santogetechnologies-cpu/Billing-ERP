import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Building,
  ScanBarcode,
  Package,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  Warehouse as WarehouseIcon,
  Tag,
  Info
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { StatusBadge, StockStatusBadge } from '../../components/common/StatusBadge';
import { sortProductsAZ } from '../../utils/sortUtils';
import { Product } from '../../types';
import { Modal } from '../../components/common/Modal';

export const SalespersonInventoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, warehouses, getWarehouseStock } = useERP();
  const { profile } = useAuth();

  // URL query parameter filter support (e.g. from Dashboard cards)
  const initialStatusParam = searchParams.get('status');
  const getInitialStatus = (): 'ALL' | 'ACTIVE' | 'LIMITED' | 'OUT' => {
    if (initialStatusParam === 'available' || initialStatusParam === 'active') return 'ACTIVE';
    if (initialStatusParam === 'low' || initialStatusParam === 'limited' || initialStatusParam === 'warning') return 'LIMITED';
    if (initialStatusParam === 'out' || initialStatusParam === 'out_of_stock') return 'OUT';
    return 'ALL';
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LIMITED' | 'OUT'>(getInitialStatus);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);

  // Sync state if URL query param changes
  useEffect(() => {
    const s = searchParams.get('status');
    if (s === 'available' || s === 'active') setStatusFilter('ACTIVE');
    else if (s === 'low' || s === 'limited' || s === 'warning') setStatusFilter('LIMITED');
    else if (s === 'out' || s === 'out_of_stock') setStatusFilter('OUT');
  }, [searchParams]);

  // Distinct Categories from real database products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [products]);

  // Compute live stock statuses for all products
  const productsWithStockStatus = useMemo(() => {
    return products.map(product => {
      const stock =
        selectedWarehouseId === 'ALL'
          ? Math.max(0, product.currentStock ?? 0)
          : Math.max(0, getWarehouseStock(selectedWarehouseId, product.id));

      const status = calculateStockStatus(stock, product.reorderLevel);
      return {
        ...product,
        computedStock: stock,
        computedStatus: status
      };
    });
  }, [products, selectedWarehouseId, getWarehouseStock]);

  // Overall KPI counts derived strictly from live database products
  const metrics = useMemo(() => {
    let activeCount = 0;
    let lowCount = 0;
    let outCount = 0;

    productsWithStockStatus.forEach(p => {
      if (p.computedStatus === 'Out of Stock') {
        outCount++;
      } else if (p.computedStatus === 'Limited Stock') {
        lowCount++;
      } else {
        activeCount++;
      }
    });

    return {
      total: productsWithStockStatus.length,
      active: activeCount,
      low: lowCount,
      out: outCount
    };
  }, [productsWithStockStatus]);

  // Filtered product records for the table
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = productsWithStockStatus.filter(p => {
      // 1. Search Query (name, SKU, code, barcode, category)
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const matchCode = p.code ? p.code.toLowerCase().includes(q) : false;
        const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const matchCat = p.category ? p.category.toLowerCase().includes(q) : false;
        if (!matchName && !matchSku && !matchCode && !matchBarcode && !matchCat) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) {
        return false;
      }

      // 3. Stock Status Filter
      if (statusFilter === 'ACTIVE' && p.computedStatus !== 'Active') {
        return false;
      }
      if (statusFilter === 'LIMITED' && p.computedStatus !== 'Limited Stock') {
        return false;
      }
      if (statusFilter === 'OUT' && p.computedStatus !== 'Out of Stock') {
        return false;
      }

      return true;
    });

    return sortProductsAZ(filtered);
  }, [productsWithStockStatus, searchQuery, categoryFilter, statusFilter]);

  const handleStatusFilterChange = (status: 'ALL' | 'ACTIVE' | 'LIMITED' | 'OUT') => {
    setStatusFilter(status);
    if (status === 'ACTIVE') setSearchParams({ status: 'available' });
    else if (status === 'LIMITED') setSearchParams({ status: 'low' });
    else if (status === 'OUT') setSearchParams({ status: 'out' });
    else setSearchParams({});
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner (Strictly Read-Only Notice) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600" />
              <span>Shop Inventory &amp; Stock Availability</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Stock (View Only)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time catalog stock quantities, selling prices, and availability status for customer assistance.
          </p>
        </div>

        {/* Warehouse Location Selector (Filter Only) */}
        {warehouses.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <WarehouseIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Location:</span>
            <select
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              aria-label="Location"
              className="text-xs font-semibold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="ALL">All Godowns / Shop Locations</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? '(Main)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Top Stock Availability KPI Cards (Interactive Filter Shortcuts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <button
          onClick={() => handleStatusFilterChange('ALL')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Products
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(metrics.total)}</div>
          <p className="text-[11px] text-slate-500 mt-1">Catalog items tracked</p>
        </button>

        {/* Available Products */}
        <button
          onClick={() => handleStatusFilterChange('ACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              In Stock / Available
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{formatNumber(metrics.active)}</div>
          <p className="text-[11px] text-slate-500 mt-1">Ready for sale</p>
        </button>

        {/* Low-Stock Products */}
        <button
          onClick={() => handleStatusFilterChange('LIMITED')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'LIMITED'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Low / Warning Stock
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">{formatNumber(metrics.low)}</div>
          <p className="text-[11px] text-slate-500 mt-1">At or below warning limit</p>
        </button>

        {/* Out-of-Stock Products */}
        <button
          onClick={() => handleStatusFilterChange('OUT')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'OUT'
              ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Out of Stock
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700">{formatNumber(metrics.out)}</div>
          <p className="text-[11px] text-slate-500 mt-1">0 units available</p>
        </button>
      </div>

      {/* 3. Search and Multi-Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by product name, SKU, product code, barcode or category..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 sm:flex-none">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              aria-label="Category"
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 sm:flex-none">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => handleStatusFilterChange(e.target.value as any)}
              aria-label="Stock Status"
              className="text-xs text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none font-medium"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="ACTIVE">In Stock / Available</option>
              <option value="LIMITED">Low / Warning Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>

          {(searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                handleStatusFilterChange('ALL');
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1.5 cursor-pointer whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Real-time Inventory Table (Strictly Read-Only) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Live Stock Directory ({filteredProducts.length} items)
            </h2>
            <p className="text-[11px] text-slate-500">
              Current store quantities available for customer queries and quotation
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Read-only inventory interface</span>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-700 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 pl-5 pr-3 text-left w-[24%]">Product Name</th>
                <th className="py-3.5 px-3 text-left w-[18%]">Product Code / SKU</th>
                <th className="py-3.5 px-3 text-left w-[28%]">Warehouse Stock Breakdown</th>
                <th className="py-3.5 px-3 text-right w-[13%]">Selling Price</th>
                <th className="py-3.5 px-3 text-center w-[12%]">Stock Status</th>
                <th className="py-3.5 pl-2 pr-5 text-center w-[5%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">No products found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No inventory items match the current search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer border-b border-slate-100 last:border-b-0"
                      onClick={() => setInspectedProduct(product)}
                    >
                      {/* Product Name */}
                      <td className="py-3.5 pl-5 pr-3 align-middle">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm line-clamp-1">
                          {product.name}
                        </div>
                        {product.brand && (
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                            Brand: {product.brand}
                          </div>
                        )}
                      </td>

                      {/* Product Code / SKU */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="font-mono text-slate-800 font-semibold text-xs break-all">
                          {product.code || product.sku || '—'}
                        </div>
                        {product.code && product.sku && product.code !== product.sku && (
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5 break-all">
                            SKU: {product.sku}
                          </div>
                        )}
                      </td>

                      {/* Warehouse Stock Breakdown */}
                      <td className="py-3.5 px-3 align-middle">
                        {selectedWarehouseId !== 'ALL' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium text-xs border border-blue-200/60">
                            <Building className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>
                              {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Godown'}: <strong className="font-mono text-blue-900 font-bold ml-1">{formatNumber(product.computedStock)}</strong>
                            </span>
                          </span>
                        ) : (() => {
                          const whBreakdown = warehouses
                            .map(w => ({
                              warehouse: w,
                              stock: getWarehouseStock(w.id, product.id)
                            }))
                            .filter(entry => entry.stock > 0);

                          return whBreakdown.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {whBreakdown.slice(0, 3).map(({ warehouse, stock }) => (
                                <span
                                  key={warehouse.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70"
                                  title={`${warehouse.name}: ${formatNumber(stock)}`}
                                >
                                  <span className="truncate max-w-[110px]">{warehouse.name}:</span>
                                  <strong className="font-mono text-slate-900 font-bold">{formatNumber(stock)}</strong>
                                </span>
                              ))}
                              {whBreakdown.length > 3 && (
                                <span className="text-[11px] font-bold text-slate-500 self-center px-1">
                                  +{whBreakdown.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : product.computedStock > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70">
                              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Main Store:</span>
                              <strong className="font-mono text-slate-900 font-bold">{formatNumber(product.computedStock)}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 italic">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              No stock available
                            </span>
                          );
                        })()}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 text-right align-middle">
                        <span className="font-bold text-slate-900 font-mono text-xs">
                          {formatCurrency(product.sellingPrice)}
                        </span>
                        {product.mrp && product.mrp > product.sellingPrice ? (
                          <div className="text-[10px] text-slate-400 line-through mt-0.5">
                            MRP {formatCurrency(product.mrp)}
                          </div>
                        ) : null}
                      </td>

                      {/* Stock Status - Unit Removed per user request */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <StockStatusBadge
                          status={product.computedStatus}
                          currentStock={product.computedStock}
                          showUnit={false}
                          size="sm"
                          align="center"
                        />
                      </td>

                      {/* Actions: View Details Only */}
                      <td className="py-3.5 pl-2 pr-5 text-center align-middle">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setInspectedProduct(product);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="View Product Specifications"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* 5. Product Inspection Modal (Read-Only Specification Sheet) */}
      <Modal
        isOpen={Boolean(inspectedProduct)}
        onClose={() => setInspectedProduct(null)}
        title={inspectedProduct?.name || 'Product Details'}
        size="md"
      >
        {inspectedProduct && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Stock Status
                </span>
                <StatusBadge
                  status={calculateStockStatus(inspectedProduct.currentStock, inspectedProduct.reorderLevel)}
                  size="sm"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Available Quantity
                </span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {formatNumber(inspectedProduct.currentStock)} {inspectedProduct.primaryUnit || 'Piece'}
                </span>
              </div>
            </div>

            {/* Warehouse Stock Breakdown in Details Modal */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                Warehouse Stock Breakdown
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200/80 overflow-hidden">
                {warehouses.map(w => {
                  const whStock = getWarehouseStock(w.id, inspectedProduct.id);
                  return (
                    <div key={w.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700">
                          {w.name} {w.isDefault ? '(Main Godown)' : ''}
                        </span>
                        {w.code && (
                          <span className="text-[10px] font-mono text-slate-400">
                            ({w.code})
                          </span>
                        )}
                      </div>
                      <span className={'font-mono font-bold ' + (whStock > 0 ? 'text-slate-900' : 'text-slate-400')}>
                        {formatNumber(whStock)} {inspectedProduct.primaryUnit || 'Piece'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Product SKU / Code</span>
                <span className="font-mono font-bold text-slate-800">
                  {inspectedProduct.sku || inspectedProduct.code || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Barcode</span>
                <span className="font-mono text-slate-800">
                  {inspectedProduct.barcode || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Category</span>
                <span className="text-slate-800 font-medium">
                  {inspectedProduct.category || 'General'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Brand</span>
                <span className="text-slate-800 font-medium">
                  {inspectedProduct.brand || '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
              <div>
                <span className="text-[10px] text-indigo-700 font-semibold block">Selling Price</span>
                <span className="text-base font-bold font-mono text-indigo-900">
                  {formatCurrency(inspectedProduct.sellingPrice)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Maximum Retail Price (MRP)</span>
                <span className="text-sm font-semibold font-mono text-slate-700">
                  {inspectedProduct.mrp ? formatCurrency(inspectedProduct.mrp) : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">GST / Tax Rate</span>
                <span className="text-slate-800 font-medium">
                  {inspectedProduct.taxRate ? `${inspectedProduct.taxRate}%` : '0%'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">HSN / SAC Code</span>
                <span className="font-mono text-slate-800">
                  {inspectedProduct.hsn || '—'}
                </span>
              </div>
            </div>

            {inspectedProduct.description && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Description / Notes
                </span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {inspectedProduct.description}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
