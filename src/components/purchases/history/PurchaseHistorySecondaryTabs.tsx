import React from 'react';
import { ShoppingCart, RotateCcw, PackagePlus } from 'lucide-react';

export type HistoryCategory = 'purchase' | 'return' | 'product_add';

interface PurchaseHistorySecondaryTabsProps {
  activeCategory: HistoryCategory;
  onChange: (category: HistoryCategory) => void;
  purchaseCount: number;
  returnCount: number;
  productAddCount: number;
}

export const PurchaseHistorySecondaryTabs: React.FC<PurchaseHistorySecondaryTabsProps> = ({
  activeCategory,
  onChange,
  purchaseCount,
  returnCount,
  productAddCount
}) => {
  const tabs = [
    {
      id: 'purchase' as HistoryCategory,
      label: 'Purchase History',
      count: purchaseCount,
      icon: ShoppingCart,
      description: 'Vendor purchase order records'
    },
    {
      id: 'return' as HistoryCategory,
      label: 'Return History',
      count: returnCount,
      icon: RotateCcw,
      description: 'Supplier debit notes & returned goods'
    },
    {
      id: 'product_add' as HistoryCategory,
      label: 'Product Add History',
      count: productAddCount,
      icon: PackagePlus,
      description: 'Newly added products & stock intake'
    }
  ];

  return (
    <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(tab => {
          const isActive = activeCategory === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span className="truncate">{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

