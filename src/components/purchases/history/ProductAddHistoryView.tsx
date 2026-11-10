import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Building2,
  Calendar,
  Layers,
  User,
  Tag
} from 'lucide-react';
import { ProductAddHistoryRecord } from '../../../services/purchaseHistoryService';
import { formatDate } from '../../../utils/formatters';

interface ProductAddHistoryViewProps {
  products: ProductAddHistoryRecord[];
  isLoading?: boolean;
}

export const ProductAddHistoryView: React.FC<ProductAddHistoryViewProps> = ({ products, isLoading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');

  // Unique categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return list.sort();
  }, [products]);

  // Unique suppliers
  const suppliers = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.supplierName).filter(Boolean)));
    return list.sort();
  }, [products]);

  // Filtered records
  const filteredProducts = useMemo(() => {
    return products.filter(item => {
      // Category Filter
      if (categoryFilter !== 'All' && item.category !== categoryFilter) {
        return false;
      }

      // Supplier Filter
      if (supplierFilter !== 'All' && item.supplierName !== supplierFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.productName.toLowerCase().includes(q);
        const matchCode = item.productCode.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchSupp = item.supplierName.toLowerCase().includes(q);
        const matchUser = item.addedBy.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat && !matchSupp && !matchUser) return false;
      }

      return true;
    });
  }, [products, categoryFilter, supplierFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search & Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1 max-w-[180px]"
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

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

          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, code, category, supplier, or added by..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Product Add History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Product Add Records Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {products.length === 0
                ? 'No newly added products or stock additions have been found in the database.'
                : 'No product records match your current search and filter selections.'}
            </p>
            {(categoryFilter !== 'All' || supplierFilter !== 'All' || searchQuery) && (
              <button
                onClick={() => {
                  setCategoryFilter('All');
                  setSupplierFilter('All');
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
                  <th className="py-3 px-4 text-left whitespace-nowrap">Product Name</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Product Code</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Supplier</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Quantity Added</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Date Added</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">Added By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Product Name */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-slate-900 text-xs">
                          {item.productName}
                        </span>
                      </div>
                    </td>

                    {/* 2. Product Code */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-700 bg-blue-50/80 border border-blue-200 px-2 py-0.5 rounded-md">
                        <Tag className="w-3 h-3 text-blue-500" />
                        <span>{item.productCode}</span>
                      </span>
                    </td>

                    {/* 3. Category */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                    </td>

                    {/* 4. Supplier */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.supplierName}</span>
                      </div>
                    </td>

                    {/* 5. Quantity Added */}
                    <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.quantityAdded} {item.unit}
                      </span>
                    </td>

                    {/* 6. Date */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <span className="text-xs text-slate-700 flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(item.date)}</span>
                      </span>
                    </td>

                    {/* 7. Added By */}
                    <td className="py-3 px-4 whitespace-nowrap align-middle">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-xs text-slate-700 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.addedBy}</span>
                      </div>
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

