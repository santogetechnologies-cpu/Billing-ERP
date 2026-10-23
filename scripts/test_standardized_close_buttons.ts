// Test Suite: Standardized Close Buttons Across Universal Billing ERP
// Validates presence, tokens, behavior, and global adoption of the unified ESC + Red X close control.

import fs from 'fs';
import path from 'path';

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

async function runCloseButtonTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: STANDARDIZED CLOSE CONTROLS (ESC + RED X)');
  console.log('================================================================================\n');

  const rootDir = process.cwd();

  // 1. Reusable ModalCloseButton Component Definition
  console.log('--- 1. Shared Reusable ModalCloseButton Component ---');
  const modalCloseButtonPath = path.join(rootDir, 'src', 'components', 'common', 'ModalCloseButton.tsx');
  assert(fs.existsSync(modalCloseButtonPath), 'ModalCloseButton.tsx exists in src/components/common/');

  const modalCloseButtonSrc = fs.readFileSync(modalCloseButtonPath, 'utf8');
  assert(modalCloseButtonSrc.includes('export const ModalCloseButton'), 'Exports ModalCloseButton component');
  assert(modalCloseButtonSrc.includes('escLabel'), 'Supports configurable or default ESC label');
  assert(modalCloseButtonSrc.includes('bg-slate-100'), 'ESC button uses light grey rounded background');
  assert(modalCloseButtonSrc.includes('border-slate-200'), 'ESC button uses subtle grey border');
  assert(modalCloseButtonSrc.includes('bg-[#FEF2F2]') || modalCloseButtonSrc.includes('bg-rose-50'), 'X button uses light red / pale pink background');
  assert(modalCloseButtonSrc.includes('border-[#FECACA]') || modalCloseButtonSrc.includes('border-rose-200'), 'X button uses subtle red border');
  assert(modalCloseButtonSrc.includes('text-[#DC2626]') || modalCloseButtonSrc.includes('text-rose-600'), 'X button uses clear red icon color');
  assert(modalCloseButtonSrc.includes('hover:bg-[#FEE2E2]') || modalCloseButtonSrc.includes('hover:bg-rose-100'), 'X button provides subtle hover state');
  assert(modalCloseButtonSrc.includes('e.stopPropagation()'), 'Close handlers stop event propagation to protect parent containers');
  assert(modalCloseButtonSrc.includes("e.key === 'Escape'"), 'Supports Escape key handler');

  // 2. Shared Modal & Drawer Integration
  console.log('\n--- 2. Shared Modal and Drawer Integration ---');
  const modalPath = path.join(rootDir, 'src', 'components', 'common', 'Modal.tsx');
  const modalSrc = fs.readFileSync(modalPath, 'utf8');
  assert(modalSrc.includes("import { ModalCloseButton } from './ModalCloseButton';"), 'Modal.tsx imports ModalCloseButton');
  assert(modalSrc.includes('<ModalCloseButton onClose={onClose} />'), 'Modal.tsx uses ModalCloseButton in header');
  assert(modalSrc.includes('e.stopPropagation()'), 'Modal.tsx prevents Escape propagation to avoid closing parent modals');

  const drawerPath = path.join(rootDir, 'src', 'components', 'common', 'Drawer.tsx');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  assert(drawerSrc.includes("import { ModalCloseButton } from './ModalCloseButton';"), 'Drawer.tsx imports ModalCloseButton');
  assert(drawerSrc.includes('<ModalCloseButton onClose={onClose} />'), 'Drawer.tsx uses ModalCloseButton in header');
  assert(drawerSrc.includes('e.stopPropagation()'), 'Drawer.tsx prevents Escape propagation to avoid closing parent containers');

  // 3. GlobalSearch Modal Integration
  console.log('\n--- 3. GlobalSearch Dialog Integration ---');
  const searchPath = path.join(rootDir, 'src', 'components', 'common', 'GlobalSearch.tsx');
  const searchSrc = fs.readFileSync(searchPath, 'utf8');
  assert(searchSrc.includes('ModalCloseButton'), 'GlobalSearch.tsx imports ModalCloseButton');
  assert(searchSrc.includes('<ModalCloseButton onClose={handleClose}'), 'GlobalSearch.tsx uses standardized ModalCloseButton');

  // 4. User Profile & Print Modal Integration
  console.log('\n--- 4. User Profile and Invoice Print Modals ---');
  const userProfilePath = path.join(rootDir, 'src', 'components', 'auth', 'UserProfileModal.tsx');
  const userProfileSrc = fs.readFileSync(userProfilePath, 'utf8');
  assert(userProfileSrc.includes('ModalCloseButton'), 'UserProfileModal.tsx imports ModalCloseButton');
  assert(userProfileSrc.includes('<ModalCloseButton onClose={onClose} autoHandleEscape={true}'), 'UserProfileModal.tsx uses ModalCloseButton with Escape support');

  const printModalPath = path.join(rootDir, 'src', 'components', 'invoice', 'InvoicePrintModal.tsx');
  const printModalSrc = fs.readFileSync(printModalPath, 'utf8');
  assert(printModalSrc.includes('ModalCloseButton'), 'InvoicePrintModal.tsx imports ModalCloseButton');
  assert(printModalSrc.includes('<ModalCloseButton onClose={onClose} autoHandleEscape={true}'), 'InvoicePrintModal.tsx uses ModalCloseButton with Escape support');

  // 5. Settings Page Governance Modals Integration
  console.log('\n--- 5. Settings Page Governance Modals ---');
  const settingsPath = path.join(rootDir, 'src', 'pages', 'settings', 'SettingsPage.tsx');
  const settingsSrc = fs.readFileSync(settingsPath, 'utf8');
  assert(settingsSrc.includes('ModalCloseButton'), 'SettingsPage.tsx imports ModalCloseButton');
  assert(settingsSrc.includes('<ModalCloseButton onClose={() => setViewingPolicy(null)} autoHandleEscape={true} />'), 'Policy View modal uses ModalCloseButton');
  assert(settingsSrc.includes('setIsCreatingPolicy(false)') && settingsSrc.includes('<ModalCloseButton'), 'Policy Author/Edit modal uses ModalCloseButton');
  assert(settingsSrc.includes('<ModalCloseButton onClose={() => setHistoryModalPolicy(null)} autoHandleEscape={true} />'), 'Policy History modal uses ModalCloseButton');

  // 6. FastPOS Tender & Held Invoices Modals Integration
  console.log('\n--- 6. FastPOS Tender & Held Invoices Modals ---');
  const fastPosPath = path.join(rootDir, 'src', 'pages', 'sales', 'FastPOSPage.tsx');
  const fastPosSrc = fs.readFileSync(fastPosPath, 'utf8');
  assert(fastPosSrc.includes('ModalCloseButton'), 'FastPOSPage.tsx imports ModalCloseButton');
  assert(fastPosSrc.includes('<ModalCloseButton onClose={() => setPaymentModalOpen(false)} autoHandleEscape={true} />'), 'FastPOS Tender Payment modal uses ModalCloseButton');
  assert(fastPosSrc.includes('<ModalCloseButton onClose={() => setHoldDrawerOpen(false)} autoHandleEscape={true} />'), 'FastPOS Held Invoices drawer uses ModalCloseButton');

  console.log(`\n================================================================================`);
  console.log(`SUMMARY: ${passedTests} OF ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}% SUCCESS)`);
  console.log(`================================================================================\n`);
}

runCloseButtonTests();
