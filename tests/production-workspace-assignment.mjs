import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const file='20260921201424_inventory_workspace_assignment.sql';
const migration=readFileSync('supabase/migrations/'+file,'utf8');
const classification=migration.split('-- BEGIN CLASSIFICATION')[1].split('-- END CLASSIFICATION')[0].trim();
export async function verifyWorkspaceAssignment({db,report,check,platformOwner,platformWorkspace,other}){
 const snapshot=async()=>{
   const data={};for(const t of ['inventory_items','inventory_events','inventory_locations','chaos_sort_batches','chaos_sort_sessions','chaos_sort_inventory_positions','selling_inventory_allocations','selling_listing_candidates'])
     data[t]=(await db.query(`select to_jsonb(t) r from public.${t} t order by to_jsonb(t)::text`)).rows.map(x=>x.r);
   return data;
 };
 const guard=async()=>(await db.query("select pg_get_functiondef('public.enforce_collector_inventory_mutation()'::regprocedure) d")).rows[0].d;
 const policies=async()=>(await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 const before=await snapshot(),originalGuard=await guard(),originalPolicies=await policies();
 const rows=(await db.query(classification)).rows;
 assert.equal(rows.length,1489);assert.equal(rows.filter(r=>r.quantity>0).length,1460);
 const rules={};for(const r of rows){assert.equal(r.classification,'DETERMINISTIC');assert.equal(r.target_workspace,platformWorkspace);assert.equal(r.user_id,platformOwner);rules[r.inference_rule]=(rules[r.inference_rule]??0)+1;}
 assert.deepEqual(rules,{sole_eligible_owner_workspace:1470,inventory_event:19});
 report.assignment={file,sha256:createHash('sha256').update(migration).digest('hex'),classification:{total:1489,positive:1460,zero:29,deterministic:1489,ambiguous:0,unresolved:0,intentionallyUnscoped:0,rules}};
 async function rejectCase(name,setup,pattern){
   await db.query('begin');await setup();await db.query('savepoint attempted');
   await assert.rejects(db.query(migration),pattern);await db.query('rollback to savepoint attempted');
   assert.equal(await guard(),originalGuard);await db.query('rollback');
   assert.deepEqual(await snapshot(),before);console.log('PASS',name);
 }
 await check('multiple memberships without explicit evidence abort the entire assignment',()=>rejectCase('ambiguous owner',async()=>{
   const w=(await db.query('select id from workspaces where owner_id=$1',[other])).rows[0].id;
   await db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'manager')",[w,platformOwner]);
 },/WORKSPACE_ASSIGNMENT_REVIEW_REQUIRED/));
 await check('foreign event workspace aborts without changing tenant scope',()=>rejectCase('cross-tenant evidence',async()=>{
   const w=(await db.query('select id from workspaces where owner_id=$1',[other])).rows[0].id;
   await db.query("insert into inventory_events select (jsonb_populate_record(null::inventory_events,to_jsonb(e)||jsonb_build_object('id',$1::uuid,'workspace_id',$2::uuid,'idempotency_key',$1::text))).* from inventory_events e where e.workspace_id=$3 limit 1",[randomUUID(),w,platformWorkspace]);
 },/WORKSPACE_ASSIGNMENT_REVIEW_REQUIRED/));
 await check('ineligible owner aborts',()=>rejectCase('banned owner',async()=>{
   await db.query("update auth.users set banned_until='infinity' where id=$1",[platformOwner]);
 },/WORKSPACE_ASSIGNMENT_REVIEW_REQUIRED/));
 await check('positive inventory without an owned location is unresolved and aborts',()=>rejectCase('unresolved positive row',async()=>{
   await db.query("select set_config('request.jwt.claim.sub',$1,true)",[platformOwner]);
   await db.query('update inventory_items set location_id=null where user_id=$1 and id=$2',[platformOwner,rows.find(r=>r.quantity>0).id]);
   await db.query("select set_config('request.jwt.claim.sub','',true)");
 },/WORKSPACE_ASSIGNMENT_REVIEW_REQUIRED/));
 await check('browser role cannot invoke the trusted backfill path',()=>rejectCase('API role',async()=>{await db.query('set local role authenticated');},/TRUSTED_DATABASE_MIGRATION_REQUIRED/));
 await db.query('begin');const started=performance.now();await db.query(migration);
 report.assignment.milliseconds=Math.round(performance.now()-started);
 const after=await snapshot();
 const assignments=new Map(rows.map(r=>[r.user_id+':'+r.id,r.target_workspace]));
 const expected=before.inventory_items.map(r=>assignments.has(r.user_id+':'+r.id)?{...r,workspace_id:assignments.get(r.user_id+':'+r.id)}:r);
 const sort=a=>a.toSorted((x,y)=>(x.user_id+':'+x.id).localeCompare(y.user_id+':'+y.id));
 assert.deepEqual(sort(after.inventory_items),sort(expected));
 for(const t of Object.keys(before).filter(t=>t!=='inventory_items'))assert.deepEqual(after[t],before[t],t);
 assert.equal(await guard(),originalGuard);assert.deepEqual(await policies(),originalPolicies);
 await db.query(migration); // No-op after completion, without permitting scope drift.
 await db.query('commit');
 report.assignment.invariants={rows:after.inventory_items.length,quantity:after.inventory_items.reduce((n,r)=>n+r.quantity,0),events:after.inventory_events.length,allocations:after.selling_inventory_allocations.length,onlyWorkspaceChanged:true,guardRestored:true,policiesUnchanged:true};
 await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[platformOwner]);
 const owned=(await db.query('select count(*)::int n from inventory_items where workspace_id=$1',[platformWorkspace])).rows[0].n;assert.equal(owned,1514);
 const targets=(await db.query("select label_targets($1,'{}',null,'',false) result",[platformWorkspace])).rows[0].result;assert.equal(targets.length,500);
 const batch=randomUUID(),item=randomUUID();
 const location=before.inventory_locations.find(l=>l.user_id===platformOwner).id;
 const committed=(await db.query('select commit_chaos_sort_batch($1) result',[{batch:{id:batch,batchCode:'ASSIGNMENT-REGRESSION',destinationLocationId:location},items:[{id:item,cardName:'Assignment regression',humanState:'confirmed',recognitionState:'identified',quantity:1,scryfallId:randomUUID(),setCode:'lea',collectorNumber:'1',condition:'NM',finish:'nonfoil'}]}])).rows[0].result;
 assert.equal(committed.ok,true);
 const created=(await db.query('select workspace_id from inventory_items where user_id=$1 and data->>\'batch_id\'=$2',[platformOwner,batch])).rows;
 assert.equal(created.length,1);
 report.assignment.chaosCommitAfterAssignment=true;
 report.assignment.currentChaosWriterStillOmitsWorkspace=created[0].workspace_id===null;
 if(process.argv.includes('--future-writer'))assert.equal(created[0].workspace_id,platformWorkspace);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[other]);
 assert.equal((await db.query('select count(*)::int n from inventory_items where workspace_id=$1',[platformWorkspace])).rows[0].n,0);
 await db.query('rollback');
 // Prove ordinary trusted-role writes still cannot bypass the collector guard.
 await assert.rejects(db.query("update inventory_items set quantity=quantity+1 where user_id=$1 and workspace_id=$2",[platformOwner,platformWorkspace]),/TD_COLLECTOR_UNAUTHORIZED/);
 report.assignment.ownerReadCount=owned;report.assignment.labelTargets=targets.length;
 console.log('PASS assignment changes only workspace_id on 1489 rows; owner targets and tenant isolation verified');
}

// Additional runtime proof on the already-installed POS fixture. Everything,
// including temporary test cohort and assignment, is rolled back afterward.
export async function verifyAssignedPosScope({admin,owner,other,workspace,setup,command,check}){
 await check('assigned inventory is searchable only in the authorized POS workspace; exact position resolves',async()=>{
   await admin.query('begin');
   try{
     // The small POS fixture omits these production tables; affected production
     // rows have no mappings/order lines. Full schema is exercised separately.
     await admin.query('create table if not exists marketplace_listing_mappings(user_id uuid,inventory_item_id text); create table if not exists marketplace_order_items(user_id uuid,inventory_item_id text)');
     await admin.query('alter table chaos_sort_batches add column if not exists workspace_id uuid');
     await admin.query('set local role authenticated');await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
     await admin.query("insert into inventory_items(id,user_id,location_id,card_name,quantity,asking_price) select 'assignment-'||n,$1,'case','Assignment fixture '||n,case when n<=1460 then 1 else 0 end,1 from generate_series(1,1489) n",[owner]);
     const batch=randomUUID();
     await admin.query('reset role');
     await admin.query("insert into chaos_sort_batches(id,user_id,batch_code) values($1,$2,'ASSIGNMENT')",[batch,owner]);
     await admin.query("insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,location_id,quantity) values('assignment-position',$1,$2,'assignment-1','case',1)",[owner,batch]);
     await admin.query('reset role');await admin.query("select set_config('request.jwt.claim.sub','',true)");
     await admin.query(migration);
     await admin.query('set local role authenticated');await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
     const targets=(await admin.query("select label_targets($1,array['position:assignment-position'],null,'',true) result",[workspace])).rows[0].result;
     assert.equal(targets.length,1);
     const results=await command(admin,'search',{siteId:setup.siteId,query:targets[0].sku,exact:true});
     assert.equal(results.length,1);assert.equal(results[0].positionId,'assignment-position');assert.equal(results[0].ownerId,owner);
     await admin.query("select set_config('request.jwt.claim.sub',$1,true)",[other]);
     await assert.rejects(command(admin,'search',{siteId:setup.siteId,query:targets[0].sku,exact:true}),/POS_FORBIDDEN/);
   }finally{await admin.query('rollback');}
 });
}
