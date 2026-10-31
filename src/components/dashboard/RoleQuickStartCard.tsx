import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  X,
  ArrowRight,
  ShoppingCart,
  Boxes,
  Users,
  Printer,
  CreditCard
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

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(`universal_billing_quickstart_${role}_dismissed`, 'true');
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
          { id: 'ad2', label: '2. Add Products & Initial Inventory', desc: 'Create items with universal units and barcodes', actionPath: '/products' },
          { id: 'ad3', label: '3. Connect Thermal Printer', desc: 'Configure 80mm/58mm silent receipt printing', actionPath: '/settings?tab=printers' },
          { id: 'ad4', label: '4. Run First Test Sale in POS', desc: 'Finish a bill in under 2 minutes', actionPath: '/sales/pos' }
        ];

  const completedCount = roleSteps.filter(s => completedSteps[s.id]).length;
  const progressPercent = Math.round((completedCount / roleSteps.length) * 100);

  return (
    <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/90 rounded-2xl p-5 shadow-2xs space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {role} Quick Start Checklist
            </h3>
            <p className="text-[11px] text-slate-500">
              {completedCount} of {roleSteps.length} tasks completed ({progressPercent}%)
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          title="Dismiss Quick Start"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {roleSteps.map(step => {
          const isDone = Boolean(completedSteps[step.id]);
          return (
            <div
              key={step.id}
              onClick={() => toggleStep(step.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                isDone
                  ? 'bg-white/80 border-emerald-200 text-slate-500'
                  : 'bg-white border-blue-100 shadow-2xs hover:border-blue-300 text-slate-800'
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
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <div>
                  <span className={`text-xs font-bold block ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
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
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
