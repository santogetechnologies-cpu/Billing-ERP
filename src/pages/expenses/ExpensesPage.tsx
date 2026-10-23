import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  Building
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Expense, ExpenseCategory } from '../../types';
import { Modal } from '../../components/common/Modal';

export const ExpensesPage: React.FC = () => {
  const { expenses, addExpense, deleteExpense } = useERP();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New expense form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('Rent');
  const [amount, setAmount] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [vendor, setVendor] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('Cash');
  const [costCentre, setCostCentre] = useState('Operations');
  const [description, setDescription] = useState('');

  const categories: ExpenseCategory[] = [
    'Rent',
    'Electricity',
    'Internet',
    'Telephone',
    'Salary',
    'Transport',
    'Fuel',
    'Maintenance',
    'Marketing',
    'Advertising',
    'Office Supplies',
    'Travel',
    'Food',
    'Bank Charges',
    'Insurance',
    'Professional Fees',
    'Other'
  ];

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addExpense({
        date,
        category,
        amount: numAmount,
        tax: Number(tax) || 0,
        vendor: vendor.trim() || 'Direct Vendor',
        paymentAccount,
        costCentre,
        description: description.trim()
      });

      setIsAddModalOpen(false);
      setAmount('');
      setTax('');
      setVendor('');
      setDescription('');
    } catch (err: any) {
      alert(`Error recording expense: ${err?.message || 'Failed to save expense'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Expense Date',
      render: row => formatDate(row.date)
    },
    {
      key: 'category',
      header: 'Category',
      render: row => (
        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
          {row.category}
        </span>
      )
    },
    {
      key: 'vendor',
      header: 'Vendor / Beneficiary',
      render: row => <span className="text-slate-800 font-medium">{row.vendor}</span>
    },
    {
      key: 'paymentAccount',
      header: 'Paid From',
      render: row => <span className="text-slate-600 text-[11px]">{row.paymentAccount}</span>
    },
    {
      key: 'costCentre',
      header: 'Cost Centre',
      render: row => (
        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {row.costCentre}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount (₹)',
      align: 'right',
      render: row => (
        <span className="font-bold text-slate-900">{formatCurrency(row.amount)}</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            Operating Expenses & Overhead Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track warehouse rent, utilities, salaries, transportation, marketing and administrative outflows.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Summary Analytics Banner */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Indirect Expenses Recorded
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-0.5">
            {formatCurrency(totalExpenseAmount)}
          </span>
          <span className="text-xs text-slate-500">
            Deducted from gross profit in Profit & Loss statement
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {categories.slice(0, 5).map(cat => {
            const sum = expenses.filter(e => e.category === cat).reduce((acc, e) => acc + e.amount, 0);
            return (
              <div key={cat} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center min-w-[100px]">
                <span className="text-[10px] text-slate-400 font-semibold block">{cat}</span>
                <span className="font-bold text-slate-800 text-xs">{formatCurrency(sum)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <DataTable
        title="Expense Voucher Register"
        subtitle={`Total ${expenses.length} operating vouchers`}
        columns={columns}
        data={expenses}
        searchPlaceholder="Search expense by category, vendor, description..."
        searchKeys={['category', 'vendor', 'paymentAccount', 'description']}
        filters={[
          {
            key: 'category',
            label: 'Category',
            options: categories.map(c => ({ label: c, value: c }))
          }
        ]}
        actions={row => (
          <button
            onClick={async () => {
              if (window.confirm('Delete this expense entry?')) {
                try {
                  await deleteExpense(row.id);
                } catch (err: any) {
                  alert(`Failed to delete expense: ${err?.message || 'Error occurred'}`);
                }
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      />

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="Record Operating Expense Voucher"
        subtitle="Log operational overheads, vendor disbursements and cost center allocations"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              disabled={isSubmitting}
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || Number(amount) <= 0}
              onClick={handleAddExpenseSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Record Voucher</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expense Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={amount}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setAmount(''); return; }
                if (raw.includes('-')) return;
                setAmount(raw.replace(/^0+(?=\d)/, ''));
              }}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Vendor / Payee</label>
            <input
              type="text"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              placeholder="e.g. MSEDCL, Tata Tele, Star Stationers"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Account</label>
              <select
                value={paymentAccount}
                onChange={e => setPaymentAccount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              >
                <option value="HDFC Corporate Current A/C">HDFC Corporate Bank A/C</option>
                <option value="Main Cash Drawer">Main Cash Drawer</option>
                <option value="Petty Cash">Petty Cash Float</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Cost Centre</label>
              <input
                type="text"
                value={costCentre}
                onChange={e => setCostCentre(e.target.value)}
                placeholder="Logistics, Admin, Sales"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Voucher details..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
