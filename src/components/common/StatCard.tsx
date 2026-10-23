import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  icon: LucideIcon;
  iconBgColor?: string;
  iconTextColor?: string;
  onClick?: () => void;
  isSelected?: boolean;
  selectedColor?: 'blue' | 'indigo' | 'rose' | 'emerald' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconTextColor = 'text-blue-600',
  onClick,
  isSelected = false,
  selectedColor = 'blue'
}) => {
  const strVal = String(value ?? '');

  // Render metric value cleanly without overflow or awkward line splitting
  const renderMetricValue = () => {
    // 1. Number with trailing unit text: e.g. "5,09,927 Units", "3 Products", "4 SKUs"
    const unitMatch = strVal.match(/^(.+?)\s+([A-Za-z]+)$/);
    if (unitMatch) {
      const [, num, unit] = unitMatch;
      return (
        <div className="flex items-baseline gap-1.5 min-w-0 truncate" title={strVal}>
          <span className="text-base sm:text-lg xl:text-xl font-bold tracking-tight text-slate-900 font-mono leading-none truncate">
            {num}
          </span>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 font-sans shrink-0">
            {unit}
          </span>
        </div>
      );
    }

    // 2. Currency value with decimal paise: e.g. "₹22,30,000.00"
    const currMatch = strVal.match(/^([₹$€£]?-?[\d,]+)(\.\d{2})?$/);
    if (currMatch) {
      const [, intPart, decPart] = currMatch;
      return (
        <div className="flex items-baseline min-w-0 truncate" title={strVal}>
          <span className="text-base sm:text-lg xl:text-xl font-bold tracking-tight text-slate-900 font-mono leading-none truncate">
            {intPart}
          </span>
          {decPart && (
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 font-mono shrink-0 ml-0.5">
              {decPart}
            </span>
          )}
        </div>
      );
    }

    // 3. Fallback text/numeric string
    return (
      <h3
        className={`font-bold tracking-tight text-slate-900 font-mono leading-none truncate ${
          strVal.length > 14
            ? 'text-sm sm:text-base'
            : strVal.length > 10
            ? 'text-base sm:text-lg'
            : 'text-lg sm:text-xl'
        }`}
        title={strVal}
      >
        {strVal}
      </h3>
    );
  };

  const selectedStylesMap: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-xs',
    indigo: 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-xs',
    rose: 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20 shadow-xs',
    emerald: 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-xs',
    amber: 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20 shadow-xs'
  };
  const activeSelectedClass = isSelected ? (selectedStylesMap[selectedColor] || selectedStylesMap.blue) : '';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`glass-panel p-3.5 sm:p-4 h-full min-w-0 flex flex-col justify-between transition-all overflow-hidden ${activeSelectedClass} ${
        onClick
          ? 'glass-card-interactive hover:border-blue-400/90 group select-none cursor-pointer'
          : 'hover:border-slate-300'
      }`}
    >
      {/* Top Header Row: Title on Left, Icon Badge on Right */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p
          className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors truncate leading-tight"
          title={title}
        >
          {title}
        </p>
        <div className={`p-1.5 sm:p-2 rounded-lg ${iconBgColor} ${iconTextColor} shrink-0 transition-transform group-hover:scale-105 shadow-2xs`}>
          <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      {/* Primary Value: Full width of card */}
      <div className="my-2.5 min-w-0 flex items-center min-h-[28px]">
        {renderMetricValue()}
      </div>

      {/* Footer / Subtitle / Trend */}
      {(change || subtitle) && (
        <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-xs w-full shrink-0">
          {change && (
            <span
              className={`inline-flex items-center font-semibold gap-1 shrink-0 ${
                change.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {change.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {change.value}
            </span>
          )}
          {subtitle && (
            <div
              className={`flex items-center gap-1 min-w-0 text-slate-500 group-hover:text-slate-700 transition-colors ${
                !change ? 'w-full justify-between' : 'ml-auto'
              }`}
            >
              <span className="truncate text-[11px] leading-tight font-medium" title={subtitle}>
                {subtitle}
              </span>
              {onClick && (
                <ArrowRight className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 -translate-x-0.5 group-hover:translate-x-0" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


