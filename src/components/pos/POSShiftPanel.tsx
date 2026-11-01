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
  Building,
  Coins,
  Calculator,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CashDenominationBreakdown, DayEndShiftSettlement } from '../../types';

interface POSShiftPanelProps {
  onPrintShiftReport?: () => void;
}

export const POSShiftPanel: React.FC<POSShiftPanelProps> = ({ onPrintShiftReport }) => {
  const { profile } = useAuth();
  const { company, salesInvoices, recordShiftSettlement, shiftSettlements } = useERP();

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

  // Currency Denominations State
  const [denominations, setDenominations] = useState<{
    2000: number;
    500: number;
    200: number;
    100: number;
    50: number;
    20: number;
    10: number;
    coins: number;
  }>({
    2000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0
  });

  const [isDenominationModalOpen, setIsDenominationModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [lastSettlement, setLastSettlement] = useState<DayEndShiftSettlement | null>(null);

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

  const creditSales = shiftInvoices
    .filter(inv => inv.paymentMethod === 'Credit')
    .reduce((sum, inv) => sum + (inv.grandTotal - (inv.paidAmount || 0)), 0);

  const totalSales = cashSales + cardSales + upiSales + creditSales;
  const expectedCashInDrawer = openingFloat + cashSales;

  // Total physical cash counted from currency denominations
  const totalPhysicalCountedCash =
    denominations[2000] * 2000 +
    denominations[500] * 500 +
    denominations[200] * 200 +
    denominations[100] * 100 +
    denominations[50] * 50 +
    denominations[20] * 20 +
    denominations[10] * 10 +
    denominations.coins;

  const cashVariance = totalPhysicalCountedCash - expectedCashInDrawer;

  const handleOpenShift = () => {
    setIsShiftOpen(true);
    setLastSettlement(null);
    setDenominations({ 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, coins: 0 });
    try {
      localStorage.setItem(`${shiftKey}_active`, 'true');
      localStorage.setItem(`${shiftKey}_opening`, String(openingFloat));
      localStorage.setItem(`${shiftKey}_start`, new Date().toISOString());
    } catch {}
  };

  const handleCloseShiftAndSettle = async () => {
    if (totalPhysicalCountedCash === 0 && !confirm('Physical cash counted is ₹0. Are you sure you want to close without entering currency notes?')) {
      return;
    }

    const denomsRecord: CashDenominationBreakdown = {
      note2000: denominations[2000],
      note500: denominations[500],
      note200: denominations[200],
      note100: denominations[100],
      note50: denominations[50],
      note20: denominations[20],
      note10: denominations[10],
      coins: denominations.coins,
      totalPhysicalCash: totalPhysicalCountedCash
    };

    const created = await recordShiftSettlement({
      cashierId: profile?.id || 'cashier-1',
      cashierName: profile?.fullName || 'Counter Cashier',
      shiftStartTime,
      shiftEndTime: new Date().toISOString(),
      openingCash: openingFloat,
      cashSalesTotal: cashSales,
      upiSalesTotal: upiSales,
      cardSalesTotal: cardSales,
      creditSalesTotal: creditSales,
      cashExpensesTotal: 0,
      cashRefundsTotal: 0,
      expectedCashInDrawer,
      actualCashInDrawer: totalPhysicalCountedCash,
      cashVariance,
      denominations: denomsRecord,
      notes: closingNotes.trim(),
      status: Math.abs(cashVariance) < 1 ? 'Closed & Balanced' : 'Variance Flagged'
    });

    setLastSettlement(created);
    setIsShiftOpen(false);
    try {
      localStorage.setItem(`${shiftKey}_active`, 'false');
    } catch {}
  };

  const handlePrintZReport = () => {
    const s = lastSettlement || {
      settlementNumber: 'Z-PREVIEW',
      cashierName: profile?.fullName || 'Cashier',
      shiftStartTime,
      shiftEndTime: new Date().toISOString(),
      openingCash: openingFloat,
      cashSalesTotal: cashSales,
      upiSalesTotal: upiSales,
      cardSalesTotal: cardSales,
      creditSalesTotal: creditSales,
      expectedCashInDrawer,
      actualCashInDrawer: totalPhysicalCountedCash,
      cashVariance,
      denominations: {
        note2000: denominations[2000],
        note500: denominations[500],
        note200: denominations[200],
        note100: denominations[100],
        note50: denominations[50],
        note20: denominations[20],
        note10: denominations[10],
        coins: denominations.coins,
        totalPhysicalCash: totalPhysicalCountedCash
      }
    };

    const printWin = window.open('', '_blank', 'width=400,height=650');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Z-Report - ${s.settlementNumber}</title>
            <style>
              @page { size: 80mm auto; margin: 4mm; }
              body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 4px; color: #000; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 5px 0; }
              .double-divider { border-top: 2px solid #000; margin: 6px 0; }
              .row { display: flex; justify-content: space-between; margin: 2px 0; }
            </style>
          </head>
          <body>
            <div class="center bold" style="font-size:13px;">${company.name || 'UNIVERSAL STORE'}</div>
            <div class="center">${company.address || 'Retail Counter'}</div>
            <div class="center">Ph: ${company.phone || ''}</div>
            <div class="divider"></div>
            <div class="center bold" style="font-size:12px;">*** DAY-END Z-REPORT ***</div>
            <div class="divider"></div>
            <div class="row"><span>Report #:</span><span class="bold">${s.settlementNumber}</span></div>
            <div class="row"><span>Cashier:</span><span>${s.cashierName}</span></div>
            <div class="row"><span>Shift Open:</span><span>${new Date(s.shiftStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div class="row"><span>Shift Close:</span><span>${new Date(s.shiftEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div class="divider"></div>
            <div class="bold">SALES BY TENDER METHOD</div>
            <div class="row"><span>Cash Sales:</span><span>${formatCurrency(s.cashSalesTotal)}</span></div>
            <div class="row"><span>UPI / QR Sales:</span><span>${formatCurrency(s.upiSalesTotal)}</span></div>
            <div class="row"><span>Card Sales:</span><span>${formatCurrency(s.cardSalesTotal)}</span></div>
            <div class="row"><span>Khata (Credit):</span><span>${formatCurrency(s.creditSalesTotal)}</span></div>
            <div class="divider"></div>
            <div class="row bold"><span>TOTAL REVENUE:</span><span>${formatCurrency(s.cashSalesTotal + s.upiSalesTotal + s.cardSalesTotal + s.creditSalesTotal)}</span></div>
            <div class="divider"></div>
            <div class="bold">CASH DRAWER RECONCILIATION</div>
            <div class="row"><span>Opening Float:</span><span>${formatCurrency(s.openingCash)}</span></div>
            <div class="row"><span>(+) Cash Sales:</span><span>${formatCurrency(s.cashSalesTotal)}</span></div>
            <div class="row bold"><span>Expected in Drawer:</span><span>${formatCurrency(s.expectedCashInDrawer)}</span></div>
            <div class="row bold"><span>Physical Counted:</span><span>${formatCurrency(s.actualCashInDrawer)}</span></div>
            <div class="row bold" style="font-size:12px;"><span>Cash Variance:</span><span>${s.cashVariance >= 0 ? `+${formatCurrency(s.cashVariance)}` : formatCurrency(s.cashVariance)}</span></div>
            <div class="divider"></div>
            <div class="bold">DENOMINATIONS COUNTED</div>
            <div class="row"><span>₹2000 x ${s.denominations.note2000}</span><span>${formatCurrency(s.denominations.note2000 * 2000)}</span></div>
            <div class="row"><span>₹500 x ${s.denominations.note500}</span><span>${formatCurrency(s.denominations.note500 * 500)}</span></div>
            <div class="row"><span>₹200 x ${s.denominations.note200}</span><span>${formatCurrency(s.denominations.note200 * 200)}</span></div>
            <div class="row"><span>₹100 x ${s.denominations.note100}</span><span>${formatCurrency(s.denominations.note100 * 100)}</span></div>
            <div class="row"><span>₹50 x ${s.denominations.note50}</span><span>${formatCurrency(s.denominations.note50 * 50)}</span></div>
            <div class="row"><span>₹20 x ${s.denominations.note20}</span><span>${formatCurrency(s.denominations.note20 * 20)}</span></div>
            <div class="row"><span>₹10 x ${s.denominations.note10}</span><span>${formatCurrency(s.denominations.note10 * 10)}</span></div>
            <div class="row"><span>Coins:</span><span>${formatCurrency(s.denominations.coins)}</span></div>
            <div class="double-divider"></div>
            <div class="center" style="font-size:10px;">Cashier Signature: __________________</div>
            <div class="center" style="font-size:10px; margin-top:4px;">Supervisor Signature: __________________</div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn text-xs">
      {/* Shift Overview Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              isShiftOpen ? 'bg-emerald-600' : 'bg-slate-600'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cashier Register Shift & Z-Report Settlement
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isShiftOpen
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isShiftOpen ? 'Active Counter Shift' : 'Shift Closed'}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Cashier: <strong className="text-slate-800 dark:text-slate-200">{profile?.fullName || 'Cashier'}</strong> · Started at{' '}
              {new Date(shiftStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSettlement && (
            <button
              type="button"
              onClick={handlePrintZReport}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Z-Report</span>
            </button>
          )}

          {!isShiftOpen ? (
            <button
              type="button"
              onClick={handleOpenShift}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Open New Shift</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDenominationModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Count Drawer & Settle (Z-Report)</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Opening Drawer Cash
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {formatCurrency(openingFloat)}
          </span>
          <span className="text-[10px] text-slate-500 block">Initial register float</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Cash Sales Collected
          </span>
          <span className="text-lg font-black text-emerald-600">
            {formatCurrency(cashSales)}
          </span>
          <span className="text-[10px] text-slate-500 block">Physical currency intake</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Digital Intake (UPI & Card)
          </span>
          <span className="text-lg font-black text-blue-600">
            {formatCurrency(upiSales + cardSales)}
          </span>
          <span className="text-[10px] text-slate-500 block">UPI: {formatCurrency(upiSales)} · Card: {formatCurrency(cardSales)}</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Expected Drawer Balance
          </span>
          <span className="text-lg font-black text-indigo-600">
            {formatCurrency(expectedCashInDrawer)}
          </span>
          <span className="text-[10px] text-slate-500 block">Opening + Cash Sales</span>
        </div>
      </div>

      {/* Currency Denominations Counter Card */}
      {isShiftOpen && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Physical Cash Drawer Denomination Counter
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">Physical Cash Total:</span>
              <span className="text-base font-black text-emerald-600">{formatCurrency(totalPhysicalCountedCash)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[2000, 500, 200, 100, 50, 20, 10].map(val => (
              <div key={val} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-700 dark:text-slate-300">₹{val} notes</span>
                  <span className="text-slate-500 text-[11px] font-mono">
                    {formatCurrency(denominations[val as keyof typeof denominations] * val)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={denominations[val as keyof typeof denominations] || ''}
                  onChange={e => {
                    const count = parseInt(e.target.value) || 0;
                    setDenominations(prev => ({ ...prev, [val]: count }));
                  }}
                  placeholder="0"
                  className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                />
              </div>
            ))}

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700 dark:text-slate-300">Coins (Total ₹)</span>
                <span className="text-slate-500 text-[11px] font-mono">
                  {formatCurrency(denominations.coins)}
                </span>
              </div>
              <input
                type="number"
                min="0"
                value={denominations.coins || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setDenominations(prev => ({ ...prev, coins: val }));
                }}
                placeholder="0"
                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
              />
            </div>
          </div>

          {/* Variance Live Check */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Cash Variance (Overage / Shortage):
              </span>
              <span className="text-[11px] text-slate-500">
                Counted ({formatCurrency(totalPhysicalCountedCash)}) - Expected ({formatCurrency(expectedCashInDrawer)})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-base font-black px-3 py-1 rounded-xl ${
                  Math.abs(cashVariance) < 1
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : cashVariance > 0
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                }`}
              >
                {cashVariance >= 0 ? `+${formatCurrency(cashVariance)}` : formatCurrency(cashVariance)}
              </span>

              <button
                type="button"
                onClick={handleCloseShiftAndSettle}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Confirm & Settle Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Shift Settlements Log */}
      {shiftSettlements.length > 0 && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Archived Day-End Z-Report Settlements</span>
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
            <table className="w-full text-left divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-2.5">Z-Report #</th>
                  <th className="p-2.5">Cashier</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Cash Sales</th>
                  <th className="p-2.5">Expected</th>
                  <th className="p-2.5">Counted</th>
                  <th className="p-2.5">Variance</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                {shiftSettlements.map(shift => (
                  <tr key={shift.id}>
                    <td className="p-2.5 font-mono font-bold text-blue-600">{shift.settlementNumber}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-white">{shift.cashierName}</td>
                    <td className="p-2.5">{formatDate(shift.shiftEndTime)}</td>
                    <td className="p-2.5 font-bold text-emerald-600">{formatCurrency(shift.cashSalesTotal)}</td>
                    <td className="p-2.5">{formatCurrency(shift.expectedCashInDrawer)}</td>
                    <td className="p-2.5 font-bold">{formatCurrency(shift.actualCashInDrawer)}</td>
                    <td className="p-2.5">
                      <span className={`font-bold ${shift.cashVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {shift.cashVariance >= 0 ? `+${formatCurrency(shift.cashVariance)}` : formatCurrency(shift.cashVariance)}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        shift.status === 'Closed & Balanced'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}>
                        {shift.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
