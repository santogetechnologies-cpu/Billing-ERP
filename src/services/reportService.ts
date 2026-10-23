import { supabase } from '../lib/supabase';
import { salesService } from './salesService';
import { purchaseService } from './purchaseService';
import { productService } from './productService';
import { customerService } from './customerService';
import { supplierService } from './supplierService';
import { expenseService } from './expenseService';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';

export interface DashboardMetrics {
  salesToday: number;
  salesGrowth: number;
  purchasesToday: number;
  purchasesGrowth: number;
  expensesToday: number;
  expensesGrowth: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  receivables: number;
  payables: number;
  stockValue: number;
  lowStockItemsCount: number;
  unpaidInvoicesCount: number;
}

export const reportService = {
  async getDashboardMetrics(companyId?: string): Promise<DashboardMetrics> {
    const finalCompanyId = companyId || '00000000-0000-0000-0000-000000000001';

    // Try Supabase RPC first
    try {
      const { data, error } = await supabase.rpc('get_dashboard_analytics', {
        p_company_id: finalCompanyId
      });

      if (!error && data) {
        return {
          salesToday: Number(data.sales_today || 0),
          salesGrowth: 0,
          purchasesToday: Number(data.purchases_today || 0),
          purchasesGrowth: 0,
          expensesToday: Number(data.expenses_today || 0),
          expensesGrowth: 0,
          grossProfit: Number(data.gross_profit || 0),
          netProfit: Number(data.net_profit || 0),
          profitMargin: Number(data.profit_margin || 0),
          receivables: Number(data.receivables || 0),
          payables: Number(data.payables || 0),
          stockValue: Number(data.stock_value || 0),
          lowStockItemsCount: Number(data.low_stock_count || 0),
          unpaidInvoicesCount: Number(data.unpaid_invoices_count || 0)
        };
      }
    } catch (e) {
      console.warn('RPC get_dashboard_analytics unavailable, aggregating from tables:', e);
    }

    // Direct aggregation fallback from real tables
    const [sales, purchases, expenses, products, customers, suppliers] = await Promise.all([
      salesService.getSalesInvoices({}, finalCompanyId),
      purchaseService.getPurchaseInvoices({}, finalCompanyId),
      expenseService.getExpenses({}),
      productService.getProducts({}, finalCompanyId),
      customerService.getCustomers({}, finalCompanyId),
      supplierService.getSuppliers({}, finalCompanyId)
    ]);

    const todayStr = new Date().toISOString().split('T')[0];

    const salesToday = sales
      .filter(s => s.date === todayStr && s.docType !== 'credit_note')
      .reduce((acc, s) => acc + s.grandTotal, 0);

    const totalSales = sales
      .filter(s => s.docType !== 'credit_note')
      .reduce((acc, s) => acc + s.subtotal, 0);

    const totalSalesReturns = sales
      .filter(s => s.docType === 'credit_note')
      .reduce((acc, s) => acc + s.subtotal, 0);

    const netSales = totalSales - totalSalesReturns;

    const purchasesToday = purchases
      .filter(p => p.date === todayStr && p.docType !== 'purchase_return')
      .reduce((acc, p) => acc + p.grandTotal, 0);

    const totalPurchases = purchases
      .filter(p => p.docType !== 'purchase_return')
      .reduce((acc, p) => acc + p.subtotal, 0);

    const totalPurchaseReturns = purchases
      .filter(p => p.docType === 'purchase_return')
      .reduce((acc, p) => acc + p.subtotal, 0);

    const expensesToday = expenses
      .filter(e => e.date === todayStr)
      .reduce((acc, e) => acc + e.amount, 0);

    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

    const receivables = customers.reduce((acc, c) => acc + (c.currentOutstanding || 0), 0);
    const payables = suppliers.reduce((acc, s) => acc + (s.currentOutstanding || 0), 0);

    const stockValue = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    const openingStockVal = products.reduce((acc, p) => acc + ((p.openingStock || 0) * p.costPrice), 0);
    const lowStockItemsCount = products.filter(p => (p.reorderLevel !== null && p.reorderLevel !== undefined && p.currentStock <= p.reorderLevel) || p.currentStock <= 0).length;
    const unpaidInvoicesCount = sales.filter(s => s.paymentStatus !== 'Paid').length;

    // Standard COGS = Opening Stock + Purchases - Purchase Returns - Closing Stock
    const cogs = Math.max(0, openingStockVal + totalPurchases - totalPurchaseReturns - stockValue);
    const grossProfit = Math.max(0, netSales - cogs);
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
      salesToday,
      salesGrowth: 0,
      purchasesToday,
      purchasesGrowth: 0,
      expensesToday,
      expensesGrowth: 0,
      grossProfit,
      netProfit,
      profitMargin: Number(profitMargin.toFixed(1)),
      receivables,
      payables,
      stockValue,
      lowStockItemsCount,
      unpaidInvoicesCount
    };
  },

  async getSalesByMonth(): Promise<{ month: string; sales: number; profit: number }[]> {
    const sales = await salesService.getSalesInvoices();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const result = months.map(m => ({ month: m, sales: 0, profit: 0 }));

    sales.forEach(sale => {
      if (sale.docType === 'credit_note') return;
      const d = new Date(sale.date);
      if (d.getFullYear() === currentYear) {
        const monthIdx = d.getMonth();
        if (result[monthIdx]) {
          result[monthIdx].sales += sale.grandTotal;
          result[monthIdx].profit += sale.subtotal - (sale.items?.reduce((c, i) => c + ((i.costPrice || 0) * i.qty), 0) || 0);
        }
      }
    });

    return result;
  },

  async getReceivablesAging(): Promise<{ range: string; amount: number; count: number }[]> {
    const sales = await salesService.getSalesInvoices();
    const unpaid = sales.filter(s => s.paymentStatus !== 'Paid' && s.docType !== 'credit_note');
    const now = new Date().getTime();

    const buckets = {
      current: { amount: 0, count: 0 },
      d30: { amount: 0, count: 0 },
      d60: { amount: 0, count: 0 },
      d90: { amount: 0, count: 0 }
    };

    unpaid.forEach(inv => {
      const invDate = new Date(inv.dueDate || inv.date).getTime();
      const diffDays = Math.floor((now - invDate) / (1000 * 60 * 60 * 24));
      const bal = inv.grandTotal - (inv.paidAmount || 0);
      if (bal <= 0) return;

      if (diffDays <= 30) {
        buckets.current.amount += bal;
        buckets.current.count += 1;
      } else if (diffDays <= 60) {
        buckets.d30.amount += bal;
        buckets.d30.count += 1;
      } else if (diffDays <= 90) {
        buckets.d60.amount += bal;
        buckets.d60.count += 1;
      } else {
        buckets.d90.amount += bal;
        buckets.d90.count += 1;
      }
    });

    return [
      { range: 'Current (0-30 days)', amount: buckets.current.amount, count: buckets.current.count },
      { range: '31-60 days', amount: buckets.d30.amount, count: buckets.d30.count },
      { range: '61-90 days', amount: buckets.d60.amount, count: buckets.d60.count },
      { range: '90+ days (Overdue)', amount: buckets.d90.amount, count: buckets.d90.count }
    ];
  },

  exportReportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Report') {
    exportToExcel(data, fileName, sheetName);
  },

  exportReportToCSV(data: Record<string, any>[], fileName: string) {
    exportToCSV(data, fileName);
  }
};
