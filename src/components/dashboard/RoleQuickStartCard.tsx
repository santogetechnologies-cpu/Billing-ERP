import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  X,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RoleQuickStartCard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role || 'Admin';

  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(`universal_billing_quickstart_${role}_dismissed`) === 'true';
  });

  const [isExpanded, setIsExpanded] = useState(() => {
    return localStorage.getItem(`universal_billing_quickstart_${role}_expanded`) === 'true';
  });

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`universal_billing_quickstart_${role}_steps`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  if (isDismissed) return null;

  const toggleStep = (stepId: string) => {
    const updated = { ...completedSteps, [stepId]: !completedSteps[stepId] };
    setCompletedSteps(updated);
    localStorage.setItem(`universal_billing_quickstart_${role}_steps`, JSON.stringify(updated));
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    localStorage.setItem(`universal_billing_quickstart_${role}_dismissed`, 'true');
  };

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem(`universal_billing_quickstart_${role}_expanded`, String(next));
      return next;
    });
  };

  // Checklists by role
  const roleSteps: { id: string; label: string; desc: string; actionPath?: string }[] =
    role === 'Cashier'
      ? [
          { id: 'c1', label: '1. Open Cashier Shift', desc: 'Count your opening drawer float cash', actionPath: '/sales/pos' },
          { id: 'c2', label: '2. Scan First Barcode / Product', desc: 'Scan product or search by SKU/name (F2)', actionPath: '/sales/pos' },
          { id: 'c3', label: '3. Collect Payment & Print', desc: 'Take Cash, UPI or Card and generate receipt (F10)', actionPath: '/sales/pos' },
          { id: 'c4', label: '4. End of Day Reconciliation', desc: 'Count physical drawer cash and close shift', actionPath: '/sales/pos' }
        ]
      : role === 'Salesperson'
      ? [
          { id: 's1', label: '1. Check Stock Availability', desc: 'Lookup catalog stock balances and prices', actionPath: '/stock' },
          { id: 's2', label: '2. Issue Proforma Quotation', desc: 'Draft price quote for customer approval', actionPath: '/sales?tab=quotations' },
          { id: 's3', label: '3. Check Monthly Quota & Commission', desc: 'Review target progress and accrued earnings', actionPath: '/pricing?tab=targets' }
        ]
      : role === 'Accountant'
      ? [
          { id: 'a1', label: '1. Verify Pending Supplier Bills', desc: 'Match vendor invoices against Goods Receipts', actionPath: '/purchases?tab=bills' },
          { id: 'a2', label: '2. Audit Daily Day Book Journal', desc: 'Verify chronological debits and credits', actionPath: '/accounts?tab=daybook' },
          { id: 'a3', label: '3. Check GST Tax Position', desc: 'Review GSTR-1 and GSTR-3B tax balance', actionPath: '/accounts?tab=tax' }
        ]
      : role === 'Warehouse Manager'
      ? [
          { id: 'w1', label: '1. Inward Goods Intake (GRN)', desc: 'Record supplier delivery with batch & expiry', actionPath: '/purchases?tab=grn' },
          { id: 'w2', label: '2. Low Stock Alerts Review', desc: 'Check reorder matrix and depleted inventory', actionPath: '/stock?tab=low' },
          { id: 'w3', label: '3. Shelf Stock Count Audit', desc: 'Perform physical shelf count and reconcile', actionPath: '/stock?tab=counts' }
        ]
      : [
          // Admin / Owner default
          { id: 'ad1', label: '1. Configure Store Profile & Taxes', desc: 'Set company name, GSTIN, and receipt header', actionPath: '/settings?tab=business' },
          { id: 'ad2', label: '2. Add Products & Initial Inventory', desc: 'Create items with universal units and barcodes', actionPath: '/products/initial-stock' },
          { id: 'ad3', label: '3. Connect Thermal Printer', desc: 'Configure 80mm/58mm silent receipt printing', actionPath: '/settings?tab=printers' },
          { id: 'ad4', label: '4. Run First Test Sale in POS', desc: 'Finish a bill in under 2 minutes', actionPath: '/sales/pos' }
        ];

  const completedCount = roleSteps.filter(s => completedSteps[s.id]).length;
  const progressPercent = Math.round((completedCount / roleSteps.length) * 100);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs transition-all">
      {/* Sleek Compact Header Bar */}
      <div
        onClick={toggleExpanded}
        className="flex items-center justify-between cursor-pointer select-none gap-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Quick Setup Guide
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
              {completedCount}/{roleSteps.length} completed ({progressPercent}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span>{isExpanded ? 'Hide Steps' : 'View Steps'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar (Always visible) */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Collapsible Steps Matrix */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
          {roleSteps.map(step => {
            const isDone = Boolean(completedSteps[step.id]);
            return (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isDone
                    ? 'bg-slate-50/60 dark:bg-slate-800/30 border-emerald-200/60 text-slate-400'
                    : 'bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-700/80 hover:border-blue-300 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="mt-0.5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStep(step.id);
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-[11px] font-semibold block leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {step.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                      {step.desc}
                    </span>
                  </div>
                </div>

                {step.actionPath && !isDone && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(step.actionPath!);
                      }}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
