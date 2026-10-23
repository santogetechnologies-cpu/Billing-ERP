import React from 'react';
import {
  User,
  Shield,
  Building,
  Mail,
  CheckCircle,
  Lock,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useERP } from '../../context/ERPContext';
import { ModalCloseButton } from '../common/ModalCloseButton';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { company } = useERP();

  if (!isOpen) return null;

  const roleName = profile?.role || 'Salesperson';
  const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Sales Executive';
  const email = profile?.email || user?.email || 'sales@company.com';
  const companyName = company?.name || 'Universal Billing Workspace';
  const status = profile?.status || 'Active';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 pt-6 pb-12 text-white relative">
          <div className="absolute top-4 right-4 z-10">
            <ModalCloseButton onClose={onClose} autoHandleEscape={true} />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-blue-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Staff Account Details</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">My User Profile</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Role-based credentials and authenticated company workspace
          </p>
        </div>

        {/* Floating Avatar & Main Identity */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="-mt-9 mb-4 flex items-end justify-between">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg border-4 border-white">
              {fullName.substring(0, 2).toUpperCase()}
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{status}</span>
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{fullName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {roleName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{email}</span>
              </p>
            </div>

            {/* Profile Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assigned Company</span>
                </div>
                <p className="text-xs font-bold text-slate-900 truncate">{companyName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                  ID: {profile?.company_id || 'Isolated Tenant'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span>Access Level</span>
                </div>
                <p className="text-xs font-bold text-slate-900">{roleName} Privileges</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  POS, Sales, CRM & Product Lookup
                </p>
              </div>
            </div>

            {/* Module Permissions Breakdown */}
            <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Active Role Permissions</span>
                <span className="text-[10px] text-slate-500 font-normal">RBAC Enforced</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>POS Fast Billing</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Sales Invoices</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Customer CRM</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Product & Stock Lookup</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>Purchases & Vendor Bills</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>Accounting & Ledger</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>Company Administration</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span>System Audit Logs</span>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Company Data Isolation</span>
                <span className="text-blue-800/80">
                  Your sales operations, customer profiles, and transactions are strictly scoped to{' '}
                  <strong>{companyName}</strong>. Administrative modifications require elevated credentials.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
