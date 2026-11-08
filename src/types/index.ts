// Type definitions for Universal Billing ERP

export type BusinessType =
  | 'Retail'
  | 'Wholesale'
  | 'Manufacturing'
  | 'Trading'
  | 'Distribution'
  | 'Services'
  | 'Restaurant'
  | 'Pharmacy'
  | 'Textile'
  | 'Construction'
  | 'Agriculture'
  | 'Other';

export interface CompanyProfile {
  id?: string;
  name: string;
  companyName?: string;
  logo: string;
  businessType: BusinessType;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  taxRegistration: string;
  currency: string;
  currencySymbol: string;
  financialYear: string;
  invoicePrefix: string;
  invoiceStartingNumber: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  termsAndConditions: string;
  primaryColor?: string;
  defaultWarehouseId?: string;
  shopMode?: 'small_shop' | 'retail_supermarket' | 'wholesale_distribution' | 'mall_multicounter';
  enableMultiTierPricing?: boolean;
  whatsappBusinessNumber?: string;
  whatsappOrderGreeting?: string;
}

export type UnitCategory = 'Count' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Volume Dimension' | 'Packaging' | 'Custom';

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  category: UnitCategory;
  isBase?: boolean;
  isCustom?: boolean;
}

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number; // e.g. 1 Bag = 50 Kg -> factor: 50
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  salePrice?: number;
  minStockLevel?: number;
  supplierName?: string;
  code: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory?: string;
  brand: string;
  description: string;
  hsn: string;
  taxRate: number; // e.g. 18 for 18%
  purchasePrice: number;
  costPrice: number;
  sellingPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice?: number;
  mrp: number;
  minSellingPrice: number;
  reorderLevel?: number | null; // Stock Warning Limit (null if Not Set)
  stockWarningLimit?: number | null; // Alias for reorderLevel
  targetStockLevel?: number | null;
  supplierId?: string;
  openingStock: number;
  openingStockValue: number;
  currentStock: number;
  primaryUnit: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  warehouse: string;
  rack: string;
  batchNumber?: string;
  expiryDate?: string;
  batchTracking: boolean;
  serialTracking: boolean;
  expiryTracking: boolean;
  isActive: boolean;
  stockStatus?: StockStatusType;
  imageUrl?: string;
  createdAt: string;

  // Multi-tier rates & manufacturer barcodes
  rateA?: number;
  rateB?: number;
  rateC?: number;
  rateD?: number;
  manufacturerBarcode?: string;
  isManufacturerBarcodeActive?: boolean;
  maxDiscountPercent?: number;
}

export type StockStatusType = 'Active' | 'Limited Stock' | 'Out of Stock' | 'Not Set' | 'Warning' | 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ProductDeletionEligibility {
  canDelete: boolean;
  reasons: string[];
  stock: number;
  stockBalancesCount: number;
  salesCount: number;
  purchasesCount: number;
  transactionsCount: number;
  transfersCount: number;
  batchesCount: number;
  serialsCount: number;
}

export type CustomerType = 'Retail' | 'Wholesale' | 'Corporate' | 'Dealer' | 'Distributor' | 'Other';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  pan: string;
  state: string;
  country: string;
  creditLimit: number;
  creditDays: number;
  openingBalance: number;
  currentOutstanding: number;
  totalPurchased: number;
  totalPaid: number;
  notes?: string;
  assignedSalespersonId?: string | null;
  assignedSalespersonName?: string;
  loyaltyPoints?: number;
  status: 'Active' | 'Inactive' | 'Blocked';
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  companyName?: string;
  state?: string;
  paymentTerms?: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  pan: string;
  creditDays: number;
  openingBalance: number;
  currentOutstanding: number;
  totalPurchases: number;
  totalPaid: number;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountName: string;
  };
  notes?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  discountAmt: number;
  taxRate: number;
  taxAmt: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  total: number;
  costPrice: number;
  batchNumber?: string;
  serialNumber?: string;
}

export type SalesDocType =
  | 'tax_invoice'
  | 'pos_invoice'
  | 'quotation'
  | 'estimate'
  | 'sales_order'
  | 'proforma_invoice'
  | 'delivery_challan'
  | 'credit_note'
  | 'debit_note'
  | 'sales_return';

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Credit';

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  docType: SalesDocType;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  billingAddress?: string;
  shippingAddress?: string;
  warehouseId: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  terms?: string;
  createdAt: string;

  // Multi-channel delivery & price tier tracking
  warehouseName?: string;
  orderSource?: 'pos' | 'direct' | 'whatsapp' | 'call' | 'app' | 'salesperson_route';
  deliveryType?: 'takeaway' | 'home_delivery' | 'store_supply';
  deliveryAddress?: string;
  assignedDeliveryPersonId?: string;
  assignedDeliveryPersonName?: string;
  deliveryStatus?: 'pending' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';
  priceTierApplied?: 'Rate A' | 'Rate B' | 'Rate C' | 'Rate D' | 'Standard';
  whatsappNotificationSent?: boolean;
}

export type PurchaseDocType =
  | 'purchase_invoice'
  | 'purchase_order'
  | 'purchase_quotation'
  | 'purchase_receipt'
  | 'purchase_return'
  | 'standard_invoice';

export type BillVerificationStatus =
  | 'Pending Review'
  | 'Approved for Payment'
  | 'Correction Requested';

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  docType: PurchaseDocType;
  date: string;
  dueDate?: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  items: {
    productId: string;
    productName: string;
    qty: number;
    unit: string;
    rate: number;
    discount: number;
    taxRate: number;
    taxAmt: number;
    total: number;
    isUnregistered?: boolean;
    isTemporary?: boolean;
    orderedQty?: number;
    receivedQty?: number;
    stockStatusAtOrder?: string;
  }[];
  subtotal: number;
  taxTotal: number;
  freightCharges: number;
  otherCharges: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  warehouse: string;
  notes?: string;
  createdAt: string;
  originalPurchaseId?: string;
  referenceNumber?: string;
  // Accountant workflow & PR/PO links
  supplierInvoiceNumber?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  purchaseRequestId?: string;
  purchaseRequestNumber?: string;
  verificationStatus?: BillVerificationStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  correctionNotes?: string;
  correctionRequestedAt?: string;
  hasDiscrepancy?: boolean;
  discrepancyNotes?: string;
  poStatus?: 'Ordered' | 'Partially Received' | 'Received';
  billStatus?: 'Not Complete' | 'Complete';
}

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Internet'
  | 'Telephone'
  | 'Salary'
  | 'Transport'
  | 'Fuel'
  | 'Maintenance'
  | 'Marketing'
  | 'Advertising'
  | 'Office Supplies'
  | 'Travel'
  | 'Food'
  | 'Bank Charges'
  | 'Insurance'
  | 'Professional Fees'
  | 'Taxes'
  | 'Depreciation'
  | 'Miscellaneous'
  | 'Other';

export interface Expense {
  id: string;
  expenseNumber?: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  tax?: number;
  vendor?: string;
  paymentAccount: string;
  description: string;
  costCentre: string;
  referenceNo?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  type: 'Received' | 'Paid';
  partyType: 'Customer' | 'Supplier' | 'Account';
  partyId: string;
  partyName: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  account: string;
  reference: string;
  notes: string;
  invoiceId?: string;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  date: string;
  type:
    | 'Opening Stock'
    | 'Purchase'
    | 'Sale'
    | 'Sales Return'
    | 'Purchase Return'
    | 'Stock Adjustment'
    | 'Stock Transfer'
    | 'Stock Consumption';
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  warehouse: string;
  warehouseTo?: string;
  referenceDoc: string;
  notes: string;
  createdAt: string;
}

export type WarehouseType =
  | 'Main Warehouse'
  | 'Branch Warehouse'
  | 'Godown'
  | 'Store'
  | 'Other Location';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type?: WarehouseType;
  locationType?: WarehouseType;
  address: string;
  contactPerson?: string;
  phone?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  managerId?: string | null;
  managerName?: string;
  managerIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StockBalance {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  updatedAt?: string;
}

export type TransferStatus = 'Completed' | 'Requested' | 'Approved' | 'Sent' | 'Received' | 'Cancelled' | 'Rejected' | 'In Transit';

export interface StockTransferItem {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  qty: number;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  serialNumber?: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  date: string;
  fromWarehouse: string;
  fromWarehouseId?: string;
  toWarehouse: string;
  toWarehouseId?: string;
  items: StockTransferItem[];
  status: TransferStatus;
  notes?: string;
  referenceDoc?: string;
  createdBy?: string;
  approvedBy?: string;
  sentDate?: string;
  receivedDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Batch {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  purchaseDate: string;
  cost: number;
  qty: number;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Low Stock';
  warehouseId?: string;
  warehouseName?: string;
}

export interface SerialNumber {
  id: string;
  productId: string;
  productName: string;
  serialNumber: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  purchaseDate: string;
  warrantyMonths: number;
  warrantyStatus: 'Active' | 'Expired' | 'In Stock';
}

export type AccountCategory = 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses';

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  balance: number;
  isDebit: boolean;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  openingBalance: number;
  currentBalance: number;
  reconciledBalance: number;
}

export interface CashAccount {
  id: string;
  name: string; // Cash, Petty Cash, Main Cash, Branch Cash
  currentBalance: number;
  openingBalance: number;
}

export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Accountant'
  | 'Salesperson'
  | 'Purchase Manager'
  | 'Warehouse Manager'
  | 'Cashier';

export interface Permission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export type AccountStatus = 'Enabled' | 'Disabled';
export type PresenceStatus = 'Active' | 'Inactive';

export interface SystemUser {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'Active' | 'Inactive'; // Backwards compatible account/presence status
  accountStatus: AccountStatus;
  presenceStatus: PresenceStatus;
  lastLogin: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  lastLogoutAt?: string;
}

export type UserSessionStatus = 'Active' | 'Completed' | 'Expired';

export interface UserSession {
  id: string;
  userId: string;
  companyId: string;
  userName?: string;
  userEmail?: string;
  userRole?: UserRole;
  sessionToken?: string;
  loginAt: string;
  logoutAt?: string | null;
  lastHeartbeatAt: string;
  durationSeconds: number;
  status: UserSessionStatus;
  deviceInfo?: string;
  ipAddress?: string;
  sessionType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserActivitySummary {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  status: PresenceStatus;
  currentLoginAt?: string | null;
  lastLogoutAt?: string | null;
  lastLoginAt?: string | null;
  currentSessionDurationSeconds: number;
  totalDurationSeconds: number;
  avgSessionDurationSeconds: number;
  longestSessionSeconds: number;
  shortestSessionSeconds: number;
  lastActivityAt?: string | null;
  sessionCount: number;
  activeSessionId?: string | null;
}

export interface ActivityOverviewStats {
  longestIndividualSessionUser?: {
    userId: string;
    name: string;
    role: UserRole;
    durationSeconds: number;
    sessionDate: string;
  } | null;
  shortestCompletedSessionUser?: {
    userId: string;
    name: string;
    role: UserRole;
    durationSeconds: number;
    sessionDate: string;
  } | null;
  highestTotalDurationUser?: {
    userId: string;
    name: string;
    role: UserRole;
    durationSeconds: number;
  } | null;
  lowestTotalDurationUser?: {
    userId: string;
    name: string;
    role: UserRole;
    durationSeconds: number;
  } | null;
  activeUsersCount: number;
  inactiveUsersCount: number;
  totalSessionsToday: number;
  avgSessionDurationSeconds: number;
}


export interface AuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  record: string;
  oldValue: string;
  newValue: string;
  date: string;
  time: string;
}

export type CustomerSupportCategory =
  | 'customer_complaint'
  | 'customer_product_damage'
  | 'customer_support_request'
  | 'customer_return_request'
  | 'customer_followup'
  | 'customer_update';

export type CustomerSupportCaseStatus =
  | 'Open'
  | 'In Progress'
  | 'Pending Customer Information'
  | 'Pending Cashier / Admin Authorization'
  | 'Resolved'
  | 'Closed';

export type CustomerSupportPriority = 'High' | 'Medium' | 'Low' | 'Critical' | 'Normal';

export interface CustomerSupportCaseNote {
  id: string;
  author: string;
  authorRole?: string;
  text: string;
  createdAt: string;
}

export interface CustomerSupportCase {
  id: string;
  companyId: string;
  caseNumber: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  category: CustomerSupportCategory;
  priority: CustomerSupportPriority;
  status: CustomerSupportCaseStatus;
  title: string;
  description: string;
  productId?: string | null;
  productName?: string;
  invoiceId?: string | null;
  invoiceNumber?: string;
  assignedSalespersonId?: string | null;
  assignedSalespersonName?: string;
  followupDue?: string | null;
  resolutionNotes?: string;
  notes?: CustomerSupportCaseNote[];
  isEscalated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type:
    | 'low_stock'
    | 'limited_stock'
    | 'out_of_stock'
    | 'expiring_batch'
    | 'overdue_invoice'
    | 'credit_limit'
    | 'payment_received'
    | 'system'
    | 'purchase_request'
    | 'stock_damage'
    | 'purchase_order'
    | 'supplier_update'
    | 'customer_complaint'
    | 'customer_product_damage'
    | 'customer_support_request'
    | 'customer_return_request'
    | 'customer_followup'
    | 'customer_update'
    | (string & {});
  timestamp: string;
  createdAt?: string;
  read: boolean;
  link?: string;
  userId?: string | null;
  warehouseId?: string | null;
  productId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  invoiceNumber?: string | null;
  paymentNumber?: string | null;
  warehouseName?: string;
  // Customer Support Notification Metadata
  priority?: CustomerSupportPriority;
  category?: CustomerSupportCategory | string;
  customerId?: string | null;
  customerName?: string;
  productName?: string;
  caseId?: string | null;
  caseNumber?: string | null;
  caseStatus?: CustomerSupportCaseStatus | string;
  followupDue?: string | null;
  actionText?: string;
  dedupKey?: string;
  isEscalated?: boolean;
}

export interface HeldInvoice {
  id: string;
  customerId?: string;
  heldAt: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  note?: string;
}

// =============================================================================
// PURCHASE REQUEST WORKFLOW TYPES
// =============================================================================
export type PurchaseRequestStatus =
  | 'Draft'
  | 'Pending Review'
  | 'Pending Approval'
  | 'Under Review'
  | 'Clarification Requested'
  | 'Approved'
  | 'Rejected'
  | 'Ordered'
  | 'Active'
  | 'Partially Received'
  | 'Completed'
  | 'Delivered'
  | 'Cancelled';

export type PurchaseRequestPriority = 'Normal' | 'High' | 'Urgent';

export interface PurchaseRequestItem {
  id: string;
  requestId: string;
  productId: string;
  productName: string;
  sku?: string;
  currentStock: number;
  warningLimit?: number | null;
  requestedQty: number;
  approvedQty?: number | null;
  receivedQty: number;
  remainingQty?: number;
  receivingStatus?: 'Not Received' | 'Partially Received' | 'Fully Received';
  unit: string;
  estimatedCost?: number;
  adjustmentReason?: string;
  isCustom?: boolean;
  createdAt?: string;
}

export interface PurchaseRequestHistory {
  id: string;
  requestId: string;
  statusFrom?: string;
  statusTo: PurchaseRequestStatus;
  userId: string;
  userName: string;
  role?: string;
  comments?: string;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  companyId: string;
  requestNumber: string;
  warehouseId: string;
  warehouseName: string;
  requesterId: string;
  requesterName: string;
  requesterRole?: string;
  status: PurchaseRequestStatus;
  priority: PurchaseRequestPriority;
  reason?: string;
  requestedDeliveryDate?: string;
  notes?: string;
  reviewerId?: string;
  reviewerName?: string;
  rejectionReason?: string;
  clarificationNotes?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  supplierId?: string;
  supplierName?: string;
  supplierGstin?: string;
  items: PurchaseRequestItem[];
  history?: PurchaseRequestHistory[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Supplier-Wise Delivery & Goods Receiving Types
// ---------------------------------------------------------------------------
export type SupplierDeliveryStatus = 'Pending' | 'Partially Received' | 'Received / Completed';

export interface SupplierDeliveryPurchaseOrderSummary {
  orderId: string;
  orderNumber: string;
  purchaseRequestId?: string;
  purchaseOrderId?: string;
  docType?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  deliveryStatus: SupplierDeliveryStatus;
  orderedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number;
  productsCount: number;
  totalValue: number;
  hasSupplierBill: boolean;
  supplierInvoiceNumber?: string;
}

export interface SupplierDeliveryProductItem {
  id: string; // unique row id (e.g. `${orderId}_${itemId}`)
  orderId: string; // PO ID or PR ID
  orderNumber: string; // PO Number (e.g. PO-2026-4816)
  purchaseOrderId?: string;
  purchaseRequestId?: string;
  itemId: string; // raw line item id
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number;
  currentStock: number;
  rate: number;
  totalValue: number;
  requiresBatch: boolean;
  requiresExpiry: boolean;
  batchNumber?: string;
  expiryDate?: string;
  mfgDate?: string;
  expectedDeliveryDate?: string;
  receivingStatus: SupplierDeliveryStatus;
}

export interface SupplierDeliveryGroup {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  supplierContact: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierGstin?: string;
  supplierAddress?: string;
  warehouseId: string;
  warehouseName: string;
  purchaseOrders: SupplierDeliveryPurchaseOrderSummary[];
  purchaseOrderNumbers: string[];
  purchaseOrderIds: string[];
  items: SupplierDeliveryProductItem[];
  purchaseOrdersCount: number;
  productsPendingCount: number;
  totalOrderedQuantity: number;
  totalPreviouslyReceivedQuantity: number;
  totalOutstandingQuantity: number;
  totalDeliveryValue: number;
  expectedDeliveryDate: string;
  isOverdue: boolean;
  deliveryStatus: SupplierDeliveryStatus;
  hasSupplierBill: boolean;
  supplierInvoiceNumber?: string;
}

export interface RecordSupplierDeliveryInput {
  supplierId: string;
  receivingWarehouseId: string;
  supplierInvoiceNumber?: string;
  deliveryRemarks?: string;
  receivedItems: Array<{
    itemId: string;
    orderId: string;
    purchaseOrderId?: string;
    purchaseRequestId?: string;
    productId: string;
    arrivedQty: number;
    damagedQty?: number;
    acceptedQty?: number;
    batchNumber?: string;
    expiryDate?: string;
    mfgDate?: string;
  }>;
}

export interface SupplierDeliveryReceiptResult {
  supplierId: string;
  updatedOrders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    receivedQty: number;
    acceptedQty: number;
  }>;
  totalAcceptedQty: number;
  totalDamagedQty: number;
}

export interface CreatePurchaseRequestInput {
  warehouseId: string;
  warehouseName: string;
  priority: PurchaseRequestPriority;
  reason?: string;
  requestedDeliveryDate?: string;
  notes?: string;
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    currentStock: number;
    warningLimit?: number | null;
    requestedQty: number;
    unit: string;
    estimatedCost?: number;
  }>;
}

export type PolicyStatus = 'Draft' | 'Published' | 'Archived';
export type PolicyCategory =
  | 'General'
  | 'Warehouse & Inventory'
  | 'Sales & Credit'
  | 'Procurement & Purchasing'
  | 'Financial & Accounting'
  | 'Data & Security'
  | 'HR & Attendance';

export interface CompanyPolicy {
  id: string;
  companyId: string;
  title: string;
  code: string;
  category: PolicyCategory | string;
  content: string;
  version: string;
  effectiveDate: string;
  status: PolicyStatus;
  createdBy?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
}

export interface CompanyPolicyHistory {
  id: string;
  policyId: string;
  action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived' | 'deleted';
  performedBy?: string;
  performedByName?: string;
  performedByRole?: string;
  details?: string;
  createdAt: string;
}

export interface UserPreferences {
  userId: string;
  companyId?: string;
  accentColor: 'blue' | 'green' | 'red' | 'dark_grey';
  language?: string;
  dateFormat?: string;
  numberFormat?: string;
  defaultRoute?: string;
  notifications?: {
    stockAlerts?: boolean;
    salesNotifications?: boolean;
    billingAlerts?: boolean;
    policyUpdates?: boolean;
    soundEnabled?: boolean;
  };
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Barcode Management & Supplier Barcode Override Types
// ---------------------------------------------------------------------------

export type BarcodeMethod = 'MANUAL_ENTRY' | 'SUPPLIER_OVERRIDE';

export interface BarcodeAuditLog {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  sku: string;
  method: BarcodeMethod;
  oldBarcode: string;
  newBarcode: string;
  oldSellingPrice: number | null;
  newSellingPrice: number | null;
  priceUpdated: boolean;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  reason: string;
  userId: string;
  userName: string;
  userRole: string;
  createdAt: string;
}

export interface BarcodeOverrideInput {
  productId: string;
  method: BarcodeMethod;
  newBarcode: string;
  updatePrice?: boolean;
  newSellingPrice?: number;
  reason: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
}

export interface BarcodeValidationResult {
  isValid: boolean;
  conflict: boolean;
  conflictingProduct?: {
    id: string;
    name: string;
    sku: string;
    barcode: string;
  } | null;
  isSameAsCurrent?: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Customer Return Management Types
// ---------------------------------------------------------------------------

export type CustomerReturnCondition = 'Resalable' | 'Damaged' | 'Defective' | 'Expired';
export type CustomerReturnStatus = 'Pending Review' | 'Pending' | 'Approved' | 'Rejected' | 'Stock Restocked';
export type CustomerReturnRefundStatus = 'Pending' | 'Refunded' | 'Rejected' | 'No Refund Required';

export interface CustomerReturn {
  id: string;
  companyId: string;
  returnNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  returnDate: string;
  purchaseDate?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  soldQty: number;
  returnedQty: number;
  unit: string;
  unitPrice: number;
  refundAmount: number;
  reason: string;
  returnProblem?: string;
  complaintDescription?: string;
  photos?: string[];
  condition: CustomerReturnCondition;
  warehouseId?: string;
  warehouseName?: string;
  returnStatus: CustomerReturnStatus;
  refundStatus: CustomerReturnRefundStatus;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  restockedBy?: string;
  restockedByName?: string;
  restockedAt?: string;
  refundedBy?: string;
  refundedByName?: string;
  refundedAt?: string;
  refundMethod?: string;
  updatedBy?: string;
  updatedByName?: string;
  auditTrail?: Array<{
    date: string;
    editedBy: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  directRestock?: boolean;
  isDirectReturn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerReturnInput {
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  returnDate: string;
  purchaseDate?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  soldQty: number;
  returnedQty: number;
  unit: string;
  unitPrice: number;
  refundAmount?: number;
  reason: string;
  returnProblem?: string;
  complaintDescription?: string;
  photos?: string[];
  condition: CustomerReturnCondition;
  warehouseId?: string;
  warehouseName?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  directRestock?: boolean;
  returnStatus?: CustomerReturnStatus;
}

export interface UpdateCustomerReturnInput {
  customerName?: string;
  customerPhone?: string;
  reason?: string;
  returnProblem?: string;
  complaintDescription?: string;
  photos?: string[];
  condition?: CustomerReturnCondition;
  returnedQty?: number;
  warehouseId?: string;
  warehouseName?: string;
  returnStatus?: CustomerReturnStatus;
  notes?: string;
  refundAmount?: number;
  updatedBy?: string;
  updatedByName?: string;
}


// =============================================================================
// HR, STAFF & PAYROLL MODULE TYPES
// =============================================================================
export type SalaryType = 'Monthly' | 'Hourly' | 'Daily';
export type EmploymentType = 'Full Time' | 'Part Time' | 'Contract' | 'Daily Wage';

export interface StaffMember {
  id: string;
  name: string;
  code: string;
  role: string;
  department: string;
  phone: string;
  email?: string;
  employmentType: EmploymentType;
  salaryType: SalaryType;
  baseSalary: number;
  hourlyRate?: number;
  joinDate: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
  };
  pan?: string;
  aadhaar?: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  allowedCasualLeaves: number;
  allowedSickLeaves: number;
  isActive?: boolean;
  dailyRate?: number;
  bankAccountNumber?: string;
  notes?: string;
  createdAt: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'On Leave' | 'Holiday' | 'Overtime';

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: 'Casual' | 'Sick' | 'Earned' | 'Unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  payrollMonth: string; // e.g. "2026-10"
  runDate: string;
  totalGrossSalary: number;
  totalAllowances: number;
  totalBonuses: number;
  totalDeductions: number;
  totalNetPayout: number;
  staffCount: number;
  status: 'Draft' | 'Approved' | 'Paid';
  paymentAccount?: string;
  expenseId?: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  month: string;
  baseSalary: number;
  workingDays: number;
  presentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  overtimePay: number;
  bonus: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'Draft' | 'Paid';
  paymentDate?: string;
  paymentMethod?: string;
}

// =============================================================================
// INBOUND CUSTOMER ORDERS & WHATSAPP DISPATCH
// =============================================================================
export interface CustomerCartItem {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  qty: number;
  unit: string;
  imageUrl?: string;
}

export interface InboundCustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  channel: 'WhatsApp' | 'Phone Call' | 'Customer Portal';
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: 'Pending Confirmation' | 'Confirmed' | 'Billed' | 'Assigned for Delivery' | 'Delivered' | 'Cancelled';
  assignedDeliveryPersonId?: string;
  assignedDeliveryPersonName?: string;
  paymentStatus: 'Pending' | 'Paid Online' | 'Cash on Delivery';
  notes?: string;
  createdAt: string;
}

// =============================================================================
// REPACKAGING, ASSEMBLY & BULK-TO-RETAIL CONVERSION
// =============================================================================
export interface RepackagingOutputItem {
  targetProductId: string;
  targetProductName: string;
  packSize: number; // e.g. 0.1 for 100g, 0.25 for 250g, 1 for 1kg
  packUnit: string; // 'Pcs', 'Pkt', 'Bag'
  outputQty: number; // number of packets produced (e.g. 200 packets)
  costPerUnit: number; // calculated cost per packet
  sellingPrice: number; // retail selling price per packet
  expectedRevenue: number; // outputQty * sellingPrice
  batchNumber?: string;
  barcode?: string;
  expiryDate?: string;
}

export interface ProductRepackagingRun {
  id: string;
  conversionNumber: string; // e.g. "CONV-2026-001"
  date: string;
  sourceProductId: string;
  sourceProductName: string;
  sourceUnit: string; // e.g. 'kg', 'Litre'
  sourceQtyUsed: number; // e.g. 100 kg
  sourceCostPerUnit: number; // purchase cost per kg/unit
  sourceTotalCost: number; // sourceQtyUsed * sourceCostPerUnit

  // Additional conversion overheads
  packagingMaterialCost: number; // pouches, labels, tape, bags
  laborAndOverheadCost: number; // packing labor & overheads
  totalProductionCost: number; // total landed cost of the conversion batch

  // Generated outputs (e.g. 100g, 250g, 1kg packets)
  outputs: RepackagingOutputItem[];

  // Revenue & Value-Add Tracking
  totalOutputWeightOrVolume: number;
  wasteOrLossQty: number; // shrinkage / process loss
  wasteOrLossCost: number;
  totalProjectedRevenue: number; // sum of expected revenue of all packed outputs
  projectedGrossProfit: number; // totalProjectedRevenue - totalProductionCost
  projectedMarginPercent: number;

  warehouseId: string;
  warehouseName: string;
  notes?: string;
  operatorName: string;
  createdAt: string;
}


// =============================================================================
// COMBO KITTING / BOM ASSEMBLY & DE-BUNDLING
// =============================================================================
export interface ComboKitComponent {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  costPrice: number;
}

export interface ComboKitRun {
  id: string;
  kitNumber: string;
  comboProductName: string;
  comboSku: string;
  comboBarcode?: string;
  kitsProduced: number;
  components: ComboKitComponent[];
  totalComponentCost: number;
  assemblyLaborCost: number;
  packagingCost: number;
  totalLandedCost: number;
  costPerKit: number;
  sellingPrice: number;
  projectedRevenue: number;
  grossMarginPct: number;
  warehouseId: string;
  warehouseName: string;
  notes?: string;
  createdAt: string;
}

export interface DebundlingRun {
  id: string;
  debundleNumber: string;
  caseProductId: string;
  caseProductName: string;
  casesOpened: number;
  caseCostPrice: number;
  totalCaseCost: number;
  looseProductId: string;
  looseProductName: string;
  looseBarcode?: string;
  unitsPerCase: number;
  totalLooseUnitsProduced: number;
  costPerUnit: number;
  sellingPricePerUnit: number;
  projectedRevenue: number;
  grossMarginPct: number;
  warehouseId: string;
  warehouseName: string;
  notes?: string;
  createdAt: string;
}

// =============================================================================
// CASH DRAWER DENOMINATIONS & DAY-END Z-REPORT SETTLEMENT
// =============================================================================
export interface CashDenominationBreakdown {
  note2000: number;
  note500: number;
  note200: number;
  note100: number;
  note50: number;
  note20: number;
  note10: number;
  coins: number;
  totalPhysicalCash: number;
}

export interface DayEndShiftSettlement {
  id: string;
  settlementNumber: string; // e.g. "Z-2026-10-31"
  cashierId: string;
  cashierName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  openingCash: number;
  cashSalesTotal: number;
  upiSalesTotal: number;
  cardSalesTotal: number;
  creditSalesTotal: number;
  cashExpensesTotal: number;
  cashRefundsTotal: number;
  expectedCashInDrawer: number;
  actualCashInDrawer: number;
  cashVariance: number; // positive = overage, negative = shortage
  denominations: CashDenominationBreakdown;
  notes?: string;
  status: 'Closed & Balanced' | 'Variance Flagged';
  createdAt: string;
}

// =============================================================================
// MANUAL DOUBLE-ENTRY JOURNAL VOUCHERS (JV)
// =============================================================================
export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  type: 'Debit' | 'Credit';
  amount: number;
  particulars?: string;
}

export interface JournalVoucher {
  id: string;
  voucherNumber: string; // e.g. "JV-2026-001"
  date: string;
  narration: string;
  entries: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdAt: string;
}

// =============================================================================
// STAFF SALARY ADVANCE & LOAN TRACKING
// =============================================================================
export interface StaffAdvanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  date: string;
  reason: string;
  disbursementMode?: 'Cash' | 'Bank Transfer' | 'UPI';
  status: 'Pending Deduction' | 'Deducted in Payroll';
  payrollRunId?: string;
  createdAt: string;
}
