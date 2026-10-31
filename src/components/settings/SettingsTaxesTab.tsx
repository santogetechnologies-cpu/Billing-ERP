import React, { useState } from 'react';
import {
  Receipt,
  Percent,
  Plus,
  CheckCircle,
  Save,
  HelpCircle
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';

interface TaxSlabItem {
  id: string;
  name: string;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  isDefault: boolean;
}

export const SettingsTaxesTab: React.FC = () => {
  const [slabs, setSlabs] = useState<TaxSlabItem[]>([
    { id: 't0', name: 'Exempt / Zero Rated (0%)', rate: 0, cgst: 0, sgst: 0, igst: 0, isDefault: false },
    { id: 't5', name: 'GST 5% (Essential Goods)', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5, isDefault: false },
    { id: 't12', name: 'GST 12% (Standard Consumables)', rate: 12, cgst: 6, sgst: 6, igst: 12, isDefault: false },
    { id: 't18', name: 'GST 18% (Standard Retail / Electronics)', rate: 18, cgst: 9, sgst: 9, igst: 18, isDefault: true },
    { id: 't28', name: 'GST 28% (Luxury / Automobiles)', rate: 28, cgst: 14, sgst: 14, igst: 28, isDefault: false }
  ]);

  const [compositionScheme, setCompositionScheme] = useState(false);
  const [taxInclusivePricing, setTaxInclusivePricing] = useState(true);

  const columns: Column<TaxSlabItem>[] = [
    {
      key: 'name',
      header: 'Tax Rate Name',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.name}</span>
          {row.isDefault && (
            <span className="text-[10px] text-blue-600 font-bold">Default for new items</span>
          )}
        </div>
      )
    },
    {
      key: 'rate',
      header: 'Total GST (%)',
      align: 'center',
      render: row => <span className="font-mono font-bold text-slate-900 text-xs">{row.rate}%</span>
    },
    {
      key: 'cgst',
      header: 'CGST',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs">{row.cgst}%</span>
    },
    {
      key: 'sgst',
      header: 'SGST',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs">{row.sgst}%</span>
    },
    {
      key: 'igst',
      header: 'IGST',
      align: 'right',
      render: row => <span className="font-mono text-slate-600 text-xs">{row.igst}%</span>
    }
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Toggles */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Tax System Configuration</h3>
        <div className="space-y-2">
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">All Product Selling Prices are Tax Inclusive (MRP)</span>
              <span className="text-[11px] text-slate-500">Retail counter displays final gross amount including GST.</span>
            </div>
            <input
              type="checkbox"
              checked={taxInclusivePricing}
              onChange={e => setTaxInclusivePricing(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer border-t border-slate-100">
            <div>
              <span className="font-semibold text-slate-900 block">GST Composition Dealer Scheme (1%)</span>
              <span className="text-[11px] text-slate-500">Disables B2B Input Tax Credit and issues simplified Bill of Supply.</span>
            </div>
            <input
              type="checkbox"
              checked={compositionScheme}
              onChange={e => setCompositionScheme(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
        </div>
      </div>

      <DataTable
        title="Standard Indian GST Slabs"
        subtitle="Automatic CGST/SGST intrastate split and IGST interstate routing"
        columns={columns}
        data={slabs}
        searchPlaceholder="Search tax rate..."
        searchKeys={['name']}
      />
    </div>
  );
};

