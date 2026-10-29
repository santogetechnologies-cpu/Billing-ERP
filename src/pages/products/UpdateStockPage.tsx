import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Warehouse as WarehouseIcon,
  Search,
  Check,
  X,
  ShieldAlert,
  Info,
  Barcode as BarcodeIcon,
  Calendar,
  Hash,
  Lock,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { canUpdateStock, canManageBarcodeOverride } from '../../utils/rbac';
import { cleanQuantityInput } from './InitialStockPage';

type AdjustmentType = 'ADD' | 'REDUCE' | 'CORRECT';

export const UpdateStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const {
    products,
    warehouses,
    stockBalances,
    adjustStock,
    batches,
    addBatch,
    updateBatch,
    serialNumbers,
    addSerialNumber,
    updateSerialNumber,
    updateProduct,
    refreshStockBalances
  } = useERP();

  // Role Permissions Check: Restricted to Owner, Admin, and Purchase Manager (Strictly denied for Warehouse Manager)
  const canAccess = canUpdateStock(profile?.role);
  const canEditBarcode = canManageBarcodeOverride(profile?.role);

  // URL query pre-population
  const queryProductId = searchParams.get('productId') || '';
  const queryWarehouse = searchParams.get('warehouse') || '';

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>(queryProductId);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(queryWarehouse);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('ADD');
  const [inputQty, setInputQty] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Product Tracking Fields State
  const [barcode, setBarcode] = useState<string>('');
  const [batchMode, setBatchMode] = useState<'existing' | 'new'>('existing');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [serialMode, setSerialMode] = useState<'existing' | 'new'>('new');
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');

  // Status & Feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trackingErrors, setTrackingErrors] = useState<{
    barcode?: string;
    batchNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Sync with search params on initial mount
  useEffect(() => {
    if (queryProductId && !selectedProductId) {
      setSelectedProductId(queryProductId);
    }
    if (queryWarehouse && !selectedWarehouse) {
      setSelectedWarehouse(queryWarehouse);
    }
  }, [queryProductId, queryWarehouse]);

  // Selected Product Details
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Selected Warehouse Details
  const selectedWarehouseObj = useMemo(() => {
    return (
      warehouses.find(
        w =>
          w.code === selectedWarehouse ||
          w.id === selectedWarehouse ||
          w.name === selectedWarehouse
      ) || null
    );
  }, [warehouses, selectedWarehouse]);

  // Auto-select warehouse if product has a default warehouse and none is selected
  useEffect(() => {
    if (selectedProduct?.warehouse && !selectedWarehouse) {
      setSelectedWarehouse(selectedProduct.warehouse);
    }
  }, [selectedProduct, selectedWarehouse]);

  // Available Batches for Selected Product
  const productBatches = useMemo(() => {
    if (!selectedProductId) return [];
    return batches.filter(b => b.productId === selectedProductId);
  }, [batches, selectedProductId]);

  // Available In-Stock Serials for Selected Product
  const inStockSerials = useMemo(() => {
    if (!selectedProductId) return [];
    return serialNumbers.filter(
      s => s.productId === selectedProductId && s.warrantyStatus === 'In Stock'
    );
  }, [serialNumbers, selectedProductId]);

  // Selected Batch Object
  const selectedBatchObj = useMemo(() => {
    if (!selectedBatchId) return null;
    return productBatches.find(b => b.id === selectedBatchId) || null;
  }, [productBatches, selectedBatchId]);

  // Sync Tracking Fields when Selected Product or Product Batches change
  useEffect(() => {
    if (selectedProduct) {
      // 1. Barcode
      setBarcode(selectedProduct.barcode || '');

      // 2. Batches
      const matchingBatches = batches.filter(b => b.productId === selectedProduct.id);
      if (matchingBatches.length > 0) {
        setBatchMode('existing');
        const activeBatch = matchingBatches.find(b => b.qty > 0) || matchingBatches[0];
        setSelectedBatchId(activeBatch.id);
        setBatchNumber(activeBatch.batchNumber);
        setExpiryDate(activeBatch.expiryDate || '');
      } else {
        setBatchMode('new');
        setSelectedBatchId('');
        setBatchNumber('');
        setExpiryDate('');
      }

      // 3. Serials
      const matchingSerials = serialNumbers.filter(
        s => s.productId === selectedProduct.id && s.warrantyStatus === 'In Stock'
      );
      if (matchingSerials.length > 0 && adjustmentType === 'REDUCE') {
        setSerialMode('existing');
        setSelectedSerialId(matchingSerials[0].id);
        setSerialNumber(matchingSerials[0].serialNumber);
      } else {
        setSerialMode('new');
        setSelectedSerialId('');
        setSerialNumber('');
      }

      setTrackingErrors({});
    } else {
      setBarcode('');
      setSelectedBatchId('');
      setBatchNumber('');
      setExpiryDate('');
      setSelectedSerialId('');
      setSerialNumber('');
      setTrackingErrors({});
    }
  }, [selectedProductId, selectedProduct]);

  // Handle Batch Selection
  const handleBatchSelectChange = (batchId: string) => {
    if (batchId === '__NEW__') {
      setBatchMode('new');
      setSelectedBatchId('');
      setBatchNumber('');
      setExpiryDate('');
      return;
    }
    setBatchMode('existing');
    setSelectedBatchId(batchId);
    const found = productBatches.find(b => b.id === batchId);
    if (found) {
      setBatchNumber(found.batchNumber);
      setExpiryDate(found.expiryDate || '');
    }
    if (trackingErrors.batchNumber) {
      setTrackingErrors(prev => ({ ...prev, batchNumber: undefined }));
    }
  };

  // Handle Serial Selection (for REDUCE)
  const handleSerialSelectChange = (serialId: string) => {
    if (serialId === '__NEW__') {
      setSerialMode('new');
      setSelectedSerialId('');
      setSerialNumber('');
      return;
    }
    setSerialMode('existing');
    setSelectedSerialId(serialId);
    const found = inStockSerials.find(s => s.id === serialId);
    if (found) {
      setSerialNumber(found.serialNumber);
    }
    if (trackingErrors.serialNumber) {
      setTrackingErrors(prev => ({ ...prev, serialNumber: undefined }));
    }
  };

  // Auto Generators
  const handleAutoBatch = () => {
    const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const r = Math.floor(100 + Math.random() * 900);
    setBatchMode('new');
    setSelectedBatchId('');
    setBatchNumber(`BAT-${d}-${r}`);
    if (trackingErrors.batchNumber) {
      setTrackingErrors(prev => ({ ...prev, batchNumber: undefined }));
    }
  };

  const handleAutoSerial = () => {
    setSerialMode('new');
    setSelectedSerialId('');
    const r = Math.floor(100000 + Math.random() * 900000);
    setSerialNumber(`SN-${Date.now().toString().slice(-4)}${r}`);
    if (trackingErrors.serialNumber) {
      setTrackingErrors(prev => ({ ...prev, serialNumber: undefined }));
    }
  };

  const applyExpiryPreset = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setExpiryDate(d.toISOString().split('T')[0]);
    if (trackingErrors.expiryDate) {
      setTrackingErrors(prev => ({ ...prev, expiryDate: undefined }));
    }
  };

  // Compute Current Warehouse Stock Balance
  const currentWarehouseStock = useMemo(() => {
    if (!selectedProductId || !selectedWarehouse) return 0;

    const targetWhCode = selectedWarehouseObj?.code || selectedWarehouse;
    const targetWhId = selectedWarehouseObj?.id || selectedWarehouse;

    const sb = stockBalances.find(
      b =>
        b.productId === selectedProductId &&
        (b.warehouseId === targetWhId || b.warehouseId === targetWhCode)
    );

    if (sb !== undefined) {
      return Number(sb.quantity) || 0;
    }

    if (warehouses.length === 1 && selectedProduct) {
      return Number(selectedProduct.currentStock) || 0;
    }

    return 0;
  }, [selectedProductId, selectedWarehouse, selectedWarehouseObj, stockBalances, warehouses, selectedProduct]);

  // Calculate Net Adjustment Amount & Resulting Stock Balance
  const { netAdjustmentQty, resultingStockBalance, isNegativeStock, isInputValid } = useMemo(() => {
    const rawVal = parseFloat(inputQty);
    if (isNaN(rawVal) || inputQty.trim() === '') {
      return {
        netAdjustmentQty: 0,
        resultingStockBalance: currentWarehouseStock,
        isNegativeStock: false,
        isInputValid: false
      };
    }

    let netAdj = 0;
    let resulting = currentWarehouseStock;

    if (adjustmentType === 'ADD') {
      if (rawVal <= 0) {
        return { netAdjustmentQty: 0, resultingStockBalance: currentWarehouseStock, isNegativeStock: false, isInputValid: false };
      }
      netAdj = rawVal;
      resulting = currentWarehouseStock + rawVal;
    } else if (adjustmentType === 'REDUCE') {
      if (rawVal <= 0) {
        return { netAdjustmentQty: 0, resultingStockBalance: currentWarehouseStock, isNegativeStock: false, isInputValid: false };
      }
      netAdj = -rawVal;
      resulting = currentWarehouseStock - rawVal;
    } else if (adjustmentType === 'CORRECT') {
      if (rawVal < 0) {
        return { netAdjustmentQty: 0, resultingStockBalance: currentWarehouseStock, isNegativeStock: true, isInputValid: false };
      }
      netAdj = rawVal - currentWarehouseStock;
      resulting = rawVal;
    }

    const isNeg = resulting < 0;
    const isValid = !isNeg && netAdj !== 0;

    return {
      netAdjustmentQty: netAdj,
      resultingStockBalance: resulting,
      isNegativeStock: isNeg,
      isInputValid: isValid
    };
  }, [adjustmentType, inputQty, currentWarehouseStock]);

  // Preset reasons
  const presetReasons = [
    'Physical inventory audit count variance',
    'Damaged / broken goods write-off',
    'Expired inventory scrap removal',
    'Unrecorded stock surplus found during audit',
    'Warehouse shrinkage adjustment'
  ];

  // Validation for Product Tracking Details
  const validateTracking = (): { isValid: boolean; errors: typeof trackingErrors } => {
    const errs: typeof trackingErrors = {};
    if (!selectedProduct) return { isValid: true, errors: errs };

    // 1. Barcode check
    const trimmedBarcode = barcode.trim();
    if (canEditBarcode && trimmedBarcode && trimmedBarcode !== (selectedProduct.barcode || '').trim()) {
      const conflict = products.find(
        p => p.id !== selectedProduct.id && p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase()
      );
      if (conflict) {
        errs.barcode = `Barcode is already assigned to "${conflict.name}" (SKU: ${conflict.sku}).`;
      }
    }

    // 2. Batch Number check
    const isBatchRequired = Boolean(selectedProduct.batchTracking);
    const trimmedBatch = batchNumber.trim();
    if (isBatchRequired && !trimmedBatch) {
      errs.batchNumber = 'Batch number is required for this batch-tracked product.';
    }

    // Batch quantity check for REDUCE
    if (adjustmentType === 'REDUCE' && selectedBatchId && batchMode === 'existing') {
      const existingB = batches.find(b => b.id === selectedBatchId);
      const deductQty = parseFloat(inputQty) || 0;
      if (existingB && deductQty > existingB.qty) {
        errs.batchNumber = `Cannot deduct ${deductQty} units from batch "${existingB.batchNumber}" which only has ${existingB.qty} units available.`;
      }
    }

    // 3. Expiry Date check
    const isExpiryRequired = Boolean(selectedProduct.expiryTracking) || (Boolean(trimmedBatch) && isBatchRequired);
    if (isExpiryRequired && !expiryDate) {
      errs.expiryDate = 'Expiry date is required for this product.';
    } else if (expiryDate) {
      const dateVal = new Date(expiryDate).getTime();
      if (isNaN(dateVal)) {
        errs.expiryDate = 'Please select a valid expiry date.';
      } else {
        const yr = parseInt(expiryDate.split('-')[0], 10);
        if (isNaN(yr) || yr < 1900 || yr > 2099) {
          errs.expiryDate = 'Please enter a valid 4-digit year (1900–2099).';
        }
      }
    }

    // 4. Serial Number check
    const isSerialRequired = Boolean(selectedProduct.serialTracking);
    const trimmedSerial = serialNumber.trim();
    if (isSerialRequired && !trimmedSerial) {
      errs.serialNumber = 'Serial number is required for this serial-tracked product.';
    } else if (trimmedSerial && (adjustmentType === 'ADD' || serialMode === 'new')) {
      const conflict = serialNumbers.find(
        s => s.serialNumber.trim().toLowerCase() === trimmedSerial.toLowerCase() && s.productId !== selectedProduct.id
      );
      if (conflict) {
        errs.serialNumber = `Serial number "${trimmedSerial}" is already registered (${conflict.productName}).`;
      }
    }

    return {
      isValid: Object.keys(errs).length === 0,
      errors: errs
    };
  };

  // Handle Form Submission Confirmation
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setTrackingErrors({});

    if (!selectedProductId) {
      setErrorMessage('Please select a product to adjust.');
      return;
    }
    if (!selectedWarehouse) {
      setErrorMessage('Please select a warehouse.');
      return;
    }
    if (!isInputValid) {
      if (isNegativeStock) {
        setErrorMessage(
          `Adjustment rejected: Resulting warehouse stock cannot be negative. Current stock is ${currentWarehouseStock}, cannot reduce below 0.`
        );
      } else {
        setErrorMessage('Please specify a valid non-zero adjustment quantity.');
      }
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Reason for stock adjustment is mandatory.');
      return;
    }

    // Validate Tracking Details
    const { isValid: trackingValid, errors: tErrors } = validateTracking();
    if (!trackingValid) {
      setTrackingErrors(tErrors);
      const firstErr = Object.values(tErrors)[0];
      setErrorMessage(firstErr || 'Please resolve invalid tracking details before proceeding.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Execute Stock Adjustment
  const handleExecuteAdjustment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const whCodeOrName = selectedWarehouseObj?.id || selectedWarehouseObj?.code || selectedWarehouse;

      // 1. Update product barcode if edited and permitted
      if (
        canEditBarcode &&
        barcode.trim() &&
        barcode.trim() !== (selectedProduct?.barcode || '').trim() &&
        selectedProductId
      ) {
        await updateProduct(selectedProductId, { barcode: barcode.trim() });
      }

      // 2. Build enriched tracking reason for permanent audit trail
      const metaTags: string[] = [];
      if (batchNumber.trim()) metaTags.push(`Batch: ${batchNumber.trim()}`);
      if (expiryDate.trim()) metaTags.push(`Exp: ${expiryDate.trim()}`);
      if (serialNumber.trim()) metaTags.push(`SN: ${serialNumber.trim()}`);
      const enrichedReason = metaTags.length > 0 ? `[${metaTags.join(' | ')}] ${reason.trim()}` : reason.trim();

      // 3. Apply stock adjustment to database
      await adjustStock(selectedProductId, netAdjustmentQty, enrichedReason, whCodeOrName);

      // 4. Update or Create Batch record
      if (batchNumber.trim() && selectedProduct) {
        if (selectedBatchId && batchMode === 'existing') {
          const existingB = batches.find(b => b.id === selectedBatchId);
          if (existingB) {
            const newQty = Math.max(0, existingB.qty + netAdjustmentQty);
            const newStatus = newQty <= 0 ? 'Low Stock' : existingB.status;
            await updateBatch(selectedBatchId, {
              qty: newQty,
              status: newStatus,
              expiryDate: expiryDate || existingB.expiryDate
            });
          }
        } else if (netAdjustmentQty > 0 || adjustmentType === 'ADD') {
          await addBatch({
            productId: selectedProductId,
            productName: selectedProduct.name,
            warehouseId: selectedWarehouseObj?.id || selectedWarehouse,
            batchNumber: batchNumber.trim(),
            expiryDate: expiryDate || '',
            mfgDate: new Date().toISOString().split('T')[0],
            purchaseDate: new Date().toISOString().split('T')[0],
            cost: selectedProduct.costPrice || selectedProduct.purchasePrice || 0,
            qty: Math.max(0, netAdjustmentQty),
            status: 'Active'
          });
        }
      }

      // 5. Update or Create Serial Number record
      if (serialNumber.trim() && selectedProduct) {
        if (adjustmentType === 'ADD' || serialMode === 'new') {
          await addSerialNumber({
            productId: selectedProductId,
            productName: selectedProduct.name,
            serialNumber: serialNumber.trim(),
            purchaseDate: new Date().toISOString().split('T')[0],
            warrantyMonths: 12,
            warrantyStatus: 'In Stock'
          });
        } else if (adjustmentType === 'REDUCE' && selectedSerialId) {
          await updateSerialNumber(selectedSerialId, {
            warrantyStatus: 'Expired'
          });
        }
      }

      // 6. Force refresh balances
      await refreshStockBalances();

      const sign = netAdjustmentQty > 0 ? `+${formatNumber(netAdjustmentQty)}` : `${formatNumber(netAdjustmentQty)}`;
      setSuccessMessage(
        `Successfully adjusted stock for "${selectedProduct?.name}" in ${selectedWarehouseObj?.name || selectedWarehouse} by ${sign} ${selectedProduct?.primaryUnit || 'units'} (New balance: ${formatNumber(resultingStockBalance)}).`
      );

      // Reset form fields
      setInputQty('0');
      setReason('');
      setIsConfirmModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to apply stock adjustment.');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products;
    const q = productSearchQuery.toLowerCase();
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, productSearchQuery]);

  // If user role is not authorized, render access restriction screen
  if (!canAccess) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-xl border border-slate-200 shadow-2xs mt-10">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your current role (<strong>{profile?.role || 'Staff'}</strong>) does not have permission to execute manual stock adjustments.
          This administrative operation is restricted to Owner, Admin, and Purchase Manager.
        </p>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
        >
          Return to Product Master
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Product Master</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-blue-600">Update Stock</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            <span>Update Stock</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify warehouse stock balances for audit discrepancies, write-offs, or verified physical counts with full traceable history.
          </p>
        </div>
      </div>

      {/* Operational Scope Notice */}
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Operational Guidance: </span>
          Manual stock updates are designated for physical audit variances, damaged goods write-offs, or discrepancy corrections.
          Standard replenishment must follow <strong>Purchase Receiving</strong>, and outbound inventory must flow through <strong>Sales Invoices / POS</strong>.
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-emerald-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3 text-rose-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Stock Update Form Card */}
      <form onSubmit={handleOpenConfirm} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Stock Adjustment Form</h2>
            <p className="text-[11px] text-slate-500">
              Select product, destination warehouse, record tracking details, choose adjustment action, and provide reason.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Step-by-step verified workflow</span>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* Step 1: Product Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              1. Select Product <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Choose Product from Catalog --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Total Stock: {p.currentStock} {p.primaryUnit}
                  </option>
                ))}
              </select>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={e => setProductSearchQuery(e.target.value)}
                  placeholder="Filter product by name, SKU, barcode..."
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {productSearchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20 divide-y divide-slate-100">
                    {filteredProducts.slice(0, 8).map(fp => (
                      <div
                        key={fp.id}
                        onClick={() => {
                          setSelectedProductId(fp.id);
                          setProductSearchQuery('');
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">{fp.name}</span>
                          <span className="text-[10px] text-slate-500">
                            SKU: {fp.sku} | Category: {fp.category}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">
                          {fp.currentStock} {fp.primaryUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Product Pill */}
            {selectedProduct && (
              <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900 text-sm">{selectedProduct.name}</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold text-[10px]">
                    SKU: {selectedProduct.sku}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Unit: <strong className="text-slate-800">{selectedProduct.primaryUnit || 'Piece'}</strong>
                  </span>
                  {selectedProduct.barcode && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-[10px]">
                      Barcode: {selectedProduct.barcode}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Total Company Inventory: </span>
                  <span className="font-black text-slate-900">
                    {formatNumber(selectedProduct.currentStock)} {selectedProduct.primaryUnit}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Destination Warehouse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                2. Target Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Select Warehouse --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.code || w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Live Warehouse Stock Badge */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                3. Current Stock in Selected Warehouse
              </label>
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-600 font-medium">
                    {selectedWarehouseObj?.name || 'Selected Warehouse'}
                  </span>
                </div>
                <span className="font-black text-sm text-blue-950">
                  {formatNumber(currentWarehouseStock)} {selectedProduct?.primaryUnit || 'units'}
                </span>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* STEP 3: PRODUCT TRACKING DETAILS (BARCODE, BATCH, EXPIRY, SERIAL) */}
          {/* ================================================================= */}
          <div className="p-4 bg-slate-50/70 border border-slate-200/90 rounded-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <BarcodeIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs">Product Tracking Details</h3>
                {selectedProduct && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedProduct.batchTracking || selectedProduct.expiryTracking || selectedProduct.serialTracking
                      ? 'Tracking Enabled'
                      : 'Standard Product'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                {selectedProduct?.batchTracking || selectedProduct?.serialTracking
                  ? 'Tracking fields enforced for this product'
                  : 'Optional for non-tracked products'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Field 1: Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Barcode
                  </label>
                  {!canEditBarcode && (
                    <span className="text-[9px] text-slate-400 inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={barcode}
                    disabled={!canEditBarcode}
                    onChange={e => {
                      setBarcode(e.target.value);
                      if (trackingErrors.barcode) setTrackingErrors(prev => ({ ...prev, barcode: undefined }));
                    }}
                    placeholder={canEditBarcode ? 'Scan or enter barcode' : 'No barcode assigned'}
                    className={`w-full text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                      trackingErrors.barcode
                        ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30'
                        : canEditBarcode
                        ? 'bg-white border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500'
                        : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
                {trackingErrors.barcode ? (
                  <p className="text-[10px] text-rose-600 font-medium mt-1">{trackingErrors.barcode}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {canEditBarcode
                      ? 'Product identifier barcode (Owner/Admin editable)'
                      : 'Product barcode (Requires Owner or Admin to modify)'}
                  </p>
                )}
              </div>

              {/* Field 2: Batch Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Batch Number {selectedProduct?.batchTracking && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {productBatches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (batchMode === 'existing') {
                            setBatchMode('new');
                            setSelectedBatchId('');
                            setBatchNumber('');
                            setExpiryDate('');
                          } else {
                            setBatchMode('existing');
                            if (productBatches.length > 0) {
                              handleBatchSelectChange(productBatches[0].id);
                            }
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        {batchMode === 'existing' ? '+ New Batch' : 'Use Existing'}
                      </button>
                    )}
                    {batchMode === 'new' && (
                      <button
                        type="button"
                        onClick={handleAutoBatch}
                        className="text-[10px] text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>

                {batchMode === 'existing' && productBatches.length > 0 ? (
                  <select
                    value={selectedBatchId}
                    onChange={e => handleBatchSelectChange(e.target.value)}
                    className={`w-full text-xs font-mono px-2.5 py-1.5 bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer ${
                      trackingErrors.batchNumber ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Select Existing Batch --</option>
                    {productBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} (Qty: {b.qty} {selectedProduct?.primaryUnit || 'units'}{b.expiryDate ? ` | Exp: ${b.expiryDate}` : ''})
                      </option>
                    ))}
                    <option value="__NEW__">+ Enter New Batch...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={e => {
                      setBatchNumber(e.target.value.toUpperCase());
                      if (trackingErrors.batchNumber) setTrackingErrors(prev => ({ ...prev, batchNumber: undefined }));
                    }}
                    placeholder="e.g. BAT-261029-101"
                    className={`w-full text-xs font-mono px-3 py-1.5 bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 ${
                      trackingErrors.batchNumber ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  />
                )}

                {trackingErrors.batchNumber ? (
                  <p className="text-[10px] text-rose-600 font-medium mt-1">{trackingErrors.batchNumber}</p>
                ) : selectedBatchObj ? (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    Available in batch: {selectedBatchObj.qty} {selectedProduct?.primaryUnit || 'units'}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selectedProduct?.batchTracking ? 'Mandatory for batch-tracked items' : 'Optional batch tag'}
                  </p>
                )}
              </div>

              {/* Field 3: Expiry Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Expiry Date {(selectedProduct?.expiryTracking || (batchNumber && selectedProduct?.batchTracking)) && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyExpiryPreset(6)}
                      className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      +6m
                    </button>
                    <button
                      type="button"
                      onClick={() => applyExpiryPreset(12)}
                      className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      +1y
                    </button>
                  </div>
                </div>

                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => {
                    setExpiryDate(e.target.value);
                    if (trackingErrors.expiryDate) setTrackingErrors(prev => ({ ...prev, expiryDate: undefined }));
                  }}
                  className={`w-full text-xs px-2.5 py-1.5 bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 ${
                    trackingErrors.expiryDate ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />

                {trackingErrors.expiryDate ? (
                  <p className="text-[10px] text-rose-600 font-medium mt-1">{trackingErrors.expiryDate}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selectedProduct?.expiryTracking ? 'Mandatory expiry date' : 'Optional batch shelf-life'}
                  </p>
                )}
              </div>

              {/* Field 4: Serial Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Serial Number {selectedProduct?.serialTracking && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {adjustmentType === 'REDUCE' && inStockSerials.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (serialMode === 'existing') {
                            setSerialMode('new');
                            setSelectedSerialId('');
                            setSerialNumber('');
                          } else {
                            setSerialMode('existing');
                            if (inStockSerials.length > 0) {
                              handleSerialSelectChange(inStockSerials[0].id);
                            }
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        {serialMode === 'existing' ? 'Manual' : 'Select In-Stock'}
                      </button>
                    )}
                    {(serialMode === 'new' || adjustmentType === 'ADD') && (
                      <button
                        type="button"
                        onClick={handleAutoSerial}
                        className="text-[10px] text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>

                {adjustmentType === 'REDUCE' && serialMode === 'existing' && inStockSerials.length > 0 ? (
                  <select
                    value={selectedSerialId}
                    onChange={e => handleSerialSelectChange(e.target.value)}
                    className={`w-full text-xs font-mono px-2.5 py-1.5 bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 cursor-pointer ${
                      trackingErrors.serialNumber ? 'border-rose-300 ring-1 ring-rose-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Select In-Stock Serial --</option>
                    {inStockSerials.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.serialNumber} (In Stock)
                      </option>
                    ))}
                    <option value="__NEW__">+ Enter Other Serial...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => {
                      setSerialNumber(e.target.value.toUpperCase());
                      if (trackingErrors.serialNumber) setTrackingErrors(prev => ({ ...prev, serialNumber: undefined }));
                    }}
                    placeholder="e.g. SN-892411"
                    className={`w-full text-xs font-mono px-3 py-1.5 bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 ${
                      trackingErrors.serialNumber ? 'border-rose-300 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                  />
                )}

                {trackingErrors.serialNumber ? (
                  <p className="text-[10px] text-rose-600 font-medium mt-1">{trackingErrors.serialNumber}</p>
                ) : inStockSerials.length > 0 ? (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {inStockSerials.length} serial unit(s) registered in inventory
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selectedProduct?.serialTracking ? 'Mandatory for serial-tracked items' : 'Optional individual unit tag'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 4: Adjustment Type Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              4. Adjustment Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Type 1: Add Stock */}
              <div
                onClick={() => setAdjustmentType('ADD')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  adjustmentType === 'ADD'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${
                      adjustmentType === 'ADD'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    +
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Add Stock</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Increase stock balance (e.g. audit surplus found, unrecorded receipt).
                </p>
              </div>

              {/* Type 2: Reduce Stock */}
              <div
                onClick={() => setAdjustmentType('REDUCE')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  adjustmentType === 'REDUCE'
                    ? 'border-rose-600 bg-rose-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${
                      adjustmentType === 'REDUCE'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    -
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Reduce Stock</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Decrease stock (e.g. damage write-off, breakage, shrinkage, scrap).
                </p>
              </div>

              {/* Type 3: Correct Stock */}
              <div
                onClick={() => setAdjustmentType('CORRECT')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  adjustmentType === 'CORRECT'
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${
                      adjustmentType === 'CORRECT'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    =
                  </div>
                  <span className="font-bold text-slate-900 text-xs">Correct Stock</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Set warehouse balance directly to verified physical count.
                </p>
              </div>
            </div>
          </div>

          {/* Step 5: Quantity Input */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              5.{' '}
              {adjustmentType === 'ADD'
                ? 'Quantity to Add (+)'
                : adjustmentType === 'REDUCE'
                ? 'Quantity to Deduct (-)'
                : 'New Physical Count (=)'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={inputQty}
                  onFocus={e => e.target.select()}
                  onChange={e => setInputQty(cleanQuantityInput(e.target.value))}
                  onBlur={() => {
                    if (!inputQty.trim()) {
                      setInputQty('0');
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-transparent border-0 font-bold text-slate-900 text-sm focus:outline-none focus:ring-0 min-w-0"
                />
                <span className="inline-flex items-center px-3 bg-slate-100/80 border-l border-slate-200 text-xs font-semibold text-slate-600 whitespace-nowrap select-none shrink-0">
                  {selectedProduct?.primaryUnit || 'units'}
                </span>
              </div>

              {/* Negative Stock Alert / Live Guidance */}
              <div className="flex items-center">
                {isNegativeStock ? (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Negative stock prevented:</strong> Cannot reduce stock below 0. Current balance is{' '}
                      {currentWarehouseStock}.
                    </span>
                  </div>
                ) : adjustmentType === 'REDUCE' && Number(inputQty) > 0 ? (
                  <span className="text-slate-500 text-[11px]">
                    Will deduct {inputQty} units from {selectedWarehouseObj?.name || 'warehouse'}.
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Step 6: Reason for Adjustment */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              6. Reason for Adjustment <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Audit variance, water leakage damage, physical count discrepancy..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {presetReasons.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 7: NEW STOCK BALANCE PREVIEW */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span>7. Stock Balance Preview</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Destination: {selectedWarehouseObj?.name || 'Not selected'}
              </span>
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center">
              {/* Box 1: Current Stock */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Current Stock
                </span>
                <span className="text-base font-black text-slate-900">
                  {formatNumber(currentWarehouseStock)}
                </span>
                <span className="text-[10px] text-slate-400 block">{selectedProduct?.primaryUnit || 'units'}</span>
              </div>

              {/* Box 2: Adjustment Amount */}
              <div
                className={`p-2.5 rounded-lg border ${
                  netAdjustmentQty > 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : netAdjustmentQty < 0
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Adjustment
                </span>
                <span
                  className={`text-base font-black ${
                    netAdjustmentQty > 0
                      ? 'text-emerald-700'
                      : netAdjustmentQty < 0
                      ? 'text-rose-700'
                      : 'text-slate-400'
                  }`}
                >
                  {netAdjustmentQty > 0 ? `+${formatNumber(netAdjustmentQty)}` : formatNumber(netAdjustmentQty)}
                </span>
                <span className="text-[10px] text-slate-400 block">{selectedProduct?.primaryUnit || 'units'}</span>
              </div>

              {/* Box 3: Resulting Stock Balance */}
              <div
                className={`p-2.5 rounded-lg border-2 ${
                  isNegativeStock
                    ? 'bg-rose-50 border-rose-500 text-rose-900'
                    : isInputValid
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  New Stock Balance
                </span>
                <span
                  className={`text-base font-black ${
                    isNegativeStock ? 'text-rose-700' : isInputValid ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {formatNumber(resultingStockBalance)}
                </span>
                <span className="text-[10px] text-slate-400 block">{selectedProduct?.primaryUnit || 'units'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setInputQty('0');
                setReason('');
                setErrorMessage(null);
                setTrackingErrors({});
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold text-xs cursor-pointer transition-colors"
            >
              Reset Inputs
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedProductId ||
                !selectedWarehouse ||
                !isInputValid ||
                isNegativeStock ||
                !reason.trim()
              }
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Stock Adjustment"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Please verify the stock adjustment and product tracking details before applying changes:
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Product:</span>
              <strong className="text-slate-900">{selectedProduct?.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Warehouse:</span>
              <strong className="text-slate-900">{selectedWarehouseObj?.name || selectedWarehouse}</strong>
            </div>

            {/* Tracking Summary in Modal */}
            {barcode && (
              <div className="flex justify-between">
                <span className="text-slate-500">Barcode:</span>
                <span className="font-mono text-slate-800">{barcode}</span>
              </div>
            )}
            {batchNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Batch Number:</span>
                <span className="font-mono font-semibold text-blue-700">
                  {batchNumber} {expiryDate ? `(Exp: ${expiryDate})` : ''}
                </span>
              </div>
            )}
            {serialNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Serial Number:</span>
                <span className="font-mono font-semibold text-indigo-700">{serialNumber}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500">Current Stock:</span>
              <span className="font-semibold text-slate-800">
                {formatNumber(currentWarehouseStock)} {selectedProduct?.primaryUnit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Adjustment:</span>
              <strong className={netAdjustmentQty > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {netAdjustmentQty > 0 ? `+${formatNumber(netAdjustmentQty)}` : formatNumber(netAdjustmentQty)}{' '}
                {selectedProduct?.primaryUnit}
              </strong>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5">
              <span className="text-slate-500">New Stock Balance:</span>
              <strong className="text-blue-700 text-sm">
                {formatNumber(resultingStockBalance)} {selectedProduct?.primaryUnit}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reason:</span>
              <span className="text-slate-800 font-medium italic">{reason}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteAdjustment}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Changes...' : 'Yes, Confirm & Apply'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UpdateStockPage;
