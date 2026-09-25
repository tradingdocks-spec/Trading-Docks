import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createOfflineQueue, createQueueLock } from '../mobile/services/storage/offline-core.ts';
import { persistInventoryBatch, deliverInventoryBatch } from '../mobile/services/inventory-command-batch.ts';
import { collectorEditCommand, persistCollectorEdit } from '../mobile/services/collector-inventory-command.ts';
const context={ userId:'owner',workspaceId:'workspace' };
function fixture() {
 let raw='[]'; const lock=createQueueLock();
 return { fresh:()=>createOfflineQueue({ storage:{getItem:async()=>raw,setItem:async(_,v)=>{raw=v;}},lock,runtimeId:randomUUID(),newId:randomUUID }), rows:()=>JSON.parse(raw) };
}
test('manifest response loss/restart preserves original child IDs and quantities',async()=>{
 const f=fixture(),q=f.fresh(),id=randomUUID();
 const commands=['one','two'].map(item=>collectorEditCommand({type:'remove_quantity',userId:'owner',inventoryItemId:item,quantity:3},`${id}:${item}`,'workspace','now'));
 await persistInventoryBatch(q,id,commands,'bulk_remove');
 const receipts=new Map(); const effects=new Map([['one',10],['two',10]]); let lose=true;
 const transport={ context:async()=>context,rpc:async(endpoint:string,args:Record<string,unknown>)=>{
  assert.equal(endpoint,'apply_inventory_manifest');
  const key=String(args.p_operation_id);
  assert.ok(f.rows()[0].payload.commands.length===2);
  if(!receipts.has(key)) {
   for (const c of commands) effects.set(c.inventoryItemId,effects.get(c.inventoryItemId)!-3);
   receipts.set(key,{operationId:key,userId:'owner',workspaceId:'workspace',committed:true});
  }
  if(lose){lose=false;throw Error('response lost');}
  return {data:receipts.get(key),error:null};
 }};
 assert.equal((await deliverInventoryBatch(q,id,'owner',transport)).committed,false);
 assert.equal((await deliverInventoryBatch(f.fresh(),id,'owner',transport)).committed,true);
 assert.deepEqual([...effects.values()],[7,7]);assert.equal(receipts.size,1);
 await assert.rejects(persistInventoryBatch(q,id,[{...commands[0],args:{...commands[0].args,p_quantity:9}},commands[1]],'bulk_remove'),/conflicts/);
});
test('batch conflict stops before later children and never rekeys',async()=>{
 const f=fixture(),q=f.fresh(),id=randomUUID();
 const commands=['one','two'].map(item=>collectorEditCommand({type:'remove_quantity',userId:'owner',inventoryItemId:item,quantity:1},`${id}:${item}`,'workspace','now'));
 await persistInventoryBatch(q,id,commands,'bulk_remove'); const calls:string[]=[];
 const transport={context:async()=>context,rpc:async(_endpoint:string,a:Record<string,unknown>)=>{calls.push(String(a.p_operation_id));return {data:null,error:{code:'22023',message:'INVENTORY_IDEMPOTENCY_CONFLICT'}};}};
 const result=await deliverInventoryBatch(q,id,'owner',transport);assert.equal(result.committed,false);assert.equal(result.operation?.status,'review_required');
 await deliverInventoryBatch(f.fresh(),id,'owner',transport);assert.deepEqual(calls,[id]);
});
test('pending manifest and single-item edits cannot overtake each other',async()=>{
 const mutation={type:'remove_quantity' as const,userId:'owner',inventoryItemId:'one',quantity:1};
 const a=fixture().fresh(),id=randomUUID();
 await persistInventoryBatch(a,id,[collectorEditCommand(mutation,id+':one','workspace','now')],'bulk_remove');
 await assert.rejects(persistCollectorEdit(a,{...mutation,type:'quantity'},randomUUID(),context),/REVIEW_REQUIRED/);
 const b=fixture().fresh();await persistCollectorEdit(b,mutation,randomUUID(),context);
 await assert.rejects(persistInventoryBatch(b,randomUUID(),[collectorEditCommand(mutation,'child','workspace','now')],'bulk_remove'),/REVIEW_REQUIRED/);
});
test('atomic server failure receipt retains command and retries only transient outcomes',async()=>{
 const q=fixture().fresh(),id=randomUUID();const command=collectorEditCommand({type:'remove_quantity',userId:'owner',inventoryItemId:'one',quantity:1},id+':one','workspace','now');
 await persistInventoryBatch(q,id,[command],'bulk_remove');let attempts=0;
 const transport={context:async()=>context,rpc:async()=>({error:null,data:{operationId:id,userId:'owner',workspaceId:'workspace',committed:++attempts>1,error:{code:'40001',message:'transient fixture'}}})};
 const failed=await deliverInventoryBatch(q,id,'owner',transport);assert.equal(failed.operation?.status,'retryable');
 assert.equal((await deliverInventoryBatch(q,id,'owner',transport)).committed,true);assert.equal(attempts,2);
});
