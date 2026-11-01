import React, { useState } from 'react';
import {
  Tag,
  Search,
  Plus,
  Percent,
  Layers,
  Download,
  CheckCircle,
  Building
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../common/DataTable';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Product } from '../../types';
import { exportToCSV, exportToExcel } from '../../utils/exportUtils';

export const PricingPriceListsTab: React.FC = () => {
  const { products = [] } = useERP();

  const handleExportCSV = () => {
    const data = products.map(p => ({
      'SKU': p.sku || '—',
      'Product': p.name,
      'Cost Price': p.purchasePrice,
      'Retail Price': p.salePrice ?? p.sellingPrice,
      'Wholesale Price': p.wholesalePrice || ((p.salePrice ?? p.sellingPrice) * 0.9),
      'Dealer Price': p.dealerPrice || ((p.salePrice ?? p.sellingPrice) * 0.8),
      'MRP': p.mrp || (p.salePrice ?? p.sellingPrice),
      'Min Floor Price': p.minSellingPrice || p.purchasePrice
    }));
    exportToCSV(data, 'Price_Lists_Matrix');
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: row => (
        <div>
          <span className="font-semibold text-slate-900 block truncate max-w-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">SKU: {row.sku || '—'}</span>
        </div>
      )
    },
    {
      key: 'purchasePrice',
      header: 'Cost Price',
      align: 'right',
      render: row => (
        <span className="font-mono text-slate-500 text-xs tabular-nums">{formatCurrency(row.purchasePrice)}</span>
      )
    },
    {
      key: 'salePrice',
      header: 'Retail (Counter)',
      align: 'right',
      render: row => (
        <span className="font-mono font-semibold text-slate-900 text-xs tabular-nums">{formatCurrency(row.salePrice ?? row.sellingPrice)}</span>
      )
    },
    {
      key: 'wholesalePrice',
      header: 'Wholesale Tier',
      align: 'right',
      render: row => {
        const val = row.wholesalePrice || (row.salePrice ?? row.sellingPrice) * 0.9;
        return (
          <span className="font-mono text-blue-700 text-xs font-medium tabular-nums">{formatCurrency(val)}</span>
        );
      }
    },
    {
      key: 'dealerPrice',
      header: 'Dealer Tier',
      align: 'right',
      render: row => {
        const val = row.dealerPrice || (row.salePrice ?? row.sellingPrice) * 0.8;
        return (
          <span className="font-mono text-purple-700 text-xs font-semibold tabular-nums">{formatCurrency(val)}</span>
        );
      }
    },
    {
      key: 'mrp',
      header: 'Statutory MRP',
      align: 'right',
      render: row => (
        <span className="font-mono text-rose-600 text-xs tabular-nums">{formatCurrency(row.mrp || (row.salePrice ?? row.sellingPrice))}</span>
      )
    },
    {
      key: 'minSellingPrice',
      header: 'Floor (Minimum)',
      align: 'right',
      render: row => {
        const floor = row.minSellingPrice || row.purchasePrice;
        return (
          <span className="font-mono font-bold text-amber-700 text-xs tabular-nums">{formatCurrency(floor)}</span>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-500 block">Retail (Standard)</span>
          <span className="text-sm font-bold text-slate-900">Walk-in Customer MRP</span>
          <span className="text-[10px] text-slate-400 block mt-1">Default counter pricing list</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-blue-600 block">Wholesale Tier</span>
          <span className="text-sm font-bold text-blue-700">~10% Bulk Discount</span>
          <span className="text-[10px] text-slate-400 block mt-1">Applied to bulk trade buyers</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-purple-600 block">Dealer Tier</span>
          <span className="text-sm font-bold text-purple-700">~20% Channel Rate</span>
          <span className="text-[10px] text-slate-400 block mt-1">Authorized dealer accounts</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[11px] text-amber-600 block">Floor Margin Guard</span>
          <span className="text-sm font-bold text-amber-700">Cost + 5% Minimum</span>
          <span className="text-[10px] text-slate-400 block mt-1">Blocks sales below floor price</span>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Commercial Price Lists Matrix"
        subtitle={`Total ${products.length} catalogued products across all commercial pricing tiers`}
        columns={columns}
        data={products}
        searchPlaceholder="Search product, SKU..."
        searchKeys={['name', 'sku', 'category']}
      />
    </div>
  );
};

