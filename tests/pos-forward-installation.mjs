// Local Supabase clone only. No .env, hosted URL, secrets or cloud mutations.
// Requires the separately verified repaired baseline in pos_install_baseline.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const container = 'supabase_db_trading-docks-recovery-test';
const database = 'pos_install_rehearsal';
const baseline = 'pos_install_baseline';
const file = '20260921220051_pos_forward_installation.sql';
const dirArg = process.argv.indexOf('--evidence-dir');
assert.ok(dirArg >= 0 && process.argv[dirArg + 1], '--evidence-dir outside Git is required');
const evidence = resolve(process.argv[dirArg + 1]);
const rel = relative(process.cwd(), evidence);
assert.ok(rel.startsWith('..') || isAbsolute(rel), 'Private evidence must stay outside the repository');
mkdirSync(evidence, { recursive: true });
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000 });
const state = JSON.parse(docker('inspect', container))[0];
assert.match(state.Config.Image, /supabase\/postgres:17\./);
assert.equal(state.State.Running, true);
assert.deepEqual(state.NetworkSettings.Networks, {}, 'Recovery database must remain disconnected from Docker networks');
const sql = (db, query) => docker('exec', container, 'psql', '-U', 'postgres', '-d', db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query).trim();
const ident = x => '"' + x.replaceAll('"', '""') + '"';
const literal = x => "'" + x.replaceAll("'", "''") + "'";
const canon = x => Array.isArray(x) ? x.map(canon) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, k === 'acl' && typeof x[k] === 'string' ? x[k].slice(1, -1).split(',').sort() : canon(x[k])])) : x;
const catalogQuery = readFileSync('tests/pos-installation-catalog.sql', 'utf8');
const catalog = db => JSON.parse(sql(db, catalogQuery));
const key = x => typeof x === 'string' ? x : x.identity ?? [x.schema ?? x.schemaname, x.table ?? x.tablename, x.name ?? x.policyname].join('.');
const objects = JSON.parse(readFileSync('docs/pos-production-installation-objects.json', 'utf8'));
const checks = [];
function check(label, fn) { fn(); checks.push(label); console.log('PASS', label); }
const before = catalog(baseline);
assert.ok(before.tables.some(t => t.schema === 'inventory_private') === false); // Private writer contains functions, not stock tables.
assert.equal(before.tables.some(t => t.name === 'pos_workspace_settings'), false);
assert.ok(before.functions.some(f => f.identity === 'inventory_private.scope_inventory_write()'));
assert.equal(sql(baseline, 'select count(*) from supabase_migrations.schema_migrations'), '16');
// This exact disposable database is replaceable; the restored postgres database and baseline remain intact.
sql('template1', 'drop database if exists pos_install_rehearsal');
sql('template1', 'create database pos_install_rehearsal template pos_install_baseline');
function fingerprint(db) {
  const tables = before.tables.map(t => [t.schema, t.name]);
  tables.push(['auth', 'users'], ['auth', 'identities'], ['supabase_migrations', 'schema_migrations']);
  const queries = tables.map(([s, t]) => `select ${literal(s + '.' + t)} name,count(*)::text rows,coalesce(md5(string_agg(h,'' order by h)),'empty') hash from (select md5(to_jsonb(r)::text) h from ${ident(s)}.${ident(t)} r)x`);
  return JSON.parse(sql(db, `begin read only; select jsonb_object_agg(name,jsonb_build_object('rows',rows,'hash',hash)) from (${queries.join(' union all ')})x; commit;`));
}
const dataBefore = fingerprint(database);
const inventorySummary = JSON.parse(sql(database, `select jsonb_build_object('rows',(select count(*) from public.inventory_items),'units',(select sum(quantity) from public.inventory_items),'events',(select count(*) from public.inventory_events),'unscoped',(select count(*) from public.inventory_items where workspace_id is null))`));
assert.deepEqual(inventorySummary, { rows: 1515, units: 1788, events: 1550, unscoped: 0 });
const source = readFileSync('supabase/migrations/' + file, 'utf8');
const version = file.split('_')[0];
const install = source + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(version)},'pos_forward_installation',array[${literal(source)}]);\n`;
writeFileSync(resolve(evidence, 'installation-reviewed.sql'), install);
docker('cp', resolve(evidence, 'installation-reviewed.sql'), container + ':/tmp/pos-installation-reviewed.sql');
const started = new Date().toISOString();
const start = performance.now();
const installLog = docker('exec', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-1', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/pos-installation-reviewed.sql');
const runtimeMs = Math.round(performance.now() - start);
writeFileSync(resolve(evidence, 'installation-command.private.log'), installLog);
const after = catalog(database);
const dataAfter = fingerprint(database);
check('all original application/Auth table rows and full-row hashes unchanged', () => {
  for (const [name, value] of Object.entries(dataBefore)) if (!name.startsWith('supabase_migrations.')) assert.deepEqual(dataAfter[name], value, name);
});
check('only the new installation ledger entry added; exact SQL retained', () => {
  assert.equal(Number(dataAfter['supabase_migrations.schema_migrations'].rows), 17);
  assert.equal(sql(database, `select md5(statements[1]) from supabase_migrations.schema_migrations where version=${literal(version)}`), createHash('md5').update(source).digest('hex'));
  assert.equal(sql(database, `select count(*) from supabase_migrations.schema_migrations where version like '20260920%'`), '0');
});
check('all original tables, constraints, indexes, policies, triggers and enums preserved', () => {
  for (const section of ['tables', 'constraints', 'indexes', 'policies', 'triggers', 'enums', 'schemas']) {
    const map = new Map(after[section].map(x => [key(x), x]));
    for (const x of before[section]) assert.deepEqual(canon(map.get(key(x))), canon(x), section + ':' + key(x));
  }
});
check('all original functions and grants preserved except exact reviewed collector stock hook', () => {
  for (const f of before.functions) {
    const actual = after.functions.find(x => x.identity === f.identity);
    const expected = structuredClone(f);
    if (f.name === 'enforce_collector_inventory_mutation') expected.ddl = expected.ddl.replace(
      '  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then',
      "  if tg_op='UPDATE' and acting_user_id is not null and acting_user_id<>target_user_id and pos_private.permitted_stock_update(to_jsonb(old),to_jsonb(new)) then\n    new.updated_at:=now(); return new;\n  end if;\n  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then");
    assert.deepEqual(canon(actual), canon(expected), f.identity);
  }
});
check('exact missing object set installed, without unrelated staging features', () => {
  assert.equal(after.tables.length - before.tables.length, objects.tables.length);
  assert.equal(after.functions.length - before.functions.length, objects.functions.length);
  assert.equal(after.indexes.length - before.indexes.length, objects.indexes.length + objects.constraints.filter(c => ['p', 'u', 'x'].includes(c.type)).length);
  // PostgreSQL also registers the three deferred stock constraint triggers in pg_constraint.
  assert.equal(after.constraints.length - before.constraints.length, objects.constraints.length + objects.triggerBackedConstraints.length);
  assert.equal(after.triggers.length - before.triggers.length, objects.triggers.length);
  for (const f of objects.functions) assert.ok(after.functions.some(x => x.identity === f), f);
});
check('new sensitive tables all RLS-enabled with no browser table access', () => {
  for (const t of objects.tables) {
    const actual = after.tables.find(x => x.schema === t.schema && x.name === t.name);
    assert.ok(actual.rls, t.name);
  }
  const tableNames = objects.tables.map(t => literal(t.schema + '.' + t.name)).join(',');
  assert.equal(sql(database, `select count(*) from unnest(array[${tableNames}]) t cross join unnest(array['anon','authenticated']) r where has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`), '0');
});
check('private helpers and server-only Square entry point deny browser execution', () => {
  assert.equal(sql(database, "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pos_private' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))"), '0');
  assert.equal(sql(database, "select has_function_privilege('authenticated','public.pos_square_service(text,jsonb)','EXECUTE') or has_function_privilege('anon','public.pos_square_service(text,jsonb)','EXECUTE')"), 'f');
});
check('new constraints and indexes valid, writer triggers active, zero enabled workspaces', () => {
  const names = objects.tables.map(t => literal(t.schema + '.' + t.name) + '::regclass').join(',');
  assert.equal(sql(database, `select count(*) from pg_constraint where conrelid in(${names}) and not convalidated`), '0');
  assert.equal(sql(database, `select count(*) from pg_index where indrelid in(${names}) and not indisvalid`), '0');
  assert.equal(sql(database, "select count(*) from pg_trigger where tgname in('a_inventory_workspace_at_write','a_chaos_workspace_at_write') and tgenabled='O'"), '2');
  assert.equal(sql(database, 'select count(*) from public.pos_workspace_settings where enabled'), '0');
});
docker('cp', resolve('tests/pos-forward-installation.sql'), container + ':/tmp/pos-forward-pilot.sql');
const pilotLog = docker('exec', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/pos-forward-pilot.sql');
writeFileSync(resolve(evidence, 'installation-pilot-command.private.log'), pilotLog);
checks.push('cash pilot and owner/delegated/manager/cross-tenant/anonymous/credential security SQL passed; fixtures rolled back');
check('all original data and ledger unchanged after pilot rollback; rollout disabled', () => {
  assert.deepEqual(fingerprint(database), dataAfter);
  assert.equal(sql(database, 'select count(*) from public.pos_workspace_settings where enabled'), '0');
  assert.equal(sql(database, 'select count(*) from pos_private.square_credentials'), '0');
});
const report = { verdict: 'PASS', scope: 'Local isolated Supabase database only; production and staging read-only', started, finished: new Date().toISOString(), migration: file, sha256: createHash('sha256').update(source).digest('hex'), installRuntimeMs: runtimeMs, tablesAdded: objects.tables.length, functionsAdded: objects.functions.length, originalTablesFingerprinted: Object.keys(dataBefore).length - 1, inventory: inventorySummary, enabledWorkspaces: 0, checks };
writeFileSync('docs/pos-production-installation-rehearsal.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
