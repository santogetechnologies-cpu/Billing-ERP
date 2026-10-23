import React from 'react';
import { StockStatusType } from '../../types';
import { calculateStockStatus } from '../../utils/inventoryUtils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const normalized = (status || '').toLowerCase().trim();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['active', 'in stock'].includes(normalized)) {
    colorClasses = 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
  } else if (['limited', 'limited stock', 'warning', 'low stock'].includes(normalized)) {
    colorClasses = 'bg-[#FFF7ED] text-[#EA580C] border-[#FDBA74]';
  } else if (['out of stock'].includes(normalized)) {
    colorClasses = 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]';
  } else if (['not set', 'alert not set'].includes(normalized)) {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (['paid', 'approved', 'received'].includes(normalized)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['partially paid', 'sent', 'expiring soon', 'requested'].includes(normalized)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['unpaid', 'overdue', 'expired', 'blocked'].includes(normalized)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['draft'].includes(normalized)) {
    colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (['wholesale', 'corporate', 'tax_invoice'].includes(normalized)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['dealer', 'distributor'].includes(normalized)) {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-tight' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center align-middle font-medium rounded-full border ${colorClasses} ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 bg-current" />
      <span className="whitespace-nowrap">{normalized === 'limited stock' ? 'Limited' : status}</span>
    </span>
  );
};

export interface StockStatusBadgeProps {
  currentStock?: number | null;
  reorderLevel?: number | null;
  status?: StockStatusType;
  size?: 'sm' | 'md';
  className?: string;
}

export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({
  currentStock,
  reorderLevel,
  status: explicitStatus,
  size = 'sm',
  className = ''
}) => {
  const status = explicitStatus || calculateStockStatus(currentStock, reorderLevel);
  return <StatusBadge status={status} size={size} className={className} />;
};
