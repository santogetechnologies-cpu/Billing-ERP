import React, { useState, useMemo } from 'react';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Download,
  ShieldAlert,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Batch } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

interface StockExpiringTabProps {
  onWriteOffBatch?: (batch: Batch) => void;
}

export const StockExpiringTab: React.FC<StockExpiringTabProps> = ({ onWriteOffBatch }) => {
  const { batches = [], products = [] } = useERP();

  const [filterRange, setFilterRange] = useState<'ALL' | 'EXPIRED' | '30_DAYS' | '60_DAYS' | '90_DAYS'>('30_DAYS');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Augmented batch data
  const augmentedBatches = useMemo(() => {
    return batches.map(b => {
      const prod = products.find(p => p.id === b.productId);
      const expDate = new Date(b.expiryDate);
      const diffTime = expDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = daysRemaining <= 0;

      return {
        ...b,
        productName: prod?.name || b.productId,
        sku: prod?.sku || '—',
        unit: prod?.primaryUnit || 'PCS',
        purchasePrice: prod?.purchasePrice || 0,
        daysRemaining,
        isExpired
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining); // FEFO order
  }, [batches, products]);

  const filteredBatches = useMemo(() => {
    return augmentedBatches.filter(b => {
      if (filterRange === 'EXPIRED') return b.isExpired;
      if (filterRange === '30_DAYS') return b.daysRemaining <= 30;
      if (filterRange === '60_DAYS') return b.daysRemaining <= 60;
      if (filterRange === '90_DAYS') return b.daysRemaining <= 90;
      return true;
    });
  }, [augmentedBatches, filterRange]);

  const expiredCount = useMemo(() => augmentedBatches.filter(b => b.isExpired).length, [augmentedBatches]);
  const expiring30Count = useMemo(() => augmentedBatches.filter(b => !b.isExpired && b.daysRemaining <= 30).length, [augmentedBatches]);

  const handleExportCSV = () => {
    const data = filteredBatches.map(b => ({
      'Batch #': b.batchNumber,
      'Product': b.productName,
      'SKU': b.sku,
      'Remaining Stock': (b as any).currentStock ?? b.qty,
      'Unit': b.unit,
      'Expiry Date': b.expiryDate,
      'Days Remaining': b.daysRemaining,
      'Status': b.isExpired ? 'Expired' : `${b.daysRemaining} days left`
    }));
    exportToCSV(data, 'FEFO_Expiry_Risk_Ledger');
  };

  const columns: Column<any>[] = [
    {
      key: 'batchNumber',
      header: 'Batch Number',
      render: row => (
        <span className="font-mono font-bold text-blue-600 text-xs">
          {row.batchNumber}
        </span>
      )
    },
    {
      key: 'productName',
      header: 'Product',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.productName}</span>
          <span className="text-[10px] text-slate-400 font-mono">SKU: {row.sku}</span>
        </div>
      )
    },
    {
      key: 'currentStock',
      header: 'Quantity in Stock',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatNumber(row.currentStock)} {row.unit}
        </span>
      )
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: row => (
        <span className="text-xs text-slate-700 whitespace-nowrap font-medium">
          {formatDate(row.expiryDate)}
        </span>
      )
    },
    {
      key: 'daysRemaining',
      header: 'Days Left (FEFO)',
      align: 'center',
      render: row => {
        if (row.isExpired) {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
              EXPIRED ({Math.abs(row.daysRemaining)}d ago)
            </span>
          );
        }
        if (row.daysRemaining <= 30) {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {row.daysRemaining} days left
            </span>
          );
        }
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {row.daysRemaining} days left
          </span>
        );
      }
    },
    {
      key: 'id',
      header: 'At-Risk Valuation',
      align: 'right',
      render: row => (
        <span className="font-mono font-semibold text-rose-600 tabular-nums">
          {formatCurrency(row.currentStock * row.purchasePrice)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
          <span className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Expired Stock (Zero Sale Value)
          </span>
          <div className="text-2xl font-bold text-rose-800 mt-1.5 tabular-nums">
            {expiredCount}
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">Requires quarantine or write-off</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
          <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            Expiring Within 30 Days
          </span>
          <div className="text-2xl font-bold text-amber-800 mt-1.5 tabular-nums">
            {expiring30Count}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Prioritize via FEFO billing dispatch</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">FEFO Export</span>
            <p className="text-xs text-slate-600 mt-1">Export batch expiry audit report.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1">
          {[
            { id: '30_DAYS', label: 'Expiring ≤ 30 Days' },
            { id: '60_DAYS', label: 'Expiring ≤ 60 Days' },
            { id: '90_DAYS', label: 'Expiring ≤ 90 Days' },
            { id: 'EXPIRED', label: `Expired (${expiredCount})` },
            { id: 'ALL', label: `All Batches (${augmentedBatches.length})` }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterRange(chip.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filterRange === chip.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry Table */}
      <DataTable
        title="FEFO Batch Expiration Ledger"
        subtitle={`Showing ${filteredBatches.length} tracked batches`}
        columns={columns}
        data={filteredBatches}
        searchPlaceholder="Search batch #, product name, SKU..."
        searchKeys={['batchNumber', 'productName', 'sku']}
      />
    </div>
  );
};

