import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  TrendingUp,
  FileText,
  Building,
  Users,
  Clock
} from 'lucide-react';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { ReportSalesTab } from '../../components/reports/ReportSalesTab';
import { ReportPurchasesTab } from '../../components/reports/ReportPurchasesTab';
import { ReportStockTab } from '../../components/reports/ReportStockTab';
import { ReportProfitTab } from '../../components/reports/ReportProfitTab';
import { ReportTaxTab } from '../../components/reports/ReportTaxTab';
import { ReportStatementsTab } from '../../components/reports/ReportStatementsTab';
import { ReportSalespersonTab } from '../../components/reports/ReportSalespersonTab';
import { ReportCashierShiftsTab } from '../../components/reports/ReportCashierShiftsTab';

export const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'sales');

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Part C: Reports Tabs:
  // Sales · Purchases · Stock · Profit · Tax · Statements · Salesperson · Cashier Shifts
  const reportTabs: TabItem[] = [
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'profit', label: 'Profit', icon: TrendingUp },
    { id: 'tax', label: 'Tax', icon: FileText },
    { id: 'statements', label: 'Statements', icon: Building },
    { id: 'salesperson', label: 'Salesperson', icon: Users },
    { id: 'shifts', label: 'Cashier Shifts', icon: Clock }
  ];

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Executive Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Turnover, procurement spend, inventory valuation, P&L profit, GSTR tax returns, statements, and cashier shift audits.
          </p>
        </div>
      </div>

      {/* In-Page Horizontal Tabs */}
      <Tabs
        tabs={reportTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Sales */}
      {activeTab === 'sales' && <ReportSalesTab />}

      {/* Tab 2: Purchases */}
      {activeTab === 'purchases' && <ReportPurchasesTab />}

      {/* Tab 3: Stock */}
      {activeTab === 'stock' && <ReportStockTab />}

      {/* Tab 4: Profit */}
      {activeTab === 'profit' && <ReportProfitTab />}

      {/* Tab 5: Tax */}
      {activeTab === 'tax' && <ReportTaxTab />}

      {/* Tab 6: Statements */}
      {activeTab === 'statements' && <ReportStatementsTab />}

      {/* Tab 7: Salesperson */}
      {activeTab === 'salesperson' && <ReportSalespersonTab />}

      {/* Tab 8: Cashier Shifts */}
      {activeTab === 'shifts' && <ReportCashierShiftsTab />}
    </div>
  );
};
