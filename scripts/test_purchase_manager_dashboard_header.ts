import fs from 'fs';
import path from 'path';

function runTests() {
  const targetPath = path.resolve('src/pages/purchases/PurchaseManagerDashboardPage.tsx');
  const content = fs.readFileSync(targetPath, 'utf8');

  const assertions: Array<{ name: string; pass: boolean; detail?: string }> = [];

  // 1. Container structure and classes
  assertions.push({
    name: 'Header container has Warehouse Manager layout classes',
    pass: content.includes('className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4"')
  });

  // 2. Breadcrumb row
  assertions.push({
    name: 'Breadcrumb contains ShoppingBag, Dashboard, and Procurement Operations',
    pass: content.includes('<ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />') &&
          content.includes('<span>Dashboard</span>') &&
          content.includes('Procurement Operations')
  });

  // 3. Calendar date badge in breadcrumb
  assertions.push({
    name: 'Breadcrumb includes Calendar date badge with formattedToday',
    pass: content.includes('<Calendar className="w-3 h-3 text-slate-400" />') &&
          content.includes('<span>{formattedToday}</span>')
  });

  // 4. Dashboard heading
  assertions.push({
    name: 'Heading contains Purchase Manager Dashboard',
    pass: content.includes('Purchase Manager Dashboard')
  });

  // 5. Procurement & Purchasing Portal label removed
  assertions.push({
    name: 'Header removes Procurement & Purchasing Portal badge and greeting',
    pass: !content.includes('Procurement & Purchasing Portal') &&
          !content.includes('{greeting}, {displayName}!')
  });

  // 6. Second line with company name and date
  assertions.push({
    name: 'Second line has company name and formattedToday date',
    pass: content.includes('{company.name || \'Universal ERP Enterprise\'}') &&
          content.includes('<span className="text-slate-500">{formattedToday}</span>')
  });

  // 7. Profile button and avatar initial
  assertions.push({
    name: 'Right toolbar includes Profile button with user initial and displayName',
    pass: content.includes('onClick={() => setIsProfileModalOpen(true)}') &&
          content.includes('{(profile?.full_name || user?.email || \'P\')[0].toUpperCase()}') &&
          content.includes('{displayName}')
  });

  // 8. UserProfileModal mount
  assertions.push({
    name: 'UserProfileModal is imported and mounted with isProfileModalOpen state',
    pass: content.includes('import { UserProfileModal } from \'../../components/auth/UserProfileModal\';') &&
          content.includes('const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);') &&
          content.includes('<UserProfileModal') &&
          content.includes('isOpen={isProfileModalOpen}')
  });

  // 9. Refresh button preserved
  assertions.push({
    name: 'Refresh button with handleRefresh and RefreshCw icon',
    pass: content.includes('onClick={handleRefresh}') &&
          content.includes('RefreshCw') &&
          content.includes('Refresh Procurement Metrics')
  });

  // 10. Review Requests button preserved
  assertions.push({
    name: 'Review Requests button with pendingRequestsCount and route',
    pass: content.includes('onClick={() => navigate(\'/purchases/requests\')}') &&
          content.includes('Review Requests ({metrics.pendingRequestsCount})')
  });

  // 11. New Purchase Bill button preserved
  assertions.push({
    name: 'New Purchase Bill button with Plus icon and route',
    pass: content.includes('onClick={() => navigate(\'/purchases/new\')}') &&
          content.includes('New Purchase Bill')
  });

  // 12. Barcode Override button preserved
  assertions.push({
    name: 'Barcode Override permission button preserved',
    pass: content.includes('canManageBarcodeOverride(profile?.role)') &&
          content.includes('navigate(\'/purchases/barcode-management\')') &&
          content.includes('Barcode Override')
  });

  // 13. displayName preserves purchase email prefix
  assertions.push({
    name: 'displayName logic supports purchase email prefix',
    pass: content.includes('const raw = user?.email?.split(\'@\')[0] || \'\';') &&
          content.includes('return raw || \'Purchase Manager\';')
  });

  console.log('--- Purchase Manager Dashboard Header Test Results ---');
  let allPass = true;
  for (const a of assertions) {
    if (a.pass) {
      console.log(`PASS: ${a.name}`);
    } else {
      console.error(`FAIL: ${a.name} ${a.detail || ''}`);
      allPass = false;
    }
  }

  if (!allPass) {
    process.exit(1);
  } else {
    console.log(`\nALL ${assertions.length} TESTS PASSED!`);
  }
}

runTests();
