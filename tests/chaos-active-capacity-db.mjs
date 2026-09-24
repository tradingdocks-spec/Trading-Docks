import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='supabase_db_trading-docks-recovery-test';
const state=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.deepEqual(state.NetworkSettings.Networks,{}); assert.match(state.Config.Image,/supabase\/postgres:17\./); assert.equal(state.State.Running,true);
const database='chaos_capacity_'+Date.now();
const args=db=>['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'];
const sql=(q,db=database)=>execFileSync('docker',args(db),{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}).trim();
sql(`create database ${database} template collector_removal_rehearsal`,'template1');
for(const file of ['20260923204804_chaos_scan_albums_v2.sql','20260924000100_chaos_cloud_authority.sql','20260924005111_chaos_legacy_workspace_normalization.sql','20260924013600_cloud_active_workspace_authority.sql','20260924043103_chaos_intake_mode_switch.sql']) sql(readFileSync('supabase/migrations/'+file,'utf8'));
const owner='11111111-1111-4111-8111-111111111188',other='11111111-1111-4111-8111-111111111189';
sql(`insert into auth.users(id,email) values('${owner}','capacity-owner@example.invalid'),('${other}','capacity-other@example.invalid');update user_preferences set active_workspace_id=(select workspace_id from workspace_members where user_id=user_preferences.user_id limit 1) where user_id in ('${owner}','${other}');`);
const as=(q,actor=owner)=>`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;${q};commit;`;
const query=(action,payload)=>`select public.chaos_scan_command('${action}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb)`;
const command=(action,payload={},actor=owner)=>JSON.parse(sql(as(query(action,payload),actor)));
const deny=(f,re)=>assert.throws(f,e=>re.test(String(e.stderr||e)));
sql(as(`insert into inventory_locations(id,user_id,name) values('capacity-box','${owner}','Capacity box')`));
const a=command('create',{requestId:crypto.randomUUID(),destinationId:'capacity-box',intakeMode:'csv'});
const capture=()=>({batchId:a.id,captureId:crypto.randomUUID(),sha256:'a'.repeat(64)});
sql(as([query('reserve',capture()),...Array.from({length:99},()=>query('csv',capture()))].join(';')));
const baseline=sql(`select md5(string_agg(to_jsonb(c)::text,',' order by ordinal)) from chaos_scan_captures c`);
const inventory=sql(`select count(*)||':'||sum(quantity)||':'||(select count(*) from inventory_events) from inventory_items`);
sql(readFileSync('supabase/migrations/20260924220000_chaos_active_capture_capacity.sql','utf8'));
assert.equal(sql(`select md5(string_agg(to_jsonb(c)::text,',' order by ordinal)) from chaos_scan_captures c`),baseline);
assert.equal(sql(`select count(*)||':'||sum(quantity)||':'||(select count(*) from inventory_events) from inventory_items`),inventory);
assert.equal(sql('select count(*) from chaos_scan_private.capture_capacity'),'100');
deny(()=>command('csv',capture()),/SCAN_BATCH_FULL/);
const first=command('current').captures[0];
assert.equal(first.status,'RESERVED'); // An interrupted upload still counts until explicit removal.
const removed={id:first.capture_id,captureId:first.capture_id,batchId:a.id,quantity:1,cardName:'Never commit this removed card',humanState:'removed',processingState:'ready'};
const review={batchId:a.id,captureId:first.capture_id,item:removed,revision:0};
assert.equal(command('review',review).revision,1);
const tombstone=command('current').captures[0];
assert.equal(command('current').physicalCount,99);
assert.equal(command('review',review).revision,1); // stale retry is idempotent, no new revision
assert.deepEqual(command('current').captures[0],tombstone);
deny(()=>command('review',{...review,item:{...removed,humanState:'confirmed'},revision:1}),/SCAN_CAPTURE_REMOVED_IMMUTABLE/);

// Independent connections, not the serialized browser-fixture adapter.
const contenders=Array.from({length:12},capture);
const results=await Promise.all(contenders.map(p=>new Promise(resolve=>{
 const child=spawn('docker',args(database)); let out='',err='';
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
 child.on('close',code=>resolve({code,out,err})); child.stdin.end(as(query('csv',p)));
})));
assert.equal(results.filter(r=>r.code===0).length,1);
assert.equal(results.filter(r=>r.code!==0 && /SCAN_BATCH_FULL/.test(r.err)).length,11);
const snapshot=command('current');
assert.equal(snapshot.physicalCount,100);assert.equal(snapshot.captures.length,101);
const replacement=snapshot.captures.at(-1);
assert.equal(replacement.ordinal,101);assert.notEqual(replacement.capture_id,first.capture_id);
assert.deepEqual(snapshot.captures[0],tombstone);
assert.equal(sql('select count(*) from chaos_scan_private.capture_capacity'),'100');
deny(()=>command('review',{...review,item:{...removed,humanState:'confirmed'},revision:1}),/SCAN_CAPTURE_REMOVED_IMMUTABLE/);
// Trusted direct writes still cannot bypass capacity, change identity, or erase history.
deny(()=>sql(as(`reset role;insert into public.chaos_scan_captures(capture_id,album_id,user_id,ordinal,sha256,source_kind,status) values(gen_random_uuid(),'${a.id}','${owner}',102,repeat('a',64),'csv','RECEIVED')`)),/SCAN_BATCH_FULL/);
deny(()=>sql(as(`reset role;update public.chaos_scan_captures set status='RECEIVED' where capture_id='${first.capture_id}'`)),/SCAN_CAPTURE_REMOVED_IMMUTABLE/);
deny(()=>sql(as(`reset role;delete from public.chaos_scan_captures where capture_id='${first.capture_id}'`)),/SCAN_CAPTURE_HISTORY_IMMUTABLE/);
deny(()=>sql(as(`reset role;update public.chaos_scan_captures set ordinal=200 where capture_id='${replacement.capture_id}'`)),/SCAN_CAPTURE_IDENTITY_IMMUTABLE/);
deny(()=>command('snapshot',{batchId:a.id},other),/SCAN_UNAUTHORIZED/);
deny(()=>sql(`begin;set local role anon;${query('snapshot',{batchId:a.id})};commit;`),/permission denied|SCAN_UNAUTHORIZED/);
deny(()=>sql(as('select * from chaos_scan_private.capture_capacity')),/permission denied/);
assert.equal(sql("select relrowsecurity from pg_class where oid='public.chaos_scan_captures'::regclass"),'t');
// Review only kept captures, then prove removed identity is absent from inventory.
sql(as(snapshot.captures.filter(c=>c.status!=='REMOVED').map(c=>query('review',{batchId:a.id,captureId:c.capture_id,revision:c.revision,item:{id:c.capture_id,captureId:c.capture_id,batchId:a.id,quantity:1,intakeSource:'csv',cardName:'Kept fixture card',setCode:'KTK',collectorNumber:'204',condition:'NM',finish:'nonfoil',language:'en',gameId:'magic',humanState:'confirmed',recognitionState:'high_confidence',processingState:'ready'}})).join(';')));
assert.equal(command('commit',{batchId:a.id}).committedCount,100);
assert.equal(sql(`select sum(quantity) from inventory_items where user_id='${owner}'`),'100');
assert.equal(sql(`select count(*) from inventory_items where user_id='${owner}' and to_jsonb(inventory_items)::text like '%Never commit%'`),'0');
assert.equal(sql(`select physical_card_count from chaos_sort_batches where id='${a.id}'`),'100');
assert.deepEqual(command('current').captures[0],tombstone);
deny(()=>command('review',review),/SCAN_BATCH_CLOSED/);
assert.equal(sql(`select count(*) from inventory_events where user_id='${owner}'`),'100');
console.log(JSON.stringify({status:'PASS',database,active:100,lifetime:101,removed:1,racingRequests:12,accepted:1,committed:100,inventoryBeforeMigrationUnchanged:true,security:'owner/cross-tenant/anonymous/private slots/RLS passed'}));
