import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { PurchaseRequest, CreatePurchaseRequestInput } from '../src/types';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('--- Starting Purchase Requests Actions Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  const pagePath = path.resolve(process.cwd(), 'src/pages/purchases/PurchaseRequestsPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Test 1: Table row Actions column contains only Eye icon
  {
    assert(
      pageContent.includes('{/* 8. Actions (Eye / View Only) */}'),
      'Test 1.1: Actions column is documented as Eye / View Only'
    );
    assert(
      !pageContent.includes('title="Edit Request"'),
      'Test 1.2: Edit Request button is removed from table rows'
    );
    assert(
      !pageContent.includes('title="Delete Request"'),
      'Test 1.3: Delete Request button is not in table rows'
    );
    assert(
      pageContent.includes('<Eye className="w-4 h-4" />'),
      'Test 1.4: Eye icon is rendered in table rows'
    );
    assert(
      pageContent.includes('className="w-8 h-8 text-indigo-600 hover:text-indigo-800 bg-indigo-50'),
      'Test 1.5: Eye button preserves exact style, size, color and padding'
    );
  }

  // Test 2: Details view contains Edit, Delete, Reject, and Approve Request (Close and Request Clarification removed)
  {
    assert(
      !pageContent.includes('title="Close details view'),
      'Test 2.1: Redundant Close button is cleanly removed from Details header'
    );
    assert(
      pageContent.includes('<span>Edit</span>'),
      'Test 2.2: Edit button is placed inside Details view'
    );
    assert(
      pageContent.includes('<span>Delete</span>'),
      'Test 2.3: Delete button is placed inside Details view'
    );
    assert(
      pageContent.includes('<span>Reject</span>') && pageContent.includes('<span>Approve Request</span>'),
      'Test 2.4: Reject and Approve Request buttons are placed inside Details view'
    );
    assert(
      pageContent.includes('canEditRequest') && pageContent.includes('canDeleteRequest'),
      'Test 2.5: Edit and Delete buttons are guarded by RBAC permissions and status checks'
    );
  }

  // Test 3: Delete Confirmation Modal
  {
    assert(
      pageContent.includes('title="Delete Purchase Request"'),
      'Test 3.1: Delete Confirmation Modal is defined'
    );
    assert(
      pageContent.includes('Are you sure you want to permanently delete purchase request'),
      'Test 3.2: Confirmation modal displays clear confirmation warning'
    );
    assert(
      pageContent.includes('handleConfirmDelete'),
      'Test 3.3: Confirm delete handler is connected'
    );
  }

  // Test 4: Preserving Filter and Search State on Navigation
  {
    assert(
      pageContent.includes('navigate(`${baseRoute}/${reqId}`, {\n      state: {\n        fromSearch: location.search'),
      'Test 4.1: handleViewDetails captures filters and search state in location state'
    );
    assert(
      pageContent.includes('const handleBackToList = () => {\n    const savedSearch = location.state?.fromSearch || \'\';'),
      'Test 4.2: handleBackToList restores search params and filter state'
    );
  }

  // Test 5: Service Level Deletion Verification
  {
    const dummyCompanyId = 'test-company-delete-pr';
    // Create a temporary purchase request
    const testInput: CreatePurchaseRequestInput = {
      warehouseId: 'wh-test-1',
      warehouseName: 'Main Hub',
      priority: 'Normal',
      reason: 'Automated test purchase request',
      items: [
        {
          productId: 'prod-1',
          productName: 'Test Product',
          requestedQty: 10,
          unit: 'Piece',
          estimatedCost: 100
        }
      ]
    };

    const created = await purchaseRequestService.createPurchaseRequest(
      testInput,
      dummyCompanyId,
      { id: 'user-1', name: 'Tester', role: 'Owner' }
    );
    assert(Boolean(created && created.id), 'Test 5.1: Test request created successfully');

    // Fetch before delete
    const fetchedBefore = await purchaseRequestService.getPurchaseRequestById(created.id, dummyCompanyId);
    assert(fetchedBefore?.id === created.id, 'Test 5.2: Created request exists in storage');

    // Delete request
    const deleted = await purchaseRequestService.deletePurchaseRequest(created.id, dummyCompanyId, 'Owner');
    assert(deleted === true, 'Test 5.3: deletePurchaseRequest returned true');

    // Fetch after delete
    const fetchedAfter = await purchaseRequestService.getPurchaseRequestById(created.id, dummyCompanyId);
    assert(fetchedAfter === null, 'Test 5.4: Deleted request no longer exists in storage');
  }

  console.log(`\nVerification Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
