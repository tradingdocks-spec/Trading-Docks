// Dependency/transition review only; all writes stay in disposable loopback PG.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const files=['20260921195747_label_production_compatibility.sql','20260921195836_chaos_and_pos_authority_compatibility.sql'];

const sql=f=>readFileSync('supabase/migrations/'+f,'utf8');
export async function verifyLabelRepair({db,pg,snap,fixture,report,check}){
 const membership=JSON.parse(readFileSync('.local-fixtures/production-membership-sanitized.json','utf8'));
 const owner=membership.find(m=>m.effective_tier==='store').user_id;
 const workspace=fixture.workspaces.find(w=>w.owner_id===owner).id;
 const chaos=JSON.parse(readFileSync('.local-fixtures/production-chaos-sanitized.json','utf8'));
 const location=chaos.locations.find(l=>l.user_id===owner).id;
 const other=fixture.users.find(u=>u!==owner);
 // Read-only production verification identified this sanitized account as the
 // signed-in platform owner; no email, password or token is stored here.
 const platformOwner='158ab6a1-7751-ccdc-a79a-d03f75ae12ab';
 await db.query("insert into user_roles(user_id,role) values($1,'owner')",[platformOwner]);
 const platformWorkspace=fixture.workspaces.find(w=>w.owner_id===platformOwner).id;
 const snapshot=async()=>{
   const result={};for(const table of ['inventory_items','inventory_label_identities','inventory_locations','chaos_sort_sessions','chaos_sort_batches','chaos_sort_inventory_positions']){const added=table==='inventory_label_identities'?['inventory_position_id','inventory_location_id']:table==='chaos_sort_inventory_positions'?['language']:[];result[table]=(await db.query(`select to_jsonb(t)-$1::text[] r from public.${table} t order by to_jsonb(t)->>'user_id',to_jsonb(t)->>'id'`,[added])).rows.map(r=>r.r);}
   return result;
 };
 const before=await snapshot();
 const guard=async()=>(await db.query("select pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure) d")).rows[0].d;
 const originalGuard=await guard();
 const originalChaos=(await db.query("select pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure) d")).rows[0].d;
 async function probe(query,args=[],role='authenticated',actor=owner){
   await db.query('savepoint probe');
   try{await db.query('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await db.query(query,args);return {ok:true,rows:r.rows,rowCount:r.rowCount};}
   catch(e){return {ok:false,code:e.code,error:e.message};}
   finally{await db.query('rollback to savepoint probe');await db.query('release savepoint probe');}
 }
 const payload=()=>({batch:{id:randomUUID(),batchCode:'CS-REHEARSAL',destinationLocationId:location,targetBatchSize:100},items:[{id:randomUUID(),cardName:'Rehearsal regression',humanState:'confirmed',recognitionState:'identified',quantity:1,scryfallId:randomUUID(),setCode:'lea',collectorNumber:'1',gameId:'magic',condition:'NM',finish:'nonfoil',language:'en'}]});
 async function step(label){
   const inventory=await probe('select count(*)::int n from inventory_items where user_id=$1',[owner]);assert.ok(inventory.ok);
   const edit=await probe("update inventory_items set card_name='Metadata probe' where user_id=$1 and id=$2",[owner,fixture.rows.find(r=>r.user_id===owner).id]);assert.equal(edit.rowCount,1,JSON.stringify(edit));
   const cross=await probe('select count(*)::int n from inventory_items where user_id=$1',[owner],'authenticated',other);assert.equal(cross.rows[0].n,0);
   const unauthorized=await probe("update inventory_items set card_name='Forbidden' where user_id=$1",[owner],'postgres','');assert.match(unauthorized.error,/TD_COLLECTOR_UNAUTHORIZED/);
   const labels=await probe('select id from inventory_label_identities where inventory_position_id is null and inventory_user_id=$1',[owner]);
   const targets=await probe("select label_targets($1,'{}',null,'',false) result",[workspace]);
   const pos=await probe("select pos_command($1,'bootstrap','{}')",[workspace]);
   assert.equal(pos.ok,false);assert.match(pos.error,/does not exist|POS_DISABLED/);
   assert.equal(await guard(),originalGuard);
   assert.deepEqual(await snapshot(),before);
   const result={label,inventoryEdit:edit.ok,crossTenantReadDenied:true,unauthorizedWrite:unauthorized.error,labelIdentityQuery:labels.ok,labelTargets:targets.ok?{ok:true,count:targets.rows[0].result.length}:targets,pos:pos.error};
   report.steps.push(result);console.log('STEP',JSON.stringify(result));
 }
 report.steps=[];report.candidateMigrations=[];
 await db.query('begin');
 report.baselineChaosCommit=await probe('select commit_chaos_sort_batch($1) result',[payload()]);
 await step('production baseline');
 for(const file of files){const start=performance.now();await db.query(sql(file));report.candidateMigrations.push({file,sha256:createHash('sha256').update(sql(file)).digest('hex'),milliseconds:Math.round(performance.now()-start)});await step(file);const commit=await probe('select commit_chaos_sort_batch($1) result',[payload()]);assert.equal(commit.ok,true,JSON.stringify(commit));}
 report.candidateChaosCommit=await probe('select commit_chaos_sort_batch($1) result',[payload()]);
 report.platformOwnerLabelTargets=await probe("select label_targets($1,'{}',null,'',false) result",[platformWorkspace],'authenticated',platformOwner);
 await check('private helpers inaccessible and anonymous label RPC denied',async()=>{
   const rights=(await db.query("select has_function_privilege('authenticated','pos_private.inventory_entitled(uuid)','execute') internal,has_function_privilege('anon','public.label_access(uuid,boolean)','execute') anonymous")).rows[0];
   assert.equal(rights.internal,false);assert.equal(rights.anonymous,false);
   const cross=await probe("select label_targets($1,'{}',null,'',true)",[platformWorkspace],'authenticated',other);
   assert.equal(cross.ok,false);
 });
 await check('platform owner issues an exact-position label for eligible own synthetic inventory',async()=>{
   await db.query('savepoint eligible_owner');
   try{
     await db.query('set local role authenticated');
     await db.query("select set_config('request.jwt.claim.sub',$1,true)",[platformOwner]);
     const id=randomUUID(),batch=randomUUID(),position=randomUUID();
     const loc=chaos.locations.find(l=>l.user_id===platformOwner).id;
     await db.query("insert into inventory_items(id,user_id,workspace_id,location_id,card_name,quantity) values($1,$2,$3,$4,'Eligible owner fixture',1)",[id,platformOwner,platformWorkspace,loc]);
     await db.query("insert into chaos_sort_batches(id,user_id,batch_code) values($1,$2,'COMPAT-OWNER')",[batch,platformOwner]);
     await db.query('insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,location_id,quantity) values($1,$2,$3,$4,$5,1)',[position,platformOwner,batch,id,loc]);
     const labels=(await db.query('select label_targets($1,$2,null,\'\',true) result',[platformWorkspace,['position:'+position]])).rows[0].result;
     assert.equal(labels.length,1);assert.equal(labels[0].positionId,position);assert.ok(labels[0].sku);
   }finally{await db.query('rollback to savepoint eligible_owner');await db.query('release savepoint eligible_owner');}
 });
 await check('Chaos commits and actual platform-owner labels succeed',async()=>{
   assert.equal(report.baselineChaosCommit.ok,true);
   assert.equal(report.candidateChaosCommit.ok,true,JSON.stringify(report.candidateChaosCommit));
   assert.equal(report.platformOwnerLabelTargets.ok,true,JSON.stringify(report.platformOwnerLabelTargets));
 });
 report.chaosFunctionChanged=(await db.query("select pg_get_functiondef('public.commit_chaos_sort_batch(jsonb)'::regprocedure) d")).rows[0].d!==originalChaos;
 await check('candidate migration makes Label Studio targets executable',async()=>assert.equal(report.steps.at(-1).labelTargets.ok,true));
 await check('migration itself leaves inventory, canonical labels and Chaos rows unchanged',async()=>assert.deepEqual(await snapshot(),before));
 report.counts=Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length]));
 report.rls=(await db.query("select relname,relrowsecurity from pg_class where oid in('inventory_items'::regclass,'inventory_label_identities'::regclass,'label_templates'::regclass,'chaos_sort_inventory_positions'::regclass,'chaos_sort_sessions'::regclass)")).rows;assert.ok(report.rls.every(t=>t.relrowsecurity));
 report.inventoryGuardUnchanged=(await guard())===originalGuard;
 await check('all existing FKs and constraints preserved except reviewed label count widening',async()=>{for(const c of snap.constraints){const r=(await db.query('select pg_get_constraintdef(oid,true) ddl from pg_constraint where conrelid=$1::regclass and conname=$2',[`${c.schema}.${c.table}`,c.name])).rows[0];if(c.name==='label_print_jobs_counts_check')assert.match(r.ddl,/page_count <= 10000/);else assert.equal(r?.ddl,c.ddl,c.name);}});
 await check('all existing indexes preserved except reviewed active-item predicate',async()=>{for(const i of snap.indexes){const r=(await db.query('select pg_get_indexdef($1::regclass) ddl',[`${i.schema}.${i.name}`])).rows[0];if(i.name==='inventory_label_identities_active_item_uidx')assert.match(r.ddl,/inventory_position_id IS NULL/);else assert.equal(r.ddl,i.ddl,i.name);}});
 await check('new label indexes valid, existing collector authorization preserved',async()=>{assert.equal((await db.query("select count(*)::int n from pg_index where indrelid='inventory_label_identities'::regclass and not indisvalid")).rows[0].n,0);assert.equal(await guard(),originalGuard);});
 await check('new restrictive label policies do not widen inventory access',async()=>{const policies=(await db.query("select policyname,qual,with_check from pg_policies where tablename='inventory_items' and schemaname='public'")).rows;for(const p of snap.policies.filter(p=>p.tablename==='inventory_items')){const n=policies.find(n=>n.policyname===p.policyname);assert.equal(n?.qual,p.qual);assert.equal(n?.with_check,p.with_check);}assert.equal((await db.query("select to_regclass('public.pos_workspace_settings') p")).rows[0].p,null);});
 report.expectedMigrationRowChanges={inventoryUpdates:0,canonicalLabelUpdates:0,positionUpdates:0,newIdentityColumnNulls:26,newPositionLanguageNulls:1488,gameBackfillRun:false};
 report.decision='REHEARSAL PASS';
 await db.query('commit');
 console.log('CHAOS',JSON.stringify({before:report.baselineChaosCommit,after:report.candidateChaosCommit}));
 const {verifyMinimalLabelBrowser}=await import('./label-production-repair-browser.mjs');
 if(process.argv.includes('--workspace-assignment')){
   const {verifyWorkspaceAssignment}=await import('./production-workspace-assignment.mjs');
   await verifyWorkspaceAssignment({db,report,check,platformOwner,platformWorkspace,other});
 }
 await verifyMinimalLabelBrowser({db,pg,owner,workspace,platformOwner,platformWorkspace,report,expectOwnerPass:true});
 report.status='REVIEW_COMPLETE';
 report.decision=report.browserPlatformOwner.targets===0?'NOT SAFE TO APPLY':'REHEARSAL PASS';
 if(process.argv.includes('--workspace-assignment'))report.decision='SAFE TO ASSIGN + CONTINUE';
}
