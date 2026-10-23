import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Eye,
  Edit
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Batch, Product } from '../../types';
import { Modal } from '../../components/common/Modal';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { calculateStockStatus } from '../../utils/inventoryUtils';

export const BatchManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { batches, products, addBatch } = useERP();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

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

  const handleReviewProduct = (batch: Batch) => {
    setSelectedBatch(batch);
    const prod = products.find(p => p.id === batch.productId || p.name?.toLowerCase() === batch.productName?.toLowerCase());
    if (prod) {
      setSelectedProduct(prod);
    } else {
      setSelectedProduct({
        id: batch.productId || 'temp-id',
        name: batch.productName,
        code: batch.batchNumber,
        sku: `SKU-${batch.batchNumber}`,
        barcode: '',
        category: 'General',
        brand: '',
        description: '',
        hsn: '—',
        taxRate: 0,
        purchasePrice: batch.cost,
        costPrice: batch.cost,
        sellingPrice: batch.cost ? Math.round(batch.cost * 1.25) : 0,
        retailPrice: batch.cost ? Math.round(batch.cost * 1.25) : 0,
        wholesalePrice: batch.cost ? Math.round(batch.cost * 1.15) : 0,
        mrp: batch.cost ? Math.round(batch.cost * 1.3) : 0,
        minSellingPrice: batch.cost,
        reorderLevel: 10,
        openingStock: batch.qty,
        openingStockValue: batch.cost * batch.qty,
        currentStock: batch.qty,
        primaryUnit: 'Piece',
        warehouse: 'Central Warehouse',
        rack: '—',
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        batchTracking: true,
        serialTracking: false,
        expiryTracking: true,
        isActive: true,
        createdAt: batch.mfgDate || new Date().toISOString()
      });
    }
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
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleReviewProduct(row);
          }}
          className="font-semibold text-slate-900 hover:text-blue-600 block truncate max-w-[220px] text-left cursor-pointer transition-colors"
          title="Click to review product details"
        >
          {row.productName}
        </button>
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
        onRowClick={row => handleReviewProduct(row)}
        actions={row => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleReviewProduct(row);
              }}
              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200/80 flex items-center justify-center transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
              title="Review Product Details"
              aria-label="Review Product Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}
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

      {/* Product Details Review Modal */}
      {selectedProduct && (
        <Modal
          isOpen={Boolean(selectedProduct)}
          onClose={() => {
            setSelectedProduct(null);
            setSelectedBatch(null);
          }}
          title={selectedProduct.name}
          subtitle={`SKU: ${selectedProduct.sku || 'N/A'}${selectedProduct.hsn ? ` | HSN: ${selectedProduct.hsn}` : ''}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500">
                Created: {formatDate(selectedProduct.createdAt)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSelectedBatch(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                {selectedProduct.id && selectedProduct.id !== 'temp-id' && hasPermission(profile?.role, 'products', 'edit') && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/products/edit/${selectedProduct.id}`);
                      setSelectedProduct(null);
                      setSelectedBatch(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-xs">
            {/* Visual identification & Stock */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Product Barcode
                </span>
                <div className="pt-2">
                  {selectedProduct.barcode ? (
                    <BarcodeCanvas value={selectedProduct.barcode} height={45} />
                  ) : (
                    <span className="text-xs font-mono text-slate-400 italic">No barcode assigned</span>
                  )}
                </div>
              </div>

              <div className="text-center sm:text-right space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Available Stock
                </span>
                <p className={`text-2xl font-black ${selectedProduct.currentStock <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatNumber(selectedProduct.currentStock)} {selectedProduct.primaryUnit || 'Piece'}
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-2 pt-0.5">
                  <StatusBadge
                    status={calculateStockStatus(selectedProduct.currentStock, selectedProduct.reorderLevel)}
                    size="sm"
                  />
                  <span className="text-[11px] text-slate-500">
                    Warning Limit:{' '}
                    {selectedProduct.reorderLevel !== null && selectedProduct.reorderLevel !== undefined
                      ? `${selectedProduct.reorderLevel} ${selectedProduct.primaryUnit || 'Piece'}`
                      : 'Not Set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Batch Highlight Card */}
            {selectedBatch && (
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                      Selected Lot / Batch
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {selectedBatch.batchNumber}
                    </span>
                  </div>
                  <StatusBadge status={selectedBatch.status} size="sm" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Batch Quantity</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {formatNumber(selectedBatch.qty)} {selectedProduct.primaryUnit || 'Piece'}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Unit Cost</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {formatCurrency(selectedBatch.cost)}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Mfg Date</span>
                    <span className="font-medium text-slate-700 text-xs">
                      {selectedBatch.mfgDate ? formatDate(selectedBatch.mfgDate) : '—'}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Expiry Date</span>
                    <span className={`font-semibold text-xs ${
                      selectedBatch.status === 'Expired'
                        ? 'text-rose-600'
                        : selectedBatch.status === 'Expiring Soon'
                        ? 'text-amber-600'
                        : 'text-slate-800'
                    }`}>
                      {selectedBatch.expiryDate ? formatDate(selectedBatch.expiryDate) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Commercial Pricing Multi-Tier Grid */}
            <div>
              <h4 className="font-bold uppercase text-[11px] tracking-wider text-slate-500 mb-2">
                Commercial Pricing Tier
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Cost Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.costPrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Retail Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.retailPrice || selectedProduct.sellingPrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Wholesale Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.wholesalePrice || selectedProduct.sellingPrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60">
                  <span className="text-[10px] text-blue-700 block font-medium">Selling Price</span>
                  <span className="font-bold text-blue-900 text-sm">
                    {formatCurrency(selectedProduct.sellingPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Storage Location & Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-xs">Storage Location</span>
                <p className="text-slate-600">Warehouse: {selectedProduct.warehouse || 'Central Warehouse'}</p>
                <p className="text-slate-600">Rack / Bin: {selectedProduct.rack || '—'}</p>
                <p className="text-slate-600">Category: {selectedProduct.category || 'General'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-xs">Tracking Controls</span>
                <p className="text-slate-600">
                  Batch Tracking: {selectedProduct.batchTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
                <p className="text-slate-600">
                  Serial Number: {selectedProduct.serialTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
                <p className="text-slate-600">
                  Expiry Tracking: {selectedProduct.expiryTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
              </div>
            </div>

            {/* Description */}
            {selectedProduct.description && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Description</span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                  {selectedProduct.description}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
