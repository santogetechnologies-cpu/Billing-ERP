import { supabase } from '../src/lib/supabase';

async function checkSales() {
  const { count: salesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true });
  const { count: saleItemsCount } = await supabase.from('sale_items').select('*', { count: 'exact', head: true });
  const { count: paymentsCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
  const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: productBarcodesCount } = await supabase.from('product_barcodes').select('*', { count: 'exact', head: true });
  const { count: stockTxCount } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true });
  const { count: stockTransfersCount } = await supabase.from('stock_transfers').select('*', { count: 'exact', head: true });
  const { count: stockTransferItemsCount } = await supabase.from('stock_transfer_items').select('*', { count: 'exact', head: true });
  const { count: notifCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
  const { count: auditCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });

  console.log({
    sales: salesCount,
    sale_items: saleItemsCount,
    payments: paymentsCount,
    products: productsCount,
    product_barcodes: productBarcodesCount,
    stock_transactions: stockTxCount,
    stock_transfers: stockTransfersCount,
    stock_transfer_items: stockTransferItemsCount,
    notifications: notifCount,
    audit_logs: auditCount
  });
}

checkSales();
