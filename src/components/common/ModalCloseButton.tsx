import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ModalCloseButtonProps {
  onClose: () => void;
  className?: string;
  autoHandleEscape?: boolean;
  escLabel?: string;
  size?: 'sm' | 'md';
}

/**
 * Standardized Modal Close Control for Universal Billing ERP
 * Features:
 * 1. Compact ESC badge button (clickable + keyboard indicator, light grey background, subtle border)
 * 2. Red Cross (X) button (pale pink background, subtle red border, red X icon, hover state)
 * 3. Consistent positioning, horizontal alignment, and accessible focus states
 */
export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
  onClose,
  className = '',
  autoHandleEscape = false,
  escLabel = 'ESC',
  size = 'md'
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!autoHandleEscape) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [autoHandleEscape, handleKeyDown]);

  const isSm = size === 'sm';

  return (
    <div className={`flex items-center gap-2 shrink-0 select-none ${className}`}>
      {/* 1. Compact ESC Button */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Press Escape or click to close"
        title="Press ESC or click to close"
        className={`inline-flex items-center justify-center font-semibold font-mono text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-slate-300 active:scale-95 ${
          isSm ? 'px-1.5 py-0.5 text-[10px] h-7' : 'px-2 py-1 text-[11px] h-8'
        }`}
      >
        {escLabel}
      </button>

      {/* 2. Red Cross (X) Button */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close dialog"
        title="Close dialog"
        className={`inline-flex items-center justify-center rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] hover:border-red-300 text-[#DC2626] hover:text-[#B91C1C] transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-red-400/40 active:scale-95 shrink-0 ${
          isSm ? 'w-7 h-7' : 'w-8 h-8'
        }`}
      >
        <X className={`${isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} stroke-[2.25]`} />
      </button>
    </div>
  );
};
