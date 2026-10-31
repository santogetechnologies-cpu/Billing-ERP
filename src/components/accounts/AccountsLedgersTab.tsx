import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Download,
  Layers,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { Account, AccountCategory } from '../../types';
import { Modal } from '../common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const AccountsLedgersTab: React.FC = () => {
  const { accounts = [], addAccount } = useERP();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<AccountCategory>('Assets');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newBalance, setNewBalance] = useState('');

  const categories: AccountCategory[] = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];

  const filteredAccounts = accounts.filter(a => {
    if (selectedCategory !== 'All' && a.category !== selectedCategory) return false;
    return true;
  });

  const totalsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = accounts
      .filter(a => a.category === cat)
      .reduce((sum, a) => sum + (a.balance || 0), 0);
    return acc;
  }, {} as Record<AccountCategory, number>);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    addAccount({
      code: newCode.trim(),
      name: newName.trim(),
      category: newCategory,
      subCategory: newSubCategory.trim() || 'General',
      balance: parseFloat(newBalance) || 0,
      isDebit: newCategory === 'Assets' || newCategory === 'Expenses'
    });
    setIsModalOpen(false);
    setNewCode('');
    setNewName('');
    setNewSubCategory('');
    setNewBalance('');
  };

  const handleExportCSV = () => {
    const data = filteredAccounts.map(a => ({
      'Account Code': a.code,
      'Account Name': a.name,
      'Category': a.category,
      'Sub Category': a.subCategory,
      'Balance': a.balance,
      'Type': a.isDebit ? 'Debit (Dr)' : 'Credit (Cr)'
    }));
    exportToCSV(data, 'Chart_of_Accounts_Ledger');
  };

  const columns: Column<Account>[] = [
    {
      key: 'code',
      header: 'Code',
      render: row => <span className="font-mono font-bold text-blue-600 text-xs">{row.code}</span>
    },
    {
      key: 'name',
      header: 'Account Name',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400">{row.subCategory}</span>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: row => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
          row.category === 'Assets' ? 'bg-blue-50 text-blue-700' :
          row.category === 'Liabilities' ? 'bg-rose-50 text-rose-700' :
          row.category === 'Income' ? 'bg-emerald-50 text-emerald-700' :
          row.category === 'Expenses' ? 'bg-amber-50 text-amber-700' :
          'bg-purple-50 text-purple-700'
        }`}>
          {row.category}
        </span>
      )
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {formatCurrency(row.balance)} <span className="text-[10px] text-slate-400 font-normal">{row.isDebit ? 'Dr' : 'Cr'}</span>
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* 5 Balance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map(cat => (
          <div key={cat} className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium block">{cat}</span>
            <span className="text-sm font-bold text-slate-900 block mt-1 tabular-nums">
              {formatCurrency(totalsByCategory[cat] || 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', ...categories].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedCategory === cat ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      <DataTable
        title="Chart of Accounts Master"
        subtitle={`Total ${filteredAccounts.length} general ledger accounts`}
        columns={columns}
        data={filteredAccounts}
        searchPlaceholder="Search account name or code..."
        searchKeys={['name', 'code', 'category', 'subCategory']}
      />

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add General Ledger Account"
          subtitle="Define a new account in the financial chart of accounts"
          size="md"
        >
          <form onSubmit={handleCreate} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Code *</label>
                <input
                  type="text"
                  placeholder="e.g. 1010"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as AccountCategory)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Name *</label>
              <input
                type="text"
                placeholder="e.g. Office Supplies or ICICI Bank Current"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sub Category</label>
                <input
                  type="text"
                  placeholder="e.g. Current Assets"
                  value={newSubCategory}
                  onChange={e => setNewSubCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newBalance}
                  onChange={e => setNewBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
              >
                Create Account
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

