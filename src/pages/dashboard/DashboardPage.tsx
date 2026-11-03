import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  Boxes,
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Zap,
  Package,
  FileText,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  Truck,
  Scale,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { hasPermission, canAccessRoute } from '../../utils/rbac';
import { WarehouseManagerDashboardPage } from '../warehouse/WarehouseManagerDashboardPage';
import { PurchaseManagerDashboardPage } from '../purchases/PurchaseManagerDashboardPage';
import { AccountantDashboardPage } from '../accounting/AccountantDashboardPage';
import { UserPresenceBadge } from '../../components/common/UserPresenceBadge';
import { RoleQuickStartCard } from '../../components/dashboard/RoleQuickStartCard';
import { GuidedOnboardingModal } from '../../components/onboarding/GuidedOnboardingModal';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Role-based route redirection: POS-only Cashier, Salesperson dashboard, Warehouse Manager, Purchase Manager, and Accountant
  if (profile?.role === 'Warehouse Manager') {
    return <WarehouseManagerDashboardPage />;
  }
  if (profile?.role === 'Salesperson') {
    return <Navigate to="/sales/dashboard" replace />;
  }
  if (profile?.role === 'Cashier') {
    return <Navigate to="/sales/pos" replace />;
  }
  if (profile?.role === 'Purchase Manager') {
    return <PurchaseManagerDashboardPage />;
  }
  if (profile?.role === 'Accountant') {
    return <AccountantDashboardPage />;
  }

  const {
    products,
    customers,
    suppliers,
    salesInvoices,
    purchaseInvoices,
    expenses,
    payments,
    inventoryTransactions,
    company
  } = useERP();

  const [dateRange, setDateRange] = useState('This Month');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [showFullFinancials, setShowFullFinancials] = useState(false);

  // Compute Live Metrics from ERPContext state
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Sales
    const totalSales = salesInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const todaySalesList = salesInvoices.filter(inv => inv.date === todayStr);
    const todaySales = todaySalesList.reduce((acc, inv) => acc + inv.grandTotal, 0);

    // 2. Purchases
    const totalPurchases = purchaseInvoices.reduce((acc, p) => acc + p.grandTotal, 0);
    const todayPurchasesList = purchaseInvoices.filter(p => p.date === todayStr);
    const todayPurchases = todayPurchasesList.reduce((acc, p) => acc + p.grandTotal, 0);

    // 3. Expenses
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const todayExpensesList = expenses.filter(e => e.date === todayStr);
    const todayExpenses = todayExpensesList.reduce((acc, e) => acc + e.amount, 0);

    // 4. Receivables & Payables
    const totalReceivables = customers.reduce((acc, c) => acc + c.currentOutstanding, 0);
    const totalPayables = suppliers.reduce((acc, s) => acc + s.currentOutstanding, 0);

    // 5. Stock Value
    const stockValue = products.reduce((acc, p) => acc + p.currentStock * p.costPrice, 0);

    // 6. Gross & Net Profit
    let cogs = 0;
    salesInvoices.forEach(inv => {
      inv.items.forEach(item => {
        cogs += item.qty * (item.costPrice || item.rate * 0.75);
      });
    });
    const grossProfit = Math.max(0, totalSales - cogs);
    const netProfit = Math.max(0, grossProfit - totalExpenses);
    const grossMarginPct = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : '0';

    return {
      todaySales,
      todayPurchases,
      todayExpenses,
      todayInvoicesCount: todaySalesList.length,
      todayPurchasesCount: todayPurchasesList.length,
      todayExpensesCount: todayExpensesList.length,
      grossProfit,
      grossMarginPct,
      netProfit,
      totalReceivables,
      totalPayables,
      stockValue,
      totalSales
    };
  }, [salesInvoices, purchaseInvoices, expenses, customers, suppliers, products]);

  // Top Selling Products
  const topSellingProducts = useMemo(() => {
    const productStats: Record<string, { qty: number; revenue: number; profit: number; product: any }> = {};

    salesInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!productStats[item.productId]) {
          const prod = products.find(p => p.id === item.productId);
          productStats[item.productId] = {
            qty: 0,
            revenue: 0,
            profit: 0,
            product: prod || { name: item.productName, sku: item.sku }
          };
        }
        productStats[item.productId].qty += item.qty;
        productStats[item.productId].revenue += item.total;
        const cost = item.qty * (item.costPrice || item.rate * 0.75);
        productStats[item.productId].profit += item.total - cost;
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [salesInvoices, products]);

  // Low Stock Items (Limited Stock or Out of Stock)
  const lowStockProducts = useMemo(() => {
    return products
      .filter(p => {
        const s = calculateStockStatus(p.currentStock, p.reorderLevel);
        return s === 'Limited Stock' || s === 'Out of Stock';
      })
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 5);
  }, [products]);

  // Top Customers
  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.totalPurchased - a.totalPurchased)
      .slice(0, 5);
  }, [customers]);

  // Combined Recent Transactions
  const recentTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      title: string;
      party: string;
      type: 'Invoice' | 'Purchase' | 'Expense' | 'Payment' | 'Stock';
      amount?: number;
      status?: string;
      link: string;
    }> = [];

    salesInvoices.slice(0, 4).forEach(inv => {
      list.push({
        id: inv.id,
        date: inv.date,
        title: inv.invoiceNumber,
        party: inv.customerName,
        type: 'Invoice',
        amount: inv.grandTotal,
        status: inv.paymentStatus,
        link: '/sales'
      });
    });

    purchaseInvoices.slice(0, 2).forEach(pur => {
      list.push({
        id: pur.id,
        date: pur.date,
        title: pur.invoiceNumber,
        party: pur.supplierName,
        type: 'Purchase',
        amount: pur.grandTotal,
        status: pur.paymentStatus,
        link: '/purchases'
      });
    });

    payments.slice(0, 2).forEach(pay => {
      list.push({
        id: pay.id,
        date: pay.date,
        title: pay.paymentNumber,
        party: pay.partyName,
        type: 'Payment',
        amount: pay.amount,
        status: pay.type,
        link: '/payments'
      });
    });

    expenses.slice(0, 2).forEach(exp => {
      list.push({
        id: exp.id,
        date: exp.date,
        title: exp.category,
        party: exp.vendor || 'Operations',
        type: 'Expense',
        amount: exp.amount,
        status: 'Paid',
        link: '/expenses'
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  }, [salesInvoices, purchaseInvoices, payments, expenses]);

  // Category sales data for SVG donut chart
  const categorySales = useMemo(() => {
    const cats: Record<string, number> = {};
    salesInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cat = prod?.category || 'General';
        cats[cat] = (cats[cat] || 0) + item.total;
      });
    });
    const entries = Object.entries(cats);
    if (entries.length === 0) {
      return [];
    }
    const colors = ['#2563eb', '#0284c7', '#0d9488', '#16a34a', '#eab308', '#f97316', '#8b5cf6'];
    return entries.map(([label, val], idx) => ({
      label,
      val,
      color: colors[idx % colors.length]
    }));
  }, [salesInvoices, products]);

  const totalCatVal = useMemo(() => {
    return categorySales.reduce((acc, c) => acc + c.val, 0);
  }, [categorySales]);

  // Monthly stats for bar chart
  const monthlyStats = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      const sales = salesInvoices
        .filter(inv => inv.date?.startsWith(yearMonth))
        .reduce((sum, inv) => sum + inv.grandTotal, 0);

      const pur = purchaseInvoices
        .filter(p => p.date?.startsWith(yearMonth))
        .reduce((sum, p) => sum + p.grandTotal, 0);

      const exp = expenses
        .filter(e => e.date?.startsWith(yearMonth))
        .reduce((sum, e) => sum + e.amount, 0);

      const profit = Math.max(0, sales - pur - exp);

      months.push({
        month: i === 0 ? `${monthLabel} (Curr)` : monthLabel,
        key: yearMonth,
        sales,
        pur,
        profit
      });
    }

    const peak = Math.max(...months.map(m => Math.max(m.sales, m.pur, m.profit)), 1000);
    return { months, peak };
  }, [salesInvoices, purchaseInvoices, expenses]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. Sleek, Minimal Store Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Store Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
              {company.name || 'Universal Store'} • FY {company.financialYear}
            </span>
            <UserPresenceBadge size="sm" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time daily operations, fast billing shortcuts, and inventory health.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
            </select>
          </div>

          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Setup Guide"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Setup Guide</span>
          </button>
        </div>
      </div>

      <GuidedOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* 2. Prominent 1-Click Action Bar (Easiest to Use) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/sales/pos')}
          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-bold text-xs"
        >
          <Zap className="w-5 h-5 text-amber-300" />
          <span>POS Billing</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/products/initial-stock')}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold text-xs"
        >
          <Package className="w-5 h-5 text-blue-600" />
          <span>Add Product</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/sales/hub')}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold text-xs"
        >
          <Truck className="w-5 h-5 text-emerald-600" />
          <span>Route & Delivery</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/inventory/conversion')}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold text-xs"
        >
          <Scale className="w-5 h-5 text-purple-600" />
          <span>Repackaging & BOM</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold text-xs"
        >
          <Users className="w-5 h-5 text-indigo-600" />
          <span>Customer Khata</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/accounting')}
          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer font-semibold text-xs"
        >
          <BookOpen className="w-5 h-5 text-rose-600" />
          <span>Accounts & JV</span>
        </button>
      </div>

      {/* 3. Collapsible Role Quick Start Checklist */}
      <RoleQuickStartCard />

      {/* 4. Primary 4 Core Business Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sales Today"
          value={formatCurrency(metrics.todaySales)}
          subtitle={`${metrics.todayInvoicesCount} Invoices Generated`}
          icon={ShoppingCart}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={canAccessRoute(profile?.role, '/sales') ? () => navigate('/sales') : undefined}
        />
        <StatCard
          title="Purchases Today"
          value={formatCurrency(metrics.todayPurchases)}
          subtitle={`${metrics.todayPurchasesCount} Inward Shipments`}
          icon={ShoppingBag}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={canAccessRoute(profile?.role, '/purchases') ? () => navigate('/purchases') : undefined}
        />
        <StatCard
          title="Customer Due (Khata)"
          value={formatCurrency(metrics.totalReceivables)}
          subtitle={`${customers.length} Accounts Pending`}
          icon={Users}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          onClick={canAccessRoute(profile?.role, '/customers') ? () => navigate('/customers') : undefined}
        />
        <StatCard
          title="Stock in Hand (Asset)"
          value={formatCurrency(metrics.stockValue)}
          subtitle={`${products.length} Master Products`}
          icon={Boxes}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={canAccessRoute(profile?.role, '/inventory') ? () => navigate('/inventory') : undefined}
        />
      </div>

      {/* 5. Clean Toggle for Secondary Financial Detail */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowFullFinancials(!showFullFinancials)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <span>{showFullFinancials ? 'Hide Profit & Ledger Details' : 'View Full Profit & Ledger Breakdown'}</span>
          {showFullFinancials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[11px] text-slate-400">
          Showing metrics for {dateRange.toLowerCase()}
        </span>
      </div>

      {showFullFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
          <StatCard
            title="Gross Profit"
            value={formatCurrency(metrics.grossProfit)}
            subtitle={`Gross Margin: ${metrics.grossMarginPct}%`}
            icon={TrendingUp}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-600"
            onClick={canAccessRoute(profile?.role, '/accounting') ? () => navigate('/accounting') : undefined}
          />
          <StatCard
            title="Net Operating Profit"
            value={formatCurrency(metrics.netProfit)}
            subtitle="After all recorded expenses"
            icon={DollarSign}
            iconBgColor="bg-cyan-50"
            iconTextColor="text-cyan-600"
            onClick={canAccessRoute(profile?.role, '/accounting') ? () => navigate('/accounting') : undefined}
          />
          <StatCard
            title="Operating Expenses"
            value={formatCurrency(metrics.todayExpenses)}
            subtitle={`${metrics.todayExpensesCount} Recorded Vouchers`}
            icon={Receipt}
            iconBgColor="bg-amber-50"
            iconTextColor="text-amber-600"
            onClick={canAccessRoute(profile?.role, '/expenses') ? () => navigate('/expenses') : undefined}
          />
          <StatCard
            title="Supplier Payables"
            value={formatCurrency(metrics.totalPayables)}
            subtitle={`${suppliers.length} Vendor Balances`}
            icon={Building2}
            iconBgColor="bg-rose-50"
            iconTextColor="text-rose-600"
            onClick={canAccessRoute(profile?.role, '/suppliers') ? () => navigate('/suppliers') : undefined}
          />
        </div>
      )}

      {/* 6. Clean Activity & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales & Expense Overview Chart (SVG) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Revenue & Expenses Overview</h2>
              <p className="text-xs text-slate-500">6-Month progression of Sales, Purchases & Profit</p>
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Sales
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Purchases
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Net Profit
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-60 w-full pt-2">
            <svg viewBox="0 0 700 240" className="w-full h-full overflow-visible">
              {[0, 60, 120, 180].map(y => {
                const val = Math.round(((240 - y) / 240) * monthlyStats.peak);
                return (
                  <g key={y}>
                    <line x1="40" y1={y} x2="680" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="30" y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">
                      {formatNumber(val)}
                    </text>
                  </g>
                );
              })}

              {monthlyStats.months.map((m, i) => {
                const groupX = 80 + i * 100;
                const salesHeight = (m.sales / monthlyStats.peak) * 190;
                const purHeight = (m.pur / monthlyStats.peak) * 190;
                const profitHeight = (m.profit / monthlyStats.peak) * 190;
                return (
                  <g key={m.month}>
                    <rect
                      x={groupX}
                      y={240 - salesHeight}
                      width="18"
                      height={Math.max(2, salesHeight)}
                      rx="3"
                      fill="#2563eb"
                      className="transition-all hover:brightness-110 cursor-pointer"
                    >
                      <title>{`Sales: ₹${m.sales}`}</title>
                    </rect>
                    <rect
                      x={groupX + 22}
                      y={240 - purHeight}
                      width="18"
                      height={Math.max(2, purHeight)}
                      rx="3"
                      fill="#f59e0b"
                      className="transition-all hover:brightness-110 cursor-pointer"
                    >
                      <title>{`Purchases: ₹${m.pur}`}</title>
                    </rect>
                    <rect
                      x={groupX + 44}
                      y={240 - profitHeight}
                      width="18"
                      height={Math.max(2, profitHeight)}
                      rx="3"
                      fill="#10b981"
                      className="transition-all hover:brightness-110 cursor-pointer"
                    >
                      <title>{`Profit: ₹${m.profit}`}</title>
                    </rect>
                    <text
                      x={groupX + 27}
                      y="255"
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {m.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Category Breakdown (Donut SVG Chart) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sales by Category</h2>
            <p className="text-xs text-slate-500">Revenue contribution per product line</p>

            {categorySales.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span>No category sales recorded yet</span>
              </div>
            ) : (
              <div className="relative w-40 h-40 mx-auto my-3 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {(() => {
                    let accumulatedPercent = 0;
                    return categorySales.map((item, idx) => {
                      const percent = (item.val / totalCatVal) * 100;
                      const strokeDash = `${percent} ${100 - percent}`;
                      const strokeDashoffset = -accumulatedPercent;
                      accumulatedPercent += percent;

                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="16"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={strokeDashoffset}
                          pathLength="100"
                          className="transition-all hover:opacity-85"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(totalCatVal)}</span>
                </div>
              </div>
            )}
          </div>

          {categorySales.length > 0 && (
            <div className="space-y-1 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
              {categorySales.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-0.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                    {totalCatVal > 0 ? Math.round((cat.val / totalCatVal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Bottom Operational Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Top Selling Products */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/products')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl shadow-2xs hover:border-blue-400 flex flex-col justify-between group cursor-pointer transition-colors"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors truncate">
                  Top Selling Products
                </p>
                {topSellingProducts.length > 0 ? (
                  <div className="mt-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {topSellingProducts[0].product.name}
                    </h3>
                    <p className="text-xs font-semibold text-emerald-600 mt-0.5 font-mono">
                      {formatCurrency(topSellingProducts[0].revenue)}{' '}
                      <span className="text-slate-400 font-normal font-sans">
                        ({formatNumber(topSellingProducts[0].qty)} sold)
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <h3 className="text-sm font-bold text-slate-400">No Sales Yet</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Invoices track here</p>
                  </div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
                <Package className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">
              {topSellingProducts.length > 0 ? `${topSellingProducts.length} active items` : 'Best sellers'}
            </span>
            <span className="text-blue-600 font-medium flex items-center gap-0.5 text-[11px]">
              <span>View Catalog</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Low Stock Warnings */}
        <div
          role="button"
          tabIndex={0}
          onClick={canAccessRoute(profile?.role, '/inventory') ? () => navigate('/inventory') : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl shadow-2xs hover:border-amber-400 flex flex-col justify-between group cursor-pointer transition-colors"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Low Stock Warnings</span>
                </p>
                {lowStockProducts.length > 0 ? (
                  <div className="mt-1">
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-lg font-bold font-mono text-rose-600">
                        {lowStockProducts.length}
                      </h3>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {lowStockProducts.length === 1 ? 'Item Needs Reorder' : 'Items Need Reorder'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Lowest: <span className="font-semibold text-slate-800 dark:text-slate-200">{lowStockProducts[0].name}</span> ({lowStockProducts[0].currentStock} left)
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-lg font-bold font-mono text-emerald-600">0</h3>
                      <span className="text-xs font-semibold text-emerald-700">Healthy Stock</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">All items above buffer</p>
                  </div>
                )}
              </div>
              <div className={`p-2 rounded-lg shrink-0 ${
                lowStockProducts.length > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">
              {lowStockProducts.length > 0 ? 'Needs reorder' : 'Healthy inventory'}
            </span>
            <span className="text-blue-600 font-medium flex items-center gap-0.5 text-[11px]">
              <span>Manage Stock</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Key Customer Accounts */}
        <div
          role="button"
          tabIndex={0}
          onClick={canAccessRoute(profile?.role, '/customers') ? () => navigate('/customers') : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl shadow-2xs hover:border-purple-400 flex flex-col justify-between group cursor-pointer transition-colors"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors truncate">
                  Top Customer Khata
                </p>
                {topCustomers.length > 0 ? (
                  <div className="mt-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {topCustomers[0].name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 font-mono">
                      {formatCurrency(topCustomers[0].totalPurchased)}{' '}
                      <span className="text-slate-400 font-normal font-sans">
                        ({customers.length} total)
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <h3 className="text-sm font-bold text-slate-400">No Customers</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Parties list here</p>
                  </div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">
              {topCustomers.length > 0 ? 'Highest volume' : 'No accounts yet'}
            </span>
            <span className="text-blue-600 font-medium flex items-center gap-0.5 text-[11px]">
              <span>Customer List</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Recent Activity */}
        <div
          role="button"
          tabIndex={0}
          onClick={canAccessRoute(profile?.role, '/sales') ? () => navigate('/sales') : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 rounded-xl shadow-2xs hover:border-indigo-400 flex flex-col justify-between group cursor-pointer transition-colors"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600 transition-colors truncate">
                  Recent Bills & Activity
                </p>
                {recentTransactions.length > 0 ? (
                  <div className="mt-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {recentTransactions[0].title}
                      </h3>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded shrink-0">
                        {recentTransactions[0].type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 font-mono">
                      {formatCurrency(recentTransactions[0].amount || 0)}{' '}
                      <span className="text-slate-400 font-normal font-sans truncate">
                        · {recentTransactions[0].party}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <h3 className="text-sm font-bold text-slate-400">No Recent Bills</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Entries stream here</p>
                  </div>
                )}
              </div>
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 text-[11px]">
              {recentTransactions.length > 0 ? `${recentTransactions.length} operations` : 'Bills & receipts'}
            </span>
            <span className="text-blue-600 font-medium flex items-center gap-0.5 text-[11px]">
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
