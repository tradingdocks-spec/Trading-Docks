import assert from 'node:assert/strict';
import { createInventoryDatabase, seedOrder, loadCommitRoute, callRoute, orderId } from './inventory-transaction-db.mjs';

export async function reproduceFulfillment() {
  const db = await createInventoryDatabase();
  try {
    await seedOrder(db);
    await db.query(`select set_config('test.fail_table','inventory_items',false)`);
    const result = await callRoute(loadCommitRoute('src/app/api/orders/fulfillment/route.ts',db),{orderId,action:'ship'});
    assert.equal(result.status,409);
    assert.match(result.body.error,/Injected inventory_items/);
    assert.equal((await db.query(`select quantity from inventory_items`)).rows[0].quantity,5);
    assert.equal((await db.query(`select fulfillment_stage from marketplace_orders`)).rows[0].fulfillment_stage,'packed');
    assert.equal((await db.query(`select inventory_deducted_at from marketplace_order_items`)).rows[0].inventory_deducted_at,null);
    assert.equal((await db.query(`select count(*)::integer as count from inventory_movements`)).rows[0].count,0);
    return {reproduced:false,status:result.status,inventoryUnchanged:true,orderUnchanged:true,ledgerUnchanged:true,environment:'Isolated PostgreSQL (PGlite), real migration and route'};
  } finally { await db.close(); }
}

export async function reproduceCsvLocation() {
  const db = await createInventoryDatabase();
  try {
    const route = loadCommitRoute('src/app/api/collector-workspace/import/route.ts',db);
    const input = {locationName:'CSV box',rows:[{name:'Test card',quantity:'1',marketPrice:'1'}]};
    const result = await callRoute(route,input,'POST');
    assert.equal(result.status,200);
    const row = (await db.query(`select i.location_id,l.id,i.data->>'locationId' as data_location
      from inventory_items i join inventory_locations l on l.user_id=i.user_id and l.id=i.location_id`)).rows[0];
    assert.ok(row); assert.equal(row.location_id,row.id); assert.equal(row.data_location,row.id);
    const replay = await callRoute(route,input,'POST');
    assert.equal(replay.body.duplicate,true);
    assert.equal((await db.query(`select count(*)::integer as count from inventory_items`)).rows[0].count,1);
    return {reproduced:false,status:result.status,locationPersisted:true,inventoryLinked:true,replayDeduplicated:true,environment:'Isolated PostgreSQL (PGlite), real migration and route'};
  } finally { await db.close(); }
}
