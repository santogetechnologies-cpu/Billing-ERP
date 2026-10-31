import React, { useMemo } from 'react';
import {
  Boxes,
  Download,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Product } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { calculateStockStatus } from '../../utils/inventoryUtils';

export const ReportStockTab: React.FC = () => {
  const { products = [] } = useERP();

  const totalUnits = useMemo(() => products.reduce((s, p) => s + (p.currentStock || 0), 0), [products]);
  const totalValuation = useMemo(() => products.reduce((s, p) => s + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0), [products]);

  const handleExportCSV = () => {
    const data = products.map(p => ({
      'SKU': p.sku || '—',
      'Product': p.name,
      'Category': p.category,
      'Stock': p.currentStock,
      'Unit': p.primaryUnit || 'PCS',
      'Valuation': (p.currentStock || 0) * (p.purchasePrice || 0)
    }));
    exportToCSV(data, 'Stock_Valuation_Report');
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">SKU: {row.sku || '—'}</span>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: row => <span className="text-xs text-slate-600">{row.category}</span>
    },
    {
      key: 'currentStock',
      header: 'Physical Stock',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatNumber(row.currentStock)} {row.primaryUnit || 'PCS'}
        </span>
      )
    },
    {
      key: 'purchasePrice',
      header: 'Unit Cost',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs tabular-nums">{formatCurrency(row.purchasePrice)}</span>
    },
    {
      key: 'id',
      header: 'Total Asset Value',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-blue-700 text-xs tabular-nums">
          {formatCurrency((row.currentStock || 0) * (row.purchasePrice || 0))}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* 2 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Physical Units in Stock</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{formatNumber(totalUnits)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{products.length} products catalogued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Asset Inventory Valuation</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">{formatCurrency(totalValuation)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Based on purchase cost price</span>
        </div>
      </div>

      <DataTable
        title="Stock Valuation & Asset Ledger"
        subtitle={`Total ${products.length} inventory lines`}
        columns={columns}
        data={products}
        searchPlaceholder="Search product, SKU..."
        searchKeys={['name', 'sku', 'category']}
      />
    </div>
  );
};

