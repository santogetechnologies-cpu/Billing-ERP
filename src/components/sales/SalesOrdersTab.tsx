import React, { useState } from 'react';
import { ShoppingCart, ArrowRight, Check, Search, Truck, Clock } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { SalesInvoice } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface SalesOrdersTabProps {
  onNewOrder: () => void;
}

export const SalesOrdersTab: React.FC<SalesOrdersTabProps> = ({ onNewOrder }) => {
  const { salesInvoices, createSalesInvoice } = useERP();
  const [search, setSearch] = useState('');
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  const orders = salesInvoices.filter(inv => inv.docType === 'sales_order');

  const filtered = orders.filter(o => {
    const s = search.toLowerCase();
    return o.invoiceNumber.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s);
  });

  const handleGenerateInvoice = async (order: SalesInvoice) => {
    setInvoicingId(order.id);
    try {
      const invoicePayload: Omit<SalesInvoice, 'id' | 'createdAt'> = {
        ...order,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        docType: 'tax_invoice',
        date: new Date().toISOString().split('T')[0],
        paymentStatus: 'Unpaid'
      };
      await createSalesInvoice(invoicePayload);
      alert(`Sales Order ${order.invoiceNumber} successfully billed as Tax Invoice!`);
    } catch (err: any) {
      alert(`Error billing order: ${err?.message}`);
    } finally {
      setInvoicingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders by order # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={onNewOrder}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>New Sales Order</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Dispatch Warehouse</th>
                <th className="px-4 py-3 text-right">Order Value</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No active sales orders found. Click "+ New Sales Order" to place orders.
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {o.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {o.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {formatDate(o.date)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.warehouseId || 'Main Warehouse'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(o.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={invoicingId === o.id}
                        onClick={() => handleGenerateInvoice(o)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Fulfill & Generate Invoice</span>
                      </button>
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

