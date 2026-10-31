import React, { useState } from 'react';
import {
  X,
  Boxes,
  Building,
  Check,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { products, warehouses, adjustStock } = useERP();

  // 5-Step Flow State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouses[0]?.name || 'Main Warehouse');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'reduce'>('reduce');
  const [qty, setQty] = useState<string>('1');
  const [reasonCode, setReasonCode] = useState<string>('Damaged / Broken in transit');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 8);

  const numericQty = Number(qty) || 0;
  const deltaQty = adjustmentType === 'add' ? numericQty : -numericQty;
  const currentStock = selectedProduct ? selectedProduct.currentStock : 0;
  const newStock = Math.max(0, currentStock + deltaQty);

  const handleConfirm = async () => {
    if (!selectedProduct) {
      setErrorMessage('Please select a product.');
      return;
    }
    if (numericQty <= 0) {
      setErrorMessage('Please enter a valid quantity greater than zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      await adjustStock(
        selectedProduct.id,
        deltaQty,
        `${reasonCode}${notes ? ` - ${notes}` : ''}`,
        selectedWarehouse
      );

      setCurrentStep(5); // Move to DONE
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to apply stock adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedProduct(null);
    setProductSearch('');
    setQty('1');
    setNotes('');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Modal Header & Universal 5-Step Indicator */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Manual Stock Adjustment</h3>
              <p className="text-[11px] text-slate-500">Universal 5-Step Inventory Reconciliation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          {[
            { num: 1, label: 'Select' },
            { num: 2, label: 'Enter' },
            { num: 3, label: 'Review' },
            { num: 4, label: 'Confirm' },
            { num: 5, label: 'Done' }
          ].map(step => (
            <div key={step.num} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentStep === step.num
                  ? 'bg-blue-600 text-white'
                  : currentStep > step.num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {currentStep > step.num ? <Check className="w-3 h-3" /> : step.num}
              </span>
              <span className={`text-[11px] font-medium hidden sm:inline ${
                currentStep === step.num ? 'text-blue-600 font-bold' : 'text-slate-500'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: SELECT */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Select Warehouse / Store
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={e => setSelectedWarehouse(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Select Product to Adjust
                </label>
                <input
                  type="text"
                  placeholder="Type product name or SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />

                <div className="mt-2 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {filteredProducts.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(prod);
                        setProductSearch(prod.name);
                      }}
                      className={`w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                        selectedProduct?.id === prod.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div>
                        <span className="font-semibold block">{prod.name}</span>
                        <span className="text-[10px] text-slate-400">SKU: {prod.sku || '—'}</span>
                      </div>
                      <span className="font-mono text-slate-500">{prod.currentStock} {prod.primaryUnit || 'PCS'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Next: Enter Quantity
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ENTER */}
          {currentStep === 2 && selectedProduct && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs flex justify-between">
                <div>
                  <span className="text-slate-400 block">Product:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedProduct.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Current Stock:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentStock} {selectedProduct.primaryUnit || 'PCS'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('reduce')}
                    className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                      adjustmentType === 'reduce'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-900/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    Reduce Stock (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                      adjustmentType === 'add'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    Add Stock (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity ({selectedProduct.primaryUnit || 'PCS'})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold tabular-nums"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason Code
                </label>
                <select
                  value={reasonCode}
                  onChange={e => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="Damaged / Broken in transit">Damaged / Broken in transit</option>
                  <option value="Shrinkage / Unaccounted loss">Shrinkage / Unaccounted loss</option>
                  <option value="Expired Stock">Expired Stock</option>
                  <option value="Physical Count Correction">Physical Count Correction</option>
                  <option value="Customer Return Restock">Customer Return Restock</option>
                  <option value="Opening Balance Correction">Opening Balance Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Specific details or reference ticket #..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Next: Review
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: REVIEW & CONFIRM */}
          {(currentStep === 3 || currentStep === 4) && selectedProduct && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Warehouse:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedWarehouse}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Product:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Stock:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{currentStock} {selectedProduct.primaryUnit || 'PCS'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Adjustment:</span>
                  <span className={`font-mono font-bold ${adjustmentType === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {adjustmentType === 'add' ? `+${numericQty}` : `-${numericQty}`} {selectedProduct.primaryUnit || 'PCS'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-sm">
                  <span>New Balance:</span>
                  <span className="text-blue-700 dark:text-blue-400">{newStock} {selectedProduct.primaryUnit || 'PCS'}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-0.5">Reason:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{reasonCode} {notes && `(${notes})`}</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Applying Adjustment...' : 'Confirm & Save Adjustment'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: DONE */}
          {currentStep === 5 && (
            <div className="py-6 text-center space-y-3 animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">Stock Adjustment Posted!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The inventory balance and audit trail for <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProduct?.name}</span> have been updated in {selectedWarehouse}.
              </p>
              <div className="pt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Adjust Another Item
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

