import React from 'react';
import { Modal } from '../common/Modal';
import { Supplier } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ExternalLink,
  Edit,
  Landmark,
  User,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface SupplierViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onEdit?: (supplier: Supplier) => void;
}

export const SupplierViewModal: React.FC<SupplierViewModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onEdit
}) => {
  const navigate = useNavigate();

  if (!supplier) return null;

  const displayName = supplier.company || supplier.name;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supplier Details"
      subtitle={`Complete vendor profile for ${displayName}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/suppliers/${supplier.id}`);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Full Profile & Ledgers</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(supplier);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Supplier</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Top Header Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {supplier.name && supplier.name !== displayName && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Contact: {supplier.name}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    supplier.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      supplier.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{supplier.status || 'Active'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-slate-200 sm:dark:border-slate-700 sm:pl-4">
            <span className="text-[10px] text-slate-400 font-medium block">Payable Balance</span>
            <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
              {formatCurrency(supplier.currentOutstanding || 0)}
            </span>
          </div>
        </div>

        {/* Contact & Location Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Contact Person & Communications
            </span>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{supplier.name || displayName}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-mono">{supplier.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{supplier.email || '—'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Registered Address
            </span>
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {supplier.address
                  ? `${supplier.address}${supplier.state ? `, ${supplier.state}` : ''}`
                  : 'No address recorded'}
              </span>
            </div>
          </div>
        </div>

        {/* Taxation & Payment Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Statutory Tax Identifiers
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">GSTIN</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                {supplier.gstin || 'Unregistered'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">PAN</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                {supplier.pan || '—'}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Procurement & Payment Terms
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Payment Terms</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {supplier.paymentTerms || `${supplier.creditDays || 30} Days`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Lifetime Purchases</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatCurrency(supplier.totalPurchases || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Bank Account Details */}
        {supplier.bankDetails && (
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-purple-600" />
              Bank Account Settlement
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-400 text-[10px] block">Bank Name</span>
                <span className="font-medium text-slate-900 dark:text-white">{supplier.bankDetails.bankName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">A/C Number</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{supplier.bankDetails.accountNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">IFSC Code</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white uppercase">{supplier.bankDetails.ifsc || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {supplier.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Remarks</span>
            <p className="whitespace-pre-wrap">{supplier.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

