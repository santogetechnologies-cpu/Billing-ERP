import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  Scan,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building,
  Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatNumber } from '../../utils/formatters';
import { Product } from '../../types';

interface CountLine {
  product: Product;
  systemQty: number;
  countedQty: number;
  variance: number;
}

export const StockCountsTab: React.FC = () => {
  const { products, warehouses, adjustStock } = useERP();

  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0]?.name || 'Main Warehouse');
  const [searchTerm, setSearchTerm] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseFloat(val);
    setCounts(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  // Reconcile all counted variances
  const handleReconcile = async () => {
    const linesToAdjust = Object.entries(counts).filter(([id, counted]) => {
      const prod = products.find(p => p.id === id);
      return prod && counted !== prod.currentStock;
    });

    if (linesToAdjust.length === 0) {
      alert('No variances detected between counted stock and system stock.');
      return;
    }

    try {
      setIsSubmitting(true);
      for (const [id, counted] of linesToAdjust) {
        const prod = products.find(p => p.id === id);
        if (prod) {
          const delta = counted - prod.currentStock;
          await adjustStock(
            id,
            delta,
            `Physical Stock Count Reconciliation (Audit: ${selectedWarehouse})`,
            selectedWarehouse
          );
        }
      }
      setSuccessMsg(`Successfully reconciled ${linesToAdjust.length} items to physical counts!`);
      setCounts({});
    } catch (err: any) {
      alert(err?.message || 'Error reconciling stock counts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            Physical Stock Count & Audit Reconciliation
          </h2>
          <p className="text-xs text-slate-500">
            Compare shelf counts against system inventory balances and auto-generate variance adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>

          <button
            onClick={handleReconcile}
            disabled={isSubmitting || Object.keys(counts).length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Reconciling...' : 'Post Reconciliation'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Scan barcode or search product to record physical count..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200"
          />
        </div>
        <span className="text-xs text-slate-500">{filteredProducts.length} items to count</span>
      </div>

      {/* Counting Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
            <tr>
              <th className="py-2.5 px-4 text-left">Product / SKU</th>
              <th className="py-2.5 px-3 text-right">System Balance</th>
              <th className="py-2.5 px-3 text-right w-36">Physical Count</th>
              <th className="py-2.5 px-4 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.slice(0, 50).map(prod => {
              const hasCounted = counts[prod.id] !== undefined;
              const countedVal = counts[prod.id] ?? prod.currentStock;
              const variance = countedVal - prod.currentStock;

              return (
                <tr key={prod.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-900 block">{prod.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku || '—'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatNumber(prod.currentStock)} {prod.primaryUnit || 'PCS'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="any"
                      placeholder={prod.currentStock.toString()}
                      value={counts[prod.id] !== undefined ? counts[prod.id] : ''}
                      onChange={e => handleQtyChange(prod.id, e.target.value)}
                      className="w-28 px-2 py-1 text-right border border-slate-200 rounded text-xs font-mono font-semibold tabular-nums focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                    {hasCounted ? (
                      variance === 0 ? (
                        <span className="text-emerald-600">0 (Match)</span>
                      ) : variance > 0 ? (
                        <span className="text-blue-600">+{variance}</span>
                      ) : (
                        <span className="text-rose-600">{variance}</span>
                      )
                    ) : (
                      <span className="text-slate-400 font-normal">Unchanged</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

