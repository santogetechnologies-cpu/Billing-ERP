/**
 * Test Suite: Replenishment Reason Default Value, Custom Text Preservation,
 * Mandatory Validation, and Edit Saved Request Workflow
 *
 * Verifies:
 * 1. A new form displays the default reason automatically.
 * 2. The user can edit, delete, or replace the default text.
 * 3. The custom reason remains unchanged when warehouse, priority, quantities, line items, or other fields change.
 * 4. The submitted request saves the user's exact text (no fallback substitution).
 * 5. An empty reason triggers validation instead of being silently repopulated.
 * 6. Previously saved reasons remain intact when editing an existing request.
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('========================================================================');
console.log('TEST SUITE: REPLENISHMENT REASON PRESERVATION & VALIDATION');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Form State Simulator matching the React components
// -----------------------------------------------------------------------------
class PurchaseRequestFormSimulator {
  public editingRequestId: string | null = null;
  public warehouseId: string = 'wh-1';
  public priority: 'Normal' | 'High' | 'Urgent' = 'High';
  public reason: string = '';
  public reasonError: string | null = null;
  public deliveryDate: string = '2026-10-30';
  public notes: string = '';
  public items: Array<{ id: string; name: string; currentStock: number; requestedQty: number }> = [];
  public isReasonEdited: boolean = false;
  public isModalOpen: boolean = false;

  // 1. Open form for a new request
  public openNewRequestModal(products: Array<{ id: string; name: string; currentStock: number }>) {
    this.editingRequestId = null;
    this.warehouseId = 'wh-1';
    this.items = products.map(p => ({
      id: p.id,
      name: p.name,
      currentStock: p.currentStock,
      requestedQty: p.currentStock <= 0 ? 20 : 10
    }));
    this.priority = this.items.some(i => i.currentStock <= 0) ? 'Urgent' : 'High';
    this.reason = this.items.some(i => i.currentStock <= 0)
      ? 'Critical inventory replenishment: Items are out of stock'
      : 'Stock replenishment: Inventory at or below configured warning limits';
    this.reasonError = null;
    this.isReasonEdited = false;
    this.isModalOpen = true;
  }

  // 2. Open form for editing an existing saved request
  public openEditRequestModal(savedRequest: {
    id: string;
    warehouseId: string;
    priority: 'Normal' | 'High' | 'Urgent';
    reason: string;
    requestedDeliveryDate?: string;
    notes?: string;
    items: Array<{ id: string; name: string; currentStock: number; requestedQty: number }>;
  }) {
    this.editingRequestId = savedRequest.id;
    this.warehouseId = savedRequest.warehouseId;
    this.priority = savedRequest.priority;
    // Must preserve the saved reason exactly
    this.reason = savedRequest.reason || '';
    this.isReasonEdited = true;
    this.reasonError = null;
    if (savedRequest.requestedDeliveryDate) {
      this.deliveryDate = savedRequest.requestedDeliveryDate;
    }
    this.notes = savedRequest.notes || '';
    this.items = [...savedRequest.items];
    this.isModalOpen = true;
  }

  // User typing in the reason input
  public onReasonChange(newVal: string) {
    this.isReasonEdited = true;
    this.reason = newVal;
    if (this.reasonError) this.reasonError = null;
  }

  // Changing other fields
  public changeWarehouse(whId: string) {
    this.warehouseId = whId;
  }

  public changePriority(p: 'Normal' | 'High' | 'Urgent') {
    this.priority = p;
  }

  public changeItemQty(itemId: string, qty: number) {
    this.items = this.items.map(it => it.id === itemId ? { ...it, requestedQty: qty } : it);
  }

  public addItem(item: { id: string; name: string; currentStock: number; requestedQty: number }) {
    this.items.push(item);
  }

  public removeItem(itemId: string) {
    this.items = this.items.filter(it => it.id !== itemId);
  }

  public changeNotes(n: string) {
    this.notes = n;
  }

  // Form Submission
  public submit(): { success: boolean; payload?: any; error?: string } {
    if (this.items.length === 0) {
      return { success: false, error: 'Please include at least one product in the purchase request.' };
    }

    const trimmedReason = this.reason.trim();
    if (!trimmedReason) {
      this.reasonError = 'Replenishment Reason is required. Please provide a reason for this purchase request.';
      return { success: false, error: this.reasonError };
    }

    for (const it of this.items) {
      if (!it.requestedQty || it.requestedQty <= 0) {
        return { success: false, error: 'Requested quantity must be greater than zero.' };
      }
    }

    const payload = {
      requestId: this.editingRequestId,
      warehouseId: this.warehouseId,
      priority: this.priority,
      reason: trimmedReason, // Uses user-entered reason without fallback
      requestedDeliveryDate: this.deliveryDate,
      notes: this.notes.trim(),
      items: this.items
    };

    return { success: true, payload };
  }
}

// -----------------------------------------------------------------------------
// Test 1: New Form displays default reason automatically
// -----------------------------------------------------------------------------
console.log('--- Test 1: Initial Default Reason on Form Open ---');
const form = new PurchaseRequestFormSimulator();

form.openNewRequestModal([
  { id: 'prod-1', name: 'Ultra Cement 50kg', currentStock: 0 },
  { id: 'prod-2', name: 'Premium Paint White', currentStock: 5 }
]);

assert(form.isModalOpen === true, 'Modal is open');
assert(
  form.reason === 'Critical inventory replenishment: Items are out of stock',
  'Out of stock product generates "Critical inventory replenishment: Items are out of stock" default reason'
);
assert(form.isReasonEdited === false, 'isReasonEdited starts false on newly opened form');

// Non-zero stock product
const formNonZero = new PurchaseRequestFormSimulator();
formNonZero.openNewRequestModal([
  { id: 'prod-3', name: 'Steel Wire 10m', currentStock: 3 }
]);
assert(
  formNonZero.reason === 'Stock replenishment: Inventory at or below configured warning limits',
  'Warning level product generates "Stock replenishment: Inventory at or below configured warning limits" default reason'
);

// -----------------------------------------------------------------------------
// Test 2: User can edit, replace, or delete the default text
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: User Can Edit, Replace, or Delete Default Text ---');
const userCustomReason = 'Urgent restock required for cement and paint.';
form.onReasonChange(userCustomReason);

assert(form.reason === userCustomReason, 'Reason matches user typed string exactly');
assert(form.isReasonEdited === true, 'isReasonEdited becomes true after typing');

// -----------------------------------------------------------------------------
// Test 3: Custom reason preserved when other form fields are changed
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Preservation across Form Field Edits ---');
form.changeWarehouse('wh-2');
assert(form.warehouseId === 'wh-2', 'Warehouse changed to wh-2');
assert(form.reason === userCustomReason, 'Reason remains unchanged after warehouse edit');

form.changePriority('Normal');
assert(form.priority === 'Normal', 'Priority changed to Normal');
assert(form.reason === userCustomReason, 'Reason remains unchanged after priority edit');

form.changeItemQty('prod-1', 45);
assert(form.items.find(i => i.id === 'prod-1')?.requestedQty === 45, 'Quantity updated to 45');
assert(form.reason === userCustomReason, 'Reason remains unchanged after quantity update');

form.addItem({ id: 'prod-4', name: 'Reinforcement Bar', currentStock: 0, requestedQty: 30 });
assert(form.items.length === 3, 'Item added to request list');
assert(form.reason === userCustomReason, 'Reason remains unchanged after adding new line item');

form.removeItem('prod-2');
assert(form.items.length === 2, 'Item removed from request list');
assert(form.reason === userCustomReason, 'Reason remains unchanged after removing line item');

form.changeNotes('Please expedite shipment.');
assert(form.notes === 'Please expedite shipment.', 'Notes updated');
assert(form.reason === userCustomReason, 'Reason remains unchanged after notes edit');

// -----------------------------------------------------------------------------
// Test 4: Submitted request saves user exact text without fallback
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Submitted Request Saves Exact Text ---');
const submitResult = form.submit();
assert(submitResult.success === true, 'Form submission succeeds with valid custom reason');
assert(
  submitResult.payload.reason === 'Urgent restock required for cement and paint.',
  `Submitted payload.reason === "${submitResult.payload.reason}" (exact user text preserved, no fallback)`
);

// -----------------------------------------------------------------------------
// Test 5: Empty reason triggers validation error instead of silent fallback
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Empty Reason Mandatory Validation ---');
const emptyReasonForm = new PurchaseRequestFormSimulator();
emptyReasonForm.openNewRequestModal([
  { id: 'prod-1', name: 'Ultra Cement 50kg', currentStock: 0 }
]);

// User clears the field
emptyReasonForm.onReasonChange('');
assert(emptyReasonForm.reason === '', 'Field is kept empty as user typed');

// User tries to submit
const emptySubmit = emptyReasonForm.submit();
assert(emptySubmit.success === false, 'Form submission fails when reason is empty');
assert(
  emptyReasonForm.reasonError !== null &&
  emptyReasonForm.reasonError.includes('Replenishment Reason is required'),
  `Validation error displayed: "${emptyReasonForm.reasonError}"`
);
assert(emptyReasonForm.reason === '', 'Reason is NOT silently repopulated with default text');

// User types spaces only
emptyReasonForm.onReasonChange('    ');
const whitespaceSubmit = emptyReasonForm.submit();
assert(whitespaceSubmit.success === false, 'Whitespace-only reason is rejected by validation');
assert(
  emptyReasonForm.reasonError !== null,
  'Validation error displayed for whitespace-only input'
);

// -----------------------------------------------------------------------------
// Test 6: Reopening a previously saved request preserves its saved reason
// -----------------------------------------------------------------------------
console.log('\n--- Test 6: Reopening Saved Request for Editing Preserves Saved Reason ---');
const editForm = new PurchaseRequestFormSimulator();
const savedRequest = {
  id: 'PR-2026-0042',
  warehouseId: 'wh-north',
  priority: 'Urgent' as const,
  reason: 'Seasonal high demand for coastal construction project',
  requestedDeliveryDate: '2026-11-05',
  notes: 'Deliver to gate 4',
  items: [
    { id: 'p-101', name: 'Portland Cement Bag', currentStock: 0, requestedQty: 100 }
  ]
};

editForm.openEditRequestModal(savedRequest);

assert(editForm.editingRequestId === 'PR-2026-0042', 'Form is in edit mode for saved request');
assert(
  editForm.reason === 'Seasonal high demand for coastal construction project',
  'Saved replenishment reason is preserved intact upon opening edit form'
);
assert(editForm.isReasonEdited === true, 'isReasonEdited is true so saved reason is not treated as unedited default');

// Edit other fields during editing
editForm.changePriority('High');
editForm.changeItemQty('p-101', 120);
assert(
  editForm.reason === 'Seasonal high demand for coastal construction project',
  'Saved replenishment reason remains intact when priority and quantities are updated'
);

// Submit edit
const editSubmit = editForm.submit();
assert(editSubmit.success === true, 'Edit submission succeeds');
assert(
  editSubmit.payload.reason === 'Seasonal high demand for coastal construction project',
  'Payload contains the exact saved reason'
);
assert(editSubmit.payload.requestId === 'PR-2026-0042', 'Payload specifies the editing request ID');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}
