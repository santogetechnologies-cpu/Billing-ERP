import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Package,
  Edit,
  Trash2,
  ScanBarcode,
  Boxes,
  Eye,
  Download,
  CheckCircle2,
  Calendar,
  X,
  ArrowRight,
  Hash,
  Zap,
  RefreshCw,
  Warehouse as WarehouseIcon,
  Layers,
  Tag,
  DollarSign,
  Scale
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column, DataTableRef } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Product } from '../../types';
import { Modal } from '../../components/common/Modal';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { sortProductsAZ } from '../../utils/sortUtils';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canManageBarcodeOverride } from '../../utils/rbac';
import { ProductDeleteModal } from '../../components/products/ProductDeleteModal';
import { directPrintService } from '../../services/directPrintService';

export const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { products, warehouses, stockBalances, deleteProduct } = useERP();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const tableRef = useRef<DataTableRef | null>(null);

  const handleDirectPrintProductBarcode = async (product: Product, copies: number = 1) => {
    if (!product.barcode) {
      setToastMessage(`Product "${product.name}" does not have a barcode assigned yet.`);
      return;
    }
    setIsPrintingDirect(true);
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
        copies
      );
      setToastMessage(res.message);
    } catch (err: any) {
      setToastMessage(`Print error: ${err?.message || 'Failed to print'}`);
    } finally {
      setIsPrintingDirect(false);
    }
  };

  React.useEffect(() => {
    if (location.state?.message) {
      setToastMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Dynamic products with computed stockStatus for sorting, filtering & search (sorted A-Z)
  const productsWithStatus = useMemo(() => {
    const list = products.map(p => ({
      ...p,
      stockStatus: calculateStockStatus(p.currentStock, p.reorderLevel)
    }));
    return sortProductsAZ(list);
  }, [products]);

  // Warehouse stock breakdown for the currently selected product
  const warehouseStockList = useMemo(() => {
    if (!selectedProduct) return [];
    const balances = stockBalances.filter(b => b.productId === selectedProduct.id);
    if (balances.length > 0) {
      return balances.map(b => {
        const wh = warehouses.find(w => w.id === b.warehouseId);
        return {
          warehouseId: b.warehouseId,
          warehouseName: wh?.name || b.warehouseId,
          quantity: b.quantity
        };
      });
    }
    if (selectedProduct.warehouse) {
      return [
        {
          warehouseId: 'default',
          warehouseName: selectedProduct.warehouse,
          quantity: selectedProduct.currentStock
        }
      ];
    }
    return [];
  }, [selectedProduct, stockBalances, warehouses]);

  // Export handler - triggers DataTable export or direct fallback
  const handleExport = () => {
    if (tableRef.current?.exportCSV) {
      tableRef.current.exportCSV();
    } else {
      const activeCols = [
        { header: 'Product Name', key: 'name' },
        { header: 'SKU / Code', key: 'sku' },
        { header: 'Category', key: 'category' },
        { header: 'Unit', key: 'primaryUnit' },
        { header: 'Current Stock', key: 'currentStock' },
        { header: 'Selling Price', key: 'sellingPrice' },
        { header: 'Stock Status', key: 'stockStatus' }
      ];
      const headers = activeCols.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
      const rows = productsWithStatus.map(p => [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.sku || p.code || '').replace(/"/g, '""')}"`,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        `"${(p.primaryUnit || 'Piece').replace(/"/g, '""')}"`,
        `"${Number(p.currentStock ?? 0)}"`,
        `"${Number(p.sellingPrice ?? 0)}"`,
        `"${(p.stockStatus || '').replace(/"/g, '""')}"`
      ].join(','));
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Product_Inventory_Master_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setToastMessage('Exporting product catalog to CSV...');
  };

  // Simplified Table Columns:
  // Product Name | SKU / Product Code | Category | Unit | Current Stock | Selling Price | Stock Status | Actions
  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      sortable: true,
      sortValue: row => (row.name || '').trim(),
      width: '24%',
      minWidth: '150px',
      render: row => (
        <div className="min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 block truncate" title={row.name}>
              {row.name}
            </span>
            {!row.isActive && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                Inactive
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'sku',
      header: 'SKU / Code',
      sortable: true,
      width: '14%',
      minWidth: '95px',
      render: row => (
        <span
          className="font-mono font-semibold text-blue-600 block truncate text-xs"
          title={row.sku || row.code}
        >
          {row.sku || row.code}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      width: '13%',
      minWidth: '95px',
      render: row => (
        <span
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 block truncate text-center"
          title={row.category}
        >
          {row.category}
        </span>
      )
    },
    {
      key: 'primaryUnit',
      header: 'Unit',
      align: 'center',
      sortable: true,
      width: '9%',
      minWidth: '60px',
      render: row => (
        <span className="font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-xs">
          {row.primaryUnit || 'Piece'}
        </span>
      )
    },
    {
      key: 'currentStock',
      header: 'Current Stock',
      align: 'right',
      sortable: true,
      sortValue: row => Number(row.currentStock ?? 0),
      width: '13%',
      minWidth: '85px',
      render: row => {
        const qty = Number(row.currentStock ?? 0);
        const isOutOfStock = qty <= 0;
        return (
          <span
            className={`font-bold font-mono text-xs ${
              isOutOfStock ? 'text-rose-600' : 'text-slate-900'
            }`}
            title={`${formatNumber(qty)} ${row.primaryUnit || 'Piece'}`}
          >
            {formatNumber(qty)}
          </span>
        );
      }
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      align: 'right',
      sortable: true,
      sortValue: row => Number(row.sellingPrice ?? 0),
      width: '13%',
      minWidth: '90px',
      render: row => (
        <span className="font-bold text-slate-900 whitespace-nowrap text-xs">
          {formatCurrency(row.sellingPrice)}
        </span>
      )
    },
    {
      key: 'stockStatus',
      header: 'Stock Status',
      align: 'center',
      sortable: true,
      sortValue: row => row.stockStatus,
      width: '14%',
      minWidth: '95px',
      render: row => {
        const stockStatus = row.stockStatus || calculateStockStatus(row.currentStock, row.reorderLevel);
        return (
          <StatusBadge
            status={stockStatus}
            size="sm"
          />
        );
      }
    }
  ];

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  return (
    <div className="space-y-5">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800 text-xs font-medium animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Product Master & Inventory Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain SKU definitions, barcode generation, multi-tier pricing, and unit conversions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(profile?.role, 'products', 'manage') && (
            <button
              onClick={() => navigate('/units')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Unit Conversions
            </button>
          )}
          {hasPermission(profile?.role, 'products', 'manage') && (
            <button
              onClick={() => navigate('/pricing')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Pricing Rules
            </button>
          )}
          {canManageBarcodeOverride(profile?.role) && (
            <button
              onClick={() => navigate('/purchases/barcode-management')}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Purchase Manager Barcode Override & Supplier Packaging"
            >
              <ScanBarcode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Barcode Override</span>
            </button>
          )}
          {/* Export button in top-right header */}
          <button
            onClick={handleExport}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export Product Catalog to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Products DataTable */}
      <DataTable
        title="Product Inventory Master"
        subtitle={`Total ${products.length} products registered across ${categories.length} categories`}
        columns={columns}
        data={productsWithStatus}
        defaultSortKey="name"
        defaultSortDir="asc"
        enablePagination={false}
        infiniteScroll={true}
        batchSize={50}
        searchPlaceholder="Search product by name, SKU, brand, barcode, status..."
        searchKeys={['name', 'sku', 'barcode', 'category', 'brand', 'stockStatus', 'currentStock']}
        filters={[
          {
            key: 'category',
            label: 'Category',
            options: categories.map(c => ({ label: c, value: c }))
          },
          {
            key: 'stockStatus',
            label: 'Stock Status',
            options: [
              { label: 'Active', value: 'Active' },
              { label: 'Limited', value: 'Limited Stock' },
              { label: 'Out of Stock', value: 'Out of Stock' },
              { label: 'Not Set', value: 'Not Set' }
            ]
          }
        ]}
        onRowClick={row => setSelectedProduct(row)}
        hideHorizontalScroll={true}
        tableFixed={true}
        hideExport={true}
        tableRef={tableRef}
        actionsWidth="84px"
        actions={row => (
          <div className="flex items-center justify-end gap-1 shrink-0 whitespace-nowrap">
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedProduct(row);
              }}
              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
              title="View Product Details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {hasPermission(profile?.role, 'products', 'edit') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/products/edit/${row.id}`);
                }}
                className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
                title="Edit Product Master"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPermission(profile?.role, 'products', 'delete') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  setProductToDelete(row);
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                title="Delete Product"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Comprehensive Product Detail Modal */}
      {selectedProduct && (
        <Modal
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          title={selectedProduct.name}
          subtitle={`SKU: ${selectedProduct.sku} ${selectedProduct.hsn ? `| HSN: ${selectedProduct.hsn}` : ''}`}
          size="lg"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <span className="text-xs text-slate-500">
                Created: {formatDate(selectedProduct.createdAt)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {selectedProduct.barcode && (
                  <button
                    type="button"
                    disabled={isPrintingDirect}
                    onClick={() => handleDirectPrintProductBarcode(selectedProduct, 1)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    title="Directly send 1 barcode sticker to the configured label printer"
                  >
                    {isPrintingDirect ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-white" />
                    )}
                    <span>Direct Print Sticker</span>
                  </button>
                )}
                {hasPermission(profile?.role, 'products', 'delete') && (
                  <button
                    onClick={() => {
                      const prod = selectedProduct;
                      setSelectedProduct(null);
                      setProductToDelete(prod);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                {hasPermission(profile?.role, 'products', 'edit') && (
                  <button
                    onClick={() => {
                      navigate(`/products/edit/${selectedProduct.id}`);
                      setSelectedProduct(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header / Summary Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Product Barcode (Code 128)
                </span>
                <div className="pt-2">
                  <BarcodeCanvas value={selectedProduct.barcode} height={45} />
                </div>
                {selectedProduct.barcode && (
                  <span className="font-mono text-[11px] text-slate-500 mt-1 block">
                    Code: {selectedProduct.barcode}
                  </span>
                )}
              </div>

              <div className="text-center sm:text-right space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Current Stock
                </span>
                <p className={`text-2xl font-black ${selectedProduct.currentStock <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatNumber(selectedProduct.currentStock)} {selectedProduct.primaryUnit || 'Piece'}
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-2 pt-0.5">
                  <StatusBadge
                    status={calculateStockStatus(selectedProduct.currentStock, selectedProduct.reorderLevel)}
                    size="sm"
                  />
                  {(selectedProduct.costPrice > 0 || selectedProduct.purchasePrice > 0) && (
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Valuation: {formatCurrency(selectedProduct.currentStock * (selectedProduct.costPrice || selectedProduct.purchasePrice || 0))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* General Information & Identifiers */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                Product Details & Identifiers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Category</span>
                  <span className="font-semibold text-slate-800 text-xs">{selectedProduct.category || 'General'}</span>
                </div>
                {selectedProduct.subcategory && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Subcategory</span>
                    <span className="font-semibold text-slate-800 text-xs">{selectedProduct.subcategory}</span>
                  </div>
                )}
                {selectedProduct.brand && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Brand</span>
                    <span className="font-semibold text-slate-800 text-xs">{selectedProduct.brand}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">SKU</span>
                  <span className="font-mono font-bold text-blue-600 text-xs">{selectedProduct.sku}</span>
                </div>
                {selectedProduct.code && selectedProduct.code !== selectedProduct.sku && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Product Code</span>
                    <span className="font-mono font-semibold text-slate-700 text-xs">{selectedProduct.code}</span>
                  </div>
                )}
                {selectedProduct.hsn && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">HSN Code</span>
                    <span className="font-mono font-semibold text-slate-700 text-xs">{selectedProduct.hsn}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${selectedProduct.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedProduct.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {selectedProduct.taxRate !== undefined && selectedProduct.taxRate !== null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Tax Rate</span>
                    <span className="font-semibold text-slate-800 text-xs">{selectedProduct.taxRate}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Units & Conversions */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                Unit & Packaging
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Primary Unit</span>
                  <span className="font-semibold text-slate-800 text-xs">{selectedProduct.primaryUnit || 'Piece'}</span>
                </div>
                {selectedProduct.secondaryUnit && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Secondary Unit</span>
                    <span className="font-semibold text-slate-800 text-xs">{selectedProduct.secondaryUnit}</span>
                  </div>
                )}
                {selectedProduct.secondaryUnit && selectedProduct.conversionFactor && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Conversion Factor</span>
                    <span className="font-semibold text-indigo-700 text-xs">
                      1 {selectedProduct.secondaryUnit} = {selectedProduct.conversionFactor} {selectedProduct.primaryUnit}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Multi-Tier Grid */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Commercial Pricing Tiers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {selectedProduct.costPrice > 0 && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Cost Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.costPrice)}
                    </span>
                  </div>
                )}
                {selectedProduct.purchasePrice > 0 && selectedProduct.purchasePrice !== selectedProduct.costPrice && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Purchase Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.purchasePrice)}
                    </span>
                  </div>
                )}
                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60">
                  <span className="text-[10px] text-blue-700 block font-medium">Standard Selling</span>
                  <span className="font-bold text-blue-900 text-sm">
                    {formatCurrency(selectedProduct.sellingPrice)}
                  </span>
                </div>
                {selectedProduct.retailPrice > 0 && selectedProduct.retailPrice !== selectedProduct.sellingPrice && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Retail Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.retailPrice)}
                    </span>
                  </div>
                )}
                {selectedProduct.wholesalePrice > 0 && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Wholesale Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.wholesalePrice)}
                    </span>
                  </div>
                )}
                {selectedProduct.dealerPrice && selectedProduct.dealerPrice > 0 ? (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Dealer Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.dealerPrice)}
                    </span>
                  </div>
                ) : null}
                {selectedProduct.mrp > 0 && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">MRP</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.mrp)}
                    </span>
                  </div>
                )}
                {selectedProduct.minSellingPrice > 0 && (
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Min Selling Price</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(selectedProduct.minSellingPrice)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Warehouse Quantities & Storage Locations */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <WarehouseIcon className="w-3.5 h-3.5 text-amber-600" />
                  Warehouse Inventory & Stock Thresholds
                </h4>
                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>
                    Warning Limit:{' '}
                    <strong className="text-amber-700">
                      {selectedProduct.reorderLevel !== null && selectedProduct.reorderLevel !== undefined
                        ? `${selectedProduct.reorderLevel} ${selectedProduct.primaryUnit || 'Piece'}`
                        : 'Not Set'}
                    </strong>
                  </span>
                  {selectedProduct.targetStockLevel ? (
                    <span>
                      Target:{' '}
                      <strong className="text-slate-800">
                        {selectedProduct.targetStockLevel} {selectedProduct.primaryUnit || 'Piece'}
                      </strong>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Warehouse Locations Breakdown */}
              {warehouseStockList.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Warehouse</th>
                        <th className="py-2 px-3 text-right">Available Quantity</th>
                        <th className="py-2 px-3 text-right">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {warehouseStockList.map((wh, idx) => (
                        <tr key={wh.warehouseId || idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {wh.warehouseName}
                            {selectedProduct.warehouse === wh.warehouseName && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Default
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatNumber(wh.quantity)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">
                            {selectedProduct.primaryUnit || 'Piece'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 italic text-xs">
                  Storage: {selectedProduct.warehouse || 'Main Warehouse'} {selectedProduct.rack ? `(Rack: ${selectedProduct.rack})` : ''}
                </p>
              )}

              {selectedProduct.rack && (
                <p className="text-[11px] text-slate-500">
                  Assigned Rack / Bin: <strong className="text-slate-700">{selectedProduct.rack}</strong>
                </p>
              )}
            </div>

            {/* Tracking Controls: Batch & Expiry */}
            {(selectedProduct.batchNumber || selectedProduct.expiryDate || selectedProduct.batchTracking || selectedProduct.expiryTracking) && (
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 block text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Batch & Expiry Details
                  </span>
                  {selectedProduct.expiryDate && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      new Date(selectedProduct.expiryDate) < new Date()
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {new Date(selectedProduct.expiryDate) < new Date() ? 'Expired' : 'Active'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Batch Number</span>
                    <span className="font-mono font-bold text-slate-900">{selectedProduct.batchNumber || 'Assigned per inward'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Expiry Date</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedProduct.expiryDate ? formatDate(selectedProduct.expiryDate) : 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Batch Tracking</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.batchTracking ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Expiry Tracking</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.expiryTracking ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Serial Numbers Shortcut */}
            {selectedProduct.serialTracking && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/80 flex items-center justify-between">
                <div>
                  <span className="font-bold text-purple-900 block text-xs flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-purple-600" />
                    Serial Tracking Enabled
                  </span>
                  <p className="text-[11px] text-purple-700">Individual unit serial tracking and warranty inspection active.</p>
                </div>
                <Link
                  to="/inventory/serials"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View Serials</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Description */}
            {selectedProduct.description && (
              <div>
                <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wider">
                  Description
                </span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs whitespace-pre-wrap">
                  {selectedProduct.description}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Product Deletion & Archiving Security Modal */}
      <ProductDeleteModal
        product={productToDelete}
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onSuccess={msg => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />
    </div>
  );
};
