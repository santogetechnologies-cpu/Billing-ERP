import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle,
  Eye,
  AlertTriangle,
  ArrowRight,
  Download,
  Building,
  Trash2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { StockTransfer } from '../../types';
import { Modal } from '../common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const StockTransfersTab: React.FC = () => {
  const {
    stockTransfers = [],
    warehouses = [],
    products = [],
    createStockTransfer,
    updateTransferStatus
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // New Transfer 5-Step Form State
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [fromWarehouse, setFromWarehouse] = useState<string>(warehouses[0]?.name || 'Main Warehouse');
  const [toWarehouse, setToWarehouse] = useState<string>(warehouses[1]?.name || 'Secondary Warehouse');
  const [transferLines, setTransferLines] = useState<{ productId: string; productName: string; qty: number; unit: string }[]>([]);
  const [productToAdd, setProductToAdd] = useState<string>('');
  const [qtyToAdd, setQtyToAdd] = useState<string>('10');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeTransfers = useMemo(() => {
    return [...stockTransfers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockTransfers]);

  const handleAddLine = () => {
    if (!productToAdd) return;
    const prod = products.find(p => p.id === productToAdd);
    if (!prod) return;
    const numQty = Number(qtyToAdd) || 1;
    if (numQty <= 0) return;

    setTransferLines(prev => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        qty: numQty,
        unit: prod.primaryUnit || 'PCS'
      }
    ]);
    setProductToAdd('');
    setQtyToAdd('10');
  };

  const handleRemoveLine = (idx: number) => {
    setTransferLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmTransfer = async () => {
    if (fromWarehouse === toWarehouse) {
      setErrorMessage('Source and destination warehouse cannot be the same.');
      return;
    }
    if (transferLines.length === 0) {
      setErrorMessage('Please add at least one product to transfer.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      await createStockTransfer({
        transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        fromWarehouse,
        toWarehouse,
        items: transferLines.map(line => ({
          productId: line.productId,
          productName: line.productName,
          qty: line.qty,
          unit: line.unit
        })),
        status: 'In Transit',
        notes: notes.trim() || undefined
      });

      setStep(5);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to dispatch stock transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveGoods = async (trf: StockTransfer) => {
    try {
      await updateTransferStatus(trf.id, 'Completed');
    } catch (err: any) {
      alert(err?.message || 'Failed to receive goods.');
    }
  };

  const columns: Column<StockTransfer>[] = [
    {
      key: 'transferNumber',
      header: 'Transfer #',
      render: row => <span className="font-mono font-bold text-blue-600">{row.transferNumber}</span>
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: row => formatDate(row.createdAt)
    },
    {
      key: 'fromWarehouse',
      header: 'From (Source)',
      render: row => <span className="text-xs font-semibold text-slate-800">{row.fromWarehouse}</span>
    },
    {
      key: 'toWarehouse',
      header: 'To (Destination)',
      render: row => <span className="text-xs font-semibold text-slate-800">{row.toWarehouse}</span>
    },
    {
      key: 'items',
      header: 'Items',
      render: row => (
        <span className="text-xs text-slate-600 truncate max-w-xs block">
          {(row.items || []).map(i => `${i.productName} (${i.qty} ${i.unit})`).join(', ')}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : row.status === 'In Transit'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            Inter-Warehouse Transfers
          </h2>
          <p className="text-xs text-slate-500">
            Dispatch and receive stock between central warehouses and retail shop branches.
          </p>
        </div>

        <button
          onClick={() => {
            setStep(1);
            setTransferLines([]);
            setErrorMessage('');
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Main Transfers Table */}
      <DataTable
        title="Dispatched & In-Transit Transfers"
        subtitle={`Total ${activeTransfers.length} transfer records`}
        columns={columns}
        data={activeTransfers}
        searchPlaceholder="Search transfer #, source, or destination..."
        searchKeys={['transferNumber', 'fromWarehouse', 'toWarehouse']}
        onRowClick={row => setSelectedTransfer(row)}
        actions={row => row.status === 'In Transit' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReceiveGoods(row);
            }}
            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold cursor-pointer"
          >
            Receive Goods
          </button>
        ) : null}
      />

      {/* 5-Step Stock Transfer Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Inter-Warehouse Stock Transfer"
          subtitle="Universal 5-Step Dispatch & Challan Generation"
          size="lg"
        >
          <div className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {step <= 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      From (Source Warehouse) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={fromWarehouse}
                      onChange={e => setFromWarehouse(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      To (Destination Warehouse) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={toWarehouse}
                      onChange={e => setToWarehouse(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Add product line */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">Add Products to Transfer</span>
                  <div className="flex gap-2">
                    <select
                      value={productToAdd}
                      onChange={e => setProductToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">Select Product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock} {p.primaryUnit || 'PCS'})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={qtyToAdd}
                      onChange={e => setQtyToAdd(e.target.value)}
                      className="w-24 px-3 py-2 text-xs border border-slate-200 rounded-lg tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {transferLines.length > 0 && (
                    <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
                      {transferLines.map((line, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">{line.productName}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-900">{line.qty} {line.unit}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transfer Notes / Challan Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Vehicle number, driver details, or dispatch note..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || transferLines.length === 0}
                    onClick={handleConfirmTransfer}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Dispatching...' : 'Confirm & Dispatch Transfer'}
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-900">Transfer Dispatched!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The stock has been deducted from {fromWarehouse} and marked as In Transit to {toWarehouse}.
                </p>
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* View Transfer Details */}
      {selectedTransfer && (
        <Modal
          isOpen={Boolean(selectedTransfer)}
          onClose={() => setSelectedTransfer(null)}
          title={`Transfer Details: ${selectedTransfer.transferNumber}`}
          subtitle={`Dispatched on ${formatDate(selectedTransfer.createdAt)}`}
          size="md"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-slate-400 block">From:</span>
                <span className="font-semibold text-slate-800">{selectedTransfer.fromWarehouse}</span>
              </div>
              <div>
                <span className="text-slate-400 block">To:</span>
                <span className="font-semibold text-slate-800">{selectedTransfer.toWarehouse}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                <span className="font-bold text-blue-700">{selectedTransfer.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Notes:</span>
                <span className="text-slate-700">{selectedTransfer.notes || '—'}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <tr>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedTransfer.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-slate-800">{it.productName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{it.qty} {it.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

