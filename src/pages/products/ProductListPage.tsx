import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  ScanBarcode,
  Boxes,
  Eye,
  ArrowUpDown,
  Download,
  Filter,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import { Product } from '../../types';
import { Modal } from '../../components/common/Modal';
import { BarcodeCanvas } from '../../components/barcode/BarcodeCanvas';
import { calculateStockStatus } from '../../utils/inventoryUtils';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, canManageBarcodeOverride } from '../../utils/rbac';
import { ProductDeleteModal } from '../../components/products/ProductDeleteModal';

export const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { products, deleteProduct } = useERP();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isWarehouseManager = profile?.role === 'Warehouse Manager';

  React.useEffect(() => {
    if (location.state?.message) {
      setToastMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Dynamic products with computed stockStatus for sorting, filtering & search
  const productsWithStatus = React.useMemo(() => {
    return products.map(p => ({
      ...p,
      stockStatus: calculateStockStatus(p.currentStock, p.reorderLevel)
    }));
  }, [products]);

  // Table Columns:
  // SKU | Product Name | Category | Unit (hidden for Warehouse Manager) | Warning Limit (hidden for Warehouse Manager) | Cost | Selling Price | Tax Rate | Stock Status | Actions
  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: isWarehouseManager ? '15%' : undefined,
      render: row => (
        <span
          className="font-mono font-bold text-blue-600 hover:underline block truncate text-xs"
          title={row.sku}
        >
          {row.sku}
        </span>
      )
    },
    {
      key: 'name',
      header: 'Product Name',
      width: isWarehouseManager ? '25%' : undefined,
      render: row => (
        <div className="min-w-0">
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
          <span className="text-[10px] text-slate-400 font-mono block truncate" title={row.barcode}>
            {row.barcode ? `Barcode: ${row.barcode}` : ''}{row.brand ? ` • ${row.brand}` : ''}
          </span>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      width: isWarehouseManager ? '14%' : undefined,
      render: row => (
        <span
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 block truncate text-center"
          title={row.category}
        >
          {row.category}
        </span>
      )
    },
    ...(!isWarehouseManager
      ? [
          {
            key: 'primaryUnit' as const,
            header: 'Unit',
            align: 'center' as const,
            render: (row: Product) => (
              <span className="font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {row.primaryUnit}
              </span>
            )
          }
        ]
      : []),
    ...(!isWarehouseManager
      ? [
          {
            key: 'reorderLevel' as const,
            header: 'Warning Limit',
            align: 'right' as const,
            render: (row: Product) => {
              const hasLimit = row.reorderLevel !== null && row.reorderLevel !== undefined;
              return hasLimit ? (
                <span className="font-semibold text-amber-700 font-mono text-xs">
                  {formatNumber(row.reorderLevel!)} {row.primaryUnit}
                </span>
              ) : (
                <span className="text-slate-400 text-xs italic">Not Set</span>
              );
            }
          }
        ]
      : []),
    {
      key: 'costPrice',
      header: isWarehouseManager ? 'Cost' : 'Cost (₹)',
      align: 'right',
      width: isWarehouseManager ? '8%' : undefined,
      render: row => (
        <span className="text-slate-600 font-medium whitespace-nowrap text-xs">{formatCurrency(row.costPrice)}</span>
      )
    },
    {
      key: 'sellingPrice',
      header: isWarehouseManager ? 'Selling' : 'Selling Price (₹)',
      align: 'right',
      width: isWarehouseManager ? '9%' : undefined,
      render: row => (
        <span className="font-bold text-slate-900 whitespace-nowrap text-xs">{formatCurrency(row.sellingPrice)}</span>
      )
    },
    {
      key: 'taxRate',
      header: isWarehouseManager ? 'Tax' : 'Tax Rate',
      align: 'center',
      width: isWarehouseManager ? '7%' : undefined,
      render: row => (
        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{row.taxRate}%</span>
      )
    },
    {
      key: 'stockStatus',
      header: 'Stock Status',
      align: 'center',
      width: isWarehouseManager ? '12%' : undefined,
      render: row => {
        const stockStatus = calculateStockStatus(row.currentStock, row.reorderLevel);
        const currentQty = Math.max(0, row.currentStock !== null && row.currentStock !== undefined ? Number(row.currentStock) : 0);
        const unit = row.primaryUnit || 'Pcs';

        return (
          <div className="flex flex-col items-center justify-center gap-0.5 py-0.5 min-w-0">
            <StatusBadge status={stockStatus} size="sm" />
            <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
              {formatNumber(currentQty)} {unit}
            </span>
          </div>
        );
      }
    }
  ];

  const categories = Array.from(new Set(products.map(p => p.category)));

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
            className="text-emerald-600 hover:text-emerald-800 p-0.5"
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
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Unit Conversions
            </button>
          )}
          {hasPermission(profile?.role, 'products', 'manage') && (
            <button
              onClick={() => navigate('/pricing')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Pricing Rules
            </button>
          )}
          {canManageBarcodeOverride(profile?.role) && (
            <button
              onClick={() => navigate('/purchases/barcode-management')}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Purchase Manager Barcode Override & Supplier Packaging"
            >
              <ScanBarcode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Barcode Override</span>
            </button>
          )}
          {hasPermission(profile?.role, 'products', 'create') && (
            <button
              onClick={() => navigate('/products/new')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Products DataTable */}
      <DataTable
        title="Product Inventory Master"
        subtitle={`Total ${products.length} products registered across ${categories.length} categories`}
        columns={columns}
        data={productsWithStatus}
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
              { label: 'Limited Stock', value: 'Limited Stock' },
              { label: 'Out of Stock', value: 'Out of Stock' },
              { label: 'Not Set', value: 'Not Set' }
            ]
          }
        ]}
        onRowClick={row => setSelectedProduct(row)}
        hideHorizontalScroll={isWarehouseManager}
        actions={row => (
          <div className="flex items-center justify-end gap-1">
            {hasPermission(profile?.role, 'products', 'edit') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/products/edit/${row.id}`);
                }}
                className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                title="Edit Product Master"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedProduct(row);
              }}
              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
              title="Quick View Details & Barcode"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {canManageBarcodeOverride(profile?.role) && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/purchases/barcode-management?productId=${row.id}`);
                }}
                className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                title="Override / Manage Barcode"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPermission(profile?.role, 'products', 'delete') && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  setProductToDelete(row);
                }}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                title="Delete Product"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          title={selectedProduct.name}
          subtitle={`SKU: ${selectedProduct.sku} | HSN: ${selectedProduct.hsn}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500">
                Created: {formatDate(selectedProduct.createdAt)}
              </span>
              <div className="flex gap-2">
                {hasPermission(profile?.role, 'products', 'delete') && (
                  <button
                    onClick={() => {
                      const prod = selectedProduct;
                      setSelectedProduct(null);
                      setProductToDelete(prod);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1.5 transition-colors"
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
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>
                )}
                {hasPermission(profile?.role, 'barcode', 'view') && (
                  <button
                    onClick={() => {
                      navigate('/barcode');
                      setSelectedProduct(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    <span>Print Barcode Label</span>
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-xs">
            {/* Barcode & Visual identification */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Product Barcode (Code 128)
                </span>
                <div className="pt-2">
                  <BarcodeCanvas value={selectedProduct.barcode} height={45} />
                </div>
              </div>

              <div className="text-center sm:text-right space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Current In Stock
                </span>
                <p className={`text-2xl font-black ${selectedProduct.currentStock <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatNumber(selectedProduct.currentStock)} {selectedProduct.primaryUnit}
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-2 pt-0.5">
                  <StatusBadge
                    status={calculateStockStatus(selectedProduct.currentStock, selectedProduct.reorderLevel)}
                    size="sm"
                  />
                  {!isWarehouseManager && (
                    <span className="text-[11px] text-slate-500">
                      Warning Limit:{' '}
                      {selectedProduct.reorderLevel !== null && selectedProduct.reorderLevel !== undefined
                        ? `${selectedProduct.reorderLevel} ${selectedProduct.primaryUnit}`
                        : 'Not Set'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Multi-Tier Grid */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                Commercial Pricing Tier
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Cost Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.costPrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Retail Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.retailPrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-400 block font-medium">Wholesale Price</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatCurrency(selectedProduct.wholesalePrice)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60">
                  <span className="text-[10px] text-blue-700 block font-medium">Standard Selling</span>
                  <span className="font-bold text-blue-900 text-sm">
                    {formatCurrency(selectedProduct.sellingPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warehouse & Tracking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-xs">Storage Location</span>
                <p className="text-slate-600">Warehouse: {selectedProduct.warehouse}</p>
                <p className="text-slate-600">Rack / Bin: {selectedProduct.rack}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-xs">Tracking Controls</span>
                <p className="text-slate-600">
                  Batch Tracking: {selectedProduct.batchTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
                <p className="text-slate-600">
                  Serial Number: {selectedProduct.serialTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
                <p className="text-slate-600">
                  Expiry Tracking: {selectedProduct.expiryTracking ? 'Enabled (Yes)' : 'Disabled'}
                </p>
              </div>
            </div>

            {/* Batch & Expiry Information */}
            {(selectedProduct.batchNumber || selectedProduct.expiryDate || selectedProduct.batchTracking) && (
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200/80 space-y-1">
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
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
                  <p>
                    <span className="text-slate-500 block text-[10px]">Batch Number:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedProduct.batchNumber || 'Assigned'}</span>
                  </p>
                  <p>
                    <span className="text-slate-500 block text-[10px]">Expiry Date:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedProduct.expiryDate ? formatDate(selectedProduct.expiryDate) : 'Not specified'}</span>
                  </p>
                </div>
              </div>
            )}

            {selectedProduct.description && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Description</span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
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
