// Local, network-isolated recovery clone only. Never accepts a remote URL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const container='supabase_db_trading-docks-recovery-test';
const state=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(state.State.Running,true);
assert.match(state.Config.Image,/supabase\/postgres:17\./);
assert.deepEqual(state.NetworkSettings.Networks,{});
const database='acquisition_rehearsal_'+Date.now();
const sql=(query,db=database)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['pipe','pipe','pipe']}).trim();
sql(`create database ${database} template collector_removal_rehearsal;`,'template1');
// Bring only this disposable clone to the previously reviewed cloud baseline.
for(const name of ['20260923204804_chaos_scan_albums_v2.sql','20260924000100_chaos_cloud_authority.sql','20260924005111_chaos_legacy_workspace_normalization.sql','20260924013600_cloud_active_workspace_authority.sql','20260924043103_chaos_intake_mode_switch.sql','20260924220000_chaos_active_capture_capacity.sql']) {
 sql(readFileSync('supabase/migrations/'+name,'utf8'));
}
const owner=randomUUID(),other=randomUUID(),draft=randomUUID(),line=randomUUID();
const counts=()=>sql(`select jsonb_build_object('items',(select count(*) from inventory_items where user_id<>'${owner}'),'units',(select sum(quantity) from inventory_items where user_id<>'${owner}'),'events',(select count(*) from inventory_events where user_id<>'${owner}'),'batches',(select count(*) from chaos_sort_batches where user_id<>'${owner}'))`);
const before=counts();
const migration=readFileSync('supabase/migrations/20260924235138_acquisition_purchase_authority.sql','utf8');
sql(migration);sql(migration);assert.equal(counts(),before);
sql(`insert into auth.users(id,email) values('${owner}','acquisition-${owner}@example.invalid'),('${other}','acquisition-${other}@example.invalid');
update public.user_preferences set active_workspace_id=(select workspace_id from public.workspace_members where user_id='${owner}' limit 1) where user_id='${owner}';`);
const asOwner=query=>sql(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;${query};commit;`);
const input={id:draft,revision:0,title:'Synthetic acquisition',status:'offer_ready',items:[{id:line,cardName:'Synthetic Card',gameId:'magic',productType:'card',setCode:'TST',collectorNumber:'1',condition:'NM',finish:'nonfoil',language:'English',quantity:2,unitMarketValue:3,reviewState:'ready'}]};
asOwner(`select save_collection_intake('${JSON.stringify(input)}'::jsonb)`);
const result=JSON.parse(asOwner(`select finalize_intake_purchase('${draft}',4,'${draft}',true,null)`));
assert.equal(result.status,'received');
assert.equal(JSON.parse(asOwner(`select finalize_intake_purchase('${draft}',4,'${draft}',true,null)`)).purchaseId,result.purchaseId);
const evidence=JSON.parse(asOwner(`select jsonb_build_object('items',(select count(*) from inventory_items where user_id=auth.uid()),'units',(select sum(quantity) from inventory_items where user_id=auth.uid()),'unscoped',(select count(*) from inventory_items where user_id=auth.uid() and workspace_id is distinct from current_inventory_workspace()),'events',(select count(*) from inventory_events where user_id=auth.uid()),'purchases',(select count(*) from purchase_ledger where user_id=auth.uid()),'links',(select count(*) from purchase_inventory_links where inventory_user_id=auth.uid()),'cost',(select sum(total_cost) from purchase_ledger where user_id=auth.uid()))`));
assert.deepEqual(evidence,{items:1,units:2,unscoped:0,events:1,purchases:1,links:1,cost:4});
assert.throws(()=>sql(`begin;set local request.jwt.claim.sub='${other}';set local role authenticated;select finalize_intake_purchase('${draft}',4,'${draft}',true,null);commit;`));
assert.throws(()=>sql(`begin;set local role anon;select finalize_intake_purchase('${draft}',4,'${draft}',true,null);commit;`));
assert.equal(counts(),before);
console.log('PASS Supabase 17.6 recovery-clone migration replay, owner receipt, stable retry, workspace scope, event/link/cost, cross-tenant/anonymous denial; existing inventory/event/batch totals unchanged.');
console.log('Retained disposable database: '+database);
