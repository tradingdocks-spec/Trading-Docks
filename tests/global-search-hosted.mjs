import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {searchOwnedInventory} from '../src/lib/owned-inventory-search.ts';
const f=JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json','utf8'));
assert.equal(f.project,'ukrcbmujzdyclrkghbvo');
const keys=JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json','utf8').replace(/^\uFEFF/,''));
const key=keys.find(k=>k.name==='anon').api_key;
const client=createClient(`https://${f.project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
assert.equal((await client.auth.signInWithPassword(f.users.owner)).error,null);
const ids=await client.from('inventory_items').select('id').eq('user_id',f.users.owner.id).gt('quantity',0).order('card_name').order('id').limit(5000);
assert.equal(ids.error,null);
const old=await client.from('chaos_sort_inventory_positions').select('id,item_id,batch_id,position,quantity,location_id,condition,finish,language').eq('user_id',f.users.owner.id).gt('quantity',0).limit(5000).in('item_id',ids.data.map(x=>x.id));
console.log(JSON.stringify({legacyRows:ids.data.length,legacyStatus:old.status,legacyError:old.error?.message}));
for(const query of ['scavengers','performance card',f.prefix]) {
 const start=performance.now();const result=await searchOwnedInventory(client,f.users.owner.id,query);
 console.log(JSON.stringify({query:query===f.prefix?'location':query,items:result.items.length,positions:result.provenance.length,ms:Math.round(performance.now()-start),names:query==='scavengers'?result.items.map(x=>x.card_name):undefined}));
 if(query==='performance card') assert.equal(result.items.length,100);
}
for(const role of ['other','delegated','nondelegated']) {
 const c=createClient(`https://${f.project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await c.auth.signInWithPassword(f.users[role])).error,null);
 const result=await searchOwnedInventory(c,f.users[role].id,'performance card');
 assert.equal(result.items.length,0);console.log('PASS hosted '+role+' current-user search does not inherit owner collection');
 const ownerResults=await searchOwnedInventory(c,f.users.owner.id,'performance card');
 if(role==='delegated' || role==='nondelegated') {
   assert.ok(ownerResults.items.length>0);
   assert.ok(ownerResults.items.every(i=>i.workspace_id===f.workspace && i.location_id===f.location));
   console.log('PASS existing member RLS reads stay within fixture workspace/location (not a POS write grant)');
 } else {assert.equal(ownerResults.items.length,0);console.log('PASS '+role+' explicit cross-owner query denied');}

}
const anonymous=createClient(`https://${f.project}.supabase.co`,key,{auth:{persistSession:false}});
try {const r=await searchOwnedInventory(anonymous,f.users.owner.id,'performance card');assert.equal(r.items.length,0);}catch(e){assert.match(e.message,/permission denied|unavailable/);}
console.log('PASS hosted anonymous denial');
