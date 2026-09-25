import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
import { persistCollectorEdit, deliverCollectorEdit } from '../mobile/services/collector-inventory-command.ts';
export async function runCollectorEditFixtures({ admin, client, second, owner, workspace, payload, create }) {
  const item = randomUUID(); await create(client, payload(item, 2), randomUUID());
  let raw = '[]'; const lock = createQueueLock();
  const fresh = () => createOfflineQueue({ storage: { getItem: async () => raw, setItem: async (_, s) => { raw = s; } }, lock, runtimeId: randomUUID(), newId: randomUUID });
  let queue = fresh(), lose = false;
  const context = { userId: owner, workspaceId: workspace };
  const call = async (db, a) => (await db.query('select to_jsonb(apply_collector_inventory_mutation($1,$2,$3,$4,$5,$6,$7,$8)) r', [a.p_inventory_item_id,a.p_mutation_type,a.p_quantity,a.p_condition,a.p_finish,a.p_location_id,a.p_idempotency_key,a.p_source])).rows[0].r;
  const transport = { context: async () => context, rpc: async (_, args) => {
    try { const data = await call(client, args); if (lose) { lose=false; throw Error('response lost'); } return { data, error: null }; }
    catch(error) { if (!error.code) throw error; return { data: null, error }; }
  } };
  const prepare = async (patch) => { const key=randomUUID(); await persistCollectorEdit(queue,{userId:owner,inventoryItemId:item,...patch},key,context); return key; };
  const send = key => deliverCollectorEdit(queue,key,owner,transport);
  const events = async key => (await admin.query('select count(*)::int n from inventory_events where user_id=$1 and idempotency_key=$2',[owner,key])).rows[0].n;
  const current = async () => (await admin.query('select quantity,location_id from inventory_items where id=$1',[item])).rows[0];
  const first=await prepare({type:'quantity',quantity:3}); lose=true; await send(first); queue=fresh(); assert.equal((await send(first)).committed,true); await send(first); assert.equal(await events(first),1);
  const later=await prepare({type:'quantity',quantity:5}); await send(later);
  const original=JSON.parse(raw).find(r=>r.id===first).payload.command;
  await call(client,original.args); assert.equal((await current()).quantity,5);
  await assert.rejects(call(client,{...original.args,p_quantity:9}),/IDEMPOTENCY_CONFLICT/);
  const locations=[randomUUID(),randomUUID()]; for(const id of locations) await admin.query('insert into inventory_locations(id,user_id,name) values($1,$2,$3)',[id,owner,'Generic edit box']);
  const move=await prepare({type:'storage',storageLocationId:locations[0]}); lose=true; await send(move); queue=fresh(); await send(move);
  const nextMove=await prepare({type:'storage',storageLocationId:locations[1]}); await send(nextMove);
  await call(client,JSON.parse(raw).find(r=>r.id===move).payload.command.args); assert.equal((await current()).location_id,locations[1]); assert.equal(await events(move),1);
  const concurrent=await prepare({type:'quantity',quantity:6}); const args=JSON.parse(raw).find(r=>r.id===concurrent).payload.command.args;
  await Promise.all([call(client,args),call(second,args)]); assert.equal(await events(concurrent),1);
  // The direct concurrency probes committed SQL, but the client's command is still pending.
  assert.equal((await send(concurrent)).committed,true); assert.equal(await events(concurrent),1);
  const acquisitionBefore=(await admin.query("select count(*)::int n from inventory_events where inventory_item_id=$1 and event_type::text in ('inventory_created','quantity_added','imported')",[item])).rows[0].n;
  const condition=await prepare({type:'condition',condition:'lightly_played'}); assert.equal((await send(condition)).committed,true);
  assert.equal((await admin.query("select count(*)::int n from inventory_events where inventory_item_id=$1 and event_type::text in ('inventory_created','quantity_added','imported')",[item])).rows[0].n,acquisitionBefore);
  const conditionEvent=(await admin.query('select event_type::text,quantity_before,quantity_after from inventory_events where user_id=$1 and idempotency_key=$2',[owner,condition])).rows;
  assert.equal(conditionEvent.length,1); assert.equal(conditionEvent[0].event_type,'condition_changed'); assert.equal(conditionEvent[0].quantity_before,conditionEvent[0].quantity_after);
  const countBefore=(await admin.query('select count(*)::int n from inventory_events where inventory_item_id=$1',[item])).rows[0].n;
  await client.query("update inventory_items set data=jsonb_set(coalesce(data,'{}'),'{notes}','\"Synthetic note\"') where id=$1",[item]);
  assert.equal((await admin.query('select count(*)::int n from inventory_events where inventory_item_id=$1',[item])).rows[0].n,countBefore);
  console.log('PASS generic actual-RPC: duplicate quantity, persist-before-send, response loss, restart, stale quantity, stale location, changed payload, concurrent duplicate, condition without acquisition');
}
