import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Package,
  Edit,
  Trash2,
  ScanBarcode,
  Boxes,
  Eye,
  Plus,
  Tag,
  DollarSign,
  FileSpreadsheet,
  Printer,
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
import { ProductLabelsTab } from '../../components/products/ProductLabelsTab';
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
      setProductToEdit(null);
      setIsMasterModalOpen(true);
      // Clean query param
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  // Tab definitions (Part C: Products: All · Categories · Price lists (view) · Import/Export · Labels)
  const tabs: TabItem[] = [
    { id: 'all', label: 'All Products', count: products.length, icon: Package },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'pricing', label: 'Price Lists (View)', icon: DollarSign },
    { id: 'import_export', label: 'Import / Export', icon: FileSpreadsheet },
    { id: 'labels', label: 'Labels & Barcodes', icon: ScanBarcode }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
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
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">{p.name}</p>
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
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleDirectPrintBarcode(p)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Silent print barcode label"
          >
            <Printer className="w-3.5 h-3.5" />
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Products</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Master catalogue supporting loose items, pharma cut-strips, variants & vehicles.
          </p>
        </div>

        {/* ONE Primary Button per page (Part B1) */}
        <button
          type="button"
          onClick={() => {
            setProductToEdit(null);
            setIsMasterModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Product</span>
        </button>
      </div>

      {/* In-Page Tabs (Part B2 & Part C) */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        syncWithUrlQuery="tab"
      />

      {/* Tab 1: All Products Catalogue */}
      {activeTab === 'all' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
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

      {/* Tab 5: Labels & Barcodes */}
      {activeTab === 'labels' && <ProductLabelsTab />}

      {/* Product Master Modal (Progressive Disclosure) */}
      <ProductMasterModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        productToEdit={productToEdit}
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
