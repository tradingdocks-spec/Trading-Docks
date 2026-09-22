// Isolated Supabase recovery clone only. No hosted connections or credentials.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='supabase_db_trading-docks-recovery-test';
const db='collector_removal_rehearsal';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
const state=JSON.parse(docker('inspect',container))[0];
assert.match(state.Config.Image,/supabase\/postgres:17\./);
assert.deepEqual(state.NetworkSettings.Networks,{});
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
const fingerprint=()=>sql(`select md5(string_agg(h,'' order by h)) from (
 select md5(to_jsonb(i)::text) h from public.inventory_items i union all
 select md5(to_jsonb(i)::text) from public.inventory_events i union all
 select md5(to_jsonb(i)::text) from public.chaos_sort_inventory_positions i union all
 select md5(to_jsonb(i)::text) from public.chaos_sort_batches i union all
 select md5(to_jsonb(i)::text) from public.chaos_sort_sessions i) t;`).trim();
const before=fingerprint();
const guards=()=>sql(`select md5(string_agg(pg_get_functiondef(oid),'' order by oid)) from pg_proc
 where oid in ('public.enforce_collector_inventory_mutation()'::regprocedure,'pos_private.check_stock()'::regprocedure);
 select md5(string_agg(to_jsonb(p)::text,'' order by schemaname,tablename,policyname)) from pg_policies p;
 select count(*) from public.pos_workspace_settings where enabled;`).trim();
const security=guards();
// Reinstate the original definition in this disposable clone to prove the failure.
let old=readFileSync('supabase/migrations/202608260001_collection_location_authority.sql','utf8');
old=old.slice(old.indexOf('create or replace function public.remove_inventory_lot_quantity('),old.indexOf('revoke all on function public.move_inventory_lot_quantity'));
sql(old);
const reproduction=`
do $test$ declare i public.inventory_items%rowtype; begin
 select x.* into strict i from public.inventory_items x where x.card_name='Weather Maker' and x.quantity=1
 and exists(select 1 from public.chaos_sort_inventory_positions p where p.user_id=x.user_id and p.item_id=x.id and p.quantity=2);
 perform set_config('request.jwt.claim.sub',i.user_id::text,true);
 begin
  perform public.remove_inventory_lot_quantity(i.id,1,'Local reproduction','local-original-repro');
  set constraints all immediate;
  raise exception 'EXPECTED_OLD_FAILURE';
 exception when others then if sqlerrm<>'POS_STOCK_UNAVAILABLE' then raise; end if; end;
 insert into public.inventory_items(id,user_id,workspace_id,location_id,card_name,quantity,data)
 values('old-manual-control',i.user_id,i.workspace_id,i.location_id,'Synthetic manual control',1,'{}');
 perform public.remove_inventory_lot_quantity('old-manual-control',1,'Local control','local-old-manual');
 set constraints all immediate;
 if (select quantity from public.inventory_items where user_id=i.user_id and id='old-manual-control')<>0 then raise exception 'MANUAL_CONTROL_FAILED'; end if;
end $test$;`;
sql('begin;'+reproduction+'rollback;');
console.log('PASS original RPC reproduces POS_STOCK_UNAVAILABLE on exact restored affected row; rollback');
console.log('PASS original RPC succeeds for same-owner unpositioned manual control');
sql(readFileSync('supabase/migrations/20260922212715_collector_removal_position_authority.sql','utf8'));
assert.equal(fingerprint(),before,'Definition-only migration must not change data');
assert.equal(guards(),security,'RLS, authorization, stock guard and POS enablement unchanged');
console.log('PASS migration changes no inventory/history data, RLS or guards');
console.log(sql(readFileSync('tests/collector-removal-rehearsal.sql','utf8')));
// Reuse the actual delegated cash security fixture, with an extra general-removal
// denial immediately after the real site-scoped delegation is granted.
let delegated=readFileSync('tests/pos-forward-installation.sql','utf8')
 .replace("current_database()<>'pos_install_rehearsal'", "current_database()<>'collector_removal_rehearsal'");
const marker="staff_session:=public.pos_command(w,'open'";
assert.ok(delegated.includes(marker));
delegated=delegated.replace(marker,`begin
  perform public.remove_inventory_lot_quantity('forward-test-stock',1,'Forbidden delegated removal','local-delegated-denial');
  raise exception 'DELEGATION_BECAME_COLLECTION_REMOVAL';
 exception when no_data_found then null; end;
 ${marker}`);
sql(delegated);
console.log('PASS existing POS cash/security fixture plus delegated employee general-removal denial; all fixtures rolled back');
assert.equal(fingerprint(),before,'All test mutations must roll back');
assert.equal(guards(),security);
console.log('PASS full data fingerprints restored after test rollback; POS remains disabled');
