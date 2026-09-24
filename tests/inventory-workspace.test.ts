import test from 'node:test';
import assert from 'node:assert/strict';
import {currentInventoryWorkspace} from '../mobile/services/inventory-workspace.ts';

test('inventory scope comes from the database, not a supplied browser workspace',async()=>{
  assert.equal(await currentInventoryWorkspace({rpc:async(name)=>{
    assert.equal(name,'current_inventory_workspace');
    return {data:'validated-workspace',error:null};
  }}),'validated-workspace');
});

test('missing, invalid, or denied workspace fails closed',async()=>{
  for(const data of [null,undefined,'',{},[]]){
    await assert.rejects(currentInventoryWorkspace({rpc:async()=>({data,error:null})}),/authorized active workspace/);
  }
  await assert.rejects(currentInventoryWorkspace({rpc:async()=>({data:'untrusted',error:{message:'INVENTORY_WORKSPACE_FORBIDDEN'}})}),/INVENTORY_WORKSPACE_FORBIDDEN/);
});
