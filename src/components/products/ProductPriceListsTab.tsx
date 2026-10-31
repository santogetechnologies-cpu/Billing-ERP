import React, { useState } from 'react';
import { Search, DollarSign, Tag, ArrowRight, ShieldCheck, Percent } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';

export const ProductPriceListsTab: React.FC = () => {
  const { products, company } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<'All' | 'Retail' | 'Wholesale' | 'Dealer'>('All');

  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.includes(searchTerm);
      return matchSearch;
    });
  }, [products, searchTerm]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search & Tier Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-xs text-slate-500 font-medium mr-1">View Tier:</span>
          {(['All', 'Retail', 'Wholesale', 'Dealer'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedTier === tier
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Price Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-4 py-3">Base Unit</th>
                <th className="px-4 py-3 text-right">Cost Price</th>
                {(selectedTier === 'All' || selectedTier === 'Retail') && (
                  <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">Retail / Sale</th>
                )}
                {(selectedTier === 'All' || selectedTier === 'Wholesale') && (
                  <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Wholesale</th>
                )}
                {(selectedTier === 'All' || selectedTier === 'Dealer') && (
                  <th className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">Dealer / Shop</th>
                )}
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right text-rose-600">Floor Min Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-600 dark:text-slate-400">
                      {p.primaryUnit}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                      {formatCurrency(p.costPrice || p.purchasePrice || 0)}
                    </td>
                    {(selectedTier === 'All' || selectedTier === 'Retail') && (
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(p.sellingPrice)}
                      </td>
                    )}
                    {(selectedTier === 'All' || selectedTier === 'Wholesale') && (
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.wholesalePrice || p.sellingPrice)}
                      </td>
                    )}
                    {(selectedTier === 'All' || selectedTier === 'Dealer') && (
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-purple-600 dark:text-purple-400">
                        {formatCurrency(p.dealerPrice || p.sellingPrice)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrency(p.mrp || p.sellingPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-rose-600 font-medium">
                      {formatCurrency(p.minSellingPrice || p.costPrice || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

