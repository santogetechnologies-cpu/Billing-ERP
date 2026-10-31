import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building,
  TrendingDown,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatNumber, formatDate } from '../../utils/formatters';
import { InventoryTransaction } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { StockAdjustmentModal } from './StockAdjustmentModal';

export const StockAdjustmentsTab: React.FC = () => {
  const { inventoryTransactions = [], warehouses = [] } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  // Filter specifically for Stock Adjustments
  const adjustmentTransactions = useMemo(() => {
    return inventoryTransactions
      .filter(tx => tx.type === 'Stock Adjustment')
      .filter(tx => selectedWarehouse === 'ALL' || tx.warehouse === selectedWarehouse)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inventoryTransactions, selectedWarehouse]);

  const totalDeductions = useMemo(() => {
    return adjustmentTransactions.filter(t => t.qty < 0).reduce((s, t) => s + Math.abs(t.qty), 0);
  }, [adjustmentTransactions]);

  const totalAdditions = useMemo(() => {
    return adjustmentTransactions.filter(t => t.qty > 0).reduce((s, t) => s + t.qty, 0);
  }, [adjustmentTransactions]);

  const handleExportCSV = () => {
    const data = adjustmentTransactions.map(tx => ({
      'Date': tx.date,
      'Product': tx.productName,
      'Adjustment Qty': tx.qty,
      'Unit': tx.unit,
      'Warehouse': tx.warehouse,
      'Reason & Notes': tx.notes || 'Manual Adjustment'
    }));
    exportToCSV(data, 'Stock_Adjustments_Ledger');
  };

  const handleExportXLSX = () => {
    const data = adjustmentTransactions.map(tx => ({
      'Date': tx.date,
      'Product': tx.productName,
      'Adjustment Qty': tx.qty,
      'Unit': tx.unit,
      'Warehouse': tx.warehouse,
      'Reason & Notes': tx.notes || 'Manual Adjustment'
    }));
    exportToExcel(data, 'Stock_Adjustments_Ledger');
  };

  const columns: Column<InventoryTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-xs text-slate-700 whitespace-nowrap">{formatDate(row.date)}</span>
    },
    {
      key: 'productName',
      header: 'Product',
      render: row => <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.productName}</span>
    },
    {
      key: 'qty',
      header: 'Adjustment Quantity',
      align: 'right',
      render: row => {
        const isAdd = row.qty > 0;
        return (
          <span className={`font-mono font-bold tabular-nums ${isAdd ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isAdd ? `+${formatNumber(row.qty)}` : formatNumber(row.qty)} {row.unit}
          </span>
        );
      }
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: row => <span className="text-xs text-slate-700">{row.warehouse}</span>
    },
    {
      key: 'notes',
      header: 'Reason / Explanation',
      render: row => (
        <span className="text-xs text-slate-600 block truncate max-w-md">
          {row.notes || 'Manual reconciliation'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Adjustments Logged</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {adjustmentTransactions.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Audit history of corrections</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Inventory Written Off (Loss / Damage)</span>
          <div className="text-xl font-bold text-rose-600 mt-1 tabular-nums">
            -{formatNumber(totalDeductions)} units
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Deducted from stock records</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Positive Stock Additions</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 tabular-nums">
            +{formatNumber(totalAdditions)} units
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Found or reconciled inventory</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
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

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      {/* Adjustments Table */}
      <DataTable
        title="Stock Adjustment Records"
        subtitle={`Total ${adjustmentTransactions.length} write-offs and balancing entries`}
        columns={columns}
        data={adjustmentTransactions}
        searchPlaceholder="Search product, warehouse, reason..."
        searchKeys={['productName', 'warehouse', 'notes']}
      />

      {/* 5-Step Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

