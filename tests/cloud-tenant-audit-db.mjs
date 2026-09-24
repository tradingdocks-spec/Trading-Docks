// Explicit isolated Supabase restore only. Never accepts a production connection URL.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='supabase_db_trading-docks-recovery-test';
const state=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.deepEqual(state.NetworkSettings.Networks,{});
assert.match(state.Config.Image,/supabase\/postgres:17\./);
const database='tenant_audit_'+Date.now();
const normalizationOnly=process.argv.includes('--normalization-only');
const repair=process.argv.includes('--repair');
const resultFile=repair?'.local-fixtures/cloud-tenant-repair-test-results.json':normalizationOnly?'.local-fixtures/cloud-tenant-normalization-results.json':'.local-fixtures/cloud-tenant-test-results.json';
const sql=(q,db=database)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}).trim();
const results=[];
process.on('exit',()=>writeFileSync(resultFile,JSON.stringify({database,results},null,2)));
const check=(name,actual,expected)=>{results.push({name,actual,expected,pass:actual===expected});console.log(`${actual===expected?'PASS':'FAIL'} ${name}`);};
const error=f=>{try{return f();}catch(e){return String(e.stderr||e).split('\n').find(x=>x.includes('ERROR:'))||'ERROR';}};
const noRows=f=>{const result=error(f);return result==='0'||/permission denied/.test(result);};
sql(`create database ${database} template chaos_release_rehearsal_20260923`,'template1');
if(repair){
 const draft=JSON.parse(readFileSync('.local-fixtures/tenant-repair-production-draft.json','utf8'));
 const quote=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 sql(`begin;set local request.jwt.claim.sub='${draft.batch.user_id}';insert into chaos_scan_albums select (jsonb_populate_record(null::chaos_scan_albums,${quote(draft.album)})).*;insert into chaos_sort_batches select (jsonb_populate_record(null::chaos_sort_batches,${quote(draft.batch)})).*;update chaos_scan_private.batch_counters set last_number=23 where owner_id='${draft.batch.user_id}';commit;`);
}
const fingerprint=()=>sql(`select jsonb_build_object('inventory',(select md5(string_agg(to_jsonb(i)::text,',' order by user_id,id)) from inventory_items i),'events',(select md5(string_agg(to_jsonb(e)::text,',' order by id)) from inventory_events e),'positions',(select md5(string_agg(to_jsonb(p)::text,',' order by id)) from chaos_sort_inventory_positions p),'batches',(select md5(string_agg((to_jsonb(b)-'workspace_id')::text,',' order by id)) from chaos_sort_batches b),'guard',pg_get_functiondef('chaos_scan_private.guard_batch()'::regprocedure),'policies',(select md5(string_agg(to_jsonb(p)::text,',' order by schemaname,tablename,policyname)) from pg_policies p))`);
const before=fingerprint();
const migration=readFileSync('supabase/migrations/20260924005111_chaos_legacy_workspace_normalization.sql','utf8');
const body=migration.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
check('normalization rejects missing position evidence',/NORMALIZATION_AMBIGUOUS_OR_UNRESOLVED/.test(error(()=>sql(`begin;delete from chaos_sort_inventory_positions where batch_id=(select id from chaos_sort_batches order by batch_code limit 1);${body}rollback;`))),true);
check('failed normalization rolled back',fingerprint(),before);
check('browser role cannot invoke normalization',/permission denied/.test(error(()=>sql(`begin;set local role authenticated;${body}rollback;`))),true);
sql(migration);
check('normalization preserves all rows except batch workspace, guard and RLS',fingerprint(),before);
check('normalized legacy batches plus existing cloud draft',sql('select count(*) from chaos_sort_batches where workspace_id is not null'),repair?'23':'22');
check('inventory count preserved',sql('select count(*) from inventory_items'),'1515');
check('inventory quantity preserved',sql('select sum(quantity) from inventory_items'),'1778');
check('event count preserved',sql('select count(*) from inventory_events'),'1563');
check('health findings after normalization',sql(`select count(*) from (${readFileSync('tests/cloud-tenant-integrity.sql','utf8').replace(/;\s*$/,'')}) h where check_name not in ('inventory_rows','inventory_quantity') and actual<>0`),'0');
if(normalizationOnly)process.exit(results.every(x=>x.pass)?0:1);
if(repair){
 const old=JSON.parse(fingerprint());delete old.policies;
 sql(readFileSync('supabase/migrations/20260924013600_cloud_active_workspace_authority.sql','utf8'));
 const after=JSON.parse(fingerprint());delete after.policies;
 check('tenancy DDL preserves all business rows',JSON.stringify(after),JSON.stringify(old));
}
const owner='11111111-1111-4111-8111-111111111171',other='11111111-1111-4111-8111-111111111172',member='11111111-1111-4111-8111-111111111173';
sql(`insert into auth.users(id,email) values('${owner}','tenant-owner@example.invalid'),('${other}','tenant-other@example.invalid'),('${member}','tenant-member@example.invalid');
update user_preferences set active_workspace_id=(select workspace_id from workspace_members where user_id=user_preferences.user_id limit 1) where user_id in ('${owner}','${other}','${member}');`);
const ws=actor=>sql(`select id from workspaces where owner_id='${actor}'`);
const a=ws(owner),b=ws(other),a2=crypto.randomUUID();
sql(`insert into workspaces(id,name,owner_id) values('${a2}','Second owner workspace','${owner}');insert into workspace_members(workspace_id,user_id,role) values('${a2}','${owner}','owner'),('${a}','${member}','member') on conflict do nothing;`);
const as=(q,actor=owner,role='authenticated')=>`begin;set local request.jwt.claim.sub='${actor}';set local role ${role};${q};commit;`;
const active=(actor,w)=>sql(as(`update user_preferences set active_workspace_id='${w}' where user_id='${actor}'`,actor));
sql(as(`insert into inventory_locations(id,user_id,name) values('tenant-a-box','${owner}','Tenant A box');
insert into inventory_items(id,user_id,workspace_id,card_name,quantity,game_id,location_id,data) values('tenant-a-item','${owner}','${a}','Scavenger A',3,'magic','tenant-a-box','{}')`));
active(owner,a2);
sql(as(`insert into inventory_items(id,user_id,workspace_id,card_name,quantity,game_id,location_id,data) values('tenant-a2-item','${owner}','${a2}','Scavenger A2',3,'magic','tenant-a-box','{}')`));
active(owner,a);
check('owner A reads A',sql(as(`select count(*) from inventory_items where id='tenant-a-item'`)),'1');
check('owner active A cannot read own A2 (required)',sql(as(`select count(*) from inventory_items where id='tenant-a2-item'`)),'0');
active(owner,a2);
check('owner active A2 cannot read own A (required)',sql(as(`select count(*) from inventory_items where id='tenant-a-item'`)),'0');
active(owner,a);active(member,a);
check('authorized A member reads A',sql(as(`select count(*) from inventory_items where id='tenant-a-item'`,member)),'1');
check('A member cannot read unrelated A2',sql(as(`select count(*) from inventory_items where id='tenant-a2-item'`,member)),'0');
check('B outsider cannot read A',sql(as(`select count(*) from inventory_items where id='tenant-a-item'`,other)),'0');
check('anonymous cannot read A',noRows(()=>sql(as(`select count(*) from inventory_items where id='tenant-a-item'`,'','anon'))),true);
for(const actor of [other,member]){
 check(`${actor===other?'outsider':'member'} cannot update A inventory`,noRows(()=>sql(as(`with changed as(update inventory_items set quantity=2 where id='tenant-a-item' returning id) select count(*) from changed`,actor))),true);
 check(`${actor===other?'outsider':'member'} removal denied`,/ERROR/.test(error(()=>sql(as(`select remove_inventory_lot_quantity('tenant-a-item',1,'audit','audit')`,actor)))),true);
}
const command=(action,payload,actor=owner)=>JSON.parse(sql(as(`select chaos_scan_command('${action}','${JSON.stringify(payload)}'::jsonb)`,actor)));
const album=command('create',{requestId:crypto.randomUUID(),destinationId:'tenant-a-box',workspaceId:b,intakeMode:'upload'});
check('browser foreign workspace ignored; server uses authorized A',album.workspace_id,a);
check('second independent connection recovers same draft',command('current',{}).album.id,album.id);
const capture=command('reserve',{batchId:album.id,captureId:crypto.randomUUID(),sha256:'a'.repeat(64)});
check('outsider capture denied',/SCAN_UNAUTHORIZED/.test(error(()=>command('reserve',{batchId:album.id,captureId:crypto.randomUUID(),sha256:'b'.repeat(64)},other))),true);
check('member capture denied',/SCAN_UNAUTHORIZED/.test(error(()=>command('reserve',{batchId:album.id,captureId:crypto.randomUUID(),sha256:'b'.repeat(64)},member))),true);
check('outsider cannot create batch in A location',/SCAN_LOCATION_INVALID/.test(error(()=>command('create',{requestId:crypto.randomUUID(),destinationId:'tenant-a-box',workspaceId:a},other))),true);
const path=capture.object_path||capture.objectPath;
assert.ok(path,'reserved capture has object path');
check('bucket private',sql("select public from storage.buckets where id='chaos-scans'"),'f');
sql(as(`insert into storage.objects(bucket_id,name,owner_id) values('chaos-scans','${path}','${owner}')`));
check('owner reads scan object',sql(as(`select count(*) from storage.objects where bucket_id='chaos-scans' and name='${path}'`)),'1');
for(const actor of [other,member,'']){
 const role=actor?'authenticated':'anon';
 check(`${actor||'anonymous'} scan read denied`,noRows(()=>sql(as(`select count(*) from storage.objects where bucket_id='chaos-scans' and name='${path}'`,actor,role))),true);
 check(`${actor||'anonymous'} scan upload denied`,/ERROR/.test(error(()=>sql(as(`insert into storage.objects(bucket_id,name) values('chaos-scans','${path}.foreign')`,actor,role)))),true);
}
active(owner,a2);
check('same owner other active workspace scan read denied',sql(as(`select count(*) from storage.objects where bucket_id='chaos-scans' and name='${path}'`)),'0');
check('same owner other active workspace capture denied',/SCAN_UNAUTHORIZED/.test(error(()=>command('reserve',{batchId:album.id,captureId:crypto.randomUUID(),sha256:'b'.repeat(64)}))),true);
for(const actor of [other,member]){
 check(`${actor===other?'outsider':'member'} label RPC denied`,/ERROR/.test(error(()=>sql(as(`select label_targets('${a}',array['tenant-a-item'],null,null,false)`,actor)))),true);
 check(`${actor===other?'outsider':'member'} barcode aliases inaccessible`,noRows(()=>sql(as(`select count(*) from inventory_barcode_aliases where workspace_id='${a}'`,actor))),true);
}
check('POS remains disabled',sql('select count(*) from pos_workspace_settings where enabled'),'0');
writeFileSync(resultFile,JSON.stringify({database,results},null,2));
console.log(JSON.stringify({database,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.name)}));
if(results.some(x=>!x.pass))process.exitCode=1; // Expected audit findings must not be labelled a green security suite.
