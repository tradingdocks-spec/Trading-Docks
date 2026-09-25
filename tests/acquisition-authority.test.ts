import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFinancialAcquisitions, type AcquisitionRow } from "../src/lib/purchase-history/acquisition-summary.ts";
import { summarizeAnalyticsInventory } from "../src/lib/dashboard/analytics-summary.ts";
import { saveCollectionIntake, completeCollectionIntake } from "../src/lib/collection-intake/server.ts";
const now = new Date("2026-09-24T12:00:00Z");
const purchase: AcquisitionRow = { id:"purchase", status:"completed", purchased_at:"2026-09-20T12:00:00Z", received_at:null,total_cost:"4.25",unit_count:2 };
test("financial purchase and later receipt count purchase value once",()=>{
  const before=summarizeFinancialAcquisitions([purchase],now);
  const received=summarizeFinancialAcquisitions([{...purchase,status:"received",received_at:now.toISOString()}],now);
  assert.equal(before.acquisitionCost,4.25);assert.equal(received.acquisitionCost,4.25);
  assert.equal(before.receivedUnits,0);assert.equal(received.receivedUnits,2);
  assert.equal(summarizeFinancialAcquisitions([purchase,purchase],now).purchaseCount,1);
});
test("pending/rejected/cancelled records are not financial acquisitions",()=>{
  for(const status of ["pending","declined","cancelled"]){assert.equal(summarizeFinancialAcquisitions([{...purchase,status}],now).purchaseCount,0);}
});
test("unattributed history and missing money stay unknown",()=>{
  for(const row of [{...purchase,total_cost:null},{...purchase,purchased_at:null}]){
    const result=summarizeFinancialAcquisitions([row],now);assert.equal(result.status,"INSUFFICIENT_DATA");assert.equal(result.acquisitionCost,null);
  }
});
for(const edit of ["condition","location","note","price","quantity correction"]){
  test(`${edit} does not establish acquisition or increase acquired dollars`,()=>{
    assert.equal(summarizeAnalyticsInventory([{quantity:200,inventory_value:1000,updated_at:now.toISOString(),data:{edit}}]).addedLast30Days,null);
    assert.equal(summarizeFinancialAcquisitions([purchase],now).acquisitionCost,4.25);
  });
}
test("draft save uses one RPC and preserves line identity",async()=>{
  let calls=0;
  const result=await saveCollectionIntake({supabase:{from(){throw Error("independent mutation");},rpc(name:string,args:Record<string,unknown>){
    calls++;assert.equal(name,"save_collection_intake");const input=args.p_intake as {items:{id:string}[];revision:number};
    assert.equal(input.items[0].id,"line");assert.equal(input.revision,2);return Promise.resolve({data:{intakeId:"draft",revision:3},error:null});
  }},userId:"owner",workspaceId:"workspace",input:{id:"draft",revision:2,title:"Draft",items:[{id:"line",quantity:1}]}});
  assert.equal(calls,1);assert.equal(result.error,null);
});
test("completion passes stable key and explicit receipt decision to sole finalizer",async()=>{
  const rpcCalls:unknown[]=[];const client={rpc(name:string,args:unknown){rpcCalls.push([name,args]);return Promise.resolve({data:{purchaseId:"same"},error:null});}};
  for(let i=0;i<2;i++)await completeCollectionIntake({supabase:client,input:{intakeId:"draft",actualOffer:4.25,receiveNow:false}});
  assert.deepEqual(rpcCalls[0],rpcCalls[1]);assert.deepEqual(rpcCalls[0],["finalize_intake_purchase",{p_intake_id:"draft",p_actual_offer:4.25,p_receive_now:false,p_location_id:null,p_idempotency_key:"collection-intake:draft"}]);
});
