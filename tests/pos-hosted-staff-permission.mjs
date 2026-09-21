import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const f = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
if (f.project !== 'ukrcbmujzdyclrkghbvo') throw Error('Staging required');
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const make = () => createClient(`https://${f.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = make(), employee = make();
for (const [c, role] of [[owner, 'owner'], [employee, 'delegated']]) { const r = await c.auth.signInWithPassword(f.users[role]); if (r.error) throw Error('Fixture authentication failed'); }
const command = (c, action, body) => c.rpc('pos_command', { p_workspace_id: f.workspace, p_action: action, p_body: body });
const changed = await command(owner, 'staff_permissions', { key: randomUUID(), employeeId: f.users.delegated.id, permissions: { 'pos.sell': false } });
if (changed.error) throw Error(changed.error.message);
let result;
try {
  const r = await command(employee, 'search', { siteId: f.setup.siteId, query: 'P7-PERF-0', exact: true });
  result = { name: 'Hosted member-role employee with explicit pos.sell=false cannot use retained delegation', status: r.error?.message.includes('POS_FORBIDDEN') ? 'PASS' : 'FAIL', returnedRows: Array.isArray(r.data) ? r.data.length : null };
} finally {
  const restored = await command(owner, 'staff_permissions', { key: randomUUID(), employeeId: f.users.delegated.id, permissions: { 'pos.sell': true } });
  if (restored.error) throw Error('Fixture permission restore failed');
}
writeFileSync('docs/pos-phase7-staff-permission.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (result.status === 'FAIL') process.exitCode = 1;
