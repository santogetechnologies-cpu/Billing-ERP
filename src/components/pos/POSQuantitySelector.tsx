import React, { useState, useRef, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { InvoiceItem } from '../../types';

export interface POSQuantitySelectorProps {
  item: InvoiceItem;
  itemStock: number;
  isOutOfStock: boolean;
  isInsufficient: boolean;
  decimalAllowed?: boolean;
  onUpdateQty: (delta: number) => void;
  onSetQty: (newQty: number | string) => { success: boolean; message?: string };
}

export const POSQuantitySelector: React.FC<POSQuantitySelectorProps> = ({
  item,
  isOutOfStock,
  isInsufficient,
  decimalAllowed = false,
  onUpdateQty,
  onSetQty
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(item.qty));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep internal input string aligned with item.qty when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(item.qty));
    }
  }, [item.qty, isEditing]);

  const commitValue = () => {
    const raw = inputValue.trim();

    // If left completely blank or just a dot, restore last valid quantity
    if (raw === '' || raw === '.') {
      setInputValue(String(item.qty));
      setIsEditing(false);
      return;
    }

    const result = onSetQty(raw);
    if (!result.success) {
      // Revert to last confirmed valid quantity
      setInputValue(String(item.qty));
    } else {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && isFinite(parsed)) {
        // Clean format: integers without decimal point, decimals without trailing zeros beyond needed
        const formatted = decimalAllowed
          ? String(Math.round(parsed * 1000) / 1000)
          : String(Math.round(parsed));
        setInputValue(formatted);
      }
    }
    setIsEditing(false);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setInputValue(String(item.qty));
    // Select all text on focus to support immediate replacement typing or Ctrl+A
    e.currentTarget.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow typing numbers, single decimal point if decimal permitted, and clearing
    const val = e.target.value;
    // Basic filter: allow empty or numeric characters (including single decimal point)
    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
      setInputValue(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(String(item.qty));
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    commitValue();
  };

  return (
    <div
      className={`flex items-center border rounded-lg overflow-hidden shrink-0 transition-all ${
        isEditing
          ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 shadow-xs'
          : isOutOfStock || isInsufficient
          ? 'border-rose-300 bg-rose-50/70'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
      }`}
    >
      <button
        type="button"
        onClick={() => onUpdateQty(-1)}
        className="p-1 hover:bg-slate-200 text-slate-600 transition-colors focus:outline-none"
        title="Decrease quantity by 1"
        aria-label="Decrease quantity"
      >
        <Minus className="w-3 h-3" />
      </button>

      <input
        ref={inputRef}
        type="text"
        inputMode={decimalAllowed ? 'decimal' : 'numeric'}
        data-testid={`pos-cart-qty-input-${item.id}`}
        aria-label={`Quantity for ${item.productName}`}
        value={isEditing ? inputValue : item.qty}
        onFocus={handleFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`w-14 px-1 py-0.5 text-center font-bold text-xs bg-transparent border-0 outline-none focus:ring-0 cursor-text select-all transition-colors ${
          isOutOfStock || isInsufficient ? 'text-rose-600 font-extrabold' : 'text-slate-900'
        }`}
        title="Click to type quantity directly (Enter to confirm, Esc to restore)"
      />

      <button
        type="button"
        onClick={() => onUpdateQty(1)}
        className="p-1 hover:bg-slate-200 text-slate-600 transition-colors focus:outline-none"
        title="Increase quantity by 1"
        aria-label="Increase quantity"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};
