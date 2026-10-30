import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useERP } from '../../context/ERPContext';
import { Supplier } from '../../types';
import { AlertCircle } from 'lucide-react';

export interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (supplier: Supplier) => void;
}

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { suppliers, addSupplier } = useERP();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [creditDays, setCreditDays] = useState<string>('30');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPan('');
    setCreditDays('30');
    setOpeningBalance('0');
    setBankName('');
    setAccountNumber('');
    setIfsc('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validate Company Legal Name
    const cleanCompany = company.trim();
    if (!cleanCompany) {
      setErrorMsg('Company Legal Name is required.');
      return;
    }

    // 2. Prevent duplicate supplier creation
    const isDuplicateName = suppliers.some(
      s => (s.company && s.company.trim().toLowerCase() === cleanCompany.toLowerCase()) ||
           (s.name && s.name.trim().toLowerCase() === cleanCompany.toLowerCase())
    );
    if (isDuplicateName) {
      setErrorMsg(`A supplier with name "${cleanCompany}" already exists.`);
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin) {
      if (cleanGstin.length !== 15) {
        setErrorMsg('GSTIN must be exactly 15 alphanumeric characters (e.g., 27AAACN5566K1Z8).');
        return;
      }
      const isDuplicateGstin = suppliers.some(
        s => s.gstin && s.gstin.trim().toUpperCase() === cleanGstin
      );
      if (isDuplicateGstin) {
        setErrorMsg(`A supplier with GSTIN "${cleanGstin}" is already registered.`);
        return;
      }
    }

    const cleanEmail = email.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.trim();
    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 7) {
      setErrorMsg('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addSupplier({
        name: name.trim() || cleanCompany,
        company: cleanCompany,
        phone: cleanPhone,
        email: cleanEmail,
        address: address.trim(),
        gstin: cleanGstin,
        pan: pan.trim().toUpperCase(),
        creditDays: Number(creditDays) || 0,
        openingBalance: Number(openingBalance) || 0,
        bankDetails: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          accountName: cleanCompany
        },
        status: 'Active'
      });

      resetForm();
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to create supplier:', err);
      setErrorMsg(err?.message || 'Failed to save supplier to backend. Please check details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Register New Supplier / Vendor"
      subtitle="Record vendor corporate information, banking coordinates and credit terms"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !company.trim()}
            onClick={handleSubmit}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Supplier</span>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Company Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. National Steel & Alloy Corp"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Contact Person Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rajesh Khurana"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 98201 11222"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="sales@nationalsteel.in"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">GSTIN</label>
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              placeholder="27AAACN5566K1Z8"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">PAN Number</label>
            <input
              type="text"
              value={pan}
              onChange={e => setPan(e.target.value.toUpperCase())}
              placeholder="AAACN5566K"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Credit Terms (Days)</label>
            <input
              type="number"
              min="0"
              value={creditDays}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setCreditDays(''); return; }
                if (raw.includes('-')) return;
                setCreditDays(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="30"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Opening Balance (₹)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={openingBalance}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setOpeningBalance(''); return; }
                if (raw.includes('-')) return;
                setOpeningBalance(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Supplier Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="State Bank of India"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="1234567890"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">IFSC Code</label>
            <input
              type="text"
              value={ifsc}
              onChange={e => setIfsc(e.target.value.toUpperCase())}
              placeholder="SBIN0001234"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Registered Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Full billing address, city, state, pincode"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

