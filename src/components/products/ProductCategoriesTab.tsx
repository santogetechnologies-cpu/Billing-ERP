import React, { useState } from 'react';
import { Plus, Tag, Layers, Check, Trash2 } from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const ProductCategoriesTab: React.FC = () => {
  const { products, customCategories, addCustomCategory } = useERP();
  const [newCatName, setNewCatName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Group products by category count
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const defaultCategories = [
    { name: 'General', desc: 'Standard retail products' },
    { name: 'Pharmacy', desc: 'Medicines, strips, tablets, syrups' },
    { name: 'Groceries', desc: 'Loose grains, packaged food, vegetables' },
    { name: 'Clothing', desc: 'Apparel, textiles, footwear' },
    { name: 'Electronics', desc: 'Phones, appliances, computers' },
    { name: 'Hardware', desc: 'Pipes, nails, tools, tiles, plywood' },
    { name: 'Automotive', desc: 'Vehicles, spare parts, tires, batteries' },
    { name: 'Services', desc: 'Installation, repair, consultations' }
  ];

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAdding(true);
    try {
      await addCustomCategory(newCatName.trim());
      setNewCatName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Category Creation Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Product Categories</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organize products across departments and configure default tax & unit rules.
          </p>
        </div>

        <form onSubmit={handleCreateCategory} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="New category name..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
          />
          <button
            type="submit"
            disabled={isAdding || !newCatName.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {defaultCategories.map(cat => {
          const count = categoryCounts[cat.name] || 0;
          return (
            <div
              key={cat.name}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mt-2.5">{cat.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{cat.desc}</p>
              </div>
            </div>
          );
        })}

        {customCategories?.map(catName => {
          const count = categoryCounts[catName] || 0;
          return (
            <div
              key={catName}
              className="p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mt-2.5">{catName}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Custom category</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

