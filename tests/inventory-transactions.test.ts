import assert from 'node:assert/strict';
import fs from 'node:fs';
import { before, beforeEach, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { prepareInventoryImport } from '../src/lib/csv-conversion/inventory-import.ts';
import { buildCollectionCards, filterCollectionCards } from '../mobile/services/collector-workspace.ts';
import {
  actor, otherActor, orderId, secondOrderId, createInventoryDatabase, resetInventoryDatabase,
  seedOrder, loadCommitRoute, callRoute, migrationPath,
} from './helpers/inventory-transaction-db.mjs';

let db: PGlite;
before(async () => { db = await createInventoryDatabase(); });
beforeEach(async () => { await resetInventoryDatabase(db); });
after(async () => { await db?.close(); });
const fulfillment = () => loadCommitRoute('src/app/api/orders/fulfillment/route.ts', db);
const bulk = () => loadCommitRoute('src/app/api/orders/bulk/route.ts', db);
const csv = (options = {}) => loadCommitRoute('src/app/api/collector-workspace/import/route.ts', db, options);
const input = { locationName:'CSV Box', rows:[{name:'Test card',quantity:'2',marketPrice:'10',set:'tst',finish:'Foil'}] };
const ship = () => callRoute(fulfillment(), {orderId,action:'ship'});
async function counts() {
  const { rows } = await db.query(`select
    (select count(*)::integer from inventory_locations) as locations,
    (select count(*)::integer from inventory_items) as items,
    (select count(*)::integer from inventory_movements) as movements,
    (select count(*)::integer from inventory_import_commits) as commits`);
  return rows[0];
}
async function stock() { return (await db.query<{quantity:number;data:{quantity:number}}>(`select quantity,data from inventory_items where id='item-a'`)).rows[0]; }
async function failAt(table: string) { await db.query(`select set_config('test.fail_table',$1,false)`, [table]); }

test('fulfillment commits stock, JSON quantity, ledger, deduction marker and shipped order together', async () => {
  await seedOrder(db);
  const result = await ship();
  assert.equal(result.status,200); assert.equal(result.body.stage,'shipped');
  assert.equal((await stock()).quantity,3); assert.equal((await stock()).data.quantity,3);
  assert.equal((await counts()).movements,1);
  assert.ok((await db.query(`select inventory_deducted_at from marketplace_order_items`)).rows[0].inventory_deducted_at);
});

for (const table of ['inventory_items','inventory_movements','marketplace_order_items','marketplace_orders']) {
  test(`fulfillment ${table} failure rolls back everything; retry deducts once`, async () => {
    await seedOrder(db); await failAt(table);
    const failed = await ship();
    assert.equal(failed.status,409); assert.match(failed.body.error,/Injected/);
    assert.equal((await stock()).quantity,5); assert.equal((await counts()).movements,0);
    const order = (await db.query(`select fulfillment_stage from marketplace_orders`)).rows[0];
    assert.equal(order.fulfillment_stage,'packed');
    assert.equal((await db.query(`select inventory_deducted_at from marketplace_order_items`)).rows[0].inventory_deducted_at,null);
    await failAt(''); assert.equal((await ship()).status,200); assert.equal((await stock()).quantity,3);
    assert.equal((await ship()).status,200); assert.equal((await stock()).quantity,3);
    assert.equal((await counts()).movements,1);
  });
}

test('bulk shipped and delivered use the same idempotent inventory boundary', async () => {
  await seedOrder(db);
  assert.equal((await callRoute(bulk(),{ids:[orderId],status:'shipped'})).status,200);
  assert.equal((await callRoute(bulk(),{ids:[orderId],status:'delivered'})).status,200);
  assert.equal((await ship()).body.stage,'completed');
  assert.equal((await stock()).quantity,3); assert.equal((await counts()).movements,1);
});

test('bulk partial shortage rolls back deductions from earlier orders and can be retried', async () => {
  await seedOrder(db,{quantity:3,required:2});
  await seedOrder(db,{id:secondOrderId,required:2});
  const response = await callRoute(bulk(),{ids:[orderId,secondOrderId],status:'shipped'});
  assert.equal(response.status,409); assert.equal((await stock()).quantity,3);
  assert.equal((await counts()).movements,0);
  assert.deepEqual((await db.query(`select distinct fulfillment_stage from marketplace_orders`)).rows,[{fulfillment_stage:'packed'}]);
  await db.exec(`update inventory_items set quantity=4`);
  assert.equal((await callRoute(bulk(),{ids:[orderId,secondOrderId],status:'shipped'})).status,200);
  assert.equal((await stock()).quantity,0); assert.equal((await counts()).movements,2);
});

test('ambiguous historical deduction is not deducted again or reported as shipped', async () => {
  await seedOrder(db);
  await db.exec(`update marketplace_order_items set inventory_deducted_at=now()`);
  assert.equal((await ship()).status,409); assert.equal((await stock()).quantity,5);
});

test('ownership mismatch in bulk request rolls back own orders too', async () => {
  await seedOrder(db);
  await seedOrder(db,{id:secondOrderId,user:otherActor,itemId:'other-item'});
  const result = await callRoute(bulk(),{ids:[orderId,secondOrderId],status:'shipped'});
  assert.equal(result.status,404); assert.equal((await stock()).quantity,5);
  assert.equal((await counts()).movements,0);
});

test('CSV new location, inventory, movement and receipt commit together and duplicate upload is a replay', async () => {
  const first = await callRoute(csv(),input,'POST');
  assert.equal(first.status,200); assert.equal(first.body.duplicate,false);
  const second = await callRoute(csv(),input,'POST');
  assert.equal(second.status,200); assert.equal(second.body.duplicate,true);
  assert.equal(first.body.batchId,second.body.batchId);
  assert.deepEqual(await counts(),{locations:1,items:1,movements:1,commits:1});
});

test('CSV existing location is reused and authoritative counters are recomputed', async () => {
  await db.exec(`insert into inventory_locations(id,user_id,name,data) values('existing','${actor}','CSV Box','{"itemCount":999}')`);
  const result = await callRoute(csv(),input,'POST');
  assert.equal(result.status,200); assert.equal(result.body.locationId,'existing');
  assert.equal((await db.query(`select data->>'itemCount' as count from inventory_locations`)).rows[0].count,'2');
  assert.equal((await counts()).locations,1);
});

for (const table of ['inventory_locations','inventory_items','inventory_movements','inventory_import_commits']) {
  test(`CSV ${table} failure leaves no orphans; same import retries once`, async () => {
    await failAt(table);
    const failed = await callRoute(csv(),input,'POST');
    assert.equal(failed.status,409); assert.match(failed.body.error,/Injected/);
    assert.deepEqual(await counts(),{locations:0,items:0,movements:0,commits:0});
    await failAt('');
    assert.equal((await callRoute(csv(),input,'POST')).status,200);
    assert.equal((await callRoute(csv(),input,'POST')).body.duplicate,true);
    assert.deepEqual(await counts(),{locations:1,items:1,movements:1,commits:1});
  });
}

test('CSV late failure across more than the former 500-row chunk rolls back every row and location', async () => {
  const rows = Array.from({length:501},(_,i) => ({name:`Card ${i}`,quantity:'1',marketPrice:'1'}));
  await db.exec(`create function public.fail_last_import_row() returns trigger language plpgsql as $$ begin
    if new.id like '%:501' then raise exception 'Injected last row failure'; end if; return new; end $$;
    create trigger fail_last_row before insert on inventory_items for each row execute function fail_last_import_row()`);
  try {
    assert.equal((await callRoute(csv(),{...input,rows},'POST')).status,409);
    assert.deepEqual(await counts(),{locations:0,items:0,movements:0,commits:0});
  } finally { await db.exec('reset role; drop trigger fail_last_row on inventory_items; drop function fail_last_import_row()'); }
  assert.equal((await callRoute(csv(),{...input,rows},'POST')).status,200);
  assert.equal((await callRoute(csv(),{...input,rows},'POST')).body.duplicate,true);
  assert.deepEqual(await counts(),{locations:1,items:501,movements:501,commits:1});
});

test('CSV retains database membership limit enforcement and rolls back new locations', async () => {
  await db.exec(`update billing_subscriptions set plan_id='free'`);
  const result = await callRoute(csv(),{...input,rows:[{name:'Too many',quantity:'501',marketPrice:'1'}]},'POST');
  assert.equal(result.status,409); assert.match(result.body.error,/FREE_LIMIT/);
  assert.deepEqual(await counts(),{locations:0,items:0,movements:0,commits:0});
});

test('imported records resolve through the actual Inventory/Location view model and batch receipt', async () => {
  const result = await callRoute(csv(),input,'POST');
  assert.equal(result.status,200);
  const items = (await db.query(`select * from inventory_items`)).rows;
  const locations = (await db.query(`select * from inventory_locations`)).rows;
  const cards = buildCollectionCards({items,locations,tradeStatuses:[],wishlist:[]});
  assert.equal(cards.length,1);
  assert.equal(filterCollectionCards(cards,{storageLocationId:result.body.locationId}).length,1);
  assert.equal(items[0].location_id,result.body.locationId);
  assert.equal((items[0].data as {importBatchId:string}).importBatchId,result.body.batchId);
});

test('canonical identity survives row ordering and field ordering without collapsing duplicate source rows', () => {
  const first = prepareInventoryImport({...input,rows:[{name:'A',quantity:'2'},{name:'B',quantity:'1'},{name:'A',quantity:'2'}]});
  const second = prepareInventoryImport({...input,rows:[{quantity:2,name:'A'},{quantity:2,name:'A'},{quantity:1,name:'B'}]});
  assert.equal(first.importKey,second.importKey); assert.equal(first.payload.items.length,3);
});

test('server-only functions deny direct authenticated callers', async () => {
  await db.exec('set role authenticated');
  await assert.rejects(db.query(`select commit_order_fulfillment($1,$2,'ship','{}')`,[actor,[orderId]]),/permission denied/);
  await assert.rejects(db.query(`select commit_csv_inventory_import($1,$2,'{}')`,[actor,'a'.repeat(64)]),/permission denied/);
});

test('capability failure never invokes the database import', async () => {
  assert.equal((await callRoute(csv({denied:true}),input,'POST')).status,403);
  assert.deepEqual(await counts(),{locations:0,items:0,movements:0,commits:0});
});

test('duplicate submissions queued together return one deduction and ledger event', async () => {
  await seedOrder(db);
  const results = await Promise.all([ship(),ship()]);
  assert.deepEqual(results.map(result => result.status),[200,200]);
  assert.equal((await stock()).quantity,3); assert.equal((await counts()).movements,1);
  // PGlite has one connection: staging must additionally prove multi-connection contention.
});

test('case-only destination edits replay the import and preserve the original location label', async () => {
  const first = await callRoute(csv(),input,'POST');
  const second = await callRoute(csv(),{...input,locationName:'csv box'},'POST');
  assert.equal(second.body.duplicate,true); assert.equal(second.body.locationName,'CSV Box');
  assert.equal(first.body.locationId,second.body.locationId);
});

test('same CSV belongs to each authenticated actor separately and ignores a supplied user ID', async () => {
  await callRoute(csv(),{...input,userId:otherActor},'POST');
  await callRoute(csv({user:otherActor}),input,'POST');
  const owners = (await db.query(`select distinct user_id from inventory_items order by user_id`)).rows;
  assert.deepEqual(owners,[{user_id:actor},{user_id:otherActor}]);
});

test('invalid order action and malformed CSV fail before any writes', async () => {
  assert.equal((await callRoute(fulfillment(),{orderId,action:'invented'})).status,400);
  assert.equal((await callRoute(csv(),{...input,rows:[{name:'Card',quantity:0}]},'POST')).status,400);
  assert.deepEqual(await counts(),{locations:0,items:0,movements:0,commits:0});
});

test('fulfillment updates location totals atomically, including rollback on location failure', async () => {
  await seedOrder(db);
  await db.exec(`insert into inventory_locations(id,user_id,name,data) values('box','${actor}','Box','{"itemCount":5,"estimatedValue":50}');
    update inventory_items set location_id='box',data=data || '{"locationId":"box"}'`);
  await failAt('inventory_locations');
  assert.equal((await ship()).status,409); assert.equal((await stock()).quantity,5);
  assert.equal((await counts()).movements,0);
  await failAt(''); assert.equal((await ship()).status,200);
  const data = (await db.query(`select data from inventory_locations`)).rows[0].data;
  assert.deepEqual(data,{itemCount:3,estimatedValue:30});
});

test('refund status preserves the completed deduction ledger and cannot trigger another shipment', async () => {
  await seedOrder(db); await ship();
  assert.equal((await callRoute(bulk(),{ids:[orderId],status:'refunded'})).status,200);
  assert.equal((await ship()).status,409);
  assert.equal((await stock()).quantity,3); assert.equal((await counts()).movements,1);
});

test('proposal replay preserves committed receipts and continues to deduplicate imports', async () => {
  const first = await callRoute(csv(),input,'POST');
  await db.exec('reset role');
  await db.exec(fs.readFileSync(migrationPath,'utf8'));
  const second = await callRoute(csv(),input,'POST');
  assert.equal(second.body.batchId,first.body.batchId); assert.equal(second.body.duplicate,true);
  assert.deepEqual(await counts(),{locations:1,items:1,movements:1,commits:1});
});
