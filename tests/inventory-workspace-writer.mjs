import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyFutureWriters({db,report,check,platformOwner:owner,platformWorkspace:workspace,other}){
 await db.query('begin');
 const results=[];
 const record=async(name,fn)=>{await check(name,fn);results.push(name);};
 const auth=async(who)=>{await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);};
 async function rejects(query,args,pattern){await db.query('savepoint denied');try{await assert.rejects(db.query(query,args),pattern);}finally{await db.query('rollback to savepoint denied');await db.query('release savepoint denied');}}
 try{
   await auth(owner);
   const location=(await db.query('select id from inventory_locations where user_id=$1 limit 1',[owner])).rows[0].id;
   const manual=randomUUID();
   await record('manual RPC scopes owner inventory and its creation event',async()=>{
     const r=(await db.query("select * from create_inventory_item_with_event($1,'manual',$2,null,null)",[{id:manual,card_name:'Scoped manual',quantity:3,location_id:location,game_id:'magic',product_type:'card'},randomUUID()])).rows[0];
     assert.equal(r.user_id,owner);assert.equal(r.workspace_id,workspace);
     const e=(await db.query('select workspace_id from inventory_events where user_id=$1 and inventory_item_id=$2',[owner,manual])).rows;assert.ok(e.length);assert.ok(e.every(e=>e.workspace_id===workspace));
     const labels=(await db.query("select label_targets($1,$2,null,'',true) result",[workspace,['item:'+manual]])).rows[0].result;
     assert.equal(labels.length,1);assert.equal(labels[0].itemId,manual);
   });
   await record('direct manual/import upserts receive scope before insertion',async()=>{
     for(const source of ['manual','csv_import','bulk_purchase','scanner_replay']){
       const r=(await db.query("insert into inventory_items(id,user_id,card_name,quantity,location_id,data) values($1,$2,$3,1,$4,$5) on conflict(user_id,id) do update set quantity=excluded.quantity returning workspace_id,user_id",[randomUUID(),owner,source,location,{source}])).rows[0];assert.equal(r.workspace_id,workspace);assert.equal(r.user_id,owner);
     }
   });
   await record('existing scoped upsert keeps scope and rejects tenant injection',async()=>{
     const r=(await db.query("insert into inventory_items(id,user_id,card_name,quantity,location_id) values($1,$2,'Scoped manual',3,$3) on conflict(user_id,id) do update set workspace_id=excluded.workspace_id returning workspace_id",[manual,owner,location])).rows[0];assert.equal(r.workspace_id,workspace);
     const foreign=(await db.query('select id from workspaces where owner_id=$1',[other])).rows[0]?.id;
     // Read foreign ID through the trusted fixture connection, never grant it.
     await db.query('reset role');const foreignId=foreign??(await db.query('select id from workspaces where owner_id=$1',[other])).rows[0].id;await auth(owner);
     await rejects('insert into inventory_items(id,user_id,workspace_id,quantity) values($1,$2,$3,1)',[randomUUID(),owner,foreignId],/INVENTORY_WORKSPACE_FORBIDDEN/);
     await rejects('insert into inventory_items(id,user_id,workspace_id,quantity) values($1,$2,$3,1)',[randomUUID(),other,foreignId],/TD_COLLECTOR_UNAUTHORIZED/);
   });
   await record('collection lot split carries authoritative source scope',async()=>{
     const loc='writer-split-'+randomUUID();await db.query("insert into inventory_locations(id,user_id,name) values($1,$2,'Writer split')",[loc,owner]);
     await db.query("select move_inventory_lot_quantity($1,1,$2,$3,'collector_workspace')",[manual,loc,randomUUID()]);
     const r=(await db.query('select workspace_id,user_id from inventory_items where location_id=$1',[loc])).rows;assert.equal(r.length,1);assert.equal(r[0].workspace_id,workspace);assert.equal(r[0].user_id,owner);
   });
   await db.query('reset role');
   const w2=randomUUID();await db.query("insert into workspaces(id,owner_id,name) values($1,$2,'Second owned fixture')",[w2,owner]);await db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[w2,owner]);
   await auth(owner);
   await record('ambiguous implicit workspace fails closed; explicit validated operation succeeds',async()=>{
     await rejects('insert into inventory_items(id,user_id,quantity) values($1,$2,1)',[randomUUID(),owner],/INVENTORY_WORKSPACE_REQUIRED/);
     const batch=randomUUID();await db.query('select commit_chaos_sort_batch($1)',[{batch:{id:batch,batchCode:'WRITER-SCOPE',workspaceId:w2,destinationLocationId:location},items:[{id:randomUUID(),cardName:'Explicit scoped Chaos',quantity:1,humanState:'confirmed',recognitionState:'identified',scryfallId:randomUUID(),condition:'NM',finish:'nonfoil'}]}]);
     const rows=(await db.query("select workspace_id,user_id from inventory_items where data->>'batch_id'=$1",[batch])).rows;assert.equal(rows.length,1);assert.equal(rows[0].workspace_id,w2);assert.equal(rows[0].user_id,owner);
     const events=(await db.query("select workspace_id from inventory_events where user_id=$1 and related_entity_id=$2",[owner,batch])).rows;assert.ok(events.length);assert.ok(events.every(e=>e.workspace_id===w2));
     const labels=(await db.query("select label_targets($1,'{}',$2,'',true) result",[w2,batch])).rows[0].result;assert.equal(labels.length,1);
   });
   await record('identical Chaos identity in two workspaces never merges across scope',async()=>{
     const identity=randomUUID();
     for(const w of [workspace,w2]){
       const batch=randomUUID();await db.query('select commit_chaos_sort_batch($1)',[{batch:{id:batch,batchCode:'SCOPE-IDENTITY',workspaceId:w,destinationLocationId:location},items:[{id:randomUUID(),cardName:'Shared identity scope test',quantity:1,humanState:'confirmed',recognitionState:'identified',scryfallId:identity,condition:'NM',finish:'nonfoil'}]}]);
     }
     const rows=(await db.query('select workspace_id,quantity from inventory_items where user_id=$1 and scryfall_id=$2',[owner,identity])).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.quantity===1));assert.deepEqual(rows.map(r=>r.workspace_id).sort(),[workspace,w2].sort());
   });
   await record('private resolver is not callable by browser roles',()=>rejects('select inventory_private.resolve_workspace($1,$2,null,null,true)',[owner,workspace],/permission denied/));
   await db.query('reset role');
   const personal=randomUUID();await db.query('insert into auth.users(id) values($1)',[personal]);
   await db.query('insert into profiles(id) values($1)',[personal]);await db.query('insert into user_preferences(user_id) values($1)',[personal]);
   await db.query("insert into user_roles(user_id,role) values($1,'owner')",[personal]);await auth(personal);
   await record('required workspace with no eligible relationship fails closed',()=>rejects('insert into inventory_items(id,user_id,quantity) values($1,$2,1)',[randomUUID(),personal],/INVENTORY_WORKSPACE_REQUIRED/));
   await db.query('reset role');await db.query('delete from user_roles where user_id=$1',[personal]);await auth(personal);
   await record('legitimate personal collector inventory remains nullable',async()=>{
     const row=(await db.query('insert into inventory_items(id,user_id,quantity) values($1,$2,1) returning workspace_id',[randomUUID(),personal])).rows[0];assert.equal(row.workspace_id,null);
   });
   await db.query('reset role');await db.query("update auth.users set banned_until='infinity' where id=$1",[owner]);await auth(owner);
   await record('ineligible owner cannot create scoped inventory',()=>rejects('insert into inventory_items(id,user_id,workspace_id,quantity) values($1,$2,$3,1)',[randomUUID(),owner,workspace],/INVENTORY_WORKSPACE_FORBIDDEN/));
   await db.query('reset role');await db.query('update auth.users set banned_until=null where id=$1',[owner]);
   await record('writer triggers remain enabled and private functions expose no API execution',async()=>{
     const triggers=(await db.query("select tgname,tgenabled from pg_trigger where not tgisinternal and tgname in ('a_inventory_workspace_at_write','a_chaos_workspace_at_write')")).rows;
     assert.equal(triggers.length,2);assert.ok(triggers.every(t=>t.tgenabled==='O'));
     const functions=(await db.query("select p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='inventory_private'")).rows;
     assert.equal(functions.length,4);assert.ok(functions.every(f=>!f.anon&&!f.authenticated&&!f.service&&f.proconfig.includes('search_path=\"\"')));
   });
   const missing=(await db.query("select count(*)::int n from inventory_items i where i.quantity>0 and i.workspace_id is null and inventory_private.workspace_required(i.user_id)")).rows[0].n;
   assert.equal(missing,0);report.futureWriter={checks:results,unscopedActiveWorkspaceInventory:missing,creationTimeScope:true};
 }finally{await db.query('rollback');}
}
