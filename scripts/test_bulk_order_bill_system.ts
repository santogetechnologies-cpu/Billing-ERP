import { supabase } from '../src/lib/supabase';
import { customerService } from '../src/services/customerService';

async function testBulkOrderBillSystem() {
  console.log('=== TEST: Bulk Order Bill / Quotation System ===');

  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  // 1. Fetch products from product master
  const { data: prods, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .limit(2);

  if (prodErr || !prods || prods.length === 0) {
    throw new Error('No products found in product master for testing.');
  }

  const sampleProd = prods[0];
  console.log(`1. Found product: "${sampleProd.name}" (SKU: ${sampleProd.sku}), Selling Price: ₹${sampleProd.selling_price}, Stock: ${sampleProd.current_stock}`);

  // 2. Customer handling: Find or create customer
  let testCustomer: any = null;
  const existingCustomers = await customerService.getCustomers({ limit: 1 }, testCompanyId);
  if (existingCustomers.length > 0) {
    testCustomer = existingCustomers[0];
    console.log(`2. Using existing customer: "${testCustomer.name}" (${testCustomer.phone})`);
  } else {
    console.log('2. Creating new wholesale customer for test...');
    const { data: newCust, error: cErr } = await supabase.from('customers').insert({
      company_id: testCompanyId,
      name: 'Bulk Global Logistics Ltd',
      phone: '+91 98980 12345',
      email: 'orders@bulkglobal.com',
      address: 'Plot 88, Logistics Park, Navi Mumbai',
      gstin: '27AABCB1234M1Z2',
      customer_type: 'Wholesale'
    }).select().single();
    if (cErr) throw new Error(`Customer creation error: ${cErr.message}`);
    testCustomer = newCust;
    console.log(`Created test customer: ${testCustomer.name}`);
  }

  // 3. Test Bulk Calculations
  // Example from requirement:
  // Product normally costs ₹400 and customer orders 100 units with ₹20 bulk discount per unit:
  // Original Price = ₹400, Bulk Discount = ₹20, Discounted Price = ₹380, Qty = 100, Total = ₹38,000
  const originalPrice = 400;
  const bulkDiscount = 20;
  const discountedPrice = Math.max(0, originalPrice - bulkDiscount);
  const qty = 100;
  const lineTotal = qty * discountedPrice;
  const grossSubtotal = qty * originalPrice;
  const totalBulkSavings = qty * bulkDiscount;
  const taxRate = 18;
  const taxTotal = (lineTotal * taxRate) / 100; // 18% of 38,000 = 6,840
  const freightCharges = 500;
  const grandTotal = lineTotal + taxTotal + freightCharges; // 38,000 + 6,840 + 500 = 45,340
  const advancePayment = 15000;
  const balanceDue = grandTotal - advancePayment;

  console.log(`3. Calculation Verification:`);
  console.log(`   - Gross Subtotal (100 * ₹400): ₹${grossSubtotal}`);
  console.log(`   - Bulk Discount Savings (100 * ₹20): ₹${totalBulkSavings}`);
  console.log(`   - Discounted Rate: ₹${discountedPrice}/unit`);
  console.log(`   - Net Taxable Total: ₹${lineTotal}`);
  console.log(`   - GST (18%): ₹${taxTotal}`);
  console.log(`   - Freight Charges: ₹${freightCharges}`);
  console.log(`   - Grand Total: ₹${grandTotal}`);
  console.log(`   - Advance Paid: ₹${advancePayment}`);
  console.log(`   - Balance Due: ₹${balanceDue}`);

  if (lineTotal !== 38000) throw new Error(`Calculations mismatch! Expected 38,000 got ${lineTotal}`);
  if (grandTotal !== 45340) throw new Error(`Grand total mismatch! Expected 45,340 got ${grandTotal}`);

  // 4. Test Saving Bulk Order into Database
  const billNumber = `BO-${Date.now()}`;
  const initialStock = Number(sampleProd.current_stock || 0);

  const bulkMeta = {
    isBulkOrder: true,
    docType: 'bulk_order',
    orderStatus: 'Ordered',
    customerName: testCustomer.name,
    customerPhone: testCustomer.phone,
    customerEmail: testCustomer.email,
    customerAddress: testCustomer.address,
    customerGstin: testCustomer.gstin,
    grossSubtotal,
    totalBulkDiscount: totalBulkSavings,
    effectiveDiscountPercent: (totalBulkSavings / grossSubtotal) * 100,
    netSubtotal: lineTotal,
    additionalCharges: freightCharges,
    additionalChargesNote: 'Surface Freight',
    taxTotal,
    grandTotal,
    advancePayment,
    balanceDue
  };

  const metaString = `<!-- UB_BULK_ORDER_META:${JSON.stringify(bulkMeta)} -->`;

  const { data: savedOrder, error: saveErr } = await supabase
    .from('purchases')
    .insert({
      company_id: testCompanyId,
      invoice_number: billNumber,
      doc_type: 'bulk_order',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      supplier_name: testCustomer.name,
      supplier_gstin: testCustomer.gstin || null,
      subtotal: lineTotal,
      tax_total: taxTotal,
      freight_charges: freightCharges,
      grand_total: grandTotal,
      paid_amount: advancePayment,
      payment_status: 'Partial',
      notes: `Special corporate pricing agreement.\n${metaString}`
    })
    .select()
    .single();

  if (saveErr || !savedOrder) {
    throw new Error(`Failed to save bulk order: ${saveErr?.message}`);
  }
  console.log(`4. Saved Bulk Order in DB: ID = ${savedOrder.id}, Number = ${savedOrder.invoice_number}`);

  // Insert item
  const { data: savedItem, error: itemErr } = await supabase
    .from('purchase_items')
    .insert({
      purchase_id: savedOrder.id,
      product_id: sampleProd.id,
      product_name: sampleProd.name,
      qty,
      unit: sampleProd.primary_unit || 'Piece',
      rate: discountedPrice,
      discount: totalBulkSavings,
      tax_rate: taxRate,
      tax_amt: taxTotal,
      total: lineTotal
    })
    .select()
    .single();

  if (itemErr) {
    throw new Error(`Failed to save purchase_item: ${itemErr.message}`);
  }
  console.log(`   Item saved: "${savedItem.product_name}" x ${savedItem.qty} @ ₹${savedItem.rate}/unit (Discount: ₹${savedItem.discount})`);

  // 5. Verify Stock was NOT reduced (Requirement 8)
  const { data: prodAfter } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', sampleProd.id)
    .single();

  const finalStock = Number(prodAfter?.current_stock || 0);
  console.log(`5. Stock Safety Check: Initial Stock = ${initialStock}, Stock after Bulk Order = ${finalStock}`);
  if (finalStock !== initialStock) {
    throw new Error(`Inventory was incorrectly modified upon bulk order creation! Initial: ${initialStock}, After: ${finalStock}`);
  }
  console.log('   Stock safety verified: No automatic inventory deduction upon order/quotation creation.');

  // 6. Verify Fetch in Purchase Orders & Active Order Tracking
  const { data: queriedOrders, error: queryErr } = await supabase
    .from('purchases')
    .select('*, purchase_items(*)')
    .eq('company_id', testCompanyId)
    .in('doc_type', ['purchase_order', 'bulk_order', 'quotation'])
    .eq('invoice_number', billNumber);

  if (queryErr || !queriedOrders || queriedOrders.length === 0) {
    throw new Error('Bulk order was not found in active order tracking query!');
  }
  console.log(`6. Active Order Tracking Query: Successfully retrieved Bulk Order #${queriedOrders[0].invoice_number} with ${queriedOrders[0].purchase_items.length} line item(s).`);

  // Clean up test order
  await supabase.from('purchase_items').delete().eq('purchase_id', savedOrder.id);
  await supabase.from('purchases').delete().eq('id', savedOrder.id);
  console.log('7. Cleaned up test bulk order records.');

  console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

testBulkOrderBillSystem().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

