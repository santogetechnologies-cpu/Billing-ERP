import Database from 'better-sqlite3';

const db = new Database('local.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map((t: any) => t.name));

for (const t of ['products', 'purchase_orders', 'purchase_invoices', 'purchase_returns', 'customer_returns', 'stock_movements', 'stock_ledger', 'activity_logs']) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all();
    console.log(`\nTable ${t}:`, cols.map((c: any) => `${c.name} (${c.type})`).join(', '));
    const count = db.prepare(`SELECT count(*) as c FROM ${t}`).get() as any;
    console.log(`Count in ${t}:`, count.c);
    const sample = db.prepare(`SELECT * FROM ${t} LIMIT 2`).all();
    console.log(`Sample from ${t}:`, JSON.stringify(sample, null, 2));
  } catch (e: any) {
    console.log(`Table ${t} error:`, e.message);
  }
}

