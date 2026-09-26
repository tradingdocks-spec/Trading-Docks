// Explicit local recovery target only. Never accepts a hosted connection string.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const container = "supabase_db_trading-docks-recovery-test";
const database = "storefront_price_contract_20260926";
function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database,
    "-v", "ON_ERROR_STOP=1", "-At"], { input: query, encoding: "utf8" }).trim();
}
const checks = [];
function check(name, actual, expected) { assert.deepEqual(actual, expected, name); checks.push(name); }
const fingerprintSQL = `select json_build_object(
 'inventory',(select md5(string_agg(md5(to_jsonb(i)::text),'' order by user_id,id)) from inventory_items i),
 'events',(select md5(string_agg(md5(to_jsonb(e)::text),'' order by id)) from inventory_events e),
 'positions',(select md5(string_agg(md5(to_jsonb(p)::text),'' order by id)) from chaos_sort_inventory_positions p),
 'profiles',(select md5(string_agg(md5(to_jsonb(p)::text),'' order by id)) from showcase_profiles p))`;
const before = JSON.parse(sql(fingerprintSQL));
check("recovery equals production fingerprints", before, {
  inventory:"0fef56d528f9b9bb3d83c397935b2891",events:"85a8820f5ea75430c3440a60f0ff8093",
  positions:"b1f2188986662e4ac941542ad5f3377b",profiles:"5be86f73004ed09192f0987174d8791f",
});
check("1454 identities, 1452 published, 2 price-required, no duplicates",
 sql("select count(*)||'|'||count(*) filter(where enabled)||'|'||count(*) filter(where price_status='PRICE_REQUIRED')||'|'||count(distinct inventory_item_id) from storefront_listings"),"1454|1452|2|1454");
check("all prices and inventory/workspace references preserved",sql(`select count(*) from storefront_listings l join inventory_items i
 on i.id=l.inventory_item_id and i.user_id=l.user_id where l.storefront_listing_price is distinct from i.inventory_value
 or l.workspace_id is distinct from i.workspace_id or l.price_source<>'legacy_inventory_value' or l.price_captured_at is null`),"0");
check("all 1454 Magic",sql("select count(*) from storefront_listings where game_id='magic'"),"1454");
const zero = JSON.parse(sql(`select json_agg(x order by inventory_item_id) from (select id,inventory_item_id,enabled,price_status
 from storefront_listings where storefront_listing_price=0) x`));
check("zero inventory identities",zero.map(x=>x.inventory_item_id),[
 "chaos-3995102bbeb4450dbd3171836055c969-529c7240d437478d",
 "chaos-c60a727e2c9640d4be78e8819f46c042-d3205ae6908c4537"]);
check("zero listings disabled",zero.every(x=>!x.enabled&&x.price_status==="PRICE_REQUIRED"),true);
const catalog = JSON.parse(sql(`select jsonb_agg(item) from generate_series(0,60) p cross join lateral
 jsonb_array_elements(public.search_public_storefront_catalog('trading-docks',null,'{}','name',24,p*24,null)->'items') item`));
check("catalog 1452 distinct",new Set(catalog.map(x=>x.public_id)).size,1452);
check("catalog positive snapshots and Magic",catalog.every(x=>x.storefront_listing_price>0&&x.game==="Magic: The Gathering"),true);
check("no inventory price/ownership leakage",catalog.some(x=>'asking_price' in x||'inventory_value' in x||'user_id' in x||'workspace_id' in x),false);
const conflicts=[["Sultai Charm","ktk","204",0.24],["Serra Angel","w16","3",0.48],["Prodigy's Prototype","neo","231",1.60]];
for(const [name,set,num,price] of conflicts)check(name+" conflict preserved",catalog.find(x=>x.name===name&&x.set_code===set&&x.collector_number===num)?.storefront_listing_price,price);
check("missing store isolated",JSON.parse(sql("select search_public_storefront_catalog('not-this-store')->'profile'")),null);
check("anonymous public RPC allowed",sql("set role anon; select search_public_storefront_catalog('trading-docks')->>'total'"),"SET\n1452");
check("anonymous table access denied",sql("select has_table_privilege('anon','storefront_listings','SELECT')"),"f");
check("non-admin cannot alter listings",sql("begin; set local role authenticated; update storefront_listings set enabled=false; rollback"),"BEGIN\nSET\nUPDATE 0\nROLLBACK");
const zeroPublicIds=JSON.parse(sql(`select json_agg('position:'||md5(l.workspace_id::text||':'||p.id)) from storefront_listings l
 join chaos_sort_inventory_positions p on p.user_id=l.user_id and p.item_id=l.inventory_item_id where l.storefront_listing_price=0`));
check("zero excluded even from cart ID revalidation",sql(`select jsonb_array_length(search_public_storefront_catalog('trading-docks',null,'{"inStock":"false"}','name',24,0,
 array[${zeroPublicIds.map(x=>"'"+x+"'").join(",")}])->'items')`),"0");
const mappings=JSON.parse(readFileSync("docs/storefront-v1a-game-taxonomy-map.json","utf8")).mappings;
for(const game of mappings)for(const alias of game.aliases)check("taxonomy "+alias,sql("select resolve_storefront_game(array['"+alias.replaceAll("'","''")+"'])"),game.id);
for(const hints of ["array['Other']","array['mixed']","array['magic','pokemon']","array['magic','unknown']","array[]::text[]"])
 check("taxonomy blocks "+hints,sql("select coalesce(resolve_storefront_game("+hints+"),'BLOCKED')"),"BLOCKED");
const definition=sql("select pg_get_functiondef('search_public_storefront_catalog(text,text,jsonb,text,integer,integer,text[])'::regprocedure)");
check("catalog has no live inventory price fallback",/i\.asking_price|inventory_value|marketPrice|acquisition_cost/.test(definition),false);
// Listing-only changes rolled back; never writes inventory/events.
check("explicit storefront price edit reaches public catalog",sql(`begin; update storefront_listings set storefront_listing_price=0.99
 where inventory_item_id='chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7';
 select search_public_storefront_catalog('trading-docks','Sultai Charm')->'items'->0->>'storefront_listing_price'; rollback`),"BEGIN\nUPDATE 1\n0.99\nROLLBACK");
const migration=readFileSync("supabase/migrations/20260926025045_storefront_v1a_legacy_transition_guarded.sql","utf8");
check("migration contains no inventory/event DML",/(insert\s+into|update|delete\s+from)\s+(public\.)?(inventory_items|inventory_events|chaos_sort_inventory_positions)\b/i.test(migration),false);
const listingHash=()=>sql("select md5(string_agg(to_jsonb(l)::text,'' order by id)) from storefront_listings l");
const beforeRepeat=listingHash();
sql(migration);
check("repeat is idempotent including capture timestamps",listingHash(),beforeRepeat);
const conflictMigration=migration.replace("do $transition$", "update public.storefront_listings set storefront_listing_price=9.99 where inventory_item_id='chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7';\ndo $transition$");
let failure="";
try {sql(conflictMigration)} catch(error) {failure=String(error.stderr)}
check("conflicting destination aborts atomically",failure.includes("V1A_TRANSITION_CONFLICT"),true);
check("failed transition leaves listings intact",listingHash(),beforeRepeat);
check("all inventory/event fingerprints unchanged",JSON.parse(sql(fingerprintSQL)),before);
writeFileSync("docs/storefront-v1a-price-contract-rehearsal.json",JSON.stringify({
 status:"database rehearsal passed; browser/automated results recorded in transition report",
 container,database,checks:checks.length,passed:checks,zeroListings:zero,conflicts,publicCount:catalog.length,
 fingerprints:before,productionApplied:false,
},null,2)+"\n");
console.log(JSON.stringify({passed:checks.length,publicCount:catalog.length,zeroListings:zero},null,2));
