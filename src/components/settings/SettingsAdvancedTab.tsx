import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Store,
  Layers,
  CheckCircle,
  AlertTriangle,
  Boxes,
  Lock,
  Volume2
} from 'lucide-react';

export const SettingsAdvancedTab: React.FC = () => {
  const [smallShopMode, setSmallShopMode] = useState(() => {
    return localStorage.getItem('universal_billing_small_shop_mode') === 'true';
  });

  const [multiWarehouse, setMultiWarehouse] = useState(() => {
    return localStorage.getItem('universal_billing_multi_warehouse') !== 'false';
  });

  const [batchTracking, setBatchTracking] = useState(() => {
    return localStorage.getItem('universal_billing_batch_tracking') !== 'false';
  });

  const [serialTracking, setSerialTracking] = useState(() => {
    return localStorage.getItem('universal_billing_serial_tracking') !== 'false';
  });

  const [allowNegativeStock, setAllowNegativeStock] = useState(() => {
    return localStorage.getItem('universal_billing_allow_negative_stock') === 'true';
  });

  const [scannerBeep, setScannerBeep] = useState(() => {
    return localStorage.getItem('universal_billing_scanner_beep') !== 'false';
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('universal_billing_small_shop_mode', smallShopMode ? 'true' : 'false');
    localStorage.setItem('universal_billing_multi_warehouse', multiWarehouse ? 'true' : 'false');
    localStorage.setItem('universal_billing_batch_tracking', batchTracking ? 'true' : 'false');
    localStorage.setItem('universal_billing_serial_tracking', serialTracking ? 'true' : 'false');
    localStorage.setItem('universal_billing_allow_negative_stock', allowNegativeStock ? 'true' : 'false');
    localStorage.setItem('universal_billing_scanner_beep', scannerBeep ? 'true' : 'false');

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-4 text-xs animate-fadeIn">
      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Advanced ERP operational rules saved!</span>
        </div>
      )}

      {/* Small Shop Mode Toggle */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 block">Small-Shop Mode</span>
              <p className="text-slate-500 mt-0.5 max-w-xl">
                When active, hides complex multi-warehouse transfers, batch expiry trackers, and manager approval queues to keep the app ultra-clean and distraction-free for single-cashier retail counters.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={smallShopMode}
              onChange={e => setSmallShopMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Universal Feature Flags</h3>

        <div className="divide-y divide-slate-100">
          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">Multi-Warehouse & Store Routing</span>
              <span className="text-[11px] text-slate-500">Enable stock transfers between multiple store branches and warehouses.</span>
            </div>
            <input
              type="checkbox"
              checked={multiWarehouse}
              onChange={e => setMultiWarehouse(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">Batch & Expiry FEFO Tracking (Pharma & Perishables)</span>
              <span className="text-[11px] text-slate-500">Enable lot numbers, expiry dates, and cut-strip blister tablet logic.</span>
            </div>
            <input
              type="checkbox"
              checked={batchTracking}
              onChange={e => setBatchTracking(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">Serial Number & IMEI Tracking (Electronics & Mobiles)</span>
              <span className="text-[11px] text-slate-500">Enforce unique individual serial tracking upon sale and return.</span>
            </div>
            <input
              type="checkbox"
              checked={serialTracking}
              onChange={e => setSerialTracking(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">Allow Negative Stock Billing</span>
              <span className="text-[11px] text-slate-500">Allow POS cashier to bill physical items even if system balance is 0.</span>
            </div>
            <input
              type="checkbox"
              checked={allowNegativeStock}
              onChange={e => setAllowNegativeStock(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 block">Scanner Audio Feedback</span>
              <span className="text-[11px] text-slate-500">Play confirmation tone on barcode scan.</span>
            </div>
            <input
              type="checkbox"
              checked={scannerBeep}
              onChange={e => setScannerBeep(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
        >
          Save Operational Configuration
        </button>
      </div>
    </div>
  );
};

