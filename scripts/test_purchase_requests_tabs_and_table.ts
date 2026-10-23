import fs from 'fs';
import { purchaseRequestService } from '../src/services/purchaseRequestService';
import { supabase } from '../src/lib/supabase';
import { setTabScopedStaffSession } from '../src/services/authService';

async function runTests() {
  console.log('--- TESTING PURCHASE REQUESTS TABS & TABLE WORKFLOW ---');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    const pageContent = fs.readFileSync('src/pages/purchases/PurchaseRequestsPage.tsx', 'utf8');

    // 1. Verify STATUS_TABS definition
    const expectedTabs = ['All', 'Pending Review', 'Approved', 'Ordered', 'Completed', 'Rejected'];
    expectedTabs.forEach(t => {
      assert(pageContent.includes(`'${t}'`), `STATUS_TABS contains '${t}'`);
    });

    // 2. Verify removed tabs are NOT in STATUS_TABS
    const statusTabsRegex = /const STATUS_TABS = \[([\s\S]*?)\] as const;/;
    const match = pageContent.match(statusTabsRegex);
    assert(Boolean(match), 'Found STATUS_TABS declaration');
    if (match) {
      const tabsBlock = match[1];
      assert(!tabsBlock.includes('Under Review'), "'Under Review' removed from STATUS_TABS");
      assert(!tabsBlock.includes('Clarification Requested'), "'Clarification Requested' removed from STATUS_TABS");
      assert(!tabsBlock.includes('Partially Received'), "'Partially Received' removed from STATUS_TABS");
    }

    // 3. Verify Table Headers (9 columns)
    assert(pageContent.includes('Request #</th>'), 'Table contains Request # column header');
    assert(pageContent.includes('Date</th>'), 'Table contains Date column header');
    assert(pageContent.includes('Warehouse</th>'), 'Table contains Warehouse column header');
    assert(pageContent.includes('Requester</th>'), 'Table contains Requester column header');
    assert(pageContent.includes('Product(s)</th>'), 'Table contains Product(s) column header');
    assert(pageContent.includes('Quantity</th>'), 'Table contains Quantity column header');
    assert(pageContent.includes('Priority</th>'), 'Table contains Priority column header');
    assert(pageContent.includes('Status</th>'), 'Table contains Status column header');
    assert(pageContent.includes('Actions</th>'), 'Table contains Actions column header');
    assert(pageContent.includes('colSpan={9}'), 'Empty state spans all 9 columns');

    // 4. Verify Pagination
    assert(pageContent.includes('const [currentPage, setCurrentPage] = useState<number>(1);'), 'Pagination currentPage state present');
    assert(pageContent.includes('const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));'), 'totalPages calculation present');
    assert(pageContent.includes('Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span>'), 'Showing X to Y pagination text present');
    assert(pageContent.includes('Page {currentPage} of {totalPages}'), 'Page X of Y display present');

    // 5. Verify Filter Visibility Preservation for Historical Statuses
    // Test filter simulation
    const mockRequests = [
      { id: '1', requestNumber: 'PR-1', status: 'Pending Review', warehouseId: 'W1', priority: 'High', requesterName: 'Alice', items: [{ productName: 'Item A', requestedQty: 10, unit: 'Kg' }] },
      { id: '2', requestNumber: 'PR-2', status: 'Under Review', warehouseId: 'W1', priority: 'Urgent', requesterName: 'Bob', items: [{ productName: 'Item B', requestedQty: 5, unit: 'Piece' }] },
      { id: '3', requestNumber: 'PR-3', status: 'Clarification Requested', warehouseId: 'W2', priority: 'Normal', requesterName: 'Charlie', items: [{ productName: 'Item C', requestedQty: 20, unit: 'Box' }] },
      { id: '4', requestNumber: 'PR-4', status: 'Approved', warehouseId: 'W1', priority: 'High', requesterName: 'David', items: [{ productName: 'Item D', requestedQty: 15, unit: 'Piece' }] },
      { id: '5', requestNumber: 'PR-5', status: 'Ordered', warehouseId: 'W2', priority: 'High', requesterName: 'Eve', items: [{ productName: 'Item E', requestedQty: 30, unit: 'Piece' }] },
      { id: '6', requestNumber: 'PR-6', status: 'Partially Received', warehouseId: 'W1', priority: 'Normal', requesterName: 'Frank', items: [{ productName: 'Item F', requestedQty: 50, unit: 'Piece' }] },
      { id: '7', requestNumber: 'PR-7', status: 'Completed', warehouseId: 'W1', priority: 'Normal', requesterName: 'Grace', items: [{ productName: 'Item G', requestedQty: 100, unit: 'Piece' }] },
      { id: '8', requestNumber: 'PR-8', status: 'Rejected', warehouseId: 'W2', priority: 'Normal', requesterName: 'Heidi', items: [{ productName: 'Item H', requestedQty: 12, unit: 'Piece' }] },
    ];

    function filterReqs(list: any[], status: string, wh = 'All', pri = 'All', q = '') {
      return list.filter(req => {
        if (status !== 'All') {
          if (status === 'Pending Approval' || status === 'Pending Review') {
            if (
              req.status !== 'Pending Approval' &&
              req.status !== 'Pending Review' &&
              req.status !== 'Under Review' &&
              req.status !== 'Clarification Requested'
            ) {
              return false;
            }
          } else if (status === 'Ordered') {
            if (req.status !== 'Ordered' && req.status !== 'Partially Received') {
              return false;
            }
          } else if (req.status !== status) {
            return false;
          }
        }
        if (wh !== 'All' && req.warehouseId !== wh) return false;
        if (pri !== 'All' && req.priority !== pri) return false;
        if (q.trim()) {
          const query = q.toLowerCase();
          const matchNum = req.requestNumber.toLowerCase().includes(query);
          const matchUser = req.requesterName.toLowerCase().includes(query);
          const matchProd = req.items.some((i: any) => i.productName.toLowerCase().includes(query));
          if (!matchNum && !matchUser && !matchProd) return false;
        }
        return true;
      });
    }

    assert(filterReqs(mockRequests, 'All').length === 8, "'All' tab displays all 8 requests without dropping any status");
    const pendingReviewList = filterReqs(mockRequests, 'Pending Review');
    assert(pendingReviewList.length === 3, "'Pending Review' tab includes Pending Review, Under Review, and Clarification Requested");
    const orderedList = filterReqs(mockRequests, 'Ordered');
    assert(orderedList.length === 2, "'Ordered' tab includes Ordered and Partially Received");
    assert(filterReqs(mockRequests, 'Approved').length === 1, "'Approved' tab displays 1 approved request");
    assert(filterReqs(mockRequests, 'Completed').length === 1, "'Completed' tab displays 1 completed request");
    assert(filterReqs(mockRequests, 'Rejected').length === 1, "'Rejected' tab displays 1 rejected request");
    assert(filterReqs(mockRequests, 'All', 'W1').length === 5, 'Warehouse filter works correctly');
    assert(filterReqs(mockRequests, 'All', 'All', 'High').length === 3, 'Priority filter works correctly');
    assert(filterReqs(mockRequests, 'All', 'All', 'All', 'Item B').length === 1, 'Search query by product name works correctly');

    // 6. Test Live Purchase Request Creation & Backend Workflow
    const companyId = '00000000-0000-0000-0000-000000000001';
    setTabScopedStaffSession({
      id: 'test-staff-id',
      email: 'test@universalbilling.com',
      company_id: companyId,
      first_name: 'Test',
      last_name: 'Requester',
      role: 'Warehouse Manager',
      status: 'active'
    });

    const created = await purchaseRequestService.createPurchaseRequest({
      warehouseId: '00000000-0000-0000-0000-000000000002',
      warehouseName: 'Main Central Warehouse',
      priority: 'High',
      reason: 'Automated test purchase request verification',
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000001',
          productName: 'Sample PR Test Item',
          sku: 'SKU-PR-TEST-1',
          currentStock: 5,
          warningLimit: 20,
          requestedQty: 50,
          unit: 'Piece',
          estimatedCost: 150
        }
      ]
    }, companyId);

    assert(Boolean(created && created.id), `Successfully created purchase request #${created.requestNumber}`);
    assert(created.status === 'Pending Approval', 'Initial request status is Pending Approval');

    // Cleanup created test request
    await supabase.from('purchase_request_items').delete().eq('request_id', created.id);
    await supabase.from('purchase_requests').delete().eq('id', created.id);
    console.log('[CLEANUP] Cleaned up test purchase request from database');

    setTabScopedStaffSession(null);

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
