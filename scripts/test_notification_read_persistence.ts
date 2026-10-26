import { supabase } from '../src/lib/supabase';
import { notificationService } from '../src/services/notificationService';

async function runPersistenceTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: NOTIFICATION READ STATUS PERSISTENCE IN DATABASE');
  console.log('================================================================================\n');

  const companyId = '00000000-0000-0000-0000-000000000001';
  // Real users from public.profiles
  const userA = '40abf63f-2e5d-4a97-a2f2-1717437af804'; // purchase@gmail.com (Purchase Manager)
  const roleA = 'Purchase Manager';

  const userB = '9f54b96d-805e-467e-9480-617b13bbc1c3'; // sales@gmail.com (Salesperson)
  const roleB = 'Salesperson';

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Mark one notification as read -> refresh -> it remains read
    // -------------------------------------------------------------------------
    console.log('--- 1. Mark One Notification as Read & Refresh Persistence ---');
    
    // Create an unread test notification for User A
    const testNotif1 = await notificationService.createNotification(
      {
        title: `Test Unread Item ${Date.now()}`,
        message: 'Testing single mark as read persistence',
        type: 'purchase_order',
        userId: userA,
        priority: 'Normal'
      },
      companyId
    );
    assert(!testNotif1.read, 'New notification is created with read = false');

    // Mark it as read
    await notificationService.markAsRead(testNotif1.id, companyId, userA);

    // Verify in database immediately
    const { data: dbItem1 } = await supabase
      .from('notifications')
      .select('id, is_read')
      .eq('id', testNotif1.id)
      .single();
    assert(dbItem1?.is_read === true, 'Notification is_read is permanently true in Supabase database');

    // Simulate page refresh (re-fetching via getNotifications)
    const refreshedNotifs1 = await notificationService.getNotifications(companyId, userA, roleA);
    const reloadedItem1 = refreshedNotifs1.find(n => n.id === testNotif1.id);
    assert(Boolean(reloadedItem1 && reloadedItem1.read), 'Notification remains read after full page refresh');

    // -------------------------------------------------------------------------
    // TEST 2: Mark all as read -> refresh -> all remain read
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Mark All as Read & Zero Unread Persistence ---');

    // Create 2 new unread notifications for User A
    const nA1 = await notificationService.createNotification(
      {
        title: `Batch Test A1 ${Date.now()}`,
        message: 'Batch unread item 1',
        type: 'purchase_order',
        userId: userA
      },
      companyId
    );
    const nA2 = await notificationService.createNotification(
      {
        title: `Batch Test A2 ${Date.now()}`,
        message: 'Batch unread item 2',
        type: 'purchase_order',
        userId: userA
      },
      companyId
    );

    const beforeMarkAll = await notificationService.getNotifications(companyId, userA, roleA);
    const unreadBefore = beforeMarkAll.filter(n => !n.read).length;
    assert(unreadBefore >= 2, `User A has unread notifications before mark all (${unreadBefore} unread)`);

    // Call markAllAsRead
    const unreadIds = beforeMarkAll.filter(n => !n.read).map(n => n.id);
    await notificationService.markAllAsRead(companyId, userA, roleA, unreadIds);

    // Verify in database that test items are is_read = true
    const { data: dbCheckA } = await supabase
      .from('notifications')
      .select('id, is_read')
      .in('id', [nA1.id, nA2.id]);
    assert(
      Boolean(dbCheckA && dbCheckA.every(r => r.is_read === true)),
      'All notifications for User A are saved as is_read = true in database'
    );

    // Simulate page refresh
    const afterMarkAll = await notificationService.getNotifications(companyId, userA, roleA);
    const unreadAfter = afterMarkAll.filter(n => !n.read).length;
    assert(unreadAfter === 0, `Unread count is exactly 0 after refresh (got: ${unreadAfter})`);
    assert(
      afterMarkAll.every(n => n.read === true),
      'All notifications for User A remain read after refresh'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Create a new notification -> only the new notification is unread
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Create New Notification -> Only New Item is Unread ---');

    const brandNew = await notificationService.createNotification(
      {
        title: `Brand New Alert ${Date.now()}`,
        message: 'This should be the only unread notification',
        type: 'purchase_order',
        userId: userA
      },
      companyId
    );

    const recheckNotifs = await notificationService.getNotifications(companyId, userA, roleA);
    const unreadItems = recheckNotifs.filter(n => !n.read);
    assert(unreadItems.length === 1, `Exactly 1 notification is unread after adding new alert (got: ${unreadItems.length})`);
    assert(unreadItems[0].id === brandNew.id, 'The single unread notification is the newly created alert');

    const previouslyRead = recheckNotifs.filter(n => n.id !== brandNew.id);
    assert(
      previouslyRead.length > 0 && previouslyRead.every(n => n.read === true),
      'All previously marked read notifications remain read'
    );

    // -------------------------------------------------------------------------
    // TEST 4: User-specific notification handling: User B is unaffected
    // -------------------------------------------------------------------------
    console.log('\n--- 4. User Isolation: User A actions do not affect User B ---');

    // Create an unread customer support notification for User B (Salesperson)
    const notifForB = await notificationService.createNotification(
      {
        title: `User B Unread Alert ${Date.now()}`,
        message: 'Support notification for Salesperson',
        type: 'customer_complaint',
        category: 'customer_complaint',
        userId: userB
      },
      companyId
    );

    // Verify User B has this unread notification
    const userBBefore = await notificationService.getNotifications(companyId, userB, roleB);
    const bFoundBefore = userBBefore.find(n => n.id === notifForB.id);
    assert(Boolean(bFoundBefore && !bFoundBefore.read), 'User B has unread notification');

    // Now User A (Purchase Manager) marks all as read
    const userANotifs = await notificationService.getNotifications(companyId, userA, roleA);
    await notificationService.markAllAsRead(
      companyId,
      userA,
      roleA,
      userANotifs.filter(n => !n.read).map(n => n.id)
    );

    // Verify User B's notification is STILL UNREAD in both database and getNotifications
    const { data: dbItemB } = await supabase
      .from('notifications')
      .select('id, is_read')
      .eq('id', notifForB.id)
      .single();
    assert(dbItemB?.is_read === false, 'User B notification is_read is STILL false in database');

    const userBAfter = await notificationService.getNotifications(companyId, userB, roleB);
    const bFoundAfter = userBAfter.find(n => n.id === notifForB.id);
    assert(Boolean(bFoundAfter && !bFoundAfter.read), 'User B notification remains unread after User A mark all');

    // -------------------------------------------------------------------------
    // TEST 5: Clean up test notifications
    // -------------------------------------------------------------------------
    const testIds = [testNotif1.id, nA1.id, nA2.id, brandNew.id, notifForB.id];
    await supabase.from('notifications').delete().in('id', testIds);

    console.log('\n================================================================================');
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED:      ${passed}`);
    console.log(`FAILED:      ${failed}`);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL PERSISTENCE AND ISOLATION TESTS PASSED!');
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runPersistenceTestSuite();
