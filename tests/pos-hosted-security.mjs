import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const fixture = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(fixture.project, 'ukrcbmujzdyclrkghbvo');
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const make = () => createClient(`https://${fixture.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
const other = make(), anonymous = make();
const login = await other.auth.signInWithPassword(fixture.users.other); assert.equal(login.error, null);
const results = [];
const endpoints = ['pos_command', 'pos_payment_command', 'pos_payment_refund_command', 'pos_terminal_devices', 'pos_square_settings'];
for (const [role, client] of [['other organization', other], ['anonymous', anonymous]]) {
  for (const name of endpoints) {
    const r = await client.rpc(name, { p_workspace_id: fixture.workspace, p_action: name === 'pos_command' ? 'bootstrap' : 'get', p_body: { id: fixture.setup.registerId, siteId: fixture.setup.siteId } });
    assert.ok(r.error, `${role}: ${name}`);
    results.push({ name: `${role}: ${name}`, status: 'PASS', sqlstate: r.error.code });
  }
  const labels = await client.rpc('label_targets', { p_workspace_id: fixture.workspace });
  assert.ok(labels.error || (Array.isArray(labels.data) && labels.data.length === 0));
  results.push({ name: `${role}: label targets`, status: 'PASS' });
  const service = await client.rpc('pos_square_service', { p_action: 'credentials', p_body: {} });
  assert.ok(service.error);
  results.push({ name: `${role}: service-only Square RPC`, status: 'PASS' });
}
const templates = await other.from('label_templates').select('id').eq('workspace_id', fixture.workspace);
assert.ok(templates.error || templates.data.length === 0);
results.push({ name: 'Other organization: label template RLS', status: 'PASS' });
writeFileSync('docs/pos-phase7-hosted-security.json', JSON.stringify({ at: new Date().toISOString(), project: fixture.project, results }, null, 2));
console.log(`PASS ${results.length} real JWT/anonymous REST isolation checks`);
