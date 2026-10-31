import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShoppingCart,
  Download,
  Building,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { StockStatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { Product } from '../../types';

interface StockLowTabProps {
  onCreatePO?: (product: Product) => void;
}

export const StockLowTab: React.FC<StockLowTabProps> = ({ onCreatePO }) => {
  const { products, warehouses } = useERP();

  const [filterType, setFilterType] = useState<'ALL_LOW' | 'OUT_OF_STOCK' | 'CRITICAL'>('ALL_LOW');

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const minLevel = p.minStockLevel || 10;
      const status = calculateStockStatus(p.currentStock, minLevel);
      if (filterType === 'OUT_OF_STOCK') return p.currentStock <= 0;
      if (filterType === 'CRITICAL') return p.currentStock > 0 && p.currentStock <= minLevel / 2;
      return status === 'low_stock' || status === 'out_of_stock';
    });
  }, [products, filterType]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.currentStock <= 0).length;
  }, [products]);

  const criticalCount = useMemo(() => {
    return products.filter(p => p.currentStock > 0 && p.currentStock <= (p.minStockLevel || 10)).length;
  }, [products]);

  const handleExportCSV = () => {
    const data = lowStockProducts.map(p => ({
      'SKU': p.sku || '—',
      'Product Name': p.name,
      'Current Stock': p.currentStock,
      'Min Level': p.minStockLevel || 10,
      'Deficit': Math.max(0, (p.minStockLevel || 10) - p.currentStock),
      'Unit': p.primaryUnit || 'PCS',
      'Supplier': p.supplierName || '—',
      'Status': p.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'
    }));
    exportToCSV(data, 'Low_Stock_Reorder_List');
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
      header: 'Current Stock',
      align: 'right',
      render: row => (
        <span className={`font-mono font-bold tabular-nums ${row.currentStock <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
          {formatNumber(row.currentStock)} {row.primaryUnit || 'PCS'}
        </span>
      )
    },
    {
      key: 'minStockLevel',
      header: 'Reorder Level',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-600 text-xs tabular-nums">
          {formatNumber(row.minStockLevel || 10)} {row.primaryUnit || 'PCS'}
        </span>
      )
    },
    {
      key: 'id',
      header: 'Shortage / Deficit',
      align: 'right',
      render: row => {
        const deficit = Math.max(0, (row.minStockLevel || 10) - row.currentStock);
        return (
          <span className="font-mono font-bold text-rose-600 tabular-nums">
            -{formatNumber(deficit)} {row.primaryUnit || 'PCS'}
          </span>
        );
      }
    },
    {
      key: 'purchasePrice',
      header: 'Reorder Cost Est.',
      align: 'right',
      render: row => {
        const deficit = Math.max(0, (row.minStockLevel || 10) - row.currentStock);
        const estCost = deficit * (row.purchasePrice || 0);
        return (
          <span className="font-mono text-slate-800 text-xs font-semibold tabular-nums">
            {formatCurrency(estCost)}
          </span>
        );
      }
    },
    {
      key: 'supplierName',
      header: 'Preferred Supplier',
      render: row => (
        <span className="text-xs text-slate-600 truncate max-w-[150px] block">
          {row.supplierName || 'Default Vendor'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
          <span className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Out of Stock (Zero Units)
          </span>
          <div className="text-2xl font-bold text-rose-800 mt-1.5 tabular-nums">
            {outOfStockCount}
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">Immediate restocking required</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
          <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Below Reorder Threshold
          </span>
          <div className="text-2xl font-bold text-amber-800 mt-1.5 tabular-nums">
            {criticalCount}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Nearing stock depletion</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Bulk Procurement</span>
            <p className="text-xs text-slate-600 mt-1">Export low stock report to vendor purchase list.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export List</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1">
          {[
            { id: 'ALL_LOW', label: `All Alerts (${lowStockProducts.length})` },
            { id: 'OUT_OF_STOCK', label: `Out of Stock (${outOfStockCount})` },
            { id: 'CRITICAL', label: `Critical Reorder (${criticalCount})` }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterType(chip.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filterType === chip.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Low Stock Table */}
      <DataTable
        title="Restock Priority Matrix"
        subtitle={`${lowStockProducts.length} items require reordering`}
        columns={columns}
        data={lowStockProducts}
        searchPlaceholder="Search product, SKU..."
        searchKeys={['name', 'sku', 'category', 'supplierName']}
        actions={row => onCreatePO ? (
          <button
            onClick={() => onCreatePO(row)}
            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold cursor-pointer flex items-center gap-1"
          >
            <ShoppingCart className="w-3 h-3" />
            <span>Order</span>
          </button>
        ) : null}
      />
    </div>
  );
};

