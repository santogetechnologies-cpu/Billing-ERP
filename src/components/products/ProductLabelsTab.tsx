import React, { useState, useEffect } from 'react';
import {
  Printer
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { BarcodeCanvas } from '../barcode/BarcodeCanvas';
import { directPrintService } from '../../services/directPrintService';
import { formatCurrency } from '../../utils/formatters';

export const ProductLabelsTab: React.FC = () => {
  const { products, company } = useERP();

  // Active Product
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Custom Sticker Printing State
  const [copies, setCopies] = useState<number | string>(1);
  const [labelSize, setLabelSize] = useState<'50x25' | '38x25' | '100x50'>('50x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Manage print isolation state on body
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('printing-barcodes');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-barcodes');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-barcodes');
    };
  }, []);

  // Dimensions & typography for actual printed stickers
  const getPrintStickerDimensions = (size: '50x25' | '38x25' | '100x50') => {
    switch (size) {
      case '38x25':
        return {
          width: '38mm',
          height: '25mm',
          barcodeHeight: 26,
          headerStyle: { fontSize: '6.5px', lineHeight: '8px' },
          nameStyle: { fontSize: '7.5px', lineHeight: '9px' },
          footerStyle: { fontSize: '7px', lineHeight: '8.5px' },
          padding: '1mm 1.5mm'
        };
      case '100x50':
        return {
          width: '100mm',
          height: '50mm',
          barcodeHeight: 52,
          headerStyle: { fontSize: '10px', lineHeight: '13px' },
          nameStyle: { fontSize: '13px', lineHeight: '16px' },
          footerStyle: { fontSize: '11px', lineHeight: '14px' },
          padding: '3mm 4mm'
        };
      case '50x25':
      default:
        return {
          width: '50mm',
          height: '25mm',
          barcodeHeight: 30,
          headerStyle: { fontSize: '7.5px', lineHeight: '9px' },
          nameStyle: { fontSize: '8.5px', lineHeight: '10px' },
          footerStyle: { fontSize: '7.5px', lineHeight: '9px' },
          padding: '1.5mm 2mm'
        };
    }
  };

  // Switch active product
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
  };

  // Custom Sticker Print Handler
  const handlePrintCustomSticker = async () => {
    if (!activeProduct) return;
    const printQuantity = Math.max(1, parseInt(String(copies), 10) || 1);
    setIsPrinting(true);
    setStatusMsg(null);
    document.body.classList.add('printing-barcodes');

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
        printQuantity
      );
      setStatusMsg(res.message);
    } catch (err: any) {
      setStatusMsg(`Print bridge status: ${err?.message || 'Using browser preview print'}`);
      window.print();
    } finally {
      setIsPrinting(false);
      setTimeout(() => {
        document.body.classList.remove('printing-barcodes');
      }, 1000);
    }
  };

  const handleCopiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
      setCopies('');
      return;
    }
    const cleanDigits = rawValue.replace(/[^0-9]/g, '');
    if (!cleanDigits) {
      setCopies('');
      return;
    }
    const stripped = cleanDigits.replace(/^0+/, '');
    if (stripped === '') {
      return;
    }
    const num = parseInt(stripped, 10);
    if (!isNaN(num) && num > 0) {
      setCopies(num);
    }
  };

  const displayCopies = typeof copies === 'number' && copies > 0 ? copies : Math.max(1, parseInt(String(copies), 10) || 1);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* CUSTOM STICKER GENERATOR & PRINT DESIGNER */}
      <div className="no-print barcode-screen-only grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Controls */}
        <div className="lg:col-span-1 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Custom Sticker Designer</h3>
            <p className="text-xs text-slate-500">Configure sticker layout and print thermal labels.</p>
          </div>

          {/* Product Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={e => handleSelectProduct(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku || p.code}) - {formatCurrency(p.salePrice ?? p.sellingPrice)}
                </option>
              ))}
            </select>
          </div>

          {/* Label Dimensions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sticker Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '50x25', label: '50 × 25 mm', desc: 'Standard item' },
                { id: '38x25', label: '38 × 25 mm', desc: 'Compact tag' },
                { id: '100x50', label: '100 × 50 mm', desc: 'Shelf edge' }
              ].map(size => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setLabelSize(size.id as any)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    labelSize === size.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold">{size.label}</span>
                  <span className="text-[10px] opacity-75">{size.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Elements Toggle */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Visible Elements
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={e => setShowPrice(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Include Selling Price</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showMrp}
                onChange={e => setShowMrp(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Include Statutory MRP</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showCategory}
                onChange={e => setShowCategory(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Include Category & Brand</span>
            </label>
          </div>

          {/* Copies */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Number of Copies
            </label>
            <input
              type="number"
              min="1"
              value={copies}
              onChange={handleCopiesChange}
              onKeyDown={e => {
                if (e.key === '-' || e.key === '+' || e.key === '.' || e.key === 'e' || e.key === 'E') {
                  e.preventDefault();
                }
              }}
              onBlur={() => {
                if (copies === '' || Number(copies) < 1) {
                  setCopies(1);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrintCustomSticker}
            disabled={isPrinting || !activeProduct}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Printing Labels...' : `Print ${displayCopies} Custom Sticker${displayCopies > 1 ? 's' : ''}`}</span>
          </button>

          {statusMsg && (
            <p className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg">
              {statusMsg}
            </p>
          )}
        </div>

        {/* Sticker Preview */}
        <div className="lg:col-span-2 p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
            Real-Size Thermal Sticker Preview ({labelSize} mm)
          </span>

          {activeProduct ? (
            <div
              className={`bg-white border-2 border-dashed border-slate-300 text-slate-900 rounded-xl p-3 shadow-md flex flex-col justify-between transition-all ${
                labelSize === '50x25'
                  ? 'w-72 h-36'
                  : labelSize === '38x25'
                  ? 'w-60 h-32'
                  : 'w-96 h-48'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>{company.name || 'Store'}</span>
                  {showCategory && <span>{activeProduct.category}</span>}
                </div>
                <h4 className="font-bold text-xs truncate mt-0.5 text-slate-900">
                  {activeProduct.name}
                </h4>
              </div>

              <div className="py-1 flex justify-center">
                <BarcodeCanvas
                  value={activeProduct.barcode || activeProduct.sku || '123456789012'}
                  width={1.6}
                  height={labelSize === '100x50' ? 60 : 38}
                  showText={true}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 font-semibold">
                {showPrice && (
                  <span className="text-blue-700 font-bold">
                    Price: {formatCurrency(activeProduct.salePrice ?? activeProduct.sellingPrice)}
                  </span>
                )}
                {showMrp && activeProduct.mrp > 0 && (
                  <span className="text-slate-400 line-through">
                    MRP: {formatCurrency(activeProduct.mrp)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Please select a product</p>
          )}
        </div>
      </div>

      {/* Dedicated Print-Only Container for Barcode Stickers */}
      {activeProduct && (
        <div id="barcode-print-container" className="print-only hidden print:block">
          <div className="barcode-print-grid">
            {Array.from({
              length: displayCopies
            }).map((_, idx) => {
              const activeSize = labelSize;
              const dim = getPrintStickerDimensions(activeSize);
              return (
                <div
                  key={idx}
                  className={`barcode-sticker-tag barcode-sticker-${activeSize}`}
                  style={{
                    width: dim.width,
                    height: dim.height,
                    maxWidth: dim.width,
                    maxHeight: dim.height,
                    padding: dim.padding,
                    boxSizing: 'border-box'
                  }}
                >
                  <div>
                    <div
                      className="flex items-center justify-between font-bold uppercase tracking-wider text-slate-600"
                      style={dim.headerStyle}
                    >
                      <span className="truncate">{company.name || 'Store'}</span>
                      {showCategory && activeProduct.category && (
                        <span className="truncate ml-1">{activeProduct.category}</span>
                      )}
                    </div>
                    <h4
                      className="font-bold truncate text-slate-900 mt-0.5"
                      style={dim.nameStyle}
                    >
                      {activeProduct.name}
                    </h4>
                  </div>

                  <div className="flex justify-center items-center py-0.5 overflow-hidden">
                    <BarcodeCanvas
                      value={activeProduct.barcode || activeProduct.sku || '123456789012'}
                      width={activeSize === '38x25' ? 1.2 : activeSize === '100x50' ? 1.8 : 1.4}
                      height={dim.barcodeHeight}
                      showText={true}
                    />
                  </div>

                  <div
                    className="flex items-center justify-between border-t border-slate-200 pt-0.5 font-semibold"
                    style={dim.footerStyle}
                  >
                    {showPrice && (
                      <span className="text-blue-700 font-bold">
                        Price: {formatCurrency(activeProduct.salePrice ?? activeProduct.sellingPrice)}
                      </span>
                    )}
                    {showMrp && activeProduct.mrp > 0 && (
                      <span className="text-slate-500 line-through">
                        MRP: {formatCurrency(activeProduct.mrp)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
