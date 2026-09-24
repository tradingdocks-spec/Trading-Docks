// Read-only SQL adapter for the retained Supabase production-shaped recovery DB.
// Hosted REST behavior is tested separately in global-search-hosted.mjs.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchOwnedInventory } from '../src/lib/owned-inventory-search.ts';
const container='supabase_db_trading-docks-recovery-test';
const db=JSON.parse(readFileSync('.local-fixtures/cloud-tenant-repair-test-results.json','utf8')).database;
assert.match(db,/^tenant_audit_\d+$/);
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.match(info.Config.Image,/supabase\/postgres:17/);
assert.deepEqual(info.NetworkSettings.Networks,{});
const owner='3ea45327-7984-4108-ada8-511748e73fd8';
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const column=c=>{assert.match(c,/^[a-zA-Z_]+(?:->>[a-zA-Z_]+)?$/);const [a,b]=c.split('->>');return '"'+a+'"'+(b?'->>'+quote(b):'');};
const run=sql=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'}).trim();
function client(actor) { return {
  async rpc(name) {
    assert.equal(name,'current_inventory_workspace');
    const data=run(`begin read only; set local request.jwt.claim.sub=${quote(actor)}; set local role authenticated; select public.current_inventory_workspace(); rollback;`);
    return {data,error:null};
  },from(table) {
  assert.ok(['inventory_items','inventory_locations','chaos_sort_inventory_positions','chaos_sort_batches'].includes(table));
  let fields='*',where=[],order=[],offset=0,limit=1000;
  const q={
    select(v){fields=v.split(',').map(x=>column(x.trim())).join(',');return q;},
    eq(k,v){where.push(column(k)+'='+quote(v));return q;},
    gt(k,v){where.push(column(k)+'>'+quote(v));return q;},
    in(k,vs){where.push(column(k)+' in ('+vs.map(quote).join(',')+')');return q;},
    order(k){order.push(column(k));return q;},
    range(a,b){offset=a;limit=b-a+1;return q;},
    limit(n){limit=n;return q;},
    or(expression){
      const terms=expression.split(/,(?![^()]*\))/).map(part=>{
        if(part.includes('.ilike.')) {const [k,v]=part.split('.ilike.');return column(k)+' ilike '+quote(v);}
        const [k,vs]=part.split('.in.');assert.ok(vs);
        return column(k)+' in ('+vs.slice(1,-1).split(',').map(v=>quote(v.replace(/^"|"$/g,''))).join(',')+')';
      });where.push('('+terms.join(' or ')+')');return q;
    },
    then(resolve,reject){return Promise.resolve().then(()=>{
      const sql=`begin read only; select set_config('request.jwt.claim.sub',${quote(actor)},true); set local role authenticated;
      select coalesce(jsonb_agg(r),'[]') from (select ${fields} from public.${table} ${where.length?'where '+where.join(' and '):''} ${order.length?'order by '+order.join(','):''} limit ${limit} offset ${offset}) r; rollback;`;
      const output=run(sql).split('\n');return {data:JSON.parse(output.at(-1)),error:null};
    }).then(resolve,reject);},
  };return q;
}};}
const baseline=run("select count(*)||':'||sum(quantity) from public.inventory_items;");
const r=await searchOwnedInventory(client(owner),owner,'scavengers');
assert.ok(r.items.some(i=>i.card_name==='Vastlands Scavenger // Bind to Life'));
assert.ok(r.items.some(i=>i.card_name==='Dreadwing Scavenger' && i.quantity>1));
assert.ok(r.items.every(i=>i.user_id===owner && i.quantity>0));
assert.ok(r.provenance.length>0);
assert.equal(new Set(r.provenance.map(p=>p.positionId)).size,r.provenance.length);
console.log(JSON.stringify({result:'PASS production-shaped Supabase search',items:r.items.map(i=>({name:i.card_name,quantity:i.quantity})),positions:r.provenance.length}));
assert.equal(run("select count(*)||':'||sum(quantity) from public.inventory_items;"),baseline);
console.log('PASS read-only rehearsal, inventory counts unchanged');
