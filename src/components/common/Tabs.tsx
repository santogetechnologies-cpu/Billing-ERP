import React from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badge?: string;
  badgeColor?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  syncWithUrlQuery?: string; // e.g. 'tab'
  defaultTab?: string;
  className?: string;
  variant?: 'underline' | 'pills';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab: controlledActiveTab,
  onChange,
  syncWithUrlQuery = 'tab',
  defaultTab,
  className = '',
  variant = 'underline'
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = syncWithUrlQuery ? searchParams.get(syncWithUrlQuery) : null;
  const initialTab = controlledActiveTab || urlTab || defaultTab || tabs[0]?.id;
  const currentTab = controlledActiveTab || (syncWithUrlQuery && urlTab) || initialTab;

  const handleTabClick = (tabId: string) => {
    if (syncWithUrlQuery) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set(syncWithUrlQuery, tabId);
      setSearchParams(nextParams, { replace: true });
    }
    onChange?.(tabId);
  };

  const getBadgeStyle = (color: TabItem['badgeColor']) => {
    switch (color) {
      case 'brand':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
      case 'danger':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  if (variant === 'pills') {
    return (
      <div className={`flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl overflow-x-auto no-scrollbar ${className}`}>
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
              } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${getBadgeStyle(tab.badgeColor)}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`border-b border-slate-200/90 dark:border-slate-800 overflow-x-auto no-scrollbar ${className}`}>
      <nav className="flex items-center gap-1 sm:gap-2 -mb-px">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id)}
              className={`group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {Icon && (
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}
                />
              )}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${getBadgeStyle(tab.badgeColor)}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

