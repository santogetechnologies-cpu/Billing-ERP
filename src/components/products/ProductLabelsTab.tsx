import React, { useState } from 'react';
import {
  ScanBarcode,
  Printer,
  Search,
  Check,
  Layers,
  Sliders,
  Barcode as BarcodeIcon,
  Tag,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { BarcodeCanvas } from '../barcode/BarcodeCanvas';
import { directPrintService } from '../../services/directPrintService';
import { formatCurrency } from '../../utils/formatters';

export const ProductLabelsTab: React.FC = () => {
  const { products, updateProduct, company } = useERP();

  // Mode Selection: Option A (New Custom Labels) vs Option B (Manufacturer Existing Barcode)
  const [labelMode, setLabelMode] = useState<'custom_stickers' | 'manufacturer_barcode'>('custom_stickers');

  // Active Product
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const activeProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Option A State: Custom Sticker Printing
  const [copies, setCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'50x25' | '38x25' | '100x50'>('50x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Option B State: Manufacturer Barcode Mapping
  const [mfgBarcode, setMfgBarcode] = useState<string>(activeProduct?.manufacturerBarcode || '');
  const [testScanInput, setTestScanInput] = useState<string>('');
  const [testScanResult, setTestScanResult] = useState<{ found: boolean; name?: string; price?: number } | null>(null);
  const [isSavingMfgBarcode, setIsSavingMfgBarcode] = useState(false);
  const [mfgSuccessMsg, setMfgSuccessMsg] = useState<string | null>(null);

  // Switch product and sync manufacturer barcode input
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    setMfgBarcode(prod?.manufacturerBarcode || '');
    setMfgSuccessMsg(null);
    setTestScanResult(null);
  };

  // Option A Print Handler
  const handlePrintCustomSticker = async () => {
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

  // Option B: Save Manufacturer Barcode Mapping
  const handleSaveMfgBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct || !mfgBarcode.trim()) return;

    setIsSavingMfgBarcode(true);
    setMfgSuccessMsg(null);
    try {
      await updateProduct(activeProduct.id, {
        manufacturerBarcode: mfgBarcode.trim(),
        isManufacturerBarcodeActive: true
      });
      setMfgSuccessMsg(`Successfully bound manufacturer barcode "${mfgBarcode.trim()}" to ${activeProduct.name}! It is now instantly scannable at POS.`);
    } catch (err: any) {
      setMfgSuccessMsg(`Error: ${err?.message || 'Failed to update barcode'}`);
    } finally {
      setIsSavingMfgBarcode(false);
    }
  };

  // Option B: Test Scanner Input
  const handleTestScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = testScanInput.trim();
    if (!code) return;

    const matched = products.find(
      p =>
        (p.manufacturerBarcode && p.manufacturerBarcode.toLowerCase() === code.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === code.toLowerCase())
    );

    if (matched) {
      setTestScanResult({
        found: true,
        name: matched.name,
        price: matched.salePrice ?? matched.sellingPrice
      });
    } else {
      setTestScanResult({ found: false });
    }
    setTestScanInput('');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Mode Selector Tabs: Option A vs Option B (Requirement 2) */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLabelMode('custom_stickers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              labelMode === 'custom_stickers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Option A: Print Custom In-House Stickers</span>
          </button>

          <button
            type="button"
            onClick={() => setLabelMode('manufacturer_barcode')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              labelMode === 'manufacturer_barcode'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Option B: Use Pre-Printed Manufacturer Barcode (No Re-stickering)</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          {products.length} products in catalog
        </span>
      </div>

      {labelMode === 'custom_stickers' ? (
        /* ========================================================================= */
        /* OPTION A: CUSTOM STICKER GENERATOR & PRINT DESIGNER                        */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                max="500"
                value={copies}
                onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
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
              <span>{isPrinting ? 'Printing Labels...' : `Print ${copies} Custom Sticker${copies > 1 ? 's' : ''}`}</span>
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
      ) : (
        /* ========================================================================= */
        /* OPTION B: PRE-PRINTED MANUFACTURER BARCODE CONFIGURATOR (ZERO RE-STICKER) */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Mapping Form */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                  Option B Configurator
                </span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Map Manufacturer Pre-Printed Barcode
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Save hours of time: instead of sticking stickers on every package, scan the barcode already printed on the box by the manufacturer (EAN/UPC)!
              </p>
            </div>

            {/* Select Product */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Catalog Product
              </label>
              <select
                value={selectedProductId}
                onChange={e => handleSelectProduct(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.manufacturerBarcode ? `[Linked: ${p.manufacturerBarcode}]` : '[No Mfg Barcode]'}
                  </option>
                ))}
              </select>
            </div>

            {/* Scan or Input Barcode */}
            <form onSubmit={handleSaveMfgBarcode} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturer Barcode (Scan package with scanner or type numbers)
                </label>
                <div className="relative">
                  <ScanBarcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                  <input
                    type="text"
                    value={mfgBarcode}
                    onChange={e => setMfgBarcode(e.target.value)}
                    placeholder="e.g. 8901030382341 (EAN-13 / UPC)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Scan the manufacturer box with your handheld USB/wireless barcode gun.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSavingMfgBarcode || !mfgBarcode.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isSavingMfgBarcode ? 'Saving Mapping...' : 'Bind Barcode to Product'}</span>
              </button>
            </form>

            {mfgSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{mfgSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Real-Time Scanner Tester Console */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Barcode Scanner Test Console</span>
              </h3>
              <p className="text-xs text-slate-500">
                Test your physical scanner right here to confirm it instantly resolves products.
              </p>
            </div>

            <form onSubmit={handleTestScan} className="flex gap-2">
              <input
                type="text"
                value={testScanInput}
                onChange={e => setTestScanInput(e.target.value)}
                placeholder="Scan manufacturer barcode here to test..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl cursor-pointer"
              >
                Test Scan
              </button>
            </form>

            {testScanResult && (
              <div className={`p-4 rounded-xl border animate-fadeIn ${
                testScanResult.found
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-300'
              }`}>
                {testScanResult.found ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Barcode Recognized Successfully!</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {testScanResult.name}
                    </p>
                    <p className="text-xs font-mono font-semibold">
                      Counter Price: {formatCurrency(testScanResult.price || 0)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4" />
                    <span>Barcode not recognized. Link it using the form on the left.</span>
                  </div>
                )}
              </div>
            )}

            {/* Shelf Edge Label Print Card */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Shelf Edge Price Talker</h4>
                  <p className="text-[11px] text-slate-400">Print 1 label for the shelf rack instead of 50 item stickers</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                >
                  Print Shelf Tag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
