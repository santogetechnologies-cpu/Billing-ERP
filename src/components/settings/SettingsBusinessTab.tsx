import React, { useState } from 'react';
import {
  Building2,
  Save,
  CheckCircle,
  FileText,
  CreditCard,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SettingsBusinessTab: React.FC = () => {
  const { company, updateCompany } = useERP();

  const [companyName, setCompanyName] = useState(company?.companyName || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [email, setEmail] = useState(company?.email || '');
  const [address, setAddress] = useState(company?.address || '');
  const [state, setState] = useState(company?.state || 'Maharashtra');
  const [gstin, setGstin] = useState(company?.gstin || '');
  const [pan, setPan] = useState(company?.pan || '');
  const [invoicePrefix, setInvoicePrefix] = useState(company?.invoicePrefix || 'INV-');
  const [bankName, setBankName] = useState(company?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(company?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(company?.ifscCode || '');
  const [upiId, setUpiId] = useState(company?.upiId || '');
  const [terms, setTerms] = useState(company?.termsAndConditions || '');

  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await updateCompany({
        companyName,
        phone,
        email,
        address,
        state,
        gstin,
        pan,
        invoicePrefix,
        bankName,
        accountNumber,
        ifscCode,
        upiId,
        termsAndConditions: terms
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 text-xs animate-fadeIn">
      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Business settings saved successfully!</span>
        </div>
      )}

      {/* Basic Profile */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Commercial Identity & Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trading Business Name *</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">State / Jurisdiction</label>
            <input
              type="text"
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Official Mobile / Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Billing Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Store / Registered Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Tax & Series */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Statutory Tax & Invoice Numbering</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
              placeholder="27AAAAA0000A1Z5"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Income Tax PAN</label>
            <input
              type="text"
              value={pan}
              onChange={e => setPan(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
              placeholder="ABCDE1234F"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Series Prefix</label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={e => setInvoicePrefix(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              placeholder="INV-"
            />
          </div>
        </div>
      </div>

      {/* Banking Details on Receipt */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Bank Details Printed on Invoices</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="e.g. HDFC Bank Ltd"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
            <input
              type="text"
              value={ifscCode}
              onChange={e => setIfscCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">UPI ID for Dynamic QR</label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="store@upi"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Standard Terms & Conditions</label>
            <textarea
              rows={2}
              value={terms}
              onChange={e => setTerms(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving...' : 'Save Business Settings'}</span>
        </button>
      </div>
    </form>
  );
};

