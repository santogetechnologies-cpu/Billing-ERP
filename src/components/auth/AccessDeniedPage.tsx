import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, Lock, ShieldCheck } from 'lucide-react';
import { AppModule, AppAction, getModuleTitle, getRoleDefaultRoute } from '../../utils/rbac';
import { UserRole } from '../../types';

interface AccessDeniedPageProps {
  module?: AppModule;
  action?: AppAction;
  role?: UserRole | string;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  module,
  action = 'view',
  role
}) => {
  const navigate = useNavigate();
  const defaultRoute = getRoleDefaultRoute(role as UserRole);
  const moduleName = module ? getModuleTitle(module) : 'Restricted Area';
  const roleName = role || 'Current User';

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center shadow-2xl relative z-10 animate-fadeIn">
        {/* Lock / Security Icon Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title & Status */}
        <div className="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-400 text-xs font-semibold uppercase tracking-wider mb-3">
          403 Access Denied
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          Restricted Permission
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Your account role does not have authorization to {action} <strong className="text-white">{moduleName}</strong>.
        </p>

        {/* Role & Context Card */}
        <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl text-left mb-6 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Active Role:
            </span>
            <span className="font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              {roleName}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-rose-400" />
              Requested Module:
            </span>
            <span className="font-medium text-slate-200">
              {moduleName}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 leading-relaxed">
            Universal Billing enforces strict Role-Based Access Control (RBAC). If your daily workflow requires access to this module, please request permission elevation from a Company Administrator.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(defaultRoute)}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go to My Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};
