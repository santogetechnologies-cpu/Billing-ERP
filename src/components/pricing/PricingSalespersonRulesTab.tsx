import React, { useState } from 'react';
import {
  Users,
  Shield,
  Percent,
  CheckCircle,
  AlertTriangle,
  Lock,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { Modal } from '../common/Modal';

interface SalespersonRule {
  id: string;
  salespersonName: string;
  maxDiscountPercent: number;
  allowFloorOverride: boolean;
  maxReturnAmount: number;
  requiresPinApproval: boolean;
}

export const PricingSalespersonRulesTab: React.FC = () => {
  const { users = [] } = useERP();

  const salespersons = users.filter(u => u.role === 'Salesperson');

  const [rules, setRules] = useState<SalespersonRule[]>([
    {
      id: 'r1',
      salespersonName: 'Default Role Policy (All Salespersons)',
      maxDiscountPercent: 5,
      allowFloorOverride: false,
      maxReturnAmount: 1000,
      requiresPinApproval: true
    },
    ...salespersons.map((s, idx) => ({
      id: s.id,
      salespersonName: s.fullName || s.email,
      maxDiscountPercent: idx === 0 ? 8 : 5,
      allowFloorOverride: false,
      maxReturnAmount: 2000,
      requiresPinApproval: true
    }))
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<SalespersonRule | null>(null);
  const [maxDiscount, setMaxDiscount] = useState('5');
  const [maxReturn, setMaxReturn] = useState('1000');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    setRules(prev => prev.map(r => r.id === selectedRule.id ? {
      ...r,
      maxDiscountPercent: Number(maxDiscount) || 5,
      maxReturnAmount: Number(maxReturn) || 1000
    } : r));

    setIsModalOpen(false);
  };

  const columns: Column<SalespersonRule>[] = [
    {
      key: 'salespersonName',
      header: 'Salesperson / Role Rule',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.salespersonName}</span>
          <span className="text-[10px] text-slate-400">Strict POS authorization policy</span>
        </div>
      )
    },
    {
      key: 'maxDiscountPercent',
      header: 'Max Allowed Discount',
      align: 'center',
      render: row => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          ≤ {row.maxDiscountPercent}%
        </span>
      )
    },
    {
      key: 'allowFloorOverride',
      header: 'Sell Below Floor Price',
      align: 'center',
      render: row => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.allowFloorOverride ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {row.allowFloorOverride ? 'Allowed' : 'Blocked (Strict)'}
        </span>
      )
    },
    {
      key: 'maxReturnAmount',
      header: 'Max Return Without Approval',
      align: 'right',
      render: row => (
        <span className="font-mono font-semibold text-slate-800 text-xs tabular-nums">
          ₹{row.maxReturnAmount.toLocaleString()}
        </span>
      )
    },
    {
      key: 'requiresPinApproval',
      header: 'Manager PIN Enforcement',
      align: 'center',
      render: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <Lock className="w-3.5 h-3.5" />
          <span>Active</span>
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Information Box */}
      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900">
          <span className="font-bold block">Margin Protection & Delegation of Authority:</span>
          Salespersons can grant discounts up to their assigned ceiling. Any transaction with a discount exceeding their ceiling or priced below minimum floor price triggers a manager authorization request.
        </div>
      </div>

      <DataTable
        title="Salesperson Commercial Rules"
        subtitle="Control discount permissions, return thresholds, and manager escalation triggers"
        columns={columns}
        data={rules}
        searchPlaceholder="Search salesperson..."
        searchKeys={['salespersonName']}
        actions={row => (
          <button
            onClick={() => {
              setSelectedRule(row);
              setMaxDiscount(String(row.maxDiscountPercent));
              setMaxReturn(String(row.maxReturnAmount));
              setIsModalOpen(true);
            }}
            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
          >
            Edit Limits
          </button>
        )}
      />

      {isModalOpen && selectedRule && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Edit Limits: ${selectedRule.salespersonName}`}
          subtitle="Configure discount ceiling and threshold limits"
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Allowed Discount Percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={maxDiscount}
                onChange={e => setMaxDiscount(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg tabular-nums font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Authorization Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={maxReturn}
                onChange={e => setMaxReturn(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg tabular-nums font-semibold"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Policy
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

