import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Download,
  Eye,
  Building,
  RotateCcw,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { StockStatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { Product } from '../../types';

interface StockCurrentTabProps {
  onAdjustProduct?: (product: Product) => void;
}

export const StockCurrentTab: React.FC<StockCurrentTabProps> = ({ onAdjustProduct }) => {
  const { products, warehouses, customCategories } = useERP();

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (selectedStatus !== 'ALL') {
        const status = calculateStockStatus(p.currentStock, p.minStockLevel || 10);
        if (selectedStatus === 'IN_STOCK' && status !== 'in_stock') return false;
        if (selectedStatus === 'LOW_STOCK' && status !== 'low_stock') return false;
        if (selectedStatus === 'OUT_OF_STOCK' && status !== 'out_of_stock') return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedStatus]);

  // Aggregate metrics
  const totalUnits = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + (p.currentStock || 0), 0);
  }, [filteredProducts]);

  const totalCostValuation = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);
  }, [filteredProducts]);

  const totalRetailPotential = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.salePrice || 0)), 0);
  }, [filteredProducts]);

  const handleExportCSV = () => {
    const data = filteredProducts.map(p => ({
      'SKU': p.sku || '—',
      'Product Name': p.name,
      'Category': p.category,
      'Stock Balance': p.currentStock,
      'Unit': p.primaryUnit || 'PCS',
      'Cost Price': p.purchasePrice,
      'Sale Price': p.salePrice,
      'Valuation (Cost)': p.currentStock * p.purchasePrice,
      'Status': calculateStockStatus(p.currentStock, p.minStockLevel || 10)
    }));
    exportToCSV(data, 'Current_Stock_Inventory');
  };

  const handleExportXLSX = () => {
    const data = filteredProducts.map(p => ({
      'SKU': p.sku || '—',
      'Product Name': p.name,
      'Category': p.category,
      'Stock Balance': p.currentStock,
      'Unit': p.primaryUnit || 'PCS',
      'Cost Price': p.purchasePrice,
      'Sale Price': p.salePrice,
      'Valuation (Cost)': p.currentStock * p.purchasePrice,
      'Status': calculateStockStatus(p.currentStock, p.minStockLevel || 10)
    }));
    exportToExcel(data, 'Current_Stock_Inventory');
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">SKU: {row.sku || '—'} • {row.category}</span>
        </div>
      )
    },
    {
      key: 'currentStock',
      header: 'Available Stock',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatNumber(row.currentStock)} <span className="text-xs text-slate-500 font-normal">{row.primaryUnit || 'PCS'}</span>
        </span>
      )
    },
    {
      key: 'purchasePrice',
      header: 'Cost Price',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-600 text-xs tabular-nums">{formatCurrency(row.purchasePrice)}</span>
      )
    },
    {
      key: 'salePrice',
      header: 'Selling Price',
      align: 'right',
      render: row => (
        <span className="font-mono font-medium text-slate-800 text-xs tabular-nums">{formatCurrency(row.salePrice ?? row.sellingPrice)}</span>
      )
    },
    {
      key: 'id',
      header: 'Cost Valuation',
      align: 'right',
      render: row => (
        <span className="font-mono font-semibold text-blue-700 tabular-nums">
          {formatCurrency((row.currentStock || 0) * (row.purchasePrice || 0))}
        </span>
      )
    },
    {
      key: 'minStockLevel',
      header: 'Status',
      align: 'center',
      render: row => {
        const status = calculateStockStatus(row.currentStock, row.minStockLevel || 10);
        return <StockStatusBadge status={status} />;
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Physical Units</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatNumber(totalUnits)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{filteredProducts.length} items catalogued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Inventory Cost Valuation</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">
            {formatCurrency(totalCostValuation)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Asset value based on purchase cost</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Retail Realization Potential</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">
            {formatCurrency(totalRetailPotential)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Expected revenue at selling price</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Selector */}
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Warehouses & Stores</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Categories</option>
            {customCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'IN_STOCK', label: 'In Stock' },
              { id: 'LOW_STOCK', label: 'Low Stock' },
              { id: 'OUT_OF_STOCK', label: 'Out of Stock' }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setSelectedStatus(chip.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  selectedStatus === chip.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <DataTable
        title="Warehouse Inventory Balances"
        subtitle={`Showing ${filteredProducts.length} items`}
        columns={columns}
        data={filteredProducts}
        searchPlaceholder="Search product name, SKU, or category..."
        searchKeys={['name', 'sku', 'category']}
        actions={row => onAdjustProduct ? (
          <button
            onClick={() => onAdjustProduct(row)}
            className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-semibold cursor-pointer"
            title="Adjust Stock"
          >
            Adjust
          </button>
        ) : null}
      />
    </div>
  );
};

