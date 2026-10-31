import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  User,
  CheckCircle,
  AlertTriangle,
  Printer,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  QrCode,
  Building
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';

interface POSShiftPanelProps {
  onPrintShiftReport?: () => void;
}

export const POSShiftPanel: React.FC<POSShiftPanelProps> = ({ onPrintShiftReport }) => {
  const { profile } = useAuth();
  const { company, salesInvoices } = useERP();

  // Shift state stored in localStorage per cashier session
  const shiftKey = `universal_pos_shift_${profile?.fullName || 'cashier'}`;

  const [isShiftOpen, setIsShiftOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${shiftKey}_active`) !== 'false';
    } catch {
      return true;
    }
  });

  const [openingFloat, setOpeningFloat] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${shiftKey}_opening`);
      return saved ? parseFloat(saved) : 2000;
    } catch {
      return 2000;
    }
  });

  const [shiftStartTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${shiftKey}_start`);
      if (saved) return saved;
      const now = new Date().toISOString();
      localStorage.setItem(`${shiftKey}_start`, now);
      return now;
    } catch {
      return new Date().toISOString();
    }
  });

  const [countedCash, setCountedCash] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [shiftClosedSummary, setShiftClosedSummary] = useState<any | null>(null);

  // Compute shift sales totals from today's invoices
  const today = new Date().toISOString().split('T')[0];
  const shiftInvoices = salesInvoices.filter(inv => inv.date >= today);

  const cashSales = shiftInvoices
    .filter(inv => inv.paymentMethod === 'Cash')
    .reduce((sum, inv) => sum + (inv.paidAmount || inv.grandTotal || 0), 0);

  const cardSales = shiftInvoices
    .filter(inv => inv.paymentMethod === 'Card')
    .reduce((sum, inv) => sum + (inv.paidAmount || inv.grandTotal || 0), 0);

  const upiSales = shiftInvoices
    .filter(inv => inv.paymentMethod === 'UPI')
    .reduce((sum, inv) => sum + (inv.paidAmount || inv.grandTotal || 0), 0);

  const totalSales = cashSales + cardSales + upiSales;
  const expectedCashInDrawer = openingFloat + cashSales;
  const parsedCountedCash = parseFloat(countedCash) || 0;
  const variance = countedCash ? parsedCountedCash - expectedCashInDrawer : 0;

  const handleOpenShift = () => {
    setIsShiftOpen(true);
    setShiftClosedSummary(null);
    setCountedCash('');
    try {
      localStorage.setItem(`${shiftKey}_active`, 'true');
      localStorage.setItem(`${shiftKey}_opening`, String(openingFloat));
      localStorage.setItem(`${shiftKey}_start`, new Date().toISOString());
    } catch {}
  };

  const handleCloseShift = () => {
    if (!countedCash) {
      alert('Please enter the physical cash counted in the drawer.');
      return;
    }

    const summary = {
      cashier: profile?.fullName || 'Cashier',
      startTime: shiftStartTime,
      endTime: new Date().toISOString(),
      openingFloat,
      cashSales,
      cardSales,
      upiSales,
      totalSales,
      expectedCash: expectedCashInDrawer,
      countedCash: parsedCountedCash,
      variance,
      notes: closingNotes
    };

    setShiftClosedSummary(summary);
    setIsShiftOpen(false);
    try {
      localStorage.setItem(`${shiftKey}_active`, 'false');
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
      {/* Shift Overview Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
            isShiftOpen ? 'bg-emerald-600' : 'bg-slate-600'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cashier Register Shift
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isShiftOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {isShiftOpen ? 'Shift Active' : 'Shift Closed'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cashier: <strong className="text-slate-700 dark:text-slate-300">{profile?.fullName || 'Active Cashier'}</strong> | 
              Shift started: {new Date(shiftStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {isShiftOpen && (
          <button
            type="button"
            onClick={onPrintShiftReport || (() => window.print())}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Print Shift Audit</span>
          </button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Opening Cash Float</span>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {formatCurrency(openingFloat)}
          </p>
          <span className="text-[10px] text-slate-400">Cash in drawer at start</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Cash Collections</span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {formatCurrency(cashSales)}
          </p>
          <span className="text-[10px] text-slate-400">Paid in physical cash</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Digital (UPI & Cards)</span>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {formatCurrency(upiSales + cardSales)}
          </p>
          <span className="text-[10px] text-slate-400">UPI: {formatCurrency(upiSales)} | Card: {formatCurrency(cardSales)}</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Expected Cash In Drawer</span>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {formatCurrency(expectedCashInDrawer)}
          </p>
          <span className="text-[10px] text-slate-400">Float + Cash sales</span>
        </div>
      </div>

      {/* Shift Action Panel: Close / Reopen */}
      {isShiftOpen ? (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            End Shift & Cash Drawer Reconciliation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Counted Physical Cash in Drawer ({company.currencySymbol || '₹'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter physical cash counted..."
                value={countedCash}
                onChange={e => setCountedCash(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-bold font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {countedCash && (
                <div className={`mt-2 p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                  Math.abs(variance) < 0.01
                    ? 'bg-emerald-50 text-emerald-700'
                    : variance > 0
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  <span>Variance (Over / Short):</span>
                  <span>{variance >= 0 ? `+${formatCurrency(variance)}` : formatCurrency(variance)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Handover Notes / Discrepancy Reasons
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes for shift handover..."
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleCloseShift}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Close Register & End Shift
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Register Shift is Closed</h4>
            <p className="text-xs text-slate-500 mt-1">Ready to open a new cashier session?</p>
          </div>

          <div className="max-w-xs mx-auto">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 text-left">
              Opening Cash Float ({company.currencySymbol || '₹'})
            </label>
            <input
              type="number"
              min="0"
              value={openingFloat}
              onChange={e => setOpeningFloat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center mb-3"
            />
            <button
              type="button"
              onClick={handleOpenShift}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Open New Shift
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

