import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  Building2,
  Calendar,
  Phone,
  Package,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ReturnHistoryRecord } from '../../../services/purchaseHistoryService';
import { formatDate, formatCurrency } from '../../../utils/formatters';

interface ReturnHistoryViewProps {
  returns: ReturnHistoryRecord[];
  isLoading?: boolean;
}

export const ReturnHistoryView: React.FC<ReturnHistoryViewProps> = ({ returns, isLoading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Unique suppliers
  const suppliers = useMemo(() => {
    const list = Array.from(new Set(returns.map(r => r.supplierName).filter(Boolean)));
    return list.sort();
  }, [returns]);

  // Unique statuses
  const statuses = useMemo(() => {
    const list = Array.from(new Set(returns.map(r => r.status).filter(Boolean)));
    return list.sort();
  }, [returns]);

  // Filtered returns
  const filteredReturns = useMemo(() => {
    return returns.filter(item => {
      // Supplier Filter
      if (supplierFilter !== 'All' && item.supplierName !== supplierFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = item.returnNumber.toLowerCase().includes(q);
        const matchSupp = item.supplierName.toLowerCase().includes(q);
        const matchReason = item.reason.toLowerCase().includes(q);
        const matchItem = item.returnedProducts.some(p => p.productName.toLowerCase().includes(q));
        if (!matchNum && !matchSupp && !matchReason && !matchItem) return false;
      }

      return true;
    });
  }, [returns, supplierFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search & Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Supplier filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1 max-w-[180px]"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">All Statuses</option>
              {statuses.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search return #, supplier, product, or reason..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Return Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredReturns.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Return History Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {returns.length === 0
                ? 'No supplier purchase returns or debit notes have been recorded in the database yet.'
                : 'No return records match your active search and filter criteria.'}
            </p>
            {(supplierFilter !== 'All' || statusFilter !== 'All' || searchQuery) && (
              <button
                onClick={() => {
                  setSupplierFilter('All');
                  setStatusFilter('All');
                  setSearchQuery('');
                }}
                className="mt-4 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Return Number</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Supplier</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Returned Products</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Quantity</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Return Date</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Reason</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Return Number */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-600 text-xs">
                          {item.returnNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Debit Note
                        </span>
                      </div>
                    </td>

                    {/* 2. Supplier */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <div className="font-semibold text-slate-900 text-xs">
                        {item.supplierName}
                      </div>
                      {item.supplierContact && item.supplierContact !== 'Not available' ? (
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.supplierContact}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Direct Supplier
                        </div>
                      )}
                    </td>

                    {/* 3. Returned Products */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      {item.returnedProducts.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 text-xs">
                            {item.returnedProducts.map(p => p.productName).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Returned items</span>
                      )}
                    </td>

                    {/* 4. Quantity */}
                    <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {item.totalQuantity} {item.returnedProducts[0]?.unit || 'Units'}
                      </span>
                    </td>

                    {/* 5. Return Date */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <span className="text-xs text-slate-700 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(item.returnDate)}</span>
                      </span>
                    </td>

                    {/* 6. Reason */}
                    <td className="py-3 px-4 align-middle max-w-[260px]">
                      <div className="text-xs text-slate-600 truncate" title={item.reason}>
                        {item.reason}
                      </div>
                    </td>

                    {/* 7. Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.status.toLowerCase().includes('issued') || item.status.toLowerCase().includes('approved')
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{item.status}</span>
                      </span>
                    </td>

                    {/* 8. Total Amount (₹) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

