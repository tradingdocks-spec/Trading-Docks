// Isolated PostgreSQL 17 only. Production function definitions, repository scan
// DDL and synthetic surrounding tables/data. No hosted URL, .env or Docker path.
import EmbeddedPostgres from '../.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve('.local-fixtures/chaos-forward'); mkdirSync(root,{recursive:true});
const pg=new EmbeddedPostgres({databaseDir:resolve(root,`cluster-${Date.now()}`),user:'postgres',password:'local-test-only',port:55441,persistent:true,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog(){},onError(){}});
const read=p=>readFileSync(p,'utf8');
const migration=read('supabase/migrations/20260927163241_chaos_scan_images_forward.sql');
let db,passed=0;
const equal=(a,b)=>{assert.deepEqual(a,b);passed++;};
const owner=crypto.randomUUID(),other=crypto.randomUUID(),wid=crypto.randomUUID(),otherWid=crypto.randomUUID(),secondWid=crypto.randomUUID();
try {
 await pg.initialise(); await pg.start(); db=pg.getPgClient('postgres','127.0.0.1'); await db.connect();
 await db.query(read('tests/fixtures/chaos-synthetic-prerequisites.sql'));
 const foundation=read('supabase/migrations/20260923204804_chaos_scan_albums_v2.sql');
 await db.query(foundation.slice(0,foundation.indexOf('create or replace function public.chaos_scan_command')));
 const cloud=read('supabase/migrations/20260924000100_chaos_cloud_authority.sql');
 await db.query(cloud.slice(0,cloud.indexOf('-- Batch metadata')));
 await db.query("alter table chaos_scan_private.batch_counters enable row level security;");
 const capacity=read('supabase/migrations/20260924220000_chaos_active_capture_capacity.sql');
 await db.query(capacity.slice(0,capacity.indexOf('do $migration$'))+'commit;');
 const definitions=JSON.parse(read('tests/fixtures/chaos-production-functions.json'));
 for(const f of definitions) await db.query(f.definition);
 await db.query(read('tests/fixtures/chaos-production-commit.sql'));
 await db.query(`revoke all on function public.chaos_scan_command(text,jsonb) from public,anon;
 grant execute on function public.chaos_scan_command(text,jsonb) to authenticated,service_role;
 create policy active_workspace_boundary on public.chaos_scan_albums as restrictive for all to authenticated using(public.can_current_user_access_workspace(workspace_id)) with check(public.can_current_user_access_workspace(workspace_id));`);
 // The new migration must not touch any of these representative unrelated rows.
 await db.query(`create table public.pos_forward_sentinel(id int primary key,data jsonb);
 create table public.storefront_forward_sentinel(id int primary key,data jsonb);
 insert into pos_forward_sentinel values(1,'{"stock":5,"cash":100}');
 insert into storefront_forward_sentinel values(1,'{"quantity":5,"price":123}');`);
 await db.query('insert into auth.users values($1,null),($2,null)',[owner,other]);
 await db.query('insert into workspaces values($1,$2),($3,$4),($5,$2)',[wid,owner,otherWid,other,secondWid]);
 await db.query("insert into workspace_members values($1,$2,'owner'),($3,$4,'owner'),($5,$2,'owner')",[wid,owner,otherWid,other,secondWid]);
 await db.query('insert into user_preferences values($1,$2),($3,$4)',[owner,wid,other,otherWid]);
 await db.query("insert into inventory_locations values('box',$1,'Synthetic box')",[owner]);
 await db.query("insert into inventory_items(user_id,id,quantity,workspace_id) values($1,'five',5,$2)",[owner,wid]);
 await db.query("insert into chaos_sort_inventory_positions(id,user_id,item_id,quantity) values('p2',$1,'five',2),('p3',$1,'five',3)",[owner]);
 await db.query("insert into inventory_events(user_id,inventory_item_id,quantity_change) values($1,'five',5)",[owner]);
 await db.query("insert into selling_inventory_allocations values($1,'five',1)",[owner]);
 const as=async(who,query,params=[])=>{
  const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();
  try { await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);await c.query('set local role authenticated');const r=await c.query(query,params);await c.query('commit');return r.rows; }
  finally { await c.end(); }
 };
 const call=async(action,payload={},who=owner)=>(await as(who,'select public.chaos_scan_command($1,$2) result',[action,payload]))[0].result;
 const deny=async(fn,re)=>{await assert.rejects(fn,re);passed++;};
 const album=await call('create',{requestId:crypto.randomUUID(),destinationId:'box',intakeMode:'upload'});
 const reservation=()=>({batchId:album.id,captureId:crypto.randomUUID(),sha256:'a'.repeat(64)});
 const oldPayload=reservation(),old=await call('reserve',oldPayload);
 await as(owner,'insert into storage.objects values($1,$2)',['chaos-scans',old.object_path]);
 await call('received',oldPayload);
 const tables=['inventory_items','inventory_events','chaos_sort_inventory_positions','selling_inventory_allocations','pos_forward_sentinel','storefront_forward_sentinel','workspaces','workspace_members','user_preferences','chaos_scan_albums','chaos_sort_batches'];
 const snapshot=async()=>{const out={};for(const t of tables) out[t]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${t} t`)).rows[0].rows;return out;};
 const before=await snapshot();
 const captureBefore=(await db.query('select to_jsonb(c) row from chaos_scan_captures c')).rows;
 const capacityBefore=(await db.query("select pg_get_functiondef('chaos_scan_private.enforce_capture_capacity()'::regprocedure) f")).rows;
 const commitBefore=(await db.query("select pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure) f")).rows;
 await db.query(read('supabase/verification/chaos-scan-images-forward-preflight.sql'));
 await db.query(migration); // Execute the ENTIRE file, including every preflight and DDL.
 equal(await snapshot(),before);
 equal((await db.query("select to_jsonb(c)-'back_object_path'-'back_sha256' row from chaos_scan_captures c")).rows,captureBefore);
 equal((await db.query("select pg_get_functiondef('chaos_scan_private.enforce_capture_capacity()'::regprocedure) f")).rows,capacityBefore);
 equal((await db.query("select pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure) f")).rows,commitBefore);
 equal((await db.query("select quantity from inventory_items where id='five'")).rows[0].quantity,5);
 equal((await db.query("select sum(quantity)::int n from chaos_sort_inventory_positions where item_id='five'")).rows[0].n,5);
 equal((await as(owner,'select object_path,status from chaos_scan_captures where capture_id=$1',[old.capture_id]))[0],{object_path:old.object_path,status:'RECEIVED'});
 equal((await call('reserve',oldPayload)).capture_id,old.capture_id); // old app retry still works
 const pairPayload={...reservation(),backSha256:'b'.repeat(64)},pair=await call('reserve',pairPayload);
 equal(pair.back_object_path,pair.object_path.replace('.jpg','-back.jpg'));
 await as(owner,'insert into storage.objects values($1,$2)',['chaos-scans',pair.object_path]);
 await deny(()=>call('received',pairPayload),/SCAN_BACK_UPLOAD_MISSING/);
 await as(owner,'insert into storage.objects values($1,$2)',['chaos-scans',pair.back_object_path]);
 await call('received',pairPayload);
 equal((await call('snapshot',{batchId:album.id})).physicalCount,2);
 equal((await call('reserve',pairPayload)).capture_id,pair.capture_id);
 await deny(()=>call('reserve',{...pairPayload,backSha256:'c'.repeat(64)}),/SCAN_CAPTURE_CONFLICT/);
 equal((await as(owner,'select name from storage.objects order by name')).length,3);
 equal((await as(other,'select name from storage.objects')).length,0);
 equal((await as(other,'select * from chaos_scan_captures')).length,0);
 await deny(()=>call('snapshot',{batchId:album.id},other),/SCAN_UNAUTHORIZED/);
 await db.query('update user_preferences set active_workspace_id=$1 where user_id=$2',[secondWid,owner]);
 equal((await as(owner,'select * from chaos_scan_captures')).length,0);
 equal((await as(owner,'select * from storage.objects')).length,0);
 await deny(()=>call('snapshot',{batchId:album.id}),/SCAN_UNAUTHORIZED/);
 await db.query('update user_preferences set active_workspace_id=$1 where user_id=$2',[wid,owner]);
 await deny(()=>as(owner,"update chaos_scan_captures set status='REMOVED'"),/permission denied/);
 await deny(()=>as(owner,'select * from chaos_scan_private.capture_capacity'),/permission denied/);
 await deny(()=>db.query('update chaos_scan_captures set back_sha256=$1 where capture_id=$2',['c'.repeat(64),pair.capture_id]),/SCAN_CAPTURE_IMAGES_IMMUTABLE/);
 const item=c=>({id:c.capture_id,captureId:c.capture_id,batchId:album.id,quantity:1,cardName:'Synthetic '+c.ordinal,setCode:'TST',collectorNumber:String(c.ordinal),humanState:'confirmed',recognitionState:'high_confidence',processingState:'ready',condition:'NM',finish:'nonfoil'});
 const removed={...item(pair),humanState:'removed'};
 const removedRevision=await call('review',{batchId:album.id,captureId:pair.capture_id,revision:0,item:removed});
 equal(await call('review',{batchId:album.id,captureId:pair.capture_id,revision:0,item:removed}),removedRevision);
 await deny(()=>call('review',{batchId:album.id,captureId:pair.capture_id,revision:removedRevision.revision,item:item(pair)}),/SCAN_CAPTURE_REMOVED_IMMUTABLE/);
 equal((await call('received',pairPayload)).status,'REMOVED');
 equal((await call('snapshot',{batchId:album.id})).physicalCount,1);
 equal((await as(owner,'select name from storage.objects')).length,1);
 equal((await db.query("select quantity from inventory_items where id='five'")).rows[0].quantity,5);
 // 98 new fronts + original = 99; race 12 independent connections for the last slot.
 for(let i=0;i<98;i++) await call('reserve',reservation());
 const race=await Promise.allSettled(Array.from({length:12},()=>call('reserve',reservation())));
 equal(race.filter(r=>r.status==='fulfilled').length,1);
 equal(race.filter(r=>r.status==='rejected'&&/SCAN_BATCH_FULL/.test(r.reason.message)).length,11);
 const state=await call('snapshot',{batchId:album.id});equal(state.physicalCount,100);equal(state.captures.length,101);
 equal((await db.query('select count(*)::int n from chaos_scan_private.capture_capacity')).rows[0].n,100);
 await deny(()=>db.query('delete from chaos_scan_captures where capture_id=$1',[pair.capture_id]),/SCAN_CAPTURE_HISTORY_IMMUTABLE/);
 await deny(()=>db.query("update chaos_scan_captures set status='RECEIVED' where capture_id=$1",[pair.capture_id]),/SCAN_CAPTURE_REMOVED_IMMUTABLE/);
 await deny(()=>call('commit',{batchId:album.id}),/SCAN_REVIEW_REQUIRED/);
 for(const c of state.captures.filter(c=>c.status!=='REMOVED')) {
  if(c.status==='RESERVED') {await as(owner,'insert into storage.objects values($1,$2)',['chaos-scans',c.object_path]);await call('received',{batchId:album.id,captureId:c.capture_id});}
  await call('review',{batchId:album.id,captureId:c.capture_id,revision:c.revision,item:item(c)});
 }
 equal((await call('commit',{batchId:album.id})).committedCount,100);
 equal((await call('commit',{batchId:album.id})).replayed,true);
 equal((await db.query("select sum(quantity)::int n from inventory_items where id<>'five'")).rows[0].n,100);
 equal((await db.query("select count(*)::int n from inventory_events where inventory_item_id<>'five'")).rows[0].n,100);
 equal((await db.query("select quantity from inventory_items where id='five'")).rows[0].quantity,5);
 equal((await call('snapshot',{batchId:album.id})).captures.find(c=>c.capture_id===pair.capture_id).status,'REMOVED');
 await deny(()=>db.query(migration),/SCAN_IMAGES_BASELINE_DRIFT/);await db.query('rollback');
 console.log(JSON.stringify({status:'PASS',checks:passed,postgres:(await db.query('show server_version')).rows[0].server_version,capacityRace:{requests:12,accepted:1},inventoryFiveAcrossTwoPositions:5,fixture:'production scan functions + repository scan DDL + synthetic surrounding schema; not full production restore'}));
} finally {await db?.end();await pg.stop();}
