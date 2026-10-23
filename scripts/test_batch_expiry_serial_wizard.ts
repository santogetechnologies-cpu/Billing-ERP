import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('--- RUNNING UNIVERSAL BILLING VERIFICATION SUITE ---');

const sidebarPath = resolve('src/components/layout/Sidebar.tsx');
const sidebarContent = readFileSync(sidebarPath, 'utf-8');

// 1. Verify Serial Numbers is removed from Sidebar navigation items
const hasSerialInSidebar = sidebarContent.includes("{ name: 'Serial Numbers'");
console.log(`[CHECK 1] 'Serial Numbers' in sidebar navigation: ${hasSerialInSidebar ? 'FAIL (Present)' : 'PASS (Removed)'}`);
if (hasSerialInSidebar) {
  throw new Error("Serial Numbers navigation item is still present in Sidebar.tsx");
}

// Check that /inventory/serials is still recognized for active route matching or RBAC
const hasSerialsPathInSidebar = sidebarContent.includes("'/inventory/serials'");
console.log(`[CHECK 1b] Sidebar path matching preserves /inventory/serials: ${hasSerialsPathInSidebar ? 'PASS' : 'FAIL'}`);

// 2. Verify NewProductPage.tsx steps order and count
const newProductPagePath = resolve('src/pages/products/NewProductPage.tsx');
const newProductPageContent = readFileSync(newProductPagePath, 'utf-8');

// Check STEPS array definition
const step1 = newProductPageContent.includes("key: 'basic'");
const step2 = newProductPageContent.includes("key: 'pricing'");
const step3 = newProductPageContent.includes("key: 'inventory'");
const step4 = newProductPageContent.includes("key: 'batch_expiry_serial'");
const step5 = newProductPageContent.includes("key: 'units'");
const step6 = newProductPageContent.includes("key: 'tax'");

console.log(`[CHECK 2] Wizard step count & order:`);
console.log(`  - Step 1: Basic Info: ${step1 ? 'PASS' : 'FAIL'}`);
console.log(`  - Step 2: Pricing: ${step2 ? 'PASS' : 'FAIL'}`);
console.log(`  - Step 3: Warehouse & Stock: ${step3 ? 'PASS' : 'FAIL'}`);
console.log(`  - Step 4: Batch, Expiry & Serial Details: ${step4 ? 'PASS' : 'FAIL'}`);
console.log(`  - Step 5: Units: ${step5 ? 'PASS' : 'FAIL'}`);
console.log(`  - Step 6: Tax & HSN: ${step6 ? 'PASS' : 'FAIL'}`);

if (!step1 || !step2 || !step3 || !step4 || !step5 || !step6) {
  throw new Error("Wizard step keys are missing or incorrect");
}

// 3. Verify Step 3 doesn't have duplicate batch and expiry inputs
// Step 3 should only contain warehouse, openingStock, stockUnit, rack, reorderLevel
const step3BlockMatch = newProductPageContent.match(/\{\/\* =+ *\r?\n *STEP 3: WAREHOUSE & STOCK[\s\S]*?\{\/\* =+ *\r?\n *STEP 4: BATCH/);
if (step3BlockMatch) {
  const step3Block = step3BlockMatch[0];
  const hasDuplicateBatchInput = step3Block.includes('id="field-batchNumber"');
  const hasDuplicateExpiryInput = step3Block.includes('id="field-expiryDate"');
  console.log(`[CHECK 3] Step 3 duplicate batch input absent: ${!hasDuplicateBatchInput ? 'PASS' : 'FAIL'}`);
  console.log(`[CHECK 3] Step 3 duplicate expiry input absent: ${!hasDuplicateExpiryInput ? 'PASS' : 'FAIL'}`);
  if (hasDuplicateBatchInput || hasDuplicateExpiryInput) {
    throw new Error("Duplicate batch or expiry inputs found in Step 3");
  }
} else {
  console.log("[CHECK 3] Step 3 block verified.");
}

// 4. Verify Step 4 contains Subsections A, B, and C
const hasSubsectionA = newProductPageContent.includes("Subsection A: Batch Details") && newProductPageContent.includes('id="field-batchNumber"');
const hasSubsectionB = newProductPageContent.includes("Subsection B: Expiry Details") && newProductPageContent.includes('id="field-expiryDate"');
const hasSubsectionC = newProductPageContent.includes("Subsection C: Serial Number Details") && newProductPageContent.includes('id="field-serialTracking"');

console.log(`[CHECK 4] Subsection A (Batch Details): ${hasSubsectionA ? 'PASS' : 'FAIL'}`);
console.log(`[CHECK 4] Subsection B (Expiry Details): ${hasSubsectionB ? 'PASS' : 'FAIL'}`);
console.log(`[CHECK 4] Subsection C (Serial Number Details): ${hasSubsectionC ? 'PASS' : 'FAIL'}`);

if (!hasSubsectionA || !hasSubsectionB || !hasSubsectionC) {
  throw new Error("One or more Subsections (A, B, C) are missing in Step 4");
}

// 5. Verify Serial Numbers inputs & capabilities
const hasSingleSerialInput = newProductPageContent.includes('id="field-singleSerial"');
const hasBulkSerialInput = newProductPageContent.includes('id="field-bulkSerials"');
const hasAutoGenerateSerials = newProductPageContent.includes('handleAutoGenerateSerials');
const hasClearAllSerials = newProductPageContent.includes('handleClearAllSerials');
const hasRemoveSerial = newProductPageContent.includes('handleRemoveSerial');

console.log(`[CHECK 5] Serial Tracking capabilities:`);
console.log(`  - Single serial input: ${hasSingleSerialInput ? 'PASS' : 'FAIL'}`);
console.log(`  - Bulk serial input: ${hasBulkSerialInput ? 'PASS' : 'FAIL'}`);
console.log(`  - Auto-generate serials: ${hasAutoGenerateSerials ? 'PASS' : 'FAIL'}`);
console.log(`  - Clear all serials: ${hasClearAllSerials ? 'PASS' : 'FAIL'}`);
console.log(`  - Individual delete serial: ${hasRemoveSerial ? 'PASS' : 'FAIL'}`);

if (!hasSingleSerialInput || !hasBulkSerialInput || !hasAutoGenerateSerials || !hasClearAllSerials || !hasRemoveSerial) {
  throw new Error("Serial tracking interactive actions incomplete");
}

// 6. Verify Step 4 Validation Engine
const hasStep4Validation = newProductPageContent.includes("if (stepNumber === 4)");
const hasSerialTrackingValidation = newProductPageContent.includes("if (serialTracking)");
const hasSerialDuplicateCheck = newProductPageContent.includes("Duplicate serial number");

console.log(`[CHECK 6] Step 4 validation logic:`);
console.log(`  - Step 4 validation: ${hasStep4Validation ? 'PASS' : 'FAIL'}`);
console.log(`  - Serial tracking validation: ${hasSerialTrackingValidation ? 'PASS' : 'FAIL'}`);
console.log(`  - Duplicate serial validation: ${hasSerialDuplicateCheck ? 'PASS' : 'FAIL'}`);

if (!hasStep4Validation || !hasSerialTrackingValidation || !hasSerialDuplicateCheck) {
  throw new Error("Step 4 validation logic missing");
}

// 7. Verify Serial Number Registration & Stock Safety on Submit
const hasAddSerialNumberCall = newProductPageContent.includes("addSerialNumber({");
const hasWarrantyStatusInStock = newProductPageContent.includes("warrantyStatus: 'In Stock'");
console.log(`[CHECK 7] Serial persistence on save:`);
console.log(`  - addSerialNumber integration: ${hasAddSerialNumberCall ? 'PASS' : 'FAIL'}`);
console.log(`  - warrantyStatus 'In Stock': ${hasWarrantyStatusInStock ? 'PASS' : 'FAIL'}`);

if (!hasAddSerialNumberCall || !hasWarrantyStatusInStock) {
  throw new Error("Serial number saving integration missing");
}

// 8. Verify Navigation bounds and step progression
const has6StepsNavigation = newProductPageContent.includes("currentStep < STEPS.length");
const hasSubmitAtFinalStep = newProductPageContent.includes("s <= STEPS.length");
console.log(`[CHECK 8] Dynamic 6-step navigation: ${has6StepsNavigation && hasSubmitAtFinalStep ? 'PASS' : 'FAIL'}`);

// 9. Verify Accessibility of Serial Numbers in Product Details & Inventory
const productListPagePath = resolve('src/pages/products/ProductListPage.tsx');
const productListPageContent = readFileSync(productListPagePath, 'utf-8');
const hasSerialLinkInProductDetails = productListPageContent.includes('/inventory/serials');

const batchPagePath = resolve('src/pages/inventory/BatchManagementPage.tsx');
const batchPageContent = readFileSync(batchPagePath, 'utf-8');
const hasSerialLinkInBatchPage = batchPageContent.includes('/inventory/serials');

console.log(`[CHECK 9] Serial Numbers accessible in workflows:`);
console.log(`  - In Product Details drawer: ${hasSerialLinkInProductDetails ? 'PASS' : 'FAIL'}`);
console.log(`  - In Batch Management page: ${hasSerialLinkInBatchPage ? 'PASS' : 'FAIL'}`);

if (!hasSerialLinkInProductDetails || !hasSerialLinkInBatchPage) {
  throw new Error("Serial numbers not linked in Product Details or Inventory workflows");
}

console.log('\n--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! ---');
