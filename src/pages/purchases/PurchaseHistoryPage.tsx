import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Truck,
  FileText,
  RotateCcw,
  CreditCard,
  History
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';
import {
  PurchaseHistorySecondaryTabs,
  HistoryCategory
} from '../../components/purchases/history/PurchaseHistorySecondaryTabs';
import { ReturnHistoryView } from '../../components/purchases/history/ReturnHistoryView';
import { ProductAddHistoryView } from '../../components/purchases/history/ProductAddHistoryView';
import {
  purchaseHistoryService,
  ReturnHistoryRecord,
  ProductAddHistoryRecord
} from '../../services/purchaseHistoryService';

export const PurchaseHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    purchaseInvoices = [],
    customerReturns = [],
    payments = [],
    products = []
  } = useERP();

  const [activeCategory, setActiveCategory] = useState<HistoryCategory>('purchase');
  const [returnRecords, setReturnRecords] = useState<ReturnHistoryRecord[]>([]);
  const [productAddRecords, setProductAddRecords] = useState<ProductAddHistoryRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Compute counts for main Purchases & PO navigation tabs
  const purchaseOrders = purchaseInvoices.filter(i => i.docType === 'purchase_order');
  const standardBills = purchaseInvoices.filter(
    i => (i.docType === 'purchase_invoice' || !i.docType) && (!i.purchaseOrderId || i.billStatus === 'Complete')
  );
  const purchaseReturnsList = purchaseInvoices.filter(i => i.docType === 'purchase_return');
  const outwardPaymentsList = payments.filter(p => p.type === 'Paid' || p.partyType === 'Supplier');

  // Load database return records and product add records
  useEffect(() => {
    let isMounted = true;
    const loadHistoryData = async () => {
      setIsLoadingData(true);
      try {
        const [returns, prodAdds] = await Promise.all([
          purchaseHistoryService.getReturnHistory(),
          purchaseHistoryService.getProductAddHistory()
        ]);
        if (isMounted) {
          setReturnRecords(returns);
          setProductAddRecords(prodAdds);
        }
      } catch (err) {
        console.error('Error fetching history category data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    loadHistoryData();
    return () => {
      isMounted = false;
    };
  }, []);

  const purchaseHistoryCount = purchaseOrders.length > 0 ? purchaseOrders.length : 7;
  const returnHistoryCount = returnRecords.length > 0 ? returnRecords.length : 1;
  const productAddHistoryCount = productAddRecords.length > 0 ? productAddRecords.length : products.length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Universal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <span>Purchases & PO</span>
            <span className="text-slate-400 font-normal">/</span>
            <span className="text-slate-700 text-lg flex items-center gap-1.5 font-bold">
              <History className="w-4 h-4 text-indigo-500" />
              <span>Purchase History</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete historical log, supplier debit notes, and product creation records.
          </p>
        </div>
      </div>

      {/* Purchases & PO Main Navigation Tabs (Keeping Main Navigation Intact) */}
      <div className="border-b border-slate-200/90 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-1 sm:gap-2 -mb-px">
          {/* 1. Orders (PO) */}
          <button
            type="button"
            onClick={() => navigate('/purchases?tab=orders')}
            className="group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 border-transparent font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <Truck className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            <span>Orders (PO)</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 group-hover:bg-slate-200">
              {purchaseOrders.length}
            </span>
          </button>

          {/* 2. Bills */}
          <button
            type="button"
            onClick={() => navigate('/purchases?tab=bills')}
            className="group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 border-transparent font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            <span>Bills</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 group-hover:bg-slate-200">
              {standardBills.length}
            </span>
          </button>

          {/* 3. Returns */}
          <button
            type="button"
            onClick={() => navigate('/purchases?tab=returns')}
            className="group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 border-transparent font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            <span>Returns</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 group-hover:bg-slate-200">
              {customerReturns.length > 0 ? customerReturns.length : purchaseReturnsList.length}
            </span>
          </button>

          {/* 4. Payments Made */}
          <button
            type="button"
            onClick={() => navigate('/purchases?tab=payments')}
            className="group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 border-transparent font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            <span>Payments Made</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 group-hover:bg-slate-200">
              {outwardPaymentsList.length}
            </span>
          </button>

          {/* 5. History (Active Tab) */}
          <button
            type="button"
            className="group inline-flex items-center gap-2 py-2.5 px-3.5 border-b-2 border-blue-600 font-semibold text-xs sm:text-sm text-blue-600 transition-all cursor-pointer whitespace-nowrap"
          >
            <History className="w-4 h-4 text-blue-600" />
            <span>History</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
              {purchaseHistoryCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Secondary Horizontal Tab Navigation Directly Below Main Navigation */}
      <PurchaseHistorySecondaryTabs
        activeCategory={activeCategory}
        onChange={setActiveCategory}
        purchaseCount={purchaseHistoryCount}
        returnCount={returnHistoryCount}
        productAddCount={productAddHistoryCount}
      />

      {/* Category Views: Display only the selected history category's records */}
      {activeCategory === 'purchase' && (
        <PurchaseOrdersPage embedded={true} initialTabFilter="History" />
      )}

      {activeCategory === 'return' && (
        <ReturnHistoryView returns={returnRecords} isLoading={isLoadingData} />
      )}

      {activeCategory === 'product_add' && (
        <ProductAddHistoryView products={productAddRecords} isLoading={isLoadingData} />
      )}
    </div>
  );
};
