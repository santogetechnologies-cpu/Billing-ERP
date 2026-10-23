import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  Archive,
  ShieldAlert,
  CheckCircle2,
  X,
  Loader2,
  Package,
  Layers,
  FileText,
  ShoppingCart,
  Boxes,
  ArrowRightLeft
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Product, ProductDeletionEligibility } from '../../types';
import { productService } from '../../services/productService';
import { useERP } from '../../context/ERPContext';
import { formatNumber, formatCurrency } from '../../utils/formatters';

interface ProductDeleteModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ProductDeleteModal: React.FC<ProductDeleteModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { company, deleteProduct, archiveProduct, salesInvoices, purchaseInvoices } = useERP();
  const [eligibility, setEligibility] = useState<ProductDeletionEligibility | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function evaluateEligibility() {
      if (!product || !isOpen) {
        setEligibility(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        return;
      }

      setIsChecking(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const result = await productService.checkProductDeletionEligibility(product.id, company?.id);

        if (!isMounted) return;

        // Additional local state cross-check for high-fidelity defense-in-depth
        const localReasons = [...result.reasons];
        let canDelete = result.canDelete;

        // Check if in-memory stock > 0
        if (product.currentStock > 0 && !localReasons.some(r => r.includes('active inventory stock'))) {
          canDelete = false;
          localReasons.unshift(
            `Product has active inventory stock (${product.currentStock} ${product.primaryUnit || 'Units'}). Stock must be zero before deletion.`
          );
        }

        // Check if linked to loaded sales invoices
        const linkedSales = salesInvoices?.filter(inv =>
          inv.items?.some(i => i.productId === product.id || i.sku === product.sku)
        );
        if (linkedSales && linkedSales.length > 0 && result.salesCount === 0) {
          canDelete = false;
          localReasons.push(
            `Product is referenced by ${linkedSales.length} active sales invoice(s). Deactivation is required to preserve financial records.`
          );
        }

        // Check if linked to loaded purchase invoices
        const linkedPurchases = purchaseInvoices?.filter(inv =>
          inv.items?.some(i => i.productId === product.id)
        );
        if (linkedPurchases && linkedPurchases.length > 0 && result.purchasesCount === 0) {
          canDelete = false;
          localReasons.push(
            `Product is referenced by ${linkedPurchases.length} purchase bill(s). Deactivation is required to preserve accounting records.`
          );
        }

        setEligibility({
          ...result,
          canDelete,
          reasons: localReasons
        });
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err?.message || 'Failed to check product deletion eligibility.');
      } finally {
        if (isMounted) setIsChecking(false);
      }
    }

    evaluateEligibility();

    return () => {
      isMounted = false;
    };
  }, [product, isOpen, company?.id, salesInvoices, purchaseInvoices]);

  if (!product || !isOpen) return null;

  const handleDelete = async () => {
    if (isDeleting || !eligibility?.canDelete) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteProduct(product.id);
      const msg = `Product "${product.name}" (SKU: ${product.sku}) was successfully deleted.`;
      setSuccessMessage(msg);
      if (onSuccess) onSuccess(msg);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete product. Please verify database permissions.');
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (isArchiving) return;

    setIsArchiving(true);
    setErrorMessage(null);

    try {
      await archiveProduct(product.id);
      const msg = `Product "${product.name}" has been deactivated and archived. Historical records remain fully preserved.`;
      setSuccessMessage(msg);
      if (onSuccess) onSuccess(msg);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to archive product.');
      setIsArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Product"
      subtitle={`SKU: ${product.sku} • Warehouse Manager Authorization`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting || isArchiving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* If blocked: Offer safe archiving alternative */}
            {eligibility && !eligibility.canDelete && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving || isChecking}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {isArchiving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>Archive & Deactivate Product</span>
              </button>
            )}

            {/* If eligible: Permanent delete button */}
            {eligibility && eligibility.canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isChecking}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Permanently Delete</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Success Banner */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-medium animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Product Details Overview Card */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{product.name}</h4>
                {!product.isActive && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                SKU: <span className="font-semibold text-blue-600">{product.sku}</span>
                {product.barcode && ` • Barcode: ${product.barcode}`}
                {product.category && ` • ${product.category}`}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Current Stock
            </span>
            <span
              className={`text-base font-black ${
                product.currentStock > 0 ? 'text-amber-700' : 'text-slate-700'
              }`}
            >
              {formatNumber(product.currentStock)} {product.primaryUnit || 'Units'}
            </span>
          </div>
        </div>

        {/* Loading State during Integrity & Reference Verification */}
        {isChecking && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <p className="text-xs font-medium text-slate-700">
              Verifying stock balances, invoices, purchases, and ledger transactions...
            </p>
            <p className="text-[11px] text-slate-400">
              Validating data integrity and warehouse manager authorization
            </p>
          </div>
        )}

        {/* Case A: Deletion Blocked by Integrity Rules */}
        {!isChecking && eligibility && !eligibility.canDelete && (
          <div className="space-y-3.5">
            {/* Block Alert Banner */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Permanent Deletion Blocked — Historical Data Protected</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Universal Billing enforces strict financial and accounting audit compliance. This product
                is linked to historical business records or active warehouse stock, and permanently deleting
                it would corrupt ledger balances and invoice line items.
              </p>
            </div>

            {/* Identified References Grid */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Active Historical References & Constraints
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    product.currentStock > 0
                      ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Boxes className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <span className="text-[10px] block font-medium">Active Stock</span>
                  <span className="text-xs font-bold">
                    {formatNumber(product.currentStock)} {product.primaryUnit}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    eligibility.salesCount > 0
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <FileText className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <span className="text-[10px] block font-medium">Sales Invoices</span>
                  <span className="text-xs font-bold">{eligibility.salesCount} Record(s)</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    eligibility.purchasesCount > 0
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <span className="text-[10px] block font-medium">Purchase Bills</span>
                  <span className="text-xs font-bold">{eligibility.purchasesCount} Record(s)</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    eligibility.transactionsCount > 0 || eligibility.transfersCount > 0
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <span className="text-[10px] block font-medium">Stock Movements</span>
                  <span className="text-xs font-bold">
                    {eligibility.transactionsCount + eligibility.transfersCount} Record(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Reasons List */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
              <span className="font-semibold text-slate-700 block">Specific Reasons:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                {eligibility.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            {/* Recommended Action: Archive / Deactivate */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <Archive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Safe Alternative: Deactivate / Archive Product</span>
                <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                  Clicking <strong>"Archive & Deactivate Product"</strong> will immediately remove this
                  product from active sales orders and POS billing, while 100% preserving all historical
                  tax invoices, purchase bills, and general ledger reports.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Case B: Integrity Check Passed — Product can be safely deleted */}
        {!isChecking && eligibility && eligibility.canDelete && (
          <div className="space-y-3.5">
            {/* Integrity Passed Card */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-xs text-emerald-900 block">
                  Integrity Verification Passed: Zero References Found
                </span>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  This product has zero stock balance and has never been referenced in sales invoices,
                  purchase bills, stock transfers, or accounting transactions. It is safe to permanently delete.
                </p>
              </div>
            </div>

            {/* Warning Confirmation */}
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Are you sure you want to permanently delete this product?</span>
                <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                  Product <strong>"{product.name}"</strong> (SKU: <strong>{product.sku}</strong>) will be
                  permanently removed from the product catalog. This action cannot be reversed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
