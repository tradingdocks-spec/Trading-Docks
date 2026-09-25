// Diagnostic reproducer of UNSAFE existing behavior, not a passing release gate.
// Loopback disposable PostgreSQL, synthetic identities only; no app environment.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.env.TD_TEST_RUNTIME ?? '.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js')).href);
const db = new EmbeddedPostgres({ databaseDir: mkdtempSync(join(tmpdir(), 'td-phase1j-evidence-')), user: 'postgres', password: 'local-test-only', port: 55449, persistent: true, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog() {}, onError() {} });
const sql = (p) => readFileSync(p, 'utf8');
let admin, client, second;
const owner = randomUUID(), workspace = randomUUID();
const evidence = [];
const repaired = process.argv.includes('--repaired');
const migration = 'supabase/migrations/20260925024439_inventory_mutation_idempotency.sql';
const conflict = (e) => /INVENTORY_IDEMPOTENCY_CONFLICT/.test(e.message);
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
  const create = (c, p, key) => c.query("select to_jsonb(create_inventory_item_with_event($1,'scanner',$2,'scanner_confirmation',$3)) r", [p, key, p.id]);
  const counts = async (ids, key) => (await admin.query('select (select count(*)::int from inventory_items where id=any($1)) items,(select sum(quantity)::int from inventory_items where id=any($1)) units,(select count(*)::int from inventory_events where user_id=$2 and idempotency_key=$3) events', [ids, owner, key])).rows[0];

  const legacyId=randomUUID(), legacyKey=randomUUID();
  await create(client,payload(legacyId),legacyKey);
  const snapshot=async()=>(await admin.query("select jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by id) from inventory_items i),'events',(select jsonb_agg(to_jsonb(e) order by id) from inventory_events e)) s")).rows[0].s;
  if(repaired){const before=await snapshot();await admin.query(sql(migration));assert.deepEqual(await snapshot(),before);}
  const exactId = randomUUID(), exactKey = randomUUID();
  const original=(await create(client, payload(exactId), exactKey)).rows[0].r;
  if(repaired) assert.deepEqual((await create(client,payload(exactId),exactKey)).rows[0].r,original);
  else await assert.rejects(create(client, payload(exactId), exactKey), (e) => e.code === '23505');
  assert.deepEqual(await counts([exactId], exactKey), { items: 1, units: 1, events: 1 });
  evidence.push({ case: 'identical request repeated', observed: '23505 instead of canonical already-committed result', items: 1, events: 1 });

  const ids = [randomUUID(), randomUUID()], sharedKey = randomUUID();
  await create(client, payload(ids[0]), sharedKey);
  if(repaired) await assert.rejects(create(client,payload(ids[1],2),sharedKey),conflict);
  else await create(client, payload(ids[1], 2), sharedKey);
  assert.deepEqual(await counts(ids, sharedKey), repaired ? {items:1,units:1,events:1} : { items: 2, units: 3, events: 1 });
  evidence.push({ case: 'same operation key, different stock payload', observed: 'both succeed; second stock effect has no event', items: 2, units: 3, events: 1 });

  const concurrentIds = [randomUUID(), randomUUID()], concurrentKey = randomUUID();
  const race=await Promise.allSettled([create(client,payload(concurrentIds[0]),concurrentKey),create(second,payload(concurrentIds[1]),concurrentKey)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,repaired?1:2);
  if(repaired) assert.ok(race.some(r=>r.status==='rejected' && conflict(r.reason)));
  assert.deepEqual(await counts(concurrentIds, concurrentKey), repaired?{items:1,units:1,events:1}:{ items: 2, units: 2, events: 1 });
  evidence.push({ case: 'concurrent key collision with distinct item IDs', observed: 'event uniqueness does not serialize inventory mutation', items: 2, units: 2, events: 1 });

  const mutate = (quantity, key) => client.query("select apply_collector_inventory_mutation($1,'quantity',$2,null,null,null,$3,'mobile')", [exactId, quantity, key]);
  const firstKey = randomUUID(), laterKey = randomUUID();
  const firstResult=(await mutate(2,firstKey)).rows; await mutate(3,laterKey); const retryResult=(await mutate(2,firstKey)).rows;
  if(repaired) assert.deepEqual(retryResult,firstResult);
  assert.equal((await admin.query('select quantity from inventory_items where id=$1', [exactId])).rows[0].quantity, repaired?3:2);
  assert.equal((await admin.query('select count(*)::int n from inventory_events where user_id=$1 and idempotency_key=$2', [owner, firstKey])).rows[0].n, 1);
  evidence.push({ case: 'old request replay after later legitimate quantity update', observed: 'quantity reverted 3 to 2 with no new event' });
  if(repaired) await assert.rejects(mutate(7,firstKey),conflict); else await mutate(7,firstKey);
  assert.equal((await admin.query('select quantity from inventory_items where id=$1', [exactId])).rows[0].quantity, repaired?3:7);
  evidence.push({ case: 'same operation key with changed quantity', observed: 'payload mismatch accepted; quantity becomes 7 with original event retained' });
  const locations = [randomUUID(), randomUUID()];
  for (const id of locations) await admin.query('insert into inventory_locations(id,user_id,name) values($1,$2,$3)', [id, owner, 'Synthetic location']);
  const move = (location, key) => client.query("select apply_collector_inventory_mutation($1,'storage',null,null,null,$2,$3,'mobile')", [exactId, location, key]);
  const moveKey = randomUUID();
  await move(locations[0], moveKey); await move(locations[1], randomUUID()); await move(locations[0], moveKey);
  assert.equal((await admin.query('select location_id from inventory_items where id=$1', [exactId])).rows[0].location_id, locations[repaired?1:0]);
  assert.equal((await admin.query('select count(*)::int n from inventory_events where user_id=$1 and idempotency_key=$2', [owner, moveKey])).rows[0].n, 1);
  evidence.push({ case: 'location retry after a later move', observed: 'old location restored without an additional movement event' });
  const wrongWorkspace = randomUUID();
  await admin.query('update user_preferences set active_workspace_id=$1 where user_id=$2', [wrongWorkspace, owner]);
  await assert.rejects(mutate(8, firstKey), (e) => e.code === '42501');
  evidence.push({ case: 'wrong active workspace', observed: 'existing authorization guard denies; idempotency defect is reproducible inside authorized scope' });
  if(repaired) {
    const after=['same committed snapshot returned','conflict; 1 row, 1 unit, 1 event','one commit; conflicting caller rejected','newer quantity 3 preserved; prior result returned','conflict; newer quantity unchanged','newer location preserved; no duplicate event','42501; no prior result exposed'];
    evidence.forEach((e,i)=>{e.before=e.observed;delete e.observed;delete e.items;delete e.units;delete e.events;e.after=after[i];});
    await admin.query('update user_preferences set active_workspace_id=$1 where user_id=$2',[workspace,owner]);
    await runAdditional({admin,client,second,owner,workspace,payload,create,counts,snapshot,legacyId,legacyKey,exactId,exactKey,original,mutate,firstKey});
  }
  console.log(JSON.stringify({ verdict: repaired?'SEVEN_REGRESSIONS_PASSED':'UNSAFE_SHARED_MUTATION_BOUNDARY_REPRODUCED', evidence }, null, 2));
} finally {
  await second?.end(); await client?.end(); await admin?.end(); await db.stop();
}

async function runAdditional({admin,client,second,owner,workspace,payload,create,counts,snapshot,legacyId,legacyKey,exactId,exactKey,original,mutate,firstKey}) {
  const checks=[];
  const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
  await check('migration replay preserves populated stock, ledger, receipt and result',async()=>{
    const before=await snapshot();await admin.query(sql(migration));assert.deepEqual(await snapshot(),before);
  });
  await check('two concurrent identical requests return exactly the same committed result',async()=>{
    const id=randomUUID(),key=randomUUID(),p=payload(id);
    const [a,b]=await Promise.all([create(client,p,key),create(second,p,key)]);
    assert.deepEqual(a.rows[0].r,b.rows[0].r);assert.deepEqual(await counts([id],key),{items:1,units:1,events:1});
  });
  await check('duplicate actually waits on database operation claim until first transaction commits',async()=>{
    const p=payload(randomUUID()),key=randomUUID();
    const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
    await client.query('begin');let waiting;
    try {
      const first=await create(client,p,key);
      waiting=create(second,p,key).then(result=>({result}),error=>({error}));
      let blocked=false;
      for(let i=0;i<50&&!blocked;i++){
        blocked=(await admin.query("select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) b",[pid])).rows[0].b;
        if(!blocked)await new Promise(resolve=>setTimeout(resolve,20));
      }
      assert.equal(blocked,true,'second transaction must be blocked on the operation claim');
      await client.query('commit');const next=await waiting;if(next.error)throw next.error;
      assert.deepEqual(next.result.rows,first.rows);assert.deepEqual(await counts([p.id],key),{items:1,units:1,events:1});
    } finally {await client.query('rollback');if(waiting)await waiting;}
  });
  await check('canonical numeric scale and object order replay, business fields conflict',async()=>{
    const p={...payload(randomUUID()),data:{value:1,condition:'NM',finish:'normal',language:'en'}},key=randomUUID();
    const original=(await create(client,p,key)).rows;
    const serialized=JSON.stringify(p).replace('"value":1','"value":1.00');
    const again=await client.query("select to_jsonb(create_inventory_item_with_event($1,'scanner',$2,'scanner_confirmation',$3)) r",[serialized,key,p.id]);assert.deepEqual(again.rows,original);
    const before=await snapshot();
    for(const changed of [{...p,data:{...p.data,language:'ja'}},{...p,data:{...p.data,finish:'foil'}},{...p,data:{...p.data,condition:'LP'}},{...p,collector_number:'2'}])await assert.rejects(create(client,changed,key),conflict);
    assert.deepEqual(await snapshot(),before);
  });
  await check('repeatable-read stale snapshot fails retryably and whole-transaction retry recovers result',async()=>{
    const p=payload(randomUUID()),key=randomUUID();
    await second.query('begin isolation level repeatable read');
    try {
      await second.query('select count(*) from inventory_events'); // Freeze pre-commit snapshot.
      const first=await create(client,p,key);
      await assert.rejects(create(second,p,key),(e)=>e.code==='40001');
      await second.query('rollback');
      assert.deepEqual((await create(second,p,key)).rows,first.rows);
      assert.deepEqual(await counts([p.id],key),{items:1,units:1,events:1});
    } finally {await second.query('rollback');}
  });
  await check('creation replay after quantity/location edits returns original immutable snapshot',async()=>{
    assert.deepEqual((await create(client,payload(exactId),exactKey)).rows[0].r,original);
    assert.equal((await admin.query('select quantity from inventory_items where id=$1',[exactId])).rows[0].quantity,3);
  });
  await check('same key across mutation kinds rejected without altering receipt',async()=>{
    const before=await snapshot();await assert.rejects(mutate(9,exactKey),conflict);assert.deepEqual(await snapshot(),before);
  });
  await check('legacy key without immutable request is review-only, never fabricated',async()=>{
    const before=await snapshot();await assert.rejects(create(client,payload(legacyId),legacyKey),/LEGACY_OPERATION_REVIEW_REQUIRED/);assert.deepEqual(await snapshot(),before);
  });
  await check('missing identity rejected before stock changes',async()=>{
    const before=await snapshot();await assert.rejects(create(client,payload(randomUUID()),null),/OPERATION_ID_REQUIRED/);assert.deepEqual(await snapshot(),before);
  });
  await check('failed event append rolls back stock and key; same request can recover once',async()=>{
    const p=payload(randomUUID()),key=randomUUID(),before=await snapshot();
    await admin.query("create function public.inject_event_failure() returns trigger language plpgsql as $$begin raise exception 'injected event failure';end$$;create trigger injected before insert on inventory_events for each row execute function inject_event_failure();");
    try{await assert.rejects(create(client,p,key),/injected event failure/);assert.deepEqual(await snapshot(),before);}finally{await admin.query('drop trigger injected on inventory_events;drop function inject_event_failure()');}
    const a=await create(client,p,key),b=await create(client,p,key);assert.deepEqual(a.rows,b.rows);assert.deepEqual(await counts([p.id],key),{items:1,units:1,events:1});
  });
  await check('partial batch A and C replay; B recovers once with the same payload',async()=>{
    const p=[payload(randomUUID()),payload(randomUUID()),payload(randomUUID())],keys=p.map(()=>randomUUID()),location=randomUUID();p[1].location_id=location;
    const a=await create(client,p[0],keys[0]);await assert.rejects(create(client,p[1],keys[1]),/storage locations/);const c=await create(client,p[2],keys[2]);
    await admin.query('insert into inventory_locations(id,user_id,name) values($1,$2,$3)',[location,owner,'Batch fixture']);
    const results=[];for(let i=0;i<3;i++)results.push(await create(client,p[i],keys[i]));
    assert.deepEqual(results[0].rows,a.rows);assert.deepEqual(results[2].rows,c.rows);
    for(let i=0;i<3;i++)assert.deepEqual(await counts([p[i].id],keys[i]),{items:1,units:1,events:1});
  });
  await check('lost response plus client restart retries RPC directly, without stock lookup',async()=>{
    let persisted='[]';const storage={getItem:async()=>persisted,setItem:async(_k,v)=>{persisted=v;}};
    const p=payload(randomUUID(),2),key=randomUUID();let result;
    const q=createOfflineQueue({storage,lock:createQueueLock(),runtimeId:'before',newId:randomUUID});
    await q.enqueue('rpc_fixture',{p,key},{userId:owner,operationId:key});
    await q.process(key,owner,'rpc_fixture',async()=>{result=(await create(client,p,key)).rows[0].r;throw Error('response lost after commit');},{retrySafe:true});
    assert.equal((await q.list())[0].status,'retryable');
    const restarted=createOfflineQueue({storage,lock:createQueueLock(),runtimeId:'after',newId:randomUUID});
    const outcome=await restarted.process(key,owner,'rpc_fixture',async(op)=>assert.deepEqual((await create(client,op.payload.p,op.payload.key)).rows[0].r,result),{retrySafe:true});
    assert.equal(outcome.status,'committed');assert.deepEqual(await restarted.list(),[]);assert.deepEqual(await counts([p.id],key),{items:1,units:2,events:1});
  });
  await check('ledger stores actor, workspace, request hash, result and correct event quantity',async()=>{
    const e=(await admin.query('select * from inventory_events where user_id=$1 and idempotency_key=$2',[owner,firstKey])).rows[0];
    const r=e.metadata.inventoryMutationV1;assert.equal(e.workspace_id,workspace);assert.equal(r.request.actor,owner);assert.equal(r.request.workspace,workspace);
    assert.match(r.fingerprint,/^[a-f0-9]{64}$/);assert.equal(r.result.id,exactId);assert.equal(r.result.quantity,2);
    assert.equal(e.quantity_before,1);assert.equal(e.quantity_after,2);assert.equal(e.quantity_change,1);assert.ok(e.created_at);
  });
  await check('same owner key in another authorized workspace conflicts without disclosing old result',async()=>{
    const w=randomUUID();await admin.query('insert into workspaces values($1,$2,$3)',[w,'Second fixture',owner]);await admin.query("insert into workspace_members values($1,$2,'owner')",[w,owner]);await admin.query('update user_preferences set active_workspace_id=$1 where user_id=$2',[w,owner]);
    try{await assert.rejects(create(client,{...payload(randomUUID()),workspace_id:w},exactKey),(e)=>conflict(e)&&!e.message.includes(exactId));}
    finally{await admin.query('update user_preferences set active_workspace_id=$1 where user_id=$2',[workspace,owner]);}
  });
  await check('another tenant has independent key namespace; unauthorized target and anonymous denied',async()=>{
    const actor=randomUUID(),w=randomUUID();await admin.query('insert into auth.users(id) values($1)',[actor]);await admin.query('insert into workspaces values($1,$2,$3)',[w,'Other fixture',actor]);await admin.query("insert into workspace_members values($1,$2,'owner')",[w,actor]);await admin.query('insert into user_preferences(user_id,active_workspace_id) values($1,$2)',[actor,w]);
    await second.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
    const own={...payload(randomUUID()),user_id:actor,workspace_id:w};const r=(await create(second,own,exactKey)).rows[0].r;assert.equal(r.id,own.id);assert.equal(r.user_id,actor);
    await assert.rejects(create(second,payload(exactId),exactKey),/AUTHORIZATION_FAILURE/);
    await assert.rejects(second.query("select apply_collector_inventory_mutation($1,'quantity',99,null,null,null,$2,'mobile')",[exactId,firstKey]),/FORBIDDEN/);
    await second.query('set role anon');await assert.rejects(create(second,own,exactKey),/permission denied/);await second.query('set role authenticated');
    await second.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  });
  await check('receipt helpers unavailable to browser and event writes remain denied',async()=>{
    await assert.rejects(client.query("select inventory_private.replay_inventory_command('x','{}')"),/permission denied/);
    await assert.rejects(client.query("update inventory_events set metadata='{}' where idempotency_key=$1",[exactKey]),/permission denied/);
    assert.equal((await admin.query("select relrowsecurity from pg_class where oid='inventory_events'::regclass")).rows[0].relrowsecurity,true);
  });
  console.log(`PASS ${checks.length} additional Phase 1K acceptance checks`);
}
