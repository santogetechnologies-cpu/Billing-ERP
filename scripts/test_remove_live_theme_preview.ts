import { readFileSync } from 'fs';
import { resolve } from 'path';

function runTest() {
  console.log('--- Testing Removal of Live Theme Preview from Settings -> Appearance & Theme ---');
  const settingsPath = resolve(process.cwd(), 'src/pages/settings/SettingsPage.tsx');
  const content = readFileSync(settingsPath, 'utf-8');

  // Check 1: Live Theme Preview text is removed
  if (content.includes('Live Theme Preview')) {
    throw new Error('FAILED: "Live Theme Preview" is still present in SettingsPage.tsx');
  }
  console.log('✓ PASS: "Live Theme Preview" heading has been removed');

  // Check 2: Preview buttons (Primary Button, Subtle Accent, Badge Active) removed from Appearance
  if (content.includes('Primary Button') || content.includes('Subtle Accent') || content.includes('Badge Active')) {
    throw new Error('FAILED: Preview buttons or badges are still present in SettingsPage.tsx');
  }
  console.log('✓ PASS: Theme preview buttons and badges have been removed');

  // Check 3: Sidebar Menu Active Highlight preview removed
  if (content.includes('Sidebar Menu Active Highlight') || content.includes('Selected Navigation Item')) {
    throw new Error('FAILED: "Sidebar Menu Active Highlight" preview is still present in SettingsPage.tsx');
  }
  console.log('✓ PASS: Sidebar menu active highlight preview has been removed');

  // Check 4: Primary Accent Color selector is preserved
  if (!content.includes('Primary Accent Color') || !content.includes('setPrimaryColor')) {
    throw new Error('FAILED: Primary Accent Color selector is missing');
  }
  console.log('✓ PASS: Primary Accent Color selector and color choices are preserved');

  // Check 5: No unused Sparkles import
  if (content.includes('Sparkles,')) {
    throw new Error('FAILED: Unused Sparkles icon is still imported');
  }
  console.log('✓ PASS: Unused Sparkles import cleaned up');

  console.log('\n--- All Live Theme Preview Removal Tests Passed! ---');
}

runTest();
