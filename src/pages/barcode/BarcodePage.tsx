import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ScanBarcode,
  Printer,
  Sliders,
  Package,
  Layers,
  Sparkles,
  QrCode,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  ArrowRight,
  Edit3,
  PlusCircle,
  X,
  RefreshCw,
  Tag,
  ShieldAlert,
  DollarSign,
  Info,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { barcodeService } from '../../services/barcodeService';
import { directPrintService, PrinterConfig } from '../../services/directPrintService';
import { supabase } from '../../lib/supabase';
import { hasPermission, canManageBarcodeOverride } from '../../utils/rbac';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { Product } from '../../types';
import { isTableMarkedMissing, markTableMissing, isTableNotFoundError } from '../../utils/schemaDetector';
import { sortProductsAZ } from '../../utils/sortUtils';

export const BarcodePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, company, updateProduct, refreshData } = useERP();
  const { user, profile } = useAuth();

  // Active top-level choice: 'generate' (Option 1) vs 'update' (Option 2)
  const initialTab = searchParams.get('tab') === 'update' || searchParams.get('barcode') ? 'update' : 'generate';
  const [activeTab, setActiveTab] = useState<'generate' | 'update'>(initialTab);

  // Role permissions
  const userRole = profile?.role;
  const canGenerateBarcode = hasPermission(userRole, 'barcode', 'create') || canManageBarcodeOverride(userRole);
  const canEditProductDetails = hasPermission(userRole, 'products', 'edit') || canManageBarcodeOverride(userRole);
  const canReplaceBarcode = hasPermission(userRole, 'barcode', 'edit') || canManageBarcodeOverride(userRole);

  // General Notification / Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Direct Printing Configuration & State
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => directPrintService.getConfig());
  const [labelWidthMm, setLabelWidthMm] = useState<number>(() => directPrintService.getConfig().barcodeLabelWidthMm || 50);
  const [labelHeightMm, setLabelHeightMm] = useState<number>(() => directPrintService.getConfig().barcodeLabelHeightMm || 25);
  const [labelDimensionPreset, setLabelDimensionPreset] = useState<string>('50x25');
  const [isPrintingDirect, setIsPrintingDirect] = useState<boolean>(false);

  // Reload printer settings on mount
  useEffect(() => {
    const cfg = directPrintService.getConfig();
    setPrinterConfig(cfg);
    if (cfg.barcodeLabelWidthMm && cfg.barcodeLabelHeightMm) {
      setLabelWidthMm(cfg.barcodeLabelWidthMm);
      setLabelHeightMm(cfg.barcodeLabelHeightMm);
    }
  }, []);

  // =========================================================================
  // OPTION 1: GENERATE NEW BARCODE STATE
  // =========================================================================
  const paramProductId = searchParams.get('productId') || '';
  const [genProductId, setGenProductId] = useState<string>(
    paramProductId && products.some(p => p.id === paramProductId)
      ? paramProductId
      : products[0]?.id || ''
  );
  const [genProductSearch, setGenProductSearch] = useState<string>('');
  const [genBarcodeType, setGenBarcodeType] = useState<'Code 128' | 'EAN-13' | 'EAN-8' | 'UPC' | 'QR Code'>('Code 128');
  const [generatedBarcodeNumber, setGeneratedBarcodeNumber] = useState<string>('');
  const [customValue, setCustomValue] = useState<string>('');
  const [genSecondaryBarcodes, setGenSecondaryBarcodes] = useState<{ barcode: string; type: string; isPrimary: boolean }[]>([]);
  const [genUniqueness, setGenUniqueness] = useState<{ isUnique: boolean; conflictingProduct?: any; message?: string } | null>(null);
  const [isCheckingGenUniqueness, setIsCheckingGenUniqueness] = useState<boolean>(false);
  const [isSavingGenBarcode, setIsSavingGenBarcode] = useState<boolean>(false);

  // Option 1: Existing barcode conflict modal
  const [showGenConflictModal, setShowGenConflictModal] = useState<boolean>(false);

  // Label Designer Options (Option 1 & Printing)
  const [copiesCount, setCopiesCount] = useState<string>(() => String(directPrintService.getConfig().defaultCopies || 8));
  const [columnsCount, setColumnsCount] = useState<number>(3);
  const [showLogo, setShowLogo] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [batchNo, setBatchNo] = useState('B-2026-X1');
  const [expDate, setExpDate] = useState('10/2028');

  // Selected product for Option 1
  const selectedGenProduct = useMemo(() => {
    return products.find(p => p.id === genProductId) || products[0] || null;
  }, [products, genProductId]);

  // Load secondary barcodes for selected product in Option 1
  useEffect(() => {
    if (selectedGenProduct?.id) {
      barcodeService.getProductBarcodes(selectedGenProduct.id).then(list => {
        setGenSecondaryBarcodes(list);
      });
    } else {
      setGenSecondaryBarcodes([]);
    }
  }, [selectedGenProduct?.id]);

  // Generate unique barcode when product or barcode type changes in Option 1
  useEffect(() => {
    if (selectedGenProduct) {
      const existingSet = new Set(
        products.map(p => (p.barcode || '').toLowerCase()).filter(Boolean)
      );
      const uniqueCode = barcodeService.generateUniqueBarcodeForType(
        genBarcodeType,
        selectedGenProduct.sku,
        existingSet
      );
      setGeneratedBarcodeNumber(uniqueCode);
      setCustomValue('');
    }
  }, [selectedGenProduct?.id, genBarcodeType, products]);

  // Effective barcode value for Option 1
  const activeGenBarcodeValue = (customValue.trim() || generatedBarcodeNumber || selectedGenProduct?.barcode || '8901234567890').trim();

  // Validate uniqueness of Option 1 active barcode
  useEffect(() => {
    if (!activeGenBarcodeValue) {
      setGenUniqueness(null);
      return;
    }
    let isCancelled = false;
    setIsCheckingGenUniqueness(true);

    const timer = setTimeout(async () => {
      const result = await barcodeService.checkBarcodeUniqueness(
        activeGenBarcodeValue,
        selectedGenProduct?.id,
        company.id
      );
      if (!isCancelled) {
        setGenUniqueness(result);
        setIsCheckingGenUniqueness(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeGenBarcodeValue, selectedGenProduct?.id, company.id]);

  // =========================================================================
  // OPTION 2: UPDATE EXISTING PRODUCT BARCODE STATE
  // =========================================================================
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState<string>(searchParams.get('barcode') || '');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState<boolean>(false);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [matchedSecondaryBarcodes, setMatchedSecondaryBarcodes] = useState<{ barcode: string; type: string; isPrimary: boolean }[]>([]);
  const [unknownBarcodeError, setUnknownBarcodeError] = useState<string | null>(null);
  const [manualCatalogSelectId, setManualCatalogSelectId] = useState<string>('');

  // Editable fields for Option 2
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');
  const [editMrp, setEditMrp] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editHsn, setEditHsn] = useState<string>('');
  const [editTaxRate, setEditTaxRate] = useState<string>('18');
  const [editReorderLevel, setEditReorderLevel] = useState<string>('');
  const [editPrimaryUnit, setEditPrimaryUnit] = useState<string>('Piece');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('Price / Barcode Catalog Update');

  // Replace default barcode controls (Option 2 Step 5)
  const [isReplacingDefaultBarcode, setIsReplacingDefaultBarcode] = useState<boolean>(false);
  const [replacementBarcodeType, setReplacementBarcodeType] = useState<'Code 128' | 'EAN-13' | 'EAN-8' | 'UPC' | 'QR Code'>('Code 128');
  const [newReplacementBarcode, setNewReplacementBarcode] = useState<string>('');
  const [replacementUniqueness, setReplacementUniqueness] = useState<{ isUnique: boolean; conflictingProduct?: any; message?: string } | null>(null);
  const [isCheckingReplacement, setIsCheckingReplacement] = useState<boolean>(false);

  // Step 6: Confirmation Modal for Barcode Replacement
  const [showReplacementConfirmModal, setShowReplacementConfirmModal] = useState<boolean>(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState<boolean>(false);

  // Auto-focus scanner input when Option 2 becomes active
  useEffect(() => {
    if (activeTab === 'update') {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    }
  }, [activeTab]);


  // Check uniqueness of new replacement barcode in Option 2
  useEffect(() => {
    if (!isReplacingDefaultBarcode || !newReplacementBarcode.trim()) {
      setReplacementUniqueness(null);
      return;
    }
    let isCancelled = false;
    setIsCheckingReplacement(true);

    const timer = setTimeout(async () => {
      const result = await barcodeService.checkBarcodeUniqueness(
        newReplacementBarcode.trim(),
        matchedProduct?.id,
        company.id
      );
      if (!isCancelled) {
        setReplacementUniqueness(result);
        setIsCheckingReplacement(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [newReplacementBarcode, isReplacingDefaultBarcode, matchedProduct?.id, company.id]);

  // Execute Barcode Lookup (Step 1 & Step 2)
  const executeBarcodeLookup = async (queryToSearch?: string) => {
    const raw = (queryToSearch !== undefined ? queryToSearch : searchInput).trim();
    if (!raw) {
      setUnknownBarcodeError('Please scan a barcode or enter a barcode/SKU number to identify a product.');
      return;
    }

    setIsSearchingBarcode(true);
    setUnknownBarcodeError(null);
    setMatchedProduct(null);

    try {
      // 1. Barcode service lookup
      let product = await barcodeService.lookupProductByBarcode(raw);

      // 2. Direct catalog search fallback (by barcode, sku, or code)
      if (!product) {
        const found = products.find(
          p =>
            (p.barcode && p.barcode.trim().toLowerCase() === raw.toLowerCase()) ||
            (p.sku && p.sku.trim().toLowerCase() === raw.toLowerCase()) ||
            (p.code && p.code.trim().toLowerCase() === raw.toLowerCase())
        );
        if (found) product = found;
      }

      if (product) {
        // Matched successfully! Load details
        populateProductForEditing(product);
      } else {
        setUnknownBarcodeError(
          `No product found matching barcode or SKU "${raw}". Please verify the number or select an authorized product from the catalog below.`
        );
      }
    } catch (err: any) {
      setUnknownBarcodeError(`Error searching for barcode: ${err?.message || 'Database error'}`);
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  // Populate product details into Option 2 state (Step 3)
  const populateProductForEditing = async (product: Product) => {
    setMatchedProduct(product);
    setUnknownBarcodeError(null);
    setEditName(product.name || '');
    setEditSellingPrice(product.sellingPrice !== undefined ? String(product.sellingPrice) : '0');
    setEditMrp(product.mrp !== undefined ? String(product.mrp) : '0');
    setEditCategory(product.category || 'General');
    setEditHsn(product.hsn || '');
    setEditTaxRate(product.taxRate !== undefined ? String(product.taxRate) : '18');
    setEditReorderLevel(product.reorderLevel !== undefined && product.reorderLevel !== null ? String(product.reorderLevel) : '');
    setEditPrimaryUnit(product.primaryUnit || 'Piece');
    setEditDescription(product.description || '');
    setEditReason('Price / Barcode Catalog Update');

    // Reset replacement barcode controls
    setIsReplacingDefaultBarcode(false);
    setNewReplacementBarcode('');
    setReplacementUniqueness(null);

    // Fetch all secondary barcodes
    try {
      const secondary = await barcodeService.getProductBarcodes(product.id);
      setMatchedSecondaryBarcodes(secondary);
    } catch {
      setMatchedSecondaryBarcodes([]);
    }
  };

  // Helper to generate a new replacement barcode in Option 2
  const handleGenerateReplacementBarcode = () => {
    if (!matchedProduct) return;
    const existingSet = new Set(
      products.map(p => (p.barcode || '').toLowerCase()).filter(Boolean)
    );
    const generated = barcodeService.generateUniqueBarcodeForType(
      replacementBarcodeType,
      matchedProduct.sku,
      existingSet
    );
    setNewReplacementBarcode(generated);
  };

  // Handle URL barcode param if present on load
  useEffect(() => {
    const paramBarcode = searchParams.get('barcode');
    if (paramBarcode) {
      setSearchInput(paramBarcode);
      executeBarcodeLookup(paramBarcode);
    }
  }, []);

  // =========================================================================
  // OPTION 1 ACTIONS: SAVE & PRINT
  // =========================================================================
  const handleInitiateSaveGenBarcode = async () => {
    if (!canGenerateBarcode) {
      setFeedback({
        type: 'error',
        message: 'Access Denied: You do not have permission to generate or assign barcodes.'
      });
      return;
    }

    if (!selectedGenProduct) {
      setFeedback({ type: 'error', message: 'Please select a product first.' });
      return;
    }

    const barcodeToSave = activeGenBarcodeValue;
    if (!barcodeToSave) {
      setFeedback({ type: 'error', message: 'A valid barcode number is required.' });
      return;
    }

    // Uniqueness validation check
    const check = await barcodeService.checkBarcodeUniqueness(
      barcodeToSave,
      selectedGenProduct.id,
      company.id
    );

    if (!check.isUnique) {
      setFeedback({
        type: 'error',
        message: check.message || `Barcode "${barcodeToSave}" is already assigned to another product.`
      });
      return;
    }

    // If product already has a default barcode, NEVER overwrite silently!
    if (selectedGenProduct.barcode && selectedGenProduct.barcode.trim() !== '') {
      if (selectedGenProduct.barcode.trim() === barcodeToSave) {
        setFeedback({
          type: 'success',
          message: `Barcode "${barcodeToSave}" is already the active default barcode for "${selectedGenProduct.name}".`
        });
        return;
      }
      // Open choice modal
      setShowGenConflictModal(true);
      return;
    }

    // Product has no barcode yet: save directly as default barcode
    await commitSaveGenBarcode(true);
  };

  const commitSaveGenBarcode = async (replaceDefault: boolean) => {
    if (!selectedGenProduct) return;
    setIsSavingGenBarcode(true);
    setFeedback(null);
    setShowGenConflictModal(false);

    try {
      const barcodeToSave = activeGenBarcodeValue;
      const res = await barcodeService.saveBarcodeForProduct(
        selectedGenProduct.id,
        barcodeToSave,
        genBarcodeType,
        replaceDefault,
        company.id
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to save barcode association.');
      }

      // Update ERPContext
      if (replaceDefault) {
        await updateProduct(selectedGenProduct.id, { barcode: barcodeToSave });
      }

      // Refresh product list and secondary barcodes
      await refreshData();
      const updatedList = await barcodeService.getProductBarcodes(selectedGenProduct.id);
      setGenSecondaryBarcodes(updatedList);

      setFeedback({
        type: 'success',
        message: replaceDefault
          ? `Successfully assigned barcode "${barcodeToSave}" as the default barcode for "${selectedGenProduct.name}".`
          : `Successfully registered "${barcodeToSave}" as an additional barcode for "${selectedGenProduct.name}".`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Database error occurred while saving barcode.'
      });
    } finally {
      setIsSavingGenBarcode(false);
    }
  };

  // Print Labels Action
  const handlePrintLabels = () => {
    const trimmed = copiesCount.trim();
    if (trimmed === '') {
      alert('Please enter the number of copies to print.');
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1) {
      alert('Copies count must be a positive whole number (at least 1).');
      return;
    }

    // If currently on Option 2 and a product was matched, transfer it to Option 1 for printing
    if (activeTab === 'update' && matchedProduct) {
      setGenProductId(matchedProduct.id);
      if (matchedProduct.barcode) {
        setCustomValue(matchedProduct.barcode);
      }
      setActiveTab('generate');
      setSearchParams({ tab: 'generate' });
    } else if (activeTab !== 'generate') {
      setActiveTab('generate');
      setSearchParams({ tab: 'generate' });
    }

    // Mark body for isolated barcode printing
    document.body.classList.add('barcode-printing-active');

    const cleanupPrint = () => {
      document.body.classList.remove('barcode-printing-active');
      window.removeEventListener('afterprint', cleanupPrint);
    };
    window.addEventListener('afterprint', cleanupPrint);

    // Wait two animation frames to ensure layout and SVG elements are completely rendered and flushed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } finally {
          // Fallback cleanup in case afterprint does not fire in some PDF driver dialogs
          setTimeout(() => {
            document.body.classList.remove('barcode-printing-active');
          }, 1000);
        }
      });
    });
  };

  // Direct Print Barcode Sticker Action (Silent spool to configured label printer)
  const handleDirectPrintSticker = async (customProduct?: Product) => {
    const targetProduct = customProduct || (activeTab === 'update' && matchedProduct ? matchedProduct : selectedGenProduct);
    if (!targetProduct) {
      setFeedback({
        type: 'error',
        message: 'Please select or scan an existing product to print barcode stickers.'
      });
      return;
    }

    const barcodeVal = (
      (customProduct ? customProduct.barcode : '') ||
      (activeTab === 'update' && matchedProduct ? matchedProduct.barcode : activeGenBarcodeValue) ||
      targetProduct.barcode ||
      ''
    ).trim();

    if (!barcodeVal) {
      setFeedback({
        type: 'error',
        message: `Product "${targetProduct.name}" does not have a valid barcode to print.`
      });
      return;
    }

    const trimmed = copiesCount.trim();
    const parsed = Math.max(1, parseInt(trimmed, 10) || 1);

    setIsPrintingDirect(true);
    setFeedback(null);

    try {
      const result = await directPrintService.printBarcodeSticker(
        {
          name: targetProduct.name,
          barcode: barcodeVal,
          sku: targetProduct.sku,
          sellingPrice: targetProduct.sellingPrice,
          mrp: targetProduct.mrp,
          category: targetProduct.category,
          batchNumber: showBatch ? batchNo : undefined,
          expiryDate: showBatch ? expDate : undefined
        },
        parsed,
        {
          widthMm: labelWidthMm,
          heightMm: labelHeightMm,
          printerName: printerConfig.barcodePrinterName
        }
      );

      if (result.success) {
        setFeedback({
          type: 'success',
          message: result.message
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.message || 'Direct label printing failed. Check printer configuration.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while spooling barcode label.'
      });
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // =========================================================================
  // OPTION 2 ACTIONS: SAVE CHANGES (WITH / WITHOUT BARCODE REPLACEMENT)
  // =========================================================================
  const handleSaveProductUpdates = async () => {
    if (!canEditProductDetails) {
      setFeedback({
        type: 'error',
        message: 'Access Denied: You do not have permission to edit product details or prices.'
      });
      return;
    }

    if (!matchedProduct) {
      setFeedback({ type: 'error', message: 'No product selected to update.' });
      return;
    }

    // Validate prices
    const parsedSellingPrice = parseFloat(editSellingPrice);
    if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
      setFeedback({ type: 'error', message: 'Selling price must be a valid non-negative number.' });
      return;
    }

    const parsedMrp = editMrp.trim() ? parseFloat(editMrp) : 0;
    if (isNaN(parsedMrp) || parsedMrp < 0) {
      setFeedback({ type: 'error', message: 'MRP must be a valid non-negative number.' });
      return;
    }

    if (parsedMrp > 0 && parsedSellingPrice > parsedMrp) {
      setFeedback({ type: 'error', message: 'Selling price cannot exceed the Maximum Retail Price (MRP).' });
      return;
    }

    if (!editName.trim()) {
      setFeedback({ type: 'error', message: 'Product name cannot be empty.' });
      return;
    }

    // If replacing default barcode, run Step 6 confirmation modal
    if (isReplacingDefaultBarcode) {
      if (!canReplaceBarcode) {
        setFeedback({
          type: 'error',
          message: 'Access Denied: You are not authorized to replace default product barcodes.'
        });
        return;
      }

      const trimmedReplacement = newReplacementBarcode.trim();
      if (!trimmedReplacement) {
        setFeedback({ type: 'error', message: 'Please provide a new barcode number to replace the default barcode.' });
        return;
      }

      // Check uniqueness
      const check = await barcodeService.checkBarcodeUniqueness(
        trimmedReplacement,
        matchedProduct.id,
        company.id
      );

      if (!check.isUnique) {
        setFeedback({
          type: 'error',
          message: check.message || `Barcode "${trimmedReplacement}" is already in use by another product.`
        });
        return;
      }

      // Show Step 6 Confirmation Modal!
      setShowReplacementConfirmModal(true);
      return;
    }

    // No barcode replacement: Save product updates directly (updating price & details)
    await commitProductUpdates(false);
  };

  const commitProductUpdates = async (isBarcodeReplaced: boolean) => {
    if (!matchedProduct) return;
    setIsSubmittingUpdate(true);
    setFeedback(null);
    setShowReplacementConfirmModal(false);

    try {
      const parsedSellingPrice = parseFloat(editSellingPrice) || 0;
      const parsedMrp = editMrp.trim() ? parseFloat(editMrp) : 0;
      const parsedTaxRate = parseFloat(editTaxRate) || 0;
      const parsedReorderLevel = editReorderLevel.trim() ? Number(editReorderLevel) : null;
      const trimmedReplacement = newReplacementBarcode.trim();

      const oldBarcode = matchedProduct.barcode || '';
      const finalBarcode = isBarcodeReplaced ? trimmedReplacement : oldBarcode;

      // 1. If replacing default barcode: validate & save via barcodeService first
      if (isBarcodeReplaced) {
        const barcodeSaveRes = await barcodeService.saveBarcodeForProduct(
          matchedProduct.id,
          trimmedReplacement,
          replacementBarcodeType,
          true,
          company.id
        );

        if (!barcodeSaveRes.success) {
          throw new Error(barcodeSaveRes.error || 'Failed to replace default barcode.');
        }
      }

      // 2. Update Product Master record through service & context
      const updates: Partial<Product> = {
        name: editName.trim(),
        sellingPrice: parsedSellingPrice,
        retailPrice: parsedSellingPrice,
        mrp: parsedMrp,
        category: editCategory.trim() || 'General',
        hsn: editHsn.trim(),
        taxRate: parsedTaxRate,
        reorderLevel: parsedReorderLevel,
        primaryUnit: editPrimaryUnit.trim() || 'Piece',
        description: editDescription.trim(),
        ...(isBarcodeReplaced ? { barcode: trimmedReplacement } : {})
      };

      await updateProduct(matchedProduct.id, updates);

      // 3. Write audit log to barcode_audit_logs table
      try {
        if (!isTableMarkedMissing('barcode_audit_logs')) {
          const nowIso = new Date().toISOString();
          const { error: insertErr } = await supabase.from('barcode_audit_logs').insert({
            company_id: company.id || '00000000-0000-0000-0000-000000000001',
            product_id: matchedProduct.id,
            product_name: editName.trim(),
            sku: matchedProduct.sku,
            method: isBarcodeReplaced ? 'SUPPLIER_OVERRIDE' : 'PRICE_UPDATE',
            old_barcode: oldBarcode,
            new_barcode: finalBarcode,
            old_selling_price: matchedProduct.sellingPrice,
            new_selling_price: parsedSellingPrice,
            price_updated: matchedProduct.sellingPrice !== parsedSellingPrice,
            reason: editReason.trim() || 'Product details & barcode update',
            user_id: user?.id || '00000000-0000-0000-0000-000000000000',
            user_name: profile?.full_name || profile?.email || user?.email || 'Authorized Staff',
            user_role: userRole || 'Staff',
            created_at: nowIso
          });
          if (insertErr && isTableNotFoundError(insertErr)) {
            markTableMissing('barcode_audit_logs');
          }
        }
      } catch (logErr) {
        if (isTableNotFoundError(logErr)) {
          markTableMissing('barcode_audit_logs');
        }
        console.warn('Audit logging notice:', logErr);
      }

      // 4. Reload updated product in context
      await refreshData();

      // 5. Update local state for matched product (Step 7)
      const updatedProductObj: Product = {
        ...matchedProduct,
        ...updates,
        barcode: finalBarcode
      };
      setMatchedProduct(updatedProductObj);

      // Refresh secondary barcodes list
      const updatedSecondary = await barcodeService.getProductBarcodes(matchedProduct.id);
      setMatchedSecondaryBarcodes(updatedSecondary);

      // Reset replacement inputs
      setIsReplacingDefaultBarcode(false);
      setNewReplacementBarcode('');

      setFeedback({
        type: 'success',
        message: isBarcodeReplaced
          ? `Successfully replaced default barcode with "${finalBarcode}" and updated product details for "${editName.trim()}". Changes are now active across POS, Inventory, and Billing.`
          : `Successfully updated pricing and product details for "${editName.trim()}". Barcode "${oldBarcode}" preserved.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Database error occurred while updating product.'
      });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const parsedCopies = Math.max(0, parseInt(copiesCount, 10) || 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-blue-600" />
            Barcode Management Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate new standards-compliant barcodes or scan and update existing product barcodes, pricing, and master data.
          </p>
        </div>

        {/* Action: Print Barcode Sticker (Direct) */}
        <div className="flex items-center self-start sm:self-auto shrink-0">
          <button
            type="button"
            id="direct-print-sticker-btn"
            disabled={isPrintingDirect}
            onClick={() => handleDirectPrintSticker()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Send barcode sticker directly to the configured label printer without opening print preview"
          >
            {isPrintingDirect ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Printing Sticker...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Print Barcode Sticker (Direct)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* TWO PRIMARY OPTIONS NAVIGATION CARDS */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPTION 1 CARD */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveTab('generate');
            setSearchParams({ tab: 'generate' });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('generate');
              setSearchParams({ tab: 'generate' });
            }
          }}
          className={`cursor-pointer text-left p-5 rounded-xl border transition-all duration-200 ${
            activeTab === 'generate'
              ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  activeTab === 'generate'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                  Option 1
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Generate New Barcode
                </h2>
              </div>
            </div>
            {activeTab === 'generate' && (
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">
                Active View
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Generate a new, unique barcode for a product and associate it with product information. Design sticker sheets and print retail labels.
          </p>
        </div>

        {/* OPTION 2 CARD */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveTab('update');
            setSearchParams({ tab: 'update' });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('update');
              setSearchParams({ tab: 'update' });
            }
          }}
          className={`cursor-pointer text-left p-5 rounded-xl border transition-all duration-200 ${
            activeTab === 'update'
              ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  activeTab === 'update'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ScanBarcode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                  Option 2
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Update Existing Product Barcode
                </h2>
              </div>
            </div>
            {activeTab === 'update' && (
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700">
                Active View
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Scan or enter an existing barcode to identify its product, update selling price and product details, or safely replace the default barcode.
          </p>
        </div>
      </div>

      {/* FEEDBACK BANNER (SUCCESS / ERROR) */}
      {feedback && (
        <div
          className={`no-print p-4 rounded-xl border flex items-start justify-between gap-3 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {feedback.type === 'success' ? 'Success' : 'Error / Notice'}
              </h4>
              <p className="text-xs font-medium mt-0.5">{feedback.message}</p>
            </div>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* OPTION 1 CONTENT: GENERATE NEW BARCODE */}
      {/* ===================================================================== */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 barcode-grid-parent print:block print:w-full">
            {/* Left: Option 1 Generator Form & Controls */}
            <div className="no-print barcode-screen-only bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Generate New Barcode
                </h2>
                {hasPermission(userRole, 'products', 'create') && (
                  <button
                    onClick={() => navigate('/products/new')}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ New Product</span>
                  </button>
                )}
              </div>

              {/* 1. Product Selection & Search */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Product to Assign Barcode
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={genProductSearch}
                    onChange={e => setGenProductSearch(e.target.value)}
                    placeholder="Search by name, SKU or barcode..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={genProductId}
                  onChange={e => {
                    setGenProductId(e.target.value);
                    setCustomValue('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {sortProductsAZ(
                    products.filter(p => {
                      if (!genProductSearch.trim()) return true;
                      const q = genProductSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q) ||
                        (p.barcode && p.barcode.toLowerCase().includes(q))
                      );
                    })
                  ).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) {p.barcode ? `— [${p.barcode}]` : '— (No Barcode)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Product Summary Card */}
              {selectedGenProduct && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/90 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 line-clamp-1">{selectedGenProduct.name}</h4>
                      <p className="text-[11px] font-mono text-slate-500">SKU: {selectedGenProduct.sku}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {selectedGenProduct.category || 'General'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                    <div>
                      <span className="text-slate-500">Selling Price:</span>{' '}
                      <span className="font-bold text-slate-900">{formatCurrency(selectedGenProduct.sellingPrice || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">MRP:</span>{' '}
                      <span className="font-bold text-slate-700">{formatCurrency(selectedGenProduct.mrp || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Unit:</span>{' '}
                      <span className="font-semibold text-slate-800">{selectedGenProduct.primaryUnit || 'Piece'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Stock:</span>{' '}
                      <span className="font-semibold text-slate-800">{selectedGenProduct.currentStock ?? 0}</span>
                    </div>
                  </div>

                  {/* Existing Barcode Info */}
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Current Default Barcode:</span>
                    {selectedGenProduct.barcode ? (
                      <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {selectedGenProduct.barcode}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                        None Assigned
                      </span>
                    )}
                  </div>

                  {/* Secondary Barcodes list if any */}
                  {genSecondaryBarcodes.length > 0 && (
                    <div className="pt-1 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">Additional Barcodes ({genSecondaryBarcodes.length}):</span>{' '}
                      {genSecondaryBarcodes.map(b => b.barcode).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Barcode Format Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Barcode Standard Format
                </label>
                <select
                  value={genBarcodeType}
                  onChange={e => setGenBarcodeType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Code 128">Code 128 (Standard Industrial / Warehouse)</option>
                  <option value="EAN-13">EAN-13 (Standard Retail Supermarket - 13 Digits)</option>
                  <option value="EAN-8">EAN-8 (Compact Package Format - 8 Digits)</option>
                  <option value="UPC">UPC Universal Product Code (12 Digits)</option>
                  <option value="QR Code">2D QR Code Matrix</option>
                </select>
              </div>

              {/* 3. Barcode Number (Auto-Generated Unique + Override) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Generated Barcode Number
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedGenProduct) {
                        const existingSet = new Set(products.map(p => (p.barcode || '').toLowerCase()).filter(Boolean));
                        const unique = barcodeService.generateUniqueBarcodeForType(genBarcodeType, selectedGenProduct.sku, existingSet);
                        setGeneratedBarcodeNumber(unique);
                        setCustomValue('');
                      }
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    title="Generate another unique number"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={customValue || generatedBarcodeNumber}
                  onChange={e => setCustomValue(e.target.value)}
                  placeholder="Auto-generated unique barcode"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 text-xs font-bold"
                />

                {/* Uniqueness Status Indicator */}
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  {isCheckingGenUniqueness ? (
                    <span className="text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Validating database uniqueness...
                    </span>
                  ) : genUniqueness?.isUnique ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Unique & Validated in Catalog
                    </span>
                  ) : genUniqueness?.conflictingProduct ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Conflict: Assigned to {genUniqueness.conflictingProduct.name} ({genUniqueness.conflictingProduct.sku})
                    </span>
                  ) : null}
                </div>
              </div>

              {/* 4. Action Buttons: Save Association & Quick Print */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleInitiateSaveGenBarcode}
                  disabled={isSavingGenBarcode || !genUniqueness?.isUnique}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isSavingGenBarcode ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Barcode...</span>
                    </>
                  ) : (
                    <>
                      <Tag className="w-4 h-4" />
                      <span>Save Barcode to Product</span>
                    </>
                  )}
                </button>
              </div>

              {/* 5. Label Designer Studio Layout Parameters */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    Label Designer Studio
                  </h3>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono font-bold">
                    {labelWidthMm} x {labelHeightMm} mm
                  </span>
                </div>

                {/* Label Dimensions (Width & Height) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <span className="block font-bold text-slate-800 text-[11px]">
                    Sticker Label Dimensions:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Preset Size</label>
                      <select
                        value={labelDimensionPreset}
                        onChange={e => {
                          const val = e.target.value;
                          setLabelDimensionPreset(val);
                          if (val === '50x25') { setLabelWidthMm(50); setLabelHeightMm(25); }
                          else if (val === '38x25') { setLabelWidthMm(38); setLabelHeightMm(25); }
                          else if (val === '50x30') { setLabelWidthMm(50); setLabelHeightMm(30); }
                          else if (val === '60x40') { setLabelWidthMm(60); setLabelHeightMm(40); }
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 cursor-pointer"
                      >
                        <option value="50x25">50 x 25 mm (Standard Retail)</option>
                        <option value="38x25">38 x 25 mm (Compact / Jewelry)</option>
                        <option value="50x30">50 x 30 mm (Grocery / Apparel)</option>
                        <option value="60x40">60 x 40 mm (Shipping Carton)</option>
                        <option value="custom">Custom Size (mm)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Width (mm)</label>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={labelWidthMm}
                        onChange={e => {
                          setLabelDimensionPreset('custom');
                          setLabelWidthMm(Math.max(10, Number(e.target.value) || 20));
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Height (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={labelHeightMm}
                        onChange={e => {
                          setLabelDimensionPreset('custom');
                          setLabelHeightMm(Math.max(10, Number(e.target.value) || 10));
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Copies to Print</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={copiesCount}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setCopiesCount('');
                          return;
                        }
                        const cleaned = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
                        setCopiesCount(cleaned);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sheet Columns</label>
                    <select
                      value={columnsCount}
                      onChange={e => setColumnsCount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold cursor-pointer"
                    >
                      <option value={1}>1 Column (Thermal Roll)</option>
                      <option value={2}>2 Columns</option>
                      <option value={3}>3 Columns (Standard)</option>
                      <option value={4}>4 Columns (Compact)</option>
                    </select>
                  </div>
                </div>

                {/* Batch & Expiry inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Batch Number</label>
                    <input
                      type="text"
                      value={batchNo}
                      onChange={e => setBatchNo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="text"
                      value={expDate}
                      onChange={e => setExpDate(e.target.value)}
                      placeholder="MM/YYYY"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Visibility Toggles */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 block text-[11px]">Include on Sticker:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={e => setShowLogo(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Company Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPrice}
                        onChange={e => setShowPrice(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Selling Price</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMrp}
                        onChange={e => setShowMrp(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Package MRP</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSku}
                        onChange={e => setShowSku(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Product SKU</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBatch}
                        onChange={e => setShowBatch(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Batch & Expiry</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Printable Sticker Sheet Preview */}
            <div
              id="barcode-printable-sheet"
              className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 print:p-0 print:border-none print:shadow-none print:bg-white print:w-full print:m-0 barcode-printable-area"
            >
              <div className="no-print barcode-screen-only flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Printable Sticker Sheet Preview (A4 / Thermal Roll)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ready to feed into Zebra, TSC or standard laser adhesive sticker paper
                  </p>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {parsedCopies} Sticker{parsedCopies !== 1 ? 's' : ''} ({labelWidthMm}x{labelHeightMm}mm)
                  </span>
                </div>
              </div>

              {/* Dynamic Grid of Barcode Stickers */}
              <div
                className={`grid gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 print:bg-white print:border-none print:p-0 print:m-0 barcode-printable-grid cols-${columnsCount} ${
                  columnsCount === 1
                    ? 'grid-cols-1 max-w-xs mx-auto'
                    : columnsCount === 2
                    ? 'grid-cols-2'
                    : columnsCount === 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-3'
                }`}
              >
                {parsedCopies === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 no-print">
                    <p className="text-sm font-medium text-slate-500">No stickers to display</p>
                    <p className="text-xs text-slate-400 mt-1">Enter a copies count (e.g. 8) to preview sticker sheet</p>
                  </div>
                ) : (
                  Array.from({ length: parsedCopies }).map((_, idx) => (
                    <div
                      key={idx}
                      className="barcode-label-item bg-white p-3 rounded-xl border border-slate-300 shadow-2xs flex flex-col justify-between text-center space-y-1.5 print:shadow-none print:border-slate-800 text-xs w-full min-w-0 overflow-hidden print:overflow-visible print:rounded-xs print:p-2.5"
                    >
                      {showLogo && (
                        <span className="font-bold text-[10px] uppercase text-slate-500 print:text-black tracking-wider block truncate px-1">
                          {company.name}
                        </span>
                      )}

                      <h4
                        className="font-bold text-xs text-slate-900 print:text-black line-clamp-2 leading-tight break-words px-1 min-h-[1.75rem] flex items-center justify-center print:min-h-0"
                        title={selectedGenProduct?.name}
                      >
                        {selectedGenProduct?.name || 'Sample Item'}
                      </h4>

                      {showSku && (
                        <span
                          className="text-[10px] font-mono text-slate-500 print:text-black block truncate w-full px-1"
                          title={`SKU: ${selectedGenProduct?.sku || 'SMP-001'}`}
                        >
                          SKU: {selectedGenProduct?.sku || 'SMP-001'}
                        </span>
                      )}

                      {/* Barcode Canvas */}
                      <div className="py-1 w-full max-w-full flex justify-center items-center overflow-hidden print:overflow-visible px-1">
                        <BarcodeCanvas
                          value={activeGenBarcodeValue}
                          type={genBarcodeType}
                          height={genBarcodeType === 'QR Code' ? 52 : 36}
                          showText={genBarcodeType !== 'QR Code'}
                        />
                      </div>

                      {/* Pricing / MRP */}
                      {(showPrice || showMrp) && (
                        <div className="flex items-center justify-center gap-2 pt-1.5 border-t border-slate-100 print:border-slate-300 font-bold text-xs w-full overflow-hidden print:overflow-visible">
                          {showPrice && (
                            <span className="text-slate-900 print:text-black whitespace-nowrap text-xs">
                              Price: {formatCurrency(selectedGenProduct?.sellingPrice || 0)}
                            </span>
                          )}
                          {showMrp && (
                            <span className="text-slate-400 print:text-slate-700 line-through text-[10px] whitespace-nowrap">
                              MRP: {formatCurrency(selectedGenProduct?.mrp || 0)}
                            </span>
                          )}
                        </div>
                      )}

                      {showBatch && (
                        <div className="flex items-center justify-between text-[9px] text-slate-500 print:text-black font-mono pt-0.5 px-0.5 w-full">
                          <span className="truncate mr-1">B: {batchNo}</span>
                          <span className="truncate shrink-0">EXP: {expDate}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Option 1: Modal for existing barcode conflict (Replace vs Add Additional) */}
          <Modal
            isOpen={showGenConflictModal}
            onClose={() => setShowGenConflictModal(false)}
            title="Product Already Has an Active Barcode"
            size="md"
            footer={
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setShowGenConflictModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => commitSaveGenBarcode(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Add as Additional Barcode
                </button>
                <button
                  type="button"
                  onClick={() => commitSaveGenBarcode(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Replace Default Barcode
                </button>
              </div>
            }
          >
            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Existing Barcode Detected</p>
                  <p className="mt-0.5">
                    <strong>{selectedGenProduct?.name}</strong> already has default barcode{' '}
                    <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-bold">
                      {selectedGenProduct?.barcode}
                    </code>
                    .
                  </p>
                </div>
              </div>

              <p>How would you like to assign the new barcode <strong className="font-mono">{activeGenBarcodeValue}</strong>?</p>

              <div className="space-y-2 pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="font-bold text-slate-900">1. Replace Default Barcode</p>
                  <p className="text-slate-500 mt-0.5">
                    Sets this new barcode as the product master default barcode.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="font-bold text-slate-900">2. Add as Additional Barcode</p>
                  <p className="text-slate-500 mt-0.5">
                    Preserves the current default barcode and registers this new barcode as a secondary barcode. Both barcodes will scan and identify this product across POS and billing.
                  </p>
                </div>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* ===================================================================== */}
      {/* OPTION 2 CONTENT: UPDATE EXISTING PRODUCT BARCODE */}
      {/* ===================================================================== */}
      {activeTab === 'update' && (
        <div className="space-y-6 barcode-screen-only no-print">
          {/* Step 1: Scanner Input & Search Bar */}
          <div className="no-print bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ScanBarcode className="w-4 h-4 text-blue-600" />
                  Step 1: Scan or Enter Existing Product Barcode
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan any product barcode with your barcode reader, or manually type the barcode number / SKU.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <ScanBarcode className="w-4 h-4 text-blue-600 absolute left-3 top-3" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executeBarcodeLookup();
                    }
                  }}
                  placeholder="Scan barcode here (keyboard-wedge scanner ready) or enter number..."
                  className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      scannerInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => executeBarcodeLookup()}
                disabled={isSearchingBarcode || !searchInput.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                {isSearchingBarcode ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Identifying...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Identify Product</span>
                  </>
                )}
              </button>
            </div>

            {/* Unknown Barcode Notice & Fallback Catalog Search */}
            {unknownBarcodeError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-start gap-2.5 text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Product Not Found:</span> {unknownBarcodeError}
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <span className="text-amber-800 font-semibold shrink-0">Search from Catalog:</span>
                  <select
                    value={manualCatalogSelectId}
                    onChange={e => {
                      const id = e.target.value;
                      setManualCatalogSelectId(id);
                      const prod = products.find(p => p.id === id);
                      if (prod) {
                        populateProductForEditing(prod);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="">-- Choose an existing product to update --</option>
                    {sortProductsAZ(products).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) {p.barcode ? `— [Barcode: ${p.barcode}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Matched Product Form (Steps 3, 4, 5) */}
          {matchedProduct && (
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-6 animate-fadeIn">
              {/* Step 3: Matched Product Current Details Overview Header */}
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                      Matched Product Identified
                    </span>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      {matchedProduct.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500">SKU: {matchedProduct.sku}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-700">
                      {matchedProduct.category || 'General'}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 text-slate-700">
                      Unit: {matchedProduct.primaryUnit || 'Piece'}
                    </span>
                    <button
                      type="button"
                      disabled={isPrintingDirect}
                      onClick={() => handleDirectPrintSticker(matchedProduct)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      title="Direct print barcode sticker for this product"
                    >
                      {isPrintingDirect ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 fill-white" />
                      )}
                      <span>Direct Print Sticker</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenProductId(matchedProduct.id);
                        if (matchedProduct.barcode) {
                          setCustomValue(matchedProduct.barcode);
                        }
                        setActiveTab('generate');
                        setSearchParams({ tab: 'generate' });
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      title="Open in Barcode Generator & Print Sticker Sheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Sticker Sheet</span>
                    </button>
                  </div>
                </div>

                {/* Current Barcodes & Current Prices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Default Barcode</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                      <span>{matchedProduct.barcode || '— None —'}</span>
                      {matchedProduct.barcode && (
                        <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-sans font-bold">
                          Default
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Selling Price</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {formatCurrency(matchedProduct.sellingPrice || 0)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current MRP</span>
                    <span className="text-sm font-bold text-slate-700 mt-0.5 block">
                      {formatCurrency(matchedProduct.mrp || 0)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Stock</span>
                    <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                      {matchedProduct.currentStock ?? 0} {matchedProduct.primaryUnit || 'Piece'}
                    </span>
                  </div>
                </div>

                {/* Secondary barcodes if any */}
                {matchedSecondaryBarcodes.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-semibold">Additional Barcodes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSecondaryBarcodes.map((b, i) => (
                        <span
                          key={i}
                          className="font-mono px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700"
                        >
                          {b.barcode} ({b.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Editable Product Fields Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    Step 4: Update Selling Price, MRP & Product Details
                  </h3>
                  {!canEditProductDetails && (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      Read-Only (No Edit Permission)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  {/* New Selling Price */}
                  <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-200/70">
                    <label className="block font-bold text-blue-900 mb-1">
                      New Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEditProductDetails}
                      value={editSellingPrice}
                      onChange={e => setEditSellingPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <span className="text-[10px] text-blue-700 mt-1 block">
                      Previous: {formatCurrency(matchedProduct.sellingPrice || 0)}
                    </span>
                  </div>

                  {/* New MRP */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="block font-bold text-slate-800 mb-1">
                      New Package MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEditProductDetails}
                      value={editMrp}
                      onChange={e => setEditMrp(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Previous: {formatCurrency(matchedProduct.mrp || 0)}
                    </span>
                  </div>

                  {/* Product Name */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block font-bold text-slate-800 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      disabled={!canEditProductDetails}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      disabled={!canEditProductDetails}
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>

                  {/* HSN / SAC Code */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      disabled={!canEditProductDetails}
                      value={editHsn}
                      onChange={e => setEditHsn(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900"
                      placeholder="e.g. 8471"
                    />
                  </div>

                  {/* Tax Rate % */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tax Rate (%)
                    </label>
                    <select
                      disabled={!canEditProductDetails}
                      value={editTaxRate}
                      onChange={e => setEditTaxRate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                    >
                      <option value="0">0% (Exempted / Nil)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18% (Standard)</option>
                      <option value="28">28%</option>
                    </select>
                  </div>

                  {/* Reorder Level */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Reorder Limit (Stock Warning)
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={!canEditProductDetails}
                      value={editReorderLevel}
                      onChange={e => setEditReorderLevel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      placeholder="e.g. 10"
                    />
                  </div>

                  {/* Primary Unit */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Unit of Measurement
                    </label>
                    <input
                      type="text"
                      disabled={!canEditProductDetails}
                      value={editPrimaryUnit}
                      onChange={e => setEditPrimaryUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      placeholder="Piece, Kg, Box, etc."
                    />
                  </div>

                  {/* Reason for change */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Reason for Update *
                    </label>
                    <input
                      type="text"
                      value={editReason}
                      onChange={e => setEditReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                      placeholder="e.g. Price Revision, Re-labeling"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Product Description / Notes
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canEditProductDetails}
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                    placeholder="Optional item details or notes..."
                  />
                </div>
              </div>

              {/* Step 5: Replace Default Barcode Option */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isReplacingDefaultBarcode}
                        onChange={e => {
                          const checked = e.target.checked;
                          setIsReplacingDefaultBarcode(checked);
                          if (checked && !newReplacementBarcode) {
                            handleGenerateReplacementBarcode();
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          Replace Product's Default Barcode
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Enable this option if you need to assign a new unique barcode to this product.
                        </span>
                      </div>
                    </label>
                    {isReplacingDefaultBarcode && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        Replacement Mode Active
                      </span>
                    )}
                  </div>

                  {/* Expanded Replacement Barcode Form */}
                  {isReplacingDefaultBarcode && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-3 text-xs animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            New Barcode Format
                          </label>
                          <select
                            value={replacementBarcodeType}
                            onChange={e => {
                              const t = e.target.value as any;
                              setReplacementBarcodeType(t);
                              const existingSet = new Set(products.map(p => (p.barcode || '').toLowerCase()).filter(Boolean));
                              const generated = barcodeService.generateUniqueBarcodeForType(t, matchedProduct.sku, existingSet);
                              setNewReplacementBarcode(generated);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                          >
                            <option value="Code 128">Code 128 (Standard Industrial / Warehouse)</option>
                            <option value="EAN-13">EAN-13 (Standard Retail Supermarket)</option>
                            <option value="EAN-8">EAN-8 (Compact Package Format)</option>
                            <option value="UPC">UPC Universal Product Code</option>
                            <option value="QR Code">2D QR Code Matrix</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-semibold text-slate-700">
                              New Barcode Number *
                            </label>
                            <button
                              type="button"
                              onClick={handleGenerateReplacementBarcode}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Auto-Generate</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={newReplacementBarcode}
                            onChange={e => setNewReplacementBarcode(e.target.value)}
                            placeholder="Enter or auto-generate new barcode number"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Replacement Uniqueness Status Check */}
                      <div className="flex items-center justify-between text-[11px]">
                        {isCheckingReplacement ? (
                          <span className="text-slate-400 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Checking barcode uniqueness in database...
                          </span>
                        ) : replacementUniqueness?.isUnique ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Barcode is unique and ready to assign
                          </span>
                        ) : replacementUniqueness?.conflictingProduct ? (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Conflict: {replacementUniqueness.message}
                          </span>
                        ) : null}
                      </div>

                      {/* Live Barcode Canvas Preview */}
                      {newReplacementBarcode.trim() && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold mb-1">New Barcode Preview</span>
                          <BarcodeCanvas
                            value={newReplacementBarcode.trim()}
                            type={replacementBarcodeType}
                            height={40}
                            width={180}
                            showText={replacementBarcodeType !== 'QR Code'}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions: Save Changes and Cancel */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    populateProductForEditing(matchedProduct);
                    setFeedback(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold w-full sm:w-auto"
                >
                  Reset Form
                </button>

                <button
                  type="button"
                  onClick={handleSaveProductUpdates}
                  disabled={
                    isSubmittingUpdate ||
                    !canEditProductDetails ||
                    (isReplacingDefaultBarcode && !replacementUniqueness?.isUnique)
                  }
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer w-full sm:w-auto"
                >
                  {isSubmittingUpdate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isReplacingDefaultBarcode ? 'Replace Barcode & Save Changes' : 'Save Product Details'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Confirmation Modal before Replacing Default Barcode */}
          <Modal
            isOpen={showReplacementConfirmModal}
            onClose={() => setShowReplacementConfirmModal(false)}
            title="Confirm Default Barcode Replacement"
            subtitle="Step 6 Verification"
            size="md"
            footer={
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setShowReplacementConfirmModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingUpdate}
                  onClick={() => commitProductUpdates(true)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  {isSubmittingUpdate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Replace Barcode</span>
                    </>
                  )}
                </button>
              </div>
            }
          >
            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <p className="font-bold">Please confirm barcode replacement for:</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {matchedProduct?.name} <span className="text-xs font-mono font-normal text-slate-500">({matchedProduct?.sku})</span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Previous Default Barcode:</span>
                  <span className="font-mono font-bold text-rose-700">{matchedProduct?.barcode || 'None'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">New Default Barcode:</span>
                  <span className="font-mono font-bold text-emerald-700">{newReplacementBarcode}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Selling Price:</span>
                  <span>
                    {formatCurrency(matchedProduct?.sellingPrice || 0)} <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />{' '}
                    <strong className="text-slate-900">{formatCurrency(parseFloat(editSellingPrice) || 0)}</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Package MRP:</span>
                  <span>
                    {formatCurrency(matchedProduct?.mrp || 0)} <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />{' '}
                    <strong className="text-slate-900">{formatCurrency(parseFloat(editMrp) || 0)}</strong>
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] leading-relaxed">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Data Integrity Guarantee
                </p>
                <p className="mt-0.5 text-emerald-800">
                  Existing stock balances, transaction history, purchase invoices and completed sales records are strictly preserved. The previous barcode will only be updated after successful validation.
                </p>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
};
