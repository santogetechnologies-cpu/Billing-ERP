import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Building,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Account, AccountCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';

export const ChartOfAccountsPage: React.FC = () => {
  const { accounts, addAccount } = useERP();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New account form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<AccountCategory>('Assets');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newIsDebit, setNewIsDebit] = useState(true);

  const categories: AccountCategory[] = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];

  // Summary calculations
  const totalsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = accounts
      .filter(a => a.category === cat)
      .reduce((sum, a) => sum + a.balance, 0);
    return acc;
  }, {} as Record<AccountCategory, number>);

  const filteredAccounts = accounts.filter(a => {
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.includes(searchTerm) ||
      a.subCategory.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newSubCategory) return;

    addAccount({
      code: newCode,
      name: newName,
      category: newCategory,
      subCategory: newSubCategory,
      balance: parseFloat(newBalance) || 0,
      isDebit: newIsDebit
    });

    setIsAddModalOpen(false);
    setNewCode('');
    setNewName('');
    setNewSubCategory('');
    setNewBalance('');
  };

  const getCategoryBadgeClass = (cat: AccountCategory) => {
    switch (cat) {
      case 'Assets':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Liabilities':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Equity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Income':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Expenses':
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Chart of Accounts (COA)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            General ledger master accounts organized by standard Indian accounting taxonomy: Assets, Liabilities, Equity, Income & Expenses.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Account</span>
        </button>
      </div>

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categories.map(cat => (
          <div
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? 'All' : cat)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedCategory === cat
                ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {cat}
              </span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {accounts.filter(a => a.category === cat).length} A/Cs
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 mt-1">
              {formatCurrency(totalsByCategory[cat])}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {cat === 'Assets' || cat === 'Expenses' ? 'Normal Dr Balance' : 'Normal Cr Balance'}
            </span>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === 'All'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories ({accounts.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, account, group..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Account Code</th>
                <th className="py-3 px-4">Account Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Subcategory / Group</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Current Ledger Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No accounts found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {acc.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {acc.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadgeClass(acc.category)}`}>
                        {acc.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {acc.subCategory}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        acc.isDebit ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {acc.isDebit ? 'Debit (Dr)' : 'Credit (Cr)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(acc.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add General Ledger Account"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1080, 2050"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={newCategory}
                onChange={e => {
                  const cat = e.target.value as AccountCategory;
                  setNewCategory(cat);
                  setNewIsDebit(cat === 'Assets' || cat === 'Expenses');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ICICI Corporate Current Account"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subcategory / Group <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bank Accounts, Direct Expenses, Fixed Assets"
              value={newSubCategory}
              onChange={e => setNewSubCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={newBalance}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setNewBalance(''); return; }
                  if (raw.includes('-')) return;
                  setNewBalance(raw.replace(/^0+(?=\d)/, ''));
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Normal Balance
              </label>
              <select
                value={newIsDebit ? 'Dr' : 'Cr'}
                onChange={e => setNewIsDebit(e.target.value === 'Dr')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Dr">Debit (Dr)</option>
                <option value="Cr">Credit (Cr)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
