import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Percent,
  Tag,
  Users,
  Package,
  Layers,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';

interface DiscountRule {
  id: string;
  name: string;
  type: string;
  target: string;
  criteria: string;
  discountValue: string;
  status: string;
}

export const PricingRulesPage: React.FC = () => {
  const { products, customers } = useERP();

  const [activeDiscountTab, setActiveDiscountTab] = useState('all');
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState('Quantity discount');
  const [targetScope, setTargetScope] = useState('');
  const [triggerCondition, setTriggerCondition] = useState('');
  const [discountValue, setDiscountValue] = useState('');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    setDiscountRules(prev => [
      ...prev,
      {
        id: 'd-' + Date.now(),
        name: ruleName,
        type: ruleType,
        target: targetScope || 'All items',
        criteria: triggerCondition || 'Standard condition',
        discountValue: discountValue || '5% Off',
        status: 'Active'
      }
    ]);

    setIsModalOpen(false);
    setRuleName('');
    setTargetScope('');
    setTriggerCondition('');
    setDiscountValue('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Pricing Architecture & Discount Strategies
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure multi-tier pricing (Retail, Wholesale, Dealer, MRP) and rule-based commercial discounts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Pricing Rule</span>
        </button>
      </div>

      {/* 7 Commercial Price Tiers Definition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Purchase Price', desc: 'Direct supplier procurement invoice cost', icon: Tag, color: 'text-slate-600 bg-slate-100' },
          { title: 'Cost Price (COGS)', desc: 'Purchase price + Freight + Inward overheads', icon: DollarSign, color: 'text-amber-700 bg-amber-50' },
          { title: 'Retail Price', desc: 'Standard walk-in customer counter pricing', icon: Package, color: 'text-blue-700 bg-blue-50' },
          { title: 'Wholesale Price', desc: 'Special bulk volume pricing for traders', icon: Layers, color: 'text-indigo-700 bg-indigo-50' },
          { title: 'Dealer Price', desc: 'Exclusive channel distributor discounted rates', icon: Users, color: 'text-purple-700 bg-purple-50' },
          { title: 'Special Customer Price', desc: 'Negotiated contract pricing linked to customer profile', icon: Users, color: 'text-cyan-700 bg-cyan-50' },
          { title: 'Maximum Retail Price (MRP)', desc: 'Statutory ceiling price printed on consumer package', icon: Tag, color: 'text-rose-700 bg-rose-50' },
          { title: 'Minimum Selling Price', desc: 'Strict system floor price to prevent selling below margin', icon: CheckCircle, color: 'text-emerald-700 bg-emerald-50' }
        ].map((tier, i) => {
          const Icon = tier.icon;
          return (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${tier.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <h3 className="font-bold text-xs text-slate-900">{tier.title}</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{tier.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Discount Rules Matrix */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Configured Discount Schemes & Tiers</h2>
            <p className="text-xs text-slate-500">
              Automated discount engine applying percentage or fixed deductions on billing
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {discountRules.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <span>No discount rules configured yet. Click "Add Pricing Rule" to create one.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Rule Name</th>
                  <th className="py-2.5 px-3">Discount Type</th>
                  <th className="py-2.5 px-3">Target Scope</th>
                  <th className="py-2.5 px-3">Trigger Condition</th>
                  <th className="py-2.5 px-3 text-right">Value</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discountRules.map(rule => (
                  <tr key={rule.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{rule.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {rule.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{rule.target}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{rule.criteria}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                      {rule.discountValue}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {rule.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Pricing Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Commercial Pricing Rule"
        subtitle="Configure target criteria and discount deductions"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRule}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Save Rule
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Rule Name</label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              placeholder="e.g. Bulk Cement Promotion"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Discount Type</label>
              <select
                value={ruleType}
                onChange={e => setRuleType(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
              >
                <option value="Quantity discount">Quantity discount</option>
                <option value="Customer discount">Customer discount</option>
                <option value="Category discount">Category discount</option>
                <option value="Invoice discount">Invoice discount</option>
                <option value="Product discount">Product discount</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Discount Value</label>
              <input
                type="text"
                required
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                placeholder="e.g. 5% Off or ₹50 Flat"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Scope</label>
            <input
              type="text"
              value={targetScope}
              onChange={e => setTargetScope(e.target.value)}
              placeholder="e.g. All Wholesale Clients or Cement SKUs"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trigger Condition</label>
            <input
              type="text"
              value={triggerCondition}
              onChange={e => setTriggerCondition(e.target.value)}
              placeholder="e.g. Order Qty >= 50 or Total >= ₹50,000"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
