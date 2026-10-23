import React from 'react';
import { Clock, ShieldAlert, LogOut, CheckCircle } from 'lucide-react';
import { Modal } from '../common/Modal';

interface InactivityWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  remainingSeconds,
  onStayLoggedIn,
  onLogout
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onStayLoggedIn}
      title="Session Expiring Due to Inactivity"
      subtitle="Universal Billing Security Protection"
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Sign Out Now</span>
          </button>

          <button
            type="button"
            onClick={onStayLoggedIn}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Stay Logged In</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-center py-2">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-slate-900">
            Are you still working?
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            You have been inactive for nearly 30 minutes. To protect your business and accounting data,
            your session will be automatically signed out in:
          </p>
        </div>

        {/* Countdown Badge */}
        <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white font-mono text-xl font-bold tracking-wider shadow-inner">
          <span className="text-amber-400">{timeFormatted}</span>
        </div>

        <p className="text-[11px] text-slate-400">
          Click <strong>"Stay Logged In"</strong> or move your mouse to reset your session.
        </p>
      </div>
    </Modal>
  );
};
