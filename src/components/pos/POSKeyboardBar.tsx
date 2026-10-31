import React from 'react';
import {
  Search,
  User,
  Pause,
  Play,
  Edit3,
  Percent,
  RotateCcw,
  CreditCard,
  X,
  Printer
} from 'lucide-react';

interface POSKeyboardBarProps {
  onF2Search?: () => void;
  onF3Customer?: () => void;
  onF4Hold?: () => void;
  onF5Resume?: () => void;
  onF6EditLine?: () => void;
  onF8Discount?: () => void;
  onF9Return?: () => void;
  onF10Pay?: () => void;
  onEscClear?: () => void;
  heldCount?: number;
}

export const POSKeyboardBar: React.FC<POSKeyboardBarProps> = ({
  onF2Search,
  onF3Customer,
  onF4Hold,
  onF5Resume,
  onF6EditLine,
  onF8Discount,
  onF9Return,
  onF10Pay,
  onEscClear,
  heldCount = 0
}) => {
  const hints = [
    { key: 'F2', label: 'Scan / Search', icon: Search, action: onF2Search },
    { key: 'F3', label: 'Customer', icon: User, action: onF3Customer },
    { key: 'F4', label: 'Hold Bill', icon: Pause, action: onF4Hold },
    { key: 'F5', label: `Resume (${heldCount})`, icon: Play, action: onF5Resume, highlight: heldCount > 0 },
    { key: 'F6', label: 'Edit Qty', icon: Edit3, action: onF6EditLine },
    { key: 'F8', label: 'Discount', icon: Percent, action: onF8Discount },
    { key: 'F9', label: 'Return', icon: RotateCcw, action: onF9Return },
    { key: 'F10', label: 'Pay Now', icon: CreditCard, action: onF10Pay, primary: true },
    { key: 'Esc', label: 'Clear / Close', icon: X, action: onEscClear }
  ];

  return (
    <footer className="h-10 bg-slate-900 text-slate-300 border-t border-slate-800 px-3 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0 text-[11px] select-none">
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-max">
        {hints.map(h => {
          const Icon = h.icon;
          return (
            <button
              key={h.key}
              type="button"
              onClick={h.action}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
                h.primary
                  ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs'
                  : h.highlight
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-semibold'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-300 font-bold">
                {h.key}
              </kbd>
              <span className="hidden sm:inline">{h.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center gap-2 text-slate-500 text-[10px]">
        <span>⚡ 20-Item Basket in &lt;30s</span>
        <span>•</span>
        <span>Barcode Scanner Active</span>
      </div>
    </footer>
  );
};

