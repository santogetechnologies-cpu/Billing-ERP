import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Package,
  DollarSign,
  Boxes,
  Ruler,
  Percent,
  Barcode,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Check,
  Edit3,
  Loader2,
  Layers,
  Calendar,
  Warehouse as WarehouseIcon,
  HelpCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Modal } from '../../components/common/Modal';
import { BASE_PRODUCT_CATEGORIES } from '../../services/categoryService';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { formatCurrency } from '../../utils/formatters';
import { UNIVERSAL_BUILTIN_UNITS, normalizeUnitKey } from '../../data/unitsData';

interface WizardStep {
  id: number;
  key: 'basic' | 'pricing' | 'inventory' | 'units' | 'tax';
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
}

const STEPS: WizardStep[] = [
  { id: 1, key: 'basic', title: '1. Basic Information', shortTitle: 'Basic Info', description: 'Name, Category, Brand, SKU & Code', icon: Package },
  { id: 2, key: 'pricing', title: '2. Product Prices', shortTitle: 'Pricing', description: 'Buying Cost & Customer Selling Prices', icon: DollarSign },
  { id: 3, key: 'inventory', title: '3. Warehouse & Opening Stock Details', shortTitle: 'Warehouse & Stock', description: 'Warehouse, Opening Stock, Unit & Batch Tracking', icon: WarehouseIcon },
  { id: 4, key: 'units', title: '4. Units & Conversion', shortTitle: 'Units', description: 'Primary, Secondary & Multipliers', icon: Ruler },
  { id: 5, key: 'tax', title: '5. Tax & HSN', shortTitle: 'Tax & HSN', description: 'GST Slabs & HSN / SAC Codes', icon: Percent }
];

export const NewProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { profile } = useAuth();
  const { addProduct, updateProduct, generateSKU, generateBarcode, units, warehouses, products, refreshData, customCategories, addCustomCategory, batches } = useERP();

  // Custom Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const handleSaveCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryModalError('Please enter a category name.');
      return;
    }

    setIsSavingCategory(true);
    setCategoryModalError(null);
    try {
      const saved = await addCustomCategory(trimmed);
      setCategory(saved);
      if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
      setIsAddCategoryModalOpen(false);
      setNewCategoryName('');
    } catch (err: any) {
      setCategoryModalError(err?.message || 'Failed to save category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleCancelAddCategory = () => {
    setIsAddCategoryModalOpen(false);
    setNewCategoryName('');
    setCategoryModalError(null);
  };

  // Wizard Navigation State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanNumberInput = (raw: string) => {
    if (raw === '') return '';
    if (raw.includes('-')) return '';
    return raw.replace(/^0+(?=\d)/, '');
  };

  // Unified Form State
  // Step 1: Basic
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Building Materials');
  const [subcategory, setSubcategory] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Step 2: Pricing
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [retailPrice, setRetailPrice] = useState<string>('');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [dealerPrice, setDealerPrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [minSellingPrice, setMinSellingPrice] = useState<string>('');

  // Step 3: Inventory
  const [openingStock, setOpeningStock] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('');
  const [warehouse, setWarehouse] = useState('');
  const [rack, setRack] = useState('');

  // Step 4: Units
  const [primaryUnit, setPrimaryUnit] = useState('Piece');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState<string>('1');

  // Unified, deduplicated list of unit options for Primary and Secondary UOM dropdowns (Supporting all 27 Universal Units + Custom)
  const unitOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    const addOption = (name: string, symbol: string) => {
      const cleanName = (name || '').trim();
      const cleanSym = (symbol || '').trim();
      if (!cleanName && !cleanSym) return;

      const nameKey = normalizeUnitKey(cleanName);
      const symbolKey = normalizeUnitKey(cleanSym);

      if ((nameKey && seen.has(nameKey)) || (symbolKey && seen.has(symbolKey))) return;
      if (nameKey) seen.add(nameKey);
      if (symbolKey) seen.add(symbolKey);

      const label = cleanName.toLowerCase() !== cleanSym.toLowerCase() && cleanSym
        ? `${cleanName} (${cleanSym})`
        : cleanName || cleanSym;

      options.push({
        value: cleanName || cleanSym,
        label
      });
    };

    // 1. All company / database units (including custom units)
    (units || []).forEach(u => {
      if (u) addOption(u.name, u.symbol);
    });

    // 2. All canonical built-in units
    UNIVERSAL_BUILTIN_UNITS.forEach(bu => {
      addOption(bu.name, bu.symbol);
    });

    // 3. Keep current selected values if custom or legacy
    if (primaryUnit) {
      addOption(primaryUnit, primaryUnit);
    }
    if (secondaryUnit) {
      addOption(secondaryUnit, secondaryUnit);
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [units, primaryUnit, secondaryUnit]);

  // Step 5: Tax
  const [hsn, setHsn] = useState('');
  const [taxRate, setTaxRate] = useState<number>(18);

  // Step 6: Tracking
  const [batchTracking, setBatchTracking] = useState(false);
  const [serialTracking, setSerialTracking] = useState(false);
  const [expiryTracking, setExpiryTracking] = useState(false);

  // Note: Warehouse auto-selection is intentionally disabled for new products to require explicit user choice.

  // Set default primary unit once available
  useEffect(() => {
    if (!primaryUnit && units.length > 0) {
      const baseUnit = units.find(u => u.isBase) || units[0];
      setPrimaryUnit(baseUnit.name || baseUnit.symbol);
    }
  }, [units, primaryUnit]);

  // Prefill existing product when editing
  useEffect(() => {
    if (isEditMode && id && products.length > 0) {
      const existing = products.find(p => p.id === id);
      if (existing) {
        setName(existing.name || '');
        setCode(existing.code || '');
        setSku(existing.sku || '');
        setBarcode(existing.barcode || '');
        setCategory(existing.category || 'General');
        setSubcategory(existing.subcategory || '');
        setBrand(existing.brand || '');
        setDescription(existing.description || '');
        setIsActive(existing.isActive ?? true);

        const toPriceInput = (val: any) => (!val || Number(val) === 0 ? '' : String(val));

        setPurchasePrice(toPriceInput(existing.purchasePrice));
        setCostPrice(toPriceInput(existing.costPrice));
        setSellingPrice(toPriceInput(existing.sellingPrice));
        setRetailPrice(toPriceInput(existing.retailPrice));
        setWholesalePrice(toPriceInput(existing.wholesalePrice));
        setDealerPrice(toPriceInput(existing.dealerPrice));
        setMrp(toPriceInput(existing.mrp));
        setMinSellingPrice(toPriceInput(existing.minSellingPrice));

        setOpeningStock(toPriceInput(existing.openingStock));
        setReorderLevel(existing.reorderLevel !== null && existing.reorderLevel !== undefined ? String(existing.reorderLevel) : '');
        const matchedWh = warehouses.find(w => w.id === existing.warehouse || w.code === existing.warehouse);
        setWarehouse(matchedWh ? matchedWh.id : (existing.warehouse || ''));
        setRack(existing.rack || '');

        const productBatch = batches?.find(b => b.productId === existing.id);
        setBatchNumber(existing.batchNumber || productBatch?.batchNumber || '');
        setExpiryDate(existing.expiryDate ? existing.expiryDate.split('T')[0] : (productBatch?.expiryDate ? productBatch.expiryDate.split('T')[0] : ''));

        setPrimaryUnit(existing.primaryUnit || 'Piece');
        setSecondaryUnit(existing.secondaryUnit || '');
        setConversionFactor(existing.conversionFactor !== undefined && existing.conversionFactor !== null ? String(existing.conversionFactor) : '1');

        setHsn(existing.hsn || '');
        setTaxRate(existing.taxRate ?? 18);

        setBatchTracking(Boolean(existing.batchTracking));
        setSerialTracking(Boolean(existing.serialTracking));
        setExpiryTracking(Boolean(existing.expiryTracking));

        // Mark all steps as initially completed in edit mode
        setCompletedSteps(new Set([1, 2, 3, 4, 5, 6]));
      }
    }
  }, [id, isEditMode, products, warehouses, batches]);

  // Auto-generate SKU & Barcode when Name or Category changes (only in create mode when empty)
  useEffect(() => {
    if (!isEditMode && name.trim() && !sku) {
      const generated = generateSKU(category, name);
      setSku(generated);
      setBarcode(generateBarcode(generated));
    }
  }, [name, category, generateSKU, generateBarcode, sku, isEditMode]);

  // Regenerate SKU helper
  const handleRegenerateSKU = () => {
    const newSku = generateSKU(category, name || 'Item');
    setSku(newSku);
    setBarcode(generateBarcode(newSku));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.sku;
      return copy;
    });
  };

  // Check SKU uniqueness
  const isSkuUnique = !products.some(
    p => p.sku && p.sku.toLowerCase() === sku.trim().toLowerCase() && (!isEditMode || p.id !== id)
  );

  // Financial margin calculation
  const numSellingPrice = Number(sellingPrice) || 0;
  const numCostPrice = Number(costPrice) || 0;
  const numPurchasePrice = Number(purchasePrice) || 0;
  const numOpeningStock = Number(openingStock) || 0;
  const effectiveCostPrice = numCostPrice > 0 ? numCostPrice : numPurchasePrice;
  const marginAmt = numSellingPrice - effectiveCostPrice;
  const marginPct = numSellingPrice > 0 ? ((marginAmt / numSellingPrice) * 100).toFixed(1) : '0';

  // Per-Step Validation Engine
  const validateStep = (stepNumber: number): Record<string, string> => {
    const errs: Record<string, string> = {};

    // STEP 1: Basic Information
    if (stepNumber === 1) {
      if (!name.trim()) {
        errs.name = 'Product name is mandatory.';
      } else if (name.trim().length < 2) {
        errs.name = 'Product name must be at least 2 characters.';
      }

      if (!category.trim()) {
        errs.category = 'Please choose a product category.';
      }

      if (!sku.trim()) {
        errs.sku = 'SKU is mandatory. Click "Regenerate" or enter an SKU.';
      } else {
        const isDuplicate = products.some(
          p => p.sku && p.sku.toLowerCase() === sku.trim().toLowerCase() && (!isEditMode || p.id !== id)
        );
        if (isDuplicate) {
          errs.sku = `SKU "${sku.trim()}" is already assigned to another product.`;
        }
      }

      if (code.trim()) {
        const isDuplicateCode = products.some(
          p => p.code && p.code.toLowerCase() === code.trim().toLowerCase() && (!isEditMode || p.id !== id)
        );
        if (isDuplicateCode) {
          errs.code = `Product code "${code.trim()}" is already in use.`;
        }
      }
    }

    // STEP 2: Multi-Tier Pricing
    if (stepNumber === 2) {
      if (sellingPrice === '' || Number(sellingPrice) <= 0) {
        errs.sellingPrice = 'Selling price is mandatory and must be greater than ₹0.';
      }

      if (costPrice !== '' && Number(costPrice) < 0) {
        errs.costPrice = 'Total cost per item cannot be negative.';
      }

      if (purchasePrice !== '' && Number(purchasePrice) < 0) {
        errs.purchasePrice = 'Buying price cannot be negative.';
      }

      if (retailPrice !== '' && Number(retailPrice) < 0) {
        errs.retailPrice = 'Retail customer price cannot be negative.';
      }

      if (wholesalePrice !== '' && Number(wholesalePrice) < 0) {
        errs.wholesalePrice = 'Bulk purchase price cannot be negative.';
      }

      if (dealerPrice !== '' && Number(dealerPrice) < 0) {
        errs.dealerPrice = 'Dealer customer price cannot be negative.';
      }

      if (mrp !== '' && Number(mrp) < 0) {
        errs.mrp = 'MRP cannot be negative.';
      }

      if (mrp !== '' && sellingPrice !== '' && Number(sellingPrice) > Number(mrp)) {
        errs.mrp = `Selling price (${formatCurrency(Number(sellingPrice))}) cannot exceed MRP (${formatCurrency(Number(mrp))}).`;
      }

      if (minSellingPrice !== '' && Number(minSellingPrice) < 0) {
        errs.minSellingPrice = 'Lowest allowed selling price cannot be negative.';
      }

      if (minSellingPrice !== '' && sellingPrice !== '' && Number(sellingPrice) < Number(minSellingPrice)) {
        errs.minSellingPrice = `Selling price cannot be below lowest allowed selling price (${formatCurrency(Number(minSellingPrice))}).`;
      }
    }

        // STEP 3: Warehouse & Opening Stock Details
    if (stepNumber === 3) {
      if (!warehouse || !warehouse.trim()) {
        errs.warehouse = 'Please select a warehouse.';
      }

      if (openingStock === '' || openingStock === null || openingStock === undefined) {
        errs.openingStock = 'Opening stock quantity is required.';
      } else if (isNaN(Number(openingStock))) {
        errs.openingStock = 'Opening stock quantity must be a valid number.';
      } else if (Number(openingStock) < 0) {
        errs.openingStock = 'Opening stock quantity cannot be negative.';
      }

      if (reorderLevel !== '' && (isNaN(Number(reorderLevel)) || Number(reorderLevel) < 0)) {
        errs.reorderLevel = 'Warning limit must be a valid non-negative number.';
      }

      // Mandatory Batch Number & Expiry Date for new products
      if (!isEditMode) {
        if (!batchNumber || !batchNumber.trim()) {
          errs.batchNumber = 'Batch number is required.';
        }
        if (!expiryDate || !expiryDate.trim()) {
          errs.expiryDate = 'Expiry date is required.';
        } else if (isNaN(new Date(expiryDate).getTime())) {
          errs.expiryDate = 'Please select a valid expiry date.';
        }
      } else {
        if (batchNumber.trim() && !expiryDate.trim()) {
          errs.expiryDate = 'Expiry date is required when batch number is provided.';
        } else if (!batchNumber.trim() && expiryDate.trim()) {
          errs.batchNumber = 'Batch number is required when expiry date is provided.';
        } else if (expiryDate.trim() && isNaN(new Date(expiryDate).getTime())) {
          errs.expiryDate = 'Please select a valid expiry date.';
        }
      }
    }

    // STEP 4: Units & Conversion
    if (stepNumber === 4) {
      if (!primaryUnit.trim()) {
        errs.primaryUnit = 'Primary base unit is mandatory.';
      }

      if (secondaryUnit && secondaryUnit.trim() !== '') {
        if (secondaryUnit.trim().toLowerCase() === primaryUnit.trim().toLowerCase()) {
          errs.secondaryUnit = 'Secondary packaging unit cannot be the same as Primary base unit.';
        }

        if (conversionFactor === '' || Number(conversionFactor) <= 0) {
          errs.conversionFactor = 'Conversion multiplier must be greater than 0.';
        } else if (Number(conversionFactor) === 1) {
          errs.conversionFactor = 'Conversion multiplier must be different from 1 when units differ.';
        }
      }
    }

    // STEP 5: Tax & HSN
    if (stepNumber === 5) {
      if (taxRate === undefined || taxRate === null || Number(taxRate) < 0 || Number(taxRate) > 100) {
        errs.taxRate = 'Please select a valid GST tax slab rate (0% - 28%).';
      }

      if (hsn.trim() && !/^[0-9A-Za-z]{2,10}$/.test(hsn.trim())) {
        errs.hsn = 'HSN/SAC code should be 2 to 10 alphanumeric characters.';
      }
    }

    return errs;
  };

  // Move to next step with validation
  const handleNext = () => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setSubmitError('Please correct the highlighted errors before continuing.');
      const firstField = Object.keys(stepErrors)[0];
      const el = document.getElementById(`field-${firstField}`);
      if (el) el.focus();
      return;
    }

    setErrors({});
    setSubmitError(null);
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Move to previous step (never loses data)
  const handlePrevious = () => {
    setErrors({});
    setSubmitError(null);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Direct step click navigation
  const handleStepClick = (targetStep: number) => {
    if (targetStep === currentStep) return;

    // Going backwards is always permitted
    if (targetStep < currentStep) {
      setErrors({});
      setSubmitError(null);
      setCurrentStep(targetStep);
      return;
    }

    // Jumping forward requires validation of all intermediate steps
    for (let s = 1; s < targetStep; s++) {
      const sErrs = validateStep(s);
      if (Object.keys(sErrs).length > 0) {
        setErrors(sErrs);
        setSubmitError(`Please complete Step ${s} before proceeding to Step ${targetStep}.`);
        setCurrentStep(s);
        const firstField = Object.keys(sErrs)[0];
        const el = document.getElementById(`field-${firstField}`);
        if (el) el.focus();
        return;
      }
    }

    setErrors({});
    setSubmitError(null);
    setCurrentStep(targetStep);
  };

  // Final Submission on Step 5
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // Validate ALL 5 steps sequentially
    for (let s = 1; s <= 5; s++) {
      const sErrs = validateStep(s);
      if (Object.keys(sErrs).length > 0) {
        setErrors(sErrs);
        setSubmitError(`Validation failed in Step ${s} (${STEPS[s - 1].shortTitle}). Please resolve before saving.`);
        setCurrentStep(s);
        const firstField = Object.keys(sErrs)[0];
        const el = document.getElementById(`field-${firstField}`);
        if (el) el.focus();
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const finalReorderLevel = reorderLevel.trim() === '' ? null : Number(reorderLevel);
      const existingProd = isEditMode && id ? products.find(p => p.id === id) : null;

      const payload = {
        name: name.trim(),
        code: code.trim() || sku.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || sku.trim(),
        category: category.trim() || 'General',
        subcategory: subcategory.trim() || category.trim(),
        brand: brand.trim(),
        description: description.trim(),
        hsn: hsn.trim(),
        taxRate: Number(taxRate) || 0,
        purchasePrice: Number(purchasePrice) || 0,
        costPrice: numCostPrice,
        sellingPrice: numSellingPrice,
        retailPrice: Number(retailPrice) || numSellingPrice,
        wholesalePrice: Number(wholesalePrice) || 0,
        dealerPrice: Number(dealerPrice) || 0,
        mrp: Number(mrp) || numSellingPrice,
        minSellingPrice: Number(minSellingPrice) || 0,
        reorderLevel: finalReorderLevel,
        openingStock: numOpeningStock,
        openingStockValue: numOpeningStock * effectiveCostPrice,
        currentStock: isEditMode && existingProd ? existingProd.currentStock : numOpeningStock,
        primaryUnit: primaryUnit.trim() || 'Piece',
        secondaryUnit: secondaryUnit.trim() || undefined,
        conversionFactor: Number(conversionFactor) || 1,
        warehouse: warehouse.trim(),
        rack: rack.trim(),
        batchNumber: batchNumber.trim(),
        expiryDate: expiryDate.trim(),
        batchTracking: true,
        serialTracking,
        expiryTracking: true,
        isActive
      };

      if (isEditMode && id) {
        await updateProduct(id, payload);
      } else {
        await addProduct(payload);
      }

      if (refreshData) {
        await refreshData();
      }

      navigate('/products', {
        state: {
          message: isEditMode
            ? `Product "${payload.name}" updated successfully.`
            : `Product "${payload.name}" added successfully.`
        }
      });
    } catch (err: any) {
      console.error('Final product submission error:', err);
      setSubmitError(err?.message || 'Database transaction failed. Product was not saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Return to Product Master"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {isEditMode ? `Edit Product: ${name || 'Master'}` : 'New Master Product Wizard'}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Step {currentStep} of 5
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete all 6 steps to ensure consistent ERP pricing, taxation, barcodes and stock tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          {(isEditMode || currentStep === 5) && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isEditMode ? 'Updating Product...' : 'Creating Product...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Update Product' : 'Save Product'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Wizard Step Progress Tracker */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Step Icons & Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {STEPS.map(step => {
            const Icon = step.icon;
            const isCurrent = currentStep === step.id;
            const hasError = currentStep === step.id && Object.keys(errors).length > 0;
            const isDone = completedSteps.has(step.id) && !hasError;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step.id)}
                className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  hasError
                    ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/25 shadow-xs'
                    : isCurrent
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : isDone
                    ? 'bg-emerald-50/40 border-emerald-300 hover:bg-emerald-50/70'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                      hasError
                        ? 'bg-rose-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {hasError ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : isDone && !isCurrent ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <Icon
                    className={`w-4 h-4 ${
                      hasError
                        ? 'text-rose-600'
                        : isCurrent
                        ? 'text-blue-600'
                        : isDone
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <div
                    className={`text-xs font-bold truncate ${
                      hasError
                        ? 'text-rose-900'
                        : isCurrent
                        ? 'text-blue-900'
                        : isDone
                        ? 'text-emerald-900'
                        : 'text-slate-700'
                    }`}
                  >
                    {isDone ? `✓ ${step.shortTitle}` : isCurrent ? `→ ${step.shortTitle}` : `○ ${step.shortTitle}`}
                  </div>
                  <div
                    className={`text-[10px] truncate mt-0.5 ${
                      hasError ? 'text-rose-600 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {hasError ? 'Errors Found' : isDone ? 'Completed' : isCurrent ? 'Active step' : 'Not completed'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Global Error Banner */}
      {submitError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <span className="font-bold block">Validation or Submission Error</span>
            <span>{submitError}</span>
          </div>
        </div>
      )}

      {/* Active Step Panel */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-6">
        {/* Step Header info */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Step {currentStep} of 5
          </span>
        </div>

        {/* =========================================================================
            STEP 1: BASIC INFORMATION
        ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Product Name */}
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="field-name"
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Portland Pozzolana Cement (50kg Bag)"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs ${
                    errors.name ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
                {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
              </div>

              {/* Brand */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Brand / Manufacturer</label>
                <input
                  id="field-brand"
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. UltraTech, Tata, Dell"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="field-category"
                  value={category === 'General' ? 'General Merchandise' : category}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__ADD_CUSTOM__') {
                      setIsAddCategoryModalOpen(true);
                      return;
                    }
                    setCategory(val);
                    if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs ${
                    errors.category ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                >
                  <option value="__ADD_CUSTOM__" className="font-bold text-blue-600 bg-blue-50/80">
                    + Add Custom Category
                  </option>
                  <option value="Building Materials">Building Materials</option>
                  <option value="Grains & Foodstuff">Grains & Foodstuff</option>
                  <option value="Metals & Structural">Metals & Structural</option>
                  <option value="Electrical Supplies">Electrical Supplies</option>
                  <option value="Apparel & Uniforms">Apparel & Uniforms</option>
                  <option value="IT & Hardware">IT & Hardware</option>
                  <option value="Paints & Chemicals">Paints & Chemicals</option>
                  <option value="Household & Consumer">Household & Consumer</option>
                  <option value="Tools & Machinery">Tools & Machinery</option>
                  <option value="Packaging Supplies">Packaging Supplies</option>
                  <option value="Safety & PPE">Safety & PPE</option>
                  <option value="General Merchandise">General Merchandise</option>
                  {customCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {category &&
                    category !== 'General' &&
                    category !== 'General Merchandise' &&
                    !BASE_PRODUCT_CATEGORIES.includes(category) &&
                    !customCategories.includes(category) && (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    )}
                </select>
                {errors.category && <p className="text-[11px] text-rose-600 mt-1">{errors.category}</p>}
              </div>

              {/* Subcategory */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subcategory</label>
                <input
                  id="field-subcategory"
                  type="text"
                  value={subcategory}
                  onChange={e => setSubcategory(e.target.value)}
                  placeholder="e.g. Cement, Cables, Laptops"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Product Code */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Product Code</label>
                <input
                  id="field-code"
                  type="text"
                  value={code}
                  onChange={e => {
                    setCode(e.target.value);
                    if (errors.code) setErrors(prev => ({ ...prev, code: '' }));
                  }}
                  placeholder="CEM-001"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs ${
                    errors.code ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                {errors.code && <p className="text-[11px] text-rose-600 mt-1">{errors.code}</p>}
              </div>

              {/* SKU Generator */}
              <div className="sm:col-span-2 p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900">
                      Standard SKU Identifier <span className="text-rose-500">*</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateSKU}
                    className="text-blue-700 hover:text-blue-900 font-semibold text-[11px] flex items-center gap-1"
                  >
                    Regenerate SKU
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="field-sku"
                    type="text"
                    value={sku}
                    onChange={e => {
                      setSku(e.target.value.toUpperCase());
                      if (errors.sku) setErrors(prev => ({ ...prev, sku: '' }));
                    }}
                    placeholder="GEN-PRD-00001"
                    className={`flex-1 px-3 py-2 bg-white border rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs ${
                      errors.sku ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-300'
                    }`}
                  />
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold ${
                      isSkuUnique
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isSkuUnique ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> Unique SKU
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" /> Duplicate SKU
                      </>
                    )}
                  </span>
                </div>
                {errors.sku && <p className="text-[11px] text-rose-600">{errors.sku}</p>}
              </div>

              {/* Barcode Display */}
              <div className="sm:col-span-1 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Barcode (EAN-13 / Code 128)</span>
                <input
                  id="field-barcode"
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="8901234567890"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                />
                <div className="pt-1 flex justify-center bg-white p-1 rounded border border-slate-200">
                  <BarcodeCanvas value={barcode || '8901234567890'} height={35} showText={false} />
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-3">
                <label className="block font-medium text-slate-700 mb-1">Description & Specifications</label>
                <textarea
                  id="field-description"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed material specifications, grade, standard compliance..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: MULTI-TIER PRICING
        ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            {/* Heading & Explanation */}
            <div className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Product Prices</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter the buying cost and the prices you charge customers.
                </p>
              </div>
            </div>

            {/* Profit Margin Preview Card */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-900 block">
                  Gross Profit Margin: {marginPct}% ({formatCurrency(marginAmt)}/unit)
                </span>
                <span className="text-[11px] text-emerald-700">
                  Formula: Selling Price ({formatCurrency(numSellingPrice)}) - {numCostPrice > 0 ? 'Total Cost' : 'Buying Price'} ({formatCurrency(effectiveCostPrice)})
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-emerald-800 block">Estimated Margin</span>
                <span className="text-base font-black text-emerald-900">{marginPct}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Buying Price */}
              <div className="flex flex-col">
                <label htmlFor="field-purchasePrice" className="block font-medium text-slate-700 mb-1">
                  Buying Price (₹)
                </label>
                <input
                  id="field-purchasePrice"
                  type="number"
                  step="any"
                  min="0"
                  value={purchasePrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setPurchasePrice(cleanNumberInput(e.target.value));
                    if (errors.purchasePrice) setErrors(prev => ({ ...prev, purchasePrice: '' }));
                  }}
                  placeholder="Enter buying price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.purchasePrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The price paid to the supplier to buy one item.
                </p>
                {errors.purchasePrice && <p className="text-[11px] text-rose-600 mt-1">{errors.purchasePrice}</p>}
              </div>

              {/* Total Cost per Item */}
              <div className="flex flex-col">
                <label htmlFor="field-costPrice" className="block font-medium text-slate-700 mb-1">
                  Total Cost per Item (₹)
                </label>
                <input
                  id="field-costPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={costPrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setCostPrice(cleanNumberInput(e.target.value));
                    if (errors.costPrice) setErrors(prev => ({ ...prev, costPrice: '' }));
                  }}
                  placeholder="Enter total cost per item"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.costPrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The total cost of one item, including purchase cost and any additional costs already supported by the application.
                </p>
                {errors.costPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.costPrice}</p>}
              </div>

              {/* Selling Price */}
              <div className="flex flex-col">
                <label htmlFor="field-sellingPrice" className="block font-medium text-slate-700 mb-1">
                  Selling Price (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="field-sellingPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setSellingPrice(cleanNumberInput(e.target.value));
                    if (errors.sellingPrice) setErrors(prev => ({ ...prev, sellingPrice: '' }));
                  }}
                  placeholder="Enter selling price"
                  className={`w-full px-3 py-2 bg-blue-50 border rounded-lg font-bold text-blue-900 text-xs ${
                    errors.sellingPrice ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-blue-300'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The normal price charged to a customer. Use this as the default price during billing.
                </p>
                {errors.sellingPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.sellingPrice}</p>}
              </div>

              {/* Retail Customer Price */}
              <div className="flex flex-col">
                <label htmlFor="field-retailPrice" className="block font-medium text-slate-700 mb-1">
                  Retail Customer Price (₹)
                </label>
                <input
                  id="field-retailPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={retailPrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setRetailPrice(cleanNumberInput(e.target.value));
                    if (errors.retailPrice) setErrors(prev => ({ ...prev, retailPrice: '' }));
                  }}
                  placeholder="Enter retail customer price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.retailPrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The price charged when selling individual items to retail customers.
                </p>
                {errors.retailPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.retailPrice}</p>}
              </div>

              {/* Bulk Purchase Price */}
              <div className="flex flex-col">
                <label htmlFor="field-wholesalePrice" className="block font-medium text-slate-700 mb-1">
                  Bulk Purchase Price (₹)
                </label>
                <input
                  id="field-wholesalePrice"
                  type="number"
                  step="any"
                  min="0"
                  value={wholesalePrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setWholesalePrice(cleanNumberInput(e.target.value));
                    if (errors.wholesalePrice) setErrors(prev => ({ ...prev, wholesalePrice: '' }));
                  }}
                  placeholder="Enter bulk purchase price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.wholesalePrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The price offered when a customer buys in bulk.
                </p>
                {errors.wholesalePrice && <p className="text-[11px] text-rose-600 mt-1">{errors.wholesalePrice}</p>}
              </div>

              {/* Dealer Customer Price */}
              <div className="flex flex-col">
                <label htmlFor="field-dealerPrice" className="block font-medium text-slate-700 mb-1">
                  Dealer Customer Price (₹)
                </label>
                <input
                  id="field-dealerPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={dealerPrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setDealerPrice(cleanNumberInput(e.target.value));
                    if (errors.dealerPrice) setErrors(prev => ({ ...prev, dealerPrice: '' }));
                  }}
                  placeholder="Enter dealer customer price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.dealerPrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The special price offered to dealers.
                </p>
                {errors.dealerPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.dealerPrice}</p>}
              </div>

              {/* MRP – Printed Maximum Price */}
              <div className="flex flex-col">
                <label htmlFor="field-mrp" className="block font-medium text-slate-700 mb-1">
                  MRP – Printed Maximum Price (₹)
                </label>
                <input
                  id="field-mrp"
                  type="number"
                  step="any"
                  min="0"
                  value={mrp}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setMrp(cleanNumberInput(e.target.value));
                    if (errors.mrp) setErrors(prev => ({ ...prev, mrp: '' }));
                  }}
                  placeholder="Enter MRP printed price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.mrp ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The maximum retail price printed on the product, where applicable.
                </p>
                {errors.mrp && <p className="text-[11px] text-rose-600 mt-1">{errors.mrp}</p>}
              </div>

              {/* Lowest Allowed Selling Price */}
              <div className="flex flex-col">
                <label htmlFor="field-minSellingPrice" className="block font-medium text-slate-700 mb-1">
                  Lowest Allowed Selling Price (₹)
                </label>
                <input
                  id="field-minSellingPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={minSellingPrice}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setMinSellingPrice(cleanNumberInput(e.target.value));
                    if (errors.minSellingPrice) setErrors(prev => ({ ...prev, minSellingPrice: '' }));
                  }}
                  placeholder="Enter lowest selling price"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-semibold text-slate-900 text-xs ${
                    errors.minSellingPrice ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  The minimum price the system permits an authorized user to sell at, subject to existing permissions and pricing rules.
                </p>
                {errors.minSellingPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.minSellingPrice}</p>}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 3: WAREHOUSE & OPENING STOCK DETAILS
        ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            {/* Warehouse & Opening Stock Section Card */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <WarehouseIcon className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Warehouse &amp; Opening Stock Details</h3>
                  <p className="text-[11px] text-slate-500">
                    Specify warehouse allocation, opening physical stock intake, and link inventory lot details.
                  </p>
                </div>
              </div>

              {/* No Active Warehouses Warning */}
              {warehouses.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No active warehouses found in the database. A warehouse is required to save inventory.</span>
                  </div>
                  {hasPermission(profile?.role, 'inventory', 'manage') && (
                    <Link
                      to="/inventory/warehouses"
                      className="ml-3 px-2.5 py-1 bg-amber-600 text-white font-medium rounded hover:bg-amber-700 whitespace-nowrap"
                    >
                      Manage Warehouses &rarr;
                    </Link>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Warehouse Dropdown */}
                <div>
                  <label htmlFor="field-warehouse" className="block font-medium text-slate-700 mb-1">
                    Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="field-warehouse"
                    value={warehouse}
                    onChange={e => {
                      setWarehouse(e.target.value);
                      if (errors.warehouse) setErrors(prev => ({ ...prev, warehouse: '' }));
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-800 text-xs cursor-pointer ${
                      errors.warehouse ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Select Warehouse * --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}){w.address ? ` — ${w.address}` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.warehouse ? (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.warehouse}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Choose the target warehouse where opening stock will be placed.
                    </p>
                  )}
                </div>

                {/* Opening Stock Quantity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="field-openingStock" className="block font-medium text-slate-700 text-xs">
                      Opening Stock Quantity <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Unit: {primaryUnit || 'Piece'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="field-openingStock"
                      type="number"
                      min="0"
                      step="any"
                      value={openingStock}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        setOpeningStock(cleanNumberInput(e.target.value));
                        if (errors.openingStock) setErrors(prev => ({ ...prev, openingStock: '' }));
                      }}
                      placeholder="0"
                      className={`w-full px-3 py-2 pr-16 bg-slate-50 border rounded-lg font-bold text-slate-900 text-xs ${
                        errors.openingStock ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 pointer-events-none">
                      {primaryUnit || 'Piece'}
                    </div>
                  </div>
                  {errors.openingStock ? (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.openingStock}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Initial physical quantity placed in this warehouse (0 or more).
                    </p>
                  )}
                </div>

                {/* Unit Selection / Representation */}
                <div>
                  <label htmlFor="field-stockUnit" className="block font-medium text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    id="field-stockUnit"
                    value={primaryUnit}
                    onChange={e => setPrimaryUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs cursor-pointer font-medium"
                  >
                    {unitOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Measurement unit for this product (Piece, Kg, Litre, Meter, etc.).
                  </p>
                </div>

                {/* Opening Stock Value */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="field-openingStockValue" className="block font-medium text-slate-700 mb-1">
                    Opening Stock Value (₹)
                  </label>
                  <input
                    id="field-openingStockValue"
                    type="text"
                    disabled
                    value={formatCurrency(numOpeningStock * effectiveCostPrice)}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-600 text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Calculated as: {numOpeningStock} {primaryUnit || 'Piece'} × {numCostPrice > 0 ? 'Total Cost per Item' : 'Buying Price'} ({formatCurrency(effectiveCostPrice)})
                  </span>
                </div>

                {/* Storage Rack */}
                <div>
                  <label htmlFor="field-rack" className="block font-medium text-slate-700 mb-1">Storage Rack / Bin Location</label>
                  <input
                    id="field-rack"
                    type="text"
                    value={rack}
                    onChange={e => setRack(e.target.value)}
                    placeholder="e.g. BAY-C4, SHELF-02"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Physical storage location in the warehouse.</p>
                </div>

                {/* Warning Limit */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="field-reorderLevel" className="block font-medium text-slate-700 text-xs">
                      Warning Limit
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Unit: {primaryUnit || 'Piece'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="field-reorderLevel"
                      type="number"
                      min="0"
                      step="any"
                      value={reorderLevel}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        setReorderLevel(cleanNumberInput(e.target.value));
                        if (errors.reorderLevel) setErrors(prev => ({ ...prev, reorderLevel: '' }));
                      }}
                      placeholder="e.g. 10 (Leave blank for Not Set)"
                      className={`w-full px-3 py-2 pr-16 bg-slate-50 border rounded-lg font-bold text-amber-700 text-xs ${
                        errors.reorderLevel ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                      }`}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                      {primaryUnit || 'Piece'}
                    </div>
                  </div>
                  {errors.reorderLevel ? (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.reorderLevel}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Triggers &ldquo;Limited&rdquo; status when available stock is &le; this limit. Clear input for Not Set.
                    </p>
                  )}
                </div>
              </div>

              {/* Batch & Expiry Details Linked to this Warehouse Stock Batch */}
              <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 p-4 rounded-xl border space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Batch &amp; Expiry Details (Linked to Opening Stock Batch)</h3>
                    <p className="text-[11px] text-slate-500">
                      Assigned to the opening batch of {numOpeningStock} {primaryUnit || 'Piece'} in {warehouses.find(w => w.id === warehouse || w.code === warehouse)?.name || 'the selected warehouse'}.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Batch Number */}
                  <div className="flex flex-col">
                    <label htmlFor="field-batchNumber" className="block font-medium text-slate-700 mb-1">
                      Batch Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="field-batchNumber"
                      type="text"
                      value={batchNumber}
                      onChange={e => {
                        setBatchNumber(e.target.value);
                        if (errors.batchNumber) setErrors(prev => ({ ...prev, batchNumber: '' }));
                      }}
                      placeholder="Enter batch number (e.g. BAT-2026-001)"
                      className={`w-full px-3 py-2 bg-white border rounded-lg font-mono font-bold text-slate-900 text-xs ${
                        errors.batchNumber ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    {errors.batchNumber ? (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.batchNumber}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Identification lot or batch code printed on the item package.
                      </p>
                    )}
                  </div>

                  {/* Expiry Date */}
                  <div className="flex flex-col">
                    <label htmlFor="field-expiryDate" className="block font-medium text-slate-700 mb-1">
                      Expiry Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="field-expiryDate"
                      type="date"
                      value={expiryDate}
                      onChange={e => {
                        setExpiryDate(e.target.value);
                        if (errors.expiryDate) setErrors(prev => ({ ...prev, expiryDate: '' }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-lg font-mono text-slate-900 text-xs cursor-pointer ${
                        errors.expiryDate ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    {errors.expiryDate ? (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.expiryDate}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Final expiration date after which the item cannot be legally or safely sold.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 4: UNITS & CONVERSION
        ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Primary Unit */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Primary Base Unit <span className="text-rose-500">*</span>
                </label>
                <select
                  id="field-primaryUnit"
                  value={primaryUnit}
                  onChange={e => {
                    setPrimaryUnit(e.target.value);
                    if (errors.primaryUnit) setErrors(prev => ({ ...prev, primaryUnit: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-800 text-xs font-semibold cursor-pointer ${
                    errors.primaryUnit ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                >
                  {unitOptions.map(u => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {errors.primaryUnit && <p className="text-[11px] text-rose-600 mt-1">{errors.primaryUnit}</p>}
              </div>

              {/* Secondary Unit */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Secondary Packaging Unit (Optional)
                </label>
                <select
                  id="field-secondaryUnit"
                  value={secondaryUnit}
                  onChange={e => {
                    setSecondaryUnit(e.target.value);
                    if (errors.secondaryUnit) setErrors(prev => ({ ...prev, secondaryUnit: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-slate-800 text-xs cursor-pointer ${
                    errors.secondaryUnit ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                >
                  <option value="">-- None (Single Unit Item) --</option>
                  {unitOptions.map(u => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {errors.secondaryUnit && <p className="text-[11px] text-rose-600 mt-1">{errors.secondaryUnit}</p>}
              </div>

              {/* Conversion Multiplier */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Conversion Factor / Multiplier
                </label>
                <input
                  id="field-conversionFactor"
                  type="number"
                  step="any"
                  min="0.0001"
                  disabled={!secondaryUnit}
                  value={conversionFactor}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    setConversionFactor(cleanNumberInput(e.target.value));
                    if (errors.conversionFactor) setErrors(prev => ({ ...prev, conversionFactor: '' }));
                  }}
                  placeholder="1.0"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold text-slate-900 text-xs disabled:opacity-50 ${
                    errors.conversionFactor ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                {errors.conversionFactor && <p className="text-[11px] text-rose-600 mt-1">{errors.conversionFactor}</p>}
              </div>
            </div>

            {/* Visual Conversion Rule Preview Card */}
            {secondaryUnit ? (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Active Unit Conversion Rule:</span>
                  <p className="mt-0.5 text-xs font-mono font-bold text-blue-800">
                    1 {secondaryUnit} = {conversionFactor || 1} {primaryUnit}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-1 bg-white border border-blue-200 rounded text-blue-700 font-semibold">
                  Multi-UOM Enabled
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                <span>Standard single-unit tracking with base unit: <strong>{primaryUnit}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 5: TAX & HSN
        ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* HSN / SAC */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">HSN / SAC Code</label>
                <input
                  id="field-hsn"
                  type="text"
                  value={hsn}
                  onChange={e => {
                    setHsn(e.target.value);
                    if (errors.hsn) setErrors(prev => ({ ...prev, hsn: '' }));
                  }}
                  placeholder="e.g. 25232930 or 8471"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono font-bold text-slate-900 text-xs ${
                    errors.hsn ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                />
                {errors.hsn && <p className="text-[11px] text-rose-600 mt-1">{errors.hsn}</p>}
              </div>

              {/* GST Slab */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  GST Tax Rate <span className="text-rose-500">*</span>
                </label>
                <select
                  id="field-taxRate"
                  value={taxRate}
                  onChange={e => {
                    setTaxRate(Number(e.target.value));
                    if (errors.taxRate) setErrors(prev => ({ ...prev, taxRate: '' }));
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold text-slate-900 text-xs cursor-pointer ${
                    errors.taxRate ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                  }`}
                >
                  <option value={0}>0% (Tax Exempt / Nil Rated)</option>
                  <option value={5}>5% (Essential Goods)</option>
                  <option value={12}>12% (Processed Goods & Standard)</option>
                  <option value={18}>18% (Standard Commercial & Services)</option>
                  <option value={28}>28% (Luxury / Cement / Heavy Structural)</option>
                </select>
                {errors.taxRate && <p className="text-[11px] text-rose-600 mt-1">{errors.taxRate}</p>}
              </div>
            </div>

            {/* Tax Breakdown Preview */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
              <span className="font-bold block text-slate-900">Tax Schedule Breakdown</span>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">Intra-State GST</span>
                  <span className="font-bold text-slate-800">
                    CGST: {taxRate / 2}% + SGST: {taxRate / 2}% = {taxRate}%
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">Inter-State GST</span>
                  <span className="font-bold text-slate-800">
                    IGST: {taxRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Step Navigation Footer */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <div>
            <button
              type="button"
              disabled={currentStep === 1 || isSubmitting}
              onClick={handlePrevious}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous Step</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
              >
                <span>Continue to {STEPS[currentStep].shortTitle}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isEditMode ? 'Updating Product...' : 'Creating Product...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isEditMode ? 'Update Product' : 'Save Product'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Custom Category Creation Modal */}
      <Modal
        isOpen={isAddCategoryModalOpen}
        onClose={handleCancelAddCategory}
        title="Add Custom Category"
        subtitle="Create a new product category for your inventory catalog"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="new-category-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="new-category-input"
              type="text"
              autoFocus
              value={newCategoryName}
              onChange={e => {
                setNewCategoryName(e.target.value);
                if (categoryModalError) setCategoryModalError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveCategory();
                }
              }}
              placeholder="e.g. Sanitaryware, Automotive, Electrical Tools..."
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                categoryModalError ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-white'
              }`}
            />
            {categoryModalError && (
              <p className="text-[11px] font-medium text-rose-600 mt-1.5">
                {categoryModalError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelAddCategory}
              disabled={isSavingCategory}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCategory}
              disabled={isSavingCategory}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSavingCategory ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Category</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
