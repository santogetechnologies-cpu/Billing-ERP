import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  Package,
  Users,
  BadgePercent,
  BookOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Truck,
  QrCode,
  Store,
  Wallet
} from 'lucide-react';

import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { canRoleAccessNavItem } from '../../utils/rbac';
import { UserProfileModal } from '../auth/UserProfileModal';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export interface UniversalNavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: 'brand' | 'warning' | 'danger' | 'neutral';
  matchExact?: boolean;
  section: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) => {
  const { company, heldInvoices, notifications, inboundOrders } = useERP();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    onCloseMobile();
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const heldBillsCount = heldInvoices?.length || 0;
  const unreadAlertsCount = notifications?.filter(n => !n.read)?.length || 0;
  const pendingOrdersCount = inboundOrders?.filter(o => o.status === 'Pending Confirmation' || o.status === 'Confirmed')?.length || 0;

  // Complete Navigation Items grouped into 4 distinct functional sections
  const allNavItems: UniversalNavItem[] = [
    // Section 1: Billing & Dispatch
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      matchExact: true,
      section: 'Billing & Dispatch'
    },
    {
      id: 'pos',
      name: 'Billing (POS)',
      path: '/sales/pos',
      icon: Zap,
      badge: heldBillsCount > 0 ? heldBillsCount : undefined,
      badgeColor: 'brand',
      section: 'Billing & Dispatch'
    },
    {
      id: 'sales',
      name: 'Sales',
      path: '/sales',
      icon: ShoppingCart,
      section: 'Billing & Dispatch'
    },
    {
      id: 'delivery_hub',
      name: 'Delivery Hub',
      path: '/sales/hub',
      icon: Truck,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'warning',
      section: 'Billing & Dispatch'
    },

    // Section 2: Stock & Inventory
    {
      id: 'products',
      name: 'Products',
      path: '/products',
      icon: Package,
      section: 'Inventory & Supply'
    },
    {
      id: 'stock',
      name: 'Stock',
      path: '/inventory',
      icon: Boxes,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      badgeColor: 'warning',
      section: 'Inventory & Supply'
    },
    {
      id: 'purchases',
      name: 'Purchases',
      path: '/purchases',
      icon: ShoppingBag,
      section: 'Inventory & Supply'
    },
    {
      id: 'barcode',
      name: 'Labels & Barcodes',
      path: '/barcode',
      icon: QrCode,
      section: 'Inventory & Supply'
    },

    // Section 3: Finance & People
    {
      id: 'accounts',
      name: 'Accounts',
      path: '/accounting',
      icon: BookOpen,
      section: 'Finance & Team'
    },
    {
      id: 'payroll',
      name: 'HR & Payroll',
      path: '/payroll',
      icon: Wallet,
      section: 'Finance & Team'
    },
    {
      id: 'parties',
      name: 'Parties',
      path: '/customers',
      icon: Users,
      section: 'Finance & Team'
    },
    {
      id: 'pricing',
      name: 'Pricing & Commission',
      path: '/pricing',
      icon: BadgePercent,
      section: 'Finance & Team'
    },

    // Section 4: Channels & Intelligence
    {
      id: 'storefront',
      name: 'Storefront',
      path: '/storefront',
      icon: Store,
      section: 'Channels & Reports'
    },
    {
      id: 'reports',
      name: 'Reports',
      path: '/reports',
      icon: BarChart3,
      section: 'Channels & Reports'
    }
  ];

  // RBAC Filtering: Only render items permitted for logged-in role
  const permittedNavItems = allNavItems.filter(item =>
    canRoleAccessNavItem(profile?.role, item.name)
  );

  const canAccessSettings = canRoleAccessNavItem(profile?.role, 'Settings');

  // Exact mutually-exclusive active matching logic
  const isItemActive = (item: UniversalNavItem): boolean => {
    const cur = location.pathname.replace(/\/+$/, '') || '/';
    const tgt = item.path.replace(/\/+$/, '') || '/';

    if (item.id === 'dashboard') {
      return cur === '/' || cur === '/dashboard' || cur === '/warehouse/dashboard' || cur === '/sales/dashboard' || cur === '/purchases/dashboard';
    }

    if (item.id === 'pos') {
      return cur === '/sales/pos' || cur.startsWith('/sales/pos/');
    }

    if (item.id === 'sales') {
      if (cur.startsWith('/sales/pos') || cur.startsWith('/sales/hub') || cur === '/salesperson-hub') return false;
      return cur === '/sales' || cur.startsWith('/sales/');
    }

    if (item.id === 'delivery_hub') {
      return cur === '/sales/hub' || cur.startsWith('/sales/hub') || cur === '/salesperson-hub';
    }

    if (item.id === 'payroll') {
      return cur === '/payroll' || cur.startsWith('/payroll') || cur === '/hr' || cur.startsWith('/hr/');
    }

    if (item.id === 'storefront') {
      return cur === '/storefront' || cur === '/catalog' || cur === '/customer-portal';
    }

    if (item.id === 'barcode') {
      return cur === '/barcode' || cur.startsWith('/barcode');
    }

    if (item.id === 'purchases') {
      return cur === '/purchases' || cur.startsWith('/purchases/');
    }

    if (item.id === 'stock') {
      return cur === '/inventory' || cur.startsWith('/inventory/') || cur === '/stock' || cur.startsWith('/stock/');
    }

    if (item.id === 'products') {
      return cur === '/products' || cur.startsWith('/products/') || cur === '/units';
    }

    if (item.id === 'parties') {
      return cur === '/customers' || cur.startsWith('/customers/') || cur === '/suppliers' || cur.startsWith('/suppliers/') || cur === '/parties';
    }

    if (item.id === 'pricing') {
      return cur === '/pricing' || cur.startsWith('/pricing/');
    }

    if (item.id === 'accounts') {
      return (
        cur === '/accounting' ||
        cur.startsWith('/accounting/') ||
        cur === '/payments' ||
        cur.startsWith('/payments/') ||
        cur === '/expenses' ||
        cur.startsWith('/expenses/') ||
        cur === '/cash-bank' ||
        cur.startsWith('/cash-bank/') ||
        cur === '/receivables' ||
        cur === '/payables'
      );
    }

    if (item.id === 'reports') {
      return cur === '/reports' || cur.startsWith('/reports/');
    }

    return cur === tgt || cur.startsWith(`${tgt}/`);
  };

  const isSettingsActive =
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/users') ||
    location.pathname.startsWith('/audit-log') ||
    location.pathname.startsWith('/taxes');

  // Group permitted items by section
  const sections = Array.from(new Set(permittedNavItems.map(i => i.section)));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 select-none ${
          isCollapsed ? 'w-16' : 'w-60'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Store Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Building2 className="w-4.5 h-4.5 text-white" />
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-xs text-white truncate leading-tight">
                  {company.name || 'Universal ERP'}
                </h1>
                <p className="text-[10px] text-slate-400 truncate">
                  {company.businessType || 'Retail & Distribution'}
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Items List with Compact Height to prevent vertical scrolling */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 no-scrollbar">
          {sections.map(sectionName => {
            const sectionItems = permittedNavItems.filter(i => i.section === sectionName);
            if (sectionItems.length === 0) return null;

            return (
              <div key={sectionName} className="space-y-0.5">
                {!isCollapsed && (
                  <p className="px-2 pb-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    {sectionName}
                  </p>
                )}
                {sectionItems.map(item => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      title={isCollapsed ? item.name : undefined}
                      className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="flex-1 truncate tracking-tight text-[11px]">{item.name}</span>
                      )}

                      {!isCollapsed && item.badge !== undefined && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            active
                              ? 'bg-white text-blue-700'
                              : item.badgeColor === 'brand'
                              ? 'bg-blue-500/20 text-blue-300'
                              : item.badgeColor === 'warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Pinned Bottom Area: Settings & User Profile */}
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/40 space-y-1 shrink-0">
          {/* Pinned Settings Item */}
          {canAccessSettings && (
            <NavLink
              to="/settings"
              title={isCollapsed ? 'Settings' : undefined}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSettingsActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${
                  isSettingsActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!isCollapsed && <span className="flex-1 truncate text-[11px]">Settings</span>}
            </NavLink>
          )}

          {/* User Account / Session */}
          <div
            className={`flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 text-slate-300 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="View profile"
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white truncate leading-tight">{profile?.fullName || 'User'}</p>
                  <p className="text-[9px] text-slate-400 truncate leading-none mt-0.5">{profile?.role || 'Staff'}</p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      )}
    </>
  );
};
