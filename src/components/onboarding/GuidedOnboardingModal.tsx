import React, { useState } from 'react';
import {
  Sparkles,
  Building,
  Store,
  Package,
  Users,
  Check,
  ArrowRight,
  ShoppingBag,
  Pill,
  Shirt,
  Tv,
  Car,
  Wrench,
  Building2,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { formatCurrency } from '../../utils/formatters';

interface GuidedOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export type BusinessCategoryType =
  | 'Grocery'
  | 'Pharmacy'
  | 'Clothing'
  | 'Electronics'
  | 'Vehicles'
  | 'Hardware'
  | 'Mall';

const BUSINESS_TYPES = [
  { id: 'Grocery', name: 'Grocery & Supermarket', desc: 'Loose grains, peanuts, barcode weighing scale, KG/LTR units', icon: ShoppingBag },
  { id: 'Pharmacy', name: 'Pharmacy & Healthcare', desc: 'Blister strips, loose tablets (cut-strip), batch & expiry FEFO', icon: Pill },
  { id: 'Clothing', name: 'Apparel & Fashion', desc: 'Variants (Size, Color), fabric by MTR, barcode tags', icon: Shirt },
  { id: 'Electronics', name: 'Electronics & Mobiles', desc: 'IMEI / Serial numbers, warranty tracking, combo kits', icon: Tv },
  { id: 'Vehicles', name: 'Vehicles & Automotive', desc: 'VIN tracking, battery serials, chassis numbers, RC/insurance', icon: Car },
  { id: 'Hardware', name: 'Hardware & Construction', desc: 'Tiles (SQF), wire/rope (MTR), cement bags, bulk trade', icon: Wrench },
  { id: 'Mall', name: 'Retail Mall / Multi-Category', desc: 'Enterprise multi-counter POS, department stores, universal billing', icon: Building2 }
];

export const GuidedOnboardingModal: React.FC<GuidedOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { company, updateCompany, addProduct, addWarehouse, addUser } = useERP();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Business Type
  const [selectedType, setSelectedType] = useState<BusinessCategoryType>('Grocery');

  // Step 2: Business & Tax Details
  const [businessName, setBusinessName] = useState(company?.companyName || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [gstin, setGstin] = useState(company?.gstin || '');
  const [address, setAddress] = useState(company?.address || '');
  const [state, setState] = useState(company?.state || 'Maharashtra');

  // Step 3: Stores & Warehouses
  const [storeName, setStoreName] = useState('Main Store');
  const [storeCode, setStoreCode] = useState('MAIN-01');

  // Step 4: Add Starter Demo Products
  const [importDemoProducts, setImportDemoProducts] = useState(true);

  // Step 5: Invite Users & Small Shop Mode
  const [isSmallShopMode, setIsSmallShopMode] = useState(true);
  const [cashierName, setCashierName] = useState('');
  const [cashierEmail, setCashierEmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFinish = async () => {
    try {
      setIsSubmitting(true);

      // 1. Update company profile
      await updateCompany({
        companyName: businessName || company?.companyName || 'My Business Store',
        phone: phone || undefined,
        gstin: gstin || undefined,
        address: address || undefined,
        state: state || undefined
      });

      // 2. Save small-shop mode in localStorage
      localStorage.setItem('universal_billing_small_shop_mode', isSmallShopMode ? 'true' : 'false');
      localStorage.setItem('universal_billing_business_type', selectedType);
      localStorage.setItem('universal_billing_onboarding_completed', 'true');

      // 3. Create demo catalog based on business type if enabled
      if (importDemoProducts) {
        if (selectedType === 'Pharmacy') {
          await addProduct({
            name: 'Paracetamol 650mg Dolo',
            sku: 'PHARM-DOLO',
            category: 'Medicines',
            primaryUnit: 'STRIP',
            currentStock: 50,
            purchasePrice: 24,
            salePrice: 32,
            mrp: 35,
            hasBatchTracking: true,
            hasExpiryTracking: true,
            minStockLevel: 10
          });
        } else if (selectedType === 'Clothing') {
          await addProduct({
            name: 'Men Slim Fit Cotton Shirt (Navy Blue - L)',
            sku: 'APP-SHIRT-NVY-L',
            category: 'Men Apparel',
            primaryUnit: 'PCS',
            currentStock: 25,
            purchasePrice: 450,
            salePrice: 899,
            mrp: 999,
            minStockLevel: 5
          });
        } else if (selectedType === 'Electronics') {
          await addProduct({
            name: 'Samsung Galaxy S24 Ultra 256GB',
            sku: 'ELEC-S24U-256',
            category: 'Smartphones',
            primaryUnit: 'PCS',
            currentStock: 8,
            purchasePrice: 95000,
            salePrice: 119999,
            mrp: 129999,
            hasSerialTracking: true,
            minStockLevel: 2
          });
        } else if (selectedType === 'Hardware') {
          await addProduct({
            name: 'Vitrified Floor Tiles 600x600mm (Glossy White)',
            sku: 'HARD-TILE-600',
            category: 'Ceramics & Tiles',
            primaryUnit: 'SQF',
            currentStock: 1200,
            purchasePrice: 38,
            salePrice: 55,
            mrp: 65,
            minStockLevel: 200
          });
        } else {
          // Grocery default
          await addProduct({
            name: 'Basmati Rice Premium (Loose)',
            sku: 'GROC-RICE-BSM',
            category: 'Grains & Pulses',
            primaryUnit: 'KG',
            currentStock: 250,
            purchasePrice: 65,
            salePrice: 90,
            mrp: 95,
            minStockLevel: 30
          });
        }
      }

      if (onComplete) onComplete();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Error saving setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Wizard Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Guided First-Run Onboarding</h3>
              <p className="text-xs text-slate-500">Universal ERP & Billing Setup in 5 Steps</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          {[
            { num: 1, label: 'Business Type' },
            { num: 2, label: 'Details & Tax' },
            { num: 3, label: 'Stores' },
            { num: 4, label: 'Products' },
            { num: 5, label: 'Roles & Mode' }
          ].map(s => (
            <div key={s.num} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s.num ? 'bg-blue-600 text-white' : step > s.num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
              </span>
              <span className={`text-[11px] font-medium hidden sm:inline ${step === s.num ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Wizard Step Bodies */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* STEP 1: BUSINESS TYPE */}
          {step === 1 && (
            <div className="space-y-3 animate-fadeIn">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Select your primary retail or wholesale industry:</h4>
                <p className="text-xs text-slate-500">Pre-enables relevant units (e.g. KG, STRIP, SQF), barcodes, and batch/serial modules.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {BUSINESS_TYPES.map(bt => {
                  const Icon = bt.icon;
                  const isSelected = selectedType === bt.id;
                  return (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => setSelectedType(bt.id as any)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">{bt.name}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">{bt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Business Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS & TAX */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Commercial Store & GST Information</h4>
                <p className="text-xs text-slate-500">These details will appear on thermal receipts and tax invoice vouchers.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Trading Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Supermarket & Provisions"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
                    <input
                      type="text"
                      placeholder="27AAAAA0000A1Z5"
                      value={gstin}
                      onChange={e => setGstin(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono uppercase text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Store Address</label>
                  <input
                    type="text"
                    placeholder="Shop #12, MG Road Market"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Store Locations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: STORES & WAREHOUSES */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Primary Store & Warehouse Outlet</h4>
                <p className="text-xs text-slate-500">Configure your initial sales counter or central dispatch godown.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location Code</label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={e => setStoreCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <span className="font-bold block mb-1">Multi-Warehouse Expansion:</span>
                You can add multiple branches, godowns, and warehouses at any time from Settings &gt; Stores.
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Product Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PRODUCTS */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Product Catalog Initiation</h4>
                <p className="text-xs text-slate-500">Load sample demo products configured for {selectedType} to start testing immediately.</p>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={importDemoProducts}
                    onChange={e => setImportDemoProducts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Install starter catalog items for {selectedType}</span>
                </label>
                <p className="text-slate-500 pl-6">
                  Pre-configures demo SKU, barcode, unit conversions, and stock balances matching your selected industry.
                </p>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Operating Mode</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: ROLES & SMALL SHOP MODE */}
          {step === 5 && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Operational Mode & Simplicity</h4>
                <p className="text-xs text-slate-500">Choose between single-cashier simplicity or full enterprise capabilities.</p>
              </div>

              {/* Small Shop Mode Toggle */}
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Small-Shop Mode (Recommended for Single Counter)</span>
                    <span className="text-[11px] text-slate-500">
                      Hides complex enterprise modules (multi-warehouse, serial tracking, manager approval queues) to keep the app ultra-fast and simple.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSmallShopMode}
                    onChange={e => setIsSmallShopMode(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinish}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Finalizing Setup...' : 'Complete Setup & Launch ERP'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
