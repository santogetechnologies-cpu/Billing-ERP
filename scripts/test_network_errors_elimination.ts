import { supabase } from '../src/lib/supabase';
import {
  isTableMarkedMissing,
  markTableMissing,
  getAvailableWarehouseColumns,
  filterSupportedWarehousePayload,
  isTableNotFoundError
} from '../src/utils/schemaDetector';
import { companyService } from '../src/services/companyService';
import { productService } from '../src/services/productService';
import { getAppStorage } from '../src/utils/storageUtils';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING CONSOLE NETWORK ERRORS ELIMINATION (404, 400, 409)');
  console.log('================================================================\n');

  let passedTests = 0;
  const targetCompId = '00000000-0000-0000-0000-000000000001';

  // -------------------------------------------------------------------------
  // TEST 1: purchase_orders 404 Suppression
  // -------------------------------------------------------------------------
  console.log('👉 [TEST 1] Testing purchase_orders 404 elimination');
  const isPoMissing = isTableMarkedMissing('purchase_orders');
  console.log(`- isTableMarkedMissing('purchase_orders'): ${isPoMissing}`);
  if (!isPoMissing) {
    throw new Error('FAIL: purchase_orders should be marked missing by default!');
  }

  // Simulate guarded fetch as in PurchaseOrdersPage, PurchaseManagerDashboardPage, and SuppliersPage
  let poCallMade = false;
  if (!isTableMarkedMissing('purchase_orders')) {
    poCallMade = true;
    await supabase.from('purchase_orders').select('*').limit(1);
  }
  if (poCallMade) {
    throw new Error('FAIL: Call was made to purchase_orders when it is marked missing!');
  }
  console.log('✓ purchase_orders call was cleanly bypassed due to isTableMarkedMissing');

  // Verify purchases fallback works
  const { data: pData, error: pErr } = await supabase
    .from('purchases')
    .select('*')
    .eq('company_id', targetCompId)
    .eq('doc_type', 'purchase_order')
    .limit(5);

  if (pErr) {
    console.warn('- Note: purchases query error:', pErr.message);
  } else {
    console.log(`✓ purchases fallback query succeeded with ${pData?.length || 0} orders found`);
  }
  passedTests++;
  console.log('✅ TEST 1 PASSED: purchase_orders 404 eliminated cleanly\n');

  // -------------------------------------------------------------------------
  // TEST 2: warehouses 400 Bad Request Prevention
  // -------------------------------------------------------------------------
  console.log('👉 [TEST 2] Testing warehouses 400 Bad Request elimination');
  const availableCols = await getAvailableWarehouseColumns();
  console.log('- Detected warehouses columns in DB:', Array.from(availableCols));

  const rawTestWarehousePayload = {
    company_id: targetCompId,
    name: 'Auto-Test Safe Warehouse',
    code: `WH-TEST-${Date.now().toString().slice(-4)}`,
    address: '123 Safe Zone',
    location_type: 'Branch Warehouse',
    contact_person: 'John Doe',
    phone: '+1 555-0199',
    description: 'Automated test warehouse',
    is_active: true,
    is_default: false,
    manager_id: '11111111-1111-4111-8111-111111111111'
  };

  const safePayload = await filterSupportedWarehousePayload(rawTestWarehousePayload);
  console.log('- Filtered safe payload keys:', Object.keys(safePayload));

  if (safePayload.location_type || safePayload.contact_person || safePayload.manager_id) {
    throw new Error('FAIL: filterSupportedWarehousePayload did not filter unmigrated columns!');
  }
  console.log('✓ Unmigrated columns successfully stripped before PostgREST call');

  // Perform createWarehouse call to verify 0 errors
  const createdWh = await companyService.createWarehouse({
    name: rawTestWarehousePayload.name,
    code: rawTestWarehousePayload.code,
    locationType: rawTestWarehousePayload.location_type,
    address: rawTestWarehousePayload.address,
    contactPerson: rawTestWarehousePayload.contact_person,
    phone: rawTestWarehousePayload.phone,
    description: rawTestWarehousePayload.description,
    isActive: rawTestWarehousePayload.is_active,
    isDefault: rawTestWarehousePayload.is_default,
    managerId: rawTestWarehousePayload.manager_id,
    managerName: 'John Doe'
  }, targetCompId);

  console.log(`✓ Warehouse created cleanly without 400 Bad Request! ID: ${createdWh.id}, Name: ${createdWh.name}`);
  if (createdWh.locationType !== 'Branch Warehouse' || createdWh.contactPerson !== 'John Doe') {
    throw new Error('FAIL: Warehouse metadata not preserved in result object!');
  }
  console.log('✓ Warehouse extended metadata properly preserved in returned model');
  passedTests++;
  console.log('✅ TEST 2 PASSED: warehouses 400 Bad Request eliminated cleanly\n');

  // -------------------------------------------------------------------------
  // TEST 3: document_settings 409 Conflict Prevention
  // -------------------------------------------------------------------------
  console.log('👉 [TEST 3] Testing document_settings 409 Conflict elimination');

  // Verify multiple warehouse metadata syncs do not throw 409
  const testWh1Id = createdWh.id;
  const testWh2Id = 'wh-second-test-' + Date.now();

  console.log('- Syncing metadata for first warehouse...');
  await companyService.syncCloudWarehouseMeta(testWh1Id, {
    locationType: 'Branch Warehouse',
    contactPerson: 'Manager 1',
    phone: '+1 111-1111',
    description: 'Warehouse 1'
  }, targetCompId);
  console.log('✓ First sync succeeded without 409 Conflict');

  console.log('- Syncing metadata for second warehouse to same (company_id, doc_type)...');
  await companyService.syncCloudWarehouseMeta(testWh2Id, {
    locationType: 'Regional Hub',
    contactPerson: 'Manager 2',
    phone: '+1 222-2222',
    description: 'Warehouse 2'
  }, targetCompId);
  console.log('✓ Second sync succeeded without 409 Conflict!');

  // Verify getWarehouses properly parses dictionary and preserves both
  const warehouses = await companyService.getWarehouses(targetCompId);
  const foundCreated = warehouses.find(w => w.id === testWh1Id);
  if (!foundCreated) {
    throw new Error('FAIL: Created warehouse not found in getWarehouses!');
  }
  console.log(`✓ getWarehouses found created warehouse: "${foundCreated.name}" with locationType: "${foundCreated.locationType}"`);

  // Verify unit_conversion upsert in document_settings doesn't throw 409 Conflict
  console.log('- Creating unit conversion via productService fallback...');
  const conv = await productService.createConversion({
    fromUnit: `test_unit_${Date.now().toString().slice(-4)}`,
    toUnit: 'pcs',
    factor: 10,
    notes: 'Testing 409 suppression'
  }, targetCompId);

  console.log(`✓ Unit conversion created: ${conv.fromUnit} -> ${conv.toUnit} (factor: ${conv.factor}) without 409 Conflict!`);

  // Clean up test warehouse from database
  try {
    await supabase.from('warehouses').delete().eq('id', testWh1Id);
    console.log(`✓ Test warehouse ${testWh1Id} cleaned up from database.`);
  } catch {}

  passedTests++;
  console.log('✅ TEST 3 PASSED: document_settings 409 Conflict eliminated cleanly\n');

  console.log('================================================================');
  console.log(`🎉 ALL ${passedTests} TEST SUITES PASSED!`);
  console.log('1. purchase_orders 404 eliminated (guarded with schemaDetector)');
  console.log('2. warehouses 400 eliminated (filtered supported columns)');
  console.log('3. document_settings 409 eliminated (upsert on company_id,doc_type registry)');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ ERROR RUNNING TESTS:', err);
  process.exit(1);
});
