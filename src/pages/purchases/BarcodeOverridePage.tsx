import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ScanBarcode,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  History,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  XCircle,
  FileText,
  Clock,
  User,
  Check,
  ChevronRight,
  Eye,
  Sliders,
  CheckCircle,
  AlertCircle,
  Zap,
  Tag
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { barcodeOverrideService } from '../../services/barcodeOverrideService';
import { canManageBarcodeOverride } from '../../utils/rbac';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import {
  Product,
  BarcodeMethod,
  BarcodeAuditLog,
  BarcodeOverrideInput,
  BarcodeValidationResult
} from '../../types';

export const BarcodeOverridePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  const initialBarcode = searchParams.get('barcode') || '';

  const { products, refreshData, company } = useERP();
  const { user, profile } = useAuth();

  const isAuthorized = canManageBarcodeOverride(profile?.role);

  // Active Method: Method A (Manual Barcode Entry) vs Method B (Existing Product Barcode Override)
  const [activeMethod, setActiveMethod] = useState<BarcodeMethod>('SUPPLIER_OVERRIDE');

  // Shared form inputs
  const [scannedBarcode, setScannedBarcode] = useState<string>(initialBarcode);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);

  // Price update controls
  const [updatePrice, setUpdatePrice] = useState<boolean>(false);
  const [newSellingPrice, setNewSellingPrice] = useState<string>('');

  // Reason
  const [reason, setReason] = useState<string>('');

  // Conflict and validation states
  const [validationResult, setValidationResult] = useState<BarcodeValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // UI flow states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Audit Logs drawer state
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<BarcodeAuditLog[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected product if passed via query params
  useEffect(() => {
    if (initialProductId && products.length > 0) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId, products]);

  // Load audit logs on mount
  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await barcodeOverrideService.getBarcodeAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Failed to load barcode audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filtered catalog products for dropdown/search
  const matchedProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 10);
    const q = productSearchQuery.toLowerCase();
    return products
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [products, productSearchQuery]);

  // When selected product changes, pre-populate price
  useEffect(() => {
    if (selectedProduct) {
      setNewSellingPrice(String(selectedProduct.sellingPrice || 0));
    }
  }, [selectedProduct]);

  // Run barcode validation whenever barcode or target product changes
  useEffect(() => {
    const trimmed = scannedBarcode.trim();
    if (!trimmed) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const res = await barcodeOverrideService.validateBarcode(
          trimmed,
          selectedProductId,
          company.id
        );
        setValidationResult(res);

        // In Method B (Supplier Override): If barcode matches an existing product and none is selected yet,
        // auto-detect and highlight the matching product
        if (activeMethod === 'SUPPLIER_OVERRIDE' && !selectedProductId) {
          const match = products.find(
            p => p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()
          );
          if (match) {
            setSelectedProductId(match.id);
          }
        }
      } catch (err) {
        console.warn('Barcode validation error:', err);
      } finally {
        setIsValidating(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [scannedBarcode, selectedProductId, activeMethod, products, company.id]);

  // Handle Barcode Scanner Wedge (Enter key submission)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = scannedBarcode.trim();
      if (!val) return;

      // Auto search for matching product in catalog
      const existingMatch = products.find(
        p =>
          (p.barcode && p.barcode.trim().toLowerCase() === val.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === val.toLowerCase())
      );

      if (existingMatch) {
        setSelectedProductId(existingMatch.id);
      }
    }
  };

  // Open confirmation modal with comprehensive validation
  const handleOpenConfirmation = () => {
    setFeedback(null);

    if (!selectedProductId) {
      setFeedback({ type: 'error', message: 'Please select a catalog product to update.' });
      return;
    }

    const trimmedBarcode = scannedBarcode.trim();
    if (!trimmedBarcode) {
      setFeedback({ type: 'error', message: 'Please enter or scan a valid barcode number.' });
      barcodeInputRef.current?.focus();
      return;
    }

    if (validationResult?.conflict) {
      setFeedback({
        type: 'error',
        message: validationResult.message || 'Cannot proceed: Barcode conflicts with another product.'
      });
      return;
    }

    if (updatePrice) {
      const parsedPrice = parseFloat(newSellingPrice);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setFeedback({
          type: 'error',
          message: 'Selling price must be a valid non-negative amount.'
        });
        return;
      }
    }

    if (!reason.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please provide a reason for this barcode update.'
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Commit Barcode Assignment or Override
  const handleConfirmSubmit = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload: BarcodeOverrideInput = {
        productId: selectedProduct.id,
        method: activeMethod,
        newBarcode: scannedBarcode.trim(),
        updatePrice,
        newSellingPrice: updatePrice ? parseFloat(newSellingPrice) : undefined,
        reason: reason.trim()
      };

      const result = await barcodeOverrideService.executeBarcodeOverride(
        payload,
        {
          id: user?.id || '00000000-0000-0000-0000-000000000000',
          name: profile?.full_name || user?.email || 'Purchase Manager',
          role: profile?.role || 'Purchase Manager'
        },
        company.id
      );

      // Refresh global products data so changes propagate instantly across the app
      await refreshData();

      // Refresh audit logs
      await loadAuditLogs();

      setIsConfirmModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Successfully updated barcode for "${result.product.name}" to "${result.product.barcode}". Audit trail recorded.`
      });

      // Reset form partially
      setScannedBarcode('');
      setReason('');
      setUpdatePrice(false);
      setValidationResult(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update product barcode.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If not authorized, display Access Denied shield
  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted to Purchase Manager</h2>
        <p className="text-sm text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
          The Barcode Management and Supplier Barcode Override module is protected under strict governance policies.
          Only authorized Purchase Managers can assign or override product barcodes.
        </p>
        <button
          onClick={() => navigate('/purchases')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
        >
          Return to Purchases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchasing</span>
            <span className="text-slate-300">•</span>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Inventory Inward Control</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5 flex items-center gap-2.5">
            <ScanBarcode className="w-5 h-5 text-blue-600" />
            Barcode Management & Supplier Barcode Override
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Assign custom barcodes or override existing product barcodes with incoming manufacturer and snack packaging barcodes.
            All historical sales, purchase bills, and inventory balances are strictly preserved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAuditDrawerOpen(true)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Audit History</span>
            {auditLogs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                {auditLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/products')}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Package className="w-4 h-4 text-slate-500" />
            <span>Product Master</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barcode Method Selector (Method A vs Method B) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Method A Card */}
        <div
          onClick={() => {
            setActiveMethod('MANUAL_ENTRY');
            setFeedback(null);
          }}
          className={`p-4.5 rounded-2xl border-2 transition-all cursor-pointer ${
            activeMethod === 'MANUAL_ENTRY'
              ? 'border-blue-600 bg-blue-50/40 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeMethod === 'MANUAL_ENTRY' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Method A</span>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Manual Barcode Entry</h3>
              </div>
            </div>
            {activeMethod === 'MANUAL_ENTRY' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">Active</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Enter an existing barcode number manually or scan a custom barcode. Validates format and prevents duplicate assignments across products.
          </p>
        </div>

        {/* Method B Card */}
        <div
          onClick={() => {
            setActiveMethod('SUPPLIER_OVERRIDE');
            setFeedback(null);
          }}
          className={`p-4.5 rounded-2xl border-2 transition-all cursor-pointer ${
            activeMethod === 'SUPPLIER_OVERRIDE'
              ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeMethod === 'SUPPLIER_OVERRIDE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Method B</span>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Supplier Barcode Override</h3>
              </div>
            </div>
            {activeMethod === 'SUPPLIER_OVERRIDE' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">Active</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            For products arriving at warehouse that already have a manufacturer barcode (such as snacks, drinks, FMCG). Scans packaging, overrides product barcode, and optionally updates retail selling price.
          </p>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Barcode Scanning & Product Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card: Barcode Scanner / Input Field */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ScanBarcode className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {activeMethod === 'SUPPLIER_OVERRIDE' ? 'Scan Incoming Supplier Barcode' : 'Barcode Scanner / Input'}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">USB / Keyboard Wedge Ready</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {activeMethod === 'SUPPLIER_OVERRIDE'
                  ? 'Scan barcode printed on packaging (or type manually):'
                  : 'Enter or scan barcode number:'}
              </label>

              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="e.g. 8901030382910, 8901234567890..."
                  value={scannedBarcode}
                  onChange={e => setScannedBarcode(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="w-full pl-3.5 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  autoFocus
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isValidating ? (
                    <RefreshCw className="w-4 h-4 text-slate-400 animate-spin mr-1" />
                  ) : scannedBarcode.trim() ? (
                    <button
                      onClick={() => setScannedBarcode('')}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="Clear"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  ) : null}

                  <span className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-[10px] font-bold font-mono">
                    ↵ Enter
                  </span>
                </div>
              </div>

              {/* Validation Status Message */}
              {scannedBarcode.trim() && validationResult && (
                <div className="mt-2.5">
                  {validationResult.conflict ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Barcode Conflict Detected!</span>
                        <p className="mt-0.5">{validationResult.message}</p>
                        <p className="text-[11px] text-rose-600 mt-1 font-medium">
                          Safety Rule: A barcode cannot be assigned to multiple products simultaneously.
                        </p>
                      </div>
                    </div>
                  ) : validationResult.isSameAsCurrent ? (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{validationResult.message}</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">
                        Barcode is available and verified unique in catalog.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card: Target Product Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Target Product in Catalog
                </h3>
              </div>
              {selectedProduct && (
                <button
                  onClick={() => {
                    setSelectedProductId('');
                    setProductSearchQuery('');
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Change Product
                </button>
              )}
            </div>

            {selectedProduct ? (
              /* Selected Product Summary Card */
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                      {selectedProduct.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">{selectedProduct.name}</h4>
                    <span className="text-xs text-slate-500 font-mono">SKU: {selectedProduct.sku}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold block">Available Stock</span>
                    <span className="text-xs font-bold text-slate-800">
                      {formatNumber(selectedProduct.currentStock || 0)} {selectedProduct.primaryUnit || 'Pcs'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Current Barcode</span>
                    <span className="font-mono font-bold text-slate-700">
                      {selectedProduct.barcode || '— Not Set —'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Current Selling Price</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(selectedProduct.sellingPrice || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Purchase Cost</span>
                    <span className="font-medium text-slate-600">
                      {formatCurrency(selectedProduct.purchasePrice || selectedProduct.costPrice || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Searchable Autocomplete Picker */
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Search & Select Catalog Product:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU, or category..."
                    value={productSearchQuery}
                    onChange={e => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {/* Dropdown list */}
                {showProductDropdown && (
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white shadow-lg z-20">
                    {matchedProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No catalog products match "{productSearchQuery}"
                      </div>
                    ) : (
                      matchedProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setShowProductDropdown(false);
                            setProductSearchQuery('');
                          }}
                          className="p-3 hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-xs text-slate-900 block">{p.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              SKU: {p.sku} {p.barcode ? `• Barcode: ${p.barcode}` : '• No Barcode'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-800 block">
                              {formatCurrency(p.sellingPrice || 0)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Stock: {formatNumber(p.currentStock || 0)} {p.primaryUnit || 'Pcs'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: Optional Selling Price Update (Section 3 of Prompt) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Optional Selling Price Update
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Retail & POS Rates</span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updatePrice}
                  onChange={e => setUpdatePrice(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Update Selling Price for this product in the same workflow
                </span>
              </label>

              {updatePrice && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Current Selling Price:
                      </label>
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                        {selectedProduct ? formatCurrency(selectedProduct.sellingPrice || 0) : '—'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        New Selling Price (₹):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newSellingPrice}
                          onChange={e => setNewSellingPrice(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Note: Adjusts the retail master selling price for future invoices and POS counter scans. Historical transactions remain completely untouched.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reason for Change (Mandatory) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Reason for Barcode Change / Override <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Manufacturer changed snack outer packaging barcode, Retail EAN-13 updated..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Right Column: Comparison & Confirmation Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card: Before vs After Comparison */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Eye className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Before & After Preview
              </h3>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                {/* Barcode Comparison */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Barcode Assignment
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 block">Old Barcode</span>
                      <span className="font-mono font-semibold text-xs text-slate-600 truncate block">
                        {selectedProduct.barcode || '— None —'}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />

                    <div className="min-w-0 text-right">
                      <span className="text-[10px] text-blue-600 font-bold block">New Barcode</span>
                      <span className="font-mono font-bold text-xs text-blue-700 truncate block">
                        {scannedBarcode.trim() || '— Awaiting Scan —'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Selling Price Comparison */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selling Price Adjustment
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Current Price</span>
                      <span className="font-bold text-xs text-slate-700">
                        {formatCurrency(selectedProduct.sellingPrice || 0)}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        {updatePrice ? 'New Selling Price' : 'Unchanged'}
                      </span>
                      <span className="font-bold text-xs text-emerald-700">
                        {updatePrice && newSellingPrice
                          ? formatCurrency(parseFloat(newSellingPrice) || 0)
                          : formatCurrency(selectedProduct.sellingPrice || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Safety Verification Badges */}
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                    <span>Safety Protections Active</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    • Product ID & SKU will remain identical.
                  </p>
                  <p className="text-[10px] text-slate-500">
                    • Inventory balances ({formatNumber(selectedProduct.currentStock || 0)} {selectedProduct.primaryUnit}) will remain intact.
                  </p>
                  <p className="text-[10px] text-slate-500">
                    • Past sales and purchase bills will not be modified.
                  </p>
                </div>

                {/* Submit Action Button */}
                <button
                  onClick={handleOpenConfirmation}
                  disabled={!selectedProductId || !scannedBarcode.trim() || Boolean(validationResult?.conflict)}
                  className={`w-full py-3 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !selectedProductId || !scannedBarcode.trim() || Boolean(validationResult?.conflict)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : activeMethod === 'SUPPLIER_OVERRIDE'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98]'
                      : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                  }`}
                >
                  <ScanBarcode className="w-4 h-4" />
                  <span>
                    {activeMethod === 'SUPPLIER_OVERRIDE'
                      ? 'Update Existing Product Barcode'
                      : 'Save Barcode to Product Master'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-700 text-xs">No product selected</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scan a barcode or pick a product from catalog to preview changes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {isConfirmModalOpen && selectedProduct && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Barcode & Pricing Update"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Please verify before updating</span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  You are about to override the barcode for product <strong>{selectedProduct.name}</strong>. Future scans will resolve to this new barcode.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50">
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Product Name:</span>
                <span className="font-bold text-slate-900">{selectedProduct.name}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">SKU:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedProduct.sku}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Previous Barcode:</span>
                <span className="font-mono text-slate-600">{selectedProduct.barcode || '— None —'}</span>
              </div>
              <div className="p-3 flex justify-between bg-blue-50/50">
                <span className="text-blue-900 font-semibold">New Barcode:</span>
                <span className="font-mono font-bold text-blue-700">{scannedBarcode.trim()}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Selling Price Update:</span>
                <span className="font-bold text-slate-900">
                  {updatePrice
                    ? `${formatCurrency(selectedProduct.sellingPrice || 0)} → ${formatCurrency(parseFloat(newSellingPrice) || 0)}`
                    : 'Unchanged'}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Reason:</span>
                <span className="text-slate-700 italic max-w-[250px] truncate">{reason}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Commit Override</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit History Drawer / Modal */}
      {isAuditDrawerOpen && (
        <Modal
          isOpen={isAuditDrawerOpen}
          onClose={() => setIsAuditDrawerOpen(false)}
          title="Barcode Management Audit History"
          size="xl"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by product, SKU, barcode, reason..."
                  value={auditSearchQuery}
                  onChange={e => setAuditSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                onClick={loadAuditLogs}
                disabled={isLoadingAudit}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Product (SKU)</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Barcode Change</th>
                    <th className="py-2.5 px-3">Price Update</th>
                    <th className="py-2.5 px-3">User & Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No barcode updates recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs
                      .filter(l => {
                        if (!auditSearchQuery.trim()) return true;
                        const q = auditSearchQuery.toLowerCase();
                        return (
                          l.productName.toLowerCase().includes(q) ||
                          l.sku.toLowerCase().includes(q) ||
                          l.newBarcode.toLowerCase().includes(q) ||
                          l.reason.toLowerCase().includes(q)
                        );
                      })
                      .map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {log.productName}
                            <span className="block text-[10px] text-slate-400 font-mono">SKU: {log.sku}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.method === 'SUPPLIER_OVERRIDE'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {log.method === 'SUPPLIER_OVERRIDE' ? 'Supplier Override' : 'Manual Entry'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className="text-slate-400 line-through mr-1">{log.oldBarcode || 'None'}</span>
                            <span className="text-blue-600 font-bold">→ {log.newBarcode}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {log.priceUpdated ? (
                              <span className="text-emerald-700 font-bold">
                                {formatCurrency(log.oldSellingPrice || 0)} → {formatCurrency(log.newSellingPrice || 0)}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unchanged</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 max-w-[220px]">
                            <span className="font-medium text-slate-800 block truncate">{log.userName}</span>
                            <span className="text-[10px] text-slate-500 block truncate" title={log.reason}>
                              "{log.reason}"
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
