import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Building2,
  Warehouse as WarehouseIcon,
  Search,
  AlertCircle,
  Calendar,
  Layers,
  Loader2,
  AlertTriangle,
  ExternalLink,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import { PurchaseRequest, PurchaseRequestItem } from '../../types';
import { formatNumber, formatDate } from '../../utils/formatters';

interface ApprovePurchaseRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: PurchaseRequest | null;
  onApprovalSuccess?: (updatedRequest: PurchaseRequest, poNumber: string) => void;
}

export const ApprovePurchaseRequestModal: React.FC<ApprovePurchaseRequestModalProps> = ({
  isOpen,
  onClose,
  request: initialRequest,
  onApprovalSuccess
}) => {
  const navigate = useNavigate();
  const { suppliers, products, approvePurchaseRequestWithOrder } = useERP();
  const { user } = useAuth();

  // Active loaded request state (refreshed from DB by ID to guarantee complete product lines)
  const [activeRequest, setActiveRequest] = useState<PurchaseRequest | null>(initialRequest);
  const [isLoadingRequest, setIsLoadingRequest] = useState<boolean>(false);

  // State: selected item IDs (strictly from activeRequest.items)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // State: approved quantities for items
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // State: Mandatory Supplier selection
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // State: Delivery & Notes
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load fresh request with all product lines directly from database when modal opens
  useEffect(() => {
    let isMounted = true;
    if (initialRequest && isOpen) {
      setActiveRequest(initialRequest);
      setIsLoadingRequest(true);

      purchaseRequestService
        .getPurchaseRequestById(initialRequest.id)
        .then(fullReq => {
          if (isMounted && fullReq) {
            setActiveRequest(fullReq);
          }
        })
        .catch(err => {
          console.warn('Could not re-fetch PR details in modal:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingRequest(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialRequest?.id, isOpen]);

  // Synchronize selection and quantities whenever activeRequest changes
  useEffect(() => {
    if (activeRequest && isOpen) {
      const items = activeRequest.items || [];
      // Select all original requested items by default
      const allItemIds = new Set<string>(items.map(it => it.id));
      setSelectedItemIds(allItemIds);

      // Default approved quantities to requested quantities (or previously approved if set)
      const initialQtys: Record<string, number> = {};
      items.forEach(it => {
        initialQtys[it.id] =
          it.approvedQty !== null && it.approvedQty !== undefined && it.approvedQty > 0
            ? it.approvedQty
            : it.requestedQty;
      });
      setItemQuantities(initialQtys);

      // Reset supplier
      setSelectedSupplierId(activeRequest.supplierId || '');
      setSupplierSearch('');
      setIsSupplierDropdownOpen(false);

      // Delivery date
      setExpectedDeliveryDate(
        activeRequest.requestedDeliveryDate ||
          (() => {
            const d = new Date();
            d.setDate(d.getDate() + 5);
            return d.toISOString().split('T')[0];
          })()
      );

      // Approval notes
      setApprovalNotes(activeRequest.notes || '');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [activeRequest, isOpen]);

  const requestItems: PurchaseRequestItem[] = useMemo(() => {
    return activeRequest?.items || [];
  }, [activeRequest?.items]);

  const itemsCount = requestItems.length;
  const isSingleProduct = itemsCount === 1;
  const isMultiProduct = itemsCount > 1;
  const hasNoItems = itemsCount === 0;

  // Active suppliers from Supplier Master
  const activeSuppliers = useMemo(() => {
    return (suppliers || []).filter(s => s.status !== 'Inactive');
  }, [suppliers]);

  // Filtered suppliers based on search query
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return activeSuppliers;
    return activeSuppliers.filter(
      s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.company && s.company.toLowerCase().includes(q)) ||
        (s.gstin && s.gstin.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [activeSuppliers, supplierSearch]);

  const selectedSupplier = useMemo(() => {
    return activeSuppliers.find(s => s.id === selectedSupplierId) || suppliers?.find(s => s.id === selectedSupplierId);
  }, [activeSuppliers, suppliers, selectedSupplierId]);

  // Toggle single item selection in multi-product view
  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // "Select All" / "Deselect All" option
  const isAllRequestedSelected = useMemo(() => {
    if (itemsCount === 0) return false;
    return requestItems.every(it => selectedItemIds.has(it.id));
  }, [requestItems, selectedItemIds, itemsCount]);

  const handleToggleAllRequested = () => {
    if (isAllRequestedSelected) {
      // Deselect all
      setSelectedItemIds(new Set());
    } else {
      // Select all items from this request
      setSelectedItemIds(new Set(requestItems.map(it => it.id)));
    }
  };

  // Total selected items count
  const totalApprovedItemsCount = useMemo(() => {
    if (isSingleProduct) {
      const singleItem = requestItems[0];
      return singleItem && (itemQuantities[singleItem.id] ?? singleItem.requestedQty) > 0 ? 1 : 0;
    }
    return requestItems.filter(
      it => selectedItemIds.has(it.id) && (itemQuantities[it.id] ?? it.requestedQty) > 0
    ).length;
  }, [isSingleProduct, requestItems, selectedItemIds, itemQuantities]);

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeRequest) return;

    // 1. Mandatory Supplier Validation
    if (!selectedSupplierId || !selectedSupplierId.trim()) {
      setErrorMessage('Please select a supplier for this Purchase Order.');
      return;
    }

    // 2. Validate request has items
    if (itemsCount === 0) {
      setErrorMessage('This purchase request has no product lines recorded. Approval cannot proceed.');
      return;
    }

    // 3. Build approved items payload
    const approvedPayload: Array<{
      id?: string;
      productId: string;
      productName: string;
      sku?: string;
      unit: string;
      requestedQty: number;
      approvedQty: number;
      rate?: number;
      taxRate?: number;
      isCustom?: boolean;
      adjustmentReason?: string;
    }> = [];

    if (isSingleProduct) {
      // Single product workflow: automatically approved with its quantity
      const singleItem = requestItems[0];
      const appQty = itemQuantities[singleItem.id] ?? singleItem.requestedQty;
      const prod = products?.find(p => p.id === singleItem.productId);

      if (appQty <= 0) {
        setErrorMessage('Approved quantity must be greater than 0.');
        return;
      }

      approvedPayload.push({
        id: singleItem.id,
        productId: singleItem.productId,
        productName: singleItem.productName,
        sku: singleItem.sku,
        unit: singleItem.unit,
        requestedQty: singleItem.requestedQty,
        approvedQty: appQty,
        rate: Number(prod?.purchasePrice || prod?.costPrice || singleItem.estimatedCost || 100),
        taxRate: Number(prod?.taxRate || 18),
        isCustom: false,
        adjustmentReason:
          appQty !== singleItem.requestedQty ? `Quantity adjusted from ${singleItem.requestedQty} to ${appQty}` : undefined
      });
    } else {
      // Multi-product workflow: only include selected products with approvedQty > 0
      requestItems.forEach(it => {
        const isSelected = selectedItemIds.has(it.id);
        const appQty = isSelected ? (itemQuantities[it.id] ?? it.requestedQty) : 0;
        if (isSelected && appQty > 0) {
          const prod = products?.find(p => p.id === it.productId);
          approvedPayload.push({
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            unit: it.unit,
            requestedQty: it.requestedQty,
            approvedQty: appQty,
            rate: Number(prod?.purchasePrice || prod?.costPrice || it.estimatedCost || 100),
            taxRate: Number(prod?.taxRate || 18),
            isCustom: false,
            adjustmentReason:
              appQty !== it.requestedQty ? `Quantity adjusted from ${it.requestedQty} to ${appQty}` : undefined
          });
        }
      });
    }

    if (approvedPayload.length === 0) {
      setErrorMessage('Please select at least one item with an approved quantity greater than 0 before approval.');
      return;
    }

    // Prevent duplicate submission
    setIsSubmitting(true);

    try {
      const res = await approvePurchaseRequestWithOrder({
        requestId: activeRequest.id,
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.company || selectedSupplier?.name,
        supplierGstin: selectedSupplier?.gstin,
        notes: approvalNotes.trim() || undefined,
        expectedDelivery: expectedDeliveryDate || undefined,
        approvedItems: approvedPayload
      });

      if (onApprovalSuccess) {
        onApprovalSuccess(res.request, res.purchaseOrderNumber);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to authorize and approve purchase request.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !activeRequest) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={`Approve Purchase Request #${activeRequest.requestNumber}`}
      subtitle="Review requested products, select supplier, and generate purchase order"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col space-y-5 text-xs">
        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. Header Context Card: Request number, Warehouse, Requester, Priority    */}
        {/* ========================================================================= */}
        <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Purchase Request</span>
            <span className="font-mono font-black text-indigo-600 text-sm block mt-0.5">#{activeRequest.requestNumber}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Warehouse</span>
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5 truncate" title={activeRequest.warehouseName}>
              <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">{activeRequest.warehouseName || 'Main Warehouse'}</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Requester</span>
            <span className="font-semibold text-slate-700 block mt-0.5 truncate">{activeRequest.requesterName || 'Warehouse Staff'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Priority / Date</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeRequest.priority === 'Urgent'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : activeRequest.priority === 'High'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {activeRequest.priority}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">{formatDate(activeRequest.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. Requested Items Section                                                */}
        {/* ========================================================================= */}

        {/* CASE A: SINGLE PRODUCT REQUEST (Keep existing workflow unchanged, no selection controls) */}
        {isSingleProduct && (() => {
          const singleItem = requestItems[0];
          const prod = products?.find(p => p.id === singleItem.productId);
          const currentApproved = itemQuantities[singleItem.id] ?? singleItem.requestedQty;

          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Requested Product</span>
                </h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  1 Product in Request
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900 text-sm block truncate" title={singleItem.productName}>
                    {singleItem.productName}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
                    <span>SKU: {singleItem.sku || prod?.sku || 'N/A'}</span>
                    <span>•</span>
                    <span>Requested: <strong className="text-slate-800 font-semibold">{formatNumber(singleItem.requestedQty)} {singleItem.unit}</strong></span>
                    <span>•</span>
                    <span>Current Stock: {prod?.currentStock || singleItem.currentStock || 0} {singleItem.unit}</span>
                    <span>•</span>
                    <span>Rate: ₹{Number(prod?.purchasePrice || prod?.costPrice || singleItem.estimatedCost || 100).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-white p-2 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Approved Qty:</label>
                  <input
                    type="number"
                    min="1"
                    value={currentApproved}
                    onChange={e => {
                      const val = Math.max(1, Number(e.target.value) || 1);
                      setItemQuantities(prev => ({ ...prev, [singleItem.id]: val }));
                    }}
                    className="w-24 px-2.5 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <span className="text-xs text-slate-500 font-medium">{singleItem.unit}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* CASE B: MULTI-PRODUCT REQUEST (Checkboxes, Select All) */}
        {isMultiProduct && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>
                    Requested Items ({totalApprovedItemsCount} of {itemsCount} selected for approval)
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select products to include in the order. Original requested quantities are preserved for audit.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Select All / Deselect All Option */}
                <button
                  type="button"
                  onClick={handleToggleAllRequested}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAllRequestedSelected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isAllRequestedSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Deselect All</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>Select All</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Products Table (Only products included in current request) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {/* Header row */}
              <div className="bg-slate-50/95 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 grid grid-cols-12 gap-3 items-center sticky top-0 z-10 border-b border-slate-200/80">
                <span className="col-span-1 text-center">Include</span>
                <span className="col-span-7">Product & Details</span>
                <span className="col-span-2 text-right">Requested Qty</span>
                <span className="col-span-2 text-right">Approved Qty</span>
              </div>

              {/* Rows */}
              {requestItems.map(it => {
                const isSelected = selectedItemIds.has(it.id);
                const currentApproved = itemQuantities[it.id] ?? it.requestedQty;
                const prod = products?.find(p => p.id === it.productId);

                return (
                  <div
                    key={it.id}
                    className={`px-4 py-3 grid grid-cols-12 gap-3 items-center transition-colors ${
                      isSelected ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/60 opacity-60'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleItem(it.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                    </div>

                    {/* Product Name, SKU, Stock, Unit Rate */}
                    <div className="col-span-7 min-w-0">
                      <span className="font-semibold text-slate-900 block truncate" title={it.productName}>
                        {it.productName}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>SKU: {it.sku || prod?.sku || 'N/A'}</span>
                        <span>•</span>
                        <span>Stock: {prod?.currentStock || it.currentStock || 0} {it.unit}</span>
                        <span>•</span>
                        <span>Rate: ₹{Number(prod?.purchasePrice || prod?.costPrice || it.estimatedCost || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Requested Qty (Preserved strictly for audit) */}
                    <div className="col-span-2 text-right font-medium text-slate-600">
                      <span className="font-mono">{formatNumber(it.requestedQty)}</span>{' '}
                      <span className="text-[10px] text-slate-400">{it.unit}</span>
                    </div>

                    {/* Editable Approved Quantity */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <input
                        type="number"
                        min="1"
                        disabled={!isSelected}
                        value={isSelected ? currentApproved : 0}
                        onChange={e => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setItemQuantities(prev => ({ ...prev, [it.id]: val }));
                        }}
                        className={`w-20 px-2 py-1 text-right font-mono font-bold text-xs rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                      <span className="text-[10px] text-slate-500 w-8 truncate">{it.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalApprovedItemsCount === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Please select at least one item from this request to authorize for delivery.</span>
              </div>
            )}
          </div>
        )}

        {/* CASE C: EMPTY REQUEST STATE */}
        {hasNoItems && !isLoadingRequest && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block">No product lines found in request</span>
              <p className="text-[11px] text-rose-700 mt-1">
                This purchase request was submitted without any line items. Approval cannot proceed without valid requested products.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. Supplier Selection — Required                                          */}
        {/* ========================================================================= */}
        <div className="space-y-2 border-t border-slate-200/80 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Select Supplier</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            {activeSuppliers.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/purchases/suppliers')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Suppliers</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {activeSuppliers.length === 0 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
              <span>No active suppliers found in Supplier Master. Please add an active supplier before approving.</span>
              <button
                type="button"
                onClick={() => navigate('/purchases/suppliers')}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs ml-3"
              >
                Add Supplier
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Selected supplier card preview */}
              {selectedSupplier ? (
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">
                      {selectedSupplier.company || selectedSupplier.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-0.5">
                      {selectedSupplier.name && selectedSupplier.company && (
                        <span>Contact Person: {selectedSupplier.name}</span>
                      )}
                      {selectedSupplier.gstin && (
                        <span className="font-mono text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded text-[10px]">
                          GSTIN: {selectedSupplier.gstin}
                        </span>
                      )}
                      {selectedSupplier.phone && <span>Phone: {selectedSupplier.phone}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId('');
                      setIsSupplierDropdownOpen(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg hover:bg-indigo-100/50 transition-colors"
                  >
                    Change Supplier
                  </button>
                </div>
              ) : (
                /* Searchable Dropdown Selector */
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type to filter active suppliers by name, company, or GSTIN..."
                      value={supplierSearch}
                      onChange={e => {
                        setSupplierSearch(e.target.value);
                        setIsSupplierDropdownOpen(true);
                      }}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Scrollable list of active suppliers */}
                  <div className="border border-slate-200 rounded-xl bg-white shadow-xs divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {filteredSuppliers.length > 0 ? (
                      filteredSuppliers.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSupplierId(s.id);
                            setIsSupplierDropdownOpen(false);
                            setSupplierSearch('');
                          }}
                          className={`p-2.5 cursor-pointer text-xs hover:bg-indigo-50/80 transition-colors flex items-center justify-between ${
                            selectedSupplierId === s.id ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{s.company || s.name}</span>
                            <span className="text-[10px] text-slate-500 block">
                              {s.name && s.company ? `${s.name} • ` : ''}
                              {s.phone ? `Phone: ${s.phone}` : s.email || 'No phone'}
                            </span>
                          </div>
                          {s.gstin ? (
                            <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {s.gstin}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Regular</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No active suppliers found matching &quot;{supplierSearch}&quot;.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. Approval Notes & Expected Delivery                                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200/80 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Expected Delivery Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                min="2000-01-01"
                max="2099-12-31"
                value={expectedDeliveryDate}
                onChange={e => setExpectedDeliveryDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Approval Notes / Supplier Recommendation (Optional)
            </label>
            <textarea
              rows={2}
              value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              placeholder="e.g. Approved. Proceed with Vendor at agreed bulk rate."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. Cancel and Authorize & Approve Buttons                                  */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedSupplierId || totalApprovedItemsCount === 0 || hasNoItems}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Authorizing & Generating PO...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Authorize & Approve</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

