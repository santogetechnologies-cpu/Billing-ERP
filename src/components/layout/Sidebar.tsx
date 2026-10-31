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
  UserCheck
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) => {
  const { company, heldInvoices, notifications } = useERP();
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

  // The 10 Universal Main Navigation Items (Part C)
  const universalNavItems: UniversalNavItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      matchExact: true
    },
    {
      id: 'pos',
      name: 'Billing (POS)',
      path: '/sales/pos',
      icon: Zap,
      badge: heldBillsCount > 0 ? heldBillsCount : undefined,
      badgeColor: 'brand'
    },
    {
      id: 'sales',
      name: 'Sales',
      path: '/sales',
      icon: ShoppingCart
    },
    {
      id: 'purchases',
      name: 'Purchases',
      path: '/purchases',
      icon: ShoppingBag
    },
    {
      id: 'stock',
      name: 'Stock',
      path: '/inventory',
      icon: Boxes,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      badgeColor: 'warning'
    },
    {
      id: 'products',
      name: 'Products',
      path: '/products',
      icon: Package
    },
    {
      id: 'parties',
      name: 'Parties',
      path: '/customers',
      icon: Users
    },
    {
      id: 'pricing',
      name: 'Pricing & Commission',
      path: '/pricing',
      icon: BadgePercent
    },
    {
      id: 'accounts',
      name: 'Accounts',
      path: '/accounting',
      icon: BookOpen
    },
    {
      id: 'reports',
      name: 'Reports',
      path: '/reports',
      icon: BarChart3
    }
  ];

  // RBAC Filtering: Only render items permitted for logged-in role
  const permittedNavItems = universalNavItems.filter(item =>
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
      if (cur.startsWith('/sales/pos')) return false;
      return cur === '/sales' || cur.startsWith('/sales/');
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
          isCollapsed ? 'w-18' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand / Store Header */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              {company.logo ? (
                <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Building2 className="w-5 h-5 text-white" />
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-sm text-white truncate leading-tight">
                  {company.name || 'Universal ERP'}
                </h1>
                <p className="text-[11px] text-slate-400 truncate">
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
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Universal 10 Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 no-scrollbar">
          {permittedNavItems.map(item => {
            const active = isItemActive(item);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!isCollapsed && (
                  <span className="flex-1 truncate tracking-tight">{item.name}</span>
                )}

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
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

        {/* Pinned Bottom Area: Settings & User Profile */}
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/30 space-y-1 shrink-0">
          {/* Pinned Settings Item (Part C) */}
          {canAccessSettings && (
            <NavLink
              to="/settings"
              title={isCollapsed ? 'Settings' : undefined}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isSettingsActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Settings
                className={`w-5 h-5 shrink-0 ${
                  isSettingsActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!isCollapsed && <span className="flex-1 truncate">Settings</span>}
            </NavLink>
          )}

          {/* User Account / Session */}
          <div
            className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="View profile"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{profile?.fullName || 'User'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{profile?.role || 'Staff'}</p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
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
