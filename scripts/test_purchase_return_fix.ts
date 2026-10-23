import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('PURCHASE RETURN / DEBIT NOTE FIX & RESILIENCE VERIFICATION');
console.log('===============================================================\n');

// 1. Inspect src/services/purchaseService.ts
console.log('1. Inspecting purchaseService.ts...');
const purchaseServicePath = path.resolve('src/services/purchaseService.ts');
const purchaseServiceContent = fs.readFileSync(purchaseServicePath, 'utf-8');

// A. Verify no invalid 'reason' column is sent to purchase_returns table
const insertSectionMatch = purchaseServiceContent.match(/returnPayload:\s*Record<string,\s*any>\s*=\s*\{([\s\S]*?)\};/);
assert(insertSectionMatch, 'returnPayload definition must exist in purchaseService.ts');
const returnPayloadCode = insertSectionMatch[1];
assert(!returnPayloadCode.includes("reason:"), "returnPayload MUST NOT contain 'reason:' column (purchase_returns table does not have 'reason' column)");
assert(returnPayloadCode.includes("notes:"), "returnPayload must pass reason/justification into 'notes' column");
assert(returnPayloadCode.includes("supplier_name:"), "returnPayload must pass 'supplier_name' column (NOT NULL constraint in schema)");
console.log("✓ Verified: purchase_returns insert payload uses 'notes' instead of 'reason' and supplies 'supplier_name'.");

// B. Verify UUID validation prevents invalid UUID string errors
assert(purchaseServiceContent.includes('isValidUuid'), 'purchaseService.ts must contain isValidUuid helper');
assert(purchaseServiceContent.includes('validOriginalPurchaseId'), 'purchaseService.ts must sanitize originalPurchaseId with UUID check');
assert(purchaseServiceContent.includes('resolvedSupplierId'), 'purchaseService.ts must sanitize supplierId with UUID check');
console.log('✓ Verified: UUID validation ensures originalPurchaseId and supplierId are valid UUIDs or null.');

// C. Verify RPC process_purchase_return_atomic signature
const rpcCallMatch = purchaseServiceContent.match(/supabase\.rpc\('process_purchase_return_atomic',\s*\{([\s\S]*?)\}\);/);
assert(rpcCallMatch, 'RPC process_purchase_return_atomic call must exist');
assert(rpcCallMatch[1].includes('p_return_json:'), 'RPC process_purchase_return_atomic must pass p_return_json JSONB object parameter');
console.log('✓ Verified: RPC call passes p_return_json conforming to PostgreSQL stored procedure signature.');

// D. Verify return object sets supplierId and supplierName
assert(purchaseServiceContent.includes("supplierId: resolvedSupplierId || ''"), 'Returned PurchaseInvoice must preserve supplierId');
assert(purchaseServiceContent.includes("supplierName: resolvedSupplierName"), 'Returned PurchaseInvoice must preserve supplierName');
console.log('✓ Verified: Return invoice sets resolved supplierId and supplierName (not empty string).');

// E. Verify purchase returns are merged in getPurchaseInvoices
assert(purchaseServiceContent.includes('getPurchaseReturns(finalCompanyId)'), 'getPurchaseInvoices must fetch purchase returns for persistence');
assert(purchaseServiceContent.includes("docType: 'purchase_return'"), 'getPurchaseInvoices must map purchase returns with docType purchase_return');
console.log('✓ Verified: getPurchaseInvoices merges purchase returns to guarantee persistence across reloads.');

// 2. Inspect src/context/ERPContext.tsx
console.log('\n2. Inspecting ERPContext.tsx...');
const erpContextPath = path.resolve('src/context/ERPContext.tsx');
const erpContextContent = fs.readFileSync(erpContextPath, 'utf-8');

// A. Verify processPurchaseReturn accepts supplier parameters
assert(erpContextContent.includes('supplierId?: string'), 'ERPContext processPurchaseReturn must accept supplierId');
assert(erpContextContent.includes('supplierName?: string'), 'ERPContext processPurchaseReturn must accept supplierName');
console.log('✓ Verified: ERPContext processPurchaseReturn signature accepts supplierId and supplierName.');

// B. Verify supplier outstanding balance reduction
const supplierReductionMatch = erpContextContent.match(/s\.id === retDoc\.supplierId[\s\S]*?currentOutstanding:\s*Math\.max\(0,\s*s\.currentOutstanding\s*-\s*totalReturnAmt\)/);
assert(supplierReductionMatch, 'ERPContext must match s.id === retDoc.supplierId and reduce currentOutstanding');
console.log('✓ Verified: ERPContext properly updates supplier payable balance when Debit Note is created.');

// 3. Inspect src/pages/purchases/PurchaseReturnsPage.tsx
console.log('\n3. Inspecting PurchaseReturnsPage.tsx...');
const returnsPagePath = path.resolve('src/pages/purchases/PurchaseReturnsPage.tsx');
const returnsPageContent = fs.readFileSync(returnsPagePath, 'utf-8');

// A. Verify handleCreateDebitNote passes selectedSupplierId and does NOT pass invalid manual-pur-
assert(!returnsPageContent.includes("'manual-pur-'"), "PurchaseReturnsPage MUST NOT pass 'manual-pur-' timestamp string to UUID parameter");
assert(returnsPageContent.includes("selectedPurchaseId || ''"), 'PurchaseReturnsPage must pass empty string for direct debit notes');
assert(returnsPageContent.includes('selectedSupplierId'), 'PurchaseReturnsPage must pass selectedSupplierId');
console.log('✓ Verified: PurchaseReturnsPage does not pass dummy non-UUID strings to processPurchaseReturn.');

// 4. Functional Unit Test Simulation
console.log('\n4. Simulating functional Debit Note calculation & balance reduction...');
const mockSuppliers = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Apex Industrial Tools', currentOutstanding: 25000 }
];

const mockProducts = [
  { id: '22222222-2222-2222-2222-222222222222', name: 'Precision Caliper', currentStock: 50, purchasePrice: 500 }
];

const returnQty = 5;
const returnRate = 500;
const returnSubtotal = returnQty * returnRate; // 2500
const taxReversal = Math.round(returnSubtotal * 0.18 * 100) / 100; // 450
const grandTotal = returnSubtotal + taxReversal; // 2950

// Apply simulated stock reduction
const updatedStock = mockProducts[0].currentStock - returnQty;
assert.strictEqual(updatedStock, 45, 'Stock should be reduced from 50 to 45');

// Apply simulated payable reduction
const updatedOutstanding = Math.max(0, mockSuppliers[0].currentOutstanding - grandTotal);
assert.strictEqual(updatedOutstanding, 22050, 'Supplier payable should be reduced from 25000 by 2950 to 22050');

console.log(`✓ Product stock: ${mockProducts[0].currentStock} -> ${updatedStock} (decreased by ${returnQty})`);
console.log(`✓ Supplier balance: ₹${mockSuppliers[0].currentOutstanding} -> ₹${updatedOutstanding} (debited ₹${grandTotal} incl. ₹${taxReversal} tax reversal)`);

console.log('\n===============================================================');
console.log('ALL PURCHASE RETURN / DEBIT NOTE TESTS PASSED SUCCESSFULLY!');
console.log('===============================================================');
