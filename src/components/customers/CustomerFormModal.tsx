import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useERP } from '../../context/ERPContext';
import { Customer, CustomerType } from '../../types';
import { AlertCircle, Check, Users } from 'lucide-react';

export interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
  onSuccess?: (message: string) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  customerToEdit,
  onSuccess
}) => {
  const { customers, addCustomer, updateCustomer } = useERP();

  const isEditMode = Boolean(customerToEdit);

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomerType>('Retail');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [creditLimit, setCreditLimit] = useState<string>('0');
  const [creditDays, setCreditDays] = useState<string>('30');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Blocked'>('Active');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setType(customerToEdit.type || 'Retail');
      setPhone(customerToEdit.phone || '');
      setEmail(customerToEdit.email || '');
      setAddress(customerToEdit.address || '');
      setState(customerToEdit.state || '');
      setGstin(customerToEdit.gstin || '');
      setPan(customerToEdit.pan || '');
      setCreditLimit(String(customerToEdit.creditLimit || 0));
      setCreditDays(String(customerToEdit.creditDays || 30));
      setStatus(customerToEdit.status || 'Active');
      setNotes(customerToEdit.notes || '');
    } else {
      setName('');
      setType('Retail');
      setPhone('');
      setEmail('');
      setAddress('');
      setState('');
      setGstin('');
      setPan('');
      setCreditLimit('0');
      setCreditDays('30');
      setStatus('Active');
      setNotes('');
    }
    setErrorMsg(null);
  }, [customerToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Customer Name is required.');
      return;
    }

    // Check duplicate customer name (avoid duplicate records)
    const isDuplicate = customers.some(
      c =>
        c.name.trim().toLowerCase() === cleanName.toLowerCase() &&
        (!customerToEdit || c.id !== customerToEdit.id)
    );
    if (isDuplicate) {
      setErrorMsg(`A customer named "${cleanName}" already exists.`);
      return;
    }

    const cleanEmail = email.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin && cleanGstin.length !== 15) {
      setErrorMsg('GSTIN must be 15 alphanumeric characters.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditMode && customerToEdit) {
        await updateCustomer(customerToEdit.id, {
          name: cleanName,
          type,
          phone: phone.trim(),
          email: cleanEmail,
          address: address.trim(),
          state: state.trim(),
          gstin: cleanGstin,
          pan: pan.trim().toUpperCase(),
          creditLimit: parseFloat(creditLimit) || 0,
          creditDays: parseInt(creditDays, 10) || 30,
          status,
          notes: notes.trim()
        });

        if (onSuccess) onSuccess(`Customer "${cleanName}" updated successfully.`);
      } else {
        await addCustomer({
          name: cleanName,
          type,
          phone: phone.trim(),
          email: cleanEmail,
          address: address.trim(),
          state: state.trim(),
          country: 'India',
          gstin: cleanGstin,
          pan: pan.trim().toUpperCase(),
          creditLimit: parseFloat(creditLimit) || 0,
          creditDays: parseInt(creditDays, 10) || 30,
          openingBalance: 0,
          status,
          notes: notes.trim()
        });

        if (onSuccess) onSuccess(`Customer "${cleanName}" created successfully.`);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save customer details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Customer Details' : 'Add New Customer'}
      subtitle={isEditMode ? `Update records for ${customerToEdit?.name}` : 'Create a new customer account'}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400">
            <span className="text-rose-500">*</span> Mandatory fields
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !name.trim()}
              onClick={handleSubmit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Save Changes' : 'Create Customer'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Name and Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Enterprises or John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Customer Type
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as CustomerType)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Dealer">Dealer / Shop</option>
            </select>
          </div>
        </div>

        {/* Phone and Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. billing@acme.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Address and State */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Address
            </label>
            <input
              type="text"
              placeholder="Street address, building, locality..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              State / Region
            </label>
            <input
              type="text"
              placeholder="e.g. Maharashtra"
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* GSTIN and PAN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              GST Number (GSTIN)
            </label>
            <input
              type="text"
              maxLength={15}
              placeholder="15-character GSTIN (optional)"
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              PAN Number
            </label>
            <input
              type="text"
              maxLength={10}
              placeholder="10-character PAN (optional)"
              value={pan}
              onChange={e => setPan(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
            />
          </div>
        </div>

        {/* Credit Limit, Credit Days, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Credit Limit (₹)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={creditLimit}
              onChange={e => setCreditLimit(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Credit Days
            </label>
            <input
              type="number"
              min="0"
              placeholder="30"
              value={creditDays}
              onChange={e => setCreditDays(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            Internal Remarks / Notes
          </label>
          <textarea
            rows={2}
            placeholder="Special commercial terms, contact instructions, or payment history remarks..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};

