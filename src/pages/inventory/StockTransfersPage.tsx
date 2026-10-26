import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle,
  ArrowRight,
  Loader2,
  Search,
  Eye,
  AlertTriangle,
  Calendar,
  Trash2,
  User,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { sortProductsAZ } from '../../utils/sortUtils';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StockTransfer, StockTransferItem } from '../../types';
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

  // Modals & Feedback state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Transfer Form State
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceDoc, setReferenceDoc] = useState('');
  const [notes, setNotes] = useState('');
  const [transferLines, setTransferLines] = useState<TransferLineForm[]>([]);

  // Helpers to resolve human-readable display names & SKUs
  const getWarehouseDisplayName = React.useCallback((idOrName: string) => {
    if (!idOrName) return '—';
    const match = warehouses.find(
      w => w.id === idOrName || w.code.toLowerCase() === idOrName.toLowerCase() || w.name.toLowerCase() === idOrName.toLowerCase()
    );
    return match ? `${match.name} (${match.code})` : idOrName;
  }, [warehouses]);

  const getProductSku = React.useCallback((productId: string) => {
    const match = products.find(p => p.id === productId);
    return match?.sku || match?.code || '—';
  }, [products]);

  const formatDateTime = (dateStr?: string, fallbackDate?: string): string => {
    const target = dateStr || fallbackDate;
    if (!target) return '—';
    try {
      const d = new Date(target);
      if (isNaN(d.getTime())) return target;
      const dateFormatted = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const hasTime = target.includes('T') || target.includes(':');
      if (hasTime) {
        const timeFormatted = d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        return `${dateFormatted}, ${timeFormatted}`;
      }
      return dateFormatted;
    } catch {
      return target;
    }
  };

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

  // Submit direct transfer: Immediate Completed status, atomic stock balance updates
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

    // Validate quantities and available stock
    for (const line of transferLines) {
      const qtyNum = Number(line.qty);
      if (!qtyNum || qtyNum <= 0) {
        setFormError(`Quantity for product "${line.productName}" must be greater than zero.`);
        return;
      }
      if (qtyNum > line.availableStock) {
        setFormError(
          `Transfer quantity for "${line.productName}" (${qtyNum} ${line.unit}) exceeds available stock in source warehouse (${line.availableStock} ${line.unit}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
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

      const items: StockTransferItem[] = transferLines.map(l => {
        const matchedProduct = products.find(p => p.id === l.productId);
        return {
          productId: l.productId,
          productName: l.productName,
          sku: matchedProduct?.sku || matchedProduct?.code || '',
          qty: Number(l.qty),
          unit: l.unit
        };
      });

      // Execute Direct Stock Transfer: Marked as Completed immediately, atomic inventory movement
      await createStockTransfer({
        transferNumber,
        date: transferDate,
        fromWarehouse: srcWh?.name || srcWh?.code || fromWarehouseId,
        fromWarehouseId: fromWarehouseId,
        toWarehouse: destWh?.name || destWh?.code || toWarehouseId,
        toWarehouseId: toWarehouseId,
        items,
        status: 'Completed',
        referenceDoc: referenceDoc.trim() || undefined,
        notes: notes.trim() || `Direct transfer from ${srcWh?.name} to ${destWh?.name}`
      });

      // Display required success message
      setSuccessMessage('Stock transferred successfully.');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to transfer stock.');
    } finally {
      setIsSubmitting(false);
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
        (t.fromWarehouse && t.fromWarehouse.toLowerCase().includes(search)) ||
        (t.toWarehouse && t.toWarehouse.toLowerCase().includes(search)) ||
        (t.referenceDoc && t.referenceDoc.toLowerCase().includes(search)) ||
        t.items.some(
          i =>
            i.productName.toLowerCase().includes(search) ||
            (i.sku && i.sku.toLowerCase().includes(search)) ||
            getProductSku(i.productId).toLowerCase().includes(search)
        );

      // Status
      const matchesStatus =
        statusFilter === 'All' ||
        t.status === statusFilter ||
        (statusFilter === 'Completed' && (t.status === 'Completed' || t.status === 'Received'));

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
  }, [stockTransfers, searchTerm, statusFilter, warehouseFilter, startDate, endDate, getProductSku]);

  // Sort transfers: newest first
  const sortedTransfers = useMemo(() => {
    return [...filteredTransfers].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime();
      const timeB = new Date(b.createdAt || b.date).getTime();
      return timeB - timeA;
    });
  }, [filteredTransfers]);

  // Simplified Dashboard Stats: Total Transfers & Completed Transfers only
  const transferStats = useMemo(() => {
    const total = stockTransfers.length;
    const completed = stockTransfers.filter(
      t => t.status === 'Completed' || t.status === 'Received'
    ).length;
    return { total, completed };
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
                Directly transfer inventory between warehouses with real-time stock balance updates and complete transfer history.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Simplified Dashboard Metrics: Total & Completed Transfers only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Total Transfers</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{transferStats.total}</div>
          <p className="text-xs text-slate-500">All recorded stock movements</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Completed Transfers</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 tracking-tight">{transferStats.completed}</div>
          <p className="text-xs text-slate-500">Direct transfers settled immediately</p>
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
              placeholder="Search by transfer #, ref document, warehouse, product, or SKU..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Transfers</option>
              <option value="Completed">Completed</option>
              <option value="Requested">Requested (Historical)</option>
              <option value="Cancelled">Cancelled (Historical)</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">All Warehouses</option>
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
              className="text-xs text-rose-600 hover:underline font-semibold ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Single Stock Transfer History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Stock Transfer History
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {sortedTransfers.length} {sortedTransfers.length === 1 ? 'record' : 'records'}
            </span>
          </h2>
        </div>

        {sortedTransfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Stock Transfers Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No transfer records match your search or filter criteria. Initiate a transfer to directly move stock between locations.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                  <th className="py-3 px-4">Transfer ID</th>
                  <th className="py-3 px-3">Date and Time</th>
                  <th className="py-3 px-3">Source Warehouse</th>
                  <th className="py-3 px-3">Destination Warehouse</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">SKU / Product Code</th>
                  <th className="py-3 px-3 text-right">Transferred Quantity and Unit</th>
                  <th className="py-3 px-3">Transferred By</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTransfers.map(trf => {
                  return (
                    <tr key={trf.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Transfer ID */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleOpenDetails(trf)}
                            className="font-mono font-bold text-blue-600 hover:underline hover:text-blue-800 text-left cursor-pointer"
                          >
                            {trf.transferNumber}
                          </button>
                          {trf.referenceDoc && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-mono mt-0.5 inline-block self-start">
                              Ref: {trf.referenceDoc}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date and Time */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {formatDateTime(trf.createdAt, trf.date)}
                        </div>
                      </td>

                      {/* Source Warehouse */}
                      <td className="py-3 px-3">
                        <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200 inline-block">
                          {getWarehouseDisplayName(trf.fromWarehouseId || trf.fromWarehouse)}
                        </span>
                      </td>

                      {/* Destination Warehouse */}
                      <td className="py-3 px-3">
                        <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-200/60 inline-block">
                          {getWarehouseDisplayName(trf.toWarehouseId || trf.toWarehouse)}
                        </span>
                      </td>

                      {/* Product Name (multi-product rows supported clearly) */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 max-w-[200px]">
                          {trf.items.map((it, idx) => (
                            <div key={idx} className="font-semibold text-slate-800 truncate" title={it.productName}>
                              {it.productName}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* SKU / Product Code */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 font-mono text-slate-600 text-[11px]">
                          {trf.items.map((it, idx) => (
                            <div key={idx} className="truncate">
                              {it.sku || getProductSku(it.productId)}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Transferred Quantity and Unit */}
                      <td className="py-3 px-3 text-right">
                        <div className="space-y-1">
                          {trf.items.map((it, idx) => (
                            <div key={idx} className="font-bold text-indigo-700">
                              {it.qty} <span className="font-normal text-slate-500 text-[11px]">{it.unit}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Transferred By */}
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800 text-[11px]">
                            {trf.createdBy || 'Warehouse Manager'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <StatusBadge status={trf.status} size="sm" />
                      </td>

                      {/* Actions (View Details) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(trf)}
                          className="w-8 h-8 inline-flex items-center justify-center text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
                          title="View Details"
                          aria-label="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Stock Transfer Modal (Direct Transfer) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Stock Transfer"
        subtitle="Directly transfer inventory between locations with real-time source stock verification"
        size="lg"
        footer={
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateTransfer}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Transferring Stock...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer Stock</span>
                </>
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
              <p className="text-[10px] text-slate-500 mt-1">Stock will be directly deducted from this location.</p>
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
              <p className="text-[10px] text-slate-500 mt-1">Stock will be directly credited to this location.</p>
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
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200 transition-colors cursor-pointer"
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
                          {sortProductsAZ(products).map(p => {
                            const pStock = getWarehouseStock(fromWarehouseId, p.id);
                            const pStatus =
                              pStock <= 0
                                ? 'Out of Stock'
                                : p.reorderLevel !== null && p.reorderLevel !== undefined && pStock <= p.reorderLevel
                                ? 'Limited'
                                : 'In Stock';
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({pStatus} - {pStock} {p.primaryUnit || 'Pcs'} | {p.sku})
                              </option>
                            );
                          })}
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
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
              placeholder="e.g. Direct inter-warehouse stock replenishment"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>
        </form>
      </Modal>

      {/* Transfer Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Stock Transfer: ${selectedTransfer?.transferNumber || ''}`}
        subtitle={`Transferred on: ${selectedTransfer ? formatDateTime(selectedTransfer.createdAt, selectedTransfer.date) : ''}`}
        size="lg"
        footer={
          selectedTransfer ? (
            <div className="flex items-center justify-between w-full">
              <StatusBadge status={selectedTransfer.status} size="sm" />
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : null
        }
      >
        {selectedTransfer && (
          <div className="space-y-4 text-xs">
            {/* Route & Metadata Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Transfer Route</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold text-slate-900">
                    {getWarehouseDisplayName(selectedTransfer.fromWarehouseId || selectedTransfer.fromWarehouse)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="font-semibold text-blue-700">
                    {getWarehouseDisplayName(selectedTransfer.toWarehouseId || selectedTransfer.toWarehouse)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Transferred By</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedTransfer.createdBy || 'Warehouse Manager'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Date and Time</span>
                <span className="font-medium text-slate-800 block mt-1">
                  {formatDateTime(selectedTransfer.createdAt, selectedTransfer.date)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference Document</span>
                <span className="font-mono text-slate-800 font-semibold block mt-1">
                  {selectedTransfer.referenceDoc || 'None provided'}
                </span>
              </div>
            </div>

            {/* Direct Settlement Integrity Info */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Direct Settlement:</strong> Stock balances immediately updated between source and destination warehouses with full ledger movement tracking.
              </span>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU / Code</th>
                    <th className="py-2.5 px-3 text-right">Transferred Qty</th>
                    <th className="py-2.5 px-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sortProductsAZ(selectedTransfer.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.productName}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{item.sku || getProductSku(item.productId)}</td>
                      <td className="py-2 px-3 text-right font-bold text-indigo-700">{item.qty}</td>
                      <td className="py-2 px-3 text-slate-600">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedTransfer.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                <span className="font-semibold text-slate-700 block mb-0.5">Transfer Notes:</span>
                {selectedTransfer.notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
