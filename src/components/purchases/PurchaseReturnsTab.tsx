import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Building2,
  FileText,
  Download,
  Printer,
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';
import { sortProductsAZ } from '../../utils/sortUtils';

export const PurchaseReturnsTab: React.FC = () => {
  const { purchaseInvoices, suppliers, products, processPurchaseReturn } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [returnQty, setReturnQty] = useState<string>('1');
  const [returnReason, setReturnReason] = useState('Damaged / Defective material rejected upon delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewingReturn, setViewingReturn] = useState<any | null>(null);

  // Available original purchase bills for selected supplier
  const supplierPurchases = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchaseInvoices.filter(p => p.supplierId === selectedSupplierId && p.docType !== 'purchase_return');
  }, [purchaseInvoices, selectedSupplierId]);

  // Selected original invoice
  const activePurchase = useMemo(() => {
    return purchaseInvoices.find(p => p.id === selectedPurchaseId);
  }, [purchaseInvoices, selectedPurchaseId]);

  // Products available in the selected original invoice or catalog
  const availableItems = useMemo(() => {
    if (!activePurchase || !activePurchase.items || activePurchase.items.length === 0) {
      const list = products.map(p => ({
        id: p.id,
        name: p.name,
        rate: p.purchasePrice,
        unit: p.primaryUnit,
        maxQty: p.currentStock,
        sku: p.sku
      }));
      return sortProductsAZ(list);
    }
    const list = activePurchase.items.map(it => {
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
    return sortProductsAZ(list);
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
    setSelectedProductId(firstBill?.items?.[0]?.productId || products[0]?.id || '');
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
          itemsReturned: (p.items || []).map(i => `${i.productName} (${i.qty} ${i.unit || 'PCS'})`).join(', ') || 'Returned Items',
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
      render: row => <span className="font-medium text-slate-900">{row.supplierName}</span>
    },
    {
      key: 'originalBillNo',
      header: 'Against Bill / PO',
      render: row => (
        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {row.originalBillNo}
        </span>
      )
    },
    {
      key: 'itemsReturned',
      header: 'Returned Products',
      render: row => <span className="text-xs text-slate-600 truncate max-w-xs block">{row.itemsReturned}</span>
    },
    {
      key: 'totalCredit',
      header: 'Total Value',
      align: 'right',
      render: row => <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(row.totalCredit)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          row.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Purchase Returns & Debit Notes
          </h2>
          <p className="text-xs text-slate-500">
            Issue supplier debit notes for rejected material, damaged shipments, or price revisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Debit Note</span>
          </button>
        </div>
      </div>

      <DataTable
        title="Supplier Returns List"
        subtitle={`Total ${purchaseReturns.length} debit notes recorded`}
        columns={columns}
        data={purchaseReturns}
        searchPlaceholder="Search debit note #, supplier, or items..."
        searchKeys={['returnNumber', 'supplierName', 'originalBillNo', 'itemsReturned']}
        onRowClick={row => setViewingReturn(row)}
        actions={row => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingReturn(row);
            }}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      />

      {/* Modal: Create Debit Note */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Supplier Debit Note (Purchase Return)"
          subtitle="Generate a debit note to reverse stock and credit accounts payable."
          size="lg"
        >
          <form onSubmit={handleCreateDebitNote} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => {
                    setSelectedSupplierId(e.target.value);
                    const bills = purchaseInvoices.filter(p => p.supplierId === e.target.value && p.docType !== 'purchase_return');
                    setSelectedPurchaseId(bills[0]?.id || '');
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gstin || 'Unregistered'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Original Purchase Invoice
                </label>
                <select
                  value={selectedPurchaseId}
                  onChange={e => setSelectedPurchaseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Direct Return (No linked bill)</option>
                  {supplierPurchases.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.invoiceNumber} - {formatDate(p.date)} ({formatCurrency(p.grandTotal)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product to Return <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Product</option>
                  {availableItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.sku ? `(${item.sku})` : ''} - ₹{item.rate}/{item.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Quantity <span className="text-rose-500">*</span>
                </label>
                <div className="flex">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={returnQty}
                    onChange={e => setReturnQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                    required
                  />
                  <span className="px-3 py-2 text-xs bg-slate-100 border border-l-0 border-slate-200 rounded-r-lg text-slate-600 font-medium">
                    {selectedItemMeta?.unit || 'Pcs'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Rejection / Return <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Explain defect, damage, rate variance or expiry issue..."
                required
              />
            </div>

            {/* Financial Summary Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Unit Rate:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(unitRate)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Return Subtotal:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(returnSubtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>GST Reversed (18% est.):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(returnTax)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Debit Note Value:</span>
                <span className="text-blue-700">{formatCurrency(returnGrandTotal)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Posting Debit Note...' : 'Confirm & Post Debit Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: View Details */}
      {viewingReturn && (
        <Modal
          isOpen={Boolean(viewingReturn)}
          onClose={() => setViewingReturn(null)}
          title={`Debit Note: ${viewingReturn.returnNumber}`}
          subtitle={`Issued to ${viewingReturn.supplierName} on ${formatDate(viewingReturn.date)}`}
          size="md"
        >
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">Against Bill:</span>
                <span className="font-mono font-bold text-slate-800">{viewingReturn.originalBillNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                <span className="font-semibold text-emerald-700">{viewingReturn.status}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Items Returned:</span>
                <span className="font-medium text-slate-800">{viewingReturn.itemsReturned}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Reason:</span>
                <span className="font-medium text-slate-800">{viewingReturn.reason}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-sm">
              <span className="font-semibold text-blue-900">Credit Claimed:</span>
              <span className="font-bold text-blue-700 text-base tabular-nums">{formatCurrency(viewingReturn.totalCredit)}</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingReturn(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
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

