import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
  Package,
  Layers,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Batch } from '../../types';
import { Modal } from '../../components/common/Modal';

export const BatchManagementPage: React.FC = () => {
  const { batches, products, addBatch } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New batch form
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState<string>('');
  const [qty, setQty] = useState<string>('');

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === productId) || products[0];
    if (!prod) return;

    let maxSeq = 1000;
    batches.forEach(b => {
      const match = (b.batchNumber || '').match(/B-.*?(\d+)$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const autoBatch = `B-${String(maxSeq + 1).padStart(5, '0')}`;

    addBatch({
      productId: prod.id,
      productName: prod.name,
      batchNumber: batchNumber || autoBatch,
      mfgDate,
      expiryDate,
      purchaseDate,
      cost: Number(cost) || 0,
      qty: Number(qty) || 0,
      status: 'Active'
    });

    setIsModalOpen(false);
  };

  const columns: Column<Batch>[] = [
    {
      key: 'batchNumber',
      header: 'Batch Number',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.batchNumber}</span>
      )
    },
    {
      key: 'productName',
      header: 'Product',
      render: row => (
        <span className="font-semibold text-slate-900 block truncate max-w-[220px]">
          {row.productName}
        </span>
      )
    },
    {
      key: 'qty',
      header: 'Batch Qty',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-800">{formatNumber(row.qty)}</span>
      )
    },
    {
      key: 'cost',
      header: 'Unit Cost',
      align: 'right',
      render: row => formatCurrency(row.cost)
    },
    {
      key: 'mfgDate',
      header: 'Mfg Date',
      render: row => formatDate(row.mfgDate)
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: row => (
        <span
          className={`font-semibold ${
            row.status === 'Expired'
              ? 'text-rose-600'
              : row.status === 'Expiring Soon'
              ? 'text-amber-600'
              : 'text-slate-800'
          }`}
        >
          {formatDate(row.expiryDate)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => <StatusBadge status={row.status} size="sm" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Batch & Expiry Date Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track shelf life, manufacturing lots, perishable goods and aging inventory.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Batch</span>
          </button>
        </div>
      </div>

      {/* Batches Table */}
      <DataTable
        title="Manufacturing Lots & Batch Registry"
        subtitle={`Showing ${batches.length} tracked product batches`}
        columns={columns}
        data={batches}
        searchPlaceholder="Search batch number, product name..."
        searchKeys={['batchNumber', 'productName', 'status']}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'Active' },
              { label: 'Expiring Soon', value: 'Expiring Soon' },
              { label: 'Expired', value: 'Expired' },
              { label: 'Low Stock', value: 'Low Stock' }
            ]
          }
        ]}
      />

      {/* New Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Product Batch"
        subtitle="Record manufacturing lot, production dates and batch cost"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBatch}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Save Batch
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Product</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Batch Number</label>
            <input
              type="text"
              value={batchNumber}
              onChange={e => setBatchNumber(e.target.value)}
              placeholder="e.g. B-RIC-2026-09"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Manufacturing Date</label>
              <input
                type="date"
                min="1900-01-01"
                max="2099-12-31"
                value={mfgDate}
                onChange={e => {
                  let val = e.target.value;
                  if (val) {
                    const parts = val.split('-');
                    if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
                    val = parts.join('-');
                  }
                  setMfgDate(val);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                min="1900-01-01"
                max="2099-12-31"
                value={expiryDate}
                onChange={e => {
                  let val = e.target.value;
                  if (val) {
                    const parts = val.split('-');
                    if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
                    val = parts.join('-');
                  }
                  setExpiryDate(val);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-amber-700 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity in Batch</label>
              <input
                type="number"
                min="0"
                value={qty}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setQty(''); return; }
                  if (raw.includes('-')) return;
                  setQty(raw.replace(/^0+(?=\d)/, ''));
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Unit Cost (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={cost}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setCost(''); return; }
                  if (raw.includes('-')) return;
                  setCost(raw.replace(/^0+(?=\d)/, ''));
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
