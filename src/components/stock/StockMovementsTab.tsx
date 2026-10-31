import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Search,
  Filter,
  Download,
  Calendar,
  Building,
  Layers,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatNumber, formatDate } from '../../utils/formatters';
import { InventoryTransaction } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const StockMovementsTab: React.FC = () => {
  const { inventoryTransactions = [], warehouses = [] } = useERP();

  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  const filteredTransactions = useMemo(() => {
    return inventoryTransactions.filter(tx => {
      if (selectedType !== 'ALL' && tx.type !== selectedType) return false;
      if (selectedWarehouse !== 'ALL' && tx.warehouse !== selectedWarehouse) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryTransactions, selectedType, selectedWarehouse]);

  const handleExportCSV = () => {
    const data = filteredTransactions.map(tx => ({
      'Date': tx.date,
      'Movement Type': tx.type,
      'Product': tx.productName,
      'Quantity': tx.qty,
      'Unit': tx.unit,
      'Warehouse': tx.warehouse,
      'Destination Warehouse': tx.warehouseTo || '—',
      'Reference Doc': tx.referenceDoc,
      'Notes': tx.notes || ''
    }));
    exportToCSV(data, 'Stock_Movements_Audit_Trail');
  };

  const handleExportXLSX = () => {
    const data = filteredTransactions.map(tx => ({
      'Date': tx.date,
      'Movement Type': tx.type,
      'Product': tx.productName,
      'Quantity': tx.qty,
      'Unit': tx.unit,
      'Warehouse': tx.warehouse,
      'Destination Warehouse': tx.warehouseTo || '—',
      'Reference Doc': tx.referenceDoc,
      'Notes': tx.notes || ''
    }));
    exportToExcel(data, 'Stock_Movements_Audit_Trail');
  };

  const columns: Column<InventoryTransaction>[] = [
    {
      key: 'date',
      header: 'Date & Time',
      render: row => <span className="text-xs text-slate-700 whitespace-nowrap">{formatDate(row.date)}</span>
    },
    {
      key: 'type',
      header: 'Movement Type',
      render: row => {
        const isPositive = row.type === 'Purchase' || row.type === 'Sales Return' || row.type === 'Opening Stock' || (row.type === 'Stock Adjustment' && row.qty > 0);
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isPositive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-slate-500" />}
            <span>{row.type}</span>
          </span>
        );
      }
    },
    {
      key: 'productName',
      header: 'Product',
      render: row => <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.productName}</span>
    },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'right',
      render: row => {
        const isPositive = row.qty > 0;
        return (
          <span className={`font-mono font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-slate-800'}`}>
            {isPositive ? `+${formatNumber(row.qty)}` : formatNumber(row.qty)} {row.unit}
          </span>
        );
      }
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: row => (
        <span className="text-xs text-slate-600">
          {row.warehouse} {row.warehouseTo ? `→ ${row.warehouseTo}` : ''}
        </span>
      )
    },
    {
      key: 'referenceDoc',
      header: 'Reference Document',
      render: row => (
        <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {row.referenceDoc || 'System'}
        </span>
      )
    },
    {
      key: 'notes',
      header: 'Audit Note',
      render: row => <span className="text-xs text-slate-500 italic truncate max-w-xs block">{row.notes || '—'}</span>
    }
  ];

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Movement Types</option>
            <option value="Purchase">Purchase (Inward)</option>
            <option value="Sale">Sale (Outward)</option>
            <option value="Stock Transfer">Stock Transfer</option>
            <option value="Stock Adjustment">Stock Adjustment</option>
            <option value="Sales Return">Sales Return</option>
            <option value="Purchase Return">Purchase Return</option>
            <option value="Opening Stock">Opening Stock</option>
          </select>

          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>
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

      {/* Movements Table */}
      <DataTable
        title="Stock Movements & Audit Ledger"
        subtitle={`Total ${filteredTransactions.length} transaction entries logged`}
        columns={columns}
        data={filteredTransactions}
        searchPlaceholder="Search product, reference #, or note..."
        searchKeys={['productName', 'referenceDoc', 'notes', 'warehouse']}
      />
    </div>
  );
};

