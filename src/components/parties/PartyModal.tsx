import React, { useState } from 'react';
import {
  X,
  Users,
  Building,
  Phone,
  Mail,
  CreditCard,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Customer, Supplier, CustomerType } from '../../types';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPartyType?: 'Customer' | 'Supplier' | 'Dealer';
  editingParty?: Customer | Supplier | null;
  onSaved?: () => void;
}

export const PartyModal: React.FC<PartyModalProps> = ({
  isOpen,
  onClose,
  initialPartyType = 'Customer',
  editingParty,
  onSaved
}) => {
  const { addCustomer, updateCustomer, addSupplier, updateSupplier, users = [] } = useERP();

  // Basic Form Fields
  const [partyType, setPartyType] = useState<'Customer' | 'Supplier' | 'Dealer'>(
    editingParty ? ('type' in editingParty && editingParty.type === 'Dealer' ? 'Dealer' : 'supplierGstin' in editingParty || !('type' in editingParty) ? 'Supplier' : 'Customer') : initialPartyType
  );
  const [name, setName] = useState(editingParty?.name || '');
  const [phone, setPhone] = useState(editingParty?.phone || '');
  const [email, setEmail] = useState(editingParty?.email || '');
  const [gstin, setGstin] = useState(editingParty?.gstin || '');
  const [state, setState] = useState(editingParty?.state || '');
  const [address, setAddress] = useState(editingParty?.address || '');

  // Progressive Disclosure: More options
  const [showMore, setShowMore] = useState(false);
  const [creditLimit, setCreditLimit] = useState<string>(
    editingParty && 'creditLimit' in editingParty && editingParty.creditLimit ? String(editingParty.creditLimit) : ''
  );
  const [creditDays, setCreditDays] = useState<string>(
    editingParty && 'creditDays' in editingParty && editingParty.creditDays ? String(editingParty.creditDays) : '30'
  );
  const [pan, setPan] = useState(editingParty && 'pan' in editingParty ? (editingParty.pan || '') : '');
  const [notes, setNotes] = useState(editingParty?.notes || '');
  const [assignedSalespersonId, setAssignedSalespersonId] = useState(
    editingParty && 'assignedSalespersonId' in editingParty ? (editingParty.assignedSalespersonId || '') : ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const salespersons = users.filter(u => u.role === 'Salesperson');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter party name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      if (partyType === 'Supplier') {
        if (editingParty && 'id' in editingParty) {
          await updateSupplier(editingParty.id, {
            name: name.trim(),
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            gstin: gstin.trim() || undefined,
            address: address.trim() || undefined,
            state: state.trim() || undefined,
            notes: notes.trim() || undefined
          });
        } else {
          await addSupplier({
            name: name.trim(),
            company: name.trim(),
            companyName: name.trim(),
            phone: phone.trim() || '',
            email: email.trim() || '',
            gstin: gstin.trim() || '',
            pan: pan.trim() || '',
            address: address.trim() || '',
            state: state.trim() || '',
            creditDays: creditDays ? Number(creditDays) : 30,
            openingBalance: 0,
            status: 'Active',
            notes: notes.trim() || undefined,
            paymentTerms: creditDays ? `Net ${creditDays}` : 'Net 30'
          });
        }
      } else {
        // Customer or Dealer
        const cType: CustomerType = partyType === 'Dealer' ? 'Dealer' : 'Wholesale';
        if (editingParty && 'id' in editingParty) {
          await updateCustomer(editingParty.id, {
            name: name.trim(),
            type: cType,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            gstin: gstin.trim() || undefined,
            address: address.trim() || undefined,
            state: state.trim() || undefined,
            pan: pan.trim() || undefined,
            creditLimit: creditLimit ? Number(creditLimit) : undefined,
            creditDays: creditDays ? Number(creditDays) : undefined,
            assignedSalespersonId: assignedSalespersonId || undefined,
            notes: notes.trim() || undefined
          });
        } else {
          await addCustomer({
            name: name.trim(),
            type: cType,
            phone: phone.trim() || '',
            email: email.trim() || '',
            gstin: gstin.trim() || '',
            address: address.trim() || '',
            state: state.trim() || '',
            country: 'India',
            openingBalance: 0,
            pan: pan.trim() || '',
            creditLimit: creditLimit ? Number(creditLimit) : 0,
            creditDays: creditDays ? Number(creditDays) : 30,
            assignedSalespersonId: assignedSalespersonId || undefined,
            notes: notes.trim() || undefined,
            status: 'Active'
          });
        }
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save party details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingParty ? 'Edit Party' : 'Add New Commercial Party'}
              </h3>
              <p className="text-[11px] text-slate-500">Fast 2-tap creation with progressive disclosure</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Party Type Switcher */}
          {!editingParty && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Party Role / Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Customer', 'Supplier', 'Dealer'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPartyType(t)}
                    className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                      partyType === t
                        ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'Dealer' ? 'Shop / Dealer' : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Essential Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Party Name (Business / Individual) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corporation or Rajesh Sharma"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Billing Address & State
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Shop #, Street, City, State"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>

          {/* Progressive Disclosure Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{showMore ? 'Hide advanced settings' : 'More options (Credit limit, terms, assigned salesperson)'}</span>
              {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showMore && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={e => setCreditLimit(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Period (Days)
                  </label>
                  <input
                    type="number"
                    value={creditDays}
                    onChange={e => setCreditDays(e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="accounts@business.com"
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Salesperson
                  </label>
                  <select
                    value={assignedSalespersonId}
                    onChange={e => setAssignedSalespersonId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="">None (Unassigned)</option>
                    {salespersons.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.fullName || sp.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Special instructions or commercial agreement terms..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : editingParty ? 'Save Changes' : 'Create Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

