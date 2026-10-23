import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle,
  Truck,
  Building,
  Clock,
  ArrowRight,
  Package,
  Loader2,
  Search,
  Filter,
  Eye,
  XCircle,
  AlertTriangle,
  FileText,
  Calendar,
  Trash2,
  Check,
  Ban,
  User,
  ShieldCheck,
  Boxes,
  HelpCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { StockTransfer, StockTransferItem, TransferStatus } from '../../types';
import { Modal } from '../../components/common/Modal';

interface TransferLineForm {
  productId: string;
  productName: string;
  qty: number | string;
  unit: string;
  availableStock: number;
}

export const StockTransfersPage: React.FC = () => {
  const {
    stockTransfers,
    warehouses,
    products,
    createStockTransfer,
    updateTransferStatus,
    getWarehouseStock
  } = useERP();

  // Active warehouses only for transfers
  const activeWarehouses = useMemo(() => {
    return warehouses.filter(w => w.isActive ?? true);
  }, [warehouses]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Transfer Form State
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceDoc, setReferenceDoc] = useState('');
  const [notes, setNotes] = useState('');
  const [transferLines, setTransferLines] = useState<TransferLineForm[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const srcWh = activeWarehouses[0]?.id || '';
    const otherWh = activeWarehouses.find(w => w.id !== srcWh);
    const destWh = otherWh ? otherWh.id : (activeWarehouses[0]?.id || '');
    setFromWarehouseId(srcWh);
    setToWarehouseId(destWh);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setReferenceDoc('');
    setNotes('');
    setFormError(null);

    // Initial first line
    if (products.length > 0 && srcWh) {
      const p = products[0];
      const avail = getWarehouseStock(srcWh, p.id);
      setTransferLines([
        {
          productId: p.id,
          productName: p.name,
          qty: 0,
          unit: p.primaryUnit || 'Pcs',
          availableStock: avail
        }
      ]);
    } else {
      setTransferLines([]);
    }

    setIsCreateModalOpen(true);
  };

  // Change source warehouse in form
  const handleSourceWarehouseChange = (newSrcId: string) => {
    setFromWarehouseId(newSrcId);
    if (toWarehouseId === newSrcId) {
      const nextDest = activeWarehouses.find(w => w.id !== newSrcId);
      if (nextDest) setToWarehouseId(nextDest.id);
    }
    // Update available stocks for existing line items
    setTransferLines(prev =>
      prev.map(line => ({
        ...line,
        availableStock: getWarehouseStock(newSrcId, line.productId)
      }))
    );
  };

  // Add line item to transfer
  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const existingIds = new Set(transferLines.map(l => l.productId));
    const nextProduct = products.find(p => !existingIds.has(p.id)) || products[0];
    const avail = getWarehouseStock(fromWarehouseId, nextProduct.id);

    setTransferLines(prev => [
      ...prev,
      {
        productId: nextProduct.id,
        productName: nextProduct.name,
        qty: 0,
        unit: nextProduct.primaryUnit || 'Pcs',
        availableStock: avail
      }
    ]);
  };

  // Update line item product
  const handleLineProductChange = (index: number, newProdId: string) => {
    const p = products.find(item => item.id === newProdId);
    if (!p) return;
    const avail = getWarehouseStock(fromWarehouseId, p.id);

    setTransferLines(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: p.id,
        productName: p.name,
        unit: p.primaryUnit || 'Pcs',
        availableStock: avail
      };
      return copy;
    });
  };

  // Update line item quantity
  const handleLineQtyChange = (index: number, rawVal: string | number) => {
    setTransferLines(prev => {
      const copy = [...prev];
      if (rawVal === '') {
        copy[index].qty = '';
      } else {
        const valStr = String(rawVal);
        // Strip leading zeros if followed by other digits (e.g., "05" -> "5")
        const cleaned = valStr.replace(/^0+(?=\d)/, '');
        if (cleaned === '') {
          copy[index].qty = '';
        } else {
          const num = parseFloat(cleaned);
          if (!isNaN(num) && num >= 0) {
            copy[index].qty = cleaned.endsWith('.') ? cleaned : num;
          }
        }
      }
      return copy;
    });
  };

  // Remove line item
  const handleRemoveLineItem = (index: number) => {
    setTransferLines(prev => prev.filter((_, i) => i !== index));
  };

  // Submit new transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fromWarehouseId || !toWarehouseId) {
      setFormError('Please select both source and destination warehouses.');
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      setFormError('Source warehouse and Destination warehouse must be distinct locations.');
      return;
    }

    if (transferLines.length === 0) {
      setFormError('Please add at least one product item to transfer.');
      return;
    }

    // Validate quantities and stock
    for (const line of transferLines) {
      const qtyNum = Number(line.qty);
      if (!qtyNum || qtyNum <= 0) {
        setFormError(`Quantity for product "${line.productName}" must be greater than zero.`);
        return;
      }
      if (qtyNum > line.availableStock) {
        setFormError(
          `Transfer quantity for "${line.productName}" (${qtyNum} ${line.unit}) exceeds available stock at source warehouse (${line.availableStock} ${line.unit}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Find source & destination warehouse names/codes
      const srcWh = warehouses.find(w => w.id === fromWarehouseId);
      const destWh = warehouses.find(w => w.id === toWarehouseId);

      // Safe transfer sequence generation
      let maxSeq = 1000;
      stockTransfers.forEach(t => {
        const match = (t.transferNumber || '').match(/TRF-.*?(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      const transferNumber = `TRF-2026-${maxSeq + 1}`;

      const items: StockTransferItem[] = transferLines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        qty: Number(l.qty),
        unit: l.unit
      }));

      await createStockTransfer({
        transferNumber,
        date: transferDate,
        fromWarehouse: srcWh?.name || srcWh?.code || fromWarehouseId,
        fromWarehouseId: fromWarehouseId,
        toWarehouse: destWh?.name || destWh?.code || toWarehouseId,
        toWarehouseId: toWarehouseId,
        items,
        status: 'Requested',
        referenceDoc: referenceDoc.trim() || undefined,
        notes: notes.trim() || `Inter-warehouse transfer from ${srcWh?.name} to ${destWh?.name}`
      });

      setIsCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create stock transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transitions
  const handleStatusTransition = async (transferId: string, nextStatus: TransferStatus) => {
    setActionLoadingId(transferId);
    try {
      await updateTransferStatus(transferId, nextStatus);
      if (selectedTransfer && selectedTransfer.id === transferId) {
        setSelectedTransfer(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err: any) {
      alert(`Status transition error: ${err?.message || 'Failed to update transfer status'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Transfer Details Modal
  const handleOpenDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsDetailsModalOpen(true);
  };

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return stockTransfers.filter(t => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        t.transferNumber.toLowerCase().includes(search) ||
        t.fromWarehouse.toLowerCase().includes(search) ||
        t.toWarehouse.toLowerCase().includes(search) ||
        (t.referenceDoc && t.referenceDoc.toLowerCase().includes(search)) ||
        t.items.some(i => i.productName.toLowerCase().includes(search));

      // Status
      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

      // Warehouse
      const matchesWarehouse =
        warehouseFilter === 'All' ||
        t.fromWarehouseId === warehouseFilter ||
        t.toWarehouseId === warehouseFilter ||
        t.fromWarehouse === warehouseFilter ||
        t.toWarehouse === warehouseFilter;

      // Date range
      let matchesDate = true;
      if (startDate && t.date < startDate) matchesDate = false;
      if (endDate && t.date > endDate) matchesDate = false;

      return matchesSearch && matchesStatus && matchesWarehouse && matchesDate;
    });
  }, [stockTransfers, searchTerm, statusFilter, warehouseFilter, startDate, endDate]);

  // Aggregate transfer stats
  const transferStats = useMemo(() => {
    const total = stockTransfers.length;
    const requested = stockTransfers.filter(t => t.status === 'Requested').length;
    const inTransit = stockTransfers.filter(t => t.status === 'Sent').length;
    const completed = stockTransfers.filter(t => t.status === 'Received').length;
    return { total, requested, inTransit, completed };
  }, [stockTransfers]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Stock Transfer Management
                <span className="text-xs px-2.5 py-0.5 font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                  {stockTransfers.length} Transfers
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch, track, approve, and receive inventory between warehouses with in-transit stock controls.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Transfer Orders</span>
            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{transferStats.total}</div>
          <p className="text-[11px] text-slate-500">All recorded movements</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{transferStats.requested}</div>
          <p className="text-[11px] text-slate-500">Awaiting manager authorization</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">In-Transit Shipments</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{transferStats.inTransit}</div>
          <p className="text-[11px] text-indigo-600 font-medium">Dispatched, pending receiving</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Completed Transfers</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{transferStats.completed}</div>
          <p className="text-[11px] text-slate-500">Stock successfully settled</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by transfer #, ref document, warehouse, or product..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="All">All Transfer Statuses</option>
              <option value="Requested">1. Requested</option>
              <option value="Approved">2. Approved</option>
              <option value="Sent">3. Sent (In-Transit)</option>
              <option value="Received">4. Received (Settled)</option>
              <option value="Cancelled">Cancelled / Rejected</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="All">All Warehouses (Route)</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date Filter:
          </span>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-400">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-400">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          {(startDate || endDate || statusFilter !== 'All' || warehouseFilter !== 'All' || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setWarehouseFilter('All');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredTransfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Stock Transfers Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No transfer orders match the selected criteria. Transfer inventory between warehouses to keep stock balances synchronized.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Transfer</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Route (Source → Destination)</th>
                  <th className="py-3 px-4">Dispatched Items</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Created / Approved</th>
                  <th className="py-3 px-4 text-right">Workflow Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map(trf => {
                  const isLoading = actionLoadingId === trf.id;

                  return (
                    <tr key={trf.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Transfer # */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(trf)}
                            className="font-mono font-bold text-blue-600 hover:underline hover:text-blue-800 text-left"
                          >
                            {trf.transferNumber}
                          </button>
                          {trf.referenceDoc && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-mono">
                              Ref: {trf.referenceDoc}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDate(trf.date)}
                      </td>

                      {/* Route */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 flex-wrap">
                          <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                            {trf.fromWarehouse}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-200/60">
                            {trf.toWarehouse}
                          </span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 max-w-[240px]">
                          {trf.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="text-slate-800 font-semibold truncate flex items-center justify-between gap-2">
                              <span>{item.productName}</span>
                              <span className="text-indigo-600 font-bold shrink-0">
                                {item.qty} {item.unit}
                              </span>
                            </div>
                          ))}
                          {trf.items.length > 2 && (
                            <div className="text-[10px] text-slate-500 italic">
                              +{trf.items.length - 2} more product(s)...
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <StatusBadge status={trf.status} size="sm" />
                      </td>

                      {/* Created / Approved by */}
                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        <div>By: {trf.createdBy || 'Staff'}</div>
                        {trf.approvedBy && (
                          <div className="text-emerald-600 font-medium">Appr: {trf.approvedBy}</div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            onClick={() => handleOpenDetails(trf)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Transfer Details & Audit History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Stage progression workflows */}
                          {trf.status === 'Requested' && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Approved')}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                              >
                                {isLoading ? '...' : 'Approve'}
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Cancelled')}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Reject / Cancel"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {trf.status === 'Approved' && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Sent')}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                <Truck className="w-3 h-3" />
                                <span>{isLoading ? '...' : 'Dispatch (Sent)'}</span>
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Cancelled')}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Cancel Transfer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {trf.status === 'Sent' && (
                            <>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Received')}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                                <span>{isLoading ? '...' : 'Confirm Received'}</span>
                              </button>
                              <button
                                disabled={isLoading}
                                onClick={() => handleStatusTransition(trf.id, 'Cancelled')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-semibold transition-colors"
                                title="Revert dispatch back to source warehouse"
                              >
                                Revert
                              </button>
                            </>
                          )}

                          {trf.status === 'Received' && (
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Received
                            </span>
                          )}

                          {trf.status === 'Cancelled' && (
                            <span className="text-[11px] text-slate-400 font-medium">Cancelled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Stock Transfer Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initiate Inter-Warehouse Stock Transfer"
        subtitle="Transfer goods between locations with real-time source stock verification"
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateTransfer}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Transfer...</span>
                </>
              ) : (
                <span>Request Transfer Order</span>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Route: Source & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Source Warehouse (From) <span className="text-rose-500">*</span>
              </label>
              <select
                value={fromWarehouseId}
                onChange={e => handleSourceWarehouseChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
              >
                {activeWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code}) {w.isDefault ? '— Primary Hub' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Stock will be deducted from this location upon dispatch.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Destination Warehouse (To) <span className="text-rose-500">*</span>
              </label>
              <select
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800"
              >
                {activeWarehouses.map(w => (
                  <option key={w.id} value={w.id} disabled={w.id === fromWarehouseId}>
                    {w.name} ({w.code}) {w.id === fromWarehouseId ? '(Source)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Stock will be credited to this location upon receiving.</p>
            </div>
          </div>

          {/* Transfer Date & Reference Document */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transfer Date</label>
              <input
                type="date"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reference Document / E-Way Bill (Optional)</label>
              <input
                type="text"
                value={referenceDoc}
                onChange={e => setReferenceDoc(e.target.value)}
                placeholder="e.g. DC-2026-0042 / EWB-884920"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Multi-Product Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 block">Transfer Items & Quantities</label>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Available in Source</th>
                    <th className="py-2.5 px-3 text-right">Transfer Qty</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {transferLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {/* Product Selector */}
                      <td className="py-2 px-3">
                        <select
                          value={line.productId}
                          onChange={e => handleLineProductChange(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Live Available Stock */}
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        <span
                          className={
                            line.availableStock <= 0
                              ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded'
                              : 'text-slate-700'
                          }
                        >
                          {line.availableStock} {line.unit}
                        </span>
                      </td>

                      {/* Transfer Quantity */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={line.availableStock}
                          value={line.qty}
                          onFocus={e => {
                            if (line.qty === 0 || line.qty === '0') {
                              handleLineQtyChange(idx, '');
                            } else {
                              e.target.select();
                            }
                          }}
                          onBlur={() => {
                            if (line.qty === '' || isNaN(Number(line.qty))) {
                              handleLineQtyChange(idx, 0);
                            }
                          }}
                          onChange={e => handleLineQtyChange(idx, e.target.value)}
                          placeholder="0"
                          className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-3 font-medium text-slate-500">{line.unit}</td>

                      {/* Remove Button */}
                      <td className="py-2 px-2 text-center">
                        {transferLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove Line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transfer Notes / Reason</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Stock replenishment for weekend sales demand"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>
        </form>
      </Modal>

      {/* Transfer Details & Audit Timeline Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Stock Transfer: ${selectedTransfer?.transferNumber || ''}`}
        subtitle={`Requested Date: ${selectedTransfer ? formatDate(selectedTransfer.date) : ''}`}
        size="lg"
        footer={
          selectedTransfer ? (
            <div className="flex items-center w-full">
              <StatusBadge status={selectedTransfer.status} size="sm" />
            </div>
          ) : null
        }
      >
        {selectedTransfer && (
          <div className="space-y-4 text-xs">
            {/* Route & Doc Info */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatch Route</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold text-slate-900">{selectedTransfer.fromWarehouse}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-blue-700">{selectedTransfer.toWarehouse}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference Doc</span>
                <span className="font-mono text-slate-800 font-semibold block mt-1">
                  {selectedTransfer.referenceDoc || 'None provided'}
                </span>
              </div>
            </div>

            {/* Workflow Progression Timeline */}
            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Audit Progression Timeline</span>
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                {/* 1. Requested */}
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-blue-600">1. Requested</div>
                  <div className="text-[11px] font-semibold text-slate-800 mt-1">
                    {selectedTransfer.createdBy || 'Staff'}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatDate(selectedTransfer.date)}</div>
                </div>

                {/* 2. Approved */}
                <div
                  className={`p-2 rounded-lg border ${
                    selectedTransfer.status === 'Approved' ||
                    selectedTransfer.status === 'Sent' ||
                    selectedTransfer.status === 'Received'
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-white border-slate-200 opacity-60'
                  }`}
                >
                  <div className="text-[10px] font-bold text-blue-700">2. Approved</div>
                  <div className="text-[11px] font-semibold text-slate-800 mt-1">
                    {selectedTransfer.approvedBy || (selectedTransfer.status !== 'Requested' ? 'Authorized' : 'Pending')}
                  </div>
                </div>

                {/* 3. Sent */}
                <div
                  className={`p-2 rounded-lg border ${
                    selectedTransfer.status === 'Sent' || selectedTransfer.status === 'Received'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200 opacity-60'
                  }`}
                >
                  <div className="text-[10px] font-bold text-amber-700">3. Dispatched</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {selectedTransfer.sentDate ? formatDate(selectedTransfer.sentDate) : 'Source Stock Deducted'}
                  </div>
                </div>

                {/* 4. Received */}
                <div
                  className={`p-2 rounded-lg border ${
                    selectedTransfer.status === 'Received'
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-white border-slate-200 opacity-60'
                  }`}
                >
                  <div className="text-[10px] font-bold text-emerald-700">4. Received</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {selectedTransfer.receivedDate ? formatDate(selectedTransfer.receivedDate) : 'Destination Stock Added'}
                  </div>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Transfer Qty</th>
                    <th className="py-2.5 px-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedTransfer.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.productName}</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-700">{item.qty}</td>
                      <td className="py-2 px-3 text-slate-600">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedTransfer.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                <span className="font-semibold text-slate-700 block mb-0.5">Notes:</span>
                {selectedTransfer.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
