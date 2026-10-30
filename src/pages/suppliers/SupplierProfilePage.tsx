import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ShoppingBag,
  RotateCcw,
  Receipt,
  Landmark
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';

export const SupplierProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, purchaseInvoices, payments } = useERP();

  const [activeTab, setActiveTab] = useState<'purchases' | 'payments' | 'ledger'>('purchases');

  const supplier = suppliers.find(s => s.id === id) || suppliers[0];

  const supplierPurchases = useMemo(() => {
    return purchaseInvoices.filter(p => p.supplierId === supplier?.id);
  }, [purchaseInvoices, supplier]);

  const supplierPayments = useMemo(() => {
    return payments.filter(p => p.partyId === supplier?.id);
  }, [payments, supplier]);

  // Supplier Account Ledger
  const ledgerEntries = useMemo(() => {
    if (!supplier) return [];
    const entries: Array<{
      date: string;
      ref: string;
      particulars: string;
      debit: number;
      credit: number;
      balance: number;
    }> = [];

    let running = supplier.openingBalance || 0;
    if (supplier.openingBalance > 0) {
      entries.push({
        date: supplier.createdAt || new Date().toISOString().split('T')[0],
        ref: 'OPENING',
        particulars: 'Opening Payable brought forward',
        debit: 0,
        credit: supplier.openingBalance,
        balance: running
      });
    }

    supplierPurchases.forEach(pur => {
      running += pur.grandTotal;
      entries.push({
        date: pur.date,
        ref: pur.invoiceNumber,
        particulars: `Purchase Bill ${pur.invoiceNumber}`,
        debit: 0,
        credit: pur.grandTotal,
        balance: running
      });
    });

    supplierPayments.forEach(p => {
      running -= p.amount;
      entries.push({
        date: p.date,
        ref: p.paymentNumber,
        particulars: `Payment Made via ${p.paymentMethod}`,
        debit: p.amount,
        credit: 0,
        balance: running
      });
    });

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [supplier, supplierPurchases, supplierPayments]);

  if (!supplier) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p>Supplier profile not found.</p>
        <button
          onClick={() => navigate('/suppliers')}
          className="mt-2 text-blue-600 font-semibold"
        >
          Return to directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/suppliers')}
            className="p-2 rounded-xl border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Back to Suppliers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                {supplier.company}
              </h1>
              <StatusBadge status={supplier.status} size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>Contact: <strong className="text-slate-700 font-medium">{supplier.name}</strong></span>
              {supplier.phone && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>Phone: <span className="font-mono text-slate-700 font-medium">{supplier.phone}</span></span>
                </>
              )}
              {supplier.email && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">{supplier.email}</span>
                </>
              )}
              <span className="text-slate-300">•</span>
              <span>GSTIN: <span className="font-mono text-slate-700">{supplier.gstin || 'Unregistered'}</span></span>
              <span className="text-slate-300">•</span>
              <span>PAN: <span className="font-mono text-slate-700">{supplier.pan || '—'}</span></span>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Purchases
          </span>
          <span className="text-xl font-bold text-slate-900 block">
            {formatCurrency(supplier.totalPurchases)}
          </span>
          <span className="text-[11px] text-slate-500">{supplierPurchases.length} Purchase Bills</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Paid to Supplier
          </span>
          <span className="text-xl font-bold text-emerald-600 block">
            {formatCurrency(supplier.totalPaid)}
          </span>
          <span className="text-[11px] text-slate-500">{supplierPayments.length} Payments Disbursed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Current Outstanding Payable
          </span>
          <span className="text-xl font-bold text-rose-600 block">
            {formatCurrency(supplier.currentOutstanding)}
          </span>
          <span className="text-[11px] text-slate-500">Credit Term: {supplier.creditDays} Days</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-slate-100 bg-slate-50/50">
          {[
            { id: 'purchases', label: `Purchase Bills (${supplierPurchases.length})`, icon: ShoppingBag },
            { id: 'payments', label: `Payment Records (${supplierPayments.length})`, icon: CreditCard },
            { id: 'ledger', label: 'Supplier Account Ledger', icon: Receipt }
          ].map(t => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Purchases */}
        {activeTab === 'purchases' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Bill Number</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Receiving Warehouse</th>
                  <th className="py-2.5 px-3 text-right">Bill Value</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPurchases.map(pur => (
                  <tr key={pur.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {pur.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-3">{formatDate(pur.date)}</td>
                    <td className="py-2.5 px-3 font-mono">{pur.warehouse}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(pur.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                      {formatCurrency(pur.paidAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={pur.paymentStatus} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Payments */}
        {activeTab === 'payments' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3">Reference / UTR</th>
                  <th className="py-2.5 px-3 text-right">Amount Disbursed</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {p.paymentNumber}
                    </td>
                    <td className="py-2.5 px-3">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3">{p.paymentMethod}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.reference}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Ledger */}
        {activeTab === 'ledger' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Ref</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 text-right">Debit (Paid)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Purchases)</th>
                  <th className="py-2.5 px-3 text-right">Payable Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ledgerEntries.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(row.date)}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600">{row.ref}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-800">{row.particulars}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-semibold">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-600">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
