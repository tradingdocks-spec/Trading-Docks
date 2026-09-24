// Follow-up to cloud-tenant-audit-db.mjs; mutations are rolled back, isolated DB only.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const repair=process.argv.includes('--repair');
const prior=JSON.parse(readFileSync(repair?'.local-fixtures/cloud-tenant-repair-test-results.json':'.local-fixtures/cloud-tenant-test-results.json','utf8'));
assert.match(prior.database,/^tenant_audit_[0-9]+$/);
const container='supabase_db_trading-docks-recovery-test';
assert.deepEqual(JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].NetworkSettings.Networks,{});
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',prior.database,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}).trim();
const owner='11111111-1111-4111-8111-111111111171',other='11111111-1111-4111-8111-111111111172',member='11111111-1111-4111-8111-111111111173';
const a=sql("select workspace_id from inventory_items where id='tenant-a-item'"),b=sql(`select id from workspaces where owner_id='${other}'`);
const a2=sql("select workspace_id from inventory_items where id='tenant-a2-item'");
const as=(q,actor=owner)=>`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;${q};rollback;`;
sql(`insert into admin_membership_overrides(user_id,plan_id,granted_by) values('${owner}','business','${owner}') on conflict do nothing;`);
const issued=sql(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;update user_preferences set active_workspace_id='${a}' where user_id='${owner}';select label_targets('${a}',array['tenant-a-item'],null,'',true);update user_preferences set active_workspace_id='${a2}' where user_id='${owner}';commit;`);
assert.ok(JSON.parse(issued).length>0,'seed an actual label target; an empty table is not an isolation test');
const results=[];
const test=(name,q,predicate,actor=owner)=>{let actual;try{actual=sql(as(q,actor));}catch(e){actual=String(e.stderr||e).split('\n').find(x=>x.includes('ERROR:'));}const pass=predicate(actual);results.push({name,actual,pass});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
const denied=x=>/permission denied|POS_FORBIDDEN|SCAN_UNAUTHORIZED|TD_COLLECTOR_UNAUTHORIZED|INVENTORY_WORKSPACE_FORBIDDEN|Inventory item not found|Inventory lot not found/.test(x);
test('active A2 cannot mutate A asking price',"with changed as(update inventory_items set asking_price=0.77 where id='tenant-a-item' returning id) select count(*) from changed",x=>x==='0'||denied(x));
test('active A2 cannot remove A quantity',"select remove_inventory_lot_quantity('tenant-a-item',1,'Isolated audit','tenant-active-removal')",denied);
test('global owner/active quantity query cannot return A while A2 active',`select count(*) from inventory_items where user_id='${owner}' and quantity>0 and card_name ilike '%Scavenger A'`,x=>x==='0');
test('member active own workspace cannot read A',`update user_preferences set active_workspace_id=(select id from workspaces where owner_id='${member}') where user_id='${member}';select count(*) from inventory_items where id='tenant-a-item'`,x=>x==='0',member);
test('active A2 label identity reads cannot expose A',`select count(*) from inventory_label_identities where workspace_id='${a}'`,x=>x==='0'||denied(x));
test('forged active-workspace preference cannot authorize batch creation',`update user_preferences set active_workspace_id='${b}' where user_id='${owner}';select chaos_scan_command('create','{"requestId":"${crypto.randomUUID()}","destinationId":"tenant-a-box"}')`,denied);
test('outsider barcode RPC denied',`select pos_command('${a}','search','{"siteId":"${crypto.randomUUID()}","exact":true,"query":"tenant-a-item"}')`,denied,other);
test('member barcode RPC denied while POS disabled',`select pos_command('${a}','search','{"siteId":"${crypto.randomUUID()}","exact":true,"query":"tenant-a-item"}')`,x=>denied(x)||/POS_DISABLED/.test(x),member);
test('direct forged batch insert denied',`insert into chaos_sort_batches(id,user_id,workspace_id,batch_code) values('${crypto.randomUUID()}','${owner}','${b}','CS-999999')`,denied);
test('private barcode helper cannot be invoked',`select pos_private.resolve_barcode('${a}','${crypto.randomUUID()}','tenant-a-item')`,denied,other);
// A real RESERVED path (not a fabricated filename or an existing object).
// Each unauthorized caller targets an independently reserved, valid upload slot.
for(const actor of [other,member,'',owner]){
 const capture=JSON.parse(sql(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;
 update user_preferences set active_workspace_id='${a}' where user_id='${owner}';
 select chaos_scan_command('reserve',jsonb_build_object('batchId',(select id from chaos_scan_albums where user_id='${owner}' and workspace_id='${a}'),'captureId','${crypto.randomUUID()}','sha256',repeat('c',64)));
 update user_preferences set active_workspace_id='${a2}' where user_id='${owner}';commit;`));
 const path=capture.object_path||capture.objectPath;
 assert.ok(path);
 let actual;
 try{actual=sql(`begin;set local request.jwt.claim.sub='${actor}';set local role ${actor?'authenticated':'anon'};insert into storage.objects(bucket_id,name) values('chaos-scans','${path}');rollback;`);}catch(e){actual=String(e.stderr||e).split('\n').find(x=>x.includes('ERROR:'));}
 const pass=/row-level security policy|permission denied/.test(actual);
 const name=`valid reserved upload denied for ${actor===owner?'owner in inactive workspace':actor||'anonymous'}`;
 results.push({name,actual,pass});console.log(`${pass?'PASS':'FAIL'} ${name}`);
}
writeFileSync(repair?'.local-fixtures/cloud-tenant-repair-active-results.json':'.local-fixtures/cloud-tenant-active-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.name)}));
if(results.some(x=>!x.pass))process.exitCode=1;
