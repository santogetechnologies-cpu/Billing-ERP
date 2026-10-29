import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Warehouse as WarehouseIcon,
  Check,
  X,
  Save,
  RefreshCw,
  ShieldAlert,
  Hash,
  Layers,
  Tag,
  DollarSign,
  Link as LinkIcon,
  Lock,
  Barcode as BarcodeIcon,
  Sparkles
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { BASE_PRODUCT_CATEGORIES } from '../../services/categoryService';
import { UNIVERSAL_BUILTIN_UNITS, normalizeUnitKey } from '../../data/unitsData';
import { Product } from '../../types';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import { supabase } from '../../lib/supabase';
import { canAssignBarcode, canManageBarcodeOverride } from '../../utils/rbac';

// Product Entry Form Interface
export interface ProductEntryItem {
  id: string;
  existingProductId?: string;
  name: string;
  sku: string;
  code: string;
  barcode: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  primaryUnit: string;
  secondaryUnit: string;
  conversionFactor: string;
  sellingPrice: string;
  costPrice: string;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  dealerPrice: string;
  mrp: string;
  minSellingPrice: string;
  taxRate: number;
  hsn: string;
  reorderLevel: string;
  targetStockLevel: string;
  warehouse: string;
  openingStock: string;
  rack: string;
  batchNumber: string;
  expiryDate: string;
  serialNumber: string;
  batchTracking: boolean;
  expiryTracking: boolean;
  serialTracking: boolean;
  isActive: boolean;
  isExpanded?: boolean;
}

/**
 * Clean numeric quantity inputs:
 * - If cleared, returns empty string so user can freely delete and type without jumping back to 0.
 * - If user types when field is '0' (e.g. '02' or '025'), strips leading zeros preceding a digit to become '2' or '25'.
 * - Preserves decimals like '0.5' and '0.'.
 * - Strips negative signs.
 */
export const cleanQuantityInput = (val: string): string => {
  if (val === '') return '';
  const noNeg = val.replace(/-/g, '');
  return noNeg.replace(/^0+(?=\d)/, '');
};

export const InitialStockPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    products,
    warehouses,
    units,
    batches,
    customCategories,
    addCustomCategory,
    addProduct,
    generateSKU,
    generateBarcode,
    generateNextBatchNumber,
    refreshData,
    serialNumbers,
    addSerialNumber
  } = useERP();

  // Role Security Check
  const canManageProducts =
    profile?.role === 'Owner' || profile?.role === 'Admin' || profile?.role === 'Purchase Manager';

  const canAssign = canAssignBarcode(profile?.role);
  const canOverride = canManageBarcodeOverride(profile?.role);

  // Status / Feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Custom Category Modal State
  // ---------------------------------------------------------------------------
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [targetCategoryItemIdx, setTargetCategoryItemIdx] = useState<number | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set<string>(BASE_PRODUCT_CATEGORIES);
    (customCategories || []).forEach(c => {
      if (c && c.trim()) set.add(c.trim());
    });
    (products || []).forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [customCategories, products]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryModalError('Category name is required.');
      return;
    }
    setIsSavingCategory(true);
    setCategoryModalError(null);
    try {
      const saved = await addCustomCategory(trimmed);
      if (targetCategoryItemIdx !== null) {
        handleUpdateItem(targetCategoryItemIdx, 'category', saved);
      }
      setIsAddCategoryModalOpen(false);
      setNewCategoryName('');
      setTargetCategoryItemIdx(null);
    } catch (err: any) {
      setCategoryModalError(err?.message || 'Failed to save category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Unit Options
  // ---------------------------------------------------------------------------
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

      const label =
        cleanName.toLowerCase() !== cleanSym.toLowerCase() && cleanSym
          ? `${cleanName} (${cleanSym})`
          : cleanName || cleanSym;

      options.push({ value: cleanName || cleanSym, label });
    };

    (units || []).forEach(u => {
      if (u) addOption(u.name, u.symbol);
    });

    UNIVERSAL_BUILTIN_UNITS.forEach(bu => {
      addOption(bu.name, bu.symbol);
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [units]);

  // ---------------------------------------------------------------------------
  // Product Items State (Starts with 1 product by default)
  // ---------------------------------------------------------------------------
  // Computes the next batch number sequentially based on DB batches and items currently in the form
  const computeNextBatchPreview = (
    indexOffset = 0,
    existingInForm?: ProductEntryItem[],
    targetDate?: string
  ): string => {
    const d = targetDate ? new Date(targetDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `BTH-${yy}${mm}-`;

    let maxNum = 0;
    // Check batches already loaded in context from database
    (batches || []).forEach(b => {
      const match = (b.batchNumber || '').match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    // Check products catalog
    (products || []).forEach(p => {
      const match = (p.batchNumber || '').match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    // Check items currently in form
    (existingInForm || []).forEach(item => {
      const match = (item.batchNumber || '').match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const nextSeq = maxNum + 1 + indexOffset;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const createDefaultItem = (index: number, existingItems?: ProductEntryItem[], initialBatch?: string): ProductEntryItem => {
    const defaultCat = 'Building Materials';
    const prefix = defaultCat.slice(0, 3).toUpperCase();

    // Unique SKU calculation against current list and catalog
    const usedSkus = new Set((existingItems || []).map(i => i.sku.trim().toLowerCase()));
    (products || []).forEach(p => usedSkus.add(p.sku.trim().toLowerCase()));

    let randNum = Math.floor(1000 + Math.random() * 9000);
    let sku = `${prefix}-${randNum}`;
    while (usedSkus.has(sku.toLowerCase())) {
      randNum = Math.floor(1000 + Math.random() * 9000);
      sku = `${prefix}-${randNum}`;
    }

    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);

    // Compute immediate sequential batch number so the field is NEVER empty on initial paint
    const autoBatch = initialBatch || computeNextBatchPreview(0, existingItems);

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      existingProductId: undefined,
      name: '',
      sku: sku,
      code: sku,
      barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      category: defaultCat,
      subcategory: '',
      brand: '',
      description: '',
      primaryUnit: 'Piece',
      secondaryUnit: '',
      conversionFactor: '1',
      sellingPrice: '',
      costPrice: '',
      purchasePrice: '',
      retailPrice: '',
      wholesalePrice: '',
      dealerPrice: '',
      mrp: '',
      minSellingPrice: '',
      taxRate: 18,
      hsn: '',
      reorderLevel: '',
      targetStockLevel: '',
      warehouse: warehouses.length > 0 ? warehouses[0].id : '',
      openingStock: '0',
      rack: '',
      batchNumber: autoBatch,
      expiryDate: exp.toISOString().split('T')[0],
      serialNumber: '',
      batchTracking: true,
      expiryTracking: true,
      serialTracking: false,
      isActive: true,
      isExpanded: true
    };
  };

  const [items, setItems] = useState<ProductEntryItem[]>([createDefaultItem(0)]);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const getNextBatch = async (targetDate?: string): Promise<string> => {
    if (generateNextBatchNumber) {
      return await generateNextBatchNumber(targetDate);
    }
    const cId = (profile as any)?.company_id || (profile as any)?.companyId;
    return await productService.generateNextBatchNumber(cId, targetDate);
  };

  // Auto-generate batch number for the initial entry on component mount
  useEffect(() => {
    let isMounted = true;
    if (items.length > 0 && !items[0].batchNumber) {
      getNextBatch(items[0].expiryDate || undefined)
        .then(newBatch => {
          if (isMounted && newBatch) {
            setItems(prev =>
              prev.map((item, idx) => (idx === 0 && !item.batchNumber ? { ...item, batchNumber: newBatch } : item))
            );
          }
        })
        .catch(err => {
          console.warn('Initial auto batch number generation error:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Add Item control with automatic unique batch generation
  const handleAddItem = async () => {
    const newItem = createDefaultItem(items.length, items);
    setItems(prev => [...prev, newItem]);

    try {
      const newBatch = await getNextBatch(newItem.expiryDate || undefined);
      if (newBatch) {
        setItems(prev =>
          prev.map(item => (item.id === newItem.id ? { ...item, batchNumber: newBatch } : item))
        );
      }
    } catch (err) {
      console.warn('Failed to auto-generate batch number for added item:', err);
    }
  };

  // Remove Item control
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
    setItemErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Update item field
  const handleUpdateItem = (index: number, field: keyof ProductEntryItem, value: any) => {
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'sku' && !item.code) {
          updated.code = value;
        }
        return updated;
      })
    );
    if (itemErrors[index]) {
      setItemErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // Select / Match an Existing Product and Load its details including Serial Tracking
  const handleSelectExistingProduct = async (index: number, existing: Product) => {
    const matchingSerials = (serialNumbers || []).filter(s => s.productId === existing.id);
    const loadedSerial = matchingSerials.length > 0 ? matchingSerials[0].serialNumber : '';

    let batchNumToUse = items[index]?.batchNumber;
    if (!batchNumToUse || !batchNumToUse.trim()) {
      try {
        batchNumToUse = await getNextBatch(items[index]?.expiryDate || undefined);
      } catch (e) {
        console.warn('Failed to auto-generate batch number for existing product entry:', e);
      }
    }

    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          existingProductId: existing.id,
          name: existing.name,
          sku: existing.sku,
          code: existing.code || existing.sku,
          barcode: existing.barcode || item.barcode,
          category: existing.category || item.category,
          subcategory: existing.subcategory || '',
          brand: existing.brand || '',
          description: existing.description || '',
          primaryUnit: existing.primaryUnit || item.primaryUnit,
          secondaryUnit: existing.secondaryUnit || '',
          conversionFactor: existing.conversionFactor ? String(existing.conversionFactor) : '1',
          sellingPrice: existing.sellingPrice !== undefined ? String(existing.sellingPrice) : item.sellingPrice,
          costPrice: existing.costPrice !== undefined ? String(existing.costPrice) : item.costPrice,
          purchasePrice: existing.purchasePrice !== undefined ? String(existing.purchasePrice) : item.purchasePrice,
          retailPrice: existing.retailPrice !== undefined ? String(existing.retailPrice) : item.retailPrice,
          wholesalePrice: existing.wholesalePrice !== undefined ? String(existing.wholesalePrice) : item.wholesalePrice,
          dealerPrice: existing.dealerPrice !== undefined ? String(existing.dealerPrice) : item.dealerPrice,
          mrp: existing.mrp !== undefined ? String(existing.mrp) : item.mrp,
          minSellingPrice: existing.minSellingPrice !== undefined ? String(existing.minSellingPrice) : item.minSellingPrice,
          taxRate: existing.taxRate ?? item.taxRate,
          hsn: existing.hsn || '',
          rack: existing.rack || item.rack,
          batchNumber: batchNumToUse || item.batchNumber,
          serialNumber: loadedSerial,
          serialTracking: Boolean(existing.serialTracking || loadedSerial),
          batchTracking: Boolean(existing.batchTracking ?? true),
          expiryTracking: Boolean(existing.expiryTracking ?? true)
        };
      })
    );
  };

  // SKU / Barcode / Batch / Serial Generators
  const handleAutoGenerateSku = (index: number) => {
    const item = items[index];
    if (generateSKU) {
      const gen = generateSKU(item.category, item.name || 'Product');
      handleUpdateItem(index, 'sku', gen);
      if (!item.code) handleUpdateItem(index, 'code', gen);
      if (!item.barcode) handleUpdateItem(index, 'barcode', gen);
    } else {
      const prefix = (item.category || 'PROD').slice(0, 3).toUpperCase();
      const num = Math.floor(1000 + Math.random() * 9000);
      const gen = `${prefix}-${num}`;
      handleUpdateItem(index, 'sku', gen);
      if (!item.code) handleUpdateItem(index, 'code', gen);
      if (!item.barcode) handleUpdateItem(index, 'barcode', gen);
    }
  };

  const handleAutoGenerateBarcode = (index: number) => {
    const item = items[index];
    const baseVal = item.sku.trim() || 'PROD';
    if (generateBarcode) {
      handleUpdateItem(index, 'barcode', generateBarcode(baseVal));
    } else {
      const rand = Math.floor(100000000000 + Math.random() * 900000000000);
      handleUpdateItem(index, 'barcode', String(rand));
    }
  };

  const handleAutoGenerateBatch = async (index: number) => {
    const item = items[index];
    if (item.batchNumber && item.batchNumber.trim()) {
      const confirmOverwrite = window.confirm(
        `A batch number is already entered ("${item.batchNumber.trim()}"). Do you want to overwrite it with an automatically generated batch number?`
      );
      if (!confirmOverwrite) return;
    }

    try {
      if (generateNextBatchNumber) {
        const newBatch = await generateNextBatchNumber(item.expiryDate || undefined);
        handleUpdateItem(index, 'batchNumber', newBatch);
      } else {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        handleUpdateItem(index, 'batchNumber', `BTH-${yy}${mm}-001`);
      }
    } catch (err) {
      console.warn('Failed to auto-generate batch number via service:', err);
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      handleUpdateItem(index, 'batchNumber', `BTH-${yy}${mm}-001`);
    }
  };

  const handleAutoGenerateSerial = (index: number) => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const gen = `SN-${Date.now().toString().slice(-4)}${rand}`;
    handleUpdateItem(index, 'serialNumber', gen);
  };

  const applyExpiryPreset = (index: number, months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    handleUpdateItem(index, 'expiryDate', `${yyyy}-${mm}-${dd}`);
  };

  // Summary Metrics
  const summary = useMemo(() => {
    let totalItems = items.length;
    let totalQty = 0;
    let totalValuation = 0;

    items.forEach(item => {
      const q = Number(item.openingStock) || 0;
      const c = Number(item.costPrice) || Number(item.purchasePrice) || 0;
      totalQty += q;
      totalValuation += q * c;
    });

    return { totalItems, totalQty, totalValuation };
  }, [items]);

  // Validation
  const handleValidateAndSubmit = async () => {
    setErrorMessage(null);
    const errors: Record<number, string> = {};
    const seenSkus = new Map<string, number>();
    const seenBarcodes = new Map<string, number>();
    const seenSerials = new Map<string, number>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entryNum = i + 1;

      if (!item.name.trim()) {
        errors[i] = `Product #${entryNum}: Product Name is required.`;
        break;
      }

      if (!item.sku.trim()) {
        errors[i] = `Product #${entryNum}: SKU is required.`;
        break;
      }

      // Check intra-batch unique SKU
      const lowerSku = item.sku.trim().toLowerCase();
      if (seenSkus.has(lowerSku)) {
        const priorIdx = seenSkus.get(lowerSku)! + 1;
        errors[i] = `Duplicate SKU "${item.sku}" detected between Product #${priorIdx} and Product #${entryNum}. Each product entry must have a unique SKU.`;
        break;
      }
      seenSkus.set(lowerSku, i);

      // Check against existing catalog products if creating a new product
      if (!item.existingProductId) {
        const existingConflict = products.find(p => p.sku.trim().toLowerCase() === lowerSku);
        if (existingConflict) {
          errors[i] = `SKU "${item.sku}" in Product #${entryNum} is already used by existing product "${existingConflict.name}".`;
          break;
        }
      }

      // Barcode validation & duplicate prevention
      if (item.barcode.trim()) {
        const lowerBarcode = item.barcode.trim().toLowerCase();
        if (seenBarcodes.has(lowerBarcode)) {
          const priorIdx = seenBarcodes.get(lowerBarcode)! + 1;
          errors[i] = `Duplicate Barcode "${item.barcode.trim()}" detected between Product #${priorIdx} and Product #${entryNum}. Each product entry must have a unique Barcode.`;
          break;
        }
        seenBarcodes.set(lowerBarcode, i);

        // Check against catalog
        const conflictProd = products.find(
          p => p.barcode && p.barcode.trim().toLowerCase() === lowerBarcode && p.id !== item.existingProductId
        );
        if (conflictProd) {
          errors[i] = `Barcode "${item.barcode.trim()}" in Product #${entryNum} is already assigned to "${conflictProd.name}" (SKU: ${conflictProd.sku}).`;
          break;
        }
      }

      // Role check for modifying pre-assigned barcode on existing product
      if (item.existingProductId && !canOverride) {
        const origProd = products.find(p => p.id === item.existingProductId);
        if (origProd?.barcode && origProd.barcode.trim() && item.barcode.trim() !== origProd.barcode.trim()) {
          errors[i] = `Product #${entryNum}: You do not have permission to overwrite an existing assigned barcode. Requires Owner or Admin.`;
          break;
        }
      }

      if (!item.category.trim()) {
        errors[i] = `Product #${entryNum}: Category is required.`;
        break;
      }

      if (!item.primaryUnit.trim()) {
        errors[i] = `Product #${entryNum}: Primary Unit is required.`;
        break;
      }

      const sp = Number(item.sellingPrice);
      if (item.sellingPrice === '' || isNaN(sp) || sp < 0) {
        errors[i] = `Product #${entryNum}: Valid Selling Price is required (0 or greater).`;
        break;
      }

      const q = Number(item.openingStock);
      if (item.openingStock !== '' && (isNaN(q) || q < 0)) {
        errors[i] = `Product #${entryNum}: Opening stock quantity cannot be negative.`;
        break;
      }

      if (q > 0 || item.existingProductId) {
        if (!item.warehouse.trim()) {
          errors[i] = `Product #${entryNum}: Destination Warehouse is required when stock is specified.`;
          break;
        }

        if (!item.batchNumber.trim()) {
          try {
            const autoBatch = await getNextBatch(item.expiryDate || undefined);
            item.batchNumber = autoBatch;
            handleUpdateItem(i, 'batchNumber', autoBatch);
          } catch {
            errors[i] = `Product #${entryNum}: Batch Number is required for opening stock tracking.`;
            break;
          }
        }

        if (!item.expiryDate.trim()) {
          errors[i] = `Product #${entryNum}: Expiry Date is required for opening stock tracking.`;
          break;
        }

        if (isNaN(new Date(item.expiryDate).getTime())) {
          errors[i] = `Product #${entryNum}: Please select a valid expiry date.`;
          break;
        }
      }

      // Serial Number Validations
      if (item.serialTracking && !item.serialNumber.trim()) {
        errors[i] = `Product #${entryNum}: Serial number is required when serial tracking is enabled.`;
        break;
      }

      if (item.serialNumber.trim()) {
        const trimmedSerial = item.serialNumber.trim().toLowerCase();

        // Intra-batch unique serial numbers
        if (seenSerials.has(trimmedSerial)) {
          const priorIdx = seenSerials.get(trimmedSerial)! + 1;
          errors[i] = `Duplicate Serial Number "${item.serialNumber.trim()}" detected between Product #${priorIdx} and Product #${entryNum}. Each serial number must be unique.`;
          break;
        }
        seenSerials.set(trimmedSerial, i);

        // Check against existing database serials
        const conflict = (serialNumbers || []).find(
          s => s.serialNumber.trim().toLowerCase() === trimmedSerial && s.productId !== item.existingProductId
        );
        if (conflict) {
          errors[i] = `Serial number "${item.serialNumber.trim()}" in Product #${entryNum} is already registered (${conflict.productName}).`;
          break;
        }
      }

      // Secondary unit validation
      if (item.secondaryUnit.trim()) {
        if (item.secondaryUnit.trim().toLowerCase() === item.primaryUnit.trim().toLowerCase()) {
          errors[i] = `Product #${entryNum}: Secondary unit cannot be identical to Primary unit.`;
          break;
        }
        const factor = Number(item.conversionFactor);
        if (isNaN(factor) || factor <= 0) {
          errors[i] = `Product #${entryNum}: Conversion multiplier must be greater than 0.`;
          break;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);
      const firstErr = Object.values(errors)[0];
      setErrorMessage(firstErr);
      return;
    }

    setItemErrors({});
    setIsConfirmOpen(true);
  };

  // Confirm and Execute Save
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const savedNewProductIds: string[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const numCost = Number(item.costPrice) || 0;
        const effectiveCost = numCost || Number(item.purchasePrice) || 0;
        const numQty = Number(item.openingStock) || 0;
        const numSelling = Number(item.sellingPrice) || 0;

        const targetWh = warehouses.find(w => w.id === item.warehouse || w.code === item.warehouse);
        const whCode = targetWh ? targetWh.code : item.warehouse.trim();
        const finalCompanyId = (profile as any)?.companyId || '00000000-0000-0000-0000-000000000001';

        if (item.existingProductId && targetWh) {
          // Allocate initial opening stock to existing product
          await inventoryService.recordOpeningStock({
            productId: item.existingProductId,
            warehouseId: targetWh.id,
            quantity: numQty,
            unit: item.primaryUnit || 'Piece',
            costPrice: effectiveCost,
            batchNumber: item.batchNumber.trim(),
            expiryDate: item.expiryDate.trim(),
            date: new Date().toISOString().split('T')[0],
            referenceNumber: `INIT-${Date.now()}-${i + 1}`,
            notes: `Initial opening stock intake: ${item.serialNumber.trim() ? 'SN: ' + item.serialNumber.trim() : ''}`,
            serialNumbers: item.serialNumber.trim() ? [item.serialNumber.trim()] : undefined,
            companyId: finalCompanyId,
            currentUser: profile ? { id: profile.id, name: (profile as any).fullName || (profile as any).name || 'User', role: profile.role } : undefined
          });

          // Update barcode on existing product if assigned/modified by authorized user
          if (canAssign && item.barcode.trim()) {
            await supabase
              .from('products')
              .update({ barcode: item.barcode.trim() })
              .eq('id', item.existingProductId);
          }

          if (item.serialNumber.trim() && addSerialNumber) {
            try {
              await addSerialNumber({
                productId: item.existingProductId,
                productName: item.name,
                serialNumber: item.serialNumber.trim(),
                purchaseDate: new Date().toISOString().split('T')[0],
                warrantyMonths: 12,
                warrantyStatus: 'In Stock'
              });
            } catch (snErr) {
              console.warn('Serial registration note for existing product:', snErr);
            }
          }
        } else {
          // Register new product record & opening inventory atomically
          const payload: Omit<Product, 'id' | 'createdAt'> = {
            name: item.name.trim(),
            code: item.code.trim() || item.sku.trim(),
            sku: item.sku.trim(),
            barcode: item.barcode.trim() || item.sku.trim(),
            category: item.category.trim() || 'General',
            subcategory: item.subcategory.trim() || item.category.trim(),
            brand: item.brand.trim(),
            description: item.description.trim(),
            hsn: item.hsn.trim(),
            taxRate: Number(item.taxRate) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            costPrice: numCost,
            sellingPrice: numSelling,
            retailPrice: Number(item.retailPrice) || numSelling,
            wholesalePrice: Number(item.wholesalePrice) || 0,
            dealerPrice: Number(item.dealerPrice) || 0,
            mrp: Number(item.mrp) || numSelling,
            minSellingPrice: Number(item.minSellingPrice) || 0,
            reorderLevel: item.reorderLevel.trim() === '' ? null : Number(item.reorderLevel),
            targetStockLevel: item.targetStockLevel.trim() === '' ? null : Number(item.targetStockLevel),
            openingStock: numQty,
            openingStockValue: numQty * effectiveCost,
            currentStock: numQty,
            primaryUnit: item.primaryUnit.trim() || 'Piece',
            secondaryUnit: item.secondaryUnit.trim() || undefined,
            conversionFactor: Number(item.conversionFactor) || 1,
            warehouse: whCode,
            rack: item.rack.trim(),
            batchNumber: item.batchNumber.trim(),
            expiryDate: item.expiryDate.trim(),
            batchTracking: Boolean(item.batchTracking || item.batchNumber.trim()),
            serialTracking: Boolean(item.serialTracking || item.serialNumber.trim()),
            expiryTracking: Boolean(item.expiryTracking || item.expiryDate.trim()),
            isActive: item.isActive
          };

          const saved = await addProduct(payload);
          savedNewProductIds.push(saved.id);

          // Save Serial Number to database if provided
          if (item.serialNumber && item.serialNumber.trim() && addSerialNumber) {
            try {
              await addSerialNumber({
                productId: saved.id,
                productName: saved.name,
                serialNumber: item.serialNumber.trim(),
                purchaseDate: new Date().toISOString().split('T')[0],
                warrantyMonths: 12,
                warrantyStatus: 'In Stock'
              });
            } catch (snErr) {
              console.warn(`Failed to register serial number for ${saved.name}:`, snErr);
            }
          }
        }
      }

      if (refreshData) {
        await refreshData();
      }

      setSuccessMessage(
        items.length === 1
          ? `Successfully saved product "${items[0].name}" and recorded initial stock balance!`
          : `Successfully saved all ${items.length} products and updated warehouse stock balances!`
      );

      // Reset to 1 fresh entry with an auto-generated batch number
      const freshItem = createDefaultItem(0);
      setItems([freshItem]);
      setIsConfirmOpen(false);

      getNextBatch(freshItem.expiryDate || undefined)
        .then(newBatch => {
          if (newBatch) {
            setItems(prev =>
              prev.map((item, idx) => (idx === 0 ? { ...item, batchNumber: newBatch } : item))
            );
          }
        })
        .catch(err => console.warn('Reset batch generation error:', err));
    } catch (err: any) {
      // Transactional rollback: safely remove any new products created during this partial batch
      for (const prodId of savedNewProductIds) {
        try {
          await productService.rollbackProductCreation(prodId);
          await supabase.from('product_serial_numbers').delete().eq('product_id', prodId);
        } catch (rbErr) {
          console.warn(`Rollback warning for product ${prodId}:`, rbErr);
        }
      }
      setErrorMessage(
        `Failed to save products: ${err?.message || 'Database error'}. Any partially created items were safely rolled back.`
      );
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Denied Access for Warehouse Manager
  if (!canManageProducts) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-rose-200 rounded-2xl shadow-xs text-center space-y-3">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your role ({profile?.role || 'Staff'}) does not have permission to create products or register initial stock.
          Please contact an Owner, Admin, or Purchase Manager.
        </p>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
        >
          Return to Product Master
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Initial Stock & Product Intake
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Add Product
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Register new products with opening stock details and serial tracking in your warehouse locations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Product Master</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-emerald-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{successMessage}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View in Product Master</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Action Bar & Live Summary */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg font-bold text-slate-800">
            <span>Total Products:</span>
            <span className="text-blue-700 font-black">{items.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-slate-600 font-semibold border border-slate-200">
            <span>Opening Stock:</span>
            <span className="text-slate-900 font-bold">{formatNumber(summary.totalQty)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-slate-600 font-semibold border border-slate-200">
            <span>Valuation:</span>
            <span className="text-blue-900 font-bold">{formatCurrency(summary.totalValuation)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Item</span>
          </button>

          <button
            type="button"
            onClick={handleValidateAndSubmit}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {items.length === 1 ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Product</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save All Products ({items.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Entry Forms */}
      <div className="space-y-6">
        {items.map((item, idx) => {
          const hasError = Boolean(itemErrors[idx]);
          const entryNum = idx + 1;

          // Barcode permission determination
          const existingProduct = item.existingProductId ? products.find(p => p.id === item.existingProductId) : null;
          const isBarcodePreAssigned = Boolean(existingProduct?.barcode && existingProduct.barcode.trim());
          const isBarcodeEditable = isBarcodePreAssigned ? canOverride : canAssign;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border shadow-2xs transition-all overflow-hidden ${
                hasError ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200/90'
              }`}
            >
              {/* Card Header Bar */}
              <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {entryNum}
                  </span>
                  <span className="font-bold text-xs text-slate-900">
                    Product {entryNum}
                    {item.name ? `: ${item.name}` : ''}
                  </span>

                  {item.sku && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-200 text-slate-700">
                      {item.sku}
                    </span>
                  )}

                  {item.existingProductId && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-emerald-600" />
                      <span>Catalog Product Linked</span>
                    </span>
                  )}

                  {hasError && (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {itemErrors[idx]}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 px-2 py-1 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="Remove this product form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body: Logical & Responsive Grouped Layout */}
              <div className="p-4 sm:p-6 space-y-6 text-xs">
                {/* ------------------------------------------------------------- */}
                {/* Section 1: Product Identification & Classification           */}
                {/* ------------------------------------------------------------- */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-100">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Product Identification & Classification
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Product Name (spans 2 columns) */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Product Name <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Type or pick from catalog</span>
                      </div>
                      <input
                        list={`catalog-products-${idx}`}
                        type="text"
                        placeholder="e.g. UltraTech Super Cement 50kg"
                        value={item.name}
                        onChange={e => {
                          const val = e.target.value;
                          handleUpdateItem(idx, 'name', val);
                          const matched = products.find(
                            p =>
                              p.name.toLowerCase() === val.toLowerCase() ||
                              p.sku.toLowerCase() === val.toLowerCase()
                          );
                          if (matched) {
                            handleSelectExistingProduct(idx, matched);
                          }
                        }}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                      <datalist id={`catalog-products-${idx}`}>
                        {products.map(p => (
                          <option key={p.id} value={p.name}>
                            {p.sku} — {p.category}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    {/* Category */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Category <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetCategoryItemIdx(idx);
                            setIsAddCategoryModalOpen(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          + Custom
                        </button>
                      </div>
                      <select
                        value={item.category}
                        onChange={e => handleUpdateItem(idx, 'category', e.target.value)}
                        className="h-9 w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer"
                      >
                        {allCategories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategory */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Subcategory</label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Portland Pozzolana"
                        value={item.subcategory}
                        onChange={e => handleUpdateItem(idx, 'subcategory', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* SKU */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          SKU <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAutoGenerateSku(idx)}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          Auto SKU
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. CEM-001"
                        value={item.sku}
                        onChange={e => handleUpdateItem(idx, 'sku', e.target.value.toUpperCase())}
                        className="h-9 w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Product Code */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Product Code</label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. CODE-1001"
                        value={item.code}
                        onChange={e => handleUpdateItem(idx, 'code', e.target.value)}
                        className="h-9 w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Brand / Manufacturer */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Brand / Manufacturer</label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. UltraTech, Havells"
                        value={item.brand}
                        onChange={e => handleUpdateItem(idx, 'brand', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* HSN / SAC Code */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">HSN / SAC Code</label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 252329"
                        value={item.hsn}
                        onChange={e => handleUpdateItem(idx, 'hsn', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* GST Tax Slab (%) */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">GST Tax Slab (%)</label>
                      </div>
                      <select
                        value={item.taxRate}
                        onChange={e => handleUpdateItem(idx, 'taxRate', Number(e.target.value))}
                        className="h-9 w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer"
                      >
                        <option value={0}>0% (Exempted)</option>
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST (Standard)</option>
                        <option value={28}>28% GST</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Section 2: Units of Measurement & Conversion                 */}
                {/* ------------------------------------------------------------- */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-100">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Units of Measurement & Conversions
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Primary Unit (Purchase/Stock Unit) <span className="text-rose-500">*</span>
                        </label>
                      </div>
                      <select
                        value={item.primaryUnit}
                        onChange={e => handleUpdateItem(idx, 'primaryUnit', e.target.value)}
                        className="h-9 w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer"
                      >
                        {unitOptions.map(u => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Secondary Unit (Optional)
                        </label>
                      </div>
                      <select
                        value={item.secondaryUnit}
                        onChange={e => handleUpdateItem(idx, 'secondaryUnit', e.target.value)}
                        className="h-9 w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer"
                      >
                        <option value="">None (Single Unit Item)</option>
                        {unitOptions.map(u => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Conversion Scale / Multiplier
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        placeholder="e.g. 1000"
                        disabled={!item.secondaryUnit}
                        value={item.conversionFactor}
                        onChange={e => handleUpdateItem(idx, 'conversionFactor', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono disabled:opacity-50 disabled:bg-slate-100"
                      />
                      {item.secondaryUnit && (
                        <div className="mt-1.5">
                          {(() => {
                            const factor = Number(item.conversionFactor);
                            if (!item.conversionFactor || isNaN(factor) || factor <= 0) {
                              return (
                                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                  Enter a valid conversion multiplier
                                </span>
                              );
                            }
                            return (
                              <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-mono font-semibold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs">
                                <span className="text-blue-700 font-bold">1 {item.primaryUnit || 'Unit'} =</span>
                                <span className="text-slate-900">
                                  {factor} {item.secondaryUnit}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Section 3: Pricing & Valuation                               */}
                {/* ------------------------------------------------------------- */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-100">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Pricing & Valuation (₹)
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Cost / Purchase</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.costPrice}
                        onChange={e => handleUpdateItem(idx, 'costPrice', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Selling Price <span className="text-rose-500">*</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.sellingPrice}
                        onChange={e => handleUpdateItem(idx, 'sellingPrice', e.target.value)}
                        className="h-9 w-full text-xs font-bold text-blue-900 px-3 py-1.5 bg-blue-50/40 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Retail Price</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.retailPrice}
                        onChange={e => handleUpdateItem(idx, 'retailPrice', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Wholesale Price</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.wholesalePrice}
                        onChange={e => handleUpdateItem(idx, 'wholesalePrice', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Dealer Price</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.dealerPrice}
                        onChange={e => handleUpdateItem(idx, 'dealerPrice', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">MRP</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.mrp}
                        onChange={e => handleUpdateItem(idx, 'mrp', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Section 4: Product Tracking Details (Barcode, Batch, Expiry)  */}
                {/* ------------------------------------------------------------- */}
                <div>
                  <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-blue-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Product Tracking Details
                      </h3>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.serialTracking}
                        onChange={e => handleUpdateItem(idx, 'serialTracking', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Track by Serial Number</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Barcode */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <span>Barcode</span>
                          {!isBarcodeEditable && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                          )}
                        </label>
                        {isBarcodeEditable && (
                          <button
                            type="button"
                            onClick={() => handleAutoGenerateBarcode(idx)}
                            className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                          >
                            Generate Barcode
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={!isBarcodeEditable}
                        placeholder={
                          isBarcodeEditable
                            ? 'Scan, enter or generate barcode'
                            : 'No barcode assigned'
                        }
                        value={item.barcode}
                        onChange={e => handleUpdateItem(idx, 'barcode', e.target.value)}
                        className={`h-9 w-full text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                          !isBarcodeEditable
                            ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                            : 'border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900'
                        }`}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        {!canAssign
                          ? 'Requires Owner, Admin, or Purchase Manager permission.'
                          : isBarcodePreAssigned && !canOverride
                          ? 'Existing barcode is locked. Requires Owner or Admin permission to overwrite.'
                          : 'Product identifier barcode (EAN-13 / Code 128)'}
                      </p>
                    </div>

                    {/* Batch Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Batch Number</label>
                        <button
                          type="button"
                          onClick={() => handleAutoGenerateBatch(idx)}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          Regenerate
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. BTH-2610-001"
                        value={item.batchNumber}
                        onChange={e => handleUpdateItem(idx, 'batchNumber', e.target.value.toUpperCase())}
                        className="h-9 w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                      <div className="flex items-center justify-between mt-1 min-h-[16px]">
                        <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          Auto-generated
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Format: BTH-YYMM-###
                        </span>
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Expiry Date</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => applyExpiryPreset(idx, 6)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                          >
                            +6m
                          </button>
                          <button
                            type="button"
                            onClick={() => applyExpiryPreset(idx, 12)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                          >
                            +1y
                          </button>
                        </div>
                      </div>
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={e => handleUpdateItem(idx, 'expiryDate', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Serial Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Serial Number {item.serialTracking && <span className="text-rose-500">*</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAutoGenerateSerial(idx)}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                        >
                          Auto Serial
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder={
                          item.serialTracking ? 'Required (e.g. SN-892411)' : 'Optional (e.g. SN-892411)'
                        }
                        value={item.serialNumber}
                        onChange={e => handleUpdateItem(idx, 'serialNumber', e.target.value)}
                        className="h-9 w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Storage Rack / Bin */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Storage Rack / Bin</label>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Aisle 2, Bin 4"
                        value={item.rack}
                        onChange={e => handleUpdateItem(idx, 'rack', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Section 5: Opening Stock Intake & Warehouse Allocation        */}
                {/* ------------------------------------------------------------- */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-100">
                    <WarehouseIcon className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Opening Stock Intake & Warehouse
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Destination Warehouse */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Destination Warehouse
                        </label>
                      </div>
                      <select
                        value={item.warehouse}
                        onChange={e => handleUpdateItem(idx, 'warehouse', e.target.value)}
                        className="h-9 w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer"
                      >
                        <option value="">Select Warehouse...</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name} ({wh.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Opening Stock Quantity with Unit Addon */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Opening Stock Quantity
                        </label>
                      </div>
                      <div className="h-9 flex rounded-lg border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 focus-within:bg-white transition-all">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.openingStock}
                          onFocus={e => e.target.select()}
                          onChange={e =>
                            handleUpdateItem(idx, 'openingStock', cleanQuantityInput(e.target.value))
                          }
                          onBlur={() => {
                            if (!item.openingStock.trim()) {
                              handleUpdateItem(idx, 'openingStock', '0');
                            }
                          }}
                          className="h-full w-full text-xs font-bold text-slate-900 px-3 py-1.5 bg-transparent border-0 focus:outline-none focus:ring-0 min-w-0"
                        />
                        <span className="inline-flex items-center h-full px-2.5 bg-slate-100/90 border-l border-slate-200 text-[11px] font-semibold text-slate-600 whitespace-nowrap select-none shrink-0">
                          {item.primaryUnit || 'Piece'}
                        </span>
                      </div>
                    </div>

                    {/* Warning Limit (Reorder) */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">
                          Warning Limit (Reorder)
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 15"
                        value={item.reorderLevel}
                        onChange={e => handleUpdateItem(idx, 'reorderLevel', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Target Stock Level */}
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[18px]">
                        <label className="block text-xs font-semibold text-slate-700">Target Stock Level</label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        value={item.targetStockLevel}
                        onChange={e => handleUpdateItem(idx, 'targetStockLevel', e.target.value)}
                        className="h-9 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* MODAL: CONFIRM SAVE                                                   */}
      {/* ===================================================================== */}
      {isConfirmOpen && (
        <Modal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          title={
            items.length === 1
              ? 'Confirm Save Product'
              : `Confirm Save All Products (${items.length})`
          }
          subtitle="Verify product records and warehouse stock balances before committing."
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Records...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Commit</span>
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Top metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Entries</span>
                <span className="font-bold text-slate-900 text-sm">{items.length} Products</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Opening Stock</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatNumber(summary.totalQty)} Units
                </span>
              </div>
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                <span className="text-[10px] text-blue-600 block font-semibold">Total Inventory Valuation</span>
                <span className="font-bold text-blue-900 text-sm">
                  {formatCurrency(summary.totalValuation)}
                </span>
              </div>
            </div>

            {/* Product summary table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">SKU</th>
                    <th className="p-2.5">Barcode</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Serial No.</th>
                    <th className="p-2.5">Warehouse</th>
                    <th className="p-2.5 text-right">Initial Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{item.name}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{item.sku}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{item.barcode || '—'}</td>
                      <td className="p-2.5 font-mono text-[11px] text-indigo-700">{item.batchNumber || '—'}</td>
                      <td className="p-2.5 font-mono text-[11px] text-indigo-700">
                        {item.serialNumber || '—'}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {warehouses.find(w => w.id === item.warehouse || w.code === item.warehouse)?.name ||
                          item.warehouse ||
                          '—'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {formatNumber(Number(item.openingStock) || 0)} {item.primaryUnit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              All products will be registered in Product Master and stock balances allocated. Rollback protection is active.
            </p>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD CUSTOM CATEGORY                                            */}
      {/* ===================================================================== */}
      {isAddCategoryModalOpen && (
        <Modal
          isOpen={isAddCategoryModalOpen}
          onClose={() => {
            setIsAddCategoryModalOpen(false);
            setCategoryModalError(null);
            setTargetCategoryItemIdx(null);
          }}
          title="Add Custom Product Category"
          subtitle="Create a new classification category for products."
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={isSavingCategory}
                onClick={() => {
                  setIsAddCategoryModalOpen(false);
                  setCategoryModalError(null);
                  setTargetCategoryItemIdx(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingCategory}
                onClick={handleSaveCategory}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingCategory ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Category</span>
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            {categoryModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-medium">
                {categoryModalError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Solar Equipment, Fasteners, Safety Gear"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                autoFocus
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InitialStockPage;
