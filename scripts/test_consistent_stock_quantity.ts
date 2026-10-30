import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StockStatusBadge, StatusBadge } from '../src/components/common/StatusBadge';
import { calculateStockStatus } from '../src/utils/inventoryUtils';

function runTests() {
  console.log('--- Starting Stock Status & Quantity Consistency Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // Test 1: Out of Stock formatting with unit
  {
    const html = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'Out of Stock',
        currentStock: 0,
        unit: 'Bag',
        align: 'center'
      })
    );
    assert(html.includes('Out of Stock'), 'Test 1.1: Out of Stock badge text is rendered');
    assert(html.includes('0 Bag'), 'Test 1.2: "0 Bag" is rendered directly below');
    assert(html.includes('text-rose-600'), 'Test 1.3: "0 Bag" uses text-rose-600 styling');
    assert(html.includes('font-mono font-bold text-xs'), 'Test 1.4: Quantity uses font-mono font-bold text-xs');
  }

  // Test 2: Limited Stock formatting with unit
  {
    const html = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'Limited Stock',
        currentStock: 8,
        unit: 'Pack',
        align: 'center'
      })
    );
    assert(html.includes('Limited'), 'Test 2.1: Limited badge text is rendered (normalized)');
    assert(html.includes('8 Pack'), 'Test 2.2: "8 Pack" is rendered directly below');
    assert(html.includes('text-amber-600'), 'Test 2.3: "8 Pack" uses text-amber-600 styling');
  }

  // Test 3: Active / In Stock formatting with unit
  {
    const html = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'Active',
        currentStock: 50,
        unit: 'Piece',
        align: 'center'
      })
    );
    assert(html.includes('Active'), 'Test 3.1: Active badge text is rendered');
    assert(html.includes('50 Piece'), 'Test 3.2: "50 Piece" is rendered directly below');
    assert(html.includes('text-emerald-600'), 'Test 3.3: "50 Piece" uses text-emerald-600 styling');
  }

  // Test 4: Default unit fallback to Piece if omitted
  {
    const html = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'Limited',
        currentStock: 10,
        align: 'center'
      })
    );
    assert(html.includes('10 Piece'), 'Test 4: Defaults unit to "Piece" when unit is undefined');
  }

  // Test 5: Alignments (center, left, right)
  {
    const htmlCenter = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'In Stock',
        currentStock: 25,
        unit: 'Kg',
        align: 'center'
      })
    );
    assert(htmlCenter.includes('items-center text-center'), 'Test 5.1: Center alignment applies items-center text-center');

    const htmlLeft = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'In Stock',
        currentStock: 25,
        unit: 'Kg',
        align: 'left'
      })
    );
    assert(htmlLeft.includes('items-start text-left'), 'Test 5.2: Left alignment applies items-start text-left');

    const htmlRight = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'In Stock',
        currentStock: 25,
        unit: 'Kg',
        align: 'right'
      })
    );
    assert(htmlRight.includes('items-end text-right'), 'Test 5.3: Right alignment applies items-end text-right');
  }

  // Test 6: Backward compatibility when currentStock is null or undefined
  {
    const htmlNoQty = renderToStaticMarkup(
      React.createElement(StockStatusBadge, {
        status: 'Active',
        currentStock: null
      })
    );
    assert(!htmlNoQty.includes('font-mono font-bold text-xs'), 'Test 6.1: When currentStock is null, quantity line is not rendered');
    assert(htmlNoQty.includes('Active'), 'Test 6.2: Status badge alone is rendered');
  }

  // Test 7: Auto calculation of status when only currentStock and reorderLevel are provided
  {
    const statusOut = calculateStockStatus(0, 10);
    assert(statusOut === 'Out of Stock', 'Test 7.1: calculateStockStatus returns Out of Stock for 0');

    const statusLimited = calculateStockStatus(5, 10);
    assert(statusLimited === 'Limited Stock', 'Test 7.2: calculateStockStatus returns Limited Stock when stock <= limit');

    const statusActive = calculateStockStatus(20, 10);
    assert(statusActive === 'Active', 'Test 7.3: calculateStockStatus returns Active when stock > limit');
  }

  console.log(`\nVerification Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
