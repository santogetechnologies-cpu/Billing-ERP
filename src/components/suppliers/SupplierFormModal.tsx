import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useERP } from '../../context/ERPContext';
import { Supplier } from '../../types';
import { AlertCircle, Check, Building2 } from 'lucide-react';

export interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSuccess?: (message: string) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplierToEdit,
  onSuccess
}) => {
  const { suppliers, addSupplier, updateSupplier } = useERP();

  const isEditMode = Boolean(supplierToEdit);

  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [creditDays, setCreditDays] = useState<string>('30');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [notes, setNotes] = useState('');

  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (supplierToEdit) {
      setCompany(supplierToEdit.company || supplierToEdit.name || '');
      setName(supplierToEdit.name || '');
      setPhone(supplierToEdit.phone || '');
      setEmail(supplierToEdit.email || '');
      setAddress(supplierToEdit.address || '');
      setState(supplierToEdit.state || '');
      setGstin(supplierToEdit.gstin || '');
      setPan(supplierToEdit.pan || '');
      setCreditDays(String(supplierToEdit.creditDays || 30));
      setStatus(supplierToEdit.status || 'Active');
      setNotes(supplierToEdit.notes || '');
      setBankName(supplierToEdit.bankDetails?.bankName || '');
      setAccountNumber(supplierToEdit.bankDetails?.accountNumber || '');
      setIfsc(supplierToEdit.bankDetails?.ifsc || '');
    } else {
      setCompany('');
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setState('');
      setGstin('');
      setPan('');
      setCreditDays('30');
      setStatus('Active');
      setNotes('');
      setBankName('');
      setAccountNumber('');
      setIfsc('');
    }
    setErrorMsg(null);
  }, [supplierToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCompany = company.trim();
    if (!cleanCompany) {
      setErrorMsg('Supplier / Company Legal Name is required.');
      return;
    }

    // Duplicate check
    const isDuplicate = suppliers.some(
      s =>
        (s.company?.trim().toLowerCase() === cleanCompany.toLowerCase() ||
         s.name?.trim().toLowerCase() === cleanCompany.toLowerCase()) &&
        (!supplierToEdit || s.id !== supplierToEdit.id)
    );
    if (isDuplicate) {
      setErrorMsg(`A supplier named "${cleanCompany}" already exists.`);
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

      const bankDetailsObj = bankName.trim() || accountNumber.trim() || ifsc.trim()
        ? {
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            accountName: cleanCompany
          }
        : undefined;

      if (isEditMode && supplierToEdit) {
        await updateSupplier(supplierToEdit.id, {
          company: cleanCompany,
          name: name.trim() || cleanCompany,
          phone: phone.trim(),
          email: cleanEmail,
          address: address.trim(),
          state: state.trim(),
          gstin: cleanGstin,
          pan: pan.trim().toUpperCase(),
          creditDays: parseInt(creditDays, 10) || 30,
          status,
          notes: notes.trim(),
          bankDetails: bankDetailsObj
        });

        if (onSuccess) onSuccess(`Supplier "${cleanCompany}" updated successfully.`);
      } else {
        await addSupplier({
          company: cleanCompany,
          companyName: cleanCompany,
          name: name.trim() || cleanCompany,
          phone: phone.trim(),
          email: cleanEmail,
          address: address.trim(),
          state: state.trim(),
          gstin: cleanGstin,
          pan: pan.trim().toUpperCase(),
          creditDays: parseInt(creditDays, 10) || 30,
          paymentTerms: `Net ${parseInt(creditDays, 10) || 30}`,
          openingBalance: 0,
          status,
          notes: notes.trim(),
          bankDetails: bankDetailsObj
        });

        if (onSuccess) onSuccess(`Supplier "${cleanCompany}" added successfully.`);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save supplier details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Supplier Details' : 'Add New Supplier'}
      subtitle={isEditMode ? `Update records for ${supplierToEdit?.company || supplierToEdit?.name}` : 'Register a new vendor/supplier in master catalog'}
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
              disabled={isSubmitting || !company.trim()}
              onClick={handleSubmit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Save Changes' : 'Create Supplier'}</span>
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

        {/* Company & Contact Person */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Supplier / Company Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Industrial Supplies Pvt Ltd"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Contact Person
            </label>
            <input
              type="text"
              placeholder="e.g. Rajesh Sharma (Sales Manager)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Phone & Email */}
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
              placeholder="e.g. sales@apexsupplies.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Address & State */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Address
            </label>
            <input
              type="text"
              placeholder="Factory / Office address, warehouse unit..."
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
              placeholder="e.g. Gujarat"
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* GSTIN, PAN, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Payment Terms & Bank Details */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
            Payment Terms & Bank Settlement Info (Optional)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Credit Period (Days)
              </label>
              <input
                type="number"
                min="0"
                placeholder="30"
                value={creditDays}
                onChange={e => setCreditDays(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Bank Name
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Account Number
              </label>
              <input
                type="text"
                placeholder="Bank A/C number"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC0001234"
                value={ifsc}
                onChange={e => setIfsc(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
              />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
            Notes / Vendor History Remarks
          </label>
          <textarea
            rows={2}
            placeholder="Special commercial terms, payment notes, procurement remarks..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};

