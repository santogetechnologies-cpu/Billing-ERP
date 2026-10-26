import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  Users,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  ScanBarcode,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { canAccessRoute } from '../../utils/rbac';
import { formatCurrency } from '../../utils/formatters';
import { sortProductsAZ } from '../../utils/sortUtils';
import { ModalCloseButton } from './ModalCloseButton';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { products, customers, suppliers, salesInvoices, purchaseInvoices, expenses, payments } = useERP();

  // Shared close handler that resets state and closes modal
  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isOpen]);

  // Search Results across all entities
  const results = React.useMemo(() => {
    if (!query.trim()) {
      const defaultQuickActions: Array<{
        type: string;
        title: string;
        subtitle: string;
        link: string;
        icon: any;
        badge?: string;
      }> = [
        { type: 'Quick Action', title: 'Create New Sales Invoice', subtitle: 'Fast billing & tax invoice', link: '/sales/new', icon: FileText },
        { type: 'Quick Action', title: 'Open POS Fast Billing Counter', subtitle: 'Touch & barcode counter', link: '/sales/pos', icon: ScanBarcode },
        { type: 'Quick Action', title: 'Add New Product Master', subtitle: 'Pricing, SKU & inventory', link: '/products/new', icon: Package },
        { type: 'Quick Action', title: 'Add New Customer', subtitle: 'Credit terms & profile', link: '/customers', icon: Users },
        { type: 'Quick Action', title: 'View General Ledger', subtitle: 'Accounting debits & credits', link: '/accounting/ledger', icon: Receipt },
        { type: 'Quick Action', title: 'Barcode Label Designer', subtitle: 'Generate & print labels', link: '/barcode', icon: ScanBarcode }
      ];
      return defaultQuickActions.filter(item => canAccessRoute(profile?.role, item.link));
    }

    const q = query.toLowerCase();
    const items: Array<{
      type: string;
      title: string;
      subtitle: string;
      link: string;
      icon: any;
      badge?: string;
    }> = [];

    // 1. Products (sorted A-Z)
    if (canAccessRoute(profile?.role, '/products')) {
      const matchedProducts = products.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q)
      );
      sortProductsAZ(matchedProducts).forEach(p => {
        items.push({
          type: 'Product',
          title: p.name,
          subtitle: `SKU: ${p.sku} | Barcode: ${p.barcode} | Stock: ${p.currentStock} ${p.primaryUnit}`,
          link: '/products',
          icon: Package,
          badge: formatCurrency(p.sellingPrice)
        });
      });
    }

    // 2. Customers
    if (canAccessRoute(profile?.role, '/customers')) {
      customers.forEach(c => {
        if (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'Customer',
            title: c.name,
            subtitle: `Phone: ${c.phone} | Outstanding: ${formatCurrency(c.currentOutstanding)} | ${c.type}`,
            link: `/customers/${c.id}`,
            icon: Users,
            badge: c.type
          });
        }
      });
    }

    // 3. Suppliers
    if (canAccessRoute(profile?.role, '/suppliers')) {
      suppliers.forEach(s => {
        if (
          s.name.toLowerCase().includes(q) ||
          s.company.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.gstin.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'Supplier',
            title: s.company,
            subtitle: `Contact: ${s.name} | Phone: ${s.phone} | Payable: ${formatCurrency(s.currentOutstanding)}`,
            link: `/suppliers/${s.id}`,
            icon: Building2,
            badge: 'Supplier'
          });
        }
      });
    }

    // 4. Sales Invoices
    if (canAccessRoute(profile?.role, '/sales')) {
      salesInvoices.forEach(inv => {
        if (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          String(inv.grandTotal).includes(q)
        ) {
          items.push({
            type: 'Invoice',
            title: `${inv.invoiceNumber} — ${inv.customerName}`,
            subtitle: `Date: ${inv.date} | Total: ${formatCurrency(inv.grandTotal)} | Status: ${inv.paymentStatus}`,
            link: '/sales',
            icon: FileText,
            badge: inv.paymentStatus
          });
        }
      });
    }

    // 5. Purchases
    if (canAccessRoute(profile?.role, '/purchases')) {
      purchaseInvoices.forEach(pur => {
        if (
          pur.invoiceNumber.toLowerCase().includes(q) ||
          pur.supplierName.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'Purchase',
            title: `${pur.invoiceNumber} — ${pur.supplierName}`,
            subtitle: `Date: ${pur.date} | Total: ${formatCurrency(pur.grandTotal)}`,
            link: '/purchases',
            icon: Receipt,
            badge: 'Purchase'
          });
        }
      });
    }

    // 6. Payments
    if (canAccessRoute(profile?.role, '/payments')) {
      payments.forEach(pay => {
        if (
          pay.paymentNumber.toLowerCase().includes(q) ||
          pay.partyName.toLowerCase().includes(q) ||
          pay.reference.toLowerCase().includes(q)
        ) {
          items.push({
            type: 'Payment',
            title: `${pay.paymentNumber} — ${pay.partyName}`,
            subtitle: `${pay.type}: ${formatCurrency(pay.amount)} via ${pay.paymentMethod}`,
            link: '/payments',
            icon: CreditCard,
            badge: pay.type
          });
        }
      });
    }

    return items.slice(0, 10);
  }, [query, products, customers, suppliers, salesInvoices, purchaseInvoices, payments, profile?.role]);

  const handleSelect = (item: (typeof results)[0]) => {
    navigate(item.link);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />

      <div className="relative mx-auto max-w-2xl transform divide-y divide-slate-100/80 overflow-hidden rounded-xl glass-modal ring-1 ring-black/5 transition-all">
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, invoices, SKU, barcodes... (Type to search)"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none pr-2"
          />
          <ModalCloseButton onClose={handleClose} className="ml-2" />
        </div>

        {/* Search Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <p>No results found for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by product name, SKU, customer or invoice number</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {item.type}
                          </span>
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.badge && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              Use <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-[10px]">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-[10px]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-[10px]">↵</kbd> to select
            </span>
          </div>
          <span className="flex items-center gap-1 font-medium text-blue-600">
            <Sparkles className="w-3.5 h-3.5" /> Universal ERP Search
          </span>
        </div>
      </div>
    </div>
  );
};
