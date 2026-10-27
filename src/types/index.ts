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
}

export type StockStatusType = 'Active' | 'Limited Stock' | 'Out of Stock' | 'Not Set' | 'Warning';

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
  status: 'Active' | 'Inactive' | 'Blocked';
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
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
}

export type PurchaseDocType =
  | 'purchase_invoice'
  | 'purchase_order'
  | 'purchase_quotation'
  | 'purchase_receipt'
  | 'purchase_return';

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
  | 'Other';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  tax: number;
  vendor: string;
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

export type TransferStatus = 'Completed' | 'Requested' | 'Approved' | 'Sent' | 'Received' | 'Cancelled' | 'Rejected';

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
  email: string;
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
  | 'Partially Received'
  | 'Completed'
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
  items: PurchaseRequestItem[];
  history?: PurchaseRequestHistory[];
  createdAt: string;
  updatedAt: string;
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
export type CustomerReturnStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Stock Restocked';
export type CustomerReturnRefundStatus = 'Pending' | 'Refunded' | 'Rejected' | 'No Refund Required';

export interface CustomerReturn {
  id: string;
  companyId: string;
  returnNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  returnDate: string;
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
  condition?: CustomerReturnCondition;
  returnedQty?: number;
  warehouseId?: string;
  warehouseName?: string;
  notes?: string;
  refundAmount?: number;
  updatedBy?: string;
  updatedByName?: string;
}

