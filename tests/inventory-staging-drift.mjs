// Read-only repository-to-hosted inventory column audit; never loads app dotenv.
import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const f=JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json','utf8'));
assert.equal(f.project,'ukrcbmujzdyclrkghbvo');
const expected=new Set(), sources=[];
for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) {
  const raw=readFileSync('supabase/migrations/'+file,'utf8');
  const sql=raw.replace(/--[^\n]*/g,'');let contributed=false;
  for(const m of sql.matchAll(/create table if not exists public\.inventory_items\s*\(([\s\S]*?)\n\);/gi)) {
    for(const c of m[1].matchAll(/^\s*(\w+)\s+(?:text|uuid|integer|numeric|jsonb|timestamptz)\b/gm)) {expected.add(c[1]);contributed=true;}
  }
  for(const m of sql.matchAll(/alter table public\.inventory_items\b([\s\S]*?);/gi)) {
    for(const c of m[1].matchAll(/add column(?: if not exists)?\s+(\w+)/gi)) {expected.add(c[1]);contributed=true;}
  }
  if(contributed) sources.push({file,sha256:createHash('sha256').update(raw).digest('hex')});
}
assert.ok(expected.has('game_id') && expected.has('tcgplayer_sku_id') && expected.size>=33);
const keys=JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json','utf8').replace(/^\uFEFF/,''));
const c=createClient(`https://${f.project}.supabase.co`,keys.find(k=>k.name==='anon').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
assert.equal((await c.auth.signInWithPassword(f.users.owner)).error,null);
const columns=[...expected].sort();
const r=await c.from('inventory_items').select(columns.join(',')).limit(1);
assert.equal(r.error,null);assert.equal(r.data.length,1);
assert.deepEqual(Object.keys(r.data[0]).sort(),columns);
const boundaries=[];
for(const role of ['other','delegated','anonymous']) {
  const actor=createClient(`https://${f.project}.supabase.co`,keys.find(k=>k.name==='anon').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(role!=='anonymous') assert.equal((await actor.auth.signInWithPassword(f.users[role])).error,null);
  const result=await actor.from('inventory_items').update({game_id:'pokemon'}).eq('user_id',f.users.owner.id).eq('id',r.data[0].id).select('id');
  assert.ok(result.error || result.data.length===0,`${role} cannot mutate owner identity`);
  const helper=await actor.rpc('inventory_identity_trusted_backfill');
  assert.ok(helper.error,'No migration-only RPC exists');
  if(role!=='delegated') {
    const read=await actor.from('inventory_items').select('id').eq('user_id',f.users.owner.id);
    assert.ok(read.error || read.data.length===0);
  }
  boundaries.push(`${role}: inventory mutation denied; no backfill RPC`);
}
const after=await c.from('inventory_items').select(columns.join(',')).eq('id',r.data[0].id).single();
assert.equal(after.error,null);assert.deepEqual(after.data,r.data[0]);
writeFileSync('docs/inventory-staging-drift.json',JSON.stringify({at:new Date().toISOString(),project:f.project,status:'PASS',scope:'inventory_items columns declared by repository CREATE/ALTER migrations; authenticated Data API schema-cache validation',columns,missingColumns:[],boundaries,sources},null,2));
console.log(`PASS all ${columns.length} repository inventory columns available through hosted authenticated API`);
