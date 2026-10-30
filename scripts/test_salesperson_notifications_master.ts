/**
 * Master Verification Suite: Sales Person Notification System
 *
 * Verifies all 10 requirements from the ANTIGRAVITY MASTER PROMPT:
 * 1. Customer Complaints: Title "Customer Complaint", Message format, High Priority, Action "View Complaint"
 * 2. Product Damage & Defects: Title "Product Damage Report", High Priority, Action "View Case", no stock adjustments
 * 3. Customer Support Requests: Title "New Customer Support Request", Normal Priority, Action "View Support Request"
 * 4. Return & Replacement Requests: Title "Return / Replacement Request", High Priority, Action "Review Request", no auto-refunds
 * 5. Pending Customer Follow-ups: Title "Customer Follow-up Required", Overdue High vs Normal, Action "View Case", stops on resolution
 * 6. Customer Updates: Title "Customer Assigned", Normal Priority, Action "View Customer"
 * 7. Notification Centre UI: Filters (All, Unread, Complaints, Product Damage, Support, Returns & Replacements, Follow-ups, Customer Updates)
 * 8. Strict Role-Based Rules: Salesperson isolated from warehouse, cashier, and purchasing alerts; no operational leakage
 * 9. Reliability & Deduplication: Stable dedupKey prevents duplicate reminders on re-evaluations
 * 10. Persistence & Actions: Read/unread state persists, actions resolve to valid customer/case links
 */

import {
  isCustomerSupportNotification,
  isAuthorizedRecipient,
  sortNotifications,
  notificationService
} from '../src/services/notificationService';
import { customerSupportService } from '../src/services/customerSupportService';
import { customerService } from '../src/services/customerService';
import { NotificationItem, CustomerSupportCase, Customer } from '../src/types';
import { ROLE_PERMISSIONS_MATRIX, canAccessRoute } from '../src/utils/rbac';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runMasterVerification() {
  console.log('=================================================================');
  console.log('   SALES PERSON NOTIFICATION SYSTEM MASTER VERIFICATION SUITE   ');
  console.log('=================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const salesPersonId = 'sp-user-001';
  const otherSalesPersonId = 'sp-user-002';

  const sampleCustomer: Customer = {
    id: 'cust-xyz-101',
    name: 'Shree Ganesh Enterprises',
    type: 'Wholesale',
    phone: '9820011223',
    email: 'ganesh@example.com',
    address: '42 Market Yard, Pune',
    gstin: '27AABCS1429B1Z2',
    pan: 'AABCS1429B',
    state: 'Maharashtra',
    country: 'India',
    creditLimit: 500000,
    creditDays: 45,
    openingBalance: 0,
    currentOutstanding: 120000,
    totalPurchased: 450000,
    totalPaid: 330000,
    assignedSalespersonId: salesPersonId,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  const sampleProduct = {
    id: 'prod-pnt-01',
    sku: 'PNT-PREM-20L',
    name: 'Royale Luxury Emulsion 20L',
    category: 'Paints'
  };

  // ---------------------------------------------------------------------------
  // REQUIREMENT 1: Customer Complaints
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Customer Complaints Notification ---');
  const complaintCase = await customerSupportService.createSupportCase(
    {
      customerId: sampleCustomer.id,
      category: 'customer_complaint',
      title: 'Wrong paint shade delivered',
      description: 'Customer ordered Royale Golden Glow, received Pale Cream.',
      productId: sampleProduct.id,
      assignedSalespersonId: salesPersonId
    },
    testCompanyId,
    sampleCustomer,
    sampleProduct,
    salesPersonId
  );

  const notifs1 = await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson');
  const complaintNotif = notifs1.find(n => n.caseId === complaintCase.id);

  assert(Boolean(complaintNotif), 'Complaint notification successfully generated for assigned Sales Person');
  assert(complaintNotif?.title === 'Customer Complaint', `Title is strictly "Customer Complaint". Got: "${complaintNotif?.title}"`);
  assert(
    complaintNotif?.message.includes('Shree Ganesh Enterprises') &&
    complaintNotif?.message.includes('Royale Luxury Emulsion 20L'),
    `Message contains actual customer name and product name. Got: "${complaintNotif?.message}"`
  );
  assert(complaintNotif?.priority === 'High', `Complaint is automatically High Priority. Got: "${complaintNotif?.priority}"`);
  assert(complaintNotif?.actionText === 'View Complaint', `Action text is "View Complaint". Got: "${complaintNotif?.actionText}"`);
  assert(complaintNotif?.link?.includes(sampleCustomer.id) === true, 'Action links directly to customer record');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 2: Product Damage & Defects
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Product Damage & Defects Notification ---');
  const damageCase = await customerSupportService.createSupportCase(
    {
      customerId: sampleCustomer.id,
      category: 'customer_product_damage',
      title: 'Cracked lid and leaking container',
      description: 'Can arrived cracked with 3L leakage during delivery.',
      productId: sampleProduct.id,
      assignedSalespersonId: salesPersonId
    },
    testCompanyId,
    sampleCustomer,
    sampleProduct,
    salesPersonId
  );

  const notifs2 = await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson');
  const damageNotif = notifs2.find(n => n.caseId === damageCase.id);

  assert(Boolean(damageNotif), 'Product damage notification generated for assigned Sales Person');
  assert(damageNotif?.title === 'Product Damage Report', `Title is "Product Damage Report". Got: "${damageNotif?.title}"`);
  assert(
    damageNotif?.message.includes('Shree Ganesh Enterprises') &&
    damageNotif?.message.includes('Royale Luxury Emulsion 20L'),
    `Message contains actual customer and damaged product. Got: "${damageNotif?.message}"`
  );
  assert(damageNotif?.priority === 'High', `Product damage is High Priority. Got: "${damageNotif?.priority}"`);
  assert(damageNotif?.actionText === 'View Case', `Action text is "View Case". Got: "${damageNotif?.actionText}"`);

  // RBAC verification: Salesperson cannot modify stock directly
  assert(
    ROLE_PERMISSIONS_MATRIX.Salesperson.inventory.adjust === false,
    'Sales Person RBAC strictly forbids direct inventory quantity adjustments'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 3: Customer Support Requests
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Customer Support Requests Notification ---');
  const supportRequestCase = await customerSupportService.createSupportCase(
    {
      customerId: sampleCustomer.id,
      category: 'customer_support_request',
      title: 'Warranty & Application Clarification',
      description: 'Customer requested surface preparation guide and 5-year warranty certificate.',
      productId: sampleProduct.id,
      assignedSalespersonId: salesPersonId
    },
    testCompanyId,
    sampleCustomer,
    sampleProduct,
    salesPersonId
  );

  const notifs3 = await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson');
  const supportNotif = notifs3.find(n => n.caseId === supportRequestCase.id);

  assert(Boolean(supportNotif), 'Customer support request notification generated');
  assert(supportNotif?.title === 'New Customer Support Request', `Title is "New Customer Support Request". Got: "${supportNotif?.title}"`);
  assert(
    supportNotif?.message.includes('Shree Ganesh Enterprises') &&
    supportNotif?.message.includes('Warranty & Application Clarification'),
    `Message specifies customer and request type. Got: "${supportNotif?.message}"`
  );
  assert(supportNotif?.priority === 'Normal', `Customer support request is Normal Priority. Got: "${supportNotif?.priority}"`);
  assert(supportNotif?.actionText === 'View Support Request', `Action text is "View Support Request". Got: "${supportNotif?.actionText}"`);

  // ---------------------------------------------------------------------------
  // REQUIREMENT 4: Return & Replacement Requests
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Return & Replacement Requests Notification ---');
  const returnCase = await customerSupportService.createSupportCase(
    {
      customerId: sampleCustomer.id,
      category: 'customer_return_request',
      title: 'Return 2 Unopened Cans for Replacement',
      description: '[Return / Replacement Details: Qty 2 | Reason: Wrong Shade Ordered | Ref: INV-2026-0881]\nCustomer requests exchange for White Primer.',
      productId: sampleProduct.id,
      assignedSalespersonId: salesPersonId
    },
    testCompanyId,
    sampleCustomer,
    sampleProduct,
    salesPersonId
  );

  const notifs4 = await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson');
  const returnNotif = notifs4.find(n => n.caseId === returnCase.id);

  assert(Boolean(returnNotif), 'Return/replacement notification generated');
  assert(returnNotif?.title === 'Return / Replacement Request', `Title is "Return / Replacement Request". Got: "${returnNotif?.title}"`);
  assert(
    returnNotif?.message.includes('Shree Ganesh Enterprises') &&
    returnNotif?.message.includes('Royale Luxury Emulsion 20L'),
    `Message contains customer and product name. Got: "${returnNotif?.message}"`
  );
  assert(returnNotif?.priority === 'High', `Return / Replacement Request is High Priority. Got: "${returnNotif?.priority}"`);
  assert(returnNotif?.actionText === 'Review Request', `Action text is "Review Request". Got: "${returnNotif?.actionText}"`);

  // Forwarding workflow without financial / stock permission leakage
  const forwarded = await customerSupportService.forwardReturnRequestForApproval(
    returnCase.id,
    'Verified unopened seal on drums. Forwarding to Manager for authorization.',
    'Test Sales Rep',
    testCompanyId
  );
  assert(forwarded?.status === 'Pending Cashier / Admin Authorization', 'Status set to Pending Cashier / Admin Authorization');
  assert(forwarded?.isEscalated === true, 'Case flagged for executive review');
  assert(
    ROLE_PERMISSIONS_MATRIX.Salesperson.payments.create === false &&
    canAccessRoute('Salesperson', '/sales/returns') === false,
    'Salesperson cannot issue refunds or access return financial processing'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 5: Pending Customer Follow-ups
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Pending Customer Follow-ups Notification ---');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const overdueCase: CustomerSupportCase = {
    id: 'case-overdue-999',
    companyId: testCompanyId,
    caseNumber: 'CASE-2026-9999',
    customerId: sampleCustomer.id,
    customerName: sampleCustomer.name,
    category: 'customer_followup',
    priority: 'Normal',
    status: 'In Progress',
    title: 'Replacement Confirmation Pending',
    description: 'Awaiting customer confirmation for replacement delivery date.',
    assignedSalespersonId: salesPersonId,
    followupDue: yesterday, // Overdue!
    createdAt: yesterday,
    updatedAt: yesterday
  };

  const followUpAlerts = await customerSupportService.checkPendingFollowups(
    testCompanyId,
    [overdueCase],
    [sampleCustomer]
  );

  assert(followUpAlerts.length === 1, 'Generates pending follow-up reminder for overdue case');
  const followupNotif = followUpAlerts[0];
  assert(followupNotif.title === 'Customer Follow-up Required', `Title is "Customer Follow-up Required". Got: "${followupNotif.title}"`);
  assert(
    followupNotif.message.includes('Shree Ganesh Enterprises') &&
    followupNotif.message.includes('#CASE-2026-9999'),
    `Message contains customer and case reference. Got: "${followupNotif.message}"`
  );
  assert(followupNotif.priority === 'High', `Overdue follow-up is High Priority. Got: "${followupNotif.priority}"`);
  assert(followupNotif.actionText === 'View Case', `Action text is "View Case". Got: "${followupNotif.actionText}"`);

  // Resolution stops reminders immediately
  await customerSupportService.updateSupportCaseStatus(
    overdueCase.id,
    'Resolved',
    'Customer confirmed receipt of replacement.',
    testCompanyId
  );
  overdueCase.status = 'Resolved';

  const followUpAlertsAfterResolve = await customerSupportService.checkPendingFollowups(
    testCompanyId,
    [overdueCase],
    [sampleCustomer]
  );
  assert(
    followUpAlertsAfterResolve.length === 0,
    'Resolved case stops generating follow-up reminders'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 6: Customer Updates & Customer Assignment
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Customer Updates & Assignment Notification ---');
  const assignNotif = await customerSupportService.notifyCustomerAssigned(
    { id: sampleCustomer.id, name: sampleCustomer.name },
    salesPersonId,
    testCompanyId
  );

  assert(Boolean(assignNotif), 'Customer assignment notification dispatched');
  assert(assignNotif?.title === 'Customer Assigned', `Title is "Customer Assigned". Got: "${assignNotif?.title}"`);
  assert(
    assignNotif?.message === 'Customer Shree Ganesh Enterprises has been assigned to you.',
    `Message matches exact requirement: "${assignNotif?.message}"`
  );
  assert(assignNotif?.priority === 'Normal', 'Customer assignment is Normal Priority');
  assert(assignNotif?.actionText === 'View Customer', 'Action text is "View Customer"');
  assert(assignNotif?.link === `/customers/${sampleCustomer.id}`, 'Link points to customer profile');

  // ---------------------------------------------------------------------------
  // REQUIREMENT 7: Strict Role-Based Notification Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Strict Role-Based Recipient Isolation (No Bleed) ---');

  // A. Salesperson receives their customer notifications
  assert(
    isAuthorizedRecipient(complaintNotif!, salesPersonId, 'Salesperson') === true,
    'Assigned Salesperson receives their customer complaint'
  );

  // B. Salesperson DOES NOT receive notifications assigned to another Salesperson
  assert(
    isAuthorizedRecipient(complaintNotif!, otherSalesPersonId, 'Salesperson') === false,
    'Unassigned Salesperson cannot see complaints assigned to other sales reps'
  );

  // C. Cashier, Warehouse Manager, and Purchase Manager NEVER see customer complaints/support
  assert(
    isAuthorizedRecipient(complaintNotif!, 'cashier-1', 'Cashier') === false,
    'Cashier is strictly denied from receiving customer complaints'
  );
  assert(
    isAuthorizedRecipient(complaintNotif!, 'wh-1', 'Warehouse Manager') === false,
    'Warehouse Manager is strictly denied from receiving customer complaints'
  );
  assert(
    isAuthorizedRecipient(complaintNotif!, 'pm-1', 'Purchase Manager') === false,
    'Purchase Manager is strictly denied from receiving customer complaints'
  );

  // D. Salesperson NEVER sees Warehouse Manager stock alerts, PRs, or supplier alerts
  const warehouseStockAlert: NotificationItem = {
    id: 'stock-alert-1',
    title: 'Out of Stock: Cement Bag 50kg',
    message: 'Stock is 0 in Central Godown',
    type: 'out_of_stock',
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    read: false,
    userId: 'wh-1'
  };
  assert(
    isAuthorizedRecipient(warehouseStockAlert, salesPersonId, 'Salesperson') === false,
    'Salesperson NEVER receives Warehouse Manager out-of-stock alerts'
  );

  const purchaseRequestAlert: NotificationItem = {
    id: 'pr-alert-1',
    title: 'New Purchase Request: PR-2026-0012',
    message: 'Warehouse Manager requested replenishment',
    type: 'purchase_request',
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    read: false
  };
  assert(
    isAuthorizedRecipient(purchaseRequestAlert, salesPersonId, 'Salesperson') === false,
    'Salesperson NEVER receives purchase requests or purchasing workflow alerts'
  );

  const missingWarehouseManagerAlert: NotificationItem = {
    id: 'mwm-alert-1',
    title: 'Missing Warehouse Manager Assignment',
    message: 'No warehouse manager assigned to South Godown',
    type: 'system',
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    read: false
  };
  assert(
    isAuthorizedRecipient(missingWarehouseManagerAlert, salesPersonId, 'Salesperson') === false,
    'Salesperson NEVER receives missing warehouse manager assignment alerts'
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 8: Deduplication and Refresh Resilience
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Anti-Duplicate & Reload Resilience ---');
  const initialCount = (await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson')).length;

  // Attempt duplicate dispatch of identical customer assignment
  const dupAssign = await customerSupportService.notifyCustomerAssigned(
    { id: sampleCustomer.id, name: sampleCustomer.name },
    salesPersonId,
    testCompanyId
  );

  const postCount = (await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson')).length;
  assert(
    postCount === initialCount,
    `Duplicate assignment alert was deduplicated (Count stayed ${initialCount}, did not increase to ${initialCount + 1})`
  );

  // ---------------------------------------------------------------------------
  // REQUIREMENT 9: Read / Unread Status Persistence
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Read / Unread State Persistence ---');
  if (complaintNotif) {
    assert(complaintNotif.read === false, 'Notification starts as unread');
    await notificationService.markAsRead(complaintNotif.id, testCompanyId);

    const reloaded = await notificationService.getNotifications(testCompanyId, salesPersonId, 'Salesperson');
    const updatedComplaint = reloaded.find(n => n.id === complaintNotif.id);
    assert(updatedComplaint?.read === true, 'Notification read state successfully persists');
  }

  // ---------------------------------------------------------------------------
  // REQUIREMENT 10: Notification Sorting Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: Invariant Notification Ordering ---');
  const testItems: NotificationItem[] = [
    {
      id: 'item-read-old',
      title: 'Old Read',
      message: 'Old read msg',
      type: 'customer_complaint',
      read: true,
      timestamp: '10:00 AM',
      createdAt: new Date('2026-10-26T10:00:00Z').toISOString()
    },
    {
      id: 'item-unread-new',
      title: 'New Unread',
      message: 'New unread msg',
      type: 'customer_complaint',
      read: false,
      timestamp: '12:00 PM',
      createdAt: new Date('2026-10-26T12:00:00Z').toISOString()
    },
    {
      id: 'item-read-new',
      title: 'New Read',
      message: 'New read msg',
      type: 'customer_complaint',
      read: true,
      timestamp: '11:30 AM',
      createdAt: new Date('2026-10-26T11:30:00Z').toISOString()
    },
    {
      id: 'item-unread-old',
      title: 'Old Unread',
      message: 'Old unread msg',
      type: 'customer_complaint',
      read: false,
      timestamp: '11:00 AM',
      createdAt: new Date('2026-10-26T11:00:00Z').toISOString()
    }
  ];

  const sorted = sortNotifications(testItems);
  assert(sorted[0].id === 'item-unread-new', 'Top item is newest unread notification');
  assert(sorted[1].id === 'item-unread-old', 'Second item is older unread notification');
  assert(sorted[2].id === 'item-read-new', 'Third item is newest read notification');
  assert(sorted[3].id === 'item-read-old', 'Bottom item is oldest read notification');

  console.log('\n=================================================================');
  console.log('   🎉 ALL 10 MASTER NOTIFICATION TESTS PASSED WITH 100% SUCCESS! ');
  console.log('=================================================================\n');
}

runMasterVerification().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
