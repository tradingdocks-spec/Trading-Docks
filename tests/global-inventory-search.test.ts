import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { searchOwnedInventory } from "../src/lib/owned-inventory-search.ts";
import { loadInventoryProvenance } from "../src/lib/inventory-provenance.ts";

type Row = Record<string, any>;
function fixtureClient(tables: Record<string, Row[]>, actor = "owner", failure = "") {
  const calls: Array<{ table: string; ids?: string[] }> = [];
  return { calls, from(table: string) {
    let rows = (tables[table] ?? []).filter(row => row.user_id === actor);
    const call: { table: string; ids?: string[] } = { table }; calls.push(call);
    let low = 0, high = 999;
    const q = {
      select() { return q; },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return q; },
      gt(key: string, value: number) { rows = rows.filter(row => row[key] > value); return q; },
      in(key: string, values: string[]) { call.ids = values; assert.ok(encodeURIComponent(values.join(',')).length < 5000); rows = rows.filter(row => values.includes(row[key])); return q; },
      or(expression: string) {
        const alternatives = expression.split(',');
        rows = rows.filter(row => alternatives.some(part => {
          const [field, op, ...rest] = part.split('.');
          if (op !== 'ilike') return false;
          const value = field.startsWith('data->>') ? row.data?.[field.slice(7)] : row[field];
          return String(value ?? '').toLowerCase().includes(rest.join('.').replace(/%/g,'').toLowerCase());
        })); return q;
      },
      order(key: string) { rows = [...rows].sort((a,b) => String(a[key]).localeCompare(String(b[key]))); return q; },
      range(a: number, b: number) { low = a; high = b; return q; },
      limit(n: number) { high = n-1; return q; },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve(table === failure ? { data: null, error: { message: "source unavailable" } } : { data: rows.slice(low,high+1), error: null }).then(resolve,reject);
      },
    };
    return q;
  }};
}
function fixtures() {
  const base = { user_id: 'owner', workspace_id: 'workspace-a', location_id: 'box', quantity: 1, data: {} };
  const inventory = Array.from({length: 1100},(_,i)=>({...base,id:`chaos-${String(i).padStart(45,'0')}`,card_name:'Unrelated card'}));
  inventory.push(...[
    {id:'z-normal',card_name:'Scavenger\'s Talent',set_code:'blb',collector_number:'111',sku:'SKU-111'},
    {id:'z-chaos-1',card_name:'Vastlands Scavenger // Bind to Life',set_code:'sos',collector_number:'166',quantity:3},
    {id:'z-chaos-2',card_name:'Dreadwing Scavenger',set_code:'fdn',collector_number:'118',quantity:5},
    {id:'z-other',card_name:'Dreadwing Scavenger',user_id:'other',workspace_id:'workspace-b'},
    {id:'z-depleted',card_name:'Scavenger\'s Talent',quantity:0},
  ].map(x=>({...base,...x})));
  return { inventory_items: inventory, inventory_locations: [{user_id:'owner',id:'box',name:'UC Bulk Boxes'}],
    chaos_sort_inventory_positions: [
      {...base,id:'p1',item_id:'z-chaos-1',batch_id:'b1',quantity:1},
      {...base,id:'p2',item_id:'z-chaos-1',batch_id:'b2',quantity:2,location_id:'binder'},
      {...base,id:'p3',item_id:'z-chaos-2',batch_id:'b1',quantity:5},
    ], chaos_sort_batches:[{user_id:'owner',id:'b1',batch_code:'CS-001'},{user_id:'owner',id:'b2',batch_code:'CS-002'}] };
}

test('scavengers finds normal and Chaos identities beyond the hosted 1000-row cap, preserving each position', async()=>{
  const client = fixtureClient(fixtures());
  const result = await searchOwnedInventory(client,'owner','scavengers');
  assert.deepEqual(result.items.map(x=>x.card_name).sort(),["Scavenger's Talent","Vastlands Scavenger // Bind to Life","Dreadwing Scavenger"].sort());
  assert.equal(result.items.find(x=>x.id==='z-chaos-2')?.quantity,5);
  assert.deepEqual(result.provenance.map(x=>x.positionId).sort(),['p1','p2','p3']);
  assert.equal(result.provenance.find(x=>x.positionId==='p2')?.locationId,'binder');
  assert.ok(result.items.every(x=>(x as Row).workspace_id==='workspace-a'));
});

test('partial names, set/collector and SKU resolve exact owned records; zero quantity excluded',async()=>{
  for(const [query,id] of [['Vastlands','z-chaos-1'],['FDN 118','z-chaos-2'],['SKU-111','z-normal']]) {
    const result = await searchOwnedInventory(fixtureClient(fixtures()),'owner',query);
    assert.deepEqual(result.items.map(x=>x.id),[id]);
  }
});

test('batch search retains exact matching positions without duplicating an item',async()=>{
  const result=await searchOwnedInventory(fixtureClient(fixtures()),'owner','CS-002');
  assert.deepEqual(result.items.map(x=>x.id),['z-chaos-1']);
  assert.deepEqual(result.provenance.map(x=>x.positionId),['p2']);
});

test('cross-tenant, anonymous, and POS delegation never broaden owner collection search',async()=>{
  for(const actor of ['other','anonymous','pos-delegated-employee']) {
    const result=await searchOwnedInventory(fixtureClient(fixtures(),actor),'owner','scavengers');
    assert.equal(result.items.length,0);
  }
  await assert.rejects(()=>searchOwnedInventory(fixtureClient(fixtures()),'','scavengers'),/Authenticated/);
});

test('provenance chunks long IDs and preserves more than one server page of positions',async()=>{
  const tables = fixtures();
  tables.chaos_sort_inventory_positions = Array.from({length: 600},(_,i)=>({user_id:'owner',id:`p${i}`,item_id:'z-chaos-1',quantity:1,location_id:'box',workspace_id:'workspace-a',data:{},batch_id:'b1'}));
  const client=fixtureClient(tables);
  assert.equal((await loadInventoryProvenance(client,'owner',['z-chaos-1'])).length,600);
  const before=client.calls.length;
  assert.deepEqual(await loadInventoryProvenance(client,'owner',[]),[]);
  assert.equal(client.calls.length,before);
});

test('inventory failure rejects only its source; UI still renders healthy result groups',async()=>{
  const results=await Promise.allSettled([searchOwnedInventory(fixtureClient(fixtures(),'owner','inventory_items'),'owner','scavengers'),Promise.resolve(['healthy deck'])]);
  assert.equal(results[0].status,'rejected'); assert.equal(results[1].status,'fulfilled');
  const ui=readFileSync('src/components/dashboard/search/GlobalSearch.tsx','utf8');
  assert.doesNotMatch(ui, /\) : loadError \? \(/);
  assert.match(ui,/role="status"/);
});
