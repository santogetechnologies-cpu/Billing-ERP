import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CompanyProfile,
  Product,
  Customer,
  Supplier,
  Unit,
  UnitConversion,
  SalesInvoice,
  PurchaseInvoice,
  Expense,
  PaymentRecord,
  InventoryTransaction,
  Warehouse,
  StockBalance,
  StockTransfer,
  Batch,
  SerialNumber,
  Account,
  BankAccount,
  CashAccount,
  SystemUser,
  AuditLog,
  NotificationItem,
  HeldInvoice,
  Permission,
  AccountStatus,
  PresenceStatus,
  PurchaseRequest,
  CreatePurchaseRequestInput,
  PurchaseRequestStatus,
  PaymentMethod,
  CustomerReturn,
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput
} from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { presenceService } from '../services/presenceService';

import { companyService } from '../services/companyService';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import { supplierService } from '../services/supplierService';
import { salesService } from '../services/salesService';
import { purchaseService } from '../services/purchaseService';
import { purchaseRequestService } from '../services/purchaseRequestService';
import { inventoryService } from '../services/inventoryService';
import { customerReturnService } from '../services/customerReturnService';
import { categoryService } from '../services/categoryService';
import { expenseService } from '../services/expenseService';
import { paymentService } from '../services/paymentService';
import { accountingService } from '../services/accountingService';
import { userService } from '../services/userService';
import { auditService } from '../services/auditService';
import { notificationService, sortNotifications } from '../services/notificationService';
import { barcodeService } from '../services/barcodeService';
import { stockAlertService } from '../services/stockAlertService';
import { customerSupportService } from '../services/customerSupportService';
import { normalizeUnitKey } from '../data/unitsData';
import { validateStockAvailability, StockValidationResult, isBatchExpired } from '../utils/inventoryUtils';
import { sortProductsAZ } from '../utils/sortUtils';


const getSavedInitialTheme = (): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('universal_billing_theme_active') || 'blue';
    }
  } catch {}
  return 'blue';
};

const initialCompanyProfile: CompanyProfile = {
  name: '',
  logo: '',
  businessType: 'Trading',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  phone: '',
  email: '',
  website: '',
  gstin: '',
  pan: '',
  taxRegistration: '',
  currency: 'INR',
  currencySymbol: '₹',
  financialYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  invoicePrefix: 'INV-',
  invoiceStartingNumber: 1,
  bankName: '',
  accountName: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  termsAndConditions: '1. Payment due within invoice credit days.\n2. Goods once accepted cannot be returned without prior authorization.',
  primaryColor: getSavedInitialTheme()
};

export interface ERPContextType {
  company: CompanyProfile;
  updateCompany: (profile: Partial<CompanyProfile>) => Promise<void>;
  isSetupComplete: boolean;
  setSetupComplete: (val: boolean) => void;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  generateSKU: (category: string, productName: string) => string;
  generateBarcode: (sku: string) => string;
  customCategories: string[];
  addCustomCategory: (name: string) => Promise<string>;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchased' | 'totalPaid'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchases' | 'totalPaid'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Sales
  salesInvoices: SalesInvoice[];
  createSalesInvoice: (invoice: Omit<SalesInvoice, 'id' | 'createdAt'>) => Promise<SalesInvoice>;
  processSalesReturn: (originalInvoiceId: string, returnedItems: { productId: string; qty: number; returnAmt: number }[], notes: string) => Promise<void>;

  // POS Hold / Resume
  heldInvoices: HeldInvoice[];
  holdInvoice: (invoice: HeldInvoice) => void;
  resumeInvoice: (id: string) => HeldInvoice | undefined;
  removeHeldInvoice: (id: string) => void;

  // Purchases
  purchaseInvoices: PurchaseInvoice[];
  createPurchaseInvoice: (invoice: Omit<PurchaseInvoice, 'id' | 'createdAt'>) => Promise<PurchaseInvoice>;
  processPurchaseReturn: (
    originalPurchaseId: string,
    returnedItems: { productId: string; qty: number; returnAmt: number; productName?: string; unit?: string; rate?: number }[],
    notes: string,
    supplierId?: string,
    supplierName?: string
  ) => Promise<PurchaseInvoice>;
  recordPurchasePayment: (params: {
    purchaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    date?: string;
    reference?: string;
    notes?: string;
    account?: string;
  }) => Promise<{ payment: PaymentRecord; updatedPurchase: PurchaseInvoice }>;

  // Expenses
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;

  // Payments
  payments: PaymentRecord[];
  recordPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'paymentNumber'> & { paymentNumber?: string }) => Promise<PaymentRecord>;

  // Inventory & Multi-Warehouse
  inventoryTransactions: InventoryTransaction[];
  warehouses: Warehouse[];
  stockBalances: StockBalance[];
  stockTransfers: StockTransfer[];
  addWarehouse: (wh: Omit<Warehouse, 'id'>) => Promise<Warehouse>;
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => Promise<Warehouse>;
  deleteWarehouse: (id: string) => Promise<boolean>;
  toggleWarehouseStatus: (id: string, isActive: boolean) => Promise<void>;
  createStockTransfer: (transfer: Omit<StockTransfer, 'id' | 'createdAt'>) => Promise<StockTransfer>;
  updateTransferStatus: (id: string, status: StockTransfer['status'], actorName?: string) => Promise<void>;
  adjustStock: (productId: string, adjustmentQty: number, reason: string, warehouse: string) => Promise<void>;
  getWarehouseStock: (warehouseIdOrCode: string | undefined, productId: string) => number;
  getProductStockByWarehouse: (productId: string) => Record<string, number>;
  validateSaleStock: (warehouseId: string, items: { productId: string; qty: number; unit?: string; productName?: string }[]) => StockValidationResult;
  refreshStockBalances: () => Promise<void>;
  batches: Batch[];
  addBatch: (batch: Omit<Batch, 'id'>) => Promise<Batch>;
  serialNumbers: SerialNumber[];
  addSerialNumber: (serial: Omit<SerialNumber, 'id'>) => Promise<SerialNumber>;

  // Units & Conversions
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id'>) => Promise<Unit>;
  updateUnit: (id: string, updates: Partial<Omit<Unit, 'id'>>) => Promise<Unit>;
  deleteUnit: (id: string) => Promise<boolean>;
  checkUnitUsage: (unit: Unit) => Promise<{ inUse: boolean; reasons: string[] }>;
  conversions: UnitConversion[];
  addConversion: (conv: Omit<UnitConversion, 'id'>) => Promise<UnitConversion>;
  updateConversion: (id: string, conv: Partial<UnitConversion>) => Promise<boolean>;
  deleteConversion: (id: string) => Promise<boolean>;

  // Financial & Accounting
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => Promise<Account>;
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];

  // Users & Permissions
  users: SystemUser[];
  addUser: (user: Omit<SystemUser, 'id'>, password?: string) => Promise<SystemUser>;
  updateUser: (id: string, updates: Partial<SystemUser>) => Promise<SystemUser>;
  deleteUser: (id: string) => Promise<boolean>;
  toggleAccountStatus: (id: string, newStatus: AccountStatus) => Promise<SystemUser>;
  refreshUsers: () => Promise<void>;
  permissions: Permission[];
  updatePermission: (module: string, field: keyof Permission, val: boolean) => void;

  // Purchase Requests Workflow
  purchaseRequests: PurchaseRequest[];
  refreshPurchaseRequests: () => Promise<void>;
  createPurchaseRequest: (input: CreatePurchaseRequestInput) => Promise<PurchaseRequest>;
  updatePurchaseRequest: (requestId: string, input: Partial<CreatePurchaseRequestInput>) => Promise<PurchaseRequest>;
  updatePurchaseRequestStatus: (params: {
    requestId: string;
    status: PurchaseRequestStatus;
    comments?: string;
    rejectionReason?: string;
    clarificationNotes?: string;
    cancellationReason?: string;
    adjustedItems?: { itemId: string; approvedQty: number; adjustmentReason?: string }[];
  }) => Promise<PurchaseRequest>;
  cancelPurchaseRequest: (requestId: string, cancellationReason: string) => Promise<PurchaseRequest>;
  deletePurchaseRequest: (requestId: string) => Promise<boolean>;
  createPurchaseOrderFromRequest: (params: {
    requestId: string;
    supplierId: string;
    supplierName: string;
    supplierGstin?: string;
    orderDate?: string;
    expectedDelivery?: string;
    notes?: string;
    items: Array<{
      productId: string;
      productName: string;
      qty: number;
      rate: number;
      taxRate: number;
      unit: string;
    }>;
  }) => Promise<{ purchaseOrderId: string; purchaseOrderNumber: string; request: PurchaseRequest }>;
  recordGoodsReceipt: (params: {
    requestId: string;
    receivedItems: Array<{
      itemId: string;
      productId: string;
      receivedQty: number;
    }>;
    receivingWarehouseId: string;
    invoiceNumber?: string;
  }) => Promise<PurchaseRequest>;

  // Customer Returns Workflow
  customerReturns: CustomerReturn[];
  refreshCustomerReturns: () => Promise<void>;
  addCustomerReturn: (input: CreateCustomerReturnInput) => Promise<CustomerReturn>;
  updateCustomerReturn: (returnId: string, input: UpdateCustomerReturnInput) => Promise<CustomerReturn>;
  approveCustomerReturn: (returnId: string, reviewerId?: string, reviewerName?: string) => Promise<CustomerReturn>;
  rejectCustomerReturn: (returnId: string, reason: string, reviewerId?: string, reviewerName?: string) => Promise<CustomerReturn>;
  restockCustomerReturn: (returnId: string, warehouseId?: string, restockedById?: string, restockedByName?: string) => Promise<{ returnRecord: CustomerReturn; restocked: boolean; message: string }>;
  refundCustomerReturn: (returnId: string, refundMethod: string, refundAmount?: number, refundedById?: string, refundedByName?: string) => Promise<CustomerReturn>;

  // System
  auditLogs: AuditLog[];
  addAuditLog: (action: string, module: string, record: string, oldValue: string, newValue: string) => Promise<void>;
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  checkStockAlerts: (customProducts?: Product[]) => Promise<void>;
  selectedWarehouse: string;
  setSelectedWarehouse: (w: string) => void;
  resetAllToDemoData: () => Promise<void>;
  seedDemoBusiness: () => Promise<void>;
  clearAllMockData: () => Promise<void>;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, companyId } = useAuth();
  const [company, setCompany] = useState<CompanyProfile>(initialCompanyProfile);
  const [isSetupComplete, setSetupComplete] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active company ID resolver: uses loaded company id, user auth companyId, or fallback
  const activeCompanyId = company.id || companyId || '00000000-0000-0000-0000-000000000001';

  // Core Entity States - Strictly empty on initialization; populated live from Supabase PostgreSQL
  const [products, setProducts] = useState<Product[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [customerReturns, setCustomerReturns] = useState<CustomerReturn[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // ID-based deduplication helper to ensure state integrity across refreshes and mutations
  const dedupeById = <T extends { id?: string }>(items: T[]): T[] => {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.filter(item => {
      if (!item || !item.id) return true;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  // Evaluate stock alert thresholds across products and update notifications on state transitions
  const checkStockAlerts = useCallback(async (prodsToCheck?: Product[]) => {
    const list = prodsToCheck || products;
    const targetCompId = company.id || companyId || activeCompanyId;
    if (!list || list.length === 0 || !targetCompId) return;

    const currentRole = profile?.role || (user as any)?.role;

    try {
      const newAlerts = await stockAlertService.checkProductsStockAlerts(
        list,
        targetCompId,
        warehouses,
        stockBalances,
        users,
        user?.id,
        currentRole
      );
      if (newAlerts && newAlerts.length > 0) {
        setNotifications(prev => sortNotifications(dedupeById([...newAlerts, ...prev])));
      }

      // Check Batch Expiry & EOD Expiry Reminder for Warehouse Manager
      if (batches && batches.length > 0 && currentRole === 'Warehouse Manager' && user?.id) {
        const [expiryAlerts, eodAlerts] = await Promise.all([
          stockAlertService.checkBatchExpiryAlerts({
            batches,
            companyId: targetCompId,
            warehouses,
            users,
            existingNotifications: notifications,
            createNotification: async notif => notificationService.createNotification(notif, targetCompId)
          }),
          stockAlertService.checkEndOfDayExpiryReminder({
            batches,
            companyId: targetCompId,
            company,
            warehouses,
            users,
            currentUserId: user?.id,
            currentUserRole: currentRole,
            existingNotifications: notifications,
            createNotification: async notif => notificationService.createNotification(notif, targetCompId)
          })
        ]);
        const allNewBatchAlerts = [...(expiryAlerts || []), ...(eodAlerts || [])].filter(
          item => item.userId === user?.id
        );
        if (allNewBatchAlerts.length > 0) {
          setNotifications(prev => sortNotifications(dedupeById([...allNewBatchAlerts, ...prev])));
        }
      }
    } catch (err) {
      console.warn('Stock alert evaluation note:', err);
    }
  }, [products, batches, warehouses, stockBalances, users, user?.id, profile?.role, (user as any)?.role, company.id, companyId, activeCompanyId, notifications]);

  const loadRequestIdRef = useRef<number>(0);

  // Load all live data from Supabase for the active authenticated company
  const loadAllData = useCallback(async (targetCompanyId?: string) => {
    const reqId = ++loadRequestIdRef.current;
    const targetCompId = targetCompanyId || companyId || '00000000-0000-0000-0000-000000000001';
    if (!targetCompId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [
        companyData,
        productsData,
        customersData,
        suppliersData,
        salesData,
        purchasesData,
        expensesData,
        paymentsData,
        stockTxnsData,
        warehousesData,
        stockBalancesData,
        transfersData,
        batchesData,
        serialsData,
        unitsData,
        conversionsData,
        accountsData,
        banksData,
        cashData,
        usersData,
        permsData,
        auditData,
        notifData,
        requestsData,
        categoriesData,
        customerReturnsData
      ] = await Promise.all([
        companyService.getCompany(targetCompId),
        productService.getProducts(undefined, targetCompId),
        customerService.getCustomers(undefined, targetCompId),
        supplierService.getSuppliers(undefined, targetCompId),
        salesService.getSalesInvoices(undefined, targetCompId),
        purchaseService.getPurchaseInvoices(undefined, targetCompId),
        expenseService.getExpenses(undefined, targetCompId),
        paymentService.getPayments(undefined, targetCompId),
        inventoryService.getStockTransactions(targetCompId),
        companyService.getWarehouses(targetCompId),
        inventoryService.getStockBalances(targetCompId),
        inventoryService.getStockTransfers(targetCompId),
        productService.getBatches(targetCompId),
        productService.getSerialNumbers(targetCompId),
        productService.getUnits(targetCompId),
        productService.getConversions(targetCompId),
        accountingService.getAccounts(targetCompId),
        paymentService.getBankAccounts(targetCompId),
        paymentService.getCashAccounts(targetCompId),
        userService.getUsers(targetCompId),
        userService.getPermissions(),
        auditService.getAuditLogs(targetCompId),
        notificationService.getNotifications(targetCompId, user?.id, profile?.role || (user as any)?.role),
        purchaseRequestService.getPurchaseRequests(undefined, targetCompId, profile?.role || (user as any)?.role, user?.id),
        categoryService.getCustomCategories(targetCompId),
        customerReturnService.getCustomerReturns(targetCompId)
      ]);

      // Verify request is still current before updating in-memory state
      if (reqId !== loadRequestIdRef.current) {
        return;
      }

      if (companyData) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const localTheme = localStorage.getItem('universal_billing_theme_active');
            if (localTheme && (!companyData.primaryColor || companyData.primaryColor === 'blue')) {
              companyData.primaryColor = localTheme;
            }
          }
        } catch {}
        setCompany(companyData);
      }
      setProducts(sortProductsAZ(dedupeById(productsData || [])));
      setCustomCategories(categoriesData || []);
      setCustomers(dedupeById(customersData || []));
      setSuppliers(dedupeById(suppliersData || []));
      setSalesInvoices(dedupeById(salesData || []));
      setPurchaseInvoices(dedupeById(purchasesData || []));
      setPurchaseRequests(dedupeById(requestsData || []));
      setCustomerReturns(dedupeById(customerReturnsData || []));
      setExpenses(dedupeById(expensesData || []));
      setPayments(dedupeById(paymentsData || []));
      setInventoryTransactions(dedupeById(stockTxnsData || []));
      setStockBalances(stockBalancesData || []);
      if (warehousesData && warehousesData.length > 0) {
        setWarehouses(dedupeById(warehousesData));
        const def = warehousesData.find(w => w.isDefault) || warehousesData[0];
        setSelectedWarehouse(def.code);
      } else {
        setWarehouses([]);
      }
      setStockTransfers(dedupeById(transfersData || []));
      setBatches(dedupeById(batchesData || []));
      setSerialNumbers(dedupeById(serialsData || []));
      if (unitsData) {
        const seenUnitKeys = new Set<string>();
        const uniqueUnits = unitsData.filter(u => {
          if (!u) return false;
          const nameKey = normalizeUnitKey(u.name);
          const symbolKey = normalizeUnitKey(u.symbol);
          if ((nameKey && seenUnitKeys.has(nameKey)) || (symbolKey && seenUnitKeys.has(symbolKey))) return false;
          if (nameKey) seenUnitKeys.add(nameKey);
          if (symbolKey) seenUnitKeys.add(symbolKey);
          return true;
        });
        setUnits(uniqueUnits);
      }
      if (conversionsData) setConversions(dedupeById(conversionsData));
      if (accountsData) setAccounts(dedupeById(accountsData));
      if (banksData) setBankAccounts(dedupeById(banksData));
      if (cashData) setCashAccounts(dedupeById(cashData));
      if (usersData) setUsers(dedupeById(usersData));
      if (permsData) setPermissions(permsData);
      if (auditData) setAuditLogs(dedupeById(auditData));
      if (notifData) setNotifications(sortNotifications(dedupeById(notifData)));

      const currentRole = profile?.role || (user as any)?.role;
      if (productsData && productsData.length > 0) {
        try {
          const generatedAlerts = await stockAlertService.checkProductsStockAlerts(
            productsData,
            targetCompId,
            warehousesData || [],
            stockBalancesData || [],
            usersData || [],
            user?.id,
            currentRole
          );
          if (generatedAlerts && generatedAlerts.length > 0) {
            setNotifications(prev => sortNotifications(dedupeById([...generatedAlerts, ...prev])));
          }
        } catch (e) {
          console.warn('Initial stock alert check note:', e);
        }
      }

      // Check Batch Expiry & EOD Expiry Reminder for Warehouse Manager
      if (batchesData && batchesData.length > 0 && currentRole === 'Warehouse Manager' && user?.id) {
        try {
          const [expiryAlerts, eodAlerts] = await Promise.all([
            stockAlertService.checkBatchExpiryAlerts({
              batches: batchesData,
              companyId: targetCompId,
              warehouses: warehousesData || [],
              users: usersData || [],
              existingNotifications: notifData || [],
              createNotification: async notif => notificationService.createNotification(notif, targetCompId)
            }),
            stockAlertService.checkEndOfDayExpiryReminder({
              batches: batchesData,
              companyId: targetCompId,
              company: companyData || company,
              warehouses: warehousesData || [],
              users: usersData || [],
              currentUserId: user?.id,
              currentUserRole: currentRole,
              existingNotifications: notifData || [],
              createNotification: async notif => notificationService.createNotification(notif, targetCompId)
            })
          ]);
          const allNewBatchAlerts = [...(expiryAlerts || []), ...(eodAlerts || [])].filter(
            item => item.userId === user.id
          );
          if (allNewBatchAlerts.length > 0) {
            setNotifications(prev => sortNotifications(dedupeById([...allNewBatchAlerts, ...prev])));
          }
        } catch (e) {
          console.warn('Initial batch expiry check note:', e);
        }
      }

      // Check Customer Follow-up Reminders for Sales Person (Requirement 5)
      if (currentRole === 'Salesperson' && user?.id) {
        try {
          const supportCases = await customerSupportService.getSupportCases(targetCompId, user.id, currentRole);
          if (supportCases && supportCases.length > 0) {
            const followUpAlerts = await customerSupportService.checkPendingFollowups(
              targetCompId,
              supportCases,
              customersData || []
            );
            if (followUpAlerts && followUpAlerts.length > 0) {
              setNotifications(prev => sortNotifications(dedupeById([...followUpAlerts, ...prev])));
            }
          }
        } catch (e) {
          console.warn('Initial customer support follow-up check note:', e);
        }
      }
    } catch (err: any) {
      console.warn('ERP Supabase connection note (using baseline verified state):', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!user) {
      // Invalidate any in-flight requests immediately
      loadRequestIdRef.current++;
      // Clear all in-memory ERP cache when user logs out so no stale data leaks to subsequent sessions
      setCompany(initialCompanyProfile);
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      setSalesInvoices([]);
      setPurchaseInvoices([]);
      setPurchaseRequests([]);
      setExpenses([]);
      setPayments([]);
      setInventoryTransactions([]);
      setWarehouses([]);
      setStockTransfers([]);
      setBatches([]);
      setSerialNumbers([]);
      setUnits([]);
      setConversions([]);
      setAccounts([]);
      setBankAccounts([]);
      setCashAccounts([]);
      setUsers([]);
      setHeldInvoices([]);
      setAuditLogs([]);
      setNotifications([]);
      setSelectedWarehouse('');
      setStockBalances([]);
      setIsLoading(false);
      return;
    }
    loadAllData(companyId);
  }, [user?.id, companyId, loadAllData]);

  const refreshUsers = useCallback(async () => {
    const targetCompId = companyId || company.id || '00000000-0000-0000-0000-000000000001';
    const usersData = await userService.getUsers(targetCompId);
    setUsers(dedupeById(usersData || []));
  }, [companyId]);

  // Realtime Presence updates and periodic 15-second offline timeout recalculator
  useEffect(() => {
    if (!user?.id) return;
    const targetCompId = companyId || company.id || '00000000-0000-0000-0000-000000000001';

    const unsubscribe = presenceService.subscribeToPresenceUpdates(targetCompId, () => {
      refreshUsers();
    });

    const tickInterval = setInterval(() => {
      setUsers(prev => {
        let hasChanged = false;
        const next = prev.map(u => {
          const isOnline = presenceService.isUserOnline(u.lastSeenAt, u.presenceStatus);
          const nextPresence: PresenceStatus = isOnline ? 'Active' : 'Inactive';
          if (nextPresence !== u.presenceStatus) {
            hasChanged = true;
            return { ...u, presenceStatus: nextPresence };
          }
          return u;
        });
        return hasChanged ? next : prev;
      });
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(tickInterval);
    };
  }, [user?.id, companyId, refreshUsers]);

  // Real-time Notification Listener (preserves ordering, handles inserts/updates, prevents duplicates)
  useEffect(() => {
    if (!user?.id) return;
    const targetCompId = company.id || companyId || activeCompanyId;
    const currentRole = profile?.role || (user as any)?.role;

    const unsubscribe = notificationService.subscribeToNotifications(
      targetCompId,
      (newItem) => {
        // Enforce recipient authorization before adding
        if (!notificationService.isAuthorizedRecipient(newItem, user.id, currentRole)) {
          return;
        }

        setNotifications(prev => {
          // Prevent duplicates
          if (prev.some(n => n.id === newItem.id)) {
            return prev;
          }
          // Unread item automatically sorts to top of unread section
          return sortNotifications([newItem, ...prev]);
        });
      },
      (updatedItem) => {
        setNotifications(prev => {
          const exists = prev.some(n => n.id === updatedItem.id);
          if (!exists) return prev;
          const updated = prev.map(n => (n.id === updatedItem.id ? { ...n, ...updatedItem } : n));
          return sortNotifications(updated);
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id, company.id, companyId, activeCompanyId, profile?.role, (user as any)?.role]);

  // Audit Log
  const addAuditLog = async (action: string, module: string, record: string, oldValue: string, newValue: string) => {
    const localLog: AuditLog = {
      id: 'log-' + new Date().toISOString().replace(/\D/g, '').slice(2, 12),
      user: 'Current User',
      action,
      module,
      record,
      oldValue,
      newValue,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setAuditLogs(prev => [localLog, ...prev]);
    await auditService.logAction(action, module, record, oldValue, newValue, activeCompanyId);
  };

  const updateCompany = async (profile: Partial<CompanyProfile>) => {
    const targetCompId = company.id || companyId || '00000000-0000-0000-0000-000000000001';
    setCompany(prev => ({ ...prev, ...profile, id: targetCompId }));
    if (profile.primaryColor) {
      try {
        localStorage.setItem('universal_billing_theme_active', profile.primaryColor);
        if (targetCompId) {
          localStorage.setItem(`universal_billing_theme_${targetCompId}`, profile.primaryColor);
        }
      } catch {}
    }
    await companyService.updateCompany(profile, targetCompId);
    addAuditLog('Updated Profile', 'Settings', 'Company Profile', 'Old Details', profile.name || 'Updated');
  };

  // Concurrency-safe SKU Generator (Prompt #6 - NEVER products.length + 1)
  const generateSKU = (category: string, productName: string): string => {
    const catCode = category ? category.substring(0, 3).toUpperCase() : 'GEN';
    const prodCode = productName ? productName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() : 'PRD';
    const prefix = `${catCode}-${prodCode}`;

    let maxSeq = 0;
    products.forEach(p => {
      const regex = new RegExp(`^${catCode}-${prodCode}-(\\d+)`, 'i');
      const match = (p.sku || '').match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });

    if (maxSeq === 0) {
      products.forEach(p => {
        const match = (p.sku || '').match(/-(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
    }

    const nextNum = String(maxSeq + 1).padStart(5, '0');
    return `${prefix}-${nextNum}`;
  };

  const generateBarcode = (sku: string): string => {
    return barcodeService.generateEAN13(sku);
  };

  // Products
  const addCustomCategory = async (catName: string): Promise<string> => {
    const created = await categoryService.createCategory(catName, activeCompanyId);
    setCustomCategories(prev => {
      if (prev.some(c => c.toLowerCase() === created.toLowerCase())) return prev;
      return [...prev, created];
    });
    return created;
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt'>): Promise<Product> => {
    const newProduct = await productService.createProduct(productData, company.id);
    setProducts(prev => sortProductsAZ([newProduct, ...prev.filter(p => p.id !== newProduct.id)]));

    if (newProduct.openingStock > 0) {
      try {
        const targetWh = warehouses.find(w => w.id === newProduct.warehouse || w.code === newProduct.warehouse) ||
          warehouses.find(w => w.isDefault) || warehouses[0];
        const whId = targetWh ? targetWh.id : newProduct.warehouse;
        if (whId) {
          await inventoryService.updateStockBalance(whId, newProduct.id, newProduct.openingStock, company.id);
          await refreshStockBalances();
        }

        const txns = await inventoryService.getStockTransactions(company.id);
        if (txns && txns.length > 0) {
          setInventoryTransactions(dedupeById(txns));
        }
      } catch (e) {
        console.warn('Failed to refresh stock transactions:', e);
      }
    }

    if (newProduct.secondaryUnit) {
      try {
        const convs = await productService.getConversions(company.id);
        if (convs && convs.length > 0) setConversions(dedupeById(convs));
      } catch (e) {
        console.warn('Failed to refresh conversions:', e);
      }
    }

    try {
      const updatedBatches = await productService.getBatches(company.id);
      if (updatedBatches) setBatches(dedupeById(updatedBatches));
    } catch (e) {
      console.warn('Failed to refresh batches:', e);
    }

    addAuditLog('Created Product', 'Products', newProduct.name, 'None', `SKU: ${newProduct.sku} | Stock: ${newProduct.openingStock}`);
    const nextList = sortProductsAZ([newProduct, ...products.filter(p => p.id !== newProduct.id)]);
    checkStockAlerts(nextList);
    return newProduct;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    await productService.updateProduct(id, updates, company.id);
    let nextList: Product[] = [];
    setProducts(prev => {
      nextList = sortProductsAZ(prev.map(p => {
        if (p.id === id) {
          addAuditLog('Updated Product', 'Products', p.name, `₹${p.sellingPrice}`, `₹${updates.sellingPrice ?? p.sellingPrice}`);
          return { ...p, ...updates };
        }
        return p;
      }));
      return nextList;
    });
    try {
      const updatedBatches = await productService.getBatches(company.id);
      if (updatedBatches) setBatches(dedupeById(updatedBatches));
    } catch (e) {
      console.warn('Failed to refresh batches:', e);
    }

    if (nextList.length > 0) {
      checkStockAlerts(nextList);
    }
  };

  const archiveProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    await productService.archiveProduct(id, company.id);
    if (prod) {
      addAuditLog('Archived Product', 'Products', prod.name, prod.isActive ? 'Active' : 'Inactive', 'Inactive');
    }
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, isActive: false } : p))
    );
  };

  const deleteProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    await productService.deleteProduct(id, company.id);
    if (prod) {
      addAuditLog('Deleted Product', 'Products', prod.name, `Stock: ${prod.currentStock}`, 'Deleted');
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Customers
  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchased' | 'totalPaid'>): Promise<Customer> => {
    const newCustomer = await customerService.createCustomer(customerData, company.id);
    setCustomers(prev => [newCustomer, ...prev.filter(c => c.id !== newCustomer.id)]);
    addAuditLog('Created Customer', 'Customers', newCustomer.name, 'None', `Credit Limit: ₹${newCustomer.creditLimit}`);
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await customerService.updateCustomer(id, updates, company.id);
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === id) {
          addAuditLog('Updated Customer', 'Customers', c.name, 'Updated Info', updates.name || 'Details changed');
          return { ...c, ...updates };
        }
        return c;
      })
    );
  };

  const deleteCustomer = async (id: string) => {
    const target = customers.find(c => c.id === id);
    await customerService.deleteCustomer(id, company.id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    addAuditLog('Deleted Customer', 'Customers', target?.name || id, 'Active', 'Deleted');
  };

  // Suppliers
  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'currentOutstanding' | 'totalPurchases' | 'totalPaid'>): Promise<Supplier> => {
    const newSupplier = await supplierService.createSupplier(supplierData, company.id);
    setSuppliers(prev => [newSupplier, ...prev.filter(s => s.id !== newSupplier.id)]);
    addAuditLog('Created Supplier', 'Suppliers', newSupplier.name, 'None', `Company: ${newSupplier.company}`);
    return newSupplier;
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    await supplierService.updateSupplier(id, updates, company.id);
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSupplier = async (id: string) => {
    await supplierService.deleteSupplier(id, company.id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Fast Billing / POS Hold & Resume
  const holdInvoice = (invoice: HeldInvoice) => {
    setHeldInvoices(prev => [invoice, ...prev.filter(h => h.id !== invoice.id)]);
    addAuditLog('Held POS Invoice', 'Sales', `Customer: ${invoice.customerName}`, 'Active Cart', `Held: ₹${invoice.grandTotal}`);
  };

  const resumeInvoice = (id: string): HeldInvoice | undefined => {
    const found = heldInvoices.find(h => h.id === id);
    if (found) {
      setHeldInvoices(prev => prev.filter(h => h.id !== id));
    }
    return found;
  };

  const removeHeldInvoice = (id: string) => {
    setHeldInvoices(prev => prev.filter(h => h.id !== id));
  };

  const getWarehouseStock = useCallback((warehouseIdOrCode: string | undefined, productId: string): number => {
    if (!productId) return 0;

    const prod = products.find(p => p.id === productId);
    if (!prod) return 0;
    const prodStock = Math.max(0, prod.currentStock !== null && prod.currentStock !== undefined ? Number(prod.currentStock) : 0);

    // Strict protection: If product's overall balance is zero or less, available stock is 0
    if (prodStock <= 0) {
      return 0;
    }

    // Resolve target warehouse: match by ID or Code; if missing/empty, resolve to default active warehouse
    let targetWh: Warehouse | undefined;
    if (warehouseIdOrCode) {
      targetWh = warehouses.find(
        w => w.id === warehouseIdOrCode || w.code.toLowerCase() === warehouseIdOrCode.toLowerCase()
      );
    }

    // If no warehouse specified or specified warehouse wasn't matched, fall back to default or first active warehouse
    if (!targetWh && warehouses.length > 0) {
      targetWh = warehouses.find(w => w.isDefault && (w.isActive ?? true)) ||
                 warehouses.find(w => w.isActive ?? true) ||
                 warehouses[0];
    }

    // If warehouses list hasn't loaded yet from Supabase, fall back safely to overall product stock
    if (!targetWh || warehouses.length === 0) {
      return prodStock;
    }

    const whId = targetWh.id;

    // Check warehouse-specific balance
    const match = stockBalances.find(b => b.warehouseId === whId && b.productId === productId);
    if (match !== undefined) {
      // Warehouse available stock cannot exceed overall product stock, and cannot be negative
      return Math.max(0, Math.min(prodStock, Number(match.quantity) || 0));
    }

    // If no explicit stock balance row exists yet for this warehouse:
    // Default warehouse or single warehouse setup holds the base product stock
    const isDef = targetWh.isDefault || warehouses.length <= 1;
    if (isDef) {
      return prodStock;
    }

    // Secondary warehouse without recorded stock balance has 0 stock
    return 0;
  }, [products, warehouses, stockBalances]);

  const getProductStockByWarehouse = useCallback((productId: string): Record<string, number> => {
    const map: Record<string, number> = {};
    warehouses.forEach(w => {
      map[w.id] = getWarehouseStock(w.id, productId);
    });
    return map;
  }, [warehouses, getWarehouseStock]);

  const validateSaleStock = useCallback((
    warehouseId: string,
    items: { productId: string; qty: number; unit?: string; productName?: string }[]
  ): StockValidationResult => {
    const targetWh = warehouses.find(w => w.id === warehouseId || w.code.toLowerCase() === (warehouseId || '').toLowerCase()) ||
      warehouses.find(w => w.isDefault) || warehouses[0];
    const whId = targetWh ? targetWh.id : warehouseId;

    const requestedByProduct = new Map<string, { qty: number; unit: string; name: string }>();
    for (const item of items) {
      if (!item.productId) continue;
      const prev = requestedByProduct.get(item.productId) || { qty: 0, unit: item.unit || 'Pcs', name: item.productName || '' };
      prev.qty += Number(item.qty) || 0;
      requestedByProduct.set(item.productId, prev);
    }

    for (const [prodId, req] of requestedByProduct.entries()) {
      const availableStock = getWarehouseStock(whId, prodId);
      const prod = products.find(p => p.id === prodId);
      const unit = req.unit || prod?.primaryUnit || 'Pcs';

      // Enforce expiry rules: Expired stock cannot be sold
      const productBatches = batches.filter(b => b.productId === prodId);
      if (productBatches.length > 0 && productBatches.every(b => b.status === 'Expired' || isBatchExpired(b.expiryDate))) {
        return {
          valid: false,
          errorMessage: `Product "${prod?.name || 'Item'}" stock has expired and cannot be sold. Please quarantine or write-off expired batches.`,
          availableStock: 0,
          unit
        };
      }

      const result = validateStockAvailability(availableStock, req.qty, unit);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true, availableStock: 0, unit: '' };
  }, [warehouses, products, getWarehouseStock]);

  // Sales Invoice with Strict Stock Availability Validation
  const createSalesInvoice = async (invoiceData: Omit<SalesInvoice, 'id' | 'createdAt'>): Promise<SalesInvoice> => {
    // 1. Authoritative Pre-validation: verify stock before sending or mutating state
    const affectsStock = invoiceData.docType === 'tax_invoice' || invoiceData.docType === 'delivery_challan' || invoiceData.docType === 'pos_invoice';
    if (affectsStock && invoiceData.items.length > 0) {
      const validation = validateSaleStock(invoiceData.warehouseId, invoiceData.items);
      if (!validation.valid) {
        throw new Error(validation.errorMessage || 'No stock available — This product cannot be billed because no stock is available.');
      }
    }

    const newInvoice = await salesService.createSalesInvoice(invoiceData, company.id);
    setSalesInvoices(prev => [newInvoice, ...prev.filter(inv => inv.id !== newInvoice.id)]);

    // Deduct stock for completed sales in local React state & sync balances
    if (newInvoice.docType === 'tax_invoice' || newInvoice.docType === 'delivery_challan' || newInvoice.docType === 'pos_invoice') {
      let updatedProductsList: Product[] = [];
      setProducts(prevProducts => {
        updatedProductsList = prevProducts.map(prod => {
          const totalSoldQty = newInvoice.items
            .filter(item => item.productId === prod.id)
            .reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
          if (totalSoldQty > 0) {
            const newStock = Math.max(0, prod.currentStock - totalSoldQty);
            return { ...prod, currentStock: newStock };
          }
          return prod;
        });
        return updatedProductsList;
      });
      if (updatedProductsList.length > 0) {
        checkStockAlerts(updatedProductsList);
      }

      // Synchronize refreshed stock balances from server (without duplicate client-side deductions)
      await refreshStockBalances();
    }

    // Update customer outstanding
    if (newInvoice.docType === 'tax_invoice') {
      const unpaidAmount = newInvoice.grandTotal - (newInvoice.paidAmount || 0);
      setCustomers(prevCusts =>
        prevCusts.map(cust => {
          if (cust.id === newInvoice.customerId) {
            const newOutstanding = cust.currentOutstanding + unpaidAmount;
            return {
              ...cust,
              currentOutstanding: newOutstanding,
              totalPurchased: cust.totalPurchased + newInvoice.grandTotal,
              totalPaid: cust.totalPaid + (newInvoice.paidAmount || 0)
            };
          }
          return cust;
        })
      );
    }

    // If paid, create or sync payment record
    if (newInvoice.paidAmount > 0) {
      const pRecord = await paymentService.recordPayment({
        type: 'Received',
        partyType: 'Customer',
        partyId: newInvoice.customerId,
        partyName: newInvoice.customerName,
        amount: newInvoice.paidAmount,
        date: newInvoice.date,
        paymentMethod: newInvoice.paymentMethod || 'Cash',
        account: newInvoice.paymentMethod === 'Cash' ? 'Main Cash Drawer' : 'HDFC Current Account',
        reference: `Inv #${newInvoice.invoiceNumber}`,
        notes: `Payment for Invoice ${newInvoice.invoiceNumber}`,
        invoiceId: newInvoice.id
      }, company.id);
      setPayments(prev => [pRecord, ...prev.filter(p => p.id !== pRecord.id)]);
    }

    addAuditLog('Created Invoice', 'Sales', newInvoice.invoiceNumber, 'New Order', `Total: ₹${newInvoice.grandTotal}`);
    return newInvoice;
  };

  // Sales Returns
  const processSalesReturn = async (originalInvoiceId: string, returnedItems: { productId: string; qty: number; returnAmt: number }[], notes: string) => {
    const returnDoc = await salesService.createSalesReturn(originalInvoiceId, returnedItems, notes, company.id);
    if (returnDoc) {
      setSalesInvoices(prev => [returnDoc, ...prev.filter(inv => inv.id !== returnDoc.id)]);

      // Increase local stock
      let updatedProductsList: Product[] = [];
      setProducts(prev => {
        updatedProductsList = prev.map(p => {
          const item = returnedItems.find(r => r.productId === p.id);
          if (item) {
            return { ...p, currentStock: p.currentStock + item.qty };
          }
          return p;
        });
        return updatedProductsList;
      });
      if (updatedProductsList.length > 0) {
        checkStockAlerts(updatedProductsList);
      }

      // Reduce customer outstanding
      const returnGrandTotal = returnedItems.reduce((acc, item) => acc + item.returnAmt, 0);
      setCustomers(prev =>
        prev.map(c => {
          if (c.id === returnDoc.customerId) {
            return {
              ...c,
              currentOutstanding: Math.max(0, c.currentOutstanding - returnGrandTotal)
            };
          }
          return c;
        })
      );

      addAuditLog('Processed Sales Return', 'Sales', returnDoc.invoiceNumber, 'Return Processed', `Credited: ₹${returnGrandTotal}`);
    }
  };

  // Purchases
  const createPurchaseInvoice = async (purchaseData: Omit<PurchaseInvoice, 'id' | 'createdAt'>): Promise<PurchaseInvoice> => {
    const newPurchase = await purchaseService.createPurchaseInvoice(purchaseData, company.id);
    setPurchaseInvoices(prev => [newPurchase, ...prev.filter(inv => inv.id !== newPurchase.id)]);

    // Increase stock
    if (newPurchase.docType === 'purchase_invoice' || newPurchase.docType === 'purchase_receipt') {
      const targetWh = warehouses.find(w => w.id === newPurchase.warehouse || w.code === newPurchase.warehouse) ||
        warehouses.find(w => w.isDefault) || warehouses[0];
      const whId = targetWh ? targetWh.id : newPurchase.warehouse;

      let updatedProductsList: Product[] = [];
      setProducts(prev => {
        updatedProductsList = prev.map(prod => {
          const item = newPurchase.items.find(i => i.productId === prod.id);
          if (item) {
            return { ...prod, currentStock: prod.currentStock + item.qty };
          }
          return prod;
        });
        return updatedProductsList;
      });
      if (updatedProductsList.length > 0) {
        checkStockAlerts(updatedProductsList);
      }

      // Increase warehouse stock balances and record transactions
      if (whId) {
        for (const item of newPurchase.items) {
          try {
            await inventoryService.recordStockMovement({
              type: 'Purchase',
              productId: item.productId,
              productName: item.productName,
              qty: item.qty,
              unit: item.unit || 'Pcs',
              warehouse: whId,
              referenceDoc: newPurchase.invoiceNumber,
              notes: `Goods received via ${newPurchase.docType}`
            }, company.id);
          } catch (e) {}
        }
        await refreshStockBalances();
      }
    }

    // Update supplier payable
    const unpaidAmt = newPurchase.grandTotal - (newPurchase.paidAmount || 0);
    setSuppliers(prev =>
      prev.map(s => {
        if (s.id === newPurchase.supplierId) {
          return {
            ...s,
            currentOutstanding: s.currentOutstanding + unpaidAmt,
            totalPurchases: s.totalPurchases + newPurchase.grandTotal,
            totalPaid: s.totalPaid + (newPurchase.paidAmount || 0)
          };
        }
        return s;
      })
    );

    addAuditLog('Created Purchase Bill', 'Purchases', newPurchase.invoiceNumber, 'PO Recorded', `Total: ₹${newPurchase.grandTotal}`);
    return newPurchase;
  };

  // Purchase Returns / Debit Note
  const processPurchaseReturn = async (
    originalPurchaseId: string,
    returnedItems: { productId: string; qty: number; returnAmt: number; productName?: string; unit?: string; rate?: number }[],
    notes: string,
    supplierId?: string,
    supplierName?: string
  ): Promise<PurchaseInvoice> => {
    // Resolve supplier if not directly provided
    const origPur = purchaseInvoices.find(p => p.id === originalPurchaseId);
    const resolvedSupplierId = supplierId || origPur?.supplierId || '';
    const resolvedSupplierName = supplierName || origPur?.supplierName || (suppliers.find(s => s.id === resolvedSupplierId)?.name) || 'Supplier Debit Note';

    const retDoc = await purchaseService.processPurchaseReturn(
      originalPurchaseId,
      returnedItems,
      notes,
      company.id,
      resolvedSupplierId,
      resolvedSupplierName
    );
    setPurchaseInvoices(prev => [retDoc, ...prev.filter(inv => inv.id !== retDoc.id)]);

    // Decrease stock for returned goods
    let updatedProductsList: Product[] = [];
    setProducts(prev => {
      updatedProductsList = prev.map(p => {
        const item = returnedItems.find(r => r.productId === p.id);
        if (item) {
          return { ...p, currentStock: p.currentStock - item.qty };
        }
        return p;
      });
      return updatedProductsList;
    });
    if (updatedProductsList.length > 0) {
      checkStockAlerts(updatedProductsList);
    }

    // Update supplier payable (reduce by retDoc.grandTotal which includes tax reversal or debit total)
    const totalReturnAmt = retDoc.grandTotal || returnedItems.reduce((acc, it) => acc + it.returnAmt, 0);
    setSuppliers(prev =>
      prev.map(s => {
        if (s.id === retDoc.supplierId) {
          return {
            ...s,
            currentOutstanding: Math.max(0, s.currentOutstanding - totalReturnAmt)
          };
        }
        return s;
      })
    );

    addAuditLog('Created Debit Note', 'Purchases', retDoc.invoiceNumber, 'Purchase Return', `Debited: ₹${totalReturnAmt}`);
    return retDoc;
  };

  const recordPurchasePayment = async (params: {
    purchaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    date?: string;
    reference?: string;
    notes?: string;
    account?: string;
  }): Promise<{ payment: PaymentRecord; updatedPurchase: PurchaseInvoice }> => {
    const res = await purchaseService.recordPurchasePayment(params, company.id);
    setPurchaseInvoices(prev => prev.map(inv => inv.id === res.updatedPurchase.id ? res.updatedPurchase : inv));
    setPayments(prev => [res.payment, ...prev.filter(p => p.id !== res.payment.id)]);
    if (res.updatedPurchase.supplierId) {
      setSuppliers(prev =>
        prev.map(s => (s.id === res.updatedPurchase.supplierId ? {
          ...s,
          currentOutstanding: Math.max(0, s.currentOutstanding - params.amount),
          totalPaid: s.totalPaid + params.amount
        } : s))
      );
    }
    addAuditLog('Recorded Supplier Payment', 'Purchases', res.updatedPurchase.invoiceNumber, 'Payment Recorded', `₹${params.amount} via ${params.paymentMethod}`);
    return res;
  };

  // Customer Returns Workflow Handlers
  const refreshCustomerReturns = async () => {
    const data = await customerReturnService.getCustomerReturns(company.id);
    setCustomerReturns(data);
  };

  const addCustomerReturn = async (input: CreateCustomerReturnInput) => {
    const newReturn = await customerReturnService.createCustomerReturn(
      {
        ...input,
        createdBy: user?.id,
        createdByName: profile?.full_name || user?.email || 'User'
      },
      company.id
    );
    setCustomerReturns(prev => [newReturn, ...prev.filter(r => r.id !== newReturn.id)]);

    // If directly restocked upon return (Instant Stock Update workflow)
    if (newReturn.returnStatus === 'Stock Restocked' || Boolean(newReturn.restockedAt) || Boolean(input.directRestock)) {
      if (newReturn.condition === 'Resalable') {
        let updatedProductsList: Product[] = [];
        setProducts(prev => {
          updatedProductsList = prev.map(p => {
            if (p.id === newReturn.productId) {
              return { ...p, currentStock: Math.max(0, (p.currentStock || 0) + newReturn.returnedQty) };
            }
            return p;
          });
          return updatedProductsList;
        });
        if (updatedProductsList.length > 0) {
          checkStockAlerts(updatedProductsList);
        }

        const targetWarehouseId = newReturn.warehouseId || warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id;
        if (targetWarehouseId) {
          setStockBalances(prev => {
            const idx = prev.findIndex(b => b.warehouseId === targetWarehouseId && b.productId === newReturn.productId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + newReturn.returnedQty, updatedAt: new Date().toISOString() };
              return copy;
            }
            return [...prev, {
              id: `sb_${Date.now()}`,
              warehouseId: targetWarehouseId,
              productId: newReturn.productId,
              quantity: newReturn.returnedQty,
              updatedAt: new Date().toISOString()
            }];
          });
        }

        addAuditLog(
          'Customer Return Restocked',
          'Inventory',
          newReturn.returnNumber,
          'Restocked',
          `Directly restocked ${newReturn.returnedQty} ${newReturn.unit} ${newReturn.productName} to ${newReturn.warehouseName || 'Godown'}`
        );
      } else {
        addAuditLog(
          'Customer Return Quarantined',
          'Inventory',
          newReturn.returnNumber,
          'Quarantined',
          `Logged ${newReturn.returnedQty} ${newReturn.unit} to quarantine (${newReturn.condition}). Sellable stock preserved.`
        );
      }
    } else {
      addAuditLog(
        'Created Customer Return',
        'Inventory',
        newReturn.returnNumber,
        'Created',
        `Return created for ${newReturn.customerName} - ${newReturn.productName} (${newReturn.returnedQty} ${newReturn.unit})`
      );
    }
    return newReturn;
  };

  const updateCustomerReturn = async (returnId: string, input: UpdateCustomerReturnInput) => {
    const { updatedReturn, auditLogs: changes, productStockDelta, warehouseStockDeltas } =
      await customerReturnService.updateCustomerReturn(
        returnId,
        {
          ...input,
          updatedBy: user?.id,
          updatedByName: profile?.full_name || user?.email || 'Sales Person'
        },
        company.id
      );

    setCustomerReturns(prev => prev.map(r => r.id === updatedReturn.id ? updatedReturn : r));

    // If product master stock changed
    if (productStockDelta !== 0) {
      let updatedProductsList: Product[] = [];
      setProducts(prev => {
        updatedProductsList = prev.map(p => {
          if (p.id === updatedReturn.productId) {
            return { ...p, currentStock: Math.max(0, (p.currentStock || 0) + productStockDelta) };
          }
          return p;
        });
        return updatedProductsList;
      });
      if (updatedProductsList.length > 0) {
        checkStockAlerts(updatedProductsList);
      }
    }

    // If warehouse balances changed
    if (warehouseStockDeltas.length > 0) {
      setStockBalances(prev => {
        let copy = [...prev];
        for (const whDelta of warehouseStockDeltas) {
          const idx = copy.findIndex(b => b.warehouseId === whDelta.warehouseId && b.productId === updatedReturn.productId);
          if (idx >= 0) {
            copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + whDelta.delta, updatedAt: new Date().toISOString() };
          } else if (whDelta.delta > 0) {
            copy.push({
              id: `sb_${Date.now()}_${Math.random()}`,
              warehouseId: whDelta.warehouseId,
              productId: updatedReturn.productId,
              quantity: whDelta.delta,
              updatedAt: new Date().toISOString()
            });
          }
        }
        return copy;
      });
    }

    // Record audit trail entries in ERP audit log
    for (const log of changes) {
      addAuditLog(
        'Updated Customer Return',
        'Inventory',
        updatedReturn.returnNumber,
        `${log.field}: ${log.oldValue}`,
        `${log.field}: ${log.newValue}`
      );
    }

    return updatedReturn;
  };

  const approveCustomerReturn = async (returnId: string, reviewerId?: string, reviewerName?: string) => {
    const updated = await customerReturnService.approveReturn(
      returnId,
      reviewerId || user?.id,
      reviewerName || profile?.full_name || 'Manager',
      company.id
    );
    setCustomerReturns(prev => prev.map(r => r.id === returnId ? updated : r));
    addAuditLog('Approved Customer Return', 'Inventory', updated.returnNumber, 'Approved', `Approved return of ${updated.returnedQty} ${updated.unit} ${updated.productName}`);
    return updated;
  };

  const rejectCustomerReturn = async (returnId: string, reason: string, reviewerId?: string, reviewerName?: string) => {
    const updated = await customerReturnService.rejectReturn(
      returnId,
      reason,
      reviewerId || user?.id,
      reviewerName || profile?.full_name || 'Manager',
      company.id
    );
    setCustomerReturns(prev => prev.map(r => r.id === returnId ? updated : r));
    addAuditLog('Rejected Customer Return', 'Inventory', updated.returnNumber, 'Rejected', `Reason: ${reason}`);
    return updated;
  };

  const restockCustomerReturn = async (
    returnId: string,
    warehouseId?: string,
    restockedById?: string,
    restockedByName?: string
  ) => {
    const targetWh = warehouses.find(w => w.id === warehouseId) || warehouses.find(w => w.isDefault) || warehouses[0];
    const res = await customerReturnService.restockReturn(
      returnId,
      targetWh?.id,
      targetWh?.name,
      restockedById || user?.id,
      restockedByName || profile?.full_name || 'Warehouse Staff',
      company.id
    );

    setCustomerReturns(prev => prev.map(r => r.id === returnId ? res.returnRecord : r));

    // Live in-memory stock update if resalable and newly restocked
    if (res.restocked && res.returnRecord.condition === 'Resalable') {
      let updatedProductsList: Product[] = [];
      setProducts(prev => {
        updatedProductsList = prev.map(p => {
          if (p.id === res.returnRecord.productId) {
            return { ...p, currentStock: Math.max(0, (p.currentStock || 0) + res.returnRecord.returnedQty) };
          }
          return p;
        });
        return updatedProductsList;
      });
      if (updatedProductsList.length > 0) {
        checkStockAlerts(updatedProductsList);
      }

      // Update warehouse stock balances in memory
      if (targetWh?.id) {
        setStockBalances(prev => {
          const idx = prev.findIndex(b => b.warehouseId === targetWh.id && b.productId === res.returnRecord.productId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + res.returnRecord.returnedQty, updatedAt: new Date().toISOString() };
            return copy;
          }
          return [...prev, {
            id: `sb_${Date.now()}`,
            warehouseId: targetWh.id,
            productId: res.returnRecord.productId,
            quantity: res.returnRecord.returnedQty,
            updatedAt: new Date().toISOString()
          }];
        });
      }
    }

    addAuditLog(
      res.returnRecord.condition === 'Resalable' ? 'Restocked Customer Return' : 'Quarantined Customer Return',
      'Inventory',
      res.returnRecord.returnNumber,
      'Restocked',
      res.message
    );

    return res;
  };

  const refundCustomerReturn = async (
    returnId: string,
    refundMethod: string,
    refundAmount?: number,
    refundedById?: string,
    refundedByName?: string
  ) => {
    const updated = await customerReturnService.processRefund(
      returnId,
      refundMethod,
      refundAmount,
      refundedById || user?.id,
      refundedByName || profile?.full_name || 'Cashier',
      company.id
    );

    setCustomerReturns(prev => prev.map(r => r.id === returnId ? updated : r));
    addAuditLog('Processed Return Refund', 'Payments', updated.returnNumber, 'Refunded', `Refunded ₹${updated.refundAmount} via ${refundMethod}`);
    return updated;
  };

  // Expenses
  const addExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> => {
    const newExpense = await expenseService.createExpense(expenseData, company.id);
    setExpenses(prev => [newExpense, ...prev.filter(e => e.id !== newExpense.id)]);

    // Update local cash/bank balance
    if (newExpense.paymentAccount.toLowerCase().includes('cash')) {
      setCashAccounts(prev => prev.map(c => c.name.includes('Main') ? { ...c, currentBalance: Math.max(0, c.currentBalance - newExpense.amount) } : c));
    } else {
      setBankAccounts(prev => prev.map(b => b.bankName.includes('HDFC') ? { ...b, currentBalance: Math.max(0, b.currentBalance - newExpense.amount) } : b));
    }

    addAuditLog('Added Expense', 'Expenses', newExpense.category, 'Expense', `₹${newExpense.amount} to ${newExpense.vendor}`);
    return newExpense;
  };

  const deleteExpense = async (id: string) => {
    await expenseService.deleteExpense(id, company.id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Payments
  const recordPayment = async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt' | 'paymentNumber'> & { paymentNumber?: string }): Promise<PaymentRecord> => {
    const newPayment = await paymentService.recordPayment(paymentData, company.id);
    setPayments(prev => [newPayment, ...prev.filter(p => p.id !== newPayment.id)]);

    if (newPayment.type === 'Received' && newPayment.partyType === 'Customer') {
      setCustomers(prev =>
        prev.map(c => (c.id === newPayment.partyId ? {
          ...c,
          currentOutstanding: Math.max(0, c.currentOutstanding - newPayment.amount),
          totalPaid: c.totalPaid + newPayment.amount
        } : c))
      );
    } else if (newPayment.type === 'Paid' && newPayment.partyType === 'Supplier') {
      setSuppliers(prev =>
        prev.map(s => (s.id === newPayment.partyId ? {
          ...s,
          currentOutstanding: Math.max(0, s.currentOutstanding - newPayment.amount),
          totalPaid: s.totalPaid + newPayment.amount
        } : s))
      );
    }

    addAuditLog(`Payment ${newPayment.type}`, 'Payments', newPayment.paymentNumber, 'Recorded', `₹${newPayment.amount} (${newPayment.partyName})`);
    return newPayment;
  };

  // Stock Adjustment
  const adjustStock = async (productId: string, adjustmentQty: number, reason: string, warehouse: string) => {
    const txn = await inventoryService.adjustStock(
      productId,
      adjustmentQty,
      reason,
      warehouse,
      company.id,
      user ? { id: user.id, name: profile?.full_name || user.email || 'User', role: profile?.role } : undefined
    );
    setInventoryTransactions(prev => [txn, ...prev.filter(t => t.id !== txn.id)]);

    let updatedProductsList: Product[] = [];
    setProducts(prev => {
      updatedProductsList = prev.map(p => {
        if (p.id === productId) {
          return { ...p, currentStock: Math.max(0, p.currentStock + adjustmentQty) };
        }
        return p;
      });
      return updatedProductsList;
    });
    if (updatedProductsList.length > 0) {
      checkStockAlerts(updatedProductsList);
    }

    // Refresh stock balances and notifications (capturing damage alert and status transitions)
    await refreshStockBalances();
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(dedupeById(notifs || []));

    const prod = products.find(p => p.id === productId);
    addAuditLog('Adjusted Stock', 'Inventory', prod?.name || productId, `Adjust: ${adjustmentQty}`, reason);
  };

  // Multi-Warehouse Management
  const addWarehouse = async (whData: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    const newWh = await companyService.createWarehouse(whData, company.id);
    setWarehouses(prev => [...prev.filter(w => w.id !== newWh.id), newWh]);
    addAuditLog('Created Warehouse', 'Inventory', newWh.code, 'None', `${newWh.name} (${newWh.type || newWh.locationType})`);
    return newWh;
  };

  const updateWarehouse = async (id: string, updates: Partial<Warehouse>): Promise<Warehouse> => {
    const updated = await companyService.updateWarehouse(id, updates, company.id);
    setWarehouses(prev => prev.map(w => w.id === id ? { ...w, ...updated } : w));
    addAuditLog('Updated Warehouse', 'Inventory', updated.code, 'Modified', `${updated.name}`);
    return updated;
  };

  const deleteWarehouse = async (id: string): Promise<boolean> => {
    const success = await companyService.deleteWarehouse(id, company.id);
    if (success) {
      setWarehouses(prev => prev.filter(w => w.id !== id));
      addAuditLog('Deleted Warehouse', 'Inventory', id, 'Deleted', 'Removed warehouse location');
    }
    return success;
  };

  const toggleWarehouseStatus = async (id: string, isActive: boolean): Promise<void> => {
    await companyService.toggleWarehouseStatus(id, isActive, company.id);
    setWarehouses(prev => prev.map(w => w.id === id ? { ...w, isActive } : w));
    addAuditLog('Warehouse Status Changed', 'Inventory', id, isActive ? 'Inactive' : 'Active', isActive ? 'Active' : 'Inactive');
  };

  const refreshStockBalances = useCallback(async (): Promise<void> => {
    const balances = await inventoryService.getStockBalances(company.id);
    setStockBalances(balances);
  }, [company.id]);

  // Stock Transfer
  const createStockTransfer = async (transferData: Omit<StockTransfer, 'id' | 'createdAt'>): Promise<StockTransfer> => {
    const newTransfer = await inventoryService.createStockTransfer(transferData, company.id);

    // Refresh stock balances, transfers, transactions & products in context immediately
    const [freshTransfers, freshBalances, freshTxns, freshProducts] = await Promise.all([
      inventoryService.getStockTransfers(company.id),
      inventoryService.getStockBalances(company.id),
      inventoryService.getStockTransactions(company.id),
      productService.getProducts(undefined, company.id)
    ]);
    setStockTransfers(freshTransfers);
    setStockBalances(freshBalances);
    setInventoryTransactions(freshTxns);
    setProducts(sortProductsAZ(freshProducts));
    checkStockAlerts(freshProducts);
    addAuditLog('Stock Transfer', 'Inventory', newTransfer.transferNumber, newTransfer.fromWarehouse, `${newTransfer.toWarehouse} (${newTransfer.items.length} items) - Completed`);
    return newTransfer;
  };

  const updateTransferStatus = async (id: string, status: StockTransfer['status'], actorName?: string) => {
    await inventoryService.updateTransferStatus(id, status, actorName || (user as any)?.name || (user as any)?.email || 'Authorized Staff', company.id);
    
    // Refresh stock balances & transfers & transactions & products in context
    const [freshTransfers, freshBalances, freshTxns, freshProducts] = await Promise.all([
      inventoryService.getStockTransfers(company.id),
      inventoryService.getStockBalances(company.id),
      inventoryService.getStockTransactions(company.id),
      productService.getProducts(undefined, company.id)
    ]);
    setStockTransfers(freshTransfers);
    setStockBalances(freshBalances);
    setInventoryTransactions(freshTxns);
    setProducts(sortProductsAZ(freshProducts));
    checkStockAlerts(freshProducts);
    addAuditLog('Transfer Status Changed', 'Inventory', id, 'Status update', status);
  };

  // Batches & Serials
  const addBatch = async (batchData: Omit<Batch, 'id'>): Promise<Batch> => {
    const newBatch = await productService.createBatch(batchData, company.id);
    setBatches(prev => [newBatch, ...prev.filter(b => b.id !== newBatch.id)]);

    // Evaluate 30-day batch expiry alert if entering warning window
    try {
      const currentRole = profile?.role || (user as any)?.role;
      const targetCompId = company.id || companyId || activeCompanyId || '00000000-0000-0000-0000-000000000001';
      if (currentRole === 'Warehouse Manager' && user?.id) {
        const alerts = await stockAlertService.checkBatchExpiryAlerts({
          batches: [newBatch],
          companyId: targetCompId,
          warehouses,
          users,
          existingNotifications: notifications,
          createNotification: async notif => notificationService.createNotification(notif, targetCompId)
        });
        if (alerts.length > 0) {
          setNotifications(prev => sortNotifications(dedupeById([...alerts, ...prev])));
        }
      }
    } catch {}

    return newBatch;
  };

  const addSerialNumber = async (serialData: Omit<SerialNumber, 'id'>): Promise<SerialNumber> => {
    const newSerial = await productService.createSerialNumber(serialData, company.id);
    setSerialNumbers(prev => [newSerial, ...prev.filter(s => s.id !== newSerial.id)]);
    return newSerial;
  };

  // Units & Conversions
  const addUnit = async (unitData: Omit<Unit, 'id'>): Promise<Unit> => {
    const newUnit = await productService.createUnit(unitData, company.id);
    setUnits(prev => {
      const nameKey = normalizeUnitKey(newUnit.name);
      const symKey = normalizeUnitKey(newUnit.symbol);
      const filtered = prev.filter(u => {
        if (u.id === newUnit.id) return false;
        const uName = normalizeUnitKey(u.name);
        const uSym = normalizeUnitKey(u.symbol);
        if (nameKey && (uName === nameKey || uSym === nameKey)) return false;
        if (symKey && (uName === symKey || uSym === symKey)) return false;
        return true;
      });
      return [...filtered, newUnit];
    });
    return newUnit;
  };

  const updateUnit = async (id: string, updates: Partial<Omit<Unit, 'id'>>): Promise<Unit> => {
    const updated = await productService.updateUnit(id, updates, company.id);
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...updated, isCustom: true } : u));
    addAuditLog('Updated Unit', 'Products', updated.name, 'Units', `Category: ${updated.category} | Symbol: ${updated.symbol}`);
    return updated;
  };

  const checkUnitUsage = async (unit: Unit): Promise<{ inUse: boolean; reasons: string[] }> => {
    return productService.checkUnitUsage(unit, company.id);
  };

  const deleteUnit = async (id: string): Promise<boolean> => {
    const success = await productService.deleteUnit(id, company.id);
    if (success) {
      setUnits(prev => prev.filter(u => u.id !== id));
      addAuditLog('Deleted Unit', 'Products', id, 'Units', 'Deleted unit');
    }
    return success;
  };

  const addConversion = async (convData: Omit<UnitConversion, 'id'>): Promise<UnitConversion> => {
    const newConv = await productService.createConversion(convData, company.id);
    setConversions(prev => [...prev.filter(c => c.id !== newConv.id), newConv]);
    addAuditLog('Created Conversion Rule', 'Products', `1 ${newConv.fromUnit} = ${newConv.factor} ${newConv.toUnit}`, 'Conversions', newConv.notes || 'Configured conversion rule');
    return newConv;
  };

  const deleteConversion = async (id: string): Promise<boolean> => {
    const success = await productService.deleteConversion(id, company.id);
    if (success) {
      setConversions(prev => prev.filter(c => c.id !== id));
      addAuditLog('Deleted Conversion Rule', 'Products', id, 'Conversions', 'Deleted conversion rule');
    }
    return success;
  };

  const updateConversion = async (id: string, convData: Partial<UnitConversion>): Promise<boolean> => {
    try {
      const updatedConv = await productService.updateConversion(id, convData, company.id);
      if (updatedConv) {
        setConversions(prev => prev.map(c => c.id === id ? { ...c, ...updatedConv } : c));
        addAuditLog(
          'Updated Conversion Rule',
          'Products',
          `1 ${updatedConv.fromUnit} = ${updatedConv.factor} ${updatedConv.toUnit}`,
          'Conversions',
          updatedConv.notes || 'Updated conversion rule'
        );
        return true;
      }
    } catch (err) {
      console.error('Error updating conversion rule:', err);
    }
    return false;
  };

  // Accounts
  const addAccount = async (accData: Omit<Account, 'id'>): Promise<Account> => {
    const newAcc = await accountingService.createAccount(accData, company.id);
    setAccounts(prev => [...prev.filter(a => a.id !== newAcc.id), newAcc]);
    addAuditLog('Created Account', 'Accounting', `${newAcc.code} - ${newAcc.name}`, 'None', `Balance: ₹${newAcc.balance}`);
    return newAcc;
  };

  // Users & Permissions
  const addUser = async (userData: Omit<SystemUser, 'id'>, password?: string): Promise<SystemUser> => {
    const newUser = await userService.createUser(userData, password, company.id);
    setUsers(prev => [...prev.filter(u => u.id !== newUser.id), newUser]);
    addAuditLog('Created User', 'Users & Roles', newUser.name, 'None', `Role: ${newUser.role}`);
    return newUser;
  };

  const updateUser = async (id: string, updates: Partial<SystemUser>): Promise<SystemUser> => {
    const updated = await userService.updateUser(id, updates, company.id);
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updated } : u)));
    addAuditLog('Updated User', 'Users & Roles', updated.name, 'Updated', `Role: ${updated.role}, Status: ${updated.status}`);
    return updated;
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    const target = users.find(u => u.id === id);
    await userService.deleteUser(id, company.id);
    setUsers(prev => prev.filter(u => u.id !== id));
    addAuditLog('Deleted User', 'Users & Roles', target?.name || id, 'Deleted', 'Removed from system');
    return true;
  };

  const toggleAccountStatus = async (id: string, newStatus: AccountStatus): Promise<SystemUser> => {
    const targetCompId = company.id || companyId || '00000000-0000-0000-0000-000000000001';
    const updated = await userService.toggleAccountStatus(id, newStatus, user?.id, targetCompId);
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updated } : u)));
    addAuditLog('Account Status Changed', 'Users & Roles', updated.name, 'Updated', `Account Status: ${newStatus}`);
    return updated;
  };

  const updatePermission = (module: string, field: keyof Permission, val: boolean) => {
    setPermissions(prev =>
      prev.map(p => (p.module === module ? { ...p, [field]: val } : p))
    );
  };

  // Notifications
  const markNotificationAsRead = useCallback(async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.read) return;

    // Snapshot previous state for rollback if database update fails
    const previousNotifications = notifications;

    // Immediately update read status and re-sort so the notification moves below all unread items
    const updated = notifications.map(n => (n.id === id ? { ...n, read: true } : n));
    setNotifications(sortNotifications(updated));

    try {
      await notificationService.markAsRead(id, activeCompanyId);
    } catch (err) {
      console.error('Failed to mark notification as read in database:', err);
      // Restore previous state to prevent false confirmation
      setNotifications(previousNotifications);
      throw err;
    }
  }, [notifications, activeCompanyId]);

  const markAllNotificationsAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const previousNotifications = notifications;
    const currentRole = profile?.role || (user as any)?.role;

    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(sortNotifications(updated));

    try {
      await notificationService.markAllAsRead(activeCompanyId, user?.id, currentRole);
    } catch (err) {
      console.error('Failed to mark all notifications as read in database:', err);
      setNotifications(previousNotifications);
      throw err;
    }
  }, [notifications, activeCompanyId, user?.id, profile?.role, (user as any)?.role]);

  const clearNotifications = useCallback(async () => {
    const currentRole = profile?.role || (user as any)?.role;
    await notificationService.clearAll(activeCompanyId, user?.id, currentRole);
    setNotifications([]);
  }, [activeCompanyId, user?.id, profile?.role, (user as any)?.role]);

  // Refresh / Synchronize Database Cache
  const resetAllToDemoData = async () => {
    await loadAllData();
  };

  const seedDemoBusiness = async () => {
    try {
      await supabase.rpc('seed_demo_business');
      await loadAllData();
    } catch (e) {
      console.error('Failed to seed demo business:', e);
    }
  };

  const clearAllMockData = async () => {
    try {
      await supabase.rpc('clear_mock_data');
      await loadAllData();
    } catch (e) {
      console.error('Failed to clear mock data:', e);
    }
  };

  // Purchase Requests Workflow Handlers
  const refreshPurchaseRequests = useCallback(async () => {
    try {
      const currentRole = profile?.role || (user as any)?.role;
      const reqs = await purchaseRequestService.getPurchaseRequests(undefined, activeCompanyId, currentRole, user?.id);
      setPurchaseRequests(dedupeById(reqs || []));
    } catch (e) {
      console.warn('refreshPurchaseRequests error:', e);
    }
  }, [activeCompanyId, profile?.role, (user as any)?.role, user?.id]);

  const handleCreatePurchaseRequest = useCallback(async (input: CreatePurchaseRequestInput): Promise<PurchaseRequest> => {
    const res = await purchaseRequestService.createPurchaseRequest(
      input,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'Warehouse Manager', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => [res, ...prev.filter(r => r.id !== res.id)]);
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(sortNotifications(dedupeById(notifs || [])));
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, (user as any)?.role]);

  const handleUpdatePurchaseRequest = useCallback(async (requestId: string, input: Partial<CreatePurchaseRequestInput>): Promise<PurchaseRequest> => {
    const res = await purchaseRequestService.updatePurchaseRequest(
      requestId,
      input,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'Warehouse Manager', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => prev.map(r => r.id === res.id ? res : r));
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(sortNotifications(dedupeById(notifs || [])));
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, (user as any)?.role]);

  const handleUpdatePurchaseRequestStatus = useCallback(async (params: {
    requestId: string;
    status: PurchaseRequestStatus;
    comments?: string;
    rejectionReason?: string;
    clarificationNotes?: string;
    adjustedItems?: { itemId: string; approvedQty: number; adjustmentReason?: string }[];
  }): Promise<PurchaseRequest> => {
    const res = await purchaseRequestService.updateRequestStatus(
      params,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'User', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => prev.map(r => r.id === res.id ? res : r));
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(sortNotifications(dedupeById(notifs || [])));
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, (user as any)?.role]);

  const handleCancelPurchaseRequest = useCallback(async (requestId: string, cancellationReason: string): Promise<PurchaseRequest> => {
    const res = await purchaseRequestService.cancelPurchaseRequest(
      { requestId, cancellationReason },
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'User', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => prev.map(r => r.id === res.id ? res : r));
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(sortNotifications(dedupeById(notifs || [])));
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, (user as any)?.role]);

  const handleDeletePurchaseRequest = useCallback(async (requestId: string): Promise<boolean> => {
    const res = await purchaseRequestService.deletePurchaseRequest(requestId, activeCompanyId, profile?.role);
    setPurchaseRequests(prev => prev.filter(r => r.id !== requestId));
    return res;
  }, [activeCompanyId, profile?.role]);

  const handleCreatePurchaseOrderFromRequest = useCallback(async (params: any) => {
    const res = await purchaseRequestService.createPurchaseOrderFromRequest(
      params,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'Purchase Manager', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => prev.map(r => r.id === res.request.id ? res.request : r));
    const notifs = await notificationService.getNotifications(activeCompanyId, user?.id, profile?.role || (user as any)?.role);
    setNotifications(sortNotifications(dedupeById(notifs || [])));
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, (user as any)?.role]);

  const handleRecordGoodsReceipt = useCallback(async (params: any): Promise<PurchaseRequest> => {
    const res = await purchaseRequestService.recordGoodsReceipt(
      params,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'Warehouse Staff', role: profile?.role } : undefined
    );
    setPurchaseRequests(prev => prev.map(r => r.id === res.id ? res : r));
    await loadAllData(activeCompanyId);
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, loadAllData]);

  const contextValue = useMemo<ERPContextType>(() => ({
    company,
    updateCompany,
    isSetupComplete,
    setSetupComplete,
    isLoading,
    error,
    refreshData: loadAllData,
    products,
    addProduct,
    updateProduct,
    archiveProduct,
    deleteProduct,
    generateSKU,
    generateBarcode,
    customCategories,
    addCustomCategory,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    salesInvoices,
    createSalesInvoice,
    processSalesReturn,
    heldInvoices,
    holdInvoice,
    resumeInvoice,
    removeHeldInvoice,
    purchaseInvoices,
    createPurchaseInvoice,
    processPurchaseReturn,
    recordPurchasePayment,
    customerReturns,
    refreshCustomerReturns,
    addCustomerReturn,
    approveCustomerReturn,
    rejectCustomerReturn,
    restockCustomerReturn,
    refundCustomerReturn,
    purchaseRequests,
    refreshPurchaseRequests,
    createPurchaseRequest: handleCreatePurchaseRequest,
    updatePurchaseRequest: handleUpdatePurchaseRequest,
    updatePurchaseRequestStatus: handleUpdatePurchaseRequestStatus,
    cancelPurchaseRequest: handleCancelPurchaseRequest,
    deletePurchaseRequest: handleDeletePurchaseRequest,
    createPurchaseOrderFromRequest: handleCreatePurchaseOrderFromRequest,
    recordGoodsReceipt: handleRecordGoodsReceipt,
    expenses,
    addExpense,
    deleteExpense,
    payments,
    recordPayment,
    inventoryTransactions,
    warehouses,
    stockBalances,
    stockTransfers,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    toggleWarehouseStatus,
    createStockTransfer,
    updateTransferStatus,
    adjustStock,
    getWarehouseStock,
    getProductStockByWarehouse,
    validateSaleStock,
    refreshStockBalances,
    batches,
    addBatch,
    serialNumbers,
    addSerialNumber,
    units,
    addUnit,
    updateUnit,
    deleteUnit,
    checkUnitUsage,
    conversions,
    addConversion,
    updateConversion,
    deleteConversion,
    accounts,
    addAccount,
    bankAccounts,
    cashAccounts,
    users,
    addUser,
    updateUser,
    deleteUser,
    toggleAccountStatus,
    refreshUsers,
    permissions,
    updatePermission,
    auditLogs,
    addAuditLog,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    checkStockAlerts,
    selectedWarehouse,
    setSelectedWarehouse,
    resetAllToDemoData,
    seedDemoBusiness,
    clearAllMockData
  }), [
    company,
    updateCompany,
    isSetupComplete,
    isLoading,
    error,
    loadAllData,
    products,
    addProduct,
    updateProduct,
    archiveProduct,
    deleteProduct,
    generateSKU,
    generateBarcode,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    salesInvoices,
    createSalesInvoice,
    processSalesReturn,
    heldInvoices,
    holdInvoice,
    resumeInvoice,
    removeHeldInvoice,
    purchaseInvoices,
    createPurchaseInvoice,
    processPurchaseReturn,
    recordPurchasePayment,
    customerReturns,
    refreshCustomerReturns,
    addCustomerReturn,
    updateCustomerReturn,
    approveCustomerReturn,
    rejectCustomerReturn,
    restockCustomerReturn,
    refundCustomerReturn,
    purchaseRequests,
    refreshPurchaseRequests,
    handleCreatePurchaseRequest,
    handleUpdatePurchaseRequest,
    handleUpdatePurchaseRequestStatus,
    handleCancelPurchaseRequest,
    handleDeletePurchaseRequest,
    handleCreatePurchaseOrderFromRequest,
    handleRecordGoodsReceipt,
    expenses,
    addExpense,
    deleteExpense,
    payments,
    recordPayment,
    inventoryTransactions,
    warehouses,
    stockBalances,
    stockTransfers,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    toggleWarehouseStatus,
    createStockTransfer,
    updateTransferStatus,
    adjustStock,
    getWarehouseStock,
    getProductStockByWarehouse,
    validateSaleStock,
    refreshStockBalances,
    batches,
    addBatch,
    serialNumbers,
    addSerialNumber,
    units,
    addUnit,
    updateUnit,
    deleteUnit,
    checkUnitUsage,
    conversions,
    addConversion,
    updateConversion,
    deleteConversion,
    accounts,
    addAccount,
    bankAccounts,
    cashAccounts,
    users,
    addUser,
    updateUser,
    deleteUser,
    toggleAccountStatus,
    refreshUsers,
    permissions,
    updatePermission,
    auditLogs,
    addAuditLog,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    checkStockAlerts,
    selectedWarehouse,
    setSelectedWarehouse,
    resetAllToDemoData,
    seedDemoBusiness,
    clearAllMockData
  ]);

  return (
    <ERPContext.Provider value={contextValue}>
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = (): ERPContextType => {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
};
