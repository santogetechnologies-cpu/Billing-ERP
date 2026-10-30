import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Eye,
  Edit,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { sortProductsAZ } from '../../utils/sortUtils';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Batch, Product } from '../../types';
import { Modal } from '../../components/common/Modal';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { calculateStockStatus, calculateBatchStatus } from '../../utils/inventoryUtils';

export const BatchManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { batches, products, addBatch } = useERP();

  // Extract navigation context from location.state or query params (e.g. from Dispatch button)
  const dispatchContext = useMemo(() => {
    const state = location.state as {
      batchId?: string;
      batchNumber?: string;
      productId?: string;
      productName?: string;
      fromDispatch?: boolean;
    } | null;

    const queryBatch = searchParams.get('batch') || searchParams.get('batchNumber');
    const querySearch = searchParams.get('search');
    const queryProduct = searchParams.get('productId') || searchParams.get('productName');

    const batchNumber = state?.batchNumber || queryBatch || '';
    const productName = state?.productName || queryProduct || '';
    const batchId = state?.batchId || '';
    const productId = state?.productId || '';
    const fromDispatch = Boolean(state?.fromDispatch || searchParams.get('from') === 'dispatch' || batchNumber || batchId);

    return {
      batchNumber,
      productName,
      batchId,
      productId,
      fromDispatch,
      searchTerm: batchNumber || productName || querySearch || ''
    };
  }, [location.state, searchParams]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpiryReportOpen, setIsExpiryReportOpen] = useState(false);
  const [expiryCategoryFilter, setExpiryCategoryFilter] = useState<'all' | 'expired' | 'expiring_soon' | 'active'>('all');
  const [expirySearch, setExpirySearch] = useState('');
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

  // Expiry Report Computations & Metrics
  const expiryStats = useMemo(() => {
    let totalBatches = batches.length;
    let totalUnits = 0;
    let expiredBatches = 0;
    let expiredUnits = 0;
    let expiredValue = 0;
    let expiringSoonBatches = 0;
    let expiringSoonUnits = 0;
    let expiringSoonValue = 0;
    let validBatches = 0;
    let validUnits = 0;
    let validValue = 0;

    batches.forEach(b => {
      const q = Number(b.qty) || 0;
      const c = Number(b.cost) || 0;
      const val = q * c;
      totalUnits += q;

      const status = calculateBatchStatus(b.expiryDate, b.qty);
      if (status === 'Expired') {
        expiredBatches++;
        expiredUnits += q;
        expiredValue += val;
      } else if (status === 'Expiring Soon') {
        expiringSoonBatches++;
        expiringSoonUnits += q;
        expiringSoonValue += val;
      } else {
        validBatches++;
        validUnits += q;
        validValue += val;
      }
    });

    return {
      totalBatches,
      totalUnits,
      expiredBatches,
      expiredUnits,
      expiredValue,
      expiringSoonBatches,
      expiringSoonUnits,
      expiringSoonValue,
      validBatches,
      validUnits,
      validValue
    };
  }, [batches]);

  const getExpiryDetails = (expiryDate?: string) => {
    if (!expiryDate || !expiryDate.trim()) {
      return { label: 'No Expiry Set', isExpired: false, badgeClass: 'text-slate-500 bg-slate-100 border-slate-200' };
    }
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) {
      return { label: 'Invalid Date', isExpired: false, badgeClass: 'text-slate-500 bg-slate-100 border-slate-200' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    const diffMs = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `${Math.abs(diffDays)}d overdue`,
        isExpired: true,
        badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 font-semibold'
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Expires Today',
        isExpired: true,
        badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 font-bold'
      };
    }
    if (diffDays <= 30) {
      return {
        label: `${diffDays}d remaining`,
        isExpired: false,
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200 font-medium'
      };
    }
    return {
      label: `${diffDays}d remaining`,
      isExpired: false,
      badgeClass: 'text-slate-700 bg-slate-100 border-slate-200'
    };
  };

  const filteredExpiryBatches = useMemo(() => {
    const filtered = batches.filter(b => {
      const status = calculateBatchStatus(b.expiryDate, b.qty);
      if (expiryCategoryFilter === 'expired' && status !== 'Expired') return false;
      if (expiryCategoryFilter === 'expiring_soon' && status !== 'Expiring Soon') return false;
      if (expiryCategoryFilter === 'active' && status !== 'Active' && status !== 'Low Stock') return false;

      if (expirySearch.trim()) {
        const q = expirySearch.toLowerCase();
        const matchName = (b.productName || '').toLowerCase().includes(q);
        const matchBatch = (b.batchNumber || '').toLowerCase().includes(q);
        const matchStatus = status.toLowerCase().includes(q);
        return matchName || matchBatch || matchStatus;
      }
      return true;
    });
    return sortProductsAZ(filtered);
  }, [batches, expiryCategoryFilter, expirySearch]);

  const handleExportExpiryCSV = () => {
    const headers = [
      'Batch Number',
      'Product Name',
      'SKU',
      'Manufacturing Date',
      'Expiry Date',
      'Shelf Life Status',
      'Available Qty',
      'Unit Cost (₹)',
      'Total Value (₹)',
      'Status'
    ];

    const rows = filteredExpiryBatches.map(b => {
      const prod = products.find(p => p.id === b.productId || p.name?.toLowerCase() === b.productName?.toLowerCase());
      const status = calculateBatchStatus(b.expiryDate, b.qty);
      const expInfo = getExpiryDetails(b.expiryDate);
      const value = (Number(b.qty) || 0) * (Number(b.cost) || 0);

      return [
        b.batchNumber,
        b.productName,
        prod?.sku || '—',
        b.mfgDate ? formatDate(b.mfgDate) : '—',
        b.expiryDate ? formatDate(b.expiryDate) : '—',
        expInfo.label,
        `${b.qty} ${prod?.primaryUnit || 'Units'}`,
        b.cost || 0,
        value,
        status
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expiry_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            type="button"
            onClick={() => setIsExpiryReportOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Expiry Reports</span>
          </button>
        </div>
      </div>

      {/* Dispatch Context Alert */}
      {dispatchContext.fromDispatch && (dispatchContext.batchNumber || dispatchContext.productName) && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-blue-600 text-white shadow-2xs">
              Dispatch
            </span>
            <span>
              Showing batch inventory for{' '}
              <strong className="font-mono font-bold text-blue-950">
                {dispatchContext.batchNumber ? `Batch #${dispatchContext.batchNumber}` : ''}
              </strong>
              {dispatchContext.productName ? ` (${dispatchContext.productName})` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigate('/inventory/batches', { replace: true, state: {} });
            }}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            Show All Batches
          </button>
        </div>
      )}

      {/* Batches Table */}
      <DataTable
        title="Manufacturing Lots & Batch Registry"
        subtitle={`Showing ${batches.length} tracked product batches`}
        columns={columns}
        data={batches}
        defaultSortKey="productName"
        defaultSortDir="asc"
        searchPlaceholder="Search batch number, product name..."
        searchKeys={['batchNumber', 'productName', 'status']}
        initialSearchTerm={dispatchContext.searchTerm}
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
              {sortProductsAZ(products).map(p => (
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

      {/* Expiry Reports Modal View */}
      <Modal
        isOpen={isExpiryReportOpen}
        onClose={() => setIsExpiryReportOpen(false)}
        title="Expiry Reports"
        subtitle="Batch lifecycle analysis, shelf life expiration timeline and inventory risk report"
        size="2xl"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-semibold text-slate-800">{filteredExpiryBatches.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{batches.length}</span> total batches
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsExpiryReportOpen(false);
                  navigate('/reports?category=inventory&report=batch-expiry');
                }}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Open in Reports Center</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExpiryReportOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Top Expiry Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Tracked Batches */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Batches</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">{expiryStats.totalBatches}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formatNumber(expiryStats.totalUnits)} units tracked
              </p>
            </div>

            {/* Expired Stock */}
            <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200/80">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Expired Stock</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl font-bold text-rose-700">{expiryStats.expiredBatches}</div>
              <p className="text-[11px] text-rose-600 mt-0.5 font-medium">
                {formatNumber(expiryStats.expiredUnits)} units • {formatCurrency(expiryStats.expiredValue)}
              </p>
            </div>

            {/* Expiring Soon */}
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Expiring Soon</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-amber-700">{expiryStats.expiringSoonBatches}</div>
              <p className="text-[11px] text-amber-600 mt-0.5 font-medium">
                Within 30d • {formatCurrency(expiryStats.expiringSoonValue)}
              </p>
            </div>

            {/* Valid Stock */}
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Valid Stock</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700">{expiryStats.validBatches}</div>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                {formatNumber(expiryStats.validUnits)} units active
              </p>
            </div>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setExpiryCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  expiryCategoryFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Batches ({expiryStats.totalBatches})
              </button>

              <button
                type="button"
                onClick={() => setExpiryCategoryFilter('expired')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  expiryCategoryFilter === 'expired'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Expired ({expiryStats.expiredBatches})</span>
              </button>

              <button
                type="button"
                onClick={() => setExpiryCategoryFilter('expiring_soon')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  expiryCategoryFilter === 'expiring_soon'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Expiring Soon ({expiryStats.expiringSoonBatches})</span>
              </button>

              <button
                type="button"
                onClick={() => setExpiryCategoryFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  expiryCategoryFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Valid Stock ({expiryStats.validBatches})</span>
              </button>
            </div>

            {/* Search and Exports */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={expirySearch}
                  onChange={e => setExpirySearch(e.target.value)}
                  placeholder="Filter product, batch #..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={handleExportExpiryCSV}
                title="Export filtered records to CSV"
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                title="Print Expiry Report"
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Expiry Report Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs max-h-[420px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Mfg Date</th>
                  <th className="py-2.5 px-3">Expiry Date & Shelf Life</th>
                  <th className="py-2.5 px-3 text-right">Available Qty</th>
                  <th className="py-2.5 px-3 text-right">Cost / Value</th>
                  <th className="py-2.5 px-3 text-center">Expiry Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpiryBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <FileSpreadsheet className="w-7 h-7 text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">No batches match the selected criteria</p>
                        <p className="text-[11px] text-slate-400">Try adjusting your category filter or search keywords</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpiryBatches.map(b => {
                    const prod = products.find(p => p.id === b.productId || p.name?.toLowerCase() === b.productName?.toLowerCase());
                    const status = calculateBatchStatus(b.expiryDate, b.qty);
                    const expInfo = getExpiryDetails(b.expiryDate);
                    const totalVal = (Number(b.qty) || 0) * (Number(b.cost) || 0);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsExpiryReportOpen(false);
                              handleReviewProduct(b);
                            }}
                            className="font-semibold text-slate-900 hover:text-blue-600 text-left block truncate max-w-[200px]"
                            title="Click to review product details"
                          >
                            {b.productName}
                          </button>
                          {prod?.sku && (
                            <span className="text-[10px] text-slate-400 font-mono block">SKU: {prod.sku}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                          {b.batchNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {b.mfgDate ? formatDate(b.mfgDate) : '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {b.expiryDate ? formatDate(b.expiryDate) : '—'}
                          </div>
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded-md border mt-0.5 ${expInfo.badgeClass}`}>
                            {expInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatNumber(b.qty)} <span className="text-[11px] font-normal text-slate-500">{prod?.primaryUnit || 'Units'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{formatCurrency(totalVal)}</div>
                          <div className="text-[10px] text-slate-400">@ {formatCurrency(b.cost)}/u</div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <StatusBadge status={status} size="sm" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
