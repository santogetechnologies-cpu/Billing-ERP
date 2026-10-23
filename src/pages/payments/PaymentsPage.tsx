import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  User,
  Building2,
  Calendar,
  CheckCircle,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PaymentRecord, PaymentMethod, SalesInvoice } from '../../types';
import { Modal } from '../../components/common/Modal';
import { PaymentDetailModal } from '../../components/payment/PaymentDetailModal';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';

export const PaymentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetPaymentId = searchParams.get('paymentId') || searchParams.get('id');
  const targetPaymentNumber = searchParams.get('paymentNumber');
  const targetInvoiceId = searchParams.get('invoiceId');

  const { payments, customers, suppliers, recordPayment, salesInvoices } = useERP();

  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [associatedInvoiceModal, setAssociatedInvoiceModal] = useState<SalesInvoice | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'Received' | 'Paid'>('Received');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [account, setAccount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-open target payment if navigated from notification
  const openedTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const targetKey = targetPaymentId || targetPaymentNumber || targetInvoiceId;
    if (targetKey && payments.length > 0 && openedTargetRef.current !== targetKey) {
      let match: PaymentRecord | undefined;
      if (targetPaymentId) {
        match = payments.find(p => p.id === targetPaymentId);
      } else if (targetPaymentNumber) {
        match = payments.find(p => p.paymentNumber.toLowerCase() === targetPaymentNumber.toLowerCase());
      } else if (targetInvoiceId) {
        const related = payments.filter(p => p.invoiceId === targetInvoiceId);
        if (related.length === 1) {
          match = related[0];
        }
      }
      if (match) {
        openedTargetRef.current = targetKey;
        setSelectedPayment(match);
        setIsDetailOpen(true);
      }
    }
  }, [targetPaymentId, targetPaymentNumber, targetInvoiceId, payments]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let partyName = 'Party';
      let partyType: PaymentRecord['partyType'] = 'Customer';

      if (paymentType === 'Received') {
        partyType = 'Customer';
        const c = customers.find(cust => cust.id === selectedPartyId);
        partyName = c ? c.name : 'Counter Customer';
      } else {
        partyType = 'Supplier';
        const s = suppliers.find(sup => sup.id === selectedPartyId);
        partyName = s ? s.company || s.name : 'Vendor';
      }

      await recordPayment({
        type: paymentType,
        partyType,
        partyId: selectedPartyId,
        partyName,
        amount: numAmount,
        date,
        paymentMethod,
        account: account || paymentMethod,
        reference: reference.trim() || '',
        notes: notes.trim()
      });

      setIsModalOpen(false);
      setAmount('');
      setReference('');
      setNotes('');
    } catch (err: any) {
      alert(`Error recording payment: ${err?.message || 'Failed to record payment'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<PaymentRecord>[] = [
    {
      key: 'paymentNumber',
      header: 'Voucher #',
      render: row => (
        <span className="font-mono font-bold text-blue-600">{row.paymentNumber}</span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'type',
      header: 'Type',
      align: 'center',
      render: row => (
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
            row.type === 'Received'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {row.type === 'Received' ? (
            <ArrowDownLeft className="w-3.5 h-3.5" />
          ) : (
            <ArrowUpRight className="w-3.5 h-3.5" />
          )}
          {row.type}
        </span>
      )
    },
    {
      key: 'partyName',
      header: 'Party (Customer / Supplier)',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-[200px]">
            {row.partyName}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{row.partyType}</span>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount (₹)',
      align: 'right',
      render: row => (
        <span
          className={`font-black text-xs ${
            row.type === 'Received' ? 'text-emerald-600' : 'text-slate-900'
          }`}
        >
          {formatCurrency(row.amount)}
        </span>
      )
    },
    {
      key: 'paymentMethod',
      header: 'Payment Mode',
      render: row => (
        <span className="text-[11px] text-slate-700 font-medium px-2 py-0.5 bg-slate-100 rounded">
          {row.paymentMethod}
        </span>
      )
    },
    {
      key: 'reference',
      header: 'Ref / UTR',
      render: row => <span className="font-mono text-slate-500 text-[11px]">{row.reference}</span>
    },
    {
      key: 'account',
      header: 'Deposited / Paid From',
      render: row => <span className="text-slate-600 text-[11px] truncate max-w-[160px] block">{row.account}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            Unified Payment Management Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Receive payments from customers, disburse supplier settlements, and record banking transaction receipts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* Table */}
      <DataTable
        title="Payment & Settlement Registry"
        subtitle={`Total ${payments.length} transactions recorded`}
        columns={columns}
        data={payments}
        searchPlaceholder="Search voucher #, party name, UTR reference..."
        searchKeys={['paymentNumber', 'partyName', 'reference', 'paymentMethod']}
        filters={[
          {
            key: 'type',
            label: 'Transaction Type',
            options: [
              { label: 'Received (Customer)', value: 'Received' },
              { label: 'Paid (Supplier)', value: 'Paid' }
            ]
          }
        ]}
        onRowClick={row => {
          setSelectedPayment(row);
          setIsDetailOpen(true);
        }}
        actions={row => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedPayment(row);
                setIsDetailOpen(true);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="View Payment Receipt / Voucher"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {/* Record Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Record Payment Transaction"
        subtitle="Settle customer receivables or disburse supplier accounts payable"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              disabled={isSubmitting}
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || Number(amount) <= 0}
              onClick={handleRecordSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Posting...</span>
                </>
              ) : (
                <span>Post Payment</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Receive vs Pay toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setPaymentType('Received');
                setSelectedPartyId(customers[0]?.id || '');
              }}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                paymentType === 'Received'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span>Receive Payment (Customer)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentType('Paid');
                setSelectedPartyId(suppliers[0]?.id || '');
              }}
              className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                paymentType === 'Paid'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
              <span>Make Payment (Supplier)</span>
            </button>
          </div>

          {/* Party Selector */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Select {paymentType === 'Received' ? 'Customer' : 'Supplier'}
            </label>
            <select
              value={selectedPartyId}
              onChange={e => setSelectedPartyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold cursor-pointer"
            >
              {paymentType === 'Received'
                ? customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Outstanding: {formatCurrency(c.currentOutstanding)}
                    </option>
                  ))
                : suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company} — Payable: {formatCurrency(s.currentOutstanding)}
                    </option>
                  ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={amount}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setAmount(''); return; }
                  if (raw.includes('-')) return;
                  setAmount(raw.replace(/^0+(?=\d)/, ''));
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium cursor-pointer"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI Instant</option>
                <option value="Cash">Cash</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Banking Account</label>
              <select
                value={account}
                onChange={e => setAccount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="HDFC Bank - 50200049281729">HDFC Corporate Bank A/C</option>
                <option value="Main Cash Drawer">Main Cash Drawer</option>
                <option value="Petty Cash Float">Petty Cash Float</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              UTR Reference / Cheque No / Transaction ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. UTR/HDFC/29102840 or UPI/6281928"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Settlement remarks..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </Modal>

      {/* Payment Details Voucher Modal */}
      <PaymentDetailModal
        isOpen={isDetailOpen}
        payment={selectedPayment}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedPayment(null);
        }}
        onViewInvoice={inv => {
          setAssociatedInvoiceModal(inv);
        }}
      />

      {/* Associated Invoice Print & Details Modal */}
      <InvoicePrintModal
        isOpen={!!associatedInvoiceModal}
        invoice={associatedInvoiceModal}
        onClose={() => setAssociatedInvoiceModal(null)}
      />
    </div>
  );
};
