import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('--- Testing Quotation Button Opening as Modal Popup on Dashboard ---\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${desc}${detail ? ` - ${detail}` : ''}`);
    }
  }

  const pmDashPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const modalPath = path.resolve('src/components/purchases/BulkOrderBillModal.tsx');

  const pmDashCode = fs.readFileSync(pmDashPath, 'utf8');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Test 1: Quotation button on Dashboard manages modal state instead of route navigation
  assert(
    'Dashboard manages quotation modal visibility via state (isQuotationModalOpen)',
    pmDashCode.includes('const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);')
  );

  // Test 2: Quotation button triggers state change without navigate()
  assert(
    'Quotation button onClick calls setIsQuotationModalOpen(true)',
    pmDashCode.includes('onClick={() => setIsQuotationModalOpen(true)}')
  );

  // Test 3: Quotation button does NOT navigate to another page or route
  assert(
    'Quotation button does NOT call navigate to /purchases/orders or other routes',
    !pmDashCode.includes("navigate('/purchases/orders?new=bulk-order')")
  );

  // Test 4: BulkOrderBillModal is rendered directly on Dashboard
  assert(
    'BulkOrderBillModal is rendered directly in PurchaseManagerDashboardPage',
    pmDashCode.includes('<BulkOrderBillModal') &&
    pmDashCode.includes('isOpen={isQuotationModalOpen}') &&
    pmDashCode.includes('onClose={() => setIsQuotationModalOpen(false)}')
  );

  // Test 5: Modal has higher z-index than Dashboard and centered positioning
  assert(
    'Modal has high z-index (z-50) and centered screen placement',
    modalCode.includes('z-50') &&
    modalCode.includes('flex items-center justify-center')
  );

  // Test 6: Semi-transparent dark overlay behind the quotation form
  assert(
    'Modal has semi-transparent dark overlay backdrop (bg-slate-900/60 backdrop-blur-xs)',
    modalCode.includes('bg-slate-900/60') &&
    modalCode.includes('backdrop-blur-xs')
  );

  // Test 7: Quotation form is independently scrollable
  assert(
    'Quotation form has max-h container with overflow-y-auto scrolling',
    modalCode.includes('max-h-[96vh]') &&
    modalCode.includes('overflow-y-auto')
  );

  // Test 8: Close (X) and Cancel handlers close modal without changing route or reloading dashboard
  assert(
    'Cancel handler calls onClose() without navigating away or reloading dashboard',
    modalCode.includes('const handleCancel = () => {') &&
    modalCode.includes('onClose();') &&
    !modalCode.includes("const handleCancel = () => {\n    onClose();\n    navigate('/');")
  );

  console.log(`\nResults: ${passedCount}/${totalCount} tests passed.\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();

