import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  Users,
  FileText,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Package,
  Boxes,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { SalesInvoice } from '../../types';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { calculateStockStatus } from '../../utils/inventoryUtils';

export const SalespersonDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    company,
    customers,
    salesInvoices,
    products
  } = useERP();

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Dynamic time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Sales Person';

  // 1. Sales & Activity Metrics computed from real Supabase records
  const {
    mySalesTodayVal,
    todaySalesCount,
    totalSalesVolume,
    recentSalesActivityCount,
    recentSalesList
  } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const todayInvoices = salesInvoices.filter(
      inv => inv.date === todayStr && inv.docType !== 'quotation'
    );
    const todaySalesVal = todayInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

    const totalVolume = salesInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const recentActivity = salesInvoices.filter(
      inv => inv.date && inv.date >= sevenDaysAgoStr
    );

    const sorted = [...salesInvoices]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date).getTime();
        const dateB = new Date(b.createdAt || b.date).getTime();
        return dateB - dateA;
      })
      .slice(0, 10);

    return {
      mySalesTodayVal: todaySalesVal,
      todaySalesCount: todayInvoices.length,
      totalSalesVolume: totalVolume,
      recentSalesActivityCount: recentActivity.length,
      recentSalesList: sorted
    };
  }, [salesInvoices]);

  // 2. Real Inventory Product Stock Metrics (Section 5 requirements)
  const { availableCount, lowStockCount, outOfStockCount } = useMemo(() => {
    let available = 0;
    let low = 0;
    let out = 0;

    products.forEach(p => {
      const status = calculateStockStatus(p.currentStock, p.reorderLevel);
      if (status === 'Out of Stock') {
        out++;
      } else if (status === 'Limited Stock') {
        low++;
      } else {
        available++;
      }
    });

    return {
      availableCount: available,
      lowStockCount: low,
      outOfStockCount: out
    };
  }, [products]);

  // Filtered recent sales table by search query
  const filteredRecentSales = useMemo(() => {
    if (!tableSearch.trim()) return recentSalesList;
    const q = tableSearch.toLowerCase().trim();
    return recentSalesList.filter(
      inv =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.docType || '').toLowerCase().includes(q) ||
        (inv.paymentStatus || '').toLowerCase().includes(q)
    );
  }, [recentSalesList, tableSearch]);

  const handleOpenInvoice = (inv: SalesInvoice) => {
    setSelectedInvoice(inv);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="glass-panel p-5 border border-slate-200/90 rounded-2xl shadow-xs bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {greeting}, {displayName}!
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Sales Person Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>{company.name || 'Universal Billing Workspace'}</span>
            <span>•</span>
            <span className="font-mono text-slate-600">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/inventory')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>Check Inventory</span>
          </button>
          <button
            onClick={() => navigate('/customers?action=new')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* 2. Mandatory 6 Dashboard Cards from Master Prompt (Each opening its authorized page) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Customers -> /customers */}
        <StatCard
          title="Total Customers"
          value={formatNumber(customers.length)}
          subtitle="Client directory"
          icon={Users}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          onClick={() => navigate('/customers')}
        />

        {/* Card 2: My Sales Activity -> /sales */}
        <StatCard
          title="My Sales Activity"
          value={formatCurrency(mySalesTodayVal)}
          subtitle={`${todaySalesCount} bill${todaySalesCount === 1 ? '' : 's'} today`}
          icon={ShoppingCart}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => navigate('/sales')}
        />

        {/* Card 3: Recent Sales Records -> /sales */}
        <StatCard
          title="Recent Sales Records"
          value={`${formatNumber(recentSalesActivityCount)} Records`}
          subtitle="Past 7 days activity"
          icon={FileText}
          iconBgColor="bg-indigo-50"
          iconTextColor="text-indigo-600"
          onClick={() => navigate('/sales')}
        />

        {/* Card 4: Available Products -> /inventory?status=available */}
        <StatCard
          title="Available Products"
          value={formatNumber(availableCount)}
          subtitle="Ready for sale"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => navigate('/inventory?status=available')}
        />

        {/* Card 5: Low-Stock Products -> /inventory?status=low */}
        <StatCard
          title="Low-Stock Products"
          value={formatNumber(lowStockCount)}
          subtitle="At or below warning"
          icon={AlertTriangle}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => navigate('/inventory?status=low')}
        />

        {/* Card 6: Out-of-Stock Products -> /inventory?status=out */}
        <StatCard
          title="Out-of-Stock Products"
          value={formatNumber(outOfStockCount)}
          subtitle="0 units in stock"
          icon={AlertCircle}
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          onClick={() => navigate('/inventory?status=out')}
        />
      </div>

      {/* 3. Recent Sales Records Table (View Only) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Recent Sales Records</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 text-slate-600">
                {filteredRecentSales.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500">Authorized sales activity and customer transactions</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search records or customer..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-64"
              />
            </div>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1.5 cursor-pointer whitespace-nowrap"
            >
              View All &rarr;
            </button>
          </div>
        </div>

        {filteredRecentSales.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700">No sales records found</p>
            <p className="text-xs text-slate-400 mt-1">
              Recorded transactions and orders will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Invoice / Order #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-center">Items</th>
                  <th className="py-3 px-3 text-right">Grand Total</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecentSales.map(inv => {
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => handleOpenInvoice(inv)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 group-hover:underline">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                        {formatDate(inv.date)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {inv.items?.length || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={inv.paymentStatus || 'Completed'} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenInvoice(inv);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View Sales Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Details & Print Slip Modal */}
      <InvoicePrintModal
        invoice={selectedInvoice}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
};
