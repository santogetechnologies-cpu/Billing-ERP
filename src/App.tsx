import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ERPProvider } from './context/ERPContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { InactivityWarningModal } from './components/auth/InactivityWarningModal';
import { canManageBarcodeOverride, canManageCompanySettings, canAccessUserActivity } from './utils/rbac';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// Dashboard
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Sales
import { SalesInvoicesPage } from './pages/sales/SalesInvoicesPage';
import { NewInvoicePage } from './pages/sales/NewInvoicePage';
import { FastPOSPage } from './pages/sales/FastPOSPage';
import { SalesDocumentsPage } from './pages/sales/SalesDocumentsPage';
import { SalesReturnsPage } from './pages/sales/SalesReturnsPage';
import { SalespersonDashboardPage } from './pages/sales/SalespersonDashboardPage';

// Purchases
import { PurchaseManagerDashboardPage } from './pages/purchases/PurchaseManagerDashboardPage';
import { PurchaseInvoicesPage } from './pages/purchases/PurchaseInvoicesPage';
import { PurchaseRequestsPage } from './pages/purchases/PurchaseRequestsPage';
import { PurchaseOrdersPage } from './pages/purchases/PurchaseOrdersPage';
import { NewPurchaseInvoicePage } from './pages/purchases/NewPurchaseInvoicePage';
import { PurchaseReturnsPage } from './pages/purchases/PurchaseReturnsPage';
import { BarcodeOverridePage } from './pages/purchases/BarcodeOverridePage';

// Products
import { ProductListPage } from './pages/products/ProductListPage';
import { NewProductPage } from './pages/products/NewProductPage';
import { UnitsPage } from './pages/products/UnitsPage';
import { PricingRulesPage } from './pages/products/PricingRulesPage';

// Inventory
import { InventoryDashboardPage } from './pages/inventory/InventoryDashboardPage';
import { WarehouseManagerDashboardPage } from './pages/warehouse/WarehouseManagerDashboardPage';
import { StockAlertsPage } from './pages/inventory/StockAlertsPage';
import { WarehousesPage } from './pages/inventory/WarehousesPage';
import { StockTransfersPage } from './pages/inventory/StockTransfersPage';
import { BatchManagementPage } from './pages/inventory/BatchManagementPage';
import { SerialNumbersPage } from './pages/inventory/SerialNumbersPage';
import { StockValuationPage } from './pages/inventory/StockValuationPage';

// Customers & Suppliers
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerProfilePage } from './pages/customers/CustomerProfilePage';
import { SuppliersPage } from './pages/suppliers/SuppliersPage';
import { SupplierProfilePage } from './pages/suppliers/SupplierProfilePage';

// Expenses
import { ExpensesPage } from './pages/expenses/ExpensesPage';

// Payments & Banking
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { CashBankPage } from './pages/payments/CashBankPage';
import { ReceivablesPage } from './pages/payments/ReceivablesPage';
import { PayablesPage } from './pages/payments/PayablesPage';

// Accounting
import { ChartOfAccountsPage } from './pages/accounting/ChartOfAccountsPage';
import { GeneralLedgerPage } from './pages/accounting/GeneralLedgerPage';
import { TrialBalancePage } from './pages/accounting/TrialBalancePage';
import { ProfitLossPage } from './pages/accounting/ProfitLossPage';
import { BalanceSheetPage } from './pages/accounting/BalanceSheetPage';
import { CashFlowPage } from './pages/accounting/CashFlowPage';

// Taxes & Reports
import { TaxesPage } from './pages/taxes/TaxesPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { BarcodePage } from './pages/barcode/BarcodePage';

// Administration
import { UsersRolesPage } from './pages/users/UsersRolesPage';
import { UserActivityMonitoringPage } from './pages/users/UserActivityMonitoringPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ThemeProvider } from './context/ThemeContext';

function InactivityWatcher() {
  const { user, inactivityWarningActive, inactivitySecondsRemaining, resetInactivityTimer, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user || !inactivityWarningActive) return null;

  return (
    <InactivityWarningModal
      isOpen={inactivityWarningActive}
      remainingSeconds={inactivitySecondsRemaining}
      onStayLoggedIn={resetInactivityTimer}
      onLogout={async () => {
        await signOut();
        navigate('/login', { replace: true });
      }}
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InactivityWatcher />
        <ERPProvider>
          <ThemeProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Protected ERP App Routes */}
              <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard */}
              <Route
                index
                element={
                  <ProtectedRoute requiredModule="dashboard">
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="warehouse/dashboard"
                element={
                  <ProtectedRoute requiredModule="dashboard">
                    <WarehouseManagerDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Sales */}
              <Route
                path="sales/dashboard"
                element={
                  <ProtectedRoute requiredModule="dashboard">
                    <SalespersonDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sales"
                element={
                  <ProtectedRoute requiredModule="sales">
                    <SalesInvoicesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="sales/invoices" element={<Navigate to="/sales" replace />} />
              <Route
                path="sales/pos"
                element={
                  <ProtectedRoute requiredModule="pos">
                    <FastPOSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sales/new"
                element={
                  <ProtectedRoute requiredModule="sales" requiredAction="create">
                    <NewInvoicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sales/documents"
                element={
                  <ProtectedRoute requiredModule="sales">
                    <SalesDocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sales/returns"
                element={
                  <ProtectedRoute requiredModule="sales">
                    <SalesReturnsPage />
                  </ProtectedRoute>
                }
              />

              {/* Purchases */}
              <Route
                path="purchases/dashboard"
                element={
                  <ProtectedRoute requiredModule="dashboard">
                    <PurchaseManagerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases"
                element={
                  <ProtectedRoute requiredModule="purchases">
                    <PurchaseInvoicesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="purchases/invoices" element={<Navigate to="/purchases" replace />} />
              <Route
                path="purchases/requests"
                element={
                  <ProtectedRoute requiredModule="purchases">
                    <PurchaseRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/requests/:id"
                element={
                  <ProtectedRoute requiredModule="purchases">
                    <PurchaseRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/orders"
                element={
                  <ProtectedRoute requiredModule="purchases">
                    <PurchaseOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/new"
                element={
                  <ProtectedRoute requiredModule="purchases" requiredAction="create">
                    <NewPurchaseInvoicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/returns"
                element={
                  <ProtectedRoute requiredModule="purchases">
                    <PurchaseReturnsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/barcode-management"
                element={
                  <ProtectedRoute
                    requiredModule="purchases"
                    requiredAction="edit"
                    customValidator={canManageBarcodeOverride}
                  >
                    <BarcodeOverridePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="purchases/barcode-override"
                element={
                  <ProtectedRoute
                    requiredModule="purchases"
                    requiredAction="edit"
                    customValidator={canManageBarcodeOverride}
                  >
                    <BarcodeOverridePage />
                  </ProtectedRoute>
                }
              />

              {/* Products */}
              <Route
                path="products"
                element={
                  <ProtectedRoute requiredModule="products">
                    <ProductListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="products/new"
                element={
                  <ProtectedRoute requiredModule="products" requiredAction="create">
                    <NewProductPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="products/edit/:id"
                element={
                  <ProtectedRoute requiredModule="products" requiredAction="edit">
                    <NewProductPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="units"
                element={
                  <ProtectedRoute requiredModule="products" requiredAction="manage">
                    <UnitsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="pricing"
                element={
                  <ProtectedRoute requiredModule="products" requiredAction="manage">
                    <PricingRulesPage />
                  </ProtectedRoute>
                }
              />

              {/* Inventory */}
              <Route
                path="inventory"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <InventoryDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/alerts"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <StockAlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/reorder"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <StockAlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/purchase-requests"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <PurchaseRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/purchase-requests/:id"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <PurchaseRequestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/warehouses"
                element={
                  <ProtectedRoute requiredModule="inventory" requiredAction="manage">
                    <WarehousesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/transfers"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <StockTransfersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/adjustments"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <InventoryDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/batches"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <BatchManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/serials"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <SerialNumbersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/valuation"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <StockValuationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory/total-cost"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <StockValuationPage />
                  </ProtectedRoute>
                }
              />

              {/* Customers & Suppliers */}
              <Route
                path="customers"
                element={
                  <ProtectedRoute requiredModule="customers">
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers/:id"
                element={
                  <ProtectedRoute requiredModule="customers">
                    <CustomerProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="suppliers"
                element={
                  <ProtectedRoute requiredModule="suppliers">
                    <SuppliersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="suppliers/:id"
                element={
                  <ProtectedRoute requiredModule="suppliers">
                    <SupplierProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Expenses */}
              <Route
                path="expenses"
                element={
                  <ProtectedRoute requiredModule="expenses">
                    <ExpensesPage />
                  </ProtectedRoute>
                }
              />

              {/* Payments & Banking */}
              <Route
                path="payments"
                element={
                  <ProtectedRoute requiredModule="payments">
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cash-bank"
                element={
                  <ProtectedRoute requiredModule="payments">
                    <CashBankPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="receivables"
                element={
                  <ProtectedRoute requiredModule="payments">
                    <ReceivablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payables"
                element={
                  <ProtectedRoute requiredModule="payments">
                    <PayablesPage />
                  </ProtectedRoute>
                }
              />

              {/* Accounting */}
              <Route
                path="accounting"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <ChartOfAccountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="accounting/ledger"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <GeneralLedgerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="accounting/trial-balance"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <TrialBalancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="accounting/profit-loss"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <ProfitLossPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="accounting/balance-sheet"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <BalanceSheetPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="accounting/cash-flow"
                element={
                  <ProtectedRoute requiredModule="accounting">
                    <CashFlowPage />
                  </ProtectedRoute>
                }
              />

              {/* Taxes, Barcode & Reports */}
              <Route
                path="taxes"
                element={
                  <ProtectedRoute requiredModule="taxes">
                    <TaxesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute requiredModule="reports">
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="barcode"
                element={
                  <ProtectedRoute requiredModule="barcode">
                    <BarcodePage />
                  </ProtectedRoute>
                }
              />

              {/* Users, Audit & Settings */}
              <Route
                path="users"
                element={
                  <ProtectedRoute
                    requiredModule="users"
                    requiredAction="manage"
                    customValidator={canManageCompanySettings}
                  >
                    <UsersRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/activity"
                element={
                  <ProtectedRoute
                    requiredModule="users"
                    requiredAction="manage"
                    customValidator={canAccessUserActivity}
                  >
                    <UserActivityMonitoringPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="audit-log"
                element={
                  <ProtectedRoute requiredModule="audit">
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute requiredModule="settings" requiredAction="view">
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </ERPProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
