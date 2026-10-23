import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building,
  CreditCard,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/formatters';
import { Customer, CustomerType } from '../../types';
import { Modal } from '../../components/common/Modal';
import { hasPermission } from '../../utils/rbac';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Customer form state
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

  const resetForm = () => {
    setName('');
    setType('Wholesale');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPan('');
    setState('');
    setCreditLimit('');
    setCreditDays('');
    setOpeningBalance('');
    setNotes('');
    setStatus('Active');
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Auto-open Add Customer modal if navigated from Quick Action (?action=new)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenAdd();
    }
  }, [searchParams]);

  const handleOpenEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCustomer(customer);
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
    setIsModalOpen(true);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      alert('Customer name is required');
      return;
    }

    if (!phone.trim()) {
      alert('Valid phone number is required');
      return;
    }

    // Duplicate Prevention Check: Ensure no other customer has the exact same name or phone
    const trimmedName = name.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const duplicate = customers.find(c => {
      if (editingCustomer && c.id === editingCustomer.id) return false;
      const nameMatch = c.name.trim().toLowerCase() === trimmedName;
      const phoneMatch = Boolean(trimmedPhone && c.phone && c.phone.trim() === trimmedPhone);
      return nameMatch || phoneMatch;
    });

    if (duplicate) {
      if (duplicate.name.trim().toLowerCase() === trimmedName) {
        alert(`A customer with this name already exists: "${duplicate.name}"`);
      } else {
        alert(`A customer with this phone number already exists: "${duplicate.phone}"`);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
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
      } else {
        await addCustomer({
          name: name.trim(),
          type,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          gstin: gstin.trim(),
          pan: pan.trim(),
          state: state.trim(),
          country: 'India',
          creditLimit: Number(creditLimit) || 0,
          creditDays: Number(creditDays) || 0,
          openingBalance: Number(openingBalance) || 0,
          notes: notes.trim(),
          status: 'Active'
        });
      }

      resetForm();
    } catch (err: any) {
      alert(`Error saving customer: ${err?.message || 'Failed to save customer'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8 Table Columns from Prompt #11:
  // Name | Type | Phone | Email | Outstanding | Credit Limit | Status | Actions
  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-[220px]">
            {row.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            GSTIN: {row.gstin || 'Unregistered'}
          </span>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      align: 'center',
      render: row => <StatusBadge status={row.type} size="sm" />
    },
    {
      key: 'phone',
      header: 'Phone',
      render: row => (
        <span className="text-slate-700 font-mono text-[11px]">{row.phone || '—'}</span>
      )
    },
    {
      key: 'email',
      header: 'Email',
      render: row => <span className="text-slate-500 text-xs truncate max-w-[180px] block">{row.email || '—'}</span>
    },
    {
      key: 'currentOutstanding',
      header: 'Outstanding (₹)',
      align: 'right',
      render: row => (
        <span
          className={`font-bold ${
            row.currentOutstanding > (row.creditLimit || 0) && row.creditLimit > 0
              ? 'text-rose-600'
              : 'text-slate-900'
          }`}
        >
          {formatCurrency(row.currentOutstanding)}
        </span>
      )
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      align: 'right',
      render: row => (
        <div>
          <span className="font-medium text-slate-700">{formatCurrency(row.creditLimit)}</span>
          <span className="text-[10px] text-slate-400 block">{row.creditDays} Days</span>
        </div>
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
            <Users className="w-5 h-5 text-blue-600" />
            Customer Relationship & Accounts Receivable
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage client profiles, credit limit enforcement, ledger balances, and payment history.
          </p>
        </div>

        {hasPermission(profile?.role, 'customers', 'create') && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Customer</span>
          </button>
        )}
      </div>

      {/* Customers DataTable */}
      <DataTable
        title="Customer Directory"
        subtitle={`Showing ${customers.length} registered customers`}
        columns={columns}
        data={customers}
        searchPlaceholder="Search customer by name, phone, GSTIN, type..."
        searchKeys={['name', 'phone', 'email', 'gstin', 'type']}
        filters={[
          {
            key: 'type',
            label: 'Customer Type',
            options: [
              { label: 'Corporate', value: 'Corporate' },
              { label: 'Wholesale', value: 'Wholesale' },
              { label: 'Retail', value: 'Retail' },
              { label: 'Dealer', value: 'Dealer' },
              { label: 'Distributor', value: 'Distributor' }
            ]
          }
        ]}
        onRowClick={row => navigate(`/customers/${row.id}`)}
        actions={row => (
          <div className="flex items-center justify-end gap-1">
            {hasPermission(profile?.role, 'customers', 'view') && (
              <button
                onClick={() => navigate(`/customers/${row.id}`)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                title="View Customer Profile 360"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {hasPermission(profile?.role, 'customers', 'edit') && (
              <button
                onClick={e => handleOpenEdit(row, e)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                title="Edit Customer Details"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {hasPermission(profile?.role, 'customers', 'delete') && (
              <button
                onClick={async e => {
                  e.stopPropagation();
                  if (window.confirm(`Delete customer account ${row.name}?`)) {
                    try {
                      await deleteCustomer(row.id);
                    } catch (err: any) {
                      alert(`Failed to delete customer: ${err?.message || 'Error occurred'}`);
                    }
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {/* Customer Modal (Add & Edit) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && resetForm()}
        title={editingCustomer ? 'Edit Customer Account' : 'Register New Customer Account'}
        subtitle={
          editingCustomer
            ? `Update details, credit limits, and contact info for ${editingCustomer.name}`
            : 'Configure billing address, GSTIN, PAN and credit control limits'
        }
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              disabled={isSubmitting}
              onClick={resetForm}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || !name.trim()}
              onClick={handleCustomerSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingCustomer ? 'Update Customer' : 'Save Customer'}</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Customer Name / Business Legal Title <span className="text-rose-500">*</span>
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

            {editingCustomer && (
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
            )}

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
    </div>
  );
};
