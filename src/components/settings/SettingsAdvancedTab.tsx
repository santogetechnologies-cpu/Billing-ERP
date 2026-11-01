import React, { useState } from 'react';
import {
  Store,
  CheckCircle,
  Building2,
  Truck,
  ShoppingBag,
  Zap,
  Sliders,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SettingsAdvancedTab: React.FC = () => {
  const { company, updateCompany } = useERP();

  const [shopMode, setShopMode] = useState<
    'small_shop' | 'retail_supermarket' | 'wholesale_distribution' | 'mall_multicounter'
  >(company.shopMode || 'retail_supermarket');

  const [enableMultiTierPricing, setEnableMultiTierPricing] = useState(
    company.enableMultiTierPricing !== false
  );

  const [whatsappBusinessNumber, setWhatsappBusinessNumber] = useState(
    company.whatsappBusinessNumber || ''
  );

  const [whatsappOrderGreeting, setWhatsappOrderGreeting] = useState(
    company.whatsappOrderGreeting || 'Thank you for shopping with us! Here is your bill summary:'
  );

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

  const handleSave = async () => {
    localStorage.setItem('universal_billing_small_shop_mode', shopMode === 'small_shop' ? 'true' : 'false');
    localStorage.setItem('universal_billing_multi_warehouse', multiWarehouse ? 'true' : 'false');
    localStorage.setItem('universal_billing_batch_tracking', batchTracking ? 'true' : 'false');
    localStorage.setItem('universal_billing_serial_tracking', serialTracking ? 'true' : 'false');
    localStorage.setItem('universal_billing_allow_negative_stock', allowNegativeStock ? 'true' : 'false');
    localStorage.setItem('universal_billing_scanner_beep', scannerBeep ? 'true' : 'false');

    await updateCompany({
      shopMode,
      enableMultiTierPricing,
      whatsappBusinessNumber,
      whatsappOrderGreeting
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const shopModes = [
    {
      id: 'small_shop',
      name: 'Small 30–50 Product Shop (Kirana & Kiosks)',
      desc: 'Optimized for single-cashier counters. Auto-defaults to 1-Tap Counter POS, hides multi-godown clutter, and focuses on quick cash/UPI billing.',
      icon: Store,
      badge: 'Lightweight'
    },
    {
      id: 'retail_supermarket',
      name: 'Retail Supermarket & Grocery',
      desc: 'Standard retail operations. High-speed barcode scanner support, shelf-edge price talkers, held bills drawer, and cashier shifts.',
      icon: ShoppingBag,
      badge: 'Standard'
    },
    {
      id: 'wholesale_distribution',
      name: 'Wholesale & Route Distribution Hub',
      desc: 'Enables 4 Price Tiers (Rate A, B, C, D), up to 100% discount negotiations, salesperson route supply, and credit limit tracking.',
      icon: Truck,
      badge: 'Wholesale'
    },
    {
      id: 'mall_multicounter',
      name: 'Multi-Counter Mall & Hypermarket',
      desc: 'Enterprise multi-terminal setup. Inbound Phone/WhatsApp dispatch queue, shift closing Z-reports, and strict cashier role isolation.',
      icon: Building2,
      badge: 'Enterprise'
    }
  ] as const;

  return (
    <div className="space-y-5 text-xs animate-fadeIn">
      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-bold">Operational rules & Shop Mode configuration successfully saved!</span>
        </div>
      )}

      {/* Shop Mode Selector */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            Store Scale & Operational Mode
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Configure how the ERP presents billing, inventory, and navigation to fit your exact store scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shopModes.map(mode => {
            const Icon = mode.icon;
            const isSelected = shopMode === mode.id;

            return (
              <div
                key={mode.id}
                onClick={() => setShopMode(mode.id)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {mode.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {mode.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">{mode.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp Business Ordering Integration */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            WhatsApp Ordering & Bill Dispatch
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Configure default customer messaging and business phone number for 1-click WhatsApp bills and dispatch tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Store WhatsApp Business Number
            </label>
            <input
              type="text"
              value={whatsappBusinessNumber}
              onChange={e => setWhatsappBusinessNumber(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              WhatsApp Order Confirmation Greeting
            </label>
            <input
              type="text"
              value={whatsappOrderGreeting}
              onChange={e => setWhatsappOrderGreeting(e.target.value)}
              placeholder="Greeting text sent before order items"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Universal Operational Feature Flags</h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Multi-Tier Pricing (Rate A, B, C, D)
              </span>
              <span className="text-[11px] text-slate-500">
                Allow cashiers and salespersons to switch product pricing tiers on demand.
              </span>
            </div>
            <input
              type="checkbox"
              checked={enableMultiTierPricing}
              onChange={e => setEnableMultiTierPricing(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Multi-Warehouse & Godown Routing
              </span>
              <span className="text-[11px] text-slate-500">
                Enable inter-warehouse stock transfers between godowns and front store counter.
              </span>
            </div>
            <input
              type="checkbox"
              checked={multiWarehouse}
              onChange={e => setMultiWarehouse(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Batch & Expiry FEFO Tracking
              </span>
              <span className="text-[11px] text-slate-500">
                Track pharmaceutical lot numbers and perishable item expiry alerts.
              </span>
            </div>
            <input
              type="checkbox"
              checked={batchTracking}
              onChange={e => setBatchTracking(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Serial Number & IMEI Tracking
              </span>
              <span className="text-[11px] text-slate-500">
                Enforce unique mobile IMEI / device serial number tracking on purchase and sale.
              </span>
            </div>
            <input
              type="checkbox"
              checked={serialTracking}
              onChange={e => setSerialTracking(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Allow Negative Stock Billing
              </span>
              <span className="text-[11px] text-slate-500">
                Allow POS cashier to bill items even if system ledger stock is 0.
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowNegativeStock}
              onChange={e => setAllowNegativeStock(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-3 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Barcode Scanner Sound Feedback
              </span>
              <span className="text-[11px] text-slate-500">
                Play beep confirmation tone when a barcode is scanned.
              </span>
            </div>
            <input
              type="checkbox"
              checked={scannerBeep}
              onChange={e => setScannerBeep(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer text-xs"
        >
          Save All Operational Configurations
        </button>
      </div>
    </div>
  );
};
