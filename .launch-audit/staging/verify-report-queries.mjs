import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInventoryDatabase, seedOrder, actor, orderId } from '../../tests/helpers/inventory-transaction-db.mjs';

// Isolated fixture validation only. Never connects to Supabase.
const db = await createInventoryDatabase();
const preflight = fs.readFileSync('supabase/verification/preflight_inventory_commit_boundaries.sql', 'utf8');
const report = fs.readFileSync('supabase/verification/report_historical_fulfillment.sql', 'utf8');
try {
  await db.exec(preflight);
  await seedOrder(db);
  await db.query("update marketplace_orders set fulfillment_stage='shipped',normalized_status='shipped' where id=$1", [orderId]);
  const results = await db.exec(report);
  const rows = results.flatMap(result => result.rows);
  assert(rows.some(row => row.findings?.includes('shipped_without_marker__deduction_unknown')));
  assert(rows.some(row => row.finding === 'shipped_order_has_no_ledger__deduction_unknown'));
  await db.query("update marketplace_orders set fulfillment_stage='packed',normalized_status='processing' where id=$1", [orderId]);
  await db.query("select commit_order_fulfillment($1,$2,'ship','{}')", [actor, [orderId]]);
  const healthy = await db.exec(report);
  assert.equal(healthy.flatMap(result => result.rows).length, 0);
  const quantity = await db.query("select quantity from inventory_items where user_id=$1 and id='item-a'", [actor]);
  assert.equal(quantity.rows[0].quantity, 3);
  // DDL reapplication check against the isolated fixture, not existing live data.
  await db.exec(fs.readFileSync('supabase/migrations/202609060001_inventory_commit_boundaries_proposal.sql', 'utf8'));
  await db.exec(preflight);
  assert.equal((await db.exec(report)).flatMap(result => result.rows).length, 0);
  console.log('PASS: read-only queries parse; ambiguous shipped order flagged; healthy fulfillment unflagged; quantity preserved; migration reapplication retains fixture evidence. LOCAL ONLY.');
} finally {
  await db.close();
}
