import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ArrowLeft } from 'lucide-react';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';

export const PurchaseHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchases')}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Back to Purchases & PO"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <span>Purchase History</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete historical log and delivery records of all vendor purchase orders.
            </p>
          </div>
        </div>
      </div>

      {/* Orders Table with Warehouse, Supplier filters and Search bar */}
      <PurchaseOrdersPage embedded={true} initialTabFilter="History" />
    </div>
  );
};

