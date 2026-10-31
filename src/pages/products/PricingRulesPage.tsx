import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DollarSign,
  Tag,
  Shield,
  Percent,
  Target,
  Lock,
  Plus
} from 'lucide-react';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { PricingPriceListsTab } from '../../components/pricing/PricingPriceListsTab';
import { PricingSalespersonRulesTab } from '../../components/pricing/PricingSalespersonRulesTab';
import { PricingCommissionTab } from '../../components/pricing/PricingCommissionTab';
import { PricingTargetsTab } from '../../components/pricing/PricingTargetsTab';
import { PricingApprovalsTab } from '../../components/pricing/PricingApprovalsTab';

export const PricingRulesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'pricelists');

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Part C: Pricing & Commission Tabs:
  // Price Lists · Salesperson Price Rules · Commission · Targets · Approvals
  const pricingTabs: TabItem[] = [
    { id: 'pricelists', label: 'Price Lists', icon: Tag },
    { id: 'rules', label: 'Salesperson Price Rules', icon: Shield },
    { id: 'commission', label: 'Commission', icon: Percent },
    { id: 'targets', label: 'Targets', icon: Target },
    { id: 'approvals', label: 'Approvals', badge: '3', icon: Lock }
  ];

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Pricing Architecture, Commissions & Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Commercial price lists, margin protection, salesperson discount rules, targets, and exception authorization queue.
          </p>
        </div>
      </div>

      {/* In-Page Horizontal Tabs */}
      <Tabs
        tabs={pricingTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Price Lists */}
      {activeTab === 'pricelists' && <PricingPriceListsTab />}

      {/* Tab 2: Salesperson Price Rules */}
      {activeTab === 'rules' && <PricingSalespersonRulesTab />}

      {/* Tab 3: Commission */}
      {activeTab === 'commission' && <PricingCommissionTab />}

      {/* Tab 4: Targets */}
      {activeTab === 'targets' && <PricingTargetsTab />}

      {/* Tab 5: Approvals Queue */}
      {activeTab === 'approvals' && <PricingApprovalsTab />}
    </div>
  );
};
