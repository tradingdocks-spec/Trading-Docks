// Diagnostic reproducer of UNSAFE existing behavior, not a passing release gate.
// Loopback disposable PostgreSQL, synthetic identities only; no app environment.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.env.TD_TEST_RUNTIME ?? '.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js')).href);
const db = new EmbeddedPostgres({ databaseDir: mkdtempSync(join(tmpdir(), 'td-phase1j-evidence-')), user: 'postgres', password: 'local-test-only', port: 55449, persistent: true, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog() {}, onError() {} });
const sql = (p) => readFileSync(p, 'utf8');
let admin, client, second;
const owner = randomUUID(), workspace = randomUUID();
const evidence = [];
try {
  await db.initialise(); await db.start();
  admin = db.getPgClient('postgres', '127.0.0.1'); await admin.connect();
  await admin.query(sql('tests/fixtures/pos-prerequisites.sql'));
  await admin.query(sql('supabase/migrations/202607280004_inventory_persistence.sql'));
  await admin.query(`alter table inventory_items add workspace_id uuid, add game_id text, add product_type text, add provider_category_id text, add provider_product_id text, add provider_sku_id text, add tcgplayer_product_id bigint, add tcgplayer_sku_id bigint, add variant text, add language text;`);
  await admin.query(sql('supabase/migrations/202608120002_inventory_event_ledger.sql'));
  // Apply the exact later writer transformation for this RPC, not a hand-written
  // substitute. Full Chaos/POS rehearsal is deliberately not claimed here.
  const writer = sql('supabase/migrations/20260921203415_inventory_authoritative_workspace_writer.sql');
  const start = writer.indexOf(" if to_regprocedure('public.create_inventory_item_with_event");
  const end = writer.indexOf(" if to_regprocedure('public.move_inventory_lot_quantity", start);
  assert.ok(start > 0 && end > start);
  await admin.query(`do $$ declare definition text; begin ${writer.slice(start, end)} end $$;`);
  const tenancy = sql('supabase/migrations/20260924013600_cloud_active_workspace_authority.sql');
  await admin.query(tenancy.slice(tenancy.indexOf('create function public.can_current_user_access_workspace'), tenancy.indexOf('-- Refuse incomplete')));
  await admin.query('create schema inventory_private');
  await admin.query(tenancy.slice(tenancy.indexOf('create function inventory_private.require_active_item'), tenancy.indexOf('do $rpc_guards$')));
  const guardStart = tenancy.indexOf(' for proc in select');
  const guardEnd = tenancy.indexOf(' foreach name in array', guardStart);
  await admin.query(`do $$ declare proc regprocedure; definition text; begin ${tenancy.slice(guardStart, guardEnd)} end $$;`);
  await admin.query('create policy active_workspace_boundary on inventory_items as restrictive for all to authenticated using (public.can_current_user_access_workspace(workspace_id)) with check (public.can_current_user_access_workspace(workspace_id));');
  await admin.query('insert into auth.users(id) values($1);', [owner]);
  await admin.query('insert into workspaces values($1,$2,$3)', [workspace, 'Synthetic', owner]);
  await admin.query("insert into workspace_members values($1,$2,'owner')", [workspace, owner]);
  await admin.query('insert into user_preferences(user_id,active_workspace_id) values($1,$2)', [owner, workspace]);
  for (const c of [client = db.getPgClient('postgres', '127.0.0.1'), second = db.getPgClient('postgres', '127.0.0.1')]) {
    await c.connect(); await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  }
  const payload = (id, quantity = 1) => ({ id, user_id: owner, workspace_id: workspace, card_name: 'Synthetic scanner fixture', quantity, game_id: 'magic', data: {} });
  const create = (c, p, key) => c.query("select create_inventory_item_with_event($1,'scanner',$2,'scanner_confirmation',$3) r", [p, key, p.id]);
  const counts = async (ids, key) => (await admin.query('select (select count(*)::int from inventory_items where id=any($1)) items,(select sum(quantity)::int from inventory_items where id=any($1)) units,(select count(*)::int from inventory_events where user_id=$2 and idempotency_key=$3) events', [ids, owner, key])).rows[0];

  const exactId = randomUUID(), exactKey = randomUUID();
  await create(client, payload(exactId), exactKey);
  await assert.rejects(create(client, payload(exactId), exactKey), (e) => e.code === '23505');
  assert.deepEqual(await counts([exactId], exactKey), { items: 1, units: 1, events: 1 });
  evidence.push({ case: 'identical request repeated', observed: '23505 instead of canonical already-committed result', items: 1, events: 1 });

  const ids = [randomUUID(), randomUUID()], sharedKey = randomUUID();
  await create(client, payload(ids[0]), sharedKey);
  await create(client, payload(ids[1], 2), sharedKey);
  assert.deepEqual(await counts(ids, sharedKey), { items: 2, units: 3, events: 1 });
  evidence.push({ case: 'same operation key, different stock payload', observed: 'both succeed; second stock effect has no event', items: 2, units: 3, events: 1 });

  const concurrentIds = [randomUUID(), randomUUID()], concurrentKey = randomUUID();
  await Promise.all([create(client, payload(concurrentIds[0]), concurrentKey), create(second, payload(concurrentIds[1]), concurrentKey)]);
  assert.deepEqual(await counts(concurrentIds, concurrentKey), { items: 2, units: 2, events: 1 });
  evidence.push({ case: 'concurrent key collision with distinct item IDs', observed: 'event uniqueness does not serialize inventory mutation', items: 2, units: 2, events: 1 });

  const mutate = (quantity, key) => client.query("select apply_collector_inventory_mutation($1,'quantity',$2,null,null,null,$3,'mobile')", [exactId, quantity, key]);
  const firstKey = randomUUID(), laterKey = randomUUID();
  await mutate(2, firstKey); await mutate(3, laterKey); await mutate(2, firstKey);
  assert.equal((await admin.query('select quantity from inventory_items where id=$1', [exactId])).rows[0].quantity, 2);
  assert.equal((await admin.query('select count(*)::int n from inventory_events where user_id=$1 and idempotency_key=$2', [owner, firstKey])).rows[0].n, 1);
  evidence.push({ case: 'old request replay after later legitimate quantity update', observed: 'quantity reverted 3 to 2 with no new event' });
  await mutate(7, firstKey);
  assert.equal((await admin.query('select quantity from inventory_items where id=$1', [exactId])).rows[0].quantity, 7);
  evidence.push({ case: 'same operation key with changed quantity', observed: 'payload mismatch accepted; quantity becomes 7 with original event retained' });
  const locations = [randomUUID(), randomUUID()];
  for (const id of locations) await admin.query('insert into inventory_locations(id,user_id,name) values($1,$2,$3)', [id, owner, 'Synthetic location']);
  const move = (location, key) => client.query("select apply_collector_inventory_mutation($1,'storage',null,null,null,$2,$3,'mobile')", [exactId, location, key]);
  const moveKey = randomUUID();
  await move(locations[0], moveKey); await move(locations[1], randomUUID()); await move(locations[0], moveKey);
  assert.equal((await admin.query('select location_id from inventory_items where id=$1', [exactId])).rows[0].location_id, locations[0]);
  assert.equal((await admin.query('select count(*)::int n from inventory_events where user_id=$1 and idempotency_key=$2', [owner, moveKey])).rows[0].n, 1);
  evidence.push({ case: 'location retry after a later move', observed: 'old location restored without an additional movement event' });
  const wrongWorkspace = randomUUID();
  await admin.query('update user_preferences set active_workspace_id=$1 where user_id=$2', [wrongWorkspace, owner]);
  await assert.rejects(mutate(8, firstKey), (e) => e.code === '42501');
  evidence.push({ case: 'wrong active workspace', observed: 'existing authorization guard denies; idempotency defect is reproducible inside authorized scope' });
  console.log(JSON.stringify({ verdict: 'UNSAFE_SHARED_MUTATION_BOUNDARY_REPRODUCED', evidence }, null, 2));
} finally {
  await second?.end(); await client?.end(); await admin?.end(); await db.stop();
}
