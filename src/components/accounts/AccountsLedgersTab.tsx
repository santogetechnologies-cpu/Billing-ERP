import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Download,
  Layers,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  ArrowLeftRight,
  CheckCircle2,
  Calendar,
  FileText
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Account, AccountCategory, JournalVoucher } from '../../types';
import { Modal } from '../common/Modal';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export const AccountsLedgersTab: React.FC = () => {
  const { accounts = [], addAccount, journalVouchers = [], createJournalVoucher } = useERP();

  const [activeSubTab, setActiveSubTab] = useState<'chart' | 'vouchers'>('chart');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Add Account Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<AccountCategory>('Assets');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newBalance, setNewBalance] = useState('');

  // Journal Voucher Modal
  const [isJvModalOpen, setIsJvModalOpen] = useState(false);
  const [jvDate, setJvDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [jvDebitAccountId, setJvDebitAccountId] = useState<string>('');
  const [jvCreditAccountId, setJvCreditAccountId] = useState<string>('');
  const [jvAmount, setJvAmount] = useState<string>('');
  const [jvReference, setJvReference] = useState<string>('');
  const [jvNarration, setJvNarration] = useState<string>('');

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

  const handlePostJournalVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(jvAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!jvDebitAccountId || !jvCreditAccountId) {
      alert('Please select both a Debit account and a Credit account.');
      return;
    }
    if (jvDebitAccountId === jvCreditAccountId) {
      alert('Debit and Credit accounts must be different for a valid double-entry.');
      return;
    }

    const debitAcc = accounts.find(a => a.id === jvDebitAccountId);
    const creditAcc = accounts.find(a => a.id === jvCreditAccountId);

    if (!debitAcc || !creditAcc) return;

    try {
      await createJournalVoucher({
        date: jvDate,
        narration: jvNarration.trim() || `JV Transfer from ${creditAcc.name} to ${debitAcc.name}`,
        createdBy: 'Admin',
        totalDebit: amt,
        totalCredit: amt,
        entries: [
          {
            accountId: debitAcc.id,
            accountName: debitAcc.name,
            type: 'Debit',
            amount: amt,
            particulars: `Dr: ${debitAcc.name}`
          },
          {
            accountId: creditAcc.id,
            accountName: creditAcc.name,
            type: 'Credit',
            amount: amt,
            particulars: `Cr: ${creditAcc.name}`
          }
        ]
      });

      setIsJvModalOpen(false);
      setJvAmount('');
      setJvNarration('');
      setJvReference('');
      alert(`Journal Voucher successfully posted! Ledgers updated.`);
    } catch (err: any) {
      alert(`Error posting voucher: ${err?.message}`);
    }
  };

  const handleExportCSV = () => {
    if (activeSubTab === 'chart') {
      const data = filteredAccounts.map(a => ({
        'Account Code': a.code,
        'Account Name': a.name,
        'Category': a.category,
        'Sub Category': a.subCategory,
        'Balance': a.balance,
        'Type': a.isDebit ? 'Debit (Dr)' : 'Credit (Cr)'
      }));
      exportToCSV(data, 'Chart_of_Accounts_Ledger');
    } else {
      const data = journalVouchers.map(jv => ({
        'Voucher #': jv.voucherNumber,
        'Date': jv.date,
        'Narration': jv.narration,
        'Debit Amount': jv.totalDebit,
        'Credit Amount': jv.totalCredit,
        'Created By': jv.createdBy
      }));
      exportToCSV(data, 'Journal_Vouchers_Register');
    }
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
          <span className="font-semibold text-slate-900 dark:text-white block truncate max-w-xs">{row.name}</span>
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
        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
          {formatCurrency(row.balance)} <span className="text-[10px] text-slate-400 font-normal">{row.isDebit ? 'Dr' : 'Cr'}</span>
        </span>
      )
    }
  ];

  const voucherColumns: Column<JournalVoucher>[] = [
    {
      key: 'voucherNumber',
      header: 'Voucher #',
      render: row => <span className="font-mono font-bold text-indigo-600 text-xs">{row.voucherNumber}</span>
    },
    {
      key: 'date',
      header: 'Date',
      render: row => <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{formatDate(row.date)}</span>
    },
    {
      key: 'narration',
      header: 'Narration & Double-Entry',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block truncate max-w-md">{row.narration}</span>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
            {row.entries.map((e, idx) => (
              <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {e.type === 'Debit' ? `Dr ${e.accountName}: ${formatCurrency(e.amount)}` : `Cr ${e.accountName}: ${formatCurrency(e.amount)}`}
              </span>
            ))}
          </div>
        </div>
      )
    },
    {
      key: 'totalDebit',
      header: 'Amount (Dr/Cr)',
      align: 'right',
      render: row => (
        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
          {formatCurrency(row.totalDebit)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: row => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Posted
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* 5 Balance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map(cat => (
          <div key={cat} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium block">{cat}</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white block mt-1 tabular-nums">
              {formatCurrency(totalsByCategory[cat] || 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Sub-view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('chart')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'chart'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chart of Accounts</span>
          </button>
          <button
            onClick={() => setActiveSubTab('vouchers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'vouchers'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Journal Vouchers (JV)</span>
            <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-[10px]">
              {journalVouchers.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          {activeSubTab === 'chart' ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          ) : (
            <button
              onClick={() => setIsJvModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Journal Voucher</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'chart' ? (
        <>
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
            {['All', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  selectedCategory === cat ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <DataTable
            title="Chart of Accounts Master"
            subtitle={`Total ${filteredAccounts.length} general ledger accounts`}
            columns={columns}
            data={filteredAccounts}
            searchPlaceholder="Search account name or code..."
            searchKeys={['name', 'code', 'category', 'subCategory']}
          />
        </>
      ) : (
        <DataTable
          title="General Journal Register (JV)"
          subtitle={`Total ${journalVouchers.length} double-entry manual journal vouchers posted`}
          columns={voucherColumns}
          data={journalVouchers}
          searchPlaceholder="Search voucher #, narration or account..."
          searchKeys={['voucherNumber', 'narration', 'createdBy']}
        />
      )}

      {/* MODAL: ADD ACCOUNT */}
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Code *</label>
                <input
                  type="text"
                  placeholder="e.g. 1010"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as AccountCategory)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Name *</label>
              <input
                type="text"
                placeholder="e.g. Office Supplies or ICICI Bank Current"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sub Category</label>
                <input
                  type="text"
                  placeholder="e.g. Current Assets"
                  value={newSubCategory}
                  onChange={e => setNewSubCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newBalance}
                  onChange={e => setNewBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: RECORD JOURNAL VOUCHER (JV) */}
      {isJvModalOpen && (
        <Modal
          isOpen={isJvModalOpen}
          onClose={() => setIsJvModalOpen(false)}
          title="Post Double-Entry Journal Voucher (JV)"
          subtitle="Record manual ledger transfers, depreciation, accruals, or adjustments"
          size="lg"
        >
          <form onSubmit={handlePostJournalVoucher} className="space-y-4 pt-2 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Standard Double-Entry Rule: <strong>Debit Account</strong> will increase Dr (or decrease Cr), and <strong>Credit Account</strong> will increase Cr (or decrease Dr) by the same amount.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Voucher Date *</label>
                <input
                  type="date"
                  value={jvDate}
                  onChange={e => setJvDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference # / Bill Ref</label>
                <input
                  type="text"
                  placeholder="e.g. ADJ-2026/01 or INV-4412"
                  value={jvReference}
                  onChange={e => setJvReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block font-bold text-blue-700 dark:text-blue-400 mb-1">Debit Account (Dr) *</label>
                <select
                  value={jvDebitAccountId}
                  onChange={e => setJvDebitAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">-- Select Account to Debit --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.category}) [Bal: {formatCurrency(acc.balance)}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-rose-700 dark:text-rose-400 mb-1">Credit Account (Cr) *</label>
                <select
                  value={jvCreditAccountId}
                  onChange={e => setJvCreditAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">-- Select Account to Credit --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.category}) [Bal: {formatCurrency(acc.balance)}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Voucher Amount (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={jvAmount}
                onChange={e => setJvAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold tabular-nums"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Narration / Description *</label>
              <textarea
                rows={2}
                placeholder="Detailed reason for this double-entry journal voucher..."
                value={jvNarration}
                onChange={e => setJvNarration(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsJvModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Post Journal Voucher</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
