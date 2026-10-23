import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  CreditCard,
  AlertTriangle,
  Receipt,
  FileText,
  RotateCcw,
  CheckCircle,
  Plus,
  Printer,
  Pencil,
  Trash2,
  HelpCircle,
  ShieldAlert,
  Clock,
  Package
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { Modal } from '../../components/common/Modal';
import { SalesInvoice, CustomerType, CustomerSupportCase } from '../../types';
import { hasPermission } from '../../utils/rbac';
import { CustomerSupportModal } from '../../components/customers/CustomerSupportModal';
import { customerSupportService } from '../../services/customerSupportService';

export const CustomerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const caseIdParam = searchParams.get('caseId');
  const { profile } = useAuth();
  const { customers, updateCustomer, deleteCustomer, salesInvoices, payments, company } = useERP();

  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'ledger' | 'returns' | 'support'>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Customer support cases state
  const [supportCases, setSupportCases] = useState<CustomerSupportCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<CustomerSupportCase | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Edit customer modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomerType>('Wholesale');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [state, setState] = useState('');
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [creditDays, setCreditDays] = useState<string>('');
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Blocked'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customer = customers.find(c => c.id === id) || customers[0];

  const handleOpenEdit = () => {
    if (!customer) return;
    setName(customer.name || '');
    setType(customer.type || 'Wholesale');
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setGstin(customer.gstin || '');
    setPan(customer.pan || '');
    setState(customer.state || '');
    setCreditLimit(customer.creditLimit ? String(customer.creditLimit) : '');
    setCreditDays(customer.creditDays ? String(customer.creditDays) : '');
    setOpeningBalance(customer.openingBalance ? String(customer.openingBalance) : '');
    setNotes(customer.notes || '');
    setStatus(customer.status || 'Active');
    setIsEditModalOpen(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !customer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateCustomer(customer.id, {
        name: name.trim(),
        type,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        pan: pan.trim(),
        state: state.trim(),
        creditLimit: Number(creditLimit) || 0,
        creditDays: Number(creditDays) || 0,
        openingBalance: Number(openingBalance) || 0,
        notes: notes.trim(),
        status
      });
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(`Error updating customer: ${err?.message || 'Failed to update'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    if (window.confirm(`Are you sure you want to permanently delete customer account "${customer.name}"?`)) {
      try {
        await deleteCustomer(customer.id);
        navigate('/customers');
      } catch (err: any) {
        alert(`Failed to delete customer: ${err?.message || 'Error occurred'}`);
      }
    }
  };

  // Invoices for this customer
  const customerInvoices = useMemo(() => {
    return salesInvoices.filter(inv => inv.customerId === customer?.id);
  }, [salesInvoices, customer]);

  // Payments for this customer
  const customerPayments = useMemo(() => {
    return payments.filter(p => p.partyId === customer?.id);
  }, [payments, customer]);

  // Load support cases and listen for deep-linked caseId
  useEffect(() => {
    let isMounted = true;
    const loadCases = async () => {
      try {
        const cases = await customerSupportService.getSupportCases(
          company?.id,
          profile?.id,
          profile?.role
        );
        if (isMounted) {
          setSupportCases(cases);
          if (caseIdParam) {
            setActiveTab('support');
            const found = cases.find(c => c.id === caseIdParam);
            if (found) {
              setSelectedCase(found);
              setIsSupportModalOpen(true);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load support cases:', err);
      }
    };
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [company?.id, profile?.id, profile?.role, caseIdParam]);

  const customerCases = useMemo(() => {
    if (!customer) return [];
    return supportCases.filter(c => c.customerId === customer.id);
  }, [supportCases, customer]);

  // Generate complete running ledger for customer
  const ledgerEntries = useMemo(() => {
    if (!customer) return [];
    const entries: Array<{
      date: string;
      ref: string;
      particulars: string;
      debit: number;
      credit: number;
      balance: number;
    }> = [];

    let running = customer.openingBalance || 0;
    if (customer.openingBalance > 0) {
      entries.push({
        date: customer.createdAt || new Date().toISOString().split('T')[0],
        ref: 'OPENING',
        particulars: 'Opening Balance brought forward',
        debit: customer.openingBalance,
        credit: 0,
        balance: running
      });
    }

    // Invoices (Debit)
    customerInvoices.forEach(inv => {
      running += inv.grandTotal;
      entries.push({
        date: inv.date,
        ref: inv.invoiceNumber,
        particulars: `Sales Invoice ${inv.invoiceNumber} (${inv.items.length} items)`,
        debit: inv.grandTotal,
        credit: 0,
        balance: running
      });
    });

    // Payments (Credit)
    customerPayments.forEach(p => {
      running -= p.amount;
      entries.push({
        date: p.date,
        ref: p.paymentNumber,
        particulars: `Payment Received via ${p.paymentMethod} (Ref: ${p.reference || 'Direct'})`,
        debit: 0,
        credit: p.amount,
        balance: running
      });
    });

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [customer, customerInvoices, customerPayments]);

  if (!customer) {
    return (
      <div className="p-12 text-center text-slate-500">
        <p>Customer profile not found.</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-2 text-blue-600 font-semibold"
        >
          Return to directory
        </button>
      </div>
    );
  }

  const creditUsedPct =
    customer.creditLimit > 0
      ? Math.min(100, Math.round((customer.currentOutstanding / customer.creditLimit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{customer.name}</h1>
              <StatusBadge status={customer.type} size="sm" />
              <StatusBadge status={customer.status} size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              GSTIN: {customer.gstin || 'Unregistered'} • PAN: {customer.pan || '—'} • State:{' '}
              {customer.state}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(profile?.role, 'customers', 'edit') && (
            <button
              onClick={handleOpenEdit}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit Profile</span>
            </button>
          )}

          {hasPermission(profile?.role, 'payments', 'create') && (
            <button
              onClick={() => navigate('/payments')}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Payment</span>
            </button>
          )}

          {hasPermission(profile?.role, 'sales', 'create') && profile?.role !== 'Salesperson' && (
            <button
              onClick={() => navigate('/sales/new')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Invoice</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedCase(null);
              setIsSupportModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Support & Complaints</span>
          </button>

          {hasPermission(profile?.role, 'customers', 'delete') && (
            <button
              onClick={handleDeleteCustomer}
              className="px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete Customer Account"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer 360 KPIs & Credit Bar (Prompt #11) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Invoiced Purchases
          </span>
          <span className="text-xl font-bold text-slate-900 block">
            {formatCurrency(customer.totalPurchased)}
          </span>
          <span className="text-[11px] text-slate-500">{customerInvoices.length} Invoices</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Current Outstanding Balance
          </span>
          <span
            className={`text-xl font-bold block ${
              customer.currentOutstanding > customer.creditLimit && customer.creditLimit > 0
                ? 'text-rose-600'
                : 'text-amber-600'
            }`}
          >
            {formatCurrency(customer.currentOutstanding)}
          </span>
          <span className="text-[11px] text-slate-500">Unsettled receivables</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Payments Cleared
          </span>
          <span className="text-xl font-bold text-emerald-600 block">
            {formatCurrency(customer.totalPaid)}
          </span>
          <span className="text-[11px] text-slate-500">{customerPayments.length} Payment Receipts</span>
        </div>

        {/* Credit Limit Usage Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Credit Limit Utilization</span>
            <span className="font-mono font-bold text-slate-900">{creditUsedPct}%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                creditUsedPct >= 100
                  ? 'bg-rose-500'
                  : creditUsedPct >= 75
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${creditUsedPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Limit: {formatCurrency(customer.creditLimit)}</span>
            <span>Terms: {customer.creditDays} Days</span>
          </div>
        </div>
      </div>

      {/* Tabs: Invoices, Payments, General Ledger, Returns */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-slate-100 bg-slate-50/50">
          {[
            { id: 'invoices', label: profile?.role === 'Salesperson' ? `Purchase History & Orders (${customerInvoices.length})` : `Invoices (${customerInvoices.length})`, icon: FileText },
            { id: 'support', label: `Support & Complaints (${customerCases.length})`, icon: HelpCircle },
            ...(profile?.role !== 'Salesperson'
              ? [
                  { id: 'payments', label: `Payments (${customerPayments.length})`, icon: CreditCard },
                  { id: 'ledger', label: 'Customer Account Ledger', icon: Receipt },
                  { id: 'returns', label: 'Returns & Credit Notes', icon: RotateCcw }
                ]
              : [])
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

        {/* Tab 1: Invoices */}
        {activeTab === 'invoices' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{formatDate(inv.date)}</td>
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{inv.items.length}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={inv.paymentStatus} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsPrintOpen(true);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        title="Print / View"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
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
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Reference / UTR</th>
                  <th className="py-2.5 px-3 text-right">Amount Received</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {p.paymentNumber}
                    </td>
                    <td className="py-2.5 px-3">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{p.paymentMethod}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.reference}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: General Ledger */}
        {activeTab === 'ledger' && (
          <div className="p-4 overflow-x-auto">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-900">Chronological Account Statement</span>
              <button
                onClick={() => window.print()}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3 text-right">Debit (Sales)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Receipts)</th>
                  <th className="py-2.5 px-3 text-right">Balance Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ledgerEntries.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(row.date)}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600">{row.ref}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-800">{row.particulars}</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-semibold">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Returns */}
        {activeTab === 'returns' && (
          <div className="p-8 text-center text-xs text-slate-400">
            <RotateCcw className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No active return disputes</p>
            <p className="text-slate-400 mt-0.5">
              All deliveries accepted without quality rejections.
            </p>
          </div>
        )}

        {/* Tab 5: Customer Support, Complaints & Follow-ups */}
        {activeTab === 'support' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Support Cases & Complaints
                </h3>
                <p className="text-[11px] text-slate-500">
                  Track customer feedback, quality disputes, product defects, and follow-ups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCase(null);
                  setIsSupportModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Support Case</span>
              </button>
            </div>

            {customerCases.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No support cases or complaints on record</p>
                <p className="text-slate-400 mt-0.5">
                  Click &ldquo;Log Support Case&rdquo; to record a complaint, product defect, return request, or follow-up reminder.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Case #</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Title & Issue</th>
                      <th className="py-2.5 px-3">Relevant Product</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Follow-up Due</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerCases.map(cs => {
                      const isComplaint = cs.category === 'customer_complaint';
                      const isHighPriority = cs.priority === 'High' || isComplaint;

                      return (
                        <tr key={cs.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {cs.caseNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {isHighPriority && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                                  <ShieldAlert className="w-2.5 h-2.5" /> High
                                </span>
                              )}
                              <span className="text-[11px] font-medium text-slate-700">
                                {cs.category === 'customer_complaint'
                                  ? 'Complaint'
                                  : cs.category === 'customer_product_damage'
                                  ? 'Product Damage'
                                  : cs.category === 'customer_return_request'
                                  ? 'Return Request'
                                  : cs.category === 'customer_followup'
                                  ? 'Follow-up'
                                  : 'Support Request'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <p className="font-semibold text-slate-900 truncate">{cs.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">{cs.description}</p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {cs.productName ? (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Package className="w-3 h-3 text-slate-400" />
                                {cs.productName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cs.status === 'Resolved' || cs.status === 'Closed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : cs.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {cs.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {cs.followupDue ? (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <Clock className="w-3 h-3 text-amber-500" />
                                {new Date(cs.followupDue).toLocaleDateString()}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCase(cs);
                                setIsSupportModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Manage Case
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
        )}
      </div>

      <InvoicePrintModal
        invoice={selectedInvoice}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />

      {/* Edit Customer Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title="Edit Customer Profile"
        subtitle={`Update details and credit terms for ${customer.name}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              disabled={isSubmitting}
              onClick={() => setIsEditModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || !name.trim()}
              onClick={handleUpdateSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Update Customer</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Customer Name / Legal Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Metro Construction & Infra Ltd."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer Classification</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as CustomerType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="Corporate">Corporate</option>
                <option value="Wholesale">Wholesale</option>
                <option value="Retail">Retail</option>
                <option value="Dealer">Dealer</option>
                <option value="Distributor">Distributor</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Account Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Inactive' | 'Blocked')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-medium"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Mobile / Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98200 11223"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="billing@customer.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">GSTIN (15 Digits)</label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAACM1234F1Z1"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Credit Limit (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={creditLimit}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setCreditLimit('');
                    return;
                  }
                  if (raw.includes('-')) return;
                  const sanitized = raw.replace(/^0+(?=\d)/, '');
                  setCreditLimit(sanitized);
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Credit Days Period</label>
              <input
                type="number"
                min="0"
                step="1"
                value={creditDays}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setCreditDays('');
                    return;
                  }
                  if (raw.includes('-')) return;
                  const sanitized = raw.replace(/^0+(?=\d)/, '');
                  setCreditDays(sanitized);
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={openingBalance}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setOpeningBalance('');
                    return;
                  }
                  if (raw.includes('-')) return;
                  const sanitized = raw.replace(/^0+(?=\d)/, '');
                  setOpeningBalance(sanitized);
                }}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Billing & Delivery Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Office / Site Address, Mumbai"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Customer Support & Complaint Management Modal */}
      <CustomerSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => {
          setIsSupportModalOpen(false);
          setSelectedCase(null);
        }}
        customer={customer}
        existingCase={selectedCase}
        onCaseCreated={newCase => {
          setSupportCases(prev => [newCase, ...prev]);
        }}
        onCaseUpdated={upd => {
          setSupportCases(prev => prev.map(c => (c.id === upd.id ? upd : c)));
          setSelectedCase(upd);
        }}
      />
    </div>
  );
};
