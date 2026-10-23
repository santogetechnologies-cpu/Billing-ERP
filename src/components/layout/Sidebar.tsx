import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  Building2,
  Receipt,
  CreditCard,
  BookOpen,
  BarChart3,
  ScanBarcode,
  Percent,
  ShieldCheck,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  UserCheck,
  LogOut,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  ClipboardList,
  Activity,
  Truck,
  DollarSign
} from 'lucide-react';

import { useERP } from '../../context/ERPContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  canAccessRoute,
  canRoleAccessNavItem,
  canRoleAccessSubItem,
  getRoleDefaultRoute,
  canAccessHeaderProfile
} from '../../utils/rbac';
import { UserProfileModal } from '../auth/UserProfileModal';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  children?: { name: string; path: string; icon?: any; end?: boolean }[];
  action?: 'profile' | 'logout';
  end?: boolean;
}

/**
 * Evaluates whether a navigation item is genuinely active based on the current URL path.
 * Guarantees mutually exclusive matching without overlapping sibling active states
 * (e.g. /sales/dashboard vs /sales vs /sales/pos vs /sales/returns).
 */
export function isNavItemActive(
  item: { path: string; name?: string; action?: string; end?: boolean },
  currentPath: string,
  isSalespersonRole: boolean = false
): boolean {
  if (!item || item.action) return false;

  const current = (currentPath || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const target = (item.path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  const isCurrentDashboard =
    current === '/' ||
    current === '/dashboard' ||
    current === '/warehouse/dashboard' ||
    current === '/purchases/dashboard';
  const isTargetDashboard =
    target === '/' ||
    target === '/dashboard' ||
    target === '/warehouse/dashboard' ||
    target === '/purchases/dashboard';

  // 1. Root Dashboard (Admin / Owner / Warehouse Manager / Staff): exact match only
  if (isTargetDashboard) {
    return isCurrentDashboard;
  }

  // When current route is Dashboard, NO other menu or submenu item can ever be active
  if (isCurrentDashboard) {
    return false;
  }

  // 2. Salesperson Dashboard: exact match only
  if (target === '/sales/dashboard') {
    return current === '/sales/dashboard';
  }

  // 3. Fast Billing / Point of Sale (POS): active on /sales/pos or /sales/pos/*
  if (target === '/sales/pos') {
    return current === '/sales/pos' || current.startsWith('/sales/pos/');
  }

  // 4. Sales Returns: active on /sales/returns or /sales/returns/*
  if (target === '/sales/returns') {
    return current === '/sales/returns' || current.startsWith('/sales/returns/');
  }

  // 5. New Invoice: active on /sales/new or /sales/new/*
  if (target === '/sales/new') {
    return current === '/sales/new' || current.startsWith('/sales/new/');
  }

  // 6. Sales Documents: active on /sales/documents or /sales/documents/*
  if (target === '/sales/documents') {
    return current === '/sales/documents' || current.startsWith('/sales/documents/');
  }

  // 7. Sales Invoices (/sales):
  // Must NOT match sibling sales items (/sales/dashboard, /sales/pos, /sales/returns)
  if (target === '/sales') {
    if (
      current === '/sales/dashboard' ||
      current.startsWith('/sales/dashboard/') ||
      current === '/sales/pos' ||
      current.startsWith('/sales/pos/') ||
      current === '/sales/returns' ||
      current.startsWith('/sales/returns/')
    ) {
      return false;
    }

    if (isSalespersonRole) {
      // In Salesperson sidebar, /sales, /sales/invoices, /sales/new, /sales/documents,
      // and any /sales/:id belong to Sales Invoices (since Salesperson has no separate submenu)
      return (
        current === '/sales' ||
        current === '/sales/invoices' ||
        current.startsWith('/sales/')
      );
    }

    // In Admin / Owner sidebar, submenus are distinct
    return current === '/sales' || current === '/sales/invoices';
  }

  // 8. Strict exact matching for all items with end: true
  // Guarantees Stock Overview (/inventory), Low Stock & Reorder (/inventory/alerts),
  // Purchase Requests, and other exact submenus highlight ONLY on their own route.
  if (item.end) {
    if (target === '/inventory/alerts') {
      return current === '/inventory/alerts' || current === '/inventory/reorder';
    }
    if (target === '/inventory/valuation' || target === '/inventory/total-cost') {
      return current === '/inventory/valuation' || current === '/inventory/total-cost';
    }
    if (target === '/purchases/barcode-management') {
      return (
        current === '/purchases/barcode-management' ||
        current === '/purchases/barcode-override'
      );
    }
    if (target === '/purchases') {
      return current === '/purchases' || current === '/purchases/invoices';
    }
    return current === target;
  }

  // 9. Products (/products)
  if (target === '/products') {
    if (
      current.startsWith('/units') ||
      current.startsWith('/pricing') ||
      current === '/products/new'
    ) {
      return false;
    }
    return current === '/products' || current.startsWith('/products/');
  }

  // 10. Customers (/customers): active on /customers and nested profile /customers/:id
  if (target === '/customers') {
    return current === '/customers' || current.startsWith('/customers/');
  }

  // 11. Suppliers (/suppliers): active on /suppliers and nested profile /suppliers/:id
  if (target === '/suppliers') {
    return current === '/suppliers' || current.startsWith('/suppliers/');
  }

  // 12. Purchases (/purchases)
  if (target === '/purchases') {
    if (
      current === '/purchases/new' ||
      current.startsWith('/purchases/new/') ||
      current === '/purchases/returns' ||
      current.startsWith('/purchases/returns/') ||
      current.startsWith('/purchases/requests') ||
      current.startsWith('/purchases/orders') ||
      current.startsWith('/purchases/barcode') ||
      current.startsWith('/purchases/dashboard')
    ) {
      return false;
    }
    return current === '/purchases' || current === '/purchases/invoices';
  }

  // 13. Inventory (/inventory)
  if (target === '/inventory') {
    if (
      current.startsWith('/inventory/warehouses') ||
      current.startsWith('/inventory/transfers') ||
      current.startsWith('/inventory/adjustments') ||
      current.startsWith('/inventory/batches') ||
      current.startsWith('/inventory/serials') ||
      current.startsWith('/inventory/valuation') ||
      current.startsWith('/inventory/total-cost') ||
      current.startsWith('/inventory/alerts') ||
      current.startsWith('/inventory/reorder') ||
      current.startsWith('/inventory/purchase-requests')
    ) {
      return false;
    }
    return current === '/inventory';
  }

  // 14. Accounting (/accounting)
  if (target === '/accounting') {
    if (
      current.startsWith('/accounting/ledger') ||
      current.startsWith('/accounting/trial-balance') ||
      current.startsWith('/accounting/profit-loss') ||
      current.startsWith('/accounting/balance-sheet') ||
      current.startsWith('/accounting/cash-flow')
    ) {
      return false;
    }
    return current === '/accounting';
  }

  // 15. Payments (/payments)
  if (target === '/payments') {
    if (current.startsWith('/cash-bank')) return false;
    return current === '/payments';
  }

  // Default prefix match for nested routes
  if (current === target) return true;
  return current.startsWith(`${target}/`);
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) => {
  const { company } = useERP();
  const { preset } = useTheme();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuSearch, setMenuSearch] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const isSalesperson = profile?.role === 'Salesperson';
  const isWarehouseManager = profile?.role === 'Warehouse Manager';
  const hasSidebarProfile = !canAccessHeaderProfile(profile?.role);

  useEffect(() => {
    if (location.pathname !== '/inventory/adjustments') {
      try {
        sessionStorage.setItem('ub_originating_route', location.pathname + location.search);
      } catch {}
    }
  }, [location.pathname, location.search]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Sales: true,
    Inventory: true,
    Accounting: false,
    Products: false
  });

  const toggleSubmenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: profile?.role === 'Warehouse Manager'
        ? '/warehouse/dashboard'
        : profile?.role === 'Salesperson'
        ? '/sales/dashboard'
        : profile?.role === 'Cashier'
        ? '/sales/pos'
        : profile?.role === 'Purchase Manager'
        ? '/purchases/dashboard'
        : '/',
      icon: LayoutDashboard,
      end: true
    },
    {
      name: 'Sales',
      path: '/sales',
      icon: ShoppingCart,
      children: [
        { name: 'Sales Invoices', path: '/sales', end: true },
        { name: 'Fast Billing / POS', path: '/sales/pos', icon: Zap, end: true },
        { name: 'New Invoice', path: '/sales/new', end: true },
        { name: 'Sales Documents', path: '/sales/documents', end: true },
        { name: 'Sales Returns', path: '/sales/returns', icon: RotateCcw, end: true }
      ]
    },
    {
      name: 'Purchases',
      path: '/purchases',
      icon: ShoppingBag,
      children: [
        { name: 'Purchase Invoices', path: '/purchases', end: true },
        { name: 'Purchase Requests', path: '/purchases/requests', icon: ClipboardList, end: true },
        { name: 'Purchase Orders', path: '/purchases/orders', icon: Truck, end: true },
        { name: 'New Purchase Bill', path: '/purchases/new', end: true },
        { name: 'Purchase Returns', path: '/purchases/returns', end: true }
      ]
    },
    {
      name: 'Products',
      path: '/products',
      icon: Package,
      children: [
        { name: 'Product Master', path: '/products', end: true },
        { name: 'Add Product', path: '/products/new', end: true },
        { name: 'Unit Management', path: '/units', end: true },
        { name: 'Pricing & Discounts', path: '/pricing', end: true }
      ]
    },
    {
      name: 'Inventory',
      path: '/inventory',
      icon: Boxes,
      children: profile?.role === 'Purchase Manager'
        ? [
            { name: 'Stock Overview', path: '/inventory', end: true },
            { name: 'Total Product Cost', path: '/inventory/total-cost', icon: DollarSign, end: true }
          ]
        : [
            { name: 'Stock Overview', path: '/inventory', end: true },
            { name: 'Low Stock & Reorder', path: '/inventory/alerts', icon: AlertTriangle, end: true },
            { name: 'Purchase Requests', path: '/inventory/purchase-requests', icon: ClipboardList, end: true },
            { name: 'Stock Transfers', path: '/inventory/transfers', end: true },
            { name: 'Stock Adjustments', path: '/inventory/adjustments', end: true },
            { name: 'Batch Tracking', path: '/inventory/batches', end: true },
            { name: 'Serial Numbers', path: '/inventory/serials', end: true },
            { name: 'Stock Valuation', path: '/inventory/valuation', end: true }
          ]
    },
    {
      name: 'Warehouses / Godowns',
      path: '/inventory/warehouses',
      icon: WarehouseIcon,
      end: true
    },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Suppliers', path: '/suppliers', icon: Building2 },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    {
      name: 'Payments',
      path: '/payments',
      icon: CreditCard,
      children: [
        { name: 'Payment Center', path: '/payments', end: true },
        { name: 'Cash & Bank A/C', path: '/cash-bank', end: true }
      ]
    },
    {
      name: 'Accounting',
      path: '/accounting',
      icon: BookOpen,
      children: [
        { name: 'Chart of Accounts', path: '/accounting', end: true },
        { name: 'General Ledger', path: '/accounting/ledger', end: true },
        { name: 'Trial Balance', path: '/accounting/trial-balance', end: true },
        { name: 'Profit & Loss', path: '/accounting/profit-loss', end: true },
        { name: 'Balance Sheet', path: '/accounting/balance-sheet', end: true },
        { name: 'Cash Flow', path: '/accounting/cash-flow', end: true }
      ]
    },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Barcode Management', path: '/barcode', icon: ScanBarcode },
    { name: 'Taxes & GST', path: '/taxes', icon: Percent },
    { name: 'Users & Roles', path: '/users', icon: ShieldCheck },
    { name: 'User Activity', path: '/users/activity', icon: Activity, end: true },
    { name: 'Audit Log', path: '/audit-log', icon: FileSpreadsheet },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];


  // RBAC Filter: Only show items and sub-items permitted for the active user role
  const rolePermittedNavItems = navItems
    .map(item => {
      // 1. Check if the parent menu itself is permitted for this role
      if (!canRoleAccessNavItem(profile?.role, item.name)) {
        return null;
      }

      if (item.children && item.children.length > 0) {
        const allowedChildren = item.children.filter(child =>
          canAccessRoute(profile?.role, child.path) &&
          canRoleAccessSubItem(profile?.role, item.name, child.name, child.path)
        );

        // Hide unauthorized parent menus entirely when all their child items are inaccessible
        if (allowedChildren.length > 0) {
          return {
            ...item,
            children: allowedChildren
          };
        }
        return null;
      }

      // Standalone parent item without children
      if (canAccessRoute(profile?.role, item.path)) {
        return item;
      }
      return null;
    })
    .filter((item): item is NavItem => item !== null);

  // Dedicated Sales Person Navigation strictly 4 items: Dashboard, Sales, Customers, My Profile
  const salespersonNavItems: NavItem[] = [
    { name: 'Dashboard', path: '/sales/dashboard', icon: LayoutDashboard, end: true },
    { name: 'Sales', path: '/sales', icon: ShoppingCart },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'My Profile', path: '#profile', icon: UserCheck, action: 'profile' }
  ];

  const candidateNavItems = isSalesperson
    ? salespersonNavItems
    : hasSidebarProfile
    ? [
        ...rolePermittedNavItems,
        { name: 'My Profile', path: '#profile', icon: UserCheck, action: 'profile' as const }
      ]
    : rolePermittedNavItems;

  const filteredNavItems = candidateNavItems.filter(item => {
    if (!menuSearch) return true;
    const matchName = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    const matchChild = item.children?.some(c =>
      c.name.toLowerCase().includes(menuSearch.toLowerCase())
    );
    return matchName || matchChild;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          backgroundColor: preset?.sidebarBg || 'var(--sidebar-background, #0B172E)',
          borderColor: preset?.sidebarBorder || 'var(--sidebar-border, rgba(255, 255, 255, 0.12))',
          overscrollBehavior: 'contain',
          overflowX: 'hidden'
        }}
        className={`fixed top-0 bottom-0 left-0 z-40 glass-sidebar shadow-2xl transition-colors duration-200 flex flex-col text-white overscroll-contain overflow-x-hidden h-screen max-h-screen ${
          isCollapsed ? 'w-18' : 'w-56'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div
          style={{
            backgroundColor: preset?.sidebarHeader || 'var(--sidebar-header, #081020)',
            borderColor: preset?.sidebarBorder || 'var(--sidebar-border, rgba(255, 255, 255, 0.12))'
          }}
          className={`h-16 flex items-center border-b shrink-0 ${
            isCollapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-2'
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div
                  className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-black text-lg shadow-md shadow-black/20 shrink-0 transition-transform hover:scale-105"
                  style={{ color: preset?.primary || 'var(--primary-accent, #1760F5)' }}
                >
                  U
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-white truncate leading-tight tracking-tight">
                    Universal ERP
                  </h1>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {company.name ? company.name.split(' ')[0] : 'Universal'} Hub
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-lg shadow-md shadow-black/20 hover:brightness-105 transition-all cursor-pointer group relative"
              style={{ color: preset?.primary || 'var(--primary-accent, #1760F5)' }}
              title="Click to Expand Sidebar"
            >
              <span className="group-hover:hidden font-black">U</span>
              <SlidersHorizontal className="w-4 h-4 hidden group-hover:block" />
            </button>
          )}
        </div>

        {/* Sidebar Menu Quick Search */}
        {!isCollapsed && (
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              borderColor: preset?.sidebarBorder || 'var(--sidebar-border, rgba(255, 255, 255, 0.12))'
            }}
            className="pt-3 pb-3 pl-3 pr-2 border-b shrink-0"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder="Filter menu..."
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF'
                }}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 text-white placeholder:text-slate-400 transition-colors backdrop-blur-xs"
              />
              {menuSearch && (
                <button
                  type="button"
                  onClick={() => setMenuSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Links List */}
        <div
          style={{ overscrollBehavior: 'contain', overflowX: 'hidden' }}
          className="sidebar-nav-scroll flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pl-2 pr-1 py-3 space-y-1 min-h-0"
        >
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isChildActive =
              hasChildren &&
              item.children?.some(c =>
                isNavItemActive(c, location.pathname, isSalesperson)
              );
            const isDirectActive = isNavItemActive(item, location.pathname, isSalesperson);
            const isMenuExpanded = expandedMenus[item.name] || Boolean(menuSearch);

            return (
              <div key={item.name} className="relative group">
                {hasChildren ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleSubmenu(item.name)}
                      style={
                        isChildActive
                          ? {
                              backgroundColor: preset?.sidebarActive || 'var(--sidebar-active, #173570)',
                              borderColor: preset?.sidebarActiveBorder || 'var(--sidebar-active-border, rgba(96, 165, 250, 0.50))',
                              color: '#FFFFFF'
                            }
                          : undefined
                      }
                      className={`w-full flex items-center ${
                        isCollapsed ? 'justify-center px-0 h-10' : 'justify-between pl-3 pr-2 py-2'
                      } text-xs font-medium rounded-lg transition-all ${
                        isChildActive
                          ? 'text-white font-semibold shadow-xs border'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isChildActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </div>
                      {!isCollapsed && (
                        <span className={`transition-colors ${isChildActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                          {isMenuExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </button>

                    {/* Submenu */}
                    {!isCollapsed && isMenuExpanded && (
                      <div className="pl-6 pr-1 py-1 space-y-0.5 ml-3 border-l border-white/15 animate-fadeIn">
                        {item.children?.map(sub => {
                          const isSubActive = isNavItemActive(sub, location.pathname, isSalesperson);

                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              state={{ from: location.pathname + location.search }}
                              end={sub.end || sub.path === '/' || sub.path === '/sales/dashboard'}
                              onClick={onCloseMobile}
                              style={
                                isSubActive
                                  ? {
                                      backgroundColor: preset?.sidebarActive || 'var(--sidebar-active, #173570)',
                                      borderLeftColor: preset?.primary || 'var(--primary-accent, #1760F5)',
                                      color: '#FFFFFF'
                                    }
                                  : undefined
                              }
                              className={() =>
                                `flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md font-medium transition-all ${
                                  isSubActive
                                    ? 'text-white font-semibold shadow-xs border-l-2'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                                }`
                              }
                            >
                              {sub.icon && <sub.icon className={`w-3.5 h-3.5 ${isSubActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />}
                              <span>{sub.name}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : item.action ? (
                  (() => {
                    const isActionActive =
                      item.action === 'profile' &&
                      (isProfileModalOpen ||
                        location.pathname === '/profile' ||
                        location.hash === '#profile');

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          onCloseMobile();
                          if (item.action === 'profile') {
                            setIsProfileModalOpen(true);
                          } else if (item.action === 'logout') {
                            handleLogout();
                          }
                        }}
                        style={
                          isActionActive
                            ? {
                                backgroundColor: preset?.sidebarActive || 'var(--sidebar-active, #173570)',
                                borderColor: preset?.sidebarActiveBorder || 'var(--sidebar-active-border, rgba(96, 165, 250, 0.50))',
                                color: '#FFFFFF'
                              }
                            : undefined
                        }
                        className={`w-full flex items-center ${
                          isCollapsed ? 'justify-center px-0 h-10' : 'justify-between pl-3 pr-2 py-2'
                        } text-xs font-medium rounded-lg transition-all ${
                          item.action === 'logout'
                            ? 'text-rose-300 hover:bg-rose-500/20 hover:text-rose-100'
                            : isActionActive
                            ? 'text-white font-semibold shadow-xs border ring-1 ring-white/10'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white'
                        } cursor-pointer`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              item.action === 'logout'
                                ? 'text-rose-400 group-hover:text-rose-200'
                                : isActionActive
                                ? 'text-white'
                                : 'text-slate-300 group-hover:text-white'
                            }`}
                          />
                          {!isCollapsed && <span className="truncate">{item.name}</span>}
                        </div>
                      </button>
                    );
                  })()
                ) : (
                  <NavLink
                    to={item.path}
                    end={item.end || item.path === '/' || item.path === '/sales/dashboard'}
                    onClick={onCloseMobile}
                    style={
                      isDirectActive
                        ? {
                            backgroundColor: preset?.sidebarActive || 'var(--sidebar-active, #173570)',
                            borderColor: preset?.sidebarActiveBorder || 'var(--sidebar-active-border, rgba(96, 165, 250, 0.50))',
                            color: '#FFFFFF'
                          }
                        : undefined
                    }
                    className={() =>
                      `flex items-center ${
                        isCollapsed ? 'justify-center px-0 h-10' : 'justify-between pl-3 pr-2 py-2'
                      } text-xs font-medium rounded-lg transition-all ${
                        isDirectActive
                          ? 'text-white font-semibold shadow-sm border ring-1 ring-white/10'
                          : 'text-slate-200 hover:bg-white/10 hover:text-white'
                      }`
                    }
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${isDirectActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span
                        style={{
                          backgroundColor: preset?.sidebarBadgeBg || 'var(--sidebar-badge-bg, rgba(23, 96, 245, 0.35))'
                        }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white border border-white/20"
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info & Fast POS banner (conditional by RBAC, hidden for salesperson as it's item 2) */}
        {canAccessRoute(profile?.role, '/sales/pos') && !isSalesperson && (
          <div
            style={{
              backgroundColor: preset?.sidebarHeader || 'var(--sidebar-header, #081020)',
              borderColor: preset?.sidebarBorder || 'var(--sidebar-border, rgba(255, 255, 255, 0.12))'
            }}
            className={`border-t shrink-0 ${isCollapsed ? 'p-2 flex justify-center' : 'pt-3 pb-3 pl-3 pr-2'}`}
          >
            {isCollapsed ? (
              <NavLink
                to="/sales/pos"
                style={{
                  backgroundColor: preset?.primary || 'var(--primary-accent, #1760F5)',
                  boxShadow: `0 4px 12px ${preset?.ring || 'rgba(23, 96, 245, 0.35)'}`
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-white shadow-md hover:brightness-110 hover:scale-105 transition-all group relative cursor-pointer"
                title="Fast Billing / POS (F2)"
              >
                <Zap className="w-4 h-4 text-amber-300" />
              </NavLink>
            ) : (
              <NavLink
                to="/sales/pos"
                style={{
                  backgroundColor: preset?.primary || 'var(--primary-accent, #1760F5)',
                  boxShadow: `0 4px 14px ${preset?.ring || 'rgba(23, 96, 245, 0.35)'}`
                }}
                className="flex items-center justify-between py-2.5 pl-2.5 pr-2 rounded-lg text-white text-xs font-semibold shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span className="font-semibold text-white">Fast Billing / POS</span>
                </div>
                <span className="text-[10px] bg-black/20 text-white px-1.5 py-0.5 rounded font-bold border border-white/25">
                  F2
                </span>
              </NavLink>
            )}
          </div>
        )}
      </aside>

      {/* User Profile Details Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
