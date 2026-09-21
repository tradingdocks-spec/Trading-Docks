import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const f = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(f.project, 'ukrcbmujzdyclrkghbvo');
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const client = createClient(`https://${f.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
assert.equal((await client.auth.signInWithPassword(f.users.owner)).error, null);
const inventory = await client.from('inventory_items').select('id', { count: 'exact', head: true }).eq('user_id', f.users.owner.id);
assert.equal(inventory.error, null); assert.ok(inventory.count >= 10000);
const results = [];
for (const query of ['performance card', 'Acceptance Set', f.prefix]) {
  const timings = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const r = await client.rpc('pos_command', { p_workspace_id: f.workspace, p_action: 'search', p_body: { siteId: f.setup.siteId, query } });
    assert.equal(r.error, null); assert.ok(r.data.length > 0);
    timings.push(Math.round(performance.now() - start));
  }
  const sorted = [...timings].sort((a,b) => a-b), p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  results.push({ query: query === f.prefix ? 'location' : query, timings, p95Ms: p95, ceilingMs: 2000, status: p95 < 2000 ? 'PASS' : 'FAIL' });
}
writeFileSync('docs/pos-phase7b-search-guard.json', JSON.stringify({ inventoryRows: inventory.count, scope: '20 real authenticated hosted round trips per broad search, including first call; generous p95 ceiling, not exact CI millisecond equality', results }, null, 2));
assert.ok(results.every(r => r.status === 'PASS'));
console.log('PASS hosted 10,000-item search p95 below 2 seconds for name, set and location');
