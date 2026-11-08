import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import {
  BookOpen,
  CreditCard,
  DollarSign,
  Calendar,
  Building,
  FileText
} from 'lucide-react';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { AccountsLedgersTab } from '../../components/accounts/AccountsLedgersTab';
import { AccountsPaymentsTab } from '../../components/accounts/AccountsPaymentsTab';
import { AccountsExpensesTab } from '../../components/accounts/AccountsExpensesTab';
import { AccountsDayBookTab } from '../../components/accounts/AccountsDayBookTab';
import { AccountsBankTab } from '../../components/accounts/AccountsBankTab';
import { AccountsTaxTab } from '../../components/accounts/AccountsTaxTab';

export const ChartOfAccountsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'ledgers');

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const { profile } = useAuth();
  const canViewPayments = hasPermission(profile?.role, 'payments', 'view');

  // If user lacks payments permission and tab is payments, reset to ledgers
  useEffect(() => {
    if (activeTab === 'payments' && !canViewPayments) {
      setActiveTab('ledgers');
    }
  }, [activeTab, canViewPayments]);

  // Part C: Accounts Tabs (Payments tab hidden for roles without payments permission):
  const accountsTabs: TabItem[] = [
    { id: 'ledgers', label: 'Ledgers', icon: BookOpen },
    ...(canViewPayments ? [{ id: 'payments', label: 'Payments', icon: CreditCard }] : []),
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'daybook', label: 'Day Book', icon: Calendar },
    { id: 'bank', label: 'Bank', icon: Building },
    { id: 'tax', label: 'Tax', icon: FileText }
  ];

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Financial Accounts & Ledgers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            General ledger, cashflow settlements, operational expenses, day book journal, bank accounts, and GST liability.
          </p>
        </div>
      </div>

      {/* In-Page Horizontal Tabs */}
      <Tabs
        tabs={accountsTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Ledgers */}
      {activeTab === 'ledgers' && <AccountsLedgersTab />}

      {/* Tab 2: Payments */}
      {activeTab === 'payments' && <AccountsPaymentsTab />}

      {/* Tab 3: Expenses */}
      {activeTab === 'expenses' && <AccountsExpensesTab />}

      {/* Tab 4: Day Book */}
      {activeTab === 'daybook' && <AccountsDayBookTab />}

      {/* Tab 5: Bank */}
      {activeTab === 'bank' && <AccountsBankTab />}

      {/* Tab 6: Tax */}
      {activeTab === 'tax' && <AccountsTaxTab />}
    </div>
  );
};
