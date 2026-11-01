import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  Truck,
  ClipboardCheck,
  Layers,
  Plus,
  ShieldCheck,
  Building,
  Scale
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { Product, Batch } from '../../types';
import { StockCurrentTab } from '../../components/stock/StockCurrentTab';
import { StockLowTab } from '../../components/stock/StockLowTab';
import { StockExpiringTab } from '../../components/stock/StockExpiringTab';
import { StockMovementsTab } from '../../components/stock/StockMovementsTab';
import { StockTransfersTab } from '../../components/stock/StockTransfersTab';
import { StockCountsTab } from '../../components/stock/StockCountsTab';
import { StockAdjustmentsTab } from '../../components/stock/StockAdjustmentsTab';
import { StockRepackagingTab } from '../../components/stock/StockRepackagingTab';
import { StockAdjustmentModal } from '../../components/stock/StockAdjustmentModal';
import { SalespersonInventoryPage } from './SalespersonInventoryPage';
import { calculateStockStatus } from '../../utils/inventoryUtils';

const InventoryDashboardInner: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products = [], batches = [], inventoryTransactions = [], stockTransfers = [], repackagingRuns = [] } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'current');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Sync ?tab= in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Aggregate Tab Badge Counts
  const lowStockCount = useMemo(() => {
    return products.filter(p => {
      const status = calculateStockStatus(p.currentStock, p.minStockLevel || 10);
      return status === 'low_stock' || status === 'out_of_stock';
    }).length;
  }, [products]);

  const expiringBatchesCount = useMemo(() => {
    const today = new Date().getTime();
    return batches.filter(b => {
      const exp = new Date(b.expiryDate).getTime();
      const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      return days <= 30;
    }).length;
  }, [batches]);

  const stockAdjustmentCount = useMemo(() => {
    return inventoryTransactions.filter(tx => tx.type === 'Stock Adjustment').length;
  }, [inventoryTransactions]);

  // In-Page Horizontal Tabs per Part C:
  // Stock: Current · Low · Expiring · Movements · Transfers · Counts · Adjustments
  const stockTabs: TabItem[] = [
    { id: 'current', label: 'Current', count: products.length, icon: Boxes },
    { id: 'low', label: 'Low', count: lowStockCount, icon: AlertTriangle },
    { id: 'expiring', label: 'Expiring', count: expiringBatchesCount, icon: Clock },
    { id: 'movements', label: 'Movements', count: inventoryTransactions.length, icon: ArrowRightLeft },
    { id: 'transfers', label: 'Transfers', count: stockTransfers.length, icon: Truck },
    { id: 'counts', label: 'Counts', icon: ClipboardCheck },
    { id: 'adjustments', label: 'Adjustments', count: stockAdjustmentCount, icon: Layers },
    { id: 'repackaging', label: 'Repackaging & Conversion', count: repackagingRuns.length, icon: Scale }
  ];

  return (
    <div className="space-y-4">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Stock & Inventory Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock ledger, multi-warehouse valuation, FEFO batches, transfers, and count audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdjustModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* Part C: Horizontal Tabs Component */}
      <Tabs
        tabs={stockTabs}
        activeTab={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          setSearchParams({ tab });
        }}
      />

      {/* Tab 1: Current Stock */}
      {activeTab === 'current' && (
        <StockCurrentTab onAdjustProduct={() => setIsAdjustModalOpen(true)} />
      )}

      {/* Tab 2: Low Stock Alerts */}
      {activeTab === 'low' && (
        <StockLowTab onCreatePO={() => navigate('/purchases?tab=orders')} />
      )}

      {/* Tab 3: Expiring Batches */}
      {activeTab === 'expiring' && (
        <StockExpiringTab onWriteOffBatch={() => setIsAdjustModalOpen(true)} />
      )}

      {/* Tab 4: Movements Audit Ledger */}
      {activeTab === 'movements' && <StockMovementsTab />}

      {/* Tab 5: Inter-Warehouse Transfers */}
      {activeTab === 'transfers' && <StockTransfersTab />}

      {/* Tab 6: Physical Counts & Audit */}
      {activeTab === 'counts' && <StockCountsTab />}

      {/* Tab 7: Adjustments & Loss Write-Off */}
      {activeTab === 'adjustments' && <StockAdjustmentsTab />}

      {/* Tab 8: Bulk-to-Retail Repackaging & Conversion */}
      {activeTab === 'repackaging' && <StockRepackagingTab />}

      {/* Universal 5-Step Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
      />
    </div>
  );
};

export const InventoryDashboardPage: React.FC = () => {
  const { profile } = useAuth();

  // Strict Least-Privilege Scoping: Salespersons are served a dedicated view-only directory
  if (profile?.role === 'Salesperson') {
    return <SalespersonInventoryPage />;
  }

  return <InventoryDashboardInner />;
};
