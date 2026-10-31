import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  Eye,
  ArrowUpRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { PaymentMethod } from '../../types';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const PurchasePaymentsMadeTab: React.FC = () => {
  const { payments = [], purchaseInvoices = [], suppliers = [], recordPurchasePayment } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [account, setAccount] = useState('Primary Bank Account');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);

  // Supplier outward payments
  const outwardPayments = useMemo(() => {
    return payments
      .filter(p => p.type === 'Paid' || p.partyType === 'Supplier')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments]);

  // Outstanding bills for the selected supplier
  const unpaidBills = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchaseInvoices.filter(
      b => b.supplierId === selectedSupplierId &&
      (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') &&
      b.docType !== 'purchase_return'
    );
  }, [purchaseInvoices, selectedSupplierId]);

  const activeBill = useMemo(() => {
    return unpaidBills.find(b => b.id === selectedInvoiceId);
  }, [unpaidBills, selectedInvoiceId]);

  const activeBalanceDue = activeBill ? Math.max(0, activeBill.grandTotal - (activeBill.paidAmount || 0)) : 0;

  // Total supplier payables across all bills
  const totalOutstandingPayables = useMemo(() => {
    return purchaseInvoices
      .filter(b => b.docType !== 'purchase_return')
      .reduce((acc, b) => acc + Math.max(0, b.grandTotal - (b.paidAmount || 0)), 0);
  }, [purchaseInvoices]);

  const totalPaidSupplierAmount = useMemo(() => {
    return outwardPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [outwardPayments]);

  const handleOpenModal = () => {
    const firstSupplierWithDue = suppliers.find(s =>
      purchaseInvoices.some(b => b.supplierId === s.id && b.paymentStatus !== 'Paid' && b.docType !== 'purchase_return')
    ) || suppliers[0];

    const supId = firstSupplierWithDue?.id || '';
    setSelectedSupplierId(supId);

    const firstDueBill = purchaseInvoices.find(
      b => b.supplierId === supId && (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') && b.docType !== 'purchase_return'
    );

    setSelectedInvoiceId(firstDueBill?.id || '');
    if (firstDueBill) {
      const due = Math.max(0, firstDueBill.grandTotal - (firstDueBill.paidAmount || 0));
      setAmount(due > 0 ? due.toString() : '');
    } else {
      setAmount('');
    }

    setPaymentMethod('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setNotes('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (!selectedInvoiceId) {
      setErrorMessage('Please select an outstanding supplier bill.');
      return;
    }
    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (activeBill && numAmount > activeBalanceDue + 0.01) {
      setErrorMessage(`Payment amount cannot exceed the balance due of ${formatCurrency(activeBalanceDue)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      await recordPurchasePayment({
        purchaseId: selectedInvoiceId,
        amount: numAmount,
        paymentMethod,
        date: paymentDate,
        reference: reference.trim() || undefined,
        account,
        notes: notes.trim() || undefined
      });

      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to record supplier payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const data = outwardPayments.map(p => ({
      'Voucher #': p.paymentNumber || p.id.slice(0, 8),
      'Date': p.date,
      'Supplier': p.partyName,
      'Payment Method': p.paymentMethod,
      'Account': p.account || 'Bank',
      'Reference': p.reference || '-',
      'Amount': p.amount,
      'Notes': p.notes || ''
    }));
    exportToCSV(data, 'Supplier_Disbursements');
  };

  const handleExportXLSX = () => {
    const data = outwardPayments.map(p => ({
      'Voucher #': p.paymentNumber || p.id.slice(0, 8),
      'Date': p.date,
      'Supplier': p.partyName,
      'Payment Method': p.paymentMethod,
      'Account': p.account || 'Bank',
      'Reference': p.reference || '-',
      'Amount': p.amount,
      'Notes': p.notes || ''
    }));
    exportToExcel(data, 'Supplier_Disbursements');
  };

  const columns: Column<any>[] = [
    {
      key: 'paymentNumber',
      header: 'Voucher #',
      render: row => (
        <span className="font-mono font-bold text-blue-600">
          {row.paymentNumber || `PV-${row.id.slice(0, 6).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'partyName',
      header: 'Supplier',
      render: row => <span className="font-semibold text-slate-900">{row.partyName}</span>
    },
    {
      key: 'paymentMethod',
      header: 'Payment Mode',
      render: row => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
          {row.paymentMethod}
        </span>
      )
    },
    {
      key: 'reference',
      header: 'Ref / UTR',
      render: row => <span className="font-mono text-xs text-slate-600">{row.reference || '—'}</span>
    },
    {
      key: 'account',
      header: 'Account',
      render: row => <span className="text-xs text-slate-500">{row.account || 'Primary Bank'}</span>
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      align: 'right',
      render: row => (
        <span className="font-bold text-rose-600 tabular-nums">
          - {formatCurrency(row.amount)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Top metrics summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Paid to Suppliers</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(totalPaidSupplierAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{outwardPayments.length} payment vouchers issued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Outstanding Payables</span>
          <div className="text-xl font-bold text-amber-600 mt-1 tabular-nums">
            {formatCurrency(totalOutstandingPayables)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Across all pending supplier bills</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 sm:col-span-2 lg:col-span-1 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Quick Disbursement</span>
            <p className="text-xs text-slate-600 mt-1">Make direct payment against an approved supplier bill.</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Supplier Payments & Disbursements
          </h2>
          <p className="text-xs text-slate-500">
            Outward payment vouchers, bank transfers, cheques, and cash disbursements to vendors.
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
        </div>
      </div>

      <DataTable
        title="Supplier Payment History"
        subtitle={`Total ${outwardPayments.length} payment records`}
        columns={columns}
        data={outwardPayments}
        searchPlaceholder="Search voucher #, supplier, or reference..."
        searchKeys={['paymentNumber', 'partyName', 'reference', 'account']}
        onRowClick={row => setViewingPayment(row)}
        actions={row => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingPayment(row);
            }}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            title="View Voucher"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      />

      {/* Modal: Record Supplier Payment */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Record Supplier Payment"
          subtitle="Disburse funds against an outstanding purchase bill."
          size="lg"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
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
                    const supId = e.target.value;
                    setSelectedSupplierId(supId);
                    const bills = purchaseInvoices.filter(
                      b => b.supplierId === supId && (b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid') && b.docType !== 'purchase_return'
                    );
                    setSelectedInvoiceId(bills[0]?.id || '');
                    if (bills[0]) {
                      const due = Math.max(0, bills[0].grandTotal - (bills[0].paidAmount || 0));
                      setAmount(due.toString());
                    } else {
                      setAmount('');
                    }
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
                  Outstanding Purchase Bill <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={e => {
                    const invId = e.target.value;
                    setSelectedInvoiceId(invId);
                    const bill = unpaidBills.find(b => b.id === invId);
                    if (bill) {
                      const due = Math.max(0, bill.grandTotal - (bill.paidAmount || 0));
                      setAmount(due.toString());
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {unpaidBills.length === 0 ? (
                    <option value="">No pending bills for this supplier</option>
                  ) : (
                    unpaidBills.map(b => {
                      const due = Math.max(0, b.grandTotal - (b.paidAmount || 0));
                      return (
                        <option key={b.id} value={b.id}>
                          {b.invoiceNumber} — Total: {formatCurrency(b.grandTotal)} (Due: {formatCurrency(due)})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            {activeBill && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-blue-700 font-semibold block">Bill: {activeBill.invoiceNumber}</span>
                  <span className="text-blue-500">Total: {formatCurrency(activeBill.grandTotal)} • Paid so far: {formatCurrency(activeBill.paidAmount || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Balance Due:</span>
                  <span className="font-bold text-blue-900 text-sm">{formatCurrency(activeBalanceDue)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount to Pay (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums font-semibold"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank / Cash Account
                </label>
                <input
                  type="text"
                  value={account}
                  onChange={e => setAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. HDFC Current Account"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / UTR / Cheque #
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. UTR12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes or remittance details..."
              />
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
                disabled={isSubmitting || !selectedInvoiceId}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Recording...' : 'Confirm & Disburse'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: View Payment Voucher */}
      {viewingPayment && (
        <Modal
          isOpen={Boolean(viewingPayment)}
          onClose={() => setViewingPayment(null)}
          title={`Payment Voucher: ${viewingPayment.paymentNumber || viewingPayment.id.slice(0, 8)}`}
          subtitle={`Paid to ${viewingPayment.partyName} on ${formatDate(viewingPayment.date)}`}
          size="md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-semibold text-slate-900">{viewingPayment.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-medium text-slate-800">{formatDate(viewingPayment.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-blue-700">{viewingPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference / UTR:</span>
                <span className="font-mono text-slate-800">{viewingPayment.reference || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disbursed From:</span>
                <span className="text-slate-800">{viewingPayment.account || 'Primary Bank'}</span>
              </div>
              {viewingPayment.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Notes:</span>
                  <span className="text-slate-700 italic">{viewingPayment.notes}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-sm">
              <span className="font-semibold text-emerald-900">Amount Disbursed:</span>
              <span className="font-bold text-emerald-700 text-lg tabular-nums">
                {formatCurrency(viewingPayment.amount)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPayment(null)}
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

