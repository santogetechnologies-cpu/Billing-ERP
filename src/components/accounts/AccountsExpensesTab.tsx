import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Building,
  Tag
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Expense, ExpenseCategory } from '../../types';
import { Modal } from '../common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const AccountsExpensesTab: React.FC = () => {
  const { expenses = [], addExpense } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // New expense form state
  const [category, setCategory] = useState<ExpenseCategory>('Rent');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentAccount, setPaymentAccount] = useState('Primary Bank Account');
  const [description, setDescription] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: ExpenseCategory[] = [
    'Rent',
    'Electricity',
    'Internet',
    'Telephone',
    'Salary',
    'Transport',
    'Office Supplies',
    'Maintenance',
    'Marketing',
    'Insurance',
    'Taxes',
    'Professional Fees',
    'Bank Charges',
    'Depreciation',
    'Miscellaneous'
  ];

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedCategory]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    try {
      setIsSubmitting(true);
      await addExpense({
        category,
        amount: numAmount,
        date: expenseDate,
        paymentAccount,
        description: description.trim(),
        costCentre: 'General Operations',
        referenceNo: referenceNo.trim() || undefined
      });
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
      setReferenceNo('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const data = filteredExpenses.map(e => ({
      'Expense #': e.expenseNumber,
      'Date': e.date,
      'Category': e.category,
      'Amount': e.amount,
      'Account': e.paymentAccount,
      'Description': e.description,
      'Ref #': e.referenceNo || '—'
    }));
    exportToCSV(data, 'Operational_Expenses_Ledger');
  };

  const columns: Column<Expense>[] = [
    {
      key: 'expenseNumber',
      header: 'Expense #',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.expenseNumber}</span>
    },
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-xs text-slate-700">{formatDate(row.date)}</span>
    },
    {
      key: 'category',
      header: 'Expense Category',
      render: row => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          {row.category}
        </span>
      )
    },
    {
      key: 'description',
      header: 'Description / Purpose',
      render: row => <span className="text-xs text-slate-800 font-medium block truncate max-w-xs">{row.description}</span>
    },
    {
      key: 'paymentAccount',
      header: 'Paid From',
      render: row => <span className="text-xs text-slate-600">{row.paymentAccount}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatCurrency(row.amount)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Operational Expenses</span>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(totalExpenseAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{expenses.length} voucher records posted</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Cost Centers Active</span>
          <div className="text-xl font-bold text-blue-600 mt-1 tabular-nums">
            {new Set(expenses.map(e => e.category)).size} Categories
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Grouped business overheads</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Record Overhead</span>
            <p className="text-xs text-slate-600 mt-1">Add rent, salaries, utilities, transport...</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="ALL">All Expense Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table */}
      <DataTable
        title="Expense Voucher Register"
        subtitle={`Total ${filteredExpenses.length} expense items`}
        columns={columns}
        data={filteredExpenses}
        searchPlaceholder="Search expense #, description, account..."
        searchKeys={['expenseNumber', 'description', 'category', 'paymentAccount']}
      />

      {/* New Expense Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Record Operating Expense"
          subtitle="Post an overhead expense voucher to the general ledger"
          size="md"
        >
          <form onSubmit={handleCreateExpense} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paid From Account</label>
                <input
                  type="text"
                  placeholder="e.g. Petty Cash or Bank"
                  value={paymentAccount}
                  onChange={e => setPaymentAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description / Bill Purpose *</label>
              <input
                type="text"
                placeholder="e.g. October shop electricity bill or generator fuel"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Voucher / Receipt Reference #</label>
              <input
                type="text"
                placeholder="e.g. EB-98124 or Receipt #412"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
              >
                {isSubmitting ? 'Posting...' : 'Post Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

