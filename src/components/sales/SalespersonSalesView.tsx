import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  User,
  PackageCheck,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { SalesInvoice } from '../../types';
import { InvoicePrintModal } from '../invoice/InvoicePrintModal';

export const SalespersonSalesView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { salesInvoices } = useERP();

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Tab: 'all' | 'orders' | 'invoices'
  const initialTab = searchParams.get('tab') || (searchParams.get('filter') === 'today' ? 'invoices' : 'all');
  const [salesTab, setSalesTab] = useState<'all' | 'orders' | 'invoices'>(
    initialTab === 'orders' ? 'orders' : initialTab === 'invoices' ? 'invoices' : 'all'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>(
    searchParams.get('filter') === 'today' ? 'today' : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Separated Order slips vs Invoices
  const preparedSalesOrders = useMemo(() => {
    return salesInvoices.filter(
      inv => inv.docType === 'sales_order' || inv.docType === 'quotation' || inv.docType === 'estimate'
    );
  }, [salesInvoices]);

  const confirmedInvoices = useMemo(() => {
    return salesInvoices.filter(
      inv => inv.docType !== 'sales_order' && inv.docType !== 'quotation' && inv.docType !== 'estimate'
    );
  }, [salesInvoices]);

  // Overall metric summaries
  const metrics = useMemo(() => {
    let completedCount = 0;
    let completedVal = 0;
    let pendingCount = 0;
    let pendingVal = 0;

    salesInvoices.forEach(inv => {
      const val = Number(inv.grandTotal) || 0;
      if (inv.paymentStatus === 'Paid') {
        completedCount++;
        completedVal += val;
      } else {
        pendingCount++;
        pendingVal += val;
      }
    });

    return {
      totalCount: salesInvoices.length,
      completedCount,
      completedVal,
      pendingCount,
      pendingVal
    };
  }, [salesInvoices]);

  // Filtered sales records
  const displayedSalesList = useMemo(() => {
    let list = salesInvoices;
    if (salesTab === 'orders') {
      list = preparedSalesOrders;
    } else if (salesTab === 'invoices') {
      list = confirmedInvoices;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    return list.filter(record => {
      // Date Filter
      if (dateFilter === 'today' && record.date !== todayStr) return false;
      if (dateFilter === 'week' && (!record.date || record.date < sevenDaysAgoStr)) return false;
      if (dateFilter === 'month' && (!record.date || record.date < monthStartStr)) return false;

      // Status Filter
      if (statusFilter === 'paid' && record.paymentStatus !== 'Paid') return false;
      if (statusFilter === 'unpaid' && record.paymentStatus === 'Paid') return false;

      // Text Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = (record.invoiceNumber || '').toLowerCase().includes(q);
        const matchesCust = (record.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (record.customerPhone || '').toLowerCase().includes(q);
        const matchesDate = (record.date || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesCust && !matchesPhone && !matchesDate) return false;
      }

      return true;
    });
  }, [salesInvoices, preparedSalesOrders, confirmedInvoices, salesTab, dateFilter, statusFilter, searchQuery]);

  const handleTabChange = (tab: 'all' | 'orders' | 'invoices') => {
    setSalesTab(tab);
    if (tab === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner (Strictly Read-Only) */}
      <div className="glass-panel p-5 border border-slate-200/90 rounded-2xl shadow-xs bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Sales Records &amp; Activity
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  Sales Person View
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  View-Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Look up past sales transactions, order statuses, and customer purchase details to assist shoppers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => handleTabChange('all')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            salesTab === 'all'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Total Sales Records
            </span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatNumber(metrics.totalCount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across all orders &amp; invoices
          </div>
        </button>

        <button
          onClick={() => {
            handleTabChange('all');
            setStatusFilter('paid');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'paid' && salesTab === 'all'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Completed &amp; Paid
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {formatNumber(metrics.completedCount)}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-1">
            {formatCurrency(metrics.completedVal)} finalized by Cashier
          </div>
        </button>

        <button
          onClick={() => {
            handleTabChange('orders');
            setStatusFilter('all');
          }}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            salesTab === 'orders'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Pending Orders
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {formatNumber(metrics.pendingCount)}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-1">
            {formatCurrency(metrics.pendingVal)} awaiting checkout
          </div>
        </button>
      </div>

      {/* 3. Tab Filter Buttons */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          onClick={() => handleTabChange('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            salesTab === 'all'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>All Sales Records ({salesInvoices.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            salesTab === 'orders'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Sales Orders ({preparedSalesOrders.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('invoices')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            salesTab === 'invoices'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Confirmed Invoices ({confirmedInvoices.length})</span>
        </button>
      </div>

      {/* 4. Search and Date/Status Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by invoice/order #, customer name, date..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Date:</span>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Completed &amp; Paid</option>
              <option value="unpaid">Pending / Unpaid</option>
            </select>
          </div>

          {(searchQuery || dateFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFilter('all');
                setStatusFilter('all');
              }}
              className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 5. Sales Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              {salesTab === 'orders'
                ? 'Sales Orders & Slips'
                : salesTab === 'invoices'
                ? 'Confirmed Sales Invoices'
                : 'All Customer Sales Records'}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {displayedSalesList.length} {displayedSalesList.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Click any row to inspect itemized products &amp; prices
          </span>
        </div>

        {displayedSalesList.length === 0 ? (
          <div className="py-14 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
            <p className="font-semibold text-slate-700 text-sm">No sales records found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || dateFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search query or reset status filters.'
                : 'No sales records exist in the system yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Document #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Order Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedSalesList.map(record => {
                  const isPaid = record.paymentStatus === 'Paid';
                  return (
                    <tr
                      key={record.id}
                      onClick={() => {
                        setSelectedInvoice(record);
                        setIsPrintOpen(true);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {record.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {formatDate(record.date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{record.customerName}</div>
                        {record.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono">{record.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                        {record.items?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(record.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed &amp; Paid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Pending Cashier Checkout</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedInvoice(record);
                            setIsPrintOpen(true);
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
                          title="View Sales Details & Slip"
                          aria-label="View Sales Details & Slip"
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

      {/* 6. Invoice / Order Print Modal for customer inquiry assistance */}
      <InvoicePrintModal
        invoice={selectedInvoice}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  );
};
