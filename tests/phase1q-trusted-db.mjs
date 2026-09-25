import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateChaosCommitItem, validateChaosCommitSnapshot, chaosCommitClaim } from '../src/lib/chaos-sort/trusted-commit.ts';
import { randomUUID } from 'node:crypto';
const container='supabase_db_trading-docks-recovery-test';
const state=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.deepEqual(state.NetworkSettings.Networks,{}); assert.match(state.Config.Image,/supabase\/postgres:17\./);
const database='phase1q_'+Date.now();
const sql=(q,db=database)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000}).trim();
sql(`create database ${database} template collector_removal_rehearsal`,'template1');
try {
 for (const file of ['20260923204804_chaos_scan_albums_v2.sql','20260924000100_chaos_cloud_authority.sql','20260924005111_chaos_legacy_workspace_normalization.sql','20260924013600_cloud_active_workspace_authority.sql','20260925024439_inventory_mutation_idempotency.sql','20260925150035_inventory_lot_command_receipts.sql','20260924043103_chaos_intake_mode_switch.sql','20260924220000_chaos_active_capture_capacity.sql','20260925152512_inventory_manifest_receipts.sql','20260925152513_chaos_trusted_commit_receipts.sql']) sql(readFileSync('supabase/migrations/'+file,'utf8'));
 const owner=randomUUID(); sql(`insert into auth.users(id,email) values('${owner}','phase1p@example.invalid');update user_preferences set active_workspace_id=(select workspace_id from workspace_members where user_id='${owner}' limit 1) where user_id='${owner}';`);
 const as=q=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);${q};commit;`;
 const run=q=>sql(as(q)).split('\n').at(-1);
 const wid=run('select current_inventory_workspace()');
 run(`insert into inventory_items(id,user_id,workspace_id,card_name,quantity,data) values('p-lot','${owner}','${wid}','Synthetic lot',10,'{}')`);
 const removal=(qty,key,reason='Disposition')=>JSON.parse(run(`select remove_inventory_lot_quantity('p-lot',${qty},'${reason}','${key}')`));
 const qty=()=>Number(sql("select quantity from inventory_items where id='p-lot'"));
 const a=removal(3,'A');assert.equal(qty(),7);assert.equal(a.operationId,'A');assert.equal(a.user_id,owner);assert.equal(a.workspace_id,wid);
 assert.deepEqual(removal(3,'A'),a);assert.equal(qty(),7);removal(2,'B');assert.equal(qty(),5);assert.deepEqual(removal(3,'A'),a);assert.equal(qty(),5);
 assert.throws(()=>removal(2,'A'),/IDEMPOTENCY_CONFLICT/);assert.throws(()=>removal(3,'A','Different reason'),/IDEMPOTENCY_CONFLICT/);assert.equal(qty(),5);
 assert.equal(sql("select count(*)||':'||sum(quantity_change) from inventory_events where inventory_item_id='p-lot'"),'2:-5');
 const box=randomUUID();run(`insert into inventory_locations(id,user_id,name) values('${box}','${owner}','Synthetic box')`);
 const move=()=>JSON.parse(run(`select move_inventory_lot_quantity('p-lot',2,'${box}','MOVE')`));
 const m=move();assert.equal(qty(),3);assert.deepEqual(move(),m);assert.equal(qty(),3);
 assert.equal(sql(`select quantity from inventory_items where id='${m.destinationItemId}'`),'2');
 assert.throws(()=>run(`select move_inventory_lot_quantity('p-lot',1,'${box}','MOVE')`),/IDEMPOTENCY_CONFLICT/);
 const fresh=randomUUID(), key=randomUUID();
 const row={id:fresh,user_id:owner,workspace_id:wid,card_name:'Synthetic append',quantity:3,inventory_value:30,asking_price:11.99,data:{}};
 const append=r=>JSON.parse(run(`select to_jsonb(create_inventory_item_with_event('${JSON.stringify(r)}'::jsonb,'manual','${key}','manual_fixture','manifest'))`));
 const receipt=append(row); assert.equal(Number(receipt.asking_price),11.99); assert.deepEqual(append(row),receipt);
 run(`select apply_collector_inventory_mutation('${fresh}','quantity',7,null,null,null,'later-edit','manual')`);
 assert.deepEqual(append(row),receipt); assert.equal(sql(`select quantity from inventory_items where id='${fresh}'`),'7');
 assert.throws(()=>append({...row,quantity:4}),/IDEMPOTENCY_CONFLICT/);
 assert.equal(sql(`select count(*) from inventory_events where inventory_item_id='${fresh}' and idempotency_key='${key}'`),'1');

 const json=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
 const mid=randomUUID();
 const child=(name,q)=>({version:1,operationId:`${mid}:${name}`,userId:owner,workspaceId:wid,createdAt:'transport',inventoryItemId:name,endpoint:'create_inventory_item_with_event',args:{p_inventory:{id:name,user_id:owner,workspace_id:wid,card_name:name,quantity:q,data:{}},p_source:'csv_import',p_related_entity_type:'inventory_append',p_related_entity_id:mid,p_idempotency_key:`${mid}:${name}`}});
 const manifest={version:1,purpose:'append_import',userId:owner,workspaceId:wid,commands:[child('manifest-A',2),child('manifest-B',4)]};
 const send=m=>JSON.parse(run(`select apply_inventory_manifest('${mid}',${json(m)})`));
 const first=send(manifest);assert.equal(first.committed,true);assert.equal(first.results.length,2);
 assert.throws(()=>run(`select create_inventory_item_with_event(${json({...manifest.commands[0].args.p_inventory,id:'extra-child'})},'csv_import','extra-child','inventory_append','${mid}')`),/MANIFEST_PARENT_REQUIRED/);
 assert.throws(()=>run(`select create_inventory_item_with_event(${json(manifest.commands[0].args.p_inventory)},'csv_import','${manifest.commands[0].operationId}','inventory_append','${mid}')`),/MANIFEST_PARENT_REQUIRED/);

 run("select apply_collector_inventory_mutation('manifest-A','quantity',9,null,null,null,'manifest-later','manual')");
 assert.deepEqual(send({...manifest,commands:[...manifest.commands].reverse()}),first);
 assert.equal(sql("select quantity from inventory_items where id='manifest-A'"),'9');
 const changed=structuredClone(manifest);changed.commands[0].args.p_inventory.quantity=7;
 for(const m of [changed,{...manifest,version:2},{...manifest,commands:[]},{...manifest,reconcile:true},{...manifest,purpose:'bulk_remove'},{...manifest,commands:[...manifest.commands,child('new-child',1)]}]) assert.throws(()=>send(m),/MANIFEST_IDEMPOTENCY_CONFLICT/);
 assert.equal(sql("select count(*) from inventory_events where inventory_item_id in ('manifest-A','manifest-B')"),'3');
 const failed={...manifest,commands:[child('rollback-A',2),{...child('rollback-B',4),endpoint:'invalid'}]};
 failed.commands.forEach(c=>{c.args.p_related_entity_id='rollback';c.operationId='rollback:'+c.inventoryItemId;c.args.p_idempotency_key=c.operationId;});
 const failure=JSON.parse(run(`select apply_inventory_manifest('rollback',${json(failed)})`));assert.equal(failure.committed,false);assert.match(failure.error.message,/INVALID_MANIFEST_CHILD/);
 assert.deepEqual(JSON.parse(run(`select apply_inventory_manifest('rollback',${json(failed)})`)),failure);
 assert.throws(()=>run(`select apply_inventory_manifest('rollback',${json({...failed,commands:failed.commands.slice(0,1)})})`),/MANIFEST_IDEMPOTENCY_CONFLICT/);
 assert.equal(sql("select count(*) from inventory_items where id like 'rollback-%'"),'0');
 assert.equal(sql("select count(*) from inventory_private.manifest_receipts where operation_id='rollback'"),'1');

 sql(`create sequence public.phase1q_transient;create function public.phase1q_transient_failure() returns trigger language plpgsql as $$begin if new.id='retry-B' and nextval('public.phase1q_transient')=1 then raise exception 'fixture transient' using errcode='40001';end if;return new;end$$;create trigger phase1q_transient before insert on inventory_items for each row execute function public.phase1q_transient_failure();`);
 const retry={...manifest,commands:[child('retry-A',2),child('retry-B',4)]};
 retry.commands.forEach(c=>{c.args.p_related_entity_id='retry';c.operationId='retry:'+c.inventoryItemId;c.args.p_idempotency_key=c.operationId;});
 const retryCall=()=>JSON.parse(run(`select apply_inventory_manifest('retry',${json(retry)})`));
 const transient=retryCall();assert.equal(transient.committed,false);assert.equal(transient.error.retryable,true);
 assert.equal(sql("select count(*) from inventory_items where id like 'retry-%'"),'0');
 assert.throws(()=>run(`select apply_inventory_manifest('retry',${json({...retry,commands:retry.commands.slice(0,1)})})`),/MANIFEST_IDEMPOTENCY_CONFLICT/);
 const recovered=retryCall();assert.equal(recovered.committed,true);assert.deepEqual(retryCall(),recovered);
 assert.equal(sql("select count(*) from inventory_events where inventory_item_id like 'retry-%'"),'2');
 console.log('PASS failed manifest receipts: immutable review outcome; transient retry atomically recovers without duplicates');
 console.log('PASS manifest: canonical order; full payload conflicts; stale replay; atomic child failure; receipts unchanged');
 const agentMode=process.argv.includes('--installed-agent');
 const album=JSON.parse(run(`select chaos_scan_command('create',${json({requestId:randomUUID(),destinationId:box,intakeMode:agentMode?'live':'csv'})})`));
 const capture=randomUUID();
 const item={id:capture,captureId:capture,batchId:album.id,quantity:1,humanState:'confirmed',processingState:'ready',recognitionState:'high_confidence',scryfallId:'a1111111-1111-4111-8111-111111111111',gameId:'magic',cardName:'Trusted fixture',setCode:'TST',collectorNumber:'1',condition:'NM',finish:'nonfoil',language:'en'};
 const provider={id:'existing-provider-contract-fixture',printing:async id=>id===item.scryfallId?{printingId:item.scryfallId,canonicalCardId:'canonical-fixture',game:'magic',name:'Trusted fixture',setCode:'TST',setName:'Test',collectorNumber:'1',language:'en',finishes:['nonfoil'],providerIds:{scryfall:item.scryfallId},provenance:['scryfall'],identityAuthority:'provider_confirmed',prices:[],rarity:null,imageUrl:null}:null,search:async()=>[]};
 if (agentMode) {
  const dir=mkdtempSync(join(tmpdir(),'td-phase1q-installed-')); const input=join(dir,'scope.json'),output=join(dir,'capture.json');
  writeFileSync(input,JSON.stringify({User:owner,Workspace:wid,Batch:album.id,Destination:box,Capture:capture}));
  const log=execFileSync('pwsh',['-NoProfile','-File',resolve('tests/phase1m-installed-agent-evidence.ps1')],{env:{...process.env,TD_AGENT_PARITY_INPUT:input,TD_AGENT_PARITY_OUTPUT:output},encoding:'utf8',timeout:180000});
  writeFileSync(join(dir,'installed-evidence.log'),log);
  const artifact=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(artifact.captureId,capture);assert.equal(artifact.binding.BatchId,album.id);assert.equal(artifact.binding.UserId,owner);assert.equal(artifact.binding.WorkspaceId,wid);assert.equal(artifact.calls,1);
  const bytes=await sharp(Buffer.from(artifact.capture.image,'base64')).rotate().resize({width:2500,height:2500,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
  const hash=createHash('sha256').update(bytes).digest('hex');
  const reserved=JSON.parse(run(`select chaos_scan_command('reserve',${json({batchId:album.id,captureId:capture,sha256:hash})})`));
  // Storage service is not running in this disconnected DB-only recovery clone.
  // Seed its durable-upload metadata, explicitly NOT an HTTP Storage acceptance.
  sql(`insert into storage.objects(bucket_id,name) values('chaos-scans','${reserved.object_path}')`);
  run(`select chaos_scan_command('received',${json({batchId:album.id,captureId:capture,sha256:hash})})`);
  run(`select chaos_scan_command('review',${json({batchId:album.id,captureId:capture,revision:0,item})})`);
  assert.equal(JSON.parse(run(`select chaos_scan_command('reserve',${json({batchId:album.id,captureId:capture,sha256:hash})})`)).capture_id,capture);
  console.log('Installed artifact handoff/restart output reached real SQL cloud receipt; synthetic Storage metadata; evidence '+dir);
 } else {
  run(`select chaos_scan_command('csv',${json({batchId:album.id,captureId:capture,sha256:'a'.repeat(64),item})})`);
 }
 const snapshot=()=>JSON.parse(run(`select chaos_scan_command('snapshot',${json({batchId:album.id})})`));
 const commit=()=>JSON.parse(run(`select chaos_scan_command('commit',${json({batchId:album.id})})`));
 assert.throws(commit,/CHAOS_TRUSTED_REVIEW_REQUIRED/);
 const state=snapshot();const claim=chaosCommitClaim(state);const valid=await validateChaosCommitSnapshot(state,provider);
 const issue=(c=claim,items=valid)=>`select issue_chaos_commit_validation('${album.id}',${json(c)},${json(items)})`;
 assert.throws(()=>run(issue()),/permission denied/);
 sql(`set role service_role;${issue()}`);
 // A review edit after validation invalidates the whole receipt, even if a
 // browser claims that the new edit has been confirmed.
 run(`select chaos_scan_command('review',${json({batchId:album.id,captureId:capture,revision:state.captures[0].revision,item:{...item,finish:'foil',reviewed:true}})})`);
 assert.throws(commit,/TRUSTED_REVIEW_REQUIRED/);
 assert.throws(()=>sql(`set role service_role;${issue()}`),/REVISION_CONFLICT/);
 const edited=snapshot();
 run(`select chaos_scan_command('review',${json({batchId:album.id,captureId:capture,revision:edited.captures[0].revision,item})})`);
 const restored=snapshot();sql(`set role service_role;${issue(chaosCommitClaim(restored),await validateChaosCommitSnapshot(restored,provider))}`);

 const request={batch:{id:album.id,batchCode:album.batch_code,workspaceId:wid,destinationLocationId:box,destinationLabel:album.destination_label,intakeMode:album.intake_mode,targetBatchSize:100,title:null,acquisitionCost:null},items:[{...item,sourceImageUrl:null,destinationLocationId:box,destinationLabel:album.destination_label}],rules:[]};
 for (const change of [{finish:'foil'},{setCode:'NO'},{collectorNumber:'99'},{condition:null},{language:'fake'},{scryfallId:randomUUID()},{condition:'',reviewed:true,confirmed:true}]) {
  await assert.rejects(validateChaosCommitItem({...item,...change},provider),/REVIEW_REQUIRED/);
  assert.throws(()=>run(`select commit_chaos_sort_batch(${json({...request,items:[{...request.items[0],...change}]})})`),/CHAOS_TRUSTED_REVIEW_REQUIRED/);
 }
 assert.equal(sql(`select count(*) from inventory_events where user_id='${owner}' and related_entity_type='chaos_sort_batch'`),'0');
 const committed=commit();assert.equal(committed.committedCount,1);
 const rowId=sql(`select item_id from chaos_sort_inventory_positions where batch_id='${album.id}'`);
 run(`select apply_collector_inventory_mutation('${rowId}','quantity',3,null,null,null,'post-chaos','manual')`);
 assert.deepEqual(commit(),committed);assert.deepEqual(JSON.parse(run(`select commit_chaos_sort_batch(${json(request)})`)),committed);
 assert.equal(sql(`select quantity from inventory_items where id='${rowId}'`),'3');
 assert.equal(sql(`select count(*) from inventory_events where user_id='${owner}' and related_entity_type='chaos_sort_batch'`),'1');
 assert.throws(()=>run(`select commit_chaos_sort_batch(${json({...request,items:[{...request.items[0],finish:'foil'}]})})`),/CHAOS_IDEMPOTENCY_CONFLICT/);
 assert.equal(sql(`select has_function_privilege('authenticated','chaos_scan_private.commit_validated_inventory(jsonb)','execute')`),'f');

 const other=randomUUID();sql(`insert into auth.users(id,email) values('${other}','phase1q-other@example.invalid');update user_preferences set active_workspace_id=(select workspace_id from workspace_members where user_id='${other}' limit 1) where user_id='${other}'`);
 assert.throws(()=>sql(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${other}',true);select commit_chaos_sort_batch(${json(request)});commit`),/AUTHORIZATION_FAILURE/);
 assert.throws(()=>sql(`set role anon;select apply_inventory_manifest('${mid}',${json(manifest)})`),/permission denied/);
 assert.throws(()=>sql(`set role anon;select commit_chaos_sort_batch(${json(request)})`),/permission denied/);
 assert.equal(sql("select bool_and(relrowsecurity) from pg_class where oid in ('inventory_private.manifest_receipts'::regclass,'chaos_scan_private.commit_validation'::regclass)"),'t');
 console.log('PASS receipt revision invalidation, cross-tenant/anonymous denial, private receipt RLS');
 console.log('PASS Chaos: server-issued receipt required; direct RPC invalid attributes rejected; exact commit; lost response replay after later stock edit; changed replay denied; private writer inaccessible');
 console.log('PASS append RPC: explicit asking preserved; lost-response-equivalent retry; stale append preserves later quantity; changed snapshot child conflicts');
 console.log('PASS lot RPC: 10→7, replay→7, 7→5, stale replay→5; changed quantity/reason conflict; event deltas; split move duplicate receipt');
} finally { sql(`drop database ${database}`,'template1'); }
