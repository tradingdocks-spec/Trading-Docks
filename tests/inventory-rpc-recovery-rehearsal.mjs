// Clone only the existing isolated recovery rehearsal; never touches source DB.
// No production credentials, exports, row data or private outputs enter Git.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const container='supabase_db_trading-docks-recovery-test';
const source='acquisition_rehearsal_1790295038844';
const target=`inventory_rpc_rehearsal_${Date.now()}`;
const run=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024});
assert.deepEqual(JSON.parse(run(['inspect',container]))[0].NetworkSettings.Networks,{});
const sql=(database,q)=>run(['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],q).trim();
assert.equal(sql('postgres',`select count(*) from pg_database where datname='${source}'`),'1');
sql('postgres',`create database ${target} template ${source};`);
const tables=['inventory_items','inventory_events','inventory_movements','chaos_sort_batches','chaos_sort_inventory_positions','purchase_ledger','purchase_ledger_lines','purchase_inventory_links'];
const snapshot=()=>JSON.parse(sql(target,`select jsonb_build_object(${tables.map(table=>`'${table}',(select jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(row_data::text,'' order by row_data::text),''))) from (select to_jsonb(t) row_data from public.${table} t) rows)`).join(',')})`));
const before=snapshot();
const migration=readFileSync('supabase/migrations/20260925024439_inventory_mutation_idempotency.sql','utf8');
sql(target,migration);assert.deepEqual(snapshot(),before);
sql(target,migration);assert.deepEqual(snapshot(),before);
const rls=sql(target,"select bool_and(relrowsecurity) from pg_class where oid in ('public.inventory_items'::regclass,'public.inventory_events'::regclass)");assert.equal(rls,'t');
assert.equal(sql(target,"select count(*) from pg_proc where proname in ('create_inventory_item_with_event','apply_collector_inventory_mutation') and prosrc like '%inventory-command-v1%'"),'2');
assert.equal(sql(target,"select has_function_privilege('authenticated','inventory_private.replay_inventory_command(text,jsonb)','execute')"),'f');
console.log(JSON.stringify({result:'PASS',target,version:sql(target,'show server_version'),preservedCounts:Object.fromEntries(tables.map(t=>[t,before[t].count])),checks:['all business-row digests unchanged','migration rerun unchanged','RLS retained','both existing RPCs repaired','helper execution denied to authenticated']},null,2));
