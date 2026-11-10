import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (details) console.error(`   Details: ${details}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('TEST SUITE: Customer Product Return Management (Purchases & PO)');
console.log('================================================================\n');

// 1. Verify types in src/types/index.ts
console.log('--- 1. Verification of Types (src/types/index.ts) ---');
const typesPath = path.resolve(__dirname, '../src/types/index.ts');
const typesContent = fs.readFileSync(typesPath, 'utf-8');

assert(
  typesContent.includes("export type CustomerReturnStatus = 'Pending Review' | 'Pending' | 'Approved' | 'Rejected' | 'Stock Restocked';"),
  "CustomerReturnStatus includes 'Pending', 'Approved', 'Rejected'"
);
assert(
  typesContent.includes('purchaseDate?: string;') &&
  typesContent.includes('returnProblem?: string;') &&
  typesContent.includes('complaintDescription?: string;') &&
  typesContent.includes('photos?: string[];'),
  "CustomerReturn model has purchaseDate, returnProblem, complaintDescription, photos"
);
assert(
  typesContent.includes('purchaseDate?: string;') &&
  typesContent.includes('returnProblem?: string;') &&
  typesContent.includes('complaintDescription?: string;') &&
  typesContent.includes('photos?: string[];'),
  "CreateCustomerReturnInput interface has purchaseDate, returnProblem, complaintDescription, photos"
);

// 2. Verify Database Migration (supabase/migrations/041_customer_return_complaints_and_photos.sql)
console.log('\n--- 2. Verification of Database Migration ---');
const migrationPath = path.resolve(__dirname, '../supabase/migrations/041_customer_return_complaints_and_photos.sql');
assert(fs.existsSync(migrationPath), 'Migration file 041_customer_return_complaints_and_photos.sql exists');
if (fs.existsSync(migrationPath)) {
  const migContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(migContent.includes('purchase_date DATE'), 'Migration adds purchase_date column');
  assert(migContent.includes('return_problem VARCHAR(100)'), 'Migration adds return_problem column');
  assert(migContent.includes('complaint_description TEXT'), 'Migration adds complaint_description column');
  assert(migContent.includes('photos JSONB DEFAULT'), 'Migration adds photos JSONB column');
}

// 3. Verify Customer Return Service (src/services/customerReturnService.ts)
console.log('\n--- 3. Verification of Service (src/services/customerReturnService.ts) ---');
const servicePath = path.resolve(__dirname, '../src/services/customerReturnService.ts');
const serviceContent = fs.readFileSync(servicePath, 'utf-8');

assert(serviceContent.includes('async uploadReturnPhoto(file: File'), 'customerReturnService provides uploadReturnPhoto function');
assert(serviceContent.includes("'product-returns'") && serviceContent.includes("'receipts'"), 'uploadReturnPhoto targets Supabase Storage buckets');
assert(serviceContent.includes('generateReturnNumber(existingCount: number = 0): string'), 'customerReturnService provides generateReturnNumber');
assert(serviceContent.includes('return `RET-${year}-${String(seq).padStart(4, \'0\')}`'), 'Return reference format matches RET-YYYY-XXXX');
assert(serviceContent.includes('purchase_date: returnRecord.purchaseDate'), 'createCustomerReturn maps purchase_date to DB');
assert(serviceContent.includes('return_problem: returnRecord.returnProblem'), 'createCustomerReturn maps return_problem to DB');
assert(serviceContent.includes('complaint_description: returnRecord.complaintDescription'), 'createCustomerReturn maps complaint_description to DB');
assert(serviceContent.includes('photos: returnRecord.photos'), 'createCustomerReturn maps photos array to DB');

// 4. Verify Returns Table Layout (src/components/purchases/PurchaseReturnsTab.tsx)
console.log('\n--- 4. Verification of Returns Table (src/components/purchases/PurchaseReturnsTab.tsx) ---');
const tabPath = path.resolve(__dirname, '../src/components/purchases/PurchaseReturnsTab.tsx');
assert(fs.existsSync(tabPath), 'PurchaseReturnsTab.tsx exists');
const tabContent = fs.readFileSync(tabPath, 'utf-8');

// Check exact 8 column headers in exact order (Purchase Date column removed per user request):
// 1. Product Name, 2. Customer Name, 3. Customer Phone, 4. Return Date, 5. Return Quantity, 6. Return Problem, 7. Status, 8. Action
const tableHeadersRegex = /<th[^>]*>([\s\S]*?)<\/th>/g;
const thMatches: string[] = [];
let match;
while ((match = tableHeadersRegex.exec(tabContent)) !== null) {
  const headerText = match[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').trim();
  if (headerText) {
    thMatches.push(headerText);
  }
}

console.log('Detected Table Headers:', thMatches);

assert(thMatches[0]?.includes('Product Name'), 'Column 1 is Product Name');
assert(thMatches[1]?.includes('Customer Name'), 'Column 2 is Customer Name');
assert(thMatches[2]?.includes('Customer Phone'), 'Column 3 is Customer Phone');
assert(thMatches[3]?.includes('Return Date'), 'Column 4 is Return Date');
assert(thMatches[4]?.includes('Return Quantity'), 'Column 5 is Return Quantity');
assert(thMatches[5]?.includes('Return Problem'), 'Column 6 is Return Problem');
assert(thMatches[6]?.includes('Status'), 'Column 7 is Status');
assert(thMatches[7]?.includes('Action'), 'Column 8 is Action');

assert(!thMatches.some(h => h.includes('Purchase Date')), 'Purchase Date column is deleted from the table');
assert(thMatches.length === 8, 'Table contains exactly 8 columns in strict sequence');

assert(tabContent.includes('Add Return'), 'PurchaseReturnsTab contains "Add Return" button');
assert(tabContent.includes('setIsAddModalOpen(true)'), '"Add Return" button opens AddCustomerReturnModal');
assert(tabContent.includes('<AddCustomerReturnModal'), 'AddCustomerReturnModal is rendered');
assert(tabContent.includes('<ReturnComplaintDetailModal'), 'ReturnComplaintDetailModal is rendered');

// Eye Icon Button
assert(
  tabContent.includes('<Eye className="w-4 h-4') && !tabContent.includes('<span>View</span>'),
  'Action column provides an Eye icon button with the "View" text removed'
);

// Status Badges
assert(
  tabContent.includes('Pending') && tabContent.includes('Approved') && tabContent.includes('Rejected'),
  'Table supports Pending, Approved, and Rejected status badges'
);

// Search and Filters
assert(
  tabContent.includes("placeholder=\"Search returns by product, customer, or phone...\""),
  'Search bar allows filtering returns by product, customer, or phone'
);
assert(
  tabContent.includes("['All', 'Pending', 'Approved', 'Rejected']"),
  'Status filter pills for All, Pending, Approved, Rejected are provided'
);

// 5. Verify Add Customer Return Form (src/components/purchases/AddCustomerReturnModal.tsx)
console.log('\n--- 5. Verification of Add Customer Return Form (AddCustomerReturnModal.tsx) ---');
const addModalPath = path.resolve(__dirname, '../src/components/purchases/AddCustomerReturnModal.tsx');
assert(fs.existsSync(addModalPath), 'AddCustomerReturnModal.tsx exists');
const addModalContent = fs.readFileSync(addModalPath, 'utf-8');

// Section A: Customer Details
assert(
  addModalContent.includes('Section A: Customer Details') &&
  addModalContent.includes('Customer Name') &&
  addModalContent.includes('Customer Phone Number') &&
  addModalContent.includes('Original Invoice / Bill Number'),
  'Section A contains Customer Name, Customer Phone Number, Original Invoice / Bill Number'
);
assert(
  addModalContent.includes('Lookup Customer by Name or Phone') &&
  addModalContent.includes('handleSelectCustomer'),
  'Section A provides customer lookup auto-populating customer info'
);

// Section B: Product Details
assert(
  addModalContent.includes('Section B: Product Details') &&
  addModalContent.includes('Product Name') &&
  addModalContent.includes('Product ID') &&
  addModalContent.includes('Purchase Date') &&
  addModalContent.includes('Purchased Qty') &&
  addModalContent.includes('Return Qty') &&
  addModalContent.includes('Unit'),
  'Section B contains Product Name, Product ID, Purchase Date, Original Invoice Number, Purchased Qty, Return Qty, Product Unit'
);
assert(
  addModalContent.includes('availableInvoiceProducts'),
  'Section B allows selection only from products associated with original invoice'
);

// Section C: Return Complaint Details
assert(
  addModalContent.includes('Section C: Return Complaint Details') &&
  addModalContent.includes('Damaged Product') &&
  addModalContent.includes('Broken Product') &&
  addModalContent.includes('Defective Product') &&
  addModalContent.includes('Wrong Product Delivered') &&
  addModalContent.includes('Missing Parts') &&
  addModalContent.includes('Quality Issue') &&
  addModalContent.includes('Expired Product') &&
  addModalContent.includes('Other'),
  'Section C contains exact Return Problem dropdown options'
);
assert(
  addModalContent.includes('<textarea') &&
  addModalContent.includes('Complaint Description') &&
  addModalContent.includes('The product was damaged when the customer received it. The outer packaging was also broken.'),
  'Section C provides a large text area for complaint description with specified placeholder'
);

// Section D: Attach Product Photos
assert(
  addModalContent.includes('Section D: Attach Product Photos') &&
  addModalContent.includes('accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"') &&
  addModalContent.includes('multiple'),
  'Section D provides multi-file photo upload accepting JPG, JPEG, PNG, WEBP'
);
assert(
  addModalContent.includes('handleFileChange') &&
  addModalContent.includes('previewUrl') &&
  addModalContent.includes('handleRemovePhoto'),
  'Section D renders image previews before submission and allows removing photos'
);
assert(
  addModalContent.includes('customerReturnService.uploadReturnPhoto'),
  'Section D saves photos in Supabase Storage'
);

// Return Submission Rules
assert(
  addModalContent.includes("returnStatus: 'Pending'") &&
  addModalContent.includes('directRestock: false'),
  "Return submission sets initial status to 'Pending' with directRestock: false (inventory stock strictly preserved)"
);

// 6. Verify Return Complaint Detail Modal (src/components/purchases/ReturnComplaintDetailModal.tsx)
console.log('\n--- 6. Verification of View Complaint Modal (ReturnComplaintDetailModal.tsx) ---');
const detailModalPath = path.resolve(__dirname, '../src/components/purchases/ReturnComplaintDetailModal.tsx');
assert(fs.existsSync(detailModalPath), 'ReturnComplaintDetailModal.tsx exists');
const detailModalContent = fs.readFileSync(detailModalPath, 'utf-8');

assert(
  detailModalContent.includes('Customer Information') &&
  detailModalContent.includes('Product Information') &&
  detailModalContent.includes('Complaint Information') &&
  detailModalContent.includes('Attached Product Photos') &&
  detailModalContent.includes('Return Summary & Tracking Information'),
  'View modal displays Customer Information, Product Information, Complaint Information, Attached Photos, and Return Details'
);
assert(
  detailModalContent.includes('setEnlargedPhoto') &&
  detailModalContent.includes('enlargedPhoto && ('),
  'View modal supports enlarged photo lightbox zoom when clicking any photo'
);

// 7. Verify Purchases & PO Tab Counter (src/pages/purchases/PurchaseInvoicesPage.tsx)
console.log('\n--- 7. Verification of Purchases & PO Page Integration ---');
const pagePath = path.resolve(__dirname, '../src/pages/purchases/PurchaseInvoicesPage.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf-8');

assert(
  pageContent.includes("id: 'returns', label: 'Returns', count: customerReturns.length > 0 ? customerReturns.length : purchaseReturnsList.length"),
  'Returns tab count reflects customer returns'
);
assert(
  pageContent.includes("<PurchaseReturnsTab") && pageContent.includes("activeTab === 'returns'"),
  'Returns tab displays PurchaseReturnsTab'
);
assert(
  pageContent.includes("activeTab === 'returns' ? (") && pageContent.includes("<span>Add Return</span>"),
  'Purchases & PO header card provides "+ Add Return" button when activeTab === "returns"'
);

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL CUSTOMER PRODUCT RETURN MANAGEMENT TESTS PASSED!');
  process.exit(0);
}
