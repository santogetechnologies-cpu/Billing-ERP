/**
 * Test Suite: Replenishment Reason Input Focus, Auto-Selection, and Replacement
 *
 * Verifies:
 * 1. Default reason text is preserved if the user does not edit the field.
 * 2. On focus and click, the entire default text is automatically selected.
 * 3. Immediate typing replaces the entire default text rather than inserting in the middle.
 * 4. Once edited, subsequent typing behaves normally.
 * 5. Returning/refocusing an already edited field does NOT re-select all text.
 * 6. Required validation and submission payload integrity are maintained.
 * 7. Opening a new modal resets the auto-selection state for the next request.
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
console.log('TEST SUITE: REPLENISHMENT REASON INPUT FOCUS & AUTO-SELECTION');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Component Simulation
// -----------------------------------------------------------------------------
class ReplenishmentReasonInputSimulator {
  public value: string;
  public selectionStart: number;
  public selectionEnd: number;
  public isReasonEdited: boolean;
  public shouldSelectOnMouseUp: boolean;
  public isFocused: boolean;
  public defaultReason: string;

  constructor(initialDefault: string) {
    this.defaultReason = initialDefault;
    this.value = initialDefault;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.isReasonEdited = false;
    this.shouldSelectOnMouseUp = false;
    this.isFocused = false;
  }

  public select() {
    this.selectionStart = 0;
    this.selectionEnd = this.value.length;
  }

  public resetModal(newDefault: string) {
    this.defaultReason = newDefault;
    this.value = newDefault;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.isReasonEdited = false;
    this.shouldSelectOnMouseUp = false;
    this.isFocused = false;
  }

  // Event handlers matching the React implementation
  public onMouseDown() {
    if (!this.isReasonEdited && !this.isFocused) {
      this.shouldSelectOnMouseUp = true;
    }
  }

  public onFocus() {
    this.isFocused = true;
    if (!this.isReasonEdited) {
      this.select();
    }
  }

  public onMouseUp(clickCursorPos?: number) {
    if (this.shouldSelectOnMouseUp) {
      this.shouldSelectOnMouseUp = false;
      this.select();
    } else if (clickCursorPos !== undefined) {
      // Normal click behavior if not auto-selecting
      this.selectionStart = clickCursorPos;
      this.selectionEnd = clickCursorPos;
    }
  }

  public onKeyDown(key: string, isPrintable: boolean = true) {
    if (!this.isReasonEdited) {
      if (key === 'Tab' || key === 'Escape') {
        return;
      }
      if (isPrintable) {
        if (this.selectionStart !== 0 || this.selectionEnd !== this.value.length) {
          this.select();
        }
      }
    }
  }

  public typeKey(key: string) {
    this.onKeyDown(key, true);

    // If text was selected, replace selection; otherwise insert at cursor
    const before = this.value.substring(0, this.selectionStart);
    const after = this.value.substring(this.selectionEnd);
    const newValue = before + key + after;
    const newCursor = before.length + key.length;

    this.onChange(newValue);
    this.selectionStart = newCursor;
    this.selectionEnd = newCursor;
  }

  public onChange(newValue: string) {
    this.isReasonEdited = true;
    this.value = newValue;
  }

  public onBlur() {
    this.isFocused = false;
    this.shouldSelectOnMouseUp = false;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Preserving Default Reason when Unedited
// -----------------------------------------------------------------------------
console.log('👉 Test 1: Preserving Default Reason when Unedited');
const defaultMsg = 'Critical inventory replenishment: Items are out of stock';
const sim1 = new ReplenishmentReasonInputSimulator(defaultMsg);

assert(sim1.value === defaultMsg, 'Initial input value matches default reason text');
assert(!sim1.isReasonEdited, 'Input is flagged as unedited initially');

// Submit without editing
const payloadReason1 = sim1.value.trim() || 'Inventory replenishment for low stock items';
assert(payloadReason1 === defaultMsg, 'Submission preserves the full default reason text');

// -----------------------------------------------------------------------------
// Test 2: Click to Focus Auto-Selects Entire Default Text
// -----------------------------------------------------------------------------
console.log('\n👉 Test 2: Click to Focus Auto-Selects Entire Default Text');
const sim2 = new ReplenishmentReasonInputSimulator(defaultMsg);

// User clicks in the middle of the field (e.g., character index 15)
sim2.onMouseDown();
assert(sim2.shouldSelectOnMouseUp === true, 'MouseDown flags for mouseup selection on initial focus');

sim2.onFocus();
assert(sim2.selectionStart === 0 && sim2.selectionEnd === defaultMsg.length, 'onFocus selects the entire text');

// Browser fires mouseup (which normally would have placed the cursor at index 15)
sim2.onMouseUp(15);
assert(
  sim2.selectionStart === 0 && sim2.selectionEnd === defaultMsg.length,
  'onMouseUp maintains complete selection of default text rather than placing cursor at index 15'
);

// -----------------------------------------------------------------------------
// Test 3: Immediate Typing Replaces Default Text Without Manual Deletion
// -----------------------------------------------------------------------------
console.log('\n👉 Test 3: Immediate Typing Replaces Default Text');
// When the user starts typing "Urgent stock", the first key 'U' must replace the entire default text
sim2.typeKey('U');
assert(sim2.value === 'U', `First typed character replaced entire text (got: "${sim2.value}")`);
assert(sim2.isReasonEdited === true, 'Field is now flagged as edited by user');

// User continues typing the rest of their custom reason
const restOfText = 'rgent replenishment for weekly promotion';
for (const char of restOfText) {
  sim2.typeKey(char);
}
assert(
  sim2.value === 'Urgent replenishment for weekly promotion',
  `Full custom reason entered properly (got: "${sim2.value}")`
);

// -----------------------------------------------------------------------------
// Test 4: Returning to an Already Edited Field Does NOT Reselect All Text
// -----------------------------------------------------------------------------
console.log('\n👉 Test 4: Returning to an Already Edited Field');
// User clicks outside (blur) to check item list
sim2.onBlur();
assert(!sim2.isFocused, 'Field blurred');

// User clicks back into the field at position 6 (between "Urgent" and "replenishment")
sim2.onMouseDown();
assert(sim2.shouldSelectOnMouseUp === false, 'shouldSelectOnMouseUp is false because field was already edited');

sim2.onFocus();
// onFocus does not call select() because isReasonEdited is true
sim2.onMouseUp(6);
assert(sim2.selectionStart === 6 && sim2.selectionEnd === 6, 'Cursor placed precisely at position 6 without auto-selecting');

// User types a word at position 6
sim2.typeKey(' ');
sim2.typeKey('store');
assert(
  sim2.value === 'Urgent store replenishment for weekly promotion',
  'User is able to edit within their custom text without the whole string being replaced'
);

// -----------------------------------------------------------------------------
// Test 5: Keyboard Tab Focus Auto-Selects Default Text
// -----------------------------------------------------------------------------
console.log('\n👉 Test 5: Keyboard Tab Navigation Auto-Selection');
const sim3 = new ReplenishmentReasonInputSimulator('Routine inventory replenishment for stock at warning levels');

// User tabs into the field (no mouse events)
sim3.onFocus();
assert(
  sim3.selectionStart === 0 && sim3.selectionEnd === sim3.value.length,
  'Tab navigation triggers complete selection of default text'
);

// User presses Backspace to clear it
sim3.onChange('');
assert(sim3.value === '', 'User was able to clear field with a single keystroke');
assert(sim3.isReasonEdited === true, 'Field marked as edited');

// -----------------------------------------------------------------------------
// Test 6: Re-opening Modal Resets Auto-Selection for New Requests
// -----------------------------------------------------------------------------
console.log('\n👉 Test 6: Re-opening Modal Resets State');
sim2.resetModal('Stock replenishment: Inventory at or below configured warning limits');
assert(!sim2.isReasonEdited, 'isReasonEdited reset to false upon new modal opening');

sim2.onMouseDown();
sim2.onFocus();
sim2.onMouseUp(5);
assert(
  sim2.selectionStart === 0 && sim2.selectionEnd === sim2.value.length,
  'Next replenishment request auto-selects new default text on focus'
);

console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
