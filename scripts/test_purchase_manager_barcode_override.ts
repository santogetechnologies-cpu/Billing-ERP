// Test Suite: Purchase Manager-only Barcode Management and Supplier Barcode Override
// Validates all 10 acceptance scenarios from Section 7 of the user requirements.

import { barcodeOverrideService } from '../src/services/barcodeOverrideService';
import { barcodeService } from '../src/services/barcodeService';
import { productService } from '../src/services/productService';
import { canManageBarcodeOverride, canAccessRoute } from '../src/utils/rbac';
import { Product, UserRole } from '../src/types';
import { getAppStorage } from '../src/utils/storageUtils';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('TEST SUITE: PURCHASE MANAGER BARCODE OVERRIDE & MANAGEMENT WORKFLOW');
  console.log('================================================================================\n');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const storage = getAppStorage();

  // Mock Users
  const purchaseManagerUser = {
    id: 'user-pm-001',
    name: 'Priya Sharma (Purchase Manager)',
    role: 'Purchase Manager' as UserRole
  };

  const adminUser = {
    id: 'user-admin-001',
    name: 'Vikram Mehta (Company Admin)',
    role: 'Admin' as UserRole
  };

  const warehouseManagerUser = {
    id: 'user-wm-001',
    name: 'Rajesh Kumar (Warehouse Manager)',
    role: 'Warehouse Manager' as UserRole
  };

  const salesUser = {
    id: 'user-sp-001',
    name: 'Amit Patel (Salesperson)',
    role: 'Salesperson' as UserRole
  };

  const cashierUser = {
    id: 'user-cs-001',
    name: 'Deepak Joshi (Cashier)',
    role: 'Cashier' as UserRole
  };

  const accountantUser = {
    id: 'user-ac-001',
    name: 'Suresh Raina (Accountant)',
    role: 'Accountant' as UserRole
  };

  // Seed sample products in local test storage
  const sampleProducts: Product[] = [
    {
      id: 'prod-snack-001',
      name: 'Masala Potato Chips 50g',
      code: 'SNK-001',
      sku: 'SNK-POTATO-001',
      barcode: '8901000111001',
      category: 'Snacks & Confectionery',
      brand: 'CrispyBites',
      description: 'Spicy crinkle cut potato chips',
      hsn: '1905',
      taxRate: 12,
      purchasePrice: 15,
      costPrice: 15,
      sellingPrice: 20,
      retailPrice: 20,
      wholesalePrice: 18,
      mrp: 25,
      minSellingPrice: 18,
      reorderLevel: 50,
      openingStock: 200,
      openingStockValue: 3000,
      currentStock: 185,
      primaryUnit: 'Packet',
      warehouse: 'WH-MAIN',
      rack: 'R-1',
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'prod-drink-002',
      name: 'Sparkling Lemonade 300ml',
      code: 'DRK-002',
      sku: 'DRK-LEMON-002',
      barcode: '8901000222002',
      category: 'Beverages',
      brand: 'FizzUp',
      description: 'Refreshing carbonated citrus beverage',
      hsn: '2202',
      taxRate: 18,
      purchasePrice: 25,
      costPrice: 25,
      sellingPrice: 40,
      retailPrice: 40,
      wholesalePrice: 35,
      mrp: 45,
      minSellingPrice: 35,
      reorderLevel: 40,
      openingStock: 150,
      openingStockValue: 3750,
      currentStock: 120,
      primaryUnit: 'Bottle',
      warehouse: 'WH-MAIN',
      rack: 'R-2',
      batchTracking: false,
      serialTracking: false,
      expiryTracking: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'prod-biscuit-003',
      name: 'Oatmeal Butter Cookies 150g',
      code: 'BSC-003',
      sku: 'BSC-OAT-003',
      barcode: '', // Currently unassigned barcode
      category: 'Bakery',
      brand: 'GoldenBake',
      description: 'Whole grain cookies',
      hsn: '1905',
      taxRate: 5,
      purchasePrice: 30,
      costPrice: 30,
      sellingPrice: 50,
      retailPrice: 50,
      wholesalePrice: 45,
      mrp: 60,
      minSellingPrice: 45,
      reorderLevel: 30,
      openingStock: 80,
      openingStockValue: 2400,
      currentStock: 75,
      primaryUnit: 'Box',
      warehouse: 'WH-MAIN',
      rack: 'R-3',
      batchTracking: false,
      serialTracking: false,
      expiryTracking: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ];

  if (storage) {
    storage.setItem(`universal_billing_products_${testCompanyId}`, JSON.stringify(sampleProducts));
    storage.setItem(`universal_billing_barcode_audit_logs_${testCompanyId}`, JSON.stringify([]));
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Purchase Manager Manually Assigns Barcode (Method A)
  // ---------------------------------------------------------------------------
  console.log('--- 1. Purchase Manager Manually Assigns a Barcode (Method A) ---');
  {
    const manualBarcode = '8901000333003';
    const validation = await barcodeOverrideService.validateBarcode(manualBarcode, 'prod-biscuit-003', testCompanyId);
    assert(validation.isValid === true && !validation.conflict, 'Manual barcode is validated as unique and available');

    const result = await barcodeOverrideService.executeBarcodeOverride(
      {
        productId: 'prod-biscuit-003',
        method: 'MANUAL_ENTRY',
        newBarcode: manualBarcode,
        updatePrice: false,
        reason: 'Initial retail sticker barcode assignment for Oatmeal Cookies'
      },
      purchaseManagerUser,
      testCompanyId
    );

    assert(result.product.barcode === manualBarcode, 'Manual barcode successfully assigned to product');
    assert(result.product.sellingPrice === 50, 'Selling price left intact at ₹50.00');
    assert(result.auditLog.method === 'MANUAL_ENTRY', 'Audit log records method as MANUAL_ENTRY');
    assert(result.auditLog.newBarcode === manualBarcode, 'Audit log records assigned barcode');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Purchase Manager Scans Existing Barcode & Finds Correct Product
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Purchase Manager Scans Existing Barcode & Finds Correct Product ---');
  {
    const foundProduct = await barcodeOverrideService.findProductByBarcodeOrCode('8901000111001', testCompanyId);
    assert(foundProduct !== null, 'Scanned barcode resolved to an existing product');
    assert(foundProduct?.id === 'prod-snack-001', 'Found product matches Masala Potato Chips');
    assert(foundProduct?.sku === 'SNK-POTATO-001', 'Product SKU verified as SNK-POTATO-001');
    assert(foundProduct?.sellingPrice === 20, 'Current selling price displayed as ₹20.00');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Purchase Manager Replaces Product Barcode (Supplier Override)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Purchase Manager Replaces Barcode with Supplier Packaging Barcode ---');
  {
    const newSupplierBarcode = '8909999000123'; // Pre-printed snack packaging barcode
    const result = await barcodeOverrideService.executeBarcodeOverride(
      {
        productId: 'prod-snack-001',
        method: 'SUPPLIER_OVERRIDE',
        newBarcode: newSupplierBarcode,
        updatePrice: false,
        reason: 'Vendor changed outer packaging to pre-printed snack manufacturer EAN'
      },
      purchaseManagerUser,
      testCompanyId
    );

    assert(result.product.barcode === newSupplierBarcode, 'Product barcode successfully updated to incoming supplier barcode');
    assert(result.auditLog.method === 'SUPPLIER_OVERRIDE', 'Audit log tagged as SUPPLIER_OVERRIDE');
    assert(result.auditLog.oldBarcode === '8901000111001', 'Audit log retains previous barcode (8901000111001)');
    assert(result.auditLog.newBarcode === newSupplierBarcode, 'Audit log retains new barcode (8909999000123)');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Barcode Update Without Changing Selling Price
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Barcode Update Without Changing Selling Price ---');
  {
    const lemonNewBarcode = '8908888777002';
    const result = await barcodeOverrideService.executeBarcodeOverride(
      {
        productId: 'prod-drink-002',
        method: 'SUPPLIER_OVERRIDE',
        newBarcode: lemonNewBarcode,
        updatePrice: false,
        reason: 'Manufacturer packaging redesign'
      },
      purchaseManagerUser,
      testCompanyId
    );

    assert(result.product.barcode === lemonNewBarcode, 'Beverage barcode updated');
    assert(result.product.sellingPrice === 40, 'Selling price strictly unchanged at ₹40.00');
    assert(result.auditLog.priceUpdated === false, 'Audit log marks priceUpdated as false');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Update Both Barcode and Selling Price with Confirmation
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Update Both Barcode and Selling Price ---');
  {
    const snackUpdatedBarcode = '8907777111222';
    const newPrice = 22.50;

    const result = await barcodeOverrideService.executeBarcodeOverride(
      {
        productId: 'prod-snack-001',
        method: 'SUPPLIER_OVERRIDE',
        newBarcode: snackUpdatedBarcode,
        updatePrice: true,
        newSellingPrice: newPrice,
        reason: 'Snack vendor MRP revision from ₹20 to ₹22.50 with new pouch barcode'
      },
      purchaseManagerUser,
      testCompanyId
    );

    assert(result.product.barcode === snackUpdatedBarcode, 'Barcode updated to 8907777111222');
    assert(result.product.sellingPrice === 22.50, 'Selling price updated to ₹22.50');
    assert(result.auditLog.priceUpdated === true, 'Audit log marks priceUpdated as true');
    assert(result.auditLog.oldSellingPrice === 20, 'Audit log records old selling price as ₹20.00');
    assert(result.auditLog.newSellingPrice === 22.50, 'Audit log records new selling price as ₹22.50');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Conflict Warning on Duplicate Barcode Assignment
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Conflict Prevention on Duplicate Barcode Assignment ---');
  {
    // Try assigning Lemonade barcode (8908888777002) to Cookies (prod-biscuit-003)
    const conflictingBarcode = '8908888777002';
    const validation = await barcodeOverrideService.validateBarcode(
      conflictingBarcode,
      'prod-biscuit-003',
      testCompanyId
    );

    assert(validation.conflict === true, 'Duplicate barcode flagged as conflicting');
    assert(validation.conflictingProduct !== null, 'Conflicting product details returned');
    assert(validation.conflictingProduct?.id === 'prod-drink-002', 'Conflict correctly identifies Lemonade as owner');

    let threwConflictError = false;
    try {
      await barcodeOverrideService.executeBarcodeOverride(
        {
          productId: 'prod-biscuit-003',
          method: 'SUPPLIER_OVERRIDE',
          newBarcode: conflictingBarcode,
          reason: 'Testing conflict block'
        },
        purchaseManagerUser,
        testCompanyId
      );
    } catch (e: any) {
      threwConflictError = true;
    }

    assert(threwConflictError, 'System strictly blocks committing conflicting barcode to another product');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Role-Based Authorization Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Role-Based Access Control Restrictions ---');
  {
    assert(canManageBarcodeOverride('Purchase Manager') === true, 'Purchase Manager has Barcode Override permission');
    assert(canManageBarcodeOverride('Admin') === true, 'Admin has Barcode Override permission');
    assert(canManageBarcodeOverride('Owner') === true, 'Owner has Barcode Override permission');

    assert(canManageBarcodeOverride('Warehouse Manager') === false, 'Warehouse Manager is DENIED Barcode Override');
    assert(canManageBarcodeOverride('Salesperson') === false, 'Salesperson is DENIED Barcode Override');
    assert(canManageBarcodeOverride('Cashier') === false, 'Cashier is DENIED Barcode Override');
    assert(canManageBarcodeOverride('Accountant') === false, 'Accountant is DENIED Barcode Override');

    assert(canAccessRoute('Purchase Manager', '/purchases/barcode-management') === true, 'Purchase Manager can access route');
    assert(canAccessRoute('Warehouse Manager', '/purchases/barcode-management') === false, 'Warehouse Manager is blocked from route');
    assert(canAccessRoute('Salesperson', '/purchases/barcode-management') === false, 'Salesperson is blocked from route');
    assert(canAccessRoute('Cashier', '/purchases/barcode-management') === false, 'Cashier is blocked from route');

    let wmBlocked = false;
    try {
      await barcodeOverrideService.executeBarcodeOverride(
        {
          productId: 'prod-snack-001',
          method: 'SUPPLIER_OVERRIDE',
          newBarcode: '8901239999999',
          reason: 'Unauthorized attempt'
        },
        warehouseManagerUser,
        testCompanyId
      );
    } catch {
      wmBlocked = true;
    }
    assert(wmBlocked, 'Warehouse Manager is strictly blocked in service layer with Access Denied');

    let cashierBlocked = false;
    try {
      await barcodeOverrideService.executeBarcodeOverride(
        {
          productId: 'prod-snack-001',
          method: 'MANUAL_ENTRY',
          newBarcode: '8901238888888',
          reason: 'Unauthorized cashier attempt'
        },
        cashierUser,
        testCompanyId
      );
    } catch {
      cashierBlocked = true;
    }
    assert(cashierBlocked, 'Cashier is strictly blocked in service layer with Access Denied');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Normal Product Lookup & Billing Using Scanned Barcode
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Normal Barcode Lookup & Fast POS Billing ---');
  {
    // The snack product was updated to barcode '8907777111222' and sellingPrice ₹22.50
    const currentProds = await barcodeOverrideService.getAllProducts(testCompanyId);
    const parsed = await barcodeService.parseVariableBarcode('8907777111222', currentProds);

    assert(parsed.product !== null, 'Scanned barcode successfully resolves in POS barcode parser');
    assert(parsed.product?.id === 'prod-snack-001', 'Barcode parser identifies correct product (Masala Potato Chips)');
    assert(parsed.product?.sellingPrice === 22.50, 'Billing uses updated selling price of ₹22.50');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Preservation of Historical Data & Stock Balances
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Data Preservation (Stock, SKU, Product ID, History) ---');
  {
    const prods = await barcodeOverrideService.getAllProducts(testCompanyId);
    const snackProd = prods.find(p => p.id === 'prod-snack-001');

    assert(snackProd?.id === 'prod-snack-001', 'Product ID preserved unchanged');
    assert(snackProd?.sku === 'SNK-POTATO-001', 'Product SKU preserved unchanged');
    assert(snackProd?.currentStock === 185, 'Current stock inventory preserved intact at 185 packets');
    assert(snackProd?.purchasePrice === 15, 'Purchase cost price preserved intact at ₹15.00');
    assert(snackProd?.category === 'Snacks & Confectionery', 'Category preserved');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Persistence Across Refreshes & Full Audit Trail
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Audit Trail Retention & Persistence ---');
  {
    const auditLogs = await barcodeOverrideService.getBarcodeAuditLogs(undefined, testCompanyId);
    assert(auditLogs.length >= 3, `Retained ${auditLogs.length} audit entries chronologically`);

    const latest = auditLogs[0];
    assert(latest.userRole === 'Purchase Manager', 'Audit trail records user role as Purchase Manager');
    assert(latest.userName.includes('Priya Sharma'), 'Audit trail records user name');
    assert(latest.newBarcode === '8907777111222', 'Audit trail retains latest barcode change');
    assert(latest.reason.length > 0, 'Audit trail retains change reason');
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}% SUCCESS)`);
  console.log('================================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
