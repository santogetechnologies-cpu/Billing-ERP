import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Plus,
  ShoppingBag,
  Building2,
  CheckCircle,
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const PurchaseReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const { purchaseInvoices, suppliers, products, processPurchaseReturn } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [returnQty, setReturnQty] = useState<string>('1');
  const [returnReason, setReturnReason] = useState('Damaged / Defective material rejected upon delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Available original purchase bills for selected supplier
  const supplierPurchases = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchaseInvoices.filter(p => p.supplierId === selectedSupplierId && p.docType !== 'purchase_return');
  }, [purchaseInvoices, selectedSupplierId]);

  // Selected original invoice
  const activePurchase = useMemo(() => {
    return purchaseInvoices.find(p => p.id === selectedPurchaseId);
  }, [purchaseInvoices, selectedPurchaseId]);

  // Products available in the selected original invoice
  const availableItems = useMemo(() => {
    if (!activePurchase || !activePurchase.items || activePurchase.items.length === 0) {
      return products.map(p => ({
        id: p.id,
        name: p.name,
        rate: p.purchasePrice,
        unit: p.primaryUnit,
        maxQty: p.currentStock,
        sku: p.sku
      }));
    }
    return activePurchase.items.map(it => {
      const prod = products.find(p => p.id === it.productId);
      return {
        id: it.productId,
        name: it.productName,
        rate: it.rate,
        unit: it.unit,
        maxQty: it.qty,
        sku: prod?.sku || ''
      };
    });
  }, [activePurchase, products]);

  // Calculate rate and amount
  const selectedItemMeta = useMemo(() => {
    return availableItems.find(i => i.id === selectedProductId) || availableItems[0];
  }, [availableItems, selectedProductId]);

  const unitRate = selectedItemMeta?.rate || products.find(p => p.id === selectedProductId)?.purchasePrice || 0;
  const returnSubtotal = (Number(returnQty) || 0) * unitRate;
  const returnTax = returnSubtotal * 0.18;
  const returnGrandTotal = returnSubtotal + returnTax;

  const handleOpenModal = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    const firstBill = purchaseInvoices.find(p => p.supplierId === suppliers[0]?.id && p.docType !== 'purchase_return');
    setSelectedPurchaseId(firstBill?.id || '');
    setSelectedProductId(firstBill?.items[0]?.productId || products[0]?.id || '');
    setReturnQty('1');
    setReturnReason('Damaged / Defective material rejected upon delivery');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleCreateDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setErrorMessage('Please select a supplier.');
      return;
    }
    const numReturnQty = Number(returnQty) || 0;
    if (!selectedProductId || numReturnQty <= 0) {
      setErrorMessage('Please enter a valid product and positive return quantity.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const selectedSup = suppliers.find(s => s.id === selectedSupplierId);

      await processPurchaseReturn(
        selectedPurchaseId || '',
        [
          {
            productId: selectedProductId,
            qty: numReturnQty,
            returnAmt: returnSubtotal,
            productName: selectedItemMeta?.name || 'Returned Product',
            unit: selectedItemMeta?.unit || 'Pcs',
            rate: unitRate
          }
        ],
        returnReason,
        selectedSupplierId,
        selectedSup?.name
      );

      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process Debit Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const purchaseReturns = useMemo(() => {
    return purchaseInvoices
      .filter(p => p.docType === 'purchase_return')
      .map(p => {
        const origBill = purchaseInvoices.find(b => b.id === p.originalPurchaseId);
        return {
          id: p.id,
          returnNumber: p.invoiceNumber,
          date: p.date,
          originalBillNo: origBill?.invoiceNumber || p.referenceNumber || (p.originalPurchaseId ? 'PO-' + p.originalPurchaseId.slice(0, 8) : 'Direct Return'),
          supplierName: p.supplierName,
          itemsReturned: p.items.map(i => `${i.productName} (${i.qty} ${i.unit})`).join(', ') || 'Returned Items',
          returnAmount: p.subtotal,
          taxReversed: p.taxTotal,
          totalCredit: p.grandTotal,
          reason: p.notes || 'Purchase Return',
          status: p.paymentStatus === 'Paid' ? 'Approved' : 'Sent'
        };
      });
  }, [purchaseInvoices]);

  const handleExportXLSX = () => {
    const data = purchaseReturns.map(r => ({
      'Debit Note #': r.returnNumber,
      'Date': r.date,
      'Supplier': r.supplierName,
      'Returned Items': r.itemsReturned,
      'Debit Amount': r.returnAmount,
      'Tax Reversed': r.taxReversed,
      'Total Debit Note Value': r.totalCredit,
      'Reason': r.reason,
      'Status': r.status
    }));
    exportToExcel(data, 'Supplier_Debit_Notes');
  };

  const handleExportCSV = () => {
    const data = purchaseReturns.map(r => ({
      'Debit Note #': r.returnNumber,
      'Date': r.date,
      'Supplier': r.supplierName,
      'Returned Items': r.itemsReturned,
      'Debit Amount': r.returnAmount,
      'Tax Reversed': r.taxReversed,
      'Total Debit Note Value': r.totalCredit,
      'Reason': r.reason,
      'Status': r.status
    }));
    exportToCSV(data, 'Supplier_Debit_Notes');
  };

  const columns: Column<any>[] = [
    {
      key: 'returnNumber',
      header: 'Debit Note #',
      render: row => <span className="font-mono font-bold text-blue-600">{row.returnNumber}</span>
    },
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      render: row => <span className="font-semibold text-slate-800">{row.supplierName}</span>
    },
    {
      key: 'itemsReturned',
      header: 'Returned Material',
      render: row => <span className="text-slate-700">{row.itemsReturned}</span>
    },
    {
      key: 'totalCredit',
      header: 'Debit Value (₹)',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.totalCredit)}</span>
      )
    },
    {
      key: 'reason',
      header: 'Return Justification',
      render: row => <span className="text-slate-500 text-xs">{row.reason}</span>
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
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            Purchase Returns & Debit Notes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Issue Debit Notes to suppliers for defective, damaged or rejected inward goods shipments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV</span>
          </button>

          {/* Real Working Debit Note Action (Prompt #16: NO placeholder alerts) */}
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Debit Note</span>
          </button>
        </div>
      </div>

      <DataTable
        title="Supplier Debit Notes & Returns"
        columns={columns}
        data={purchaseReturns}
        searchPlaceholder="Search debit note, supplier, reason..."
        searchKeys={['returnNumber', 'supplierName', 'reason']}
      />

      {/* Real Debit Note Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Supplier Debit Note / Purchase Return"
        size="lg"
      >
        <form onSubmit={handleCreateDebitNote} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Supplier <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={e => {
                  setSelectedSupplierId(e.target.value);
                  const bills = purchaseInvoices.filter(p => p.supplierId === e.target.value && p.docType !== 'purchase_return');
                  setSelectedPurchaseId(bills[0]?.id || '');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company || 'Supplier'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Original Purchase Bill Reference
              </label>
              <select
                value={selectedPurchaseId}
                onChange={e => setSelectedPurchaseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Direct Supplier Debit Note --</option>
                {supplierPurchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.invoiceNumber} | {formatDate(p.date)} | Total: {formatCurrency(p.grandTotal)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Returned Product / Material <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                {availableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Cost: {formatCurrency(item.rate || 0)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={returnQty}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setReturnQty(''); return; }
                  if (raw.includes('-')) return;
                  setReturnQty(raw.replace(/^0+(?=\d)/, ''));
                }}
                placeholder="1"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Rejection Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="State reason for reject/return (e.g. damaged packaging, failed QC inspection, off-spec material)..."
              required
            />
          </div>

          {/* Real-time Calculation Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-600">
              <span>Debit Subtotal:</span>
              <span>{formatCurrency(returnSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax Reversal (GST 18%):</span>
              <span>{formatCurrency(returnTax)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 text-sm">
              <span>Total Debit Note Value:</span>
              <span className="text-blue-700">{formatCurrency(returnGrandTotal)}</span>
            </div>
            <p className="text-[11px] font-sans text-slate-500 mt-1">
              * Submitting this Debit Note will automatically deduct warehouse stock, reduce supplier payable, and post double-entry reversals.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording Transaction...' : 'Confirm Debit Note'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
