import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Truck,
  Boxes,
  Users,
  BookOpen,
  QrCode,
  Store,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileText,
  DollarSign,
  Package,
  Layers,
  PhoneCall,
  MessageSquare,
  Printer,
  Calendar,
  Wallet,
  Clock,
  ExternalLink
} from 'lucide-react';

export const SettingsWorkflowsTab: React.FC = () => {
  const [activeWorkflow, setActiveWorkflow] = useState<string>('all');

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-800 dark:text-slate-200">
      {/* Overview Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold tracking-wide border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Universal Enterprise Architecture & Operational Guide</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              End-to-End System Workflows & Financial Sealing Map
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Exhaustive visual blueprints connecting every business event in the ERP—from 1-tap POS billing, route sales with Rate A/B/C/D tiers, and inter-godown inventory transfers to double-entry accounting, staff payroll, and multichannel WhatsApp dispatch.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0 text-center">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10">
              <span className="block text-xl font-black text-amber-400">14</span>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Core Modules</span>
            </div>
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10">
              <span className="block text-xl font-black text-emerald-400">7</span>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Access Roles</span>
            </div>
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 col-span-2 sm:col-span-1">
              <span className="block text-xl font-black text-blue-400">100%</span>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Sealed Ledgers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
          { id: 'all', label: 'All Operations' },
          { id: 'pos', label: '1. POS Counter Billing' },
          { id: 'salesperson', label: '2. Salesperson Route & Delivery' },
          { id: 'inventory', label: '3. Inventory & Stock Transfers' },
          { id: 'hr', label: '4. HR, Attendance & Payroll' },
          { id: 'accounting', label: '5. Accounts & Financial Closure' },
          { id: 'rbac', label: '6. Role Access Matrix (RBAC)' }
        ].map(filter => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveWorkflow(filter.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeWorkflow === filter.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* WORKFLOW 1: POINT OF SALE & COUNTER BILLING */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'pos') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. POS Counter Billing Life Cycle (Small Shop & Multi-Counter Mall)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dual-mode cashier checkout supporting both 1-Tap quick touch and advanced grid search.
                </p>
              </div>
            </div>
            <Link
              to="/sales/pos"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              Open POS <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Visual Step Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {[
              {
                step: 'Step 1',
                title: 'Item Input & Scanning',
                desc: 'Scan EAN-13 barcode or tap 1-Tap product card. Live search by name, SKU, or shortcut keys (F2).',
                badge: 'Input',
                color: 'blue'
              },
              {
                step: 'Step 2',
                title: 'Rate Tier & Discounting',
                desc: 'Select Rate A, B, C, or D tier. Apply up to 100% invoice discount or item-level margin override.',
                badge: 'Pricing',
                color: 'purple'
              },
              {
                step: 'Step 3',
                title: 'Stock Pre-Validation',
                desc: 'System guarantees stock is deducted directly from Main Store inventory. Prevents negative billing unless allowed.',
                badge: 'Integrity',
                color: 'emerald'
              },
              {
                step: 'Step 4',
                title: 'Payment Tender',
                desc: 'Cash, UPI QR code, Credit Card, or Split Khata (Credit) with customer credit limit checking.',
                badge: 'Settlement',
                color: 'amber'
              },
              {
                step: 'Step 5',
                title: 'Receipt & Auto-Post',
                desc: 'Silent 80mm/58mm thermal print via port 9191, WhatsApp PDF link, and instant Ledger posting.',
                badge: 'Finalize',
                color: 'rose'
              }
            ].map((node, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400">{node.step}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    {node.badge}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">{node.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{node.desc}</p>
              </div>
            ))}
          </div>

          {/* POS Financial Sealing Summary Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
            <table className="w-full text-left divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-2.5">POS Mode</th>
                  <th className="p-2.5">Target Business</th>
                  <th className="p-2.5">Stock Deduction Point</th>
                  <th className="p-2.5">Tender Options</th>
                  <th className="p-2.5">Tax Calculation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-2.5 font-bold text-blue-600">⚡ 1-Tap Counter POS</td>
                  <td className="p-2.5">30–50 Item Kirana, Bakeries, Quick Kiosks</td>
                  <td className="p-2.5">Main Warehouse (Store Inventory)</td>
                  <td className="p-2.5">Cash, UPI, Khata (Credit)</td>
                  <td className="p-2.5">Inclusive GST / Tax-free quick tender</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-indigo-600">🖥️ Advanced Grid POS</td>
                  <td className="p-2.5">Supermarkets, Malls, Multi-Counter Stores</td>
                  <td className="p-2.5">Assigned Counter Godown or Main Store</td>
                  <td className="p-2.5">Cash, Card, UPI, Split, Credit</td>
                  <td className="p-2.5">Detailed CGST, SGST, IGST tax breakdown</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 2: SALESPERSON ROUTE & CUSTOMER DELIVERY HUB */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'salesperson') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Salesperson Dual Route Supply & Home Delivery Workflow
                </h3>
                <p className="text-[11px] text-slate-500">
                  Field operations supporting both nearby B2B store supply with 4 tiered rates and home customer dispatch.
                </p>
              </div>
            </div>
            <Link
              to="/sales/hub"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              Open Delivery Hub <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Track A: B2B Route Delivery */}
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs">
                <Store className="w-4 h-4" />
                <span>Track A: Route Supply to Nearby Small Stores</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span><strong>Rate A / B / C / D Tier Selection:</strong> Product prices dynamically switch according to store agreement tier set by manager.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span><strong>Up to 100% Discount Slider:</strong> Salesperson can offer negotiated percentage discount on the spot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span><strong>1-Click WhatsApp Invoice Dispatch:</strong> Instantly sends formatted order summary to store owner's WhatsApp number.</span>
                </li>
              </ul>
            </div>

            {/* Track B: Direct Customer Home Delivery */}
            <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                <PhoneCall className="w-4 h-4" />
                <span>Track B: Customer Home Deliveries (Call & WhatsApp)</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span><strong>Cashier / Manager Inbound Desk:</strong> Order is recorded via Phone Call / WhatsApp desk, auto-billed, and assigned to a delivery staff.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span><strong>Salesperson Field Console:</strong> Salesperson views customer name, address, phone with 1-tap call button and Google Maps link.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span><strong>COD / UPI Collection:</strong> Salesperson collects cash or shows UPI QR code, then marks status as "Delivered".</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 3: INVENTORY, GODOWNS & BARCODE LABELS */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'inventory') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Inventory, Godowns & Barcode Labels Operations
                </h3>
                <p className="text-[11px] text-slate-500">
                  Stock integrity guarantee: Supplier Receiving → Main Godown → Counter Transfers → Shelf Barcoding.
                </p>
              </div>
            </div>
            <Link
              to="/inventory"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              Open Inventory <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                Main Godown Stock Guarantee
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Regardless of single or multi-warehouse setup, all sales invoices and POS deductions automatically default to the primary Store Inventory (Main Warehouse), preventing ghost inventory.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-emerald-500" />
                Inter-Warehouse Stock Transfers
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Move stock freely between Godown Storage and Counter POS with zero latency. Stock balances update across source and target warehouses with an immutable audit log trail.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-purple-500" />
                Two Labeling Options
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <strong>Option A:</strong> Print custom thermal barcode stickers (50x25, 38x25mm).<br />
                <strong>Option B:</strong> Scan & bind pre-printed manufacturer EAN-13 barcodes + print shelf-edge price talkers.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 4: HR, ATTENDANCE & PAYROLL */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'hr') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  4. Staff Directory, Daily Attendance & Automated Payroll
                </h3>
                <p className="text-[11px] text-slate-500">
                  Full employee lifecycle: Full-time/part-time, monthly/hourly/daily wages, leave approvals, payslips, and auto-posting to Accounts.
                </p>
              </div>
            </div>
            <Link
              to="/payroll"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              Open Payroll <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Staff Setup</span>
              <p className="text-slate-500 dark:text-slate-400">
                Register employee code, department, bank account details, employment type, and salary structure (Monthly, Daily wage, or Hourly).
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">2. Daily Attendance</span>
              <p className="text-slate-500 dark:text-slate-400">
                1-tap "Mark All Present" shortcut. Tracks Present, Absent, Half Day, Holiday, and Overtime hours worked.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Leave Management</span>
              <p className="text-slate-500 dark:text-slate-400">
                Submit and review Casual, Sick, Earned, or Unpaid leaves with manager approval. Paid leaves protect salary deductions.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">4. Payroll Execution</span>
              <p className="text-slate-500 dark:text-slate-400">
                Computes net payout with overtime, bonuses, allowances, and unpaid leave deductions. Generates payslips and auto-posts expense to Accounts ledger.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 5: ACCOUNTS & FINANCIAL CLOSURE */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'accounting') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  5. Double-Entry Accounting & Financial Sealing Architecture
                </h3>
                <p className="text-[11px] text-slate-500">
                  Real-time synchronization between sales, purchases, payroll, day books, trial balance, and balance sheet.
                </p>
              </div>
            </div>
            <Link
              to="/accounting"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              Open Accounts <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
              Financial Integrity & Ledger Auto-Posting Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-emerald-600 block mb-1">Sales Invoices & POS</span>
                <span className="text-slate-500">Debits Cash/Bank/Receivables and Credits Sales Revenue + GST Tax Payables (CGST/SGST/IGST).</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-blue-600 block mb-1">Supplier Purchases</span>
                <span className="text-slate-500">Debits Inventory / COGS + GST Input Tax Credit and Credits Supplier Accounts Payable.</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-purple-600 block mb-1">Monthly Payroll Runs</span>
                <span className="text-slate-500">Debits Salaries & Wages Expense Account and Credits Cash / Bank Account for total net salary payout.</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 6: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX */}
      {/* ===================================================================== */}
      {(activeWorkflow === 'all' || activeWorkflow === 'rbac') && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                6. Complete Role-Based Access Control (RBAC) Matrix
              </h3>
              <p className="text-[11px] text-slate-500">
                Strict isolation: Salespersons and Cashiers see only their 2–4 billing/delivery tools without scrolling.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
            <table className="w-full text-left divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">Billing & POS</th>
                  <th className="p-2.5">Delivery Hub</th>
                  <th className="p-2.5">Stock & Transfers</th>
                  <th className="p-2.5">HR & Payroll</th>
                  <th className="p-2.5">Financial Ledgers</th>
                  <th className="p-2.5">Sidebar Height & Scroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-2.5 font-bold text-slate-900 dark:text-white">Owner / Admin</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Full Access</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Full Access</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Full Access</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Full Access</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Full Access</td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-500">Grouped 4 Sections (Zero scroll)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-blue-600">Salesperson</td>
                  <td className="p-2.5 text-emerald-600 font-bold">POS & Invoices</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Route + Deliveries</td>
                  <td className="p-2.5 text-amber-600">Stock View Only</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 font-mono text-[10px] text-emerald-600 font-bold">3 items only (~150px, No scroll)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-purple-600">Cashier</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Fast POS & Inbound</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Dispatch Assignment</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 font-mono text-[10px] text-emerald-600 font-bold">4 items only (~180px, No scroll)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-indigo-600">Accountant</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Run Payroll & Slips</td>
                  <td className="p-2.5 text-emerald-600 font-bold">P&L, Trial Bal, Daybook</td>
                  <td className="p-2.5 font-mono text-[10px] text-emerald-600 font-bold">5 items only (~220px, No scroll)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-amber-600">Warehouse Manager</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-emerald-600 font-bold">Transfers, GRN, Labels</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 text-slate-400">Restricted</td>
                  <td className="p-2.5 font-mono text-[10px] text-emerald-600 font-bold">4 items only (~180px, No scroll)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
