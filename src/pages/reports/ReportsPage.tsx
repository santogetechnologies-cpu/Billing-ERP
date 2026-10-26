import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  Building2,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { StatusBadge, StockStatusBadge } from '../../components/common/StatusBadge';
import { calculateStockStatus, calculateBatchStatus } from '../../utils/inventoryUtils';
import { sortProductsAZ } from '../../utils/sortUtils';

type ReportCategory = 'sales' | 'purchases' | 'inventory' | 'financial';

interface ReportDefinition {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
}

const REPORT_DEFINITIONS: ReportDefinition[] = [
  // Sales
  { id: 'sales-summary', name: 'Sales Summary Register', category: 'sales', description: 'Comprehensive transaction-level sales register with taxes and discounts.' },
  { id: 'sales-by-product', name: 'Sales by Product', category: 'sales', description: 'Volume and revenue breakdown by individual product lines.' },
  { id: 'sales-by-customer', name: 'Sales by Customer', category: 'sales', description: 'Customer-wise turnover, order frequency, and contribution.' },
  { id: 'sales-by-category', name: 'Sales by Category', category: 'sales', description: 'Category performance and sales contribution percentages.' },
  { id: 'sales-returns', name: 'Sales Returns & Credit Notes', category: 'sales', description: 'Item returns, return rates, and reversal analysis.' },

  // Purchases
  { id: 'purchase-summary', name: 'Purchase Summary Register', category: 'purchases', description: 'Supplier bill register, inward tax credits, and payment statuses.' },
  { id: 'purchase-by-supplier', name: 'Purchase by Supplier', category: 'purchases', description: 'Vendor procurement volumes and credit terms utilization.' },
  { id: 'purchase-by-product', name: 'Purchase by Product', category: 'purchases', description: 'Raw materials and inventory inward purchases by item.' },

  // Inventory
  { id: 'stock-summary', name: 'Stock Summary & Valuation', category: 'inventory', description: 'Current physical inventory, reorder levels, and asset values.' },
  { id: 'batch-expiry', name: 'Batch & Expiry Date Report', category: 'inventory', description: 'Shelf life, expired lots, expiring soon products, and active batch registry.' },
  { id: 'low-stock', name: 'Low Stock & Reorder Alert', category: 'inventory', description: 'Products currently at or below minimum buffer threshold.' },
  { id: 'fast-moving', name: 'Fast-Moving vs Slow-Moving', category: 'inventory', description: 'Stock turn velocity and sales frequency velocity matrix.' },

  // Financial
  { id: 'expense-report', name: 'Expense Breakdown by Category', category: 'financial', description: 'Operational overheads grouped across 17 cost centers.' },
  { id: 'receivables-aging', name: 'Accounts Receivable Aging', category: 'financial', description: 'Customer outstanding grouped into 5 aging buckets.' },
  { id: 'payables-aging', name: 'Accounts Payable Aging', category: 'financial', description: 'Vendor payment commitments and schedule analysis.' }
];

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { salesInvoices, purchaseInvoices, products, customers, suppliers, expenses, batches } = useERP();

  const reportDefinitions = REPORT_DEFINITIONS;

  const initialReportParam = searchParams.get('report');
  const initialCatParam = searchParams.get('category') as ReportCategory | null;
  const initialMatchedReport = initialReportParam ? reportDefinitions.find(r => r.id === initialReportParam) : undefined;

  const [activeCategory, setActiveCategory] = useState<ReportCategory>(
    initialMatchedReport?.category ||
    (initialCatParam && ['sales', 'purchases', 'inventory', 'financial'].includes(initialCatParam) ? initialCatParam : 'sales')
  );
  const [selectedReportId, setSelectedReportId] = useState<string>(
    initialMatchedReport?.id || (initialCatParam === 'inventory' ? 'stock-summary' : 'sales-summary')
  );
  const [dateRange, setDateRange] = useState<string>('month');
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-sync category and report if navigated with query params later
  useEffect(() => {
    const reportParam = searchParams.get('report');
    const catParam = searchParams.get('category') as ReportCategory | null;
    if (reportParam) {
      const match = reportDefinitions.find(r => r.id === reportParam);
      if (match) {
        setActiveCategory(match.category);
        setSelectedReportId(match.id);
        return;
      }
    }
    if (catParam && ['sales', 'purchases', 'inventory', 'financial'].includes(catParam)) {
      setActiveCategory(catParam);
    }
  }, [searchParams, reportDefinitions]);

  const currentReport = reportDefinitions.find(r => r.id === selectedReportId) || reportDefinitions[0];

  // Dynamic Report Data Generation
  const reportData = useMemo(() => {
    switch (selectedReportId) {
      case 'sales-summary':
        return salesInvoices.map(inv => ({
          col1: inv.invoiceNumber,
          col2: inv.customerName,
          col3: formatDate(inv.date),
          col4: inv.paymentMethod,
          col5: formatCurrency(inv.subtotal),
          col6: formatCurrency(inv.taxTotal),
          col7: formatCurrency(inv.grandTotal),
          status: inv.paymentStatus
        }));

      case 'sales-by-product': {
        const prodMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
        salesInvoices.forEach(inv => {
          inv.items.forEach(item => {
            if (!prodMap[item.productId]) {
              prodMap[item.productId] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
            }
            prodMap[item.productId].qty += item.qty;
            prodMap[item.productId].revenue += item.total;
            const prod = products.find(p => p.id === item.productId);
            const cost = prod ? prod.costPrice * item.qty : item.rate * 0.7 * item.qty;
            prodMap[item.productId].profit += item.total - cost;
          });
        });
        return Object.values(prodMap).map(p => ({
          col1: p.name,
          col2: `${p.qty} Units`,
          col3: formatCurrency(p.revenue),
          col4: formatCurrency(p.profit),
          col5: p.revenue > 0 ? `${((p.profit / p.revenue) * 100).toFixed(1)}%` : '0%',
          col6: 'Active',
          col7: 'Top Seller',
          status: 'Normal'
        }));
      }

      case 'sales-by-customer':
        return customers.map(c => ({
          col1: c.name,
          col2: c.type,
          col3: c.phone,
          col4: formatCurrency(c.totalPurchased),
          col5: formatCurrency(c.totalPaid),
          col6: formatCurrency(c.currentOutstanding),
          col7: `${c.creditDays} Days`,
          status: c.status
        }));

      case 'stock-summary':
        return sortProductsAZ(products).map(p => ({
          col1: p.sku,
          col2: p.name,
          col3: p.category,
          col4: `${p.currentStock} ${p.primaryUnit}`,
          col5: formatCurrency(p.costPrice),
          col6: formatCurrency(p.sellingPrice),
          col7: formatCurrency(p.currentStock * p.costPrice),
          status: calculateStockStatus(p.currentStock, p.reorderLevel),
          currentStock: p.currentStock,
          primaryUnit: p.primaryUnit
        }));

      case 'batch-expiry':
        return sortProductsAZ(batches).map(b => {
          const prod = products.find(p => p.id === b.productId || p.name?.toLowerCase() === b.productName?.toLowerCase());
          const calculatedStatus = calculateBatchStatus(b.expiryDate, b.qty);
          return {
            col1: b.batchNumber,
            col2: b.productName,
            col3: b.mfgDate ? formatDate(b.mfgDate) : '—',
            col4: b.expiryDate ? formatDate(b.expiryDate) : '—',
            col5: `${formatNumber(b.qty)} ${prod?.primaryUnit || 'Units'}`,
            col6: formatCurrency(b.cost),
            col7: formatCurrency((Number(b.cost) || 0) * (Number(b.qty) || 0)),
            status: calculatedStatus
          };
        });

      case 'purchase-by-supplier':
        return suppliers.map(s => ({
          col1: s.name,
          col2: s.company,
          col3: s.phone,
          col4: formatCurrency(s.totalPurchases),
          col5: formatCurrency(s.totalPaid),
          col6: formatCurrency(s.currentOutstanding),
          col7: `${s.creditDays} Days`,
          status: 'Active'
        }));

      case 'expense-report':
        return expenses.map(e => ({
          col1: formatDate(e.date),
          col2: e.category,
          col3: e.vendor,
          col4: e.paymentAccount,
          col5: e.costCentre || 'General',
          col6: e.description,
          col7: formatCurrency(e.amount),
          status: 'Approved'
        }));

      default:
        return [];
    }
  }, [selectedReportId, salesInvoices, products, customers, suppliers, expenses, batches]);

  const headersByReport: Record<string, string[]> = {
    'sales-summary': ['Invoice #', 'Customer Name', 'Date', 'Payment Mode', 'Taxable Amt', 'GST Total', 'Invoice Total', 'Status'],
    'sales-by-product': ['Product Line', 'Quantity Sold', 'Gross Turnover', 'Gross Margin', 'Profit %', 'Category', 'Rank', 'Status'],
    'sales-by-customer': ['Customer', 'Type', 'Phone', 'Total Sales', 'Amount Paid', 'Outstanding', 'Credit Terms', 'Status'],
    'stock-summary': ['SKU', 'Product Description', 'Category', 'Current Stock', 'Cost Price', 'Selling Price', 'Inventory Value', 'Status'],
    'batch-expiry': ['Batch Number', 'Product Name', 'Mfg Date', 'Expiry Date', 'Available Qty', 'Unit Cost', 'Total Value', 'Status'],
    'purchase-by-supplier': ['Supplier Name', 'Company Name', 'Contact', 'Procured Total', 'Settled Total', 'Balance Payable', 'Credit Terms', 'Status'],
    'expense-report': ['Date', 'Category', 'Vendor / Payee', 'Paid Via', 'Cost Center', 'Particulars / Description', 'Amount (₹)', 'Status']
  };

  const currentHeaders = headersByReport[selectedReportId] || ['Field 1', 'Field 2', 'Field 3', 'Field 4', 'Field 5', 'Field 6', 'Field 7', 'Status'];

  const filteredData = reportData.filter(row => {
    return Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleExportCSV = () => {
    const csvContent = [
      currentHeaders.join(','),
      ...filteredData.map(r =>
        [r.col1, r.col2, r.col3, r.col4, r.col5, r.col6, r.col7, r.status]
          .map(val => `"${String(val).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedReportId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Enterprise Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Downloadable audit reports covering Sales, Purchases, Stock Valuation, Vendor Procurement, and Financial Books.
          </p>
        </div>

        {/* Global Export & Print buttons (Prompt #41, #42) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveCategory('sales');
            setSelectedReportId('sales-summary');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeCategory === 'sales'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Sales Reports</span>
        </button>

        <button
          onClick={() => {
            setActiveCategory('purchases');
            setSelectedReportId('purchase-summary');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeCategory === 'purchases'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Purchase Reports</span>
        </button>

        <button
          onClick={() => {
            setActiveCategory('inventory');
            setSelectedReportId('stock-summary');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeCategory === 'inventory'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Inventory Reports</span>
        </button>

        <button
          onClick={() => {
            setActiveCategory('financial');
            setSelectedReportId('expense-report');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeCategory === 'financial'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Financial Reports</span>
        </button>
      </div>

      {/* Report Filter & Parameter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Specific Report Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Choose Specific Report
          </label>
          <select
            value={selectedReportId}
            onChange={e => setSelectedReportId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {reportDefinitions
              .filter(r => r.category === activeCategory)
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>

        {/* Date Filter (Prompt #41: Date filter) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Reporting Date Period
          </label>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month (October 2026)</option>
            <option value="quarter">This Quarter (Q2 FY 2026-27)</option>
            <option value="year">Full Financial Year 2026-27</option>
          </select>
        </div>

        {/* Search within Report */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Filter Results
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Report Info Banner */}
      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-slate-900">{currentReport.name}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{currentReport.description}</p>
        </div>
        <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-700">
          {filteredData.length} Records Found
        </span>
      </div>

      {/* Dynamic Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                {currentHeaders.map((hdr, idx) => (
                  <th
                    key={idx}
                    className={`py-3 px-4 ${idx >= 4 && idx < 7 ? 'text-right' : idx === 7 ? 'text-center' : ''}`}
                  >
                    {hdr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={currentHeaders.length} className="py-8 text-center text-slate-400">
                    No matching records found for this report.
                  </td>
                </tr>
              ) : (
                filteredData.map((row: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{row.col1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{row.col2}</td>
                    <td className="py-3 px-4 text-slate-600">{row.col3}</td>
                    <td className="py-3 px-4 text-slate-600">{row.col4}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">{row.col5}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">{row.col6}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">{row.col7}</td>
                    <td className="py-3 px-4 text-center">
                      <StockStatusBadge
                        status={row.status}
                        currentStock={row.currentStock}
                        unit={row.primaryUnit}
                        size="sm"
                        align="center"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
