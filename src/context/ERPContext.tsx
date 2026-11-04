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
  UpdateCustomerReturnInput,
  RecordSupplierDeliveryInput,
  SupplierDeliveryReceiptResult,
  StaffMember,
  AttendanceRecord,
  LeaveRequest,
  PayrollRun,
  Payslip,
  InboundCustomerOrder,
  ProductRepackagingRun,
  RepackagingOutputItem,
  ComboKitRun,
  ComboKitComponent,
  DebundlingRun,
  DayEndShiftSettlement,
  JournalVoucher,
  JournalEntryLine,
  StaffAdvanceRecord
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
import { orderReceiveService } from '../services/orderReceiveService';
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
  generateNextBatchNumber: (targetDate?: string) => Promise<string>;
  customCategories: string[];
  addCustomCategory: (name: string) => Promise<string>;
  updateCustomCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCustomCategory: (name: string) => Promise<void>;

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
  updatePurchaseOrderDetails: (
    poId: string,
    data: Parameters<typeof purchaseService.updatePurchaseOrderDetails>[1]
  ) => Promise<{ po: PurchaseInvoice; linkedBill?: PurchaseInvoice }>;
  confirmPurchaseOrderReceived: (poId: string, receivedBy?: string) => Promise<PurchaseInvoice>;
  receiveAndSavePurchaseOrder: (
    poId: string,
    data: Parameters<typeof purchaseService.receiveAndSavePurchaseOrder>[1]
  ) => Promise<{ po: PurchaseInvoice; linkedBill?: PurchaseInvoice }>;
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
  recordOpeningStock: (params: Parameters<typeof inventoryService.recordOpeningStock>[0]) => Promise<InventoryTransaction>;
  recordStockBundle: (bundle: Parameters<typeof inventoryService.recordStockBundle>[0]) => Promise<{ success: boolean; count: number }>;
  getWarehouseStock: (warehouseIdOrCode: string | undefined, productId: string) => number;
  getProductStockByWarehouse: (productId: string) => Record<string, number>;
  validateSaleStock: (warehouseId: string, items: { productId: string; qty: number; unit?: string; productName?: string }[]) => StockValidationResult;
  refreshStockBalances: () => Promise<void>;
  batches: Batch[];
  addBatch: (batch: Omit<Batch, 'id'>) => Promise<Batch>;
  updateBatch: (batchId: string, updates: Partial<Batch>) => Promise<void>;
  serialNumbers: SerialNumber[];
  addSerialNumber: (serial: Omit<SerialNumber, 'id'>) => Promise<SerialNumber>;
  updateSerialNumber: (serialId: string, updates: Partial<SerialNumber>) => Promise<void>;

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
  approvePurchaseRequestWithOrder: (params: {
    requestId: string;
    supplierId: string;
    supplierName?: string;
    supplierGstin?: string;
    destinationWarehouseId?: string;
    notes?: string;
    expectedDelivery?: string;
    approvedItems: Array<{
      id?: string;
      productId: string;
      productName: string;
      sku?: string;
      unit: string;
      requestedQty: number;
      approvedQty: number;
      rate?: number;
      taxRate?: number;
      isCustom?: boolean;
      adjustmentReason?: string;
    }>;
  }) => Promise<{ purchaseOrderId: string; purchaseOrderNumber: string; request: PurchaseRequest }>;
  recordGoodsReceipt: (params: {
    requestId: string;
    receivedItems: Array<{
      itemId: string;
      productId: string;
      receivedQty: number;
      damagedQty?: number;
      acceptedQty?: number;
    }>;
    receivingWarehouseId: string;
    invoiceNumber?: string;
    notes?: string;
  }) => Promise<PurchaseRequest>;
  recordSupplierDelivery: (input: RecordSupplierDeliveryInput) => Promise<SupplierDeliveryReceiptResult>;

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

  // HR & Payroll
  staffMembers: StaffMember[];
  addStaffMember: (staff: Omit<StaffMember, 'id' | 'createdAt'>) => Promise<StaffMember>;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => Promise<void>;
  attendanceRecords: AttendanceRecord[];
  markAttendance: (records: Omit<AttendanceRecord, 'id'>[]) => Promise<void>;
  getStaffAttendanceForMonth: (staffId: string, month: string) => AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  submitLeaveRequest: (leave: Omit<LeaveRequest, 'id' | 'createdAt'>) => Promise<void>;
  updateLeaveStatus: (id: string, status: 'Approved' | 'Rejected', notes?: string) => Promise<void>;
  payrollRuns: PayrollRun[];
  payslips: Payslip[];
  runPayroll: (month: string, adjustments?: Record<string, { bonus?: number; allowances?: number; deductions?: number }>) => Promise<PayrollRun>;

  // Inbound Orders & WhatsApp Dispatch
  inboundOrders: InboundCustomerOrder[];
  createInboundOrder: (order: Omit<InboundCustomerOrder, 'id' | 'createdAt' | 'orderNumber'>) => Promise<InboundCustomerOrder>;
  updateInboundOrderStatus: (orderId: string, status: InboundCustomerOrder['status'], notes?: string) => Promise<void>;
  assignOrderToSalesperson: (orderId: string, salespersonId: string, salespersonName: string) => Promise<void>;
  updateDeliveryStatus: (invoiceId: string, status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled') => Promise<void>;

  // Repackaging, Assembly & Bulk Conversion
  repackagingRuns: ProductRepackagingRun[];
  createRepackagingRun: (run: Omit<ProductRepackagingRun, 'id' | 'createdAt' | 'conversionNumber'>) => Promise<ProductRepackagingRun>;

  // Combo Kitting & De-bundling
  comboKitRuns: ComboKitRun[];
  createComboKitRun: (run: Omit<ComboKitRun, 'id' | 'createdAt' | 'kitNumber'>) => Promise<ComboKitRun>;
  debundlingRuns: DebundlingRun[];
  createDebundlingRun: (run: Omit<DebundlingRun, 'id' | 'createdAt' | 'debundleNumber'>) => Promise<DebundlingRun>;

  // Cash Drawer Shift Settlement & Z-Report
  shiftSettlements: DayEndShiftSettlement[];
  recordShiftSettlement: (settlement: Omit<DayEndShiftSettlement, 'id' | 'createdAt' | 'settlementNumber'>) => Promise<DayEndShiftSettlement>;

  // Manual Double-Entry Journal Vouchers (JV)
  journalVouchers: JournalVoucher[];
  createJournalVoucher: (voucher: Omit<JournalVoucher, 'id' | 'createdAt' | 'voucherNumber'>) => Promise<JournalVoucher>;

  // Staff Salary Advance
  staffAdvances: StaffAdvanceRecord[];
  recordStaffAdvance: (advance: Omit<StaffAdvanceRecord, 'id' | 'createdAt'>) => Promise<StaffAdvanceRecord>;
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
            setNotifications(prev => sortNotifications(dedupeById([...prev, ...generatedAlerts])));
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
            setNotifications(prev => sortNotifications(dedupeById([...prev, ...allNewBatchAlerts])));
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
              customersData || [],
              notifData || []
            );
            if (followUpAlerts && followUpAlerts.length > 0) {
              setNotifications(prev => sortNotifications(dedupeById([...prev, ...followUpAlerts])));
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

  const generateNextBatchNumber = async (targetDate?: string): Promise<string> => {
    return productService.generateNextBatchNumber(company.id, targetDate);
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

  const updateCustomCategory = async (oldName: string, newName: string): Promise<void> => {
    const updated = await categoryService.updateCategory(oldName, newName, activeCompanyId);
    setCustomCategories(prev => prev.map(c => c.toLowerCase() === oldName.toLowerCase() ? updated : c));
    setProducts(prev => prev.map(p => p.category.toLowerCase() === oldName.toLowerCase() ? { ...p, category: updated } : p));
  };

  const deleteCustomCategory = async (catName: string): Promise<void> => {
    await categoryService.deleteCategory(catName, activeCompanyId);
    setCustomCategories(prev => prev.filter(c => c.toLowerCase() !== catName.toLowerCase()));
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
    // Guarantee store stock always deducts from Main Store / Primary Warehouse
    const defaultWh = warehouses.find(w => w.isDefault) || warehouses[0];
    const effectiveWarehouseId = invoiceData.warehouseId || company.defaultWarehouseId || defaultWh?.id || 'main';
    const effectiveWarehouseName = invoiceData.warehouseName || warehouses.find(w => w.id === effectiveWarehouseId)?.name || defaultWh?.name || 'Main Store';
    const finalInvoiceData = {
      ...invoiceData,
      warehouseId: effectiveWarehouseId,
      warehouseName: effectiveWarehouseName
    };

    // 1. Authoritative Pre-validation: verify stock before sending or mutating state
    const affectsStock = finalInvoiceData.docType === 'tax_invoice' || finalInvoiceData.docType === 'delivery_challan' || finalInvoiceData.docType === 'pos_invoice';
    if (affectsStock && finalInvoiceData.items.length > 0) {
      const validation = validateSaleStock(effectiveWarehouseId, finalInvoiceData.items);
      if (!validation.valid) {
        throw new Error(validation.errorMessage || 'No stock available — This product cannot be billed because no stock is available.');
      }
    }

    const newInvoice = await salesService.createSalesInvoice(finalInvoiceData, company.id);
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

  const updatePurchaseOrderDetails = async (
    poId: string,
    data: Parameters<typeof purchaseService.updatePurchaseOrderDetails>[1]
  ): Promise<{ po: PurchaseInvoice; linkedBill?: PurchaseInvoice }> => {
    const res = await purchaseService.updatePurchaseOrderDetails(poId, data, company.id);
    setPurchaseInvoices(prev => {
      let next = prev.map(inv => inv.id === poId ? res.po : inv);
      if (res.linkedBill) {
        const billIdx = next.findIndex(inv => inv.id === res.linkedBill!.id || (inv.purchaseOrderId === poId && inv.docType === 'purchase_invoice'));
        if (billIdx >= 0) {
          next[billIdx] = res.linkedBill;
        } else {
          next = [res.linkedBill, ...next];
        }
      }
      return next;
    });
    addAuditLog('Updated Purchase Order Details', 'Purchases', res.po.invoiceNumber, 'PO Updated', `Status: ${res.po.poStatus || 'Ordered'}`);
    return res;
  };

  const confirmPurchaseOrderReceived = async (
    poId: string,
    receivedBy?: string
  ): Promise<PurchaseInvoice> => {
    const updated = await purchaseService.confirmPurchaseOrderReceived(poId, receivedBy, company.id);
    setPurchaseInvoices(prev => prev.map(inv => inv.id === poId ? updated : inv));

    // Refresh stock balances and product current stock
    await refreshStockBalances();
    const freshProducts = await productService.getProducts(undefined, company.id);
    if (freshProducts && freshProducts.length > 0) {
      setProducts(sortProductsAZ(freshProducts));
      checkStockAlerts(freshProducts);
    }

    addAuditLog('Confirmed Goods Receipt', 'Purchases', updated.invoiceNumber, 'Goods Receipt', `PO Status: ${updated.poStatus || 'Received'}`);
    return updated;
  };

  const receiveAndSavePurchaseOrder = async (
    poId: string,
    data: Parameters<typeof purchaseService.receiveAndSavePurchaseOrder>[1]
  ): Promise<{ po: PurchaseInvoice; linkedBill?: PurchaseInvoice }> => {
    const res = await purchaseService.receiveAndSavePurchaseOrder(poId, data, user?.email || 'Purchase Manager', company.id);
    setPurchaseInvoices(prev => {
      let next = prev.map(inv => inv.id === poId ? res.po : inv);
      if (res.linkedBill) {
        const billIdx = next.findIndex(inv => inv.id === res.linkedBill!.id || (inv.purchaseOrderId === poId && inv.docType === 'purchase_invoice'));
        if (billIdx >= 0) {
          next[billIdx] = res.linkedBill;
        } else {
          next = [res.linkedBill, ...next];
        }
      }
      return next;
    });

    // Refresh stock balances and product current stock
    await refreshStockBalances();
    const freshProducts = await productService.getProducts(undefined, company.id);
    if (freshProducts && freshProducts.length > 0) {
      setProducts(sortProductsAZ(freshProducts));
      checkStockAlerts(freshProducts);
    }

    addAuditLog('Confirmed Goods Receipt and Saved Bill', 'Purchases', res.po.invoiceNumber, 'PO Received', `Status: ${res.po.poStatus}`);
    return res;
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

  // Record Opening Stock
  const recordOpeningStock = async (params: Parameters<typeof inventoryService.recordOpeningStock>[0]): Promise<InventoryTransaction> => {
    const txn = await inventoryService.recordOpeningStock({
      ...params,
      companyId: company.id,
      currentUser: user ? { id: user.id, name: profile?.full_name || user.email || 'User', role: profile?.role } : undefined
    });
    setInventoryTransactions(prev => [txn, ...prev.filter(t => t.id !== txn.id)]);
    const [freshBalances, freshProducts] = await Promise.all([
      inventoryService.getStockBalances(company.id),
      productService.getProducts(undefined, company.id)
    ]);
    setStockBalances(freshBalances);
    setProducts(sortProductsAZ(freshProducts));
    checkStockAlerts(freshProducts);

    addAuditLog('Recorded Opening Stock', 'Product', txn.productName || params.productId, `Initial: ${params.quantity}`, params.notes || 'Opening stock');
    return txn;
  };

  // Record Stock Bundle
  const recordStockBundle = async (bundle: Parameters<typeof inventoryService.recordStockBundle>[0]): Promise<{ success: boolean; count: number }> => {
    const res = await inventoryService.recordStockBundle({
      ...bundle,
      companyId: company.id,
      currentUser: user ? { id: user.id, name: profile?.full_name || user.email || 'User', role: profile?.role } : undefined
    });
    if (res.transactions && res.transactions.length > 0) {
      setInventoryTransactions(prev => [...res.transactions, ...prev]);
    }
    const [freshBalances, freshProducts] = await Promise.all([
      inventoryService.getStockBalances(company.id),
      productService.getProducts(undefined, company.id)
    ]);
    setStockBalances(freshBalances);
    setProducts(sortProductsAZ(freshProducts));
    checkStockAlerts(freshProducts);

    addAuditLog('Recorded Stock Bundle', 'Product', bundle.referenceNumber || 'Bundle', `Items: ${bundle.items.length}`, bundle.notes || 'Multi-product opening stock');
    return { success: true, count: res.count };
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

  const updateBatch = async (batchId: string, updates: Partial<Batch>): Promise<void> => {
    await productService.updateBatch(batchId, updates, company.id);
    setBatches(prev => prev.map(b => (b.id === batchId ? { ...b, ...updates } : b)));
  };

  const updateSerialNumber = async (serialId: string, updates: Partial<SerialNumber>): Promise<void> => {
    await productService.updateSerialNumber(serialId, updates, company.id);
    setSerialNumbers(prev => prev.map(s => (s.id === serialId ? { ...s, ...updates } : s)));
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
      await notificationService.markAsRead(id, activeCompanyId, user?.id);
    } catch (err) {
      console.error('Failed to mark notification as read in database:', err);
      // Restore previous state to prevent false confirmation
      setNotifications(previousNotifications);
      throw err;
    }
  }, [notifications, activeCompanyId, user?.id]);

  const markAllNotificationsAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const previousNotifications = notifications;
    const currentRole = profile?.role || (user as any)?.role;
    const unreadIds = unread.map(n => n.id);

    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(sortNotifications(updated));

    try {
      await notificationService.markAllAsRead(activeCompanyId, user?.id, currentRole, unreadIds);
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

  const handleApprovePurchaseRequestWithOrder = useCallback(async (params: any) => {
    const res = await purchaseRequestService.approvePurchaseRequestWithOrder(
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
    setPurchaseRequests(prev => {
      const exists = prev.some(r => r.id === res.id || (res.purchaseOrderId && r.purchaseOrderId === res.purchaseOrderId));
      if (exists) {
        return prev.map(r => (r.id === res.id || (res.purchaseOrderId && r.purchaseOrderId === res.purchaseOrderId)) ? res : r);
      }
      return [res, ...prev];
    });
    await loadAllData(activeCompanyId);
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, loadAllData]);

  const handleRecordSupplierDelivery = useCallback(async (input: RecordSupplierDeliveryInput): Promise<SupplierDeliveryReceiptResult> => {
    const res = await orderReceiveService.confirmSupplierDelivery(
      input,
      activeCompanyId,
      user ? { id: user.id, name: profile?.full_name || user.email || 'Warehouse Staff', role: profile?.role } : undefined
    );
    await loadAllData(activeCompanyId);
    return res;
  }, [activeCompanyId, user, profile?.full_name, profile?.role, loadAllData]);

  // =========================================================================
  // HR, ATTENDANCE & PAYROLL STATE
  // =========================================================================
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('erp_staff_members');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_attendance_records');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try {
      const saved = localStorage.getItem('erp_leave_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(() => {
    try {
      const saved = localStorage.getItem('erp_payroll_runs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [payslips, setPayslips] = useState<Payslip[]>(() => {
    try {
      const saved = localStorage.getItem('erp_payslips');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync HR data to localStorage
  useEffect(() => {
    try { localStorage.setItem('erp_staff_members', JSON.stringify(staffMembers)); } catch {}
  }, [staffMembers]);

  useEffect(() => {
    try { localStorage.setItem('erp_attendance_records', JSON.stringify(attendanceRecords)); } catch {}
  }, [attendanceRecords]);

  useEffect(() => {
    try { localStorage.setItem('erp_leave_requests', JSON.stringify(leaveRequests)); } catch {}
  }, [leaveRequests]);

  useEffect(() => {
    try { localStorage.setItem('erp_payroll_runs', JSON.stringify(payrollRuns)); } catch {}
  }, [payrollRuns]);

  useEffect(() => {
    try { localStorage.setItem('erp_payslips', JSON.stringify(payslips)); } catch {}
  }, [payslips]);

  const addStaffMember = async (staffData: Omit<StaffMember, 'id' | 'createdAt'>): Promise<StaffMember> => {
    const newStaff: StaffMember = {
      ...staffData,
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    setStaffMembers(prev => [newStaff, ...prev]);
    return newStaff;
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>): Promise<void> => {
    setStaffMembers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const markAttendance = async (records: Omit<AttendanceRecord, 'id'>[]): Promise<void> => {
    const newRecords: AttendanceRecord[] = records.map(r => ({
      ...r,
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    }));
    setAttendanceRecords(prev => {
      // Overwrite if same staff and same date exists
      const filtered = prev.filter(p => !newRecords.some(n => n.staffId === p.staffId && n.date === p.date));
      return [...newRecords, ...filtered];
    });
  };

  const getStaffAttendanceForMonth = useCallback((staffId: string, month: string): AttendanceRecord[] => {
    return attendanceRecords.filter(r => r.staffId === staffId && r.date.startsWith(month));
  }, [attendanceRecords]);

  const submitLeaveRequest = async (leaveData: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<void> => {
    const newLeave: LeaveRequest = {
      ...leaveData,
      id: `leave-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    setLeaveRequests(prev => [newLeave, ...prev]);
  };

  const updateLeaveStatus = async (id: string, status: 'Approved' | 'Rejected', notes?: string): Promise<void> => {
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status, notes: notes || l.notes } : l));
  };

    const runPayroll = async (
    month: string,
    adjustments?: Record<string, { bonus?: number; allowances?: number; deductions?: number }>
  ): Promise<PayrollRun> => {
    const activeStaff = staffMembers.filter(s => s.status === 'Active' || s.isActive !== false);
    const runId = `pr-${Date.now()}`;

    let totalGrossSalary = 0;
    let totalAllowances = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalNetPayout = 0;

    const generatedSlips: Payslip[] = activeStaff.map(staff => {
      const staffAtt = attendanceRecords.filter(a => a.staffId === staff.id && a.date.startsWith(month));
      const presentDays = staffAtt.filter(a => a.status === 'Present').length;
      const totalHours = staffAtt.reduce((sum, a) => sum + (a.hoursWorked || 8), 0);
      const paidLeaves = staffAtt.filter(a => a.status === 'On Leave' || a.status === 'Holiday').length;
      const unpaidLeaves = staffAtt.filter(a => a.status === 'Absent').length;

      let baseSalary = staff.baseSalary;
      if (staff.salaryType === 'Hourly') {
        baseSalary = totalHours * (staff.hourlyRate || (staff.baseSalary / 160));
      } else if (staff.salaryType === 'Daily') {
        baseSalary = (presentDays + paidLeaves) * (staff.dailyRate || (staff.baseSalary / 26));
      } else {
        const perDayRate = staff.baseSalary / 30;
        baseSalary = Math.max(0, staff.baseSalary - (unpaidLeaves * perDayRate));
      }

      const overtimePay = staffAtt.reduce((sum, a) => sum + ((a.overtimeHours || 0) * ((staff.hourlyRate || 100) * 1.5)), 0);
      const adj = adjustments?.[staff.id] || {};
      const allowances = adj.allowances || 0;
      const bonus = adj.bonus || 0;
      const deductions = adj.deductions || 0;
      const netPay = Math.round(baseSalary + overtimePay + allowances + bonus - deductions);

      totalGrossSalary += baseSalary;
      totalAllowances += allowances;
      totalBonuses += bonus;
      totalDeductions += deductions;
      totalNetPayout += netPay;

      return {
        id: `slip-${Date.now()}-${staff.id}`,
        payrollRunId: runId,
        staffId: staff.id,
        staffName: staff.name,
        staffCode: staff.code,
        month,
        baseSalary: Math.round(baseSalary),
        workingDays: 26,
        presentDays,
        paidLeaves,
        unpaidLeaves,
        overtimePay: Math.round(overtimePay),
        bonus,
        allowances,
        deductions,
        netPay,
        status: 'Draft',
        paymentMethod: staff.bankAccount?.accountNumber || staff.bankAccountNumber ? 'Bank Transfer' : 'Cash'
      };
    });

    const newRun: PayrollRun = {
      id: runId,
      payrollMonth: month,
      runDate: new Date().toISOString(),
      totalGrossSalary: Math.round(totalGrossSalary),
      totalAllowances,
      totalBonuses,
      totalDeductions,
      totalNetPayout,
      staffCount: activeStaff.length,
      status: 'Approved',
      createdAt: new Date().toISOString()
    };

    setPayrollRuns(prev => [newRun, ...prev]);
    setPayslips(prev => [...generatedSlips, ...prev]);

    // Automatically post to Expenses ledger under category 'Salary'
    try {
      await addExpense({
        category: 'Salary',
        amount: totalNetPayout,
        date: new Date().toISOString().split('T')[0],
        paymentAccount: 'Main Cash Account',
        description: `Staff Payroll for ${month} (${activeStaff.length} employees)`,
        costCentre: 'HR & Operations',
        vendor: 'Internal Staff'
      });
    } catch (e) {
      console.warn('Failed to auto-post payroll to expenses:', e);
    }

    return newRun;
  };

  // =========================================================================
  // INBOUND CUSTOMER ORDERS & DELIVERY
  // =========================================================================
  const [inboundOrders, setInboundOrders] = useState<InboundCustomerOrder[]>(() => {
    try {
      const saved = localStorage.getItem('erp_inbound_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem('erp_inbound_orders', JSON.stringify(inboundOrders)); } catch {}
  }, [inboundOrders]);

  const createInboundOrder = async (orderData: Omit<InboundCustomerOrder, 'id' | 'createdAt' | 'orderNumber'>): Promise<InboundCustomerOrder> => {
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: InboundCustomerOrder = {
      ...orderData,
      id: `inb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      createdAt: new Date().toISOString()
    };
    setInboundOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateInboundOrderStatus = async (orderId: string, status: InboundCustomerOrder['status'], notes?: string): Promise<void> => {
    setInboundOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, notes: notes || o.notes } : o));
  };

  const assignOrderToSalesperson = async (orderId: string, salespersonId: string, salespersonName: string): Promise<void> => {
    setInboundOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      assignedDeliveryPersonId: salespersonId,
      assignedDeliveryPersonName: salespersonName,
      status: 'Assigned for Delivery'
    } : o));
  };

  const updateDeliveryStatus = async (invoiceId: string, status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled'): Promise<void> => {
    setSalesInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, deliveryStatus: status } : inv));
  };

  // =========================================================================
  // REPACKAGING, ASSEMBLY & BULK CONVERSION STATE & METHODS
  // =========================================================================
  const [repackagingRuns, setRepackagingRuns] = useState<ProductRepackagingRun[]>(() => {
    try {
      const saved = localStorage.getItem('erp_repackaging_runs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('erp_repackaging_runs', JSON.stringify(repackagingRuns));
    } catch {}
  }, [repackagingRuns]);

  const createRepackagingRun = async (
    runData: Omit<ProductRepackagingRun, 'id' | 'createdAt' | 'conversionNumber'>
  ): Promise<ProductRepackagingRun> => {
    const conversionNumber = `CONV-${Date.now().toString().slice(-6)}`;
    const newRun: ProductRepackagingRun = {
      ...runData,
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversionNumber,
      createdAt: new Date().toISOString()
    };

    // 1. Deduct bulk source inventory
    setProducts(prev =>
      prev.map(p => {
        if (p.id === runData.sourceProductId) {
          const newStock = Math.max(0, p.currentStock - runData.sourceQtyUsed);
          return { ...p, currentStock: newStock };
        }
        return p;
      })
    );

    // 2. Increment stock or create packaged items
    setProducts(prev => {
      let updated = [...prev];
      for (const out of runData.outputs) {
        const existingIdx = updated.findIndex(
          p => p.id === out.targetProductId || p.name.toLowerCase() === out.targetProductName.toLowerCase()
        );
        if (existingIdx >= 0) {
          const existing = updated[existingIdx];
          updated[existingIdx] = {
            ...existing,
            currentStock: existing.currentStock + out.outputQty,
            costPrice: out.costPerUnit,
            purchasePrice: out.costPerUnit,
            sellingPrice: out.sellingPrice || existing.sellingPrice,
            retailPrice: out.sellingPrice || existing.retailPrice,
            barcode: out.barcode || existing.barcode
          };
        } else {
          const newProd: Product = {
            id: out.targetProductId || `prod-pack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: out.targetProductName,
            code: `PKT-${Date.now().toString().slice(-4)}`,
            sku: `PKT-${Date.now().toString().slice(-4)}`,
            barcode: out.barcode || `${Date.now().toString().slice(-8)}`,
            category: 'Packaged Goods',
            brand: company.name || 'In-House Packaged',
            description: `Packaged from bulk ${runData.sourceProductName} (${out.packSize} ${out.packUnit})`,
            hsn: '0000',
            taxRate: 5,
            purchasePrice: out.costPerUnit,
            costPrice: out.costPerUnit,
            sellingPrice: out.sellingPrice,
            retailPrice: out.sellingPrice,
            wholesalePrice: out.sellingPrice * 0.9,
            mrp: Math.round(out.sellingPrice * 1.15),
            minSellingPrice: out.costPerUnit,
            openingStock: 0,
            openingStockValue: 0,
            currentStock: out.outputQty,
            primaryUnit: out.packUnit || 'Pkt',
            warehouse: runData.warehouseName || 'Main Store',
            rack: 'A1',
            batchTracking: true,
            serialTracking: false,
            expiryTracking: false,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          updated.push(newProd);
        }
      }
      return updated;
    });

    setRepackagingRuns(prev => [newRun, ...prev]);
    return newRun;
  };

  // =========================================================================
  // COMBO KITTING & DE-BUNDLING STATE
  // =========================================================================
  const [comboKitRuns, setComboKitRuns] = useState<ComboKitRun[]>(() => {
    try { const s = localStorage.getItem('erp_combo_kit_runs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [debundlingRuns, setDebundlingRuns] = useState<DebundlingRun[]>(() => {
    try { const s = localStorage.getItem('erp_debundling_runs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('erp_combo_kit_runs', JSON.stringify(comboKitRuns)); } catch {}
  }, [comboKitRuns]);

  useEffect(() => {
    try { localStorage.setItem('erp_debundling_runs', JSON.stringify(debundlingRuns)); } catch {}
  }, [debundlingRuns]);

  const createComboKitRun = async (runData: Omit<ComboKitRun, 'id' | 'createdAt' | 'kitNumber'>): Promise<ComboKitRun> => {
    const kitNumber = `KIT-${Date.now().toString().slice(-6)}`;
    const newRun: ComboKitRun = {
      ...runData,
      id: `kit-${Date.now()}`,
      kitNumber,
      createdAt: new Date().toISOString()
    };

    // Deduct component stocks
    setProducts(prev => {
      let updated = [...prev];
      for (const comp of runData.components) {
        const totalQtyNeeded = comp.qty * runData.kitsProduced;
        updated = updated.map(p => p.id === comp.productId ? { ...p, currentStock: Math.max(0, p.currentStock - totalQtyNeeded) } : p);
      }

      // Add or update combo product
      const comboIdx = updated.findIndex(p => p.name.toLowerCase() === runData.comboProductName.toLowerCase() || p.sku === runData.comboSku);
      if (comboIdx >= 0) {
        const existing = updated[comboIdx];
        updated[comboIdx] = {
          ...existing,
          currentStock: existing.currentStock + runData.kitsProduced,
          costPrice: runData.costPerKit,
          sellingPrice: runData.sellingPrice,
          retailPrice: runData.sellingPrice
        };
      } else {
        const newCombo: Product = {
          id: `prod-combo-${Date.now()}`,
          name: runData.comboProductName,
          code: runData.comboSku || `KIT-${Date.now().toString().slice(-4)}`,
          sku: runData.comboSku || `KIT-${Date.now().toString().slice(-4)}`,
          barcode: runData.comboBarcode || `${Date.now().toString().slice(-8)}`,
          category: 'Combo & Hampers',
          brand: company.name || 'In-House Assembly',
          description: `Assembled Combo Kit (${runData.components.map((c: ComboKitComponent) => c.productName).join(' + ')})`,
          hsn: '0000',
          taxRate: 5,
          purchasePrice: runData.costPerKit,
          costPrice: runData.costPerKit,
          sellingPrice: runData.sellingPrice,
          retailPrice: runData.sellingPrice,
          wholesalePrice: runData.sellingPrice * 0.9,
          mrp: Math.round(runData.sellingPrice * 1.15),
          minSellingPrice: runData.costPerKit,
          openingStock: 0,
          openingStockValue: 0,
          currentStock: runData.kitsProduced,
          primaryUnit: 'Kit',
          warehouse: runData.warehouseName || 'Main Store',
          rack: 'A1',
          batchTracking: true,
          serialTracking: false,
          expiryTracking: false,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        updated.push(newCombo);
      }
      return updated;
    });

    setComboKitRuns(prev => [newRun, ...prev]);
    return newRun;
  };

  const createDebundlingRun = async (runData: Omit<DebundlingRun, 'id' | 'createdAt' | 'debundleNumber'>): Promise<DebundlingRun> => {
    const debundleNumber = `DEB-${Date.now().toString().slice(-6)}`;
    const newRun: DebundlingRun = {
      ...runData,
      id: `deb-${Date.now()}`,
      debundleNumber,
      createdAt: new Date().toISOString()
    };

    // Deduct case stock & credit loose units
    setProducts(prev => {
      let updated = [...prev];
      updated = updated.map(p => p.id === runData.caseProductId ? { ...p, currentStock: Math.max(0, p.currentStock - runData.casesOpened) } : p);

      const looseIdx = updated.findIndex(p => p.id === runData.looseProductId || p.name.toLowerCase() === runData.looseProductName.toLowerCase());
      if (looseIdx >= 0) {
        const existing = updated[looseIdx];
        updated[looseIdx] = {
          ...existing,
          currentStock: existing.currentStock + runData.totalLooseUnitsProduced,
          costPrice: runData.costPerUnit,
          sellingPrice: runData.sellingPricePerUnit || existing.sellingPrice,
          retailPrice: runData.sellingPricePerUnit || existing.retailPrice
        };
      }
      return updated;
    });

    setDebundlingRuns(prev => [newRun, ...prev]);
    return newRun;
  };

  // =========================================================================
  // CASH DRAWER SHIFT SETTLEMENT (Z-REPORT) & JOURNAL VOUCHERS & ADVANCES
  // =========================================================================
  const [shiftSettlements, setShiftSettlements] = useState<DayEndShiftSettlement[]>(() => {
    try { const s = localStorage.getItem('erp_shift_settlements'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [journalVouchers, setJournalVouchers] = useState<JournalVoucher[]>(() => {
    try { const s = localStorage.getItem('erp_journal_vouchers'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [staffAdvances, setStaffAdvances] = useState<StaffAdvanceRecord[]>(() => {
    try { const s = localStorage.getItem('erp_staff_advances'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('erp_shift_settlements', JSON.stringify(shiftSettlements)); } catch {}
  }, [shiftSettlements]);

  useEffect(() => {
    try { localStorage.setItem('erp_journal_vouchers', JSON.stringify(journalVouchers)); } catch {}
  }, [journalVouchers]);

  useEffect(() => {
    try { localStorage.setItem('erp_staff_advances', JSON.stringify(staffAdvances)); } catch {}
  }, [staffAdvances]);

  const recordShiftSettlement = async (settlementData: Omit<DayEndShiftSettlement, 'id' | 'createdAt' | 'settlementNumber'>): Promise<DayEndShiftSettlement> => {
    const settlementNumber = `Z-${Date.now().toString().slice(-6)}`;
    const newSettlement: DayEndShiftSettlement = {
      ...settlementData,
      id: `shift-${Date.now()}`,
      settlementNumber,
      createdAt: new Date().toISOString()
    };
    setShiftSettlements(prev => [newSettlement, ...prev]);
    return newSettlement;
  };

  const createJournalVoucher = async (voucherData: Omit<JournalVoucher, 'id' | 'createdAt' | 'voucherNumber'>): Promise<JournalVoucher> => {
    const voucherNumber = `JV-${Date.now().toString().slice(-6)}`;
    const newVoucher: JournalVoucher = {
      ...voucherData,
      id: `jv-${Date.now()}`,
      voucherNumber,
      createdAt: new Date().toISOString()
    };
    setJournalVouchers(prev => [newVoucher, ...prev]);

    // Double-entry ledger balance update
    setAccounts(prevAccounts => {
      return prevAccounts.map(acc => {
        const line = voucherData.entries.find((e: JournalEntryLine) => e.accountId === acc.id);
        if (!line) return acc;
        const delta = acc.isDebit ? (line.type === 'Debit' ? line.amount : -line.amount) : (line.type === 'Credit' ? line.amount : -line.amount);
        return {
          ...acc,
          balance: acc.balance + delta
        };
      });
    });

    return newVoucher;
  };

  const recordStaffAdvance = async (advanceData: Omit<StaffAdvanceRecord, 'id' | 'createdAt'>): Promise<StaffAdvanceRecord> => {
    const newAdvance: StaffAdvanceRecord = {
      ...advanceData,
      id: `adv-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setStaffAdvances(prev => [newAdvance, ...prev]);
    return newAdvance;
  };

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
    generateNextBatchNumber,
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
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
    updatePurchaseOrderDetails,
    confirmPurchaseOrderReceived,
    receiveAndSavePurchaseOrder,
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
    createPurchaseRequest: handleCreatePurchaseRequest,
    updatePurchaseRequest: handleUpdatePurchaseRequest,
    updatePurchaseRequestStatus: handleUpdatePurchaseRequestStatus,
    cancelPurchaseRequest: handleCancelPurchaseRequest,
    deletePurchaseRequest: handleDeletePurchaseRequest,
    createPurchaseOrderFromRequest: handleCreatePurchaseOrderFromRequest,
    approvePurchaseRequestWithOrder: handleApprovePurchaseRequestWithOrder,
    recordGoodsReceipt: handleRecordGoodsReceipt,
    recordSupplierDelivery: handleRecordSupplierDelivery,
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
    recordOpeningStock,
    recordStockBundle,
    getWarehouseStock,
    getProductStockByWarehouse,
    validateSaleStock,
    refreshStockBalances,
    batches,
    addBatch,
    updateBatch,
    serialNumbers,
    addSerialNumber,
    updateSerialNumber,
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
    clearAllMockData,

    // HR & Payroll
    staffMembers,
    addStaffMember,
    updateStaffMember,
    attendanceRecords,
    markAttendance,
    getStaffAttendanceForMonth,
    leaveRequests,
    submitLeaveRequest,
    updateLeaveStatus,
    payrollRuns,
    payslips,
    runPayroll,

    // Inbound Orders & Delivery
    inboundOrders,
    createInboundOrder,
    updateInboundOrderStatus,
    assignOrderToSalesperson,
    updateDeliveryStatus,

    // Repackaging & Conversion
    repackagingRuns,
    createRepackagingRun,

    // Combo Kitting & De-bundling
    comboKitRuns,
    createComboKitRun,
    debundlingRuns,
    createDebundlingRun,

    // Cash Drawer Shift Settlement & Z-Report
    shiftSettlements,
    recordShiftSettlement,

    // Manual Double-Entry Journal Vouchers (JV)
    journalVouchers,
    createJournalVoucher,

    // Staff Salary Advance
    staffAdvances,
    recordStaffAdvance
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
    generateNextBatchNumber,
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
    updatePurchaseOrderDetails,
    confirmPurchaseOrderReceived,
    receiveAndSavePurchaseOrder,
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
    handleRecordSupplierDelivery,
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
    recordOpeningStock,
    recordStockBundle,
    getWarehouseStock,
    getProductStockByWarehouse,
    validateSaleStock,
    refreshStockBalances,
    batches,
    addBatch,
    updateBatch,
    serialNumbers,
    addSerialNumber,
    updateSerialNumber,
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
    clearAllMockData,
    staffMembers,
    attendanceRecords,
    leaveRequests,
    payrollRuns,
    payslips,
    inboundOrders,
    repackagingRuns,
    comboKitRuns,
    debundlingRuns,
    shiftSettlements,
    journalVouchers,
    staffAdvances
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
