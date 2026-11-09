import React, { useState, useMemo, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  FileText,
  Boxes,
  HelpCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { InventoryTransaction, Product, Warehouse } from '../../types';
import { Modal } from '../common/Modal';
import { formatDate } from '../../utils/formatters';

interface AdjustmentRecordMeta {
  currentStock: number;
  adjustedStock: number;
  reason: string;
  notes?: string;
  type: 'Increase' | 'Decrease';
  diff: number;
  recordedBy?: string;
}

const META_STORAGE_KEY = 'erp_stock_adjustments_metadata_v1';

export interface WarehouseStockAdjustmentsTabRef {
  openCreateModal: () => void;
}

export interface WarehouseStockAdjustmentsTabProps {
  triggerCreate?: number;
}

export const WarehouseStockAdjustmentsTab = React.forwardRef<
  WarehouseStockAdjustmentsTabRef,
  WarehouseStockAdjustmentsTabProps
>(({ triggerCreate }, ref) => {
  const { profile } = useAuth();
  const {
    inventoryTransactions = [],
    warehouses = [],
    products = [],
    adjustStock,
    getWarehouseStock
  } = useERP();

  const isAuthorized =
    profile?.role === 'Owner' ||
    profile?.role === 'Admin' ||
    profile?.role === 'Purchase Manager';

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedTxn, setSelectedTxn] = useState<InventoryTransaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Metadata storage for exact before/after stock numbers
  const [metaMap, setMetaMap] = useState<Record<string, AdjustmentRecordMeta>>(() => {
    try {
      const raw = localStorage.getItem(META_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const saveMeta = (key: string, data: AdjustmentRecordMeta) => {
    setMetaMap(prev => {
      const updated = { ...prev, [key]: data };
      try {
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'Increase' | 'Decrease'>('Decrease');
  const [quantity, setQuantity] = useState<string>('1');
  const [adjustedStockInput, setAdjustedStockInput] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState('Physical count discrepancy');
  const [adjustmentDate, setAdjustmentDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Edit Form State
  const [editReason, setEditReason] = useState('');

  // Active warehouses
  const activeWarehouses = useMemo(() => {
    return warehouses.filter(w => w.isActive ?? true);
  }, [warehouses]);

  // Filter raw transactions to get Stock Adjustments
  const adjustmentTxns = useMemo(() => {
    return inventoryTransactions
      .filter(tx => tx.type === 'Stock Adjustment')
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [inventoryTransactions]);

  // Auto-generate next Adjustment Number (e.g. ADJ-2026-0001)
  const generateAdjustmentNumber = (): string => {
    let maxSeq = 0;
    adjustmentTxns.forEach(tx => {
      const match = (tx.referenceDoc || '').match(/ADJ-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    return `ADJ-2026-${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to resolve warehouse name
  const getWarehouseName = (idOrCodeOrName?: string): string => {
    if (!idOrCodeOrName) return '—';
    const found = warehouses.find(
      w => w.id === idOrCodeOrName || w.code.toLowerCase() === idOrCodeOrName.toLowerCase() || w.name.toLowerCase() === idOrCodeOrName.toLowerCase()
    );
    return found ? found.name : idOrCodeOrName;
  };

  const getWarehouseCode = (idOrCodeOrName?: string): string => {
    if (!idOrCodeOrName) return '';
    const found = warehouses.find(
      w => w.id === idOrCodeOrName || w.code.toLowerCase() === idOrCodeOrName.toLowerCase() || w.name.toLowerCase() === idOrCodeOrName.toLowerCase()
    );
    return found ? found.code : '';
  };

  const getProductSku = (productId: string): string => {
    const prod = products.find(p => p.id === productId);
    return prod?.sku || prod?.code || '—';
  };

  // Open Create Adjustment Modal
  const handleOpenCreateModal = () => {
    const wh = activeWarehouses[0]?.id || warehouses[0]?.id || '';
    const prod = products[0]?.id || '';
    setSelectedWarehouseId(wh);
    setSelectedProductId(prod);
    setAdjustmentType('Decrease');
    setQuantity('1');
    setAdjustmentReason('Physical count discrepancy');
    setAdjustmentDate(new Date().toISOString().split('T')[0]);
    setFormError(null);

    // Initial adjusted stock preview
    const cur = wh && prod ? getWarehouseStock(wh, prod) : 0;
    setAdjustedStockInput(String(Math.max(0, cur - 1)));

    setIsCreateModalOpen(true);
  };

  React.useImperativeHandle(ref, () => ({
    openCreateModal: handleOpenCreateModal
  }));

  React.useEffect(() => {
    if (triggerCreate && triggerCreate > 0) {
      handleOpenCreateModal();
    }
  }, [triggerCreate]);

  // Current stock for the currently selected product and warehouse in the create form
  const currentFormStock = useMemo(() => {
    if (!selectedWarehouseId || !selectedProductId) return 0;
    return getWarehouseStock(selectedWarehouseId, selectedProductId);
  }, [selectedWarehouseId, selectedProductId, getWarehouseStock, warehouses, products]);

  // When product or warehouse changes, update quantity/adjusted stock preview
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const stock = getWarehouseStock(selectedWarehouseId, prodId);
    const numQty = parseFloat(quantity) || 1;
    if (adjustmentType === 'Increase') {
      setAdjustedStockInput(String(stock + numQty));
    } else {
      setAdjustedStockInput(String(Math.max(0, stock - numQty)));
    }
  };

  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    const stock = getWarehouseStock(whId, selectedProductId);
    const numQty = parseFloat(quantity) || 1;
    if (adjustmentType === 'Increase') {
      setAdjustedStockInput(String(stock + numQty));
    } else {
      setAdjustedStockInput(String(Math.max(0, stock - numQty)));
    }
  };

  // Handle Adjustment Quantity change
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      if (adjustmentType === 'Increase') {
        setAdjustedStockInput(String(currentFormStock + num));
      } else {
        setAdjustedStockInput(String(Math.max(0, currentFormStock - num)));
      }
    }
  };

  // Handle Adjustment Type change
  const handleTypeToggle = (type: 'Increase' | 'Decrease') => {
    setAdjustmentType(type);
    const num = parseFloat(quantity) || 1;
    if (type === 'Increase') {
      setAdjustedStockInput(String(currentFormStock + num));
    } else {
      setAdjustedStockInput(String(Math.max(0, currentFormStock - num)));
    }
  };

  // Handle direct typing in Adjusted Stock input (two-way computation)
  const handleAdjustedStockInputChange = (val: string) => {
    setAdjustedStockInput(val);
    const target = parseFloat(val);
    if (!isNaN(target) && target >= 0) {
      const diff = target - currentFormStock;
      if (diff >= 0) {
        setAdjustmentType('Increase');
        setQuantity(String(diff));
      } else {
        setAdjustmentType('Decrease');
        setQuantity(String(Math.abs(diff)));
      }
    }
  };

  // Quick reason presets
  const quickReasons = [
    'Physical count discrepancy',
    'Damaged / Broken in transit',
    'Expired / Spoiled stock',
    'Found surplus inventory',
    'Scrapped / Obsolete stock',
    'Quality control test sample',
    'Customer return without invoice'
  ];

  // Submit Create Stock Adjustment
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedWarehouseId) {
      setFormError('Please select a warehouse.');
      return;
    }
    if (!selectedProductId) {
      setFormError('Please select a product.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setFormError('Adjustment quantity must be greater than zero.');
      return;
    }

    if (!adjustmentReason.trim()) {
      setFormError('Adjustment Reason is mandatory. Please provide a reason.');
      return;
    }

    if (adjustmentType === 'Decrease' && numQty > currentFormStock) {
      setFormError(
        `Cannot deduct ${numQty} units. Current stock in this warehouse is ${currentFormStock}. Resulting stock cannot be negative.`
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const deltaQty = adjustmentType === 'Increase' ? numQty : -numQty;
    const adjustmentNumber = generateAdjustmentNumber();
    const finalAdjustedStock = currentFormStock + deltaQty;
    const selectedProd = products.find(p => p.id === selectedProductId);
    const selectedWh = warehouses.find(w => w.id === selectedWarehouseId);

    try {
      await adjustStock(
        selectedProductId,
        deltaQty,
        adjustmentReason.trim(),
        selectedWarehouseId,
        {
          referenceDoc: adjustmentNumber,
          productName: selectedProd?.name,
          warehouseName: selectedWh?.name,
          unit: selectedProd?.primaryUnit || 'Pcs'
        }
      );

      // Save metadata for exact display
      saveMeta(adjustmentNumber, {
        currentStock: currentFormStock,
        adjustedStock: finalAdjustedStock,
        reason: adjustmentReason.trim(),
        type: adjustmentType,
        diff: deltaQty,
        recordedBy: profile?.full_name || profile?.email || 'Authorized User'
      });

      setIsCreateModalOpen(false);
      showToast(`Stock Adjustment ${adjustmentNumber} recorded successfully. Inventory updated.`);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to apply stock adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (tx: InventoryTransaction) => {
    setSelectedTxn(tx);
    const refKey = tx.referenceDoc || tx.id;
    const meta = metaMap[refKey];
    setEditReason(meta?.reason || tx.notes || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Save Edit Reason
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxn) return;
    if (!editReason.trim()) {
      setFormError('Reason is mandatory.');
      return;
    }

    const refKey = selectedTxn.referenceDoc || selectedTxn.id;
    const existing = metaMap[refKey] || {
      currentStock: 0,
      adjustedStock: 0,
      reason: selectedTxn.notes || '',
      type: selectedTxn.qty >= 0 ? 'Increase' : 'Decrease',
      diff: selectedTxn.qty
    };

    saveMeta(refKey, {
      ...existing,
      reason: editReason.trim()
    });

    setIsEditModalOpen(false);
    showToast('Adjustment details updated.');
  };

  // Filtered Adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustmentTxns.filter(tx => {
      const q = searchTerm.toLowerCase();
      const refDoc = tx.referenceDoc || '';
      const prodName = tx.productName || '';
      const notes = tx.notes || '';
      const whName = getWarehouseName(tx.warehouse);

      const matchesSearch =
        !searchTerm ||
        refDoc.toLowerCase().includes(q) ||
        prodName.toLowerCase().includes(q) ||
        notes.toLowerCase().includes(q) ||
        whName.toLowerCase().includes(q);

      const matchesWh =
        warehouseFilter === 'All' ||
        tx.warehouse === warehouseFilter ||
        whName === warehouseFilter;

      const isIncrease = tx.qty > 0;
      const matchesType =
        typeFilter === 'All' ||
        (typeFilter === 'Increase' && isIncrease) ||
        (typeFilter === 'Decrease' && !isIncrease);

      return matchesSearch && matchesWh && matchesType;
    });
  }, [adjustmentTxns, searchTerm, warehouseFilter, typeFilter, warehouses]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = adjustmentTxns.length;
    const totalAdditions = adjustmentTxns
      .filter(tx => tx.qty > 0)
      .reduce((sum, tx) => sum + tx.qty, 0);
    const totalDeductions = adjustmentTxns
      .filter(tx => tx.qty < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.qty), 0);
    const damageCount = adjustmentTxns.filter(tx =>
      /damage|breakage|scrap|spoil|loss|waste/i.test(tx.notes || '')
    ).length;

    return { total, totalAdditions, totalDeductions, damageCount };
  }, [adjustmentTxns]);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Adjustments</span>
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{metrics.total}</div>
          <p className="text-[11px] text-slate-400 font-medium">Recorded manual adjustments</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Stock Additions (+)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600">
            +{metrics.totalAdditions.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">Surplus & found inventory added</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Stock Reductions (-)</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600">
            -{metrics.totalDeductions.toLocaleString()}
          </div>
          <p className="text-[11px] text-rose-600 font-medium">Damage, scrap & write-offs deducted</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Damage & Scrap Logs</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{metrics.damageCount}</div>
          <p className="text-[11px] text-amber-600 font-medium">Incidents logged with damage reason</p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search adjustment #, warehouse, product, or reason..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Warehouse Filter */}
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Increase">Increase (+)</option>
              <option value="Decrease">Decrease (-)</option>
            </select>

            {/* Create Adjustment Button */}
            {isAuthorized && (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Adjustment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stock Adjustment List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3.5">Adjustment Number</th>
                <th className="py-3 px-3.5">Warehouse</th>
                <th className="py-3 px-3.5">Product Name</th>
                <th className="py-3 px-3.5 text-center">Current Stock</th>
                <th className="py-3 px-3.5 text-center">Adjusted Stock</th>
                <th className="py-3 px-3.5 text-center">Difference (+/-)</th>
                <th className="py-3 px-3.5 text-center">Adjustment Type</th>
                <th className="py-3 px-3.5">Adjustment Reason</th>
                <th className="py-3 px-3.5">Adjustment Date</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <SlidersHorizontal className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="font-medium text-slate-600">No stock adjustments found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || warehouseFilter !== 'All' || typeFilter !== 'All'
                        ? 'Try clearing search filters or selecting different criteria.'
                        : 'Click "Create Stock Adjustment" to record a verified inventory adjustment.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((tx, idx) => {
                  const refKey = tx.referenceDoc || tx.id;
                  const meta = metaMap[refKey];
                  const isIncrease = tx.qty > 0;
                  const diffText = isIncrease ? `+${tx.qty}` : `${tx.qty}`;
                  const reasonText = meta?.reason || tx.notes || 'Manual stock adjustment';

                  // Prioritize stored before/after stock from metadata, or compute from current stock
                  const liveStock = getWarehouseStock(tx.warehouse, tx.productId);
                  const beforeStock = meta ? meta.currentStock : liveStock - tx.qty;
                  const afterStock = meta ? meta.adjustedStock : liveStock;
                  const adjNumber = tx.referenceDoc || `ADJ-2026-${String(idx + 1).padStart(4, '0')}`;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Adjustment Number */}
                      <td className="py-3 px-3.5 font-bold font-mono text-blue-600">
                        <button
                          onClick={() => {
                            setSelectedTxn(tx);
                            setIsViewModalOpen(true);
                          }}
                          className="hover:underline cursor-pointer"
                        >
                          {adjNumber}
                        </button>
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-800">{getWarehouseName(tx.warehouse)}</div>
                        {getWarehouseCode(tx.warehouse) && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {getWarehouseCode(tx.warehouse)}
                          </div>
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-900">{tx.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{getProductSku(tx.productId)}</div>
                      </td>

                      {/* Current Stock (Before Adjustment) */}
                      <td className="py-3 px-3.5 text-center font-semibold text-slate-600">
                        {Math.max(0, beforeStock)} {tx.unit || 'Pcs'}
                      </td>

                      {/* Adjusted Stock (After Adjustment) */}
                      <td className="py-3 px-3.5 text-center font-bold text-slate-900">
                        {Math.max(0, afterStock)} {tx.unit || 'Pcs'}
                      </td>

                      {/* Difference (+/-) */}
                      <td className="py-3 px-3.5 text-center font-bold font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            isIncrease
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {diffText} {tx.unit || 'Pcs'}
                        </span>
                      </td>

                      {/* Adjustment Type */}
                      <td className="py-3 px-3.5 text-center">
                        {isIncrease ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <TrendingUp className="w-3 h-3 text-emerald-600" />
                            Increase
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <TrendingDown className="w-3 h-3 text-rose-600" />
                            Decrease
                          </span>
                        )}
                      </td>

                      {/* Adjustment Reason */}
                      <td className="py-3 px-3.5 text-slate-700 max-w-xs truncate" title={reasonText}>
                        <span className="font-medium">{reasonText}</span>
                      </td>

                      {/* Adjustment Date */}
                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        {formatDate(tx.date || tx.createdAt)}
                      </td>

                      {/* Actions: View, Edit */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Action */}
                          <button
                            onClick={() => {
                              setSelectedTxn(tx);
                              setIsViewModalOpen(true);
                            }}
                            title="View Adjustment Details"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Action */}
                          {isAuthorized && (
                            <button
                              onClick={() => handleOpenEdit(tx)}
                              title="Edit Reason / Notes"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STOCK ADJUSTMENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Stock Adjustment"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Adjustment Number Banner */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                Adjustment Number
              </span>
              <span className="text-sm font-bold font-mono text-blue-600">
                {generateAdjustmentNumber()} (Auto-Generated)
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                Adjustment Date
              </span>
              <span className="text-xs font-semibold text-slate-800">{adjustmentDate}</span>
            </div>
          </div>

          {/* Warehouse & Product Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWarehouseId}
                onChange={e => handleWarehouseChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {activeWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={e => handleProductChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || 'No SKU'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Stock & Adjustment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Warehouse Stock
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                {currentFormStock}{' '}
                <span className="text-slate-500 font-normal">
                  {products.find(p => p.id === selectedProductId)?.primaryUnit || 'Pcs'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adjustment Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeToggle('Increase')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustmentType === 'Increase'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Increase (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeToggle('Decrease')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    adjustmentType === 'Decrease'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Decrease (-)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quantity & Adjusted Stock Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adjustment Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={e => handleQuantityChange(e.target.value)}
                placeholder="Enter qty to adjust"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Adjusted Stock
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={adjustedStockInput}
                onChange={e => handleAdjustedStockInputChange(e.target.value)}
                placeholder="Resulting stock"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Real-Time Preview Card */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Stock Before</span>
              <span className="font-bold text-slate-800">{currentFormStock}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Difference</span>
              <span
                className={`font-bold font-mono ${
                  adjustmentType === 'Increase' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {adjustmentType === 'Increase' ? `+${quantity || 0}` : `-${quantity || 0}`}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">Adjusted Stock</span>
              <span className="font-bold text-blue-600">{adjustedStockInput || 0}</span>
            </div>
          </div>

          {/* Reason Field (Mandatory) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Adjustment Reason <span className="text-rose-500">* (Mandatory)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Required for audit tracking</span>
            </div>
            <input
              type="text"
              value={adjustmentReason}
              onChange={e => setAdjustmentReason(e.target.value)}
              placeholder="e.g. Broken in transit, Discrepancy during physical count..."
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />

            {/* Quick Reason Chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {quickReasons.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAdjustmentReason(preset)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    adjustmentReason === preset
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !adjustmentReason.trim() || parseFloat(quantity) <= 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Adjustment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Update Inventory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW ADJUSTMENT MODAL */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Stock Adjustment Details"
        size="lg"
      >
        {selectedTxn && (() => {
          const refKey = selectedTxn.referenceDoc || selectedTxn.id;
          const meta = metaMap[refKey];
          const isIncrease = selectedTxn.qty > 0;
          const adjNumber = selectedTxn.referenceDoc || `ADJ-2026-${selectedTxn.id.slice(-4)}`;
          const reasonText = meta?.reason || selectedTxn.notes || 'Manual stock adjustment';
          const liveStock = getWarehouseStock(selectedTxn.warehouse, selectedTxn.productId);
          const beforeStock = meta ? meta.currentStock : liveStock - selectedTxn.qty;
          const afterStock = meta ? meta.adjustedStock : liveStock;

          return (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Adjustment Number
                  </span>
                  <span className="text-base font-bold font-mono text-blue-600">{adjNumber}</span>
                </div>
                <div>
                  {isIncrease ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      Increase (+)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      Decrease (-)
                    </span>
                  )}
                </div>
              </div>

              {/* Product and Warehouse Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Warehouse</span>
                  <span className="font-bold text-slate-900 block">{getWarehouseName(selectedTxn.warehouse)}</span>
                  {getWarehouseCode(selectedTxn.warehouse) && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {getWarehouseCode(selectedTxn.warehouse)}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Product</span>
                  <span className="font-bold text-slate-900 block">{selectedTxn.productName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {getProductSku(selectedTxn.productId)}
                  </span>
                </div>
              </div>

              {/* Stock Movement Preview */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Current Stock</span>
                  <span className="text-sm font-bold text-slate-800">
                    {Math.max(0, beforeStock)} {selectedTxn.unit || 'Pcs'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Difference</span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      isIncrease ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isIncrease ? `+${selectedTxn.qty}` : selectedTxn.qty} {selectedTxn.unit || 'Pcs'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Adjusted Stock</span>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.max(0, afterStock)} {selectedTxn.unit || 'Pcs'}
                  </span>
                </div>
              </div>

              {/* Reason Card */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Adjustment Reason (Mandatory Audit)
                </span>
                <p className="text-xs font-semibold text-slate-800">{reasonText}</p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Date</span>
                  <span className="font-semibold text-slate-700">
                    {formatDate(selectedTxn.date || selectedTxn.createdAt)}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Recorded By</span>
                  <span className="font-semibold text-slate-700">
                    {meta?.recordedBy || profile?.full_name || 'Authorized Staff'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* EDIT ADJUSTMENT REASON MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Adjustment Reason"
        size="md"
      >
        {selectedTxn && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <span className="text-xs text-slate-500 block">Adjustment Voucher</span>
              <span className="text-sm font-bold font-mono text-blue-600">
                {selectedTxn.referenceDoc || `ADJ-2026-${selectedTxn.id.slice(-4)}`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adjustment Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Save Reason
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
});
