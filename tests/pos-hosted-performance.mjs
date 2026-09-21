import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(fixture.project, 'ukrcbmujzdyclrkghbvo');
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const c = createClient(`https://${fixture.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = async p => { const r = await p; if (r.error) throw Error(r.error.message); return r.data; };
await checked(c.auth.signInWithPassword(fixture.users.owner));
const command = (action, body) => checked(c.rpc('pos_command', { p_workspace_id: fixture.workspace, p_action: action, p_body: body }));
const prefix = `${fixture.prefix}-perf`;
const inventoryCount = process.argv.includes('--large') ? 10000 : 1000;
const rows = Array.from({ length: inventoryCount }, (_, i) => ({ id: `${prefix}-${i}`, user_id: fixture.users.owner.id, workspace_id: fixture.workspace, location_id: fixture.location, card_name: `Acceptance performance card ${i}`, sku: `P7-PERF-${i}`, quantity: 10, asking_price: 1, set_code: 'Acceptance Set' }));
for (let i = 0; i < rows.length; i += 100) await checked(c.from('inventory_items').upsert(rows.slice(i, i + 100)));
const results = [];
const reg = await command('configure_register', { key: randomUUID(), siteId: fixture.setup.siteId, name: `Reservation ${Date.now()}` });
const session = await command('open', { key: randomUUID(), registerId: reg.id, openingMinor: 0 });
const reservedId = `${prefix}-reserved-${Date.now()}`;
await checked(c.from('inventory_items').insert({ ...rows[0], id: reservedId, quantity: 1, sku: reservedId }));
const batch = await checked(c.from('selling_listing_batches').insert({ user_id: fixture.users.owner.id, workspace_id: fixture.workspace, name: prefix }).select().single());
const candidate = await checked(c.from('selling_listing_candidates').insert({ user_id: fixture.users.owner.id, workspace_id: fixture.workspace, listing_batch_id: batch.id, inventory_item_id: reservedId, quantity: 1 }).select().single());
const race = await Promise.allSettled([
  checked(c.rpc('reserve_selling_inventory', { p_workspace_id: fixture.workspace, p_candidate_id: candidate.id, p_quantity: 1, p_idempotency_key: randomUUID() })),
  command('checkout', { key: randomUUID(), siteId: fixture.setup.siteId, sessionId: session.id, expectedMinor: 109, cashMinor: 109, lines: [{ itemId: reservedId, quantity: 1 }] }),
]);
assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
const loserError = race.find(r => r.status === 'rejected').reason.message;
assert.match(loserError, /POS_STOCK_UNAVAILABLE|available|insufficient/i);
const inventory = await checked(c.from('inventory_items').select('quantity').eq('user_id', fixture.users.owner.id).eq('id', reservedId).single());
const allocations = await checked(c.from('selling_inventory_allocations').select('quantity').eq('inventory_item_id', reservedId).eq('user_id', fixture.users.owner.id).in('status', ['ALLOCATED', 'RESERVED']));
assert.ok(inventory.quantity >= allocations.reduce((n, a) => n + a.quantity, 0));
results.push({ name: 'Hosted marketplace reservation versus checkout race', status: 'PASS', winner: race[0].status === 'fulfilled' ? 'reservation' : 'checkout', loserError });
await command('close', { key: randomUUID(), registerId: reg.id, sessionId: session.id, countedMinor: race[1].status === 'fulfilled' ? 109 : 0 });
for (const [name, body] of [['name', { query: 'performance card' }], ['SKU', { query: `P7-PERF-${inventoryCount - 1}`, exact: true }], ['set', { query: 'Acceptance Set' }], ['location', { query: fixture.prefix }]]) {
  const start = performance.now();
  try {
    const data = await command('search', { siteId: fixture.setup.siteId, ...body });
    assert.ok(data.length > 0);
    results.push({ name: `${inventoryCount} inventory ${name} search`, status: 'PASS', ms: Math.round(performance.now() - start), matches: data.length });
  } catch (error) { results.push({ name: `${inventoryCount} inventory ${name} search`, status: 'FAIL', ms: Math.round(performance.now() - start), error: error.message }); process.exitCode = 1; }
}
const cartRegister = await command('configure_register', { key: randomUUID(), siteId: fixture.setup.siteId, name: `Large carts ${Date.now()}` });
const cartSession = await command('open', { key: randomUUID(), registerId: cartRegister.id, openingMinor: 0 });
let cartCash = 0;
for (const count of [25, 100, 250, 500]) {
  const start = performance.now();
  try {
    const result = await command('quote', { siteId: fixture.setup.siteId, lines: rows.slice(0, count).map(row => ({ itemId: row.id, ownerId: fixture.users.owner.id, quantity: 1 })) });
    results.push({ name: `${count} line quote`, ms: Math.round(performance.now() - start), status: 'PASS', totalMinor: result.totalMinor });
    const checkoutStart = performance.now();
    const sale = await command('checkout', { key: randomUUID(), siteId: fixture.setup.siteId, sessionId: cartSession.id, expectedMinor: count * 109, cashMinor: count * 109, lines: rows.slice(0, count).map(row => ({ itemId: row.id, ownerId: fixture.users.owner.id, quantity: 1 })) });
    results.push({ name: `${count} line checkout`, ms: Math.round(performance.now() - checkoutStart), status: 'PASS' });
    cartCash += count * 109;
    const receiptStart = performance.now();
    const detail = await command('receipt', { saleId: sale.saleId });
    assert.equal(detail.receipt.lines.length, count);
    results.push({ name: `${count} line canonical receipt`, ms: Math.round(performance.now() - receiptStart), status: 'PASS' });
  } catch (error) {
    const unsupported = false;
    results.push({ name: `${count} line cart`, ms: Math.round(performance.now() - start), status: unsupported ? 'UNSUPPORTED' : 'FAIL', error: error.message });
    if (!unsupported) process.exitCode = 1;
  }
}
await command('close', { key: randomUUID(), registerId: cartRegister.id, sessionId: cartSession.id, countedMinor: cartCash });
writeFileSync(`docs/pos-phase7b-performance${inventoryCount > 1000 ? '-large' : ''}.json`, JSON.stringify({ project: fixture.project, at: new Date().toISOString(), scope: `Hosted RPC round-trip, ${inventoryCount} synthetic inventory rows; not UI timing or certification for every store size`, results }, null, 2));
console.log(JSON.stringify(results, null, 2));
