import React, { useState } from 'react';
import { ScanBarcode, Printer, Search, Check, Layers, Sliders } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { BarcodeCanvas } from '../barcode/BarcodeCanvas';
import { directPrintService } from '../../services/directPrintService';
import { formatCurrency } from '../../utils/formatters';

export const ProductLabelsTab: React.FC = () => {
  const { products, company } = useERP();
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [copies, setCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'50x25' | '38x25' | '100x50'>('50x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  const handlePrint = async () => {
    if (!activeProduct) return;
    setIsPrinting(true);
    setStatusMsg(null);

    try {
      const res = await directPrintService.printBarcodeSticker(
        {
          name: activeProduct.name,
          barcode: activeProduct.barcode || activeProduct.sku,
          sku: activeProduct.sku,
          sellingPrice: activeProduct.sellingPrice,
          mrp: activeProduct.mrp,
          category: activeProduct.category
        },
        copies
      );
      setStatusMsg(res.message);
    } catch (err: any) {
      setStatusMsg(`Print bridge status: ${err?.message || 'Using browser preview print'}`);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fadeIn">
      {/* Label Settings & Selector */}
      <div className="lg:col-span-1 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Barcode Label Settings</h3>
          <p className="text-xs text-slate-500">Configure sticker dimensions and print silent labels.</p>
        </div>

        {/* Product Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Select Product
          </label>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku || p.barcode})
              </option>
            ))}
          </select>
        </div>

        {/* Label Size */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Label Sticker Dimension
          </label>
          <select
            value={labelSize}
            onChange={e => setLabelSize(e.target.value as any)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="50x25">50mm × 25mm (Standard Retail)</option>
            <option value="38x25">38mm × 25mm (Pharma / Jewelry)</option>
            <option value="100x50">100mm × 50mm (Shipping / Warehouse)</option>
          </select>
        </div>

        {/* Copies */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Number of Copies
          </label>
          <input
            type="number"
            min="1"
            max="500"
            value={copies}
            onChange={e => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Toggle Elements */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={e => setShowPrice(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Show Sale Price</span>
          </label>

          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showMrp}
              onChange={e => setShowMrp(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Show MRP</span>
          </label>

          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showCategory}
              onChange={e => setShowCategory(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Show Category</span>
          </label>
        </div>

        {statusMsg && (
          <p className="text-xs p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
            {statusMsg}
          </p>
        )}

        <button
          type="button"
          disabled={isPrinting || !activeProduct}
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>{isPrinting ? 'Spooling to Printer...' : `Print ${copies} Label(s)`}</span>
        </button>
      </div>

      {/* Label Live Preview Canvas */}
      <div className="lg:col-span-2 p-6 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center min-h-[300px]">
        <span className="text-xs font-semibold text-slate-500 mb-3">Live Sticker Preview ({labelSize})</span>

        {activeProduct ? (
          <div className="bg-white text-slate-900 border-2 border-dashed border-slate-300 p-4 rounded-xl shadow-md w-72 text-center space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {company.name || 'Universal Store'}
            </p>
            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
              {activeProduct.name}
            </p>

            <div className="py-1 flex justify-center">
              <BarcodeCanvas
                value={activeProduct.barcode || activeProduct.sku || '123456789012'}
                width={1.6}
                height={40}
                fontSize={11}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 font-semibold">
              {showPrice && (
                <span className="text-blue-700 font-bold">
                  Price: {formatCurrency(activeProduct.sellingPrice)}
                </span>
              )}
              {showMrp && activeProduct.mrp > 0 && (
                <span className="text-slate-400 line-through">
                  MRP: {formatCurrency(activeProduct.mrp)}
                </span>
              )}
            </div>

            {showCategory && (
              <p className="text-[9px] text-slate-400 truncate">
                {activeProduct.category} | SKU: {activeProduct.sku}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Select a product to preview label</p>
        )}
      </div>
    </div>
  );
};

