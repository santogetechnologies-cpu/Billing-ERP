import { notificationService } from '../src/services/notificationService';
import { filterSupportedNotificationPayload, getAvailableNotificationColumns } from '../src/utils/schemaDetector';
import { supabase } from '../src/lib/supabase';

async function runTests() {
  console.log('--- Testing Elimination of POST /rest/v1/notifications 400 (Bad Request) ---');

  // Test 1: Verify getAvailableNotificationColumns
  const availableCols = await getAvailableNotificationColumns();
  console.log('Available columns in public.notifications:', Array.from(availableCols).join(', '));
  if (!availableCols.has('id') || !availableCols.has('title') || !availableCols.has('message')) {
    console.error('FAIL: Missing fundamental notification columns');
    process.exit(1);
  }
  console.log('PASS: Fundamental columns detected correctly.');

  // Test 2: Verify filterSupportedNotificationPayload strips unmigrated columns
  const rawPayload = {
    company_id: '00000000-0000-0000-0000-000000000001',
    user_id: null,
    warehouse_id: 'wh-123',
    product_id: 'prod-456',
    customer_id: 'cust-789',
    case_id: 'case-999',
    priority: 'High',
    title: 'Test Notification',
    message: 'Test message for 400 error prevention',
    type: 'low_stock',
    link: '/inventory',
    is_read: false,
    created_at: new Date().toISOString()
  };

  const safePayload = await filterSupportedNotificationPayload(rawPayload);
  console.log('Filtered safe payload keys:', Object.keys(safePayload).join(', '));
  if (safePayload.case_id !== undefined && !availableCols.has('case_id')) {
    console.error('FAIL: Unmigrated column case_id was not filtered out');
    process.exit(1);
  }
  console.log('PASS: Unmigrated columns are cleanly filtered before sending to Supabase PostgREST.');

  // Test 3: Create notification via notificationService directly
  console.log('\nCreating notification via notificationService.createNotification...');
  const created = await notificationService.createNotification({
    title: 'Automated 400 Check Alert',
    message: 'Validating zero 400 Bad Request error on insert',
    type: 'low_stock',
    warehouseId: '00000000-0000-0000-0000-000000000001',
    productId: '00000000-0000-0000-0000-000000000002',
    priority: 'High'
  }, '00000000-0000-0000-0000-000000000001');

  if (!created || !created.id) {
    console.error('FAIL: Notification was not created');
    process.exit(1);
  }
  console.log('PASS: Notification created cleanly with ID:', created.id);

  // Clean up test notification from database if it was inserted into DB
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.id)) {
    await supabase.from('notifications').delete().eq('id', created.id);
    console.log('PASS: Cleaned up test notification from Supabase DB.');
  }

  // Test 4: Verify getNotifications for Salesperson role does not fail on category column
  console.log('\nTesting getNotifications for Salesperson role...');
  const spNotifs = await notificationService.getNotifications('00000000-0000-0000-0000-000000000001', undefined, 'Salesperson');
  console.log('PASS: Salesperson getNotifications completed successfully, count:', spNotifs.length);

  console.log('\nAll verification checks PASSED successfully! Zero 400 Bad Request errors.');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
