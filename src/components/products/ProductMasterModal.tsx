import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Printer,
  Plus,
  Layers,
  Hash,
  AlertTriangle,
  Building,
  Tag,
  DollarSign,
  Percent,
  Barcode as BarcodeIcon,
  Scan,
  ShieldCheck,
  Layers3,
  Wrench
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Product } from '../../types';
import {
  UNIVERSAL_UNITS,
  UNIVERSAL_UNIT_LIST,
  UniversalUnitCode,
  normalizeUniversalUnit,
  formatUnitQuantity
} from '../../utils/universalUnitSystem';
import { directPrintService } from '../../services/directPrintService';

interface ProductMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSaved?: (product: Product) => void;
  readOnly?: boolean;
}

export const ProductMasterModal: React.FC<ProductMasterModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaved,
  readOnly = false
}) => {
  const {
    company,
    warehouses,
    customCategories,
    addProduct,
    updateProduct,
    generateSKU,
    generateBarcode,
    products
  } = useERP();

  const isEdit = Boolean(productToEdit);

  // Essential Fields (Visible by default)
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [baseUnit, setBaseUnit] = useState<UniversalUnitCode>('PCS');
  const [sellingPrice, setSellingPrice] = useState<string>('0');
  const [purchasePrice, setPurchasePrice] = useState<string>('0');
  const [taxRate, setTaxRate] = useState<string>('18');
  const [openingStock, setOpeningStock] = useState<string>('0');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'auto' | 'manual'>('auto');

  // Progressive Disclosure Toggle
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Tracking Switches (inside More Options)
  const [batchTracking, setBatchTracking] = useState(false);
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [serialTracking, setSerialTracking] = useState(false);
  const [isServiceItem, setIsServiceItem] = useState(false);
  const [isBundleItem, setIsBundleItem] = useState(false);
  const [reorderLevel, setReorderLevel] = useState<string>('5');
  const [wholesalePrice, setWholesalePrice] = useState<string>('0');
  const [dealerPrice, setDealerPrice] = useState<string>('0');
  const [mrp, setMrp] = useState<string>('0');
  const [minSellingPrice, setMinSellingPrice] = useState<string>('0');
  const [hsn, setHsn] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');

  // Post-Save "Done" State
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Initialize Form
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setCategory(productToEdit.category || 'General');
      setBaseUnit(normalizeUniversalUnit(productToEdit.primaryUnit));
      setSellingPrice(String(productToEdit.sellingPrice || 0));
      setPurchasePrice(String(productToEdit.purchasePrice || productToEdit.costPrice || 0));
      setTaxRate(String(productToEdit.taxRate ?? 18));
      setOpeningStock(String(productToEdit.openingStock || productToEdit.currentStock || 0));
      setWarehouseId(productToEdit.warehouse || warehouses[0]?.name || '');
      setCode(productToEdit.code || productToEdit.sku || '');
      setBarcode(productToEdit.barcode || '');
      setBarcodeMode(
        productToEdit.barcodeType === 'Manufacturer / Manual' || productToEdit.manufacturerBarcode
          ? 'manual'
          : 'auto'
      );

      setBatchTracking(Boolean(productToEdit.batchTracking));
      setExpiryTracking(Boolean(productToEdit.expiryTracking));
      setSerialTracking(Boolean(productToEdit.serialTracking));
      setIsServiceItem(productToEdit.primaryUnit === 'SVC' || productToEdit.category === 'Services');
      setReorderLevel(String(productToEdit.reorderLevel || 5));
      setWholesalePrice(String(productToEdit.wholesalePrice || 0));
      setDealerPrice(String(productToEdit.dealerPrice || 0));
      setMrp(String(productToEdit.mrp || 0));
      setMinSellingPrice(String(productToEdit.minSellingPrice || 0));
      setHsn(productToEdit.hsn || '');
      setDescription(productToEdit.description || '');
      setBrand(productToEdit.brand || '');

      setShowMoreOptions(
        Boolean(
          productToEdit.batchTracking ||
          productToEdit.serialTracking ||
          productToEdit.wholesalePrice ||
          productToEdit.hsn ||
          productToEdit.description
        )
      );
    } else {
      resetForm();
    }
  }, [productToEdit, isOpen, warehouses]);

  const resetForm = () => {
    setName('');
    setCategory('General');
    setBaseUnit('PCS');
    setSellingPrice('0');
    setPurchasePrice('0');
    setTaxRate('18');
    setOpeningStock('0');
    setWarehouseId(warehouses[0]?.name || 'Main Warehouse');
    setCode('');
    setBarcode('');
    setBarcodeMode('auto');

    setShowMoreOptions(false);
    setBatchTracking(false);
    setExpiryTracking(false);
    setSerialTracking(false);
    setIsServiceItem(false);
    setIsBundleItem(false);
    setReorderLevel('5');
    setWholesalePrice('0');
    setDealerPrice('0');
    setMrp('0');
    setMinSellingPrice('0');
    setHsn('');
    setDescription('');
    setBrand('');

    setSavedProduct(null);
    setErrorMsg(null);
    setPrintSuccessMsg(null);
  };

  const handleGenerateCodes = () => {
    if (!code) setCode(generateSKU(category, name));
    if (!barcode) {
      setBarcode(generateBarcode(code || 'PROD'));
      setBarcodeMode('auto');
    }
  };

  const handleAutoGenerateBarcode = () => {
    setBarcodeMode('auto');
    const baseSku = code.trim() || generateSKU(category, name.trim() || 'Item');
    if (!code.trim()) setCode(baseSku);
    const newBarcode = generateBarcode(baseSku);
    setBarcode(newBarcode);
    setErrorMsg(null);
  };

  const handleManualBarcode = () => {
    setBarcodeMode('manual');
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Product name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const parsedSell = parseFloat(sellingPrice) || 0;
    const parsedCost = parseFloat(purchasePrice) || 0;
    const parsedStock = parseFloat(openingStock) || 0;
    const finalCode = code.trim() || generateSKU(category, trimmedName);
    const finalBarcode = barcode.trim() || (barcodeMode === 'auto' ? generateBarcode(finalCode) : finalCode);

    // Prevent duplicate barcode assignments
    if (finalBarcode) {
      const isDuplicate = products.some(
        p => p.barcode && p.barcode.trim().toLowerCase() === finalBarcode.toLowerCase() && (!isEdit || p.id !== productToEdit?.id)
      );
      if (isDuplicate) {
        setErrorMsg(`Barcode "${finalBarcode}" is already assigned to another product. Duplicate barcodes are not allowed.`);
        setIsSubmitting(false);
        return;
      }
    }

    const productPayload: Omit<Product, 'id' | 'createdAt'> = {
      name: trimmedName,
      code: finalCode,
      sku: finalCode,
      barcode: finalBarcode,
      barcodeType: (barcodeMode === 'manual' ? 'Manufacturer / Manual' : 'Auto Generated') as 'Auto Generated' | 'Manufacturer / Manual',
      manufacturerBarcode: barcodeMode === 'manual' ? finalBarcode : undefined,
      isManufacturerBarcodeActive: barcodeMode === 'manual',
      category,
      brand: brand.trim() || company.name || 'General',
      description: description.trim(),
      hsn: hsn.trim(),
      taxRate: parseFloat(taxRate) || 0,
      purchasePrice: parsedCost,
      costPrice: parsedCost,
      sellingPrice: parsedSell,
      retailPrice: parsedSell,
      wholesalePrice: parseFloat(wholesalePrice) || parsedSell,
      dealerPrice: parseFloat(dealerPrice) || parsedSell,
      mrp: parseFloat(mrp) || parsedSell,
      minSellingPrice: parseFloat(minSellingPrice) || parsedCost,
      reorderLevel: parseFloat(reorderLevel) || 5,
      openingStock: isServiceItem ? 0 : parsedStock,
      openingStockValue: isServiceItem ? 0 : parsedStock * parsedCost,
      currentStock: isServiceItem ? 0 : parsedStock,
      primaryUnit: baseUnit,
      warehouse: warehouseId || warehouses[0]?.name || 'Main Warehouse',
      rack: '',
      batchTracking: isServiceItem ? false : batchTracking,
      serialTracking: isServiceItem ? false : serialTracking,
      expiryTracking: isServiceItem ? false : expiryTracking,
      isActive: true
    };

    try {
      let saved: Product;
      if (isEdit && productToEdit) {
        await updateProduct(productToEdit.id, productPayload);
        saved = { ...productToEdit, ...productPayload };
      } else {
        saved = await addProduct(productPayload);
      }
      setSavedProduct(saved);
      onSaved?.(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintBarcode = async () => {
    if (!savedProduct) return;
    try {
      const res = await directPrintService.printBarcodeSticker(
        {
          name: savedProduct.name,
          barcode: savedProduct.barcode,
          sku: savedProduct.sku,
          sellingPrice: savedProduct.sellingPrice,
          mrp: savedProduct.mrp,
          category: savedProduct.category
        },
        1
      );
      setPrintSuccessMsg(res.message);
    } catch (err: any) {
      setPrintSuccessMsg(`Print error: ${err?.message || 'Print bridge unavailable'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {readOnly ? <Eye className="w-5 h-5" /> : <Package className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {readOnly ? 'Product Details' : isEdit ? 'Edit Product' : 'Add New Product'}
                </h2>
                {readOnly && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    View-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {readOnly
                  ? (productToEdit?.sku ? `SKU: ${productToEdit.sku}` : 'Product master information')
                  : savedProduct
                  ? 'Next best actions'
                  : 'From loose grocery to electric vehicles'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Done Step View (Part F Flow) */}
        {savedProduct ? (
          <div className="p-6 text-center space-y-5 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {savedProduct.name} saved successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                SKU: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{savedProduct.sku}</span> | 
                Barcode: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{savedProduct.barcode}</span> | 
                Base Unit: <span className="font-semibold">{savedProduct.primaryUnit}</span>
              </p>
              {printSuccessMsg && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-2 bg-blue-50 dark:bg-blue-950/40 py-1 px-3 rounded-lg inline-block">
                  {printSuccessMsg}
                </p>
              )}
            </div>

            {/* Next Best Actions (Part B1 & F) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 max-w-lg mx-auto">
              <button
                type="button"
                onClick={handlePrintBarcode}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Print Label</span>
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Entry (The Essentials by default) */
          <form onSubmit={readOnly ? e => { e.preventDefault(); onClose(); } : handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. The Essentials (Visible by default) */}
            <fieldset disabled={readOnly} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-0 p-0 m-0">
              {/* Product Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg, Cotton T-Shirt L, Basmati Rice, EV Scooter"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="General">General Retail</option>
                  <option value="Pharmacy">Pharmacy / Medicines</option>
                  <option value="Groceries">Groceries / Food</option>
                  <option value="Clothing">Clothing / Apparel</option>
                  <option value="Electronics">Electronics & Appliances</option>
                  <option value="Hardware">Hardware & Tiles</option>
                  <option value="Automotive">Vehicles & Automotive</option>
                  <option value="Services">Services & Labor</option>
                  {customCategories?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Base Unit (Universal 9 Units) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Base Unit (Stock Stored In)
                </label>
                <select
                  value={baseUnit}
                  onChange={e => setBaseUnit(e.target.value as UniversalUnitCode)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
                >
                  {UNIVERSAL_UNIT_LIST.map(u => (
                    <option key={u.code} value={u.code}>
                      {u.code} — {u.name} ({u.allowsDecimals ? `${u.decimalPlaces} decimals` : 'Whole number'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sale Price ({company.currencySymbol || '₹'}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                    {company.currencySymbol || '₹'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={e => setSellingPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tax Slab */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tax Group / GST
                </label>
                <select
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="0">0% (Tax Exempt / Nil)</option>
                  <option value="5">5% GST / VAT</option>
                  <option value="12">12% GST / VAT</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST (Luxury / Auto)</option>
                </select>
              </div>

              {/* Opening Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opening Stock ({baseUnit})
                </label>
                <input
                  type="number"
                  step={UNIVERSAL_UNITS[baseUnit].allowsDecimals ? '0.001' : '1'}
                  min="0"
                  value={openingStock}
                  onChange={e => setOpeningStock(e.target.value)}
                  disabled={isServiceItem}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* Default Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Store / Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  disabled={isServiceItem}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* SKU / Code & Barcode (Auto-generated if left blank) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Product Code / SKU
                  </label>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={handleGenerateCodes}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      Auto-generate
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Barcode Section with Auto Generate & Manual Buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Barcode (EAN-13 / Code128)
                </label>

                {/* 1. Button Alignment: [ Auto Generate ] [ Manual ] in same row */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={handleAutoGenerateBarcode}
                    className={`flex-1 sm:flex-initial h-8 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      barcodeMode === 'auto'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Auto Generate</span>
                  </button>

                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={handleManualBarcode}
                    className={`flex-1 sm:flex-initial h-8 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      barcodeMode === 'manual'
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 shadow-2xs ring-1 ring-purple-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <Scan className="w-3.5 h-3.5 text-purple-600" />
                    <span>Manual</span>
                  </button>
                </div>

                {/* When Auto Generate is selected: display generated barcode number */}
                {barcodeMode === 'auto' && (
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <BarcodeIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-bold">{barcode || 'Auto-generated on save or click Auto Generate'}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                      Auto Generated
                    </span>
                  </div>
                )}

                {/* When Manual is selected, show the barcode input field directly below these buttons */}
                {barcodeMode === 'manual' && (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        disabled={readOnly}
                        placeholder="Scan manufacturer barcode or type manually..."
                        value={barcode}
                        onChange={e => {
                          setBarcode(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.preventDefault(); // Scanner sending Enter key
                        }}
                        className="w-full pl-3 pr-16 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {barcode && !readOnly && (
                        <button
                          type="button"
                          onClick={() => setBarcode('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                          title="Clear barcode"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Scan manufacturer packaging with USB/wireless scanner or enter digits manually.
                    </p>
                  </div>
                )}
              </div>
            </fieldset>

            {/* 2. Progressive Disclosure Toggle: "More Options" (Part F) */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                <span>{showMoreOptions ? '− Hide advanced tracking & price options' : '+ More options (Batch, Serials, Price Tiers, Reorder)'}</span>
                {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showMoreOptions && (
                <fieldset disabled={readOnly} className="space-y-4 pt-3 animate-fadeIn border-0 p-0 m-0">
                  {/* Tracking Switches Card */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Product Tracking & Item Type Switches
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Batch & Expiry (Pharma & Food) */}
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchTracking}
                          onChange={e => {
                            setBatchTracking(e.target.checked);
                            if (e.target.checked) setExpiryTracking(true);
                          }}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <div>
                          <span className="font-semibold block text-slate-800 dark:text-slate-200">Batch + Expiry (FEFO)</span>
                          <span className="text-[10px] text-slate-500">Pharma, food, cosmetics</span>
                        </div>
                      </label>

                      {/* Serial / IMEI / VIN (Electronics & Vehicles) */}
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={serialTracking}
                          onChange={e => setSerialTracking(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <div>
                          <span className="font-semibold block text-slate-800 dark:text-slate-200">Serial / IMEI / VIN</span>
                          <span className="text-[10px] text-slate-500">Phones, appliances, vehicles</span>
                        </div>
                      </label>

                      {/* Service Item Switch */}
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isServiceItem}
                          onChange={e => {
                            setIsServiceItem(e.target.checked);
                            if (e.target.checked) {
                              setOpeningStock('0');
                              setBatchTracking(false);
                              setSerialTracking(false);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <div>
                          <span className="font-semibold block text-slate-800 dark:text-slate-200">Service / Labor Item</span>
                          <span className="text-[10px] text-slate-500">Zero inventory deduction</span>
                        </div>
                      </label>

                      {/* Bundle / Combo Kit Switch */}
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isBundleItem}
                          onChange={e => setIsBundleItem(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <div>
                          <span className="font-semibold block text-slate-800 dark:text-slate-200">Bundle / Combo Kit</span>
                          <span className="text-[10px] text-slate-500">Kit composed of parts</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Pricing Tiers & Cost */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Purchase Cost ({company.currencySymbol || '₹'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={purchasePrice}
                        onChange={e => setPurchasePrice(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Wholesale Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={wholesalePrice}
                        onChange={e => setWholesalePrice(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dealer / Shop Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={dealerPrice}
                        onChange={e => setDealerPrice(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Reorder Rules & HSN */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Reorder Stock Alert Level
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={reorderLevel}
                        onChange={e => setReorderLevel(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        HSN / SAC Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 3004, 8711"
                        value={hsn}
                        onChange={e => setHsn(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Brand / Manufacturer
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cipla, Nike, Samsung"
                        value={brand}
                        onChange={e => setBrand(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description / Specifications
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional technical notes, warranty details, or batch guidance..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </fieldset>
              )}
            </div>

            {/* Modal Footer with ONE Primary Action Button (Part B1) */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              {readOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Saving Product...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isEdit ? 'Update Product' : 'Save Product'}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

