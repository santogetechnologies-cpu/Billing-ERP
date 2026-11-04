import React from 'react';
import { Modal } from '../common/Modal';
import { Customer } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  ExternalLink,
  Edit,
  Tag,
  Building2,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface CustomerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEdit?: (customer: Customer) => void;
}

export const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
  isOpen,
  onClose,
  customer,
  onEdit
}) => {
  const navigate = useNavigate();

  if (!customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Details"
      subtitle={`Complete customer record for ${customer.name}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/customers/${customer.id}`);
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
                  onEdit(customer);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Customer</span>
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
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {customer.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                  {customer.type || 'Retail'} Customer
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  customer.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : customer.status === 'Blocked'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {customer.status || 'Active'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-slate-200 sm:dark:border-slate-700 sm:pl-4">
            <span className="text-[10px] text-slate-400 font-medium block">Outstanding Due</span>
            <span className={`text-base font-bold font-mono ${(customer.currentOutstanding || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCurrency(customer.currentOutstanding || 0)}
            </span>
          </div>
        </div>

        {/* Contact & Location Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Contact Details
            </span>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-mono">{customer.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{customer.email || '—'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Address & Region
            </span>
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{customer.address ? `${customer.address}${customer.state ? `, ${customer.state}` : ''}` : 'No address specified'}</span>
            </div>
          </div>
        </div>

        {/* Taxation & Commercial Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Statutory Tax Identifiers
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">GSTIN</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">{customer.gstin || 'Unregistered'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">PAN</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">{customer.pan || '—'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block pb-1 border-b border-slate-100 dark:border-slate-700/60">
              Commercial Credit Terms
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Credit Limit</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {customer.creditLimit ? formatCurrency(customer.creditLimit) : 'No Limit'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Credit Period</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{customer.creditDays || 30} Days</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Remarks</span>
            <p className="whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

