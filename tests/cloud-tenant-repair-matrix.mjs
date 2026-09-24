// Real role/RPC matrix. All fixtures and operation probes roll back.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {database}=JSON.parse(readFileSync('.local-fixtures/cloud-tenant-repair-test-results.json','utf8'));
assert.match(database,/^tenant_audit_[0-9]+$/);
const container='supabase_db_trading-docks-recovery-test';
assert.deepEqual(JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].NetworkSettings.Networks,{});
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000}).trim();
const owner='11111111-1111-4111-8111-111111111171',other='11111111-1111-4111-8111-111111111172',member='11111111-1111-4111-8111-111111111173',staff='11111111-1111-4111-8111-111111111174';
const ids=JSON.parse(sql(`select jsonb_build_object('a',(select workspace_id from inventory_items where id='tenant-a-item'),'b',(select workspace_id from inventory_items where id='tenant-a2-item'),'outside',(select id from workspaces where owner_id='${other}'),'album',(select id from chaos_scan_albums where user_id='${owner}'))`));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
let script=`begin;
insert into auth.users(id,email) values('${staff}','tenant-staff@example.invalid');
insert into workspace_members(workspace_id,user_id,role) values('${ids.b}','${staff}','member');
insert into workspace_employees(workspace_id,linked_user_id,full_name,created_by,permissions) values('${ids.b}','${staff}','Scoped test staff','${owner}','{"pos.sell":true,"pos.refund":true}');
insert into admin_membership_overrides(user_id,plan_id,granted_by) values('${owner}','business','${owner}') on conflict do nothing;
insert into pos_workspace_settings(workspace_id,enabled) values('${ids.a}',true),('${ids.b}',true) on conflict(workspace_id) do update set enabled=true;
create temp table matrix(name text,actual text,expected text,pass boolean);
create temp table fixture_refs(key text,value text);
grant select,insert on fixture_refs to authenticated,anon;
create function pg_temp.probe(n text,actor uuid,w uuid,q text,want text) returns void language plpgsql as $$
declare got text;
begin
 perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
 if actor is not null then execute 'set local role authenticated'; update public.user_preferences set active_workspace_id=w where user_id=actor;
 else execute 'set local role anon'; end if;
 begin
   execute q into got;
   raise exception using errcode='PZ001',message='rollback probe';
 exception when sqlstate 'PZ001' then null;
 when others then got:='ERROR:'||sqlstate||':'||sqlerrm; end;
 execute 'reset role';
 insert into matrix values(n,got,want,case when want='DENY' then got='0' or got='[]' or got ~ '(42501|POS_FORBIDDEN|INVENTORY_WORKSPACE_FORBIDDEN|SCAN_UNAUTHORIZED|TD_COLLECTOR_UNAUTHORIZED|row-level security)' else got=want end);
end $$;
set local request.jwt.claim.sub='${owner}';set local role authenticated;
update user_preferences set active_workspace_id='${ids.a}' where user_id='${owner}';
update inventory_items set asking_price=1 where id='tenant-a-item';
insert into fixture_refs values('siteA',pos_command('${ids.a}','setup','{"name":"Tenant A","registerName":"Test","locationId":"tenant-a-box","taxBps":0}')->>'siteId');
select label_targets('${ids.a}',array['tenant-a-item'],null,'',true);
update user_preferences set active_workspace_id='${ids.b}' where user_id='${owner}';
insert into inventory_locations(id,user_id,name) values('tenant-b-box','${owner}','Tenant B box');
update inventory_items set asking_price=1,location_id='tenant-b-box' where id='tenant-a2-item';
insert into fixture_refs values('siteB',pos_command('${ids.b}','setup','{"name":"Tenant B","registerName":"Test","locationId":"tenant-b-box","taxBps":0}')->>'siteId');
select label_targets('${ids.b}',array['tenant-a2-item'],null,'',true);
insert into fixture_refs select 'skuB',sku from inventory_label_identities where inventory_item_id='tenant-a2-item' limit 1;
select pos_command('${ids.b}','grant',jsonb_build_object('key',gen_random_uuid(),'siteId',(select value::uuid from pg_temp.fixture_refs where key='siteB'),'employeeId','${staff}','capabilities',jsonb_build_array('sell','return')));
reset role;
create function pg_temp.remove_and_verify(item text) returns text language plpgsql as $$
declare q integer; events bigint; outcome jsonb;
begin
 select quantity into q from inventory_items where id=item and user_id=auth.uid();
 select count(*) into events from inventory_events where inventory_item_id=item and user_id=auth.uid();
 outcome:=remove_inventory_lot_quantity(item,1,'Isolated tenancy matrix',gen_random_uuid()::text);
 if (select quantity from inventory_items where id=item and user_id=auth.uid())<>q-1 then raise exception 'TEST_QUANTITY'; end if;
 if (select count(*) from inventory_events where inventory_item_id=item and user_id=auth.uid())<>events+1 then raise exception 'TEST_EVENT'; end if;
 if exists(select 1 from chaos_sort_inventory_positions where item_id=item and user_id=auth.uid() and quantity<>q-1) then raise exception 'TEST_POSITION'; end if;
 return 'OK';
end $$;
`;
function probe(name,actor,workspace,q,expected){script+=`select pg_temp.probe(${quote(name)},${actor?quote(actor)+'::uuid':'null'},'${workspace}',${quote(q)},${quote(expected)});\n`;}
for(const [name,actor,w,read,own] of [['owner A',owner,ids.a,true,true],['member A',member,ids.a,true,false],['delegated B active A',staff,ids.a,false,false],['same owner active B',owner,ids.b,false,false],['unrelated',other,ids.outside,false,false],['anonymous',null,ids.a,false,false]]){
 probe(name+' inventory read',actor,w,"select count(*)::text from inventory_items where id='tenant-a-item'",read?'1':'DENY');
 probe(name+' global exact SKU/query',actor,w,`select count(*)::text from inventory_items where id='tenant-a-item' and user_id=auth.uid() and quantity>0`,own?'1':'DENY');
 probe(name+' price mutation',actor,w,"with changed as(update inventory_items set asking_price=2 where id='tenant-a-item' returning id) select count(*)::text from changed",own?'1':'DENY');
 probe(name+' removal',actor,w,"select pg_temp.remove_and_verify('tenant-a-item')",own?'OK':'DENY');
 probe(name+' label targets',actor,w,`select jsonb_array_length(label_targets('${ids.a}',array['tenant-a-item'],null,'',false))::text`,own?'1':'DENY');
 probe(name+' Chaos history',actor,w,`select count(*)::text from jsonb_array_elements(chaos_batch_history()) x where x->>'id'='${ids.album}'`,own?'1':'DENY');
 probe(name+' album read',actor,w,`select count(*)::text from chaos_scan_albums where id='${ids.album}'`,own?'1':'DENY');
 probe(name+' exact barcode',actor,w,`select jsonb_array_length(pos_command('${ids.a}','search',jsonb_build_object('siteId',(select value::uuid from pg_temp.fixture_refs where key='siteA'),'exact',true,'query',(select sku from inventory_label_identities where inventory_item_id='tenant-a-item' limit 1))))::text`,own?'1':'DENY');
}
probe('owner B visible after switch',owner,ids.b,"select count(*)::text from inventory_items where id='tenant-a2-item'",'1');
probe('owner B pricing after switch',owner,ids.b,"with changed as(update inventory_items set asking_price=2 where id='tenant-a2-item' returning id) select count(*)::text from changed",'1');
probe('owner B removal after switch',owner,ids.b,"select pg_temp.remove_and_verify('tenant-a2-item')",'OK');
probe('delegated B search works in B',staff,ids.b,`select jsonb_array_length(pos_command('${ids.b}','search',jsonb_build_object('siteId',(select value::uuid from pg_temp.fixture_refs where key='siteB'),'query','Scavenger')))::text`,'1');
probe('delegated B exact barcode works in B',staff,ids.b,`select jsonb_array_length(pos_command('${ids.b}','search',jsonb_build_object('siteId',(select value::uuid from pg_temp.fixture_refs where key='siteB'),'exact',true,'query',(select value from pg_temp.fixture_refs where key='skuB'))))::text`,'1');
probe('delegated B search denied with A active',staff,ids.a,`select pos_command('${ids.b}','search',jsonb_build_object('siteId',(select value::uuid from pg_temp.fixture_refs where key='siteB'),'query','Scavenger'))::text`,'DENY');
probe('delegation never grants collection removal',staff,ids.b,"select pg_temp.remove_and_verify('tenant-a2-item')",'DENY');
probe('delegation never grants price mutation',staff,ids.b,"with changed as(update inventory_items set asking_price=2 where id='tenant-a2-item' returning id) select count(*)::text from changed",'DENY');
probe('wrong-workspace insert blocked',owner,ids.a,`insert into inventory_items(id,user_id,workspace_id,card_name,quantity,game_id) values('wrong-scope','${owner}','${ids.b}','Wrong',1,'magic') returning id`,'DENY');
probe('overwrite scan denied',owner,ids.a,`with changed as(update storage.objects set metadata='{}' where bucket_id='chaos-scans' and name in(select object_path from chaos_scan_captures where album_id='${ids.album}') returning id) select count(*)::text from changed`,'DENY');
script+=`select jsonb_agg(to_jsonb(matrix)) from matrix;rollback;`;
const output=sql(script).split('\n');
const results=JSON.parse(output.at(-1));
writeFileSync('.local-fixtures/cloud-tenant-repair-matrix.json',JSON.stringify(results,null,2));
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.pass?'':' '+r.actual}`);
console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}));
if(results.some(r=>!r.pass))process.exitCode=1;
