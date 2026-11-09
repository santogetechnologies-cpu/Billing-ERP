import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Trash2,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { StockTransfer, StockTransferItem } from '../../types';
import { Modal } from '../common/Modal';
import { formatDate } from '../../utils/formatters';

interface TransferLineItemForm {
  productId: string;
  productName: string;
  qty: number | string;
  unit: string;
  availableStock: number;
}

export interface WarehouseStockTransfersTabRef {
  openCreateModal: () => void;
}

export interface WarehouseStockTransfersTabProps {
  triggerCreate?: number;
}

export const WarehouseStockTransfersTab = React.forwardRef<
  WarehouseStockTransfersTabRef,
  WarehouseStockTransfersTabProps
>(({ triggerCreate }, ref) => {
  const { profile } = useAuth();
  const {
    stockTransfers = [],
    warehouses = [],
    products = [],
    createStockTransfer,
    updateTransferStatus,
    getWarehouseStock
  } = useERP();

  const isAuthorized =
    profile?.role === 'Owner' ||
    profile?.role === 'Admin' ||
    profile?.role === 'Warehouse Manager' ||
    profile?.role === 'Purchase Manager';

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [destFilter, setDestFilter] = useState<string>('All');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create Form State
  const activeWarehouses = useMemo(() => {
    return warehouses.filter(w => w.isActive ?? true);
  }, [warehouses]);

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferReason, setTransferReason] = useState('Stock Replenishment');
  const [transferStatus, setTransferStatus] = useState<StockTransfer['status']>('Completed');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [lines, setLines] = useState<TransferLineItemForm[]>([]);

  // Edit Form State
  const [editStatus, setEditStatus] = useState<StockTransfer['status']>('Pending');
  const [editNotes, setEditNotes] = useState('');
  const [editRefDoc, setEditRefDoc] = useState('');

  // Auto-generate next Transfer Number
  const generateTransferNumber = (): string => {
    let maxSeq = 1000;
    stockTransfers.forEach(t => {
      const match = (t.transferNumber || '').match(/TRF-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    return `TRF-2026-${maxSeq + 1}`;
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

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const src = activeWarehouses[0]?.id || '';
    const dst = activeWarehouses.find(w => w.id !== src)?.id || activeWarehouses[1]?.id || '';
    setFromWarehouseId(src);
    setToWarehouseId(dst);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferReason('Stock Replenishment');
    setTransferStatus('Completed');
    setReferenceDoc('');
    setFormError(null);

    if (products.length > 0 && src) {
      const firstProd = products[0];
      const avail = getWarehouseStock(src, firstProd.id);
      setLines([
        {
          productId: firstProd.id,
          productName: firstProd.name,
          qty: avail > 0 ? 1 : 0,
          unit: firstProd.primaryUnit || 'Pcs',
          availableStock: avail
        }
      ]);
    } else {
      setLines([]);
    }

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

  // When source warehouse changes in form
  const handleSourceWarehouseChange = (newSrcId: string) => {
    setFromWarehouseId(newSrcId);
    if (toWarehouseId === newSrcId) {
      const nextDest = activeWarehouses.find(w => w.id !== newSrcId);
      if (nextDest) setToWarehouseId(nextDest.id);
    }
    // Update available stock for current lines
    setLines(prev =>
      prev.map(line => ({
        ...line,
        availableStock: getWarehouseStock(newSrcId, line.productId)
      }))
    );
  };

  // Change product in a line
  const handleLineProductChange = (index: number, newProdId: string) => {
    const p = products.find(prod => prod.id === newProdId);
    if (!p) return;
    const avail = getWarehouseStock(fromWarehouseId, p.id);
    setLines(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: p.id,
        productName: p.name,
        unit: p.primaryUnit || 'Pcs',
        availableStock: avail,
        qty: avail > 0 && Number(copy[index].qty) === 0 ? 1 : copy[index].qty
      };
      return copy;
    });
  };

  // Change qty in a line
  const handleLineQtyChange = (index: number, val: string) => {
    const num = parseFloat(val);
    setLines(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        qty: val === '' ? '' : isNaN(num) ? 0 : num
      };
      return copy;
    });
  };

  // Add line
  const handleAddLine = () => {
    if (products.length === 0) return;
    const existingIds = new Set(lines.map(l => l.productId));
    const nextProd = products.find(p => !existingIds.has(p.id)) || products[0];
    const avail = getWarehouseStock(fromWarehouseId, nextProd.id);
    setLines(prev => [
      ...prev,
      {
        productId: nextProd.id,
        productName: nextProd.name,
        qty: avail > 0 ? 1 : 0,
        unit: nextProd.primaryUnit || 'Pcs',
        availableStock: avail
      }
    ]);
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Create Stock Transfer
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fromWarehouseId || !toWarehouseId) {
      setFormError('Please select both source and destination warehouses.');
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      setFormError('Source warehouse and Destination warehouse must be different.');
      return;
    }

    if (lines.length === 0) {
      setFormError('Please add at least one product to transfer.');
      return;
    }

    // Critical validation: Quantity must be > 0 and cannot exceed available stock
    for (const line of lines) {
      const qtyNum = Number(line.qty);
      if (!qtyNum || qtyNum <= 0) {
        setFormError(`Transfer quantity for "${line.productName}" must be greater than zero.`);
        return;
      }
      if (qtyNum > line.availableStock) {
        setFormError(
          `Insufficient stock: Transfer quantity for "${line.productName}" (${qtyNum} ${line.unit}) exceeds available stock in source warehouse (${line.availableStock} ${line.unit}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const srcWh = warehouses.find(w => w.id === fromWarehouseId);
      const destWh = warehouses.find(w => w.id === toWarehouseId);
      const transferNumber = generateTransferNumber();

      const items: StockTransferItem[] = lines.map(l => {
        const prod = products.find(p => p.id === l.productId);
        return {
          productId: l.productId,
          productName: l.productName,
          sku: prod?.sku || prod?.code || '',
          qty: Number(l.qty),
          unit: l.unit
        };
      });

      await createStockTransfer({
        transferNumber,
        date: transferDate,
        fromWarehouse: srcWh?.name || srcWh?.code || fromWarehouseId,
        fromWarehouseId,
        toWarehouse: destWh?.name || destWh?.code || toWarehouseId,
        toWarehouseId,
        items,
        status: transferStatus,
        referenceDoc: referenceDoc.trim() || undefined,
        notes: transferReason.trim() || `Transfer from ${srcWh?.name} to ${destWh?.name}`
      });

      setIsCreateModalOpen(false);
      showToast(`Stock transfer ${transferNumber} created successfully.`);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create stock transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setEditStatus(transfer.status);
    setEditNotes(transfer.notes || '');
    setEditRefDoc(transfer.referenceDoc || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer || isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editStatus !== selectedTransfer.status) {
        await updateTransferStatus(selectedTransfer.id, editStatus);
      }
      setIsEditModalOpen(false);
      showToast(`Transfer ${selectedTransfer.transferNumber} updated successfully.`);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Cancel Confirmation
  const handleOpenCancelConfirm = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsCancelConfirmOpen(true);
  };

  // Execute Cancel Transfer
  const handleConfirmCancel = async () => {
    if (!selectedTransfer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateTransferStatus(selectedTransfer.id, 'Cancelled');
      setIsCancelConfirmOpen(false);
      showToast(`Transfer ${selectedTransfer.transferNumber} has been cancelled.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered transfers list
  const filteredTransfers = useMemo(() => {
    return stockTransfers
      .filter(t => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          t.transferNumber?.toLowerCase().includes(q) ||
          t.fromWarehouse?.toLowerCase().includes(q) ||
          t.toWarehouse?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.referenceDoc?.toLowerCase().includes(q) ||
          (t.items || []).some(item => item.productName?.toLowerCase().includes(q));

        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        const matchesSource =
          sourceFilter === 'All' ||
          t.fromWarehouseId === sourceFilter ||
          t.fromWarehouse === sourceFilter;
        const matchesDest =
          destFilter === 'All' ||
          t.toWarehouseId === destFilter ||
          t.toWarehouse === destFilter;

        return matchesSearch && matchesStatus && matchesSource && matchesDest;
      })
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [stockTransfers, searchTerm, statusFilter, sourceFilter, destFilter]);

  // Metric summaries
  const metrics = useMemo(() => {
    const total = stockTransfers.length;
    const completed = stockTransfers.filter(t => t.status === 'Completed').length;
    const inTransit = stockTransfers.filter(t => t.status === 'In Transit' || t.status === 'Sent').length;
    const pending = stockTransfers.filter(t => t.status === 'Pending' || t.status === 'Requested').length;
    const totalUnits = stockTransfers
      .filter(t => t.status === 'Completed')
      .reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0), 0);

    return { total, completed, inTransit, pending, totalUnits };
  }, [stockTransfers]);

  // Status badge styling
  const renderStatusBadge = (status: StockTransfer['status']) => {
    switch (status) {
      case 'Completed':
      case 'Received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'In Transit':
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3 h-3 text-blue-600" />
            In Transit
          </span>
        );
      case 'Cancelled':
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      case 'Pending':
      case 'Requested':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending
          </span>
        );
    }
  };

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
            <span className="text-xs font-medium">Total Transfers</span>
            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{metrics.total}</div>
          <p className="text-[11px] text-slate-400 font-medium">Inter-warehouse shipments</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Completed Transfers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600">{metrics.completed}</div>
          <p className="text-[11px] text-emerald-600 font-medium">Inventory updated successfully</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">In Transit / Pending</span>
            <Truck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600">
            {metrics.inTransit + metrics.pending}
          </div>
          <p className="text-[11px] text-blue-600 font-medium">{metrics.inTransit} on road, {metrics.pending} pending</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Transferred Units</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {metrics.totalUnits.toLocaleString()}
          </div>
          <p className="text-[11px] text-purple-600 font-medium">Total stock units relocated</p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search transfer #, warehouse, product, or reason..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In Transit">In Transit</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Source Warehouse Filter */}
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Source Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  From: {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stock Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-3.5 text-left w-[15%]">Transfer Number</th>
                <th className="py-3.5 px-3.5 text-left w-[22%]">Source Warehouse</th>
                <th className="py-3.5 px-3.5 text-left w-[22%]">Destination Warehouse</th>
                <th className="py-3.5 px-2 text-center w-[13%]">No of Products</th>
                <th className="py-3.5 px-2 text-center w-[12%]">Transfer Date</th>
                <th className="py-3.5 px-2 text-center w-[10%]">Transfer Status</th>
                <th className="py-3.5 px-3.5 text-right w-[6%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="font-medium text-slate-600">No stock transfers found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || statusFilter !== 'All'
                        ? 'Try clearing search filters or search criteria.'
                        : 'Click "Create Stock Transfer" to initiate an inter-warehouse stock transfer.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map(trf => {
                  const productCount = trf.items?.length || 0;

                  return (
                    <tr
                      key={trf.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Transfer Number */}
                      <td className="py-3 px-3.5 font-bold font-mono text-blue-600 align-middle truncate">
                        <button
                          onClick={() => {
                            setSelectedTransfer(trf);
                            setIsViewModalOpen(true);
                          }}
                          className="hover:underline cursor-pointer truncate"
                          title={trf.transferNumber}
                        >
                          {trf.transferNumber}
                        </button>
                      </td>

                      {/* Source Warehouse */}
                      <td className="py-3 px-3.5 align-middle truncate">
                        <div className="font-semibold text-slate-800 truncate" title={getWarehouseName(trf.fromWarehouse)}>
                          {getWarehouseName(trf.fromWarehouse)}
                        </div>
                        {getWarehouseCode(trf.fromWarehouse) && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {getWarehouseCode(trf.fromWarehouse)}
                          </div>
                        )}
                      </td>

                      {/* Destination Warehouse */}
                      <td className="py-3 px-3.5 align-middle truncate">
                        <div className="font-semibold text-slate-800 truncate" title={getWarehouseName(trf.toWarehouse)}>
                          {getWarehouseName(trf.toWarehouse)}
                        </div>
                        {getWarehouseCode(trf.toWarehouse) && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {getWarehouseCode(trf.toWarehouse)}
                          </div>
                        )}
                      </td>

                      {/* No of Products */}
                      <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                          title={trf.items?.map(i => `${i.productName} (${i.qty} ${i.unit || 'Pcs'})`).join(', ')}
                        >
                          {productCount} {productCount === 1 ? 'Product' : 'Products'}
                        </span>
                      </td>

                      {/* Transfer Date */}
                      <td className="py-3 px-2 text-center text-slate-600 whitespace-nowrap align-middle text-[11px]">
                        {formatDate(trf.date || trf.createdAt)}
                      </td>

                      {/* Transfer Status */}
                      <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                        {renderStatusBadge(trf.status)}
                      </td>

                      {/* Actions: View, Edit, Cancel */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Action */}
                          <button
                            onClick={() => {
                              setSelectedTransfer(trf);
                              setIsViewModalOpen(true);
                            }}
                            title="View Transfer Details"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Action */}
                          {isAuthorized && (
                            <button
                              onClick={() => handleOpenEdit(trf)}
                              title="Edit Transfer"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel Action */}
                          {isAuthorized && trf.status !== 'Cancelled' && (
                            <button
                              onClick={() => handleOpenCancelConfirm(trf)}
                              title="Cancel Transfer"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
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

      {/* CREATE STOCK TRANSFER MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Stock Transfer"
        size="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Transfer Info Header */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider block">
                Transfer Voucher Number
              </span>
              <span className="text-sm font-bold font-mono text-blue-600">
                {generateTransferNumber()} (Auto-Generated)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status:</span>
              <select
                value={transferStatus}
                onChange={e => setTransferStatus(e.target.value as any)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="Completed">Completed (Immediate Stock Movement)</option>
                <option value="In Transit">In Transit</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Source and Destination Warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={fromWarehouseId}
                onChange={e => handleSourceWarehouseChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {activeWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-0.5">Stock will be deducted from here.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {activeWarehouses
                  .filter(w => w.id !== fromWarehouseId)
                  .map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-0.5">Stock will be added here upon completion.</p>
            </div>
          </div>

          {/* Transfer Date & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                placeholder="e.g. Stock Replenishment, Rebalancing, Branch Request"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Products & Stock Line Items */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Products & Quantities
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const isOverStock = Number(line.qty) > line.availableStock;

                return (
                  <div
                    key={idx}
                    className={`p-3 bg-white border rounded-xl space-y-2 ${
                      isOverStock ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      {/* Product Selector */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                          Product Name
                        </label>
                        <select
                          value={line.productId}
                          onChange={e => handleLineProductChange(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku || 'No SKU'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Available Stock */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                          Available Stock
                        </label>
                        <div className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                          {line.availableStock} {line.unit}
                        </div>
                      </div>

                      {/* Transfer Quantity */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                          Transfer Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={line.availableStock}
                          value={line.qty}
                          onChange={e => handleLineQtyChange(idx, e.target.value)}
                          placeholder="Qty"
                          className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold ${
                            isOverStock
                              ? 'border-rose-400 text-rose-600 focus:border-rose-500'
                              : 'border-slate-200 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="sm:col-span-1 flex justify-end">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stock Alert Warning if Exceeded */}
                    {isOverStock && (
                      <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Transfer quantity exceeds available stock ({line.availableStock} {line.unit}). Transfers are prevented when sufficient stock is unavailable.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || lines.some(l => Number(l.qty) > l.availableStock || Number(l.qty) <= 0)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Transfer Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW TRANSFER MODAL */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Stock Transfer Details"
        size="lg"
      >
        {selectedTransfer && (
          <div className="space-y-4">
            {/* Header Voucher Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Voucher Number
                </span>
                <span className="text-base font-bold font-mono text-blue-600">
                  {selectedTransfer.transferNumber}
                </span>
              </div>
              <div>{renderStatusBadge(selectedTransfer.status)}</div>
            </div>

            {/* From -> To Hub Route */}
            <div className="grid grid-cols-2 gap-3 items-center bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
              <div>
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Source Warehouse
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {getWarehouseName(selectedTransfer.fromWarehouse)}
                </span>
                {getWarehouseCode(selectedTransfer.fromWarehouse) && (
                  <span className="text-xs text-slate-500 font-mono block">
                    {getWarehouseCode(selectedTransfer.fromWarehouse)}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Destination Warehouse
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {getWarehouseName(selectedTransfer.toWarehouse)}
                </span>
                {getWarehouseCode(selectedTransfer.toWarehouse) && (
                  <span className="text-xs text-slate-500 font-mono block">
                    {getWarehouseCode(selectedTransfer.toWarehouse)}
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(selectedTransfer.date || selectedTransfer.createdAt)}
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reason</span>
                <span className="font-semibold text-slate-800">{selectedTransfer.notes || '—'}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Created By</span>
                <span className="font-semibold text-slate-800">
                  {selectedTransfer.createdBy || 'Authorized Staff'}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                Transferred Items ({selectedTransfer.items?.length || 0})
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedTransfer.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.productName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{item.sku || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.qty}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
        )}
      </Modal>

      {/* EDIT TRANSFER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Stock Transfer"
        size="md"
      >
        {selectedTransfer && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <span className="text-xs text-slate-500 block">Transfer Voucher</span>
              <span className="text-sm font-bold font-mono text-blue-600">
                {selectedTransfer.transferNumber}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Status
              </label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Pending">Pending</option>
                <option value="In Transit">In Transit</option>
                <option value="Completed">Completed (Deduct source & Add destination)</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Changing status to Completed will finalize stock movement in destination warehouse.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Notes / Reason
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
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
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* CANCEL CONFIRMATION MODAL */}
      <Modal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        title="Cancel Stock Transfer"
        size="md"
      >
        {selectedTransfer && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-900">Are you sure you want to cancel this transfer?</h4>
                <p className="text-xs text-rose-700 mt-1">
                  Transfer <strong className="font-mono">{selectedTransfer.transferNumber}</strong> will be marked as Cancelled. Any inventory movements will be safely reversed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Keep Transfer
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Transfer</span>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
});
