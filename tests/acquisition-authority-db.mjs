// Isolated loopback PostgreSQL; no app env, remote connection or customer data.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
import { replayQueuedScannerAddsWithDependencies } from '../mobile/services/scanner-replay.ts';
import { SCANNER_COLLECTION_QUEUE_TYPE } from '../mobile/services/scanner-foundation.ts';
const runtime = resolve(process.env.TD_TEST_RUNTIME ?? '.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js');
const { default: EmbeddedPostgres } = await import(pathToFileURL(runtime).href);
const db = new EmbeddedPostgres({ databaseDir: mkdtempSync(join(tmpdir(),'td-acquisition-')), user:'postgres',password:'local-test-only',port:55448,persistent:true,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog(){},onError(){} });
const sql = p => readFileSync(p,'utf8');
const migration='supabase/migrations/20260924235138_acquisition_purchase_authority.sql';
const owner=randomUUID(), other=randomUUID(), employee=randomUUID(), workspace=randomUUID(), otherWorkspace=randomUUID();
let admin, client; let passed=0;
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`);}
async function totals(){return (await admin.query(`select (select count(*) from purchase_ledger)::int purchases,(select count(*) from inventory_items)::int items,(select count(*) from inventory_events)::int events,(select count(*) from purchase_inventory_links)::int links`)).rows[0];}
async function draft(status='offer_ready', items=[{id:randomUUID(),cardName:'Fixture Card',gameId:'magic',productType:'card',setCode:'TST',collectorNumber:'1',condition:'NM',finish:'nonfoil',language:'English',quantity:2,unitMarketValue:3,reviewState:'ready'}]){
 const input={id:randomUUID(),revision:0,title:'Fixture',status,items};
 await client.query('select save_collection_intake($1)',[input]);return input;
}
async function finish(d,receive=true,amount=4,key=d.id,location=null){return (await client.query('select finalize_intake_purchase($1,$2,$3,$4,$5) r',[d.id,amount,key,receive,location])).rows[0].r;}
try{
 await db.initialise();await db.start();admin=db.getPgClient('postgres','127.0.0.1');await admin.connect();
 await admin.query(sql('tests/fixtures/pos-prerequisites.sql'));
 await admin.query('grant select on workspace_members to authenticated');
 await admin.query(sql('supabase/migrations/202607280004_inventory_persistence.sql'));
 // Fixture supplies pre-existing identity columns and active-workspace helper;
 // the inventory creation/event function and ledger tables below are real SQL.
 await admin.query(`alter table inventory_items add workspace_id uuid,add game_id text,add product_type text,add provider_category_id text,add provider_product_id text,add provider_sku_id text,add tcgplayer_product_id bigint,add tcgplayer_sku_id bigint,add variant text,add language text;
 create function current_inventory_workspace() returns uuid language sql stable security definer set search_path='' as $$select p.active_workspace_id from public.user_preferences p join public.workspace_members m on m.workspace_id=p.active_workspace_id and m.user_id=p.user_id where p.user_id=auth.uid()$$;`);
 await admin.query(sql('supabase/migrations/202608120002_inventory_event_ledger.sql'));
 await admin.query(sql('supabase/migrations/202608110001_purchase_history_ledger_proposal.sql'));
 if(process.argv.includes('--legacy-intake')) {
  await admin.query("create function public.can_manage_workspace(w uuid) returns boolean language sql as $$ select public.is_workspace_admin(w) $$");
  await admin.query(sql('supabase/migrations/202608120003_inventory_event_collection_purchase_source.sql'));
  await admin.query(sql('supabase/migrations/202608120004_collection_intake.sql'));
 }
 await admin.query(sql(migration)); await admin.query(sql(migration));
 await admin.query('insert into auth.users(id) values($1),($2),($3)',[owner,other,employee]);
 await admin.query('insert into workspaces values($1,$2,$3),($4,$5,$6)',[workspace,'Fixture',owner,otherWorkspace,'Other',other]);
 await admin.query("insert into workspace_members values($1,$2,'owner'),($3,$4,'owner'),($1,$5,'member')",[workspace,owner,otherWorkspace,other,employee]);
 await admin.query('insert into user_preferences(user_id,active_workspace_id) values($1,$2),($3,$4),($5,$2)',[owner,workspace,other,otherWorkspace,employee]);
 client=db.getPgClient('postgres','127.0.0.1');await client.connect();await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await check('migration replays without competing collection_purchases',async()=>assert.equal((await admin.query("select to_regclass('public.collection_purchases') r")).rows[0].r,process.argv.includes('--legacy-intake')?'collection_purchases':null));
 await check('draft/rejected intake creates no purchase',async()=>{await draft('draft');const d=await draft('declined');const before=await totals();await assert.rejects(finish(d),/NOT_PURCHASABLE/);assert.deepEqual(await totals(),before);});
 await check('atomic draft save and revision conflict',async()=>{const d=await draft();await assert.rejects(client.query('select save_collection_intake($1)',[{...d,revision:1,items:[{...d.items[0],quantity:0}]}]));assert.equal((await admin.query('select quantity from collection_intake_items where intake_id=$1',[d.id])).rows[0].quantity,2);await assert.rejects(client.query('select save_collection_intake($1)',[d]),/REVISION_CONFLICT/);});
 await check('authenticated purchase and receipt; safe retry and payload conflict',async()=>{const d=await draft();const before=await totals();const a=await finish(d);const b=await finish(d);assert.equal(a.purchaseId,b.purchaseId);assert.equal(a.status,'received');assert.deepEqual(await totals(),{purchases:before.purchases+1,items:before.items+1,events:before.events+1,links:before.links+1});await assert.rejects(finish(d,true,5),/REQUEST_CONFLICT/);await assert.rejects(client.query('select save_collection_intake($1)',[{...d,revision:1}]),/FINALIZED/);});
 await check('purchase now, receipt later adds no purchase value',async()=>{const d=await draft();const before=await totals();const a=await finish(d,false);assert.equal(a.status,'completed');assert.equal((await totals()).items,before.items);const b=await finish(d,true);assert.equal(b.purchaseId,a.purchaseId);assert.equal(b.status,'received');assert.equal((await totals()).purchases,before.purchases+1);});
 for(const table of ['purchase_ledger','purchase_ledger_lines','inventory_items','inventory_events','purchase_inventory_links']){
  await check(`${table} injected failure rolls back purchase and stock`,async()=>{const d=await draft();const before=await totals();await admin.query(`create function public.test_fail() returns trigger language plpgsql as $$begin raise exception 'injected';end$$;create trigger test_fail before insert on public.${table} for each row execute function public.test_fail();`);await assert.rejects(finish(d),/injected/);assert.deepEqual(await totals(),before);assert.equal((await admin.query('select status from collection_intakes where id=$1',[d.id])).rows[0].status,'offer_ready');await admin.query(`drop trigger test_fail on public.${table};drop function public.test_fail()`);});
 }
 await check('invalid location rolls back immediate purchase',async()=>{const d=await draft();const before=await totals();await assert.rejects(finish(d,true,4,d.id,'absent'),/INVALID_LOCATION/);assert.deepEqual(await totals(),before);});
 await check('one invalid card prevents entire receipt',async()=>{const d=await draft();d.items.push({...d.items[0],id:randomUUID(),language:null});await client.query('select save_collection_intake($1)',[{...d,revision:1}]);const before=await totals();await assert.rejects(finish(d),/REVIEW_REQUIRED/);assert.deepEqual(await totals(),before);});
 await check('concurrent finalization creates exactly one purchase',async()=>{const d=await draft();const second=db.getPgClient('postgres','127.0.0.1');await second.connect();try{await second.query('set role authenticated');await second.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);const [a,b]=await Promise.all([finish(d),second.query('select finalize_intake_purchase($1,4,$2,true,null) r',[d.id,d.id])]);assert.equal(a.purchaseId,b.rows[0].r.purchaseId);}finally{await second.end();}});
 await check('direct purchase/line edits cannot change finalized finance',async()=>{const p=(await admin.query('select id from purchase_ledger limit 1')).rows[0].id;const update=await client.query('update purchase_ledger set total_cost=99 where id=$1',[p]);assert.equal(update.rowCount,0);const lines=await client.query('update purchase_ledger_lines set total_cost=99 where purchase_id=$1',[p]);assert.equal(lines.rowCount,0);});
 await check('cross-tenant, employee and anonymous finalization denied',async()=>{const d=await draft();for(const actor of [other,employee]){await client.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await assert.rejects(finish(d),/FORBIDDEN|UNAUTHORIZED/);}await client.query('set role anon');await assert.rejects(finish(d),/permission denied/);await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);});
 await check('failed deferred receipt preserves commitment and can retry',async()=>{
  const d=await draft(); const purchase=await finish(d,false); const before=await totals();
  await assert.rejects(finish(d,true,4,d.id,'missing'),/INVALID_LOCATION/);
  assert.deepEqual(await totals(),before);
  assert.equal((await admin.query('select status from purchase_ledger where id=$1',[purchase.purchaseId])).rows[0].status,'completed');
  assert.equal((await finish(d)).purchaseId,purchase.purchaseId);
 });
 await check('invalid money cannot create finance or stock',async()=>{
  const d=await draft();const before=await totals();
  for(const amount of [-1,'NaN','Infinity',1.001]) await assert.rejects(finish(d,true,amount),/INVALID_INPUT/);
  assert.deepEqual(await totals(),before);
 });
 await check('condition/location/repricing do not rewrite purchase cost or date',async()=>{
  const d=await draft();const p=await finish(d);
  const snapshot=async()=>(await admin.query('select total_cost,unit_count,purchased_at from purchase_ledger where id=$1',[p.purchaseId])).rows;
  const before=await snapshot();
  await admin.query("update inventory_items set inventory_value=99,data=data||'{\"condition\":\"LP\",\"locationNote\":\"fixture move\",\"askingPrice\":100}'::jsonb where id=$1",[p.items[0].inventoryItemId]);
  assert.deepEqual(await snapshot(),before);
 });
 await check('populated migration replay preserves complete financial and stock rows',async()=>{
  const snapshot=async()=>(await admin.query(`select jsonb_build_object(
   'purchases',(select jsonb_agg(to_jsonb(p) order by id) from purchase_ledger p),
   'lines',(select jsonb_agg(to_jsonb(p) order by id) from purchase_ledger_lines p),
   'items',(select jsonb_agg(to_jsonb(p) order by id) from inventory_items p),
   'events',(select jsonb_agg(to_jsonb(p) order by id) from inventory_events p),
   'intakes',(select jsonb_agg(to_jsonb(p) order by id) from collection_intakes p)) value`)).rows[0].value;
  const before=await snapshot();await admin.query(sql(migration));assert.deepEqual(await snapshot(),before);
 });
 await check('legacy write gate and receipt cost protection preserve authorized edits',async()=>{
  const gate=sql('supabase/migrations/20260925002945_acquisition_legacy_write_gate.sql');await admin.query(gate);await admin.query(gate);
  await assert.rejects(client.query("insert into purchase_ledger(user_id,created_by) values($1,$1)",[owner]),/permission denied/);
  const d=await draft();const p=await finish(d);const id=p.items[0].inventoryItemId;
  await assert.rejects(admin.query("update inventory_items set data=jsonb_set(data,'{costBasis}','99') where id=$1",[id]),/COST_IMMUTABLE/);
  await admin.query("update inventory_items set inventory_value=20,data=data||'{\"condition\":\"LP\",\"notes\":\"correction\"}' where id=$1",[id]);
  assert.equal((await admin.query('select total_cost from purchase_ledger where id=$1',[p.purchaseId])).rows[0].total_cost,'4.00');
 });
 await check('multi-card collection conserves agreed cost and exact receipt identity',async()=>{
  const d=await draft();d.items.push({...d.items[0],id:randomUUID(),cardName:'Second printing',collectorNumber:'2',quantity:1,unitMarketValue:2});
  await client.query('select save_collection_intake($1)',[{...d,revision:1}]);const p=await finish(d,true,5);
  const lines=(await admin.query('select quantity,total_cost,details,inventory_item_id from purchase_ledger_lines where purchase_id=$1',[p.purchaseId])).rows;
  assert.equal(lines.length,2);assert.equal(lines.reduce((sum,l)=>sum+Number(l.total_cost),0),5);
  assert.equal(lines.reduce((sum,l)=>sum+l.quantity,0),3);assert.deepEqual(lines.map(l=>l.details.collectorNumber).sort(),['1','2']);
  assert.equal(new Set(lines.map(l=>l.inventory_item_id)).size,2);
 });
 await check('scanner queue recovers a lost response after actual stock/event commit without duplicate',async()=>{
  let persisted='[]';let insertCalls=0;
  const q=createOfflineQueue({storage:{getItem:async()=>persisted,setItem:async(_key,value)=>{persisted=value;}},lock:createQueueLock(),runtimeId:'db-fixture',newId:randomUUID});
  const id=randomUUID();const confirmation={userId:owner,candidate:{id:randomUUID(),name:'Queue fixture',setCode:'TST',setName:'Test',collectorNumber:'9',finishes:['normal'],language:'en',confidence:.9,recognitionMode:'manual_search'},quantity:2,condition:'near_mint',finish:'normal',language:'en',storageLocationId:null,tradeStatus:'not_for_trade',addToWishlist:false};
  const before=await totals();
  await q.enqueue(SCANNER_COLLECTION_QUEUE_TYPE,{confirmation,inventoryItemId:id,idempotencyKey:id},{userId:owner,operationId:id});
  const deps={getQueue:q.list,processOperation:q.process,getAuthenticatedUserId:async()=>owner,loadCurrentTotalQuantity:async()=>0,inventoryItemExists:async(user,item)=>(await client.query('select id from inventory_items where user_id=$1 and id=$2',[user,item])).rowCount>0,validatePrintingIdentity:async(c)=>c,
   insertInventoryItem:async(payload)=>{insertCalls++;await client.query("select create_inventory_item_with_event($1,'scanner_replay',$2,'scanner_queue_entry',$3)",[payload,`scanner-replay:${id}`,id]);throw Error('simulated client timeout after server commit');},runTradeStatus:async()=>assert.fail('not requested'),runWishlist:async()=>assert.fail('not requested')};
  assert.equal((await replayQueuedScannerAddsWithDependencies({userId:owner,membershipTier:'collector',trigger:'network_reconnect'},deps)).failed,1);
  assert.equal((await q.list())[0].status,'retryable');
  assert.equal((await replayQueuedScannerAddsWithDependencies({userId:owner,membershipTier:'collector',trigger:'app_resume'},deps)).succeeded,1);
  assert.equal(insertCalls,1);assert.deepEqual(await q.list(),[]);
  const after=await totals();assert.equal(after.items,before.items+1);assert.equal(after.events,before.events+1);assert.equal(after.purchases,before.purchases);assert.equal(after.links,before.links);
  assert.equal((await client.query('select quantity from inventory_items where id=$1 and user_id=$2',[id,owner])).rows[0].quantity,2);
 });
 console.log(`PASS ${passed} acquisition database checks`);
}finally{await client?.end();await admin?.end();await db.stop();}
