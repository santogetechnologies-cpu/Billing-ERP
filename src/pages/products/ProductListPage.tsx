import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Package,
  Edit,
  Trash2,
  Boxes,
  Eye,
  Plus,
  Tag,
  DollarSign,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  Layers,
  Sparkles
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column, DataTableRef } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Tabs, TabItem } from '../../components/common/Tabs';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { Product } from '../../types';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { sortProductsAZ } from '../../utils/sortUtils';
import { ProductMasterModal } from '../../components/products/ProductMasterModal';
import { ProductCategoriesTab } from '../../components/products/ProductCategoriesTab';
import { ProductPriceListsTab } from '../../components/products/ProductPriceListsTab';
import { ProductImportExportTab } from '../../components/products/ProductImportExportTab';
import { ProductDeleteModal } from '../../components/products/ProductDeleteModal';
import { directPrintService } from '../../services/directPrintService';

export const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { products, warehouses, stockBalances, deleteProduct } = useERP();

  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'all');
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedProductView, setSelectedProductView] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tableRef = useRef<DataTableRef | null>(null);

  // Sync ?tab= query param and ?action=new
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);

    const action = searchParams.get('action');
    if (action === 'new') {
      navigate('/products/initial-stock', { replace: true });
    }
  }, [searchParams]);

  // Tab definitions (Products: All · Categories · Price lists (view) · Import/Export)
  const tabs: TabItem[] = [
    { id: 'all', label: 'All Products', count: products.length, icon: Package },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'pricing', label: 'Price Lists (View)', icon: DollarSign },
    { id: 'import_export', label: 'Import / Export', icon: FileSpreadsheet }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProductView(product);
  };

  const handleEditProduct = (product: Product) => {
    setProductToEdit(product);
    setIsMasterModalOpen(true);
  };

  const handleDirectPrintBarcode = async (product: Product) => {
    if (!product.barcode) {
      setToastMessage(`Product "${product.name}" has no barcode assigned.`);
      return;
    }
    try {
      const res = await directPrintService.printBarcodeSticker(
        {
          name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          sellingPrice: product.sellingPrice,
          mrp: product.mrp,
          category: product.category
        },
        1
      );
      setToastMessage(res.message);
    } catch (err: any) {
      setToastMessage(`Print error: ${err?.message || 'Print bridge unavailable'}`);
    }
  };

  // Products with computed stock status sorted A-Z
  const productsWithStatus = useMemo(() => {
    const list = products.map(p => ({
      ...p,
      stockStatus: calculateStockStatus(p.currentStock, p.reorderLevel)
    }));
    return sortProductsAZ(list);
  }, [products]);

  // Table Columns for "All" tab
  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (p: Product) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 print:hidden no-print">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs print:whitespace-normal print:max-w-none">{p.name}</p>
            <p className="text-[10px] text-slate-400 font-mono">
              SKU: {p.sku || '—'} {p.barcode ? `| Barcode: ${p.barcode}` : ''}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (p: Product) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {p.category}
        </span>
      )
    },
    {
      key: 'primaryUnit',
      header: 'Base Unit',
      sortable: true,
      render: (p: Product) => (
        <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
          {p.primaryUnit}
        </span>
      )
    },
    {
      key: 'sellingPrice',
      header: 'Sale Price',
      sortable: true,
      render: (p: Product) => (
        <span className="text-xs font-bold text-slate-900 dark:text-white">
          {formatCurrency(p.sellingPrice)}
        </span>
      )
    },
    {
      key: 'taxRate',
      header: 'Tax',
      sortable: true,
      render: (p: Product) => (
        <span className="text-xs text-slate-500 font-medium">
          {p.taxRate}%
        </span>
      )
    },
    {
      key: 'currentStock',
      header: 'Stock Level',
      sortable: true,
      render: (p: Product) => (
        <div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {formatNumber(p.currentStock)} {p.primaryUnit}
          </span>
          {p.warehouse && (
            <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{p.warehouse}</p>
          )}
        </div>
      )
    },
    {
      key: 'stockStatus',
      header: 'Status',
      render: (p: any) => <StatusBadge status={p.stockStatus} />
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'print:hidden no-print',
      headerClassName: 'print:hidden no-print',
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleViewProduct(p)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="View product details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleEditProduct(p)}
            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Edit product"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setProductToDelete(p)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Delete product"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 text-blue-700 dark:text-blue-300 rounded-xl text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header: Title & ONE Primary Action Button (Part B1 & B2) */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-r from-[#f8fbff] via-[#f0f6ff] to-[#e8f1fd] dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 shadow-2xs print:border-none print:shadow-none print:p-0 print:mb-3">
        {/* Subtle curved wave pattern on the right side */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-1/2 pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <svg className="absolute right-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 100" fill="none">
            <path d="M120 0 C180 40, 160 80, 260 100 L400 100 L400 0 Z" fill="#dbeafe" fillOpacity="0.45" />
            <path d="M220 0 C260 35, 240 70, 330 100 L400 100 L400 0 Z" fill="#eff6ff" fillOpacity="0.6" />
          </svg>
        </div>

        {/* Left Column: Title and Subtitle */}
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Products
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Master catalogue supporting loose items, pharma cut-strips, variants &amp; vehicles.
          </p>
        </div>

        {/* Right Column: Shipping Boxes Illustration & New Product Button */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 relative z-10 self-start sm:self-auto">
          {/* Shipping Boxes Illustration */}
          <div className="hidden sm:flex items-center justify-center shrink-0 -my-2 select-none pointer-events-none drop-shadow-xs" aria-hidden="true">
            <svg width="105" height="82" viewBox="0 0 110 85" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Grounding Shadow */}
              <ellipse cx="55" cy="80" rx="46" ry="4.5" fill="#bfdbfe" fillOpacity="0.55" />

              {/* 1. Back Center Box (Tall Open Cardboard Box) */}
              <g transform="translate(36, 10)">
                <polygon points="4,22 32,22 38,32 10,32" fill="#b45309" />
                <polygon points="4,22 0,10 14,8 18,22" fill="#f59e0b" />
                <polygon points="18,22 16,8 30,10 32,22" fill="#d97706" />
                <polygon points="6,30 2,38 16,40 18,30" fill="#fbbf24" />
                <polygon points="18,30 20,40 34,38 30,30" fill="#f59e0b" />
                <polygon points="6,30 18,32 18,65 6,63" fill="#f59e0b" />
                <polygon points="18,32 32,28 32,60 18,65" fill="#d97706" />
                <line x1="18" y1="32" x2="18" y2="65" stroke="#b45309" strokeWidth="1.2" opacity="0.6" />
              </g>

              {/* 2. Front Left Box (Vibrant Blue Parcel with White Straps) */}
              <g transform="translate(14, 34)">
                <polygon points="12,0 32,0 38,8 18,8" fill="#60a5fa" />
                <polygon points="0,6 12,0 18,8 6,14" fill="#3b82f6" />
                <polygon points="0,6 18,8 18,40 0,36" fill="#2563eb" />
                <polygon points="18,8 38,8 38,40 18,40" fill="#1d4ed8" />
                <path d="M0 22 L18 24 L38 24" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
                <path d="M12 0 L18 8 L18 40" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
              </g>

              {/* 3. Front Right Box (Kraft Cardboard Box with Tape) */}
              <g transform="translate(48, 38)">
                <polygon points="10,0 28,0 36,7 18,7" fill="#fde68a" />
                <polygon points="0,6 10,0 18,7 8,13" fill="#fcd34d" />
                <polygon points="0,6 18,7 18,38 0,35" fill="#f59e0b" />
                <polygon points="18,7 36,7 36,38 18,38" fill="#d97706" />
                <polygon points="8,0 14,0 22,7 16,7" fill="#ffffff" opacity="0.9" />
                <polygon points="8,6 10,6 10,24 8,24" fill="#ffffff" opacity="0.9" />
                <rect x="7" y="7" width="4" height="24" fill="#ffffff" opacity="0.9" />
              </g>
            </svg>
          </div>

          {/* ONE Primary Button per page (Part B1) */}
          <button
            type="button"
            onClick={() => navigate('/products/initial-stock')}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition-all active:scale-95 cursor-pointer print:hidden no-print whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* In-Page Tabs (Part B2 & Part C) */}
      <div className="print:hidden no-print">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          syncWithUrlQuery="tab"
        />
      </div>

      {/* Tab 1: All Products Catalogue */}
      {activeTab === 'all' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none print:overflow-visible">
          <DataTable
            data={productsWithStatus}
            columns={columns}
            searchPlaceholder="Search by name, SKU, or scan barcode..."
            filters={[
              {
                key: 'category',
                label: 'Category',
                options: Array.from(new Set(products.map(p => p.category))).map(c => ({
                  label: c,
                  value: c
                }))
              },
              {
                key: 'stockStatus',
                label: 'Stock Status',
                options: [
                  { label: 'In Stock', value: 'In Stock' },
                  { label: 'Low Stock', value: 'Low Stock' },
                  { label: 'Out of Stock', value: 'Out of Stock' }
                ]
              }
            ]}
          />
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === 'categories' && <ProductCategoriesTab />}

      {/* Tab 3: Price Lists View */}
      {activeTab === 'pricing' && <ProductPriceListsTab />}

      {/* Tab 4: Import / Export */}
      {activeTab === 'import_export' && <ProductImportExportTab />}

      {/* Product Master Modal (View Details / Edit / Create) */}
      <ProductMasterModal
        isOpen={isMasterModalOpen || Boolean(selectedProductView)}
        onClose={() => {
          setIsMasterModalOpen(false);
          setProductToEdit(null);
          setSelectedProductView(null);
        }}
        productToEdit={selectedProductView || productToEdit}
        readOnly={Boolean(selectedProductView)}
        onSaved={saved => {
          setToastMessage(`Product "${saved.name}" saved successfully.`);
        }}
      />

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <ProductDeleteModal
          isOpen={Boolean(productToDelete)}
          product={productToDelete}
          onClose={() => setProductToDelete(null)}
          onSuccess={() => {
            setToastMessage(`Product "${productToDelete.name}" deleted.`);
            setProductToDelete(null);
          }}
        />
      )}
    </div>
  );
};
