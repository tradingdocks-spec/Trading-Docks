// Explicit isolated staging only. Never loads application dotenv files.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const project = 'ukrcbmujzdyclrkghbvo';
const url = `https://${project}.supabase.co`;
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.find(k => k.name === 'service_role').api_key, options);
const anonKey = keys.find(k => k.name === 'anon').api_key;
const manifestPath = '.local-fixtures/phase7-auth-fixture.json';
const fixture = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { project, workspace: randomUUID(), otherWorkspace: randomUUID(), users: {}, prefix: `p7-${Date.now()}` };
assert.equal(fixture.project, project);
const save = () => writeFileSync(manifestPath, JSON.stringify(fixture, null, 2));
const checked = async promise => { const r = await promise; if (r.error) throw new Error(r.error.message); return r.data; };
const clients = {};
for (const role of ['owner', 'admin', 'manager', 'cashier', 'delegated', 'nondelegated', 'other']) {
  if (!fixture.users[role]) {
    const password = randomBytes(32).toString('hex');
    const email = `${fixture.prefix}-${role}@example.invalid`;
    const { user } = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true }));
    fixture.users[role] = { id: user.id, email, password }; save();
  }
  const client = createClient(url, anonKey, options);
  await checked(client.auth.signInWithPassword(fixture.users[role]));
  clients[role] = client;
}
console.log('PASS seven independent hosted Auth password sessions');
const owner = fixture.users.owner.id;
const workspace = fixture.workspace;
if (!fixture.seeded) {
  await checked(admin.from('workspaces').upsert([{ id: workspace, name: fixture.prefix, owner_id: owner }, { id: fixture.otherWorkspace, name: `${fixture.prefix}-other`, owner_id: fixture.users.other.id }]));
  for (const [role, user] of Object.entries(fixture.users)) {
    const w = role === 'other' ? fixture.otherWorkspace : workspace;
    await checked(admin.from('profiles').upsert({ id: user.id }));
    await checked(admin.from('user_preferences').upsert({ user_id: user.id, active_workspace_id: w, preferences: { onboarding_completed: true } }));
    await checked(admin.from('workspace_members').upsert({ workspace_id: w, user_id: user.id, role: ['owner', 'admin', 'manager'].includes(role) ? role : role === 'other' ? 'owner' : 'member' }));
    if (['owner', 'admin', 'manager', 'other'].includes(role)) await checked(admin.from('admin_membership_overrides').upsert({ user_id: user.id, plan_id: 'business', granted_by: owner }));
    if (['cashier', 'delegated', 'nondelegated'].includes(role)) await checked(admin.from('workspace_employees').insert({ workspace_id: w, linked_user_id: user.id, full_name: `Acceptance ${role}`, created_by: owner, employment_status: 'active', permissions: { 'pos.sell': true } }));
  }
  await checked(admin.from('pos_workspace_settings').insert({ workspace_id: workspace, enabled: true }));
  fixture.seeded = true; save();
}
const command = (role, action, body = {}, w = workspace) => checked(clients[role].rpc('pos_command', { p_workspace_id: w, p_action: action, p_body: body }));
if (!fixture.setup) {
  fixture.location = `${fixture.prefix}-case`;
  await checked(clients.owner.from('inventory_locations').insert({ id: fixture.location, user_id: owner, name: fixture.prefix }));
  fixture.setup = await command('owner', 'setup', { name: fixture.prefix, registerName: 'Acceptance front', locationId: fixture.location, taxBps: 850 }); save();
}
const results = [];
async function check(name, fn) {
  const start = performance.now();
  try { await fn(); results.push({ name, status: 'PASS', ms: Math.round(performance.now() - start) }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
  writeFileSync('docs/pos-phase7-hosted-results.json', JSON.stringify({ project, timestamp: new Date().toISOString(), results }, null, 2));
}
const siteId = fixture.setup.siteId;
// Restore only this fixture's grants before repeatable negative tests.
for (const role of ['admin', 'manager', 'nondelegated']) {
  const grants = await checked(admin.from('pos_inventory_delegations').select('id').eq('workspace_id', workspace).eq('employee_id', fixture.users[role].id).is('revoked_at', null));
  for (const grant of grants) await command('owner', 'revoke', { key: randomUUID(), id: grant.id });
}
await check('Owner reaches hosted POS', async () => assert.ok((await command('owner', 'bootstrap')).sites.length));
for (const role of ['admin', 'manager', 'nondelegated']) await check(`${role} cannot access owner stock without delegation`, async () => {
  await assert.rejects(command(role, 'search', { siteId, query: fixture.prefix }), /POS_FORBIDDEN/);
});
await check('Other organization RPC access denied', async () => {
  for (const action of ['bootstrap', 'search', 'history', 'access', 'sessions']) await assert.rejects(command('other', action, { siteId }), /POS_FORBIDDEN/);
});
await check('Anonymous RPC execution denied', async () => {
  const anon = createClient(url, anonKey, options);
  const response = await anon.rpc('pos_command', { p_workspace_id: workspace, p_action: 'bootstrap', p_body: {} });
  assert.ok(response.error);
});
await check('Direct financial table reads denied to every browser identity', async () => {
  for (const client of Object.values(clients)) for (const table of ['pos_sales', 'pos_register_sessions', 'pos_inventory_delegations', 'pos_payment_attempts']) {
    const response = await client.from(table).select('*').limit(1); assert.ok(response.error, table);
  }
});
const run = `run-${Date.now()}`;
const itemId = `${fixture.prefix}-${run}`;
await checked(clients.owner.from('inventory_items').insert({ id: itemId, user_id: owner, workspace_id: workspace, location_id: fixture.location, card_name: `Acceptance ${run}`, sku: run, quantity: 1000, asking_price: 1 }));
const registers = await checked(admin.from('pos_registers').insert(Array.from({ length: 5 }, (_, i) => ({ workspace_id: workspace, site_id: siteId, name: `${run}-${i}` }))).select());
const sessions = [];
for (const register of registers) sessions.push(await command('owner', 'open', { registerId: register.id, key: randomUUID(), openingMinor: 20000 }));
const sell = (i = 0, item = itemId) => ({ key: randomUUID(), siteId, sessionId: sessions[i].id, expectedMinor: 109, cashMinor: 200, lines: [{ ownerId: owner, itemId: item, quantity: 1 }] });
await check('Delegated employee sells owner stock with real JWT attribution', async () => {
  await command('owner', 'grant', { key: randomUUID(), siteId, employeeId: fixture.users.delegated.id, capabilities: ['sell'] });
  assert.equal((await command('delegated', 'search', { siteId, query: run, exact: true }))[0].ownerId, owner);
  const sale = await command('delegated', 'checkout', sell());
  assert.equal(sale.receipt.actorId, fixture.users.delegated.id);
  assert.equal(sale.receipt.lines[0].ownerId, owner);
});
await check('Hosted last-item race commits exactly one sale', async () => {
  const id = `${itemId}-last`;
  await checked(clients.owner.from('inventory_items').insert({ id, user_id: owner, workspace_id: workspace, location_id: fixture.location, card_name: 'Last copy', sku: `${run}-last`, quantity: 1, asking_price: 1 }));
  const race = await Promise.allSettled([command('owner', 'checkout', sell(0, id)), command('owner', 'checkout', sell(1, id))]);
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(race.find(r => r.status === 'rejected').reason.message, /POS_STOCK_UNAVAILABLE/);
  assert.equal((await checked(clients.owner.from('inventory_items').select('quantity').eq('user_id', owner).eq('id', id).single())).quantity, 0);
});
await check('100 cash transactions across five concurrent registers reconcile independently', async () => {
  const sales = [];
  for (let batch = 0; batch < 20; batch++) {
    const group = await Promise.all(sessions.map((_, i) => command('owner', 'checkout', sell(i))));
    sales.push(...group);
  }
  assert.equal(new Set(sales.map(s => s.saleId)).size, 100);
  assert.equal(sales.reduce((n, s) => n + s.receipt.totalMinor, 0), 10900);
  const rows = await checked(admin.from('pos_sales').select('subtotal_minor,discount_minor,tax_minor,total_minor,receipt').in('id', sales.map(s => s.saleId)));
  assert.equal(rows.length, 100);
  assert.equal(rows.reduce((n, s) => n + Number(s.subtotal_minor), 0), 10000);
  assert.equal(rows.reduce((n, s) => n + Number(s.discount_minor), 0), 0);
  assert.equal(rows.reduce((n, s) => n + Number(s.tax_minor), 0), 900);
  assert.equal(rows.reduce((n, s) => n + Number(s.total_minor), 0), 10900);
  assert.ok(rows.every(s => s.receipt));
  const detail = await command('owner', 'receipt', { saleId: sales[0].saleId });
  const refund = { key: randomUUID(), saleId: sales[0].saleId, sessionId: sessions[0].id, expectedMinor: 109, reason: 'Acceptance return', lines: [{ saleItemId: detail.items[0].id, quantity: 1, returnInventory: true }] };
  const pair = await Promise.all([command('owner', 'refund', refund), command('owner', 'refund', refund)]);
  assert.equal(pair[0].id, pair[1].id);
  const stock = await checked(clients.owner.from('inventory_items').select('quantity').eq('user_id', owner).eq('id', itemId).single());
  assert.equal(stock.quantity, 900);
});
await check('Hosted paid-out retry emits one cash movement', async () => {
  const body = { key: randomUUID(), registerId: registers[0].id, sessionId: sessions[0].id, kind: 'PAID_OUT', amountMinor: 1500, reasonType: 'PETTY_CASH', reason: 'Acceptance courier' };
  const pair = await Promise.all([command('owner', 'cash_event', body), command('owner', 'cash_event', body)]);
  assert.equal(pair[0].id, pair[1].id);
});
await check('Delegation revocation invalidates an already quoted cart', async () => {
  const grant = await command('owner', 'grant', { key: randomUUID(), siteId, employeeId: fixture.users.cashier.id, capabilities: ['sell'] });
  const intent = sell();
  await command('cashier', 'quote', intent);
  await command('owner', 'revoke', { key: randomUUID(), id: grant.id });
  await assert.rejects(command('cashier', 'checkout', intent), /POS_FORBIDDEN/);
});
await check('Separate authenticated manager approves cashier discount', async () => {
  await command('owner', 'grant', { key: randomUUID(), siteId, employeeId: fixture.users.cashier.id, capabilities: ['sell'] });
  // The approving manager needs explicit stock access as well.
  const existing = await checked(admin.from('workspace_employees').select('id').eq('workspace_id', workspace).eq('linked_user_id', fixture.users.manager.id));
  if (!existing.length) await checked(admin.from('workspace_employees').insert({ workspace_id: workspace, linked_user_id: fixture.users.manager.id, full_name: 'Acceptance manager', created_by: owner, employment_status: 'active' }));
  await command('owner', 'grant', { key: randomUUID(), siteId, employeeId: fixture.users.manager.id, capabilities: ['sell'] });
  const intent = { ...sell(), expectedMinor: 54, discountReason: 'Acceptance markdown', lines: [{ ownerId: owner, itemId, quantity: 1, discountBps: 5000 }] };
  await assert.rejects(command('cashier', 'checkout', intent), /POS_APPROVAL_REQUIRED/);
  const approval = await command('cashier', 'request_approval', { key: randomUUID(), siteId, operation: 'checkout', intent, reason: 'Acceptance markdown' });
  await assert.rejects(command('cashier', 'approve', { key: randomUUID(), siteId, id: approval.id }), /POS_FORBIDDEN/);
  await command('manager', 'approve', { key: randomUUID(), siteId, id: approval.id });
  const sale = await command('cashier', 'checkout', { ...intent, approvalId: approval.id });
  assert.equal(sale.receipt.totalMinor, 54);
  const stored = await checked(admin.from('pos_approval_requests').select('*').eq('id', approval.id).single());
  assert.equal(stored.requested_by, fixture.users.cashier.id);
  const decision = await checked(admin.from('pos_approval_decisions').select('approved_by').eq('request_id', approval.id).single());
  assert.equal(decision.approved_by, fixture.users.manager.id);
});
await check('Five drawers close against independent cash ledger sums', async () => {
  for (let i = 0; i < sessions.length; i++) {
    const events = await checked(admin.from('pos_cash_events').select('amount_minor').eq('session_id', sessions[i].id));
    const expected = events.reduce((n, e) => n + Number(e.amount_minor), 0);
    const closed = await command('owner', 'close', { key: randomUUID(), registerId: registers[i].id, sessionId: sessions[i].id, countedMinor: expected });
    assert.equal(Number(closed.expected_minor), expected);
    assert.equal(Number(closed.variance_minor), 0);
  }
});
await check('Hosted paid-in and cash-drop lifecycle reconciles', async () => {
  const register = await command('owner', 'configure_register', { key: randomUUID(), siteId, name: `${run}-cash-lifecycle` });
  const session = await command('owner', 'open', { key: randomUUID(), registerId: register.id, openingMinor: 20000 });
  for (const [kind, amountMinor, reasonType] of [['PAID_IN', 5000, 'CHANGE_FLOAT'], ['CASH_DROP', 3000, 'SAFE'], ['PAID_OUT', 1500, 'PETTY_CASH']]) {
    await command('owner', 'cash_event', { key: randomUUID(), registerId: register.id, sessionId: session.id, kind, amountMinor, reasonType, reason: 'Hosted acceptance' });
  }
  const closed = await command('owner', 'close', { key: randomUUID(), registerId: register.id, sessionId: session.id, countedMinor: 20500 });
  assert.equal(Number(closed.expected_minor), 20500);
  assert.equal(Number(closed.variance_minor), 0);
});
await check('Hosted checkout versus close serializes without orphan cash or stock', async () => {
  const register = await command('owner', 'configure_register', { key: randomUUID(), siteId, name: `${run}-sale-close` });
  const session = await command('owner', 'open', { key: randomUUID(), registerId: register.id, openingMinor: 0 });
  const pair = await Promise.allSettled([
    command('owner', 'checkout', { ...sell(), sessionId: session.id }),
    command('owner', 'close', { key: randomUUID(), registerId: register.id, sessionId: session.id, countedMinor: 0, reason: 'Concurrent acceptance' }),
  ]);
  assert.equal(pair[1].status, 'fulfilled');
  if (pair[0].status === 'rejected') assert.match(pair[0].reason.message, /POS_SESSION_CLOSED/);
  const events = await checked(admin.from('pos_cash_events').select('amount_minor').eq('session_id', session.id));
  const total = events.reduce((n, e) => n + Number(e.amount_minor), 0);
  assert.equal(total, pair[0].status === 'fulfilled' ? 109 : 0);
  assert.equal(Number(pair[1].value.expected_minor), total);
  const sales = await checked(admin.from('pos_sales').select('id').eq('session_id', session.id));
  assert.equal(sales.length, pair[0].status === 'fulfilled' ? 1 : 0);
});
await check('Hosted competing drawer closes create one immutable close event', async () => {
  const register = await command('owner', 'configure_register', { key: randomUUID(), siteId, name: `${run}-close-close` });
  const session = await command('owner', 'open', { key: randomUUID(), registerId: register.id, openingMinor: 100 });
  const body = { registerId: register.id, sessionId: session.id, countedMinor: 100 };
  const pair = await Promise.allSettled([command('owner', 'close', { ...body, key: randomUUID() }), command('owner', 'close', { ...body, key: randomUUID() })]);
  assert.ok(pair.some(r => r.status === 'fulfilled'));
  for (const result of pair) if (result.status === 'rejected') assert.match(result.reason.message, /POS_SESSION_CLOSED/);
  const events = await checked(admin.from('pos_cash_events').select('kind').eq('session_id', session.id));
  assert.equal(events.filter(e => e.kind === 'REGISTER_CLOSE').length, 1);
});
await check('Hosted provider budget is atomic and fails closed after twelve OAuth calls', async () => {
  const responses = await Promise.all(Array.from({ length: 15 }, () => checked(clients.owner.rpc('pos_provider_request_budget', { p_workspace_id: workspace, p_bucket: 'oauth' }))));
  assert.equal(responses.filter(Boolean).length, 12);
  assert.equal(await checked(clients.owner.rpc('pos_provider_request_budget', { p_workspace_id: workspace, p_bucket: 'oauth' })), false);
  await assert.rejects(checked(clients.other.rpc('pos_provider_request_budget', { p_workspace_id: workspace, p_bucket: 'oauth' })), /POS_FORBIDDEN/);
});
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
