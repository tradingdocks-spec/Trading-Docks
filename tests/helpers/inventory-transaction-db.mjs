import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

export const actor = '00000000-0000-4000-8000-000000000001';
export const otherActor = '00000000-0000-4000-8000-000000000002';
export const orderId = '10000000-0000-4000-8000-000000000001';
export const secondOrderId = '10000000-0000-4000-8000-000000000002';
export const migrationPath = 'supabase/migrations/202609060001_inventory_commit_boundaries_proposal.sql';

export async function createInventoryDatabase() {
  const db = await PGlite.create();
  // Only identity/provider prerequisites are fixtures. Inventory/order tables,
  // quantity triggers and commit functions come from the actual migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table public.profiles(id uuid primary key);
    create table public.user_preferences(user_id uuid primary key);
    create table public.admin_membership_overrides(user_id uuid primary key, plan_id text);
    create table public.billing_subscriptions(user_id uuid primary key, plan_id text, status text, current_period_end timestamptz);
    create table public.marketplace_listing_mappings(inventory_item_id text, match_status text);
    create table public.marketplace_credentials(id text);
    create table public.platform_marketplace_integrations(id text);
  `);
  for (const file of [
    '202607280004_inventory_persistence.sql',
    '202607290005_ebay_read_only_importer.sql',
    '202608010001_universal_orders_center.sql',
    '202608010004_order_fulfillment.sql',
    '202608050001_collector_mutation_security_proposal.sql',
    '202608100002_security_authority.sql',
    '202609060001_inventory_commit_boundaries_proposal.sql',
  ]) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(`
    grant usage on schema public,auth to service_role,authenticated,anon;
    grant all on all tables in schema public to service_role;
    insert into auth.users values ('${actor}'),('${otherActor}');
    insert into public.profiles select id from auth.users;
    insert into public.user_preferences select id from auth.users;
    insert into public.billing_subscriptions(user_id,plan_id,status) select id,'seller','active' from auth.users;
    create function public.inject_commit_failure() returns trigger language plpgsql as $$
    begin
      if current_setting('test.fail_table', true) = tg_table_name then
        raise exception 'Injected % write failure', tg_table_name;
      end if;
      return new;
    end $$;
  `);
  for (const table of ['inventory_items','inventory_locations','inventory_movements','marketplace_order_items','marketplace_orders','inventory_import_commits']) {
    await db.exec(`create trigger inject_failure before insert or update on public.${table} for each row execute function public.inject_commit_failure()`);
  }
  return db;
}

export async function resetInventoryDatabase(db) {
  await db.exec(`reset role; select set_config('test.fail_table','',false);
    truncate public.inventory_import_commits, public.inventory_items, public.inventory_locations, public.inventory_movements, public.marketplace_order_items, public.marketplace_orders;
    update public.billing_subscriptions set plan_id = 'seller';`);
}

export async function seedOrder(db, { id = orderId, quantity = 5, required = 2, user = actor, itemId = 'item-a' } = {}) {
  await db.exec(`reset role`);
  await db.query(`select set_config('app.collector_authorized_user_id',$1,false)`, [user]);
  await db.query(`insert into inventory_items(id,user_id,card_name,sku,quantity,inventory_value,data)
    values($1,$2,'Test card','sku-a',$3,$3*10,jsonb_build_object('id',$1::text,'name','Test card','quantity',$3::integer,'value',$3::integer*10)) on conflict do nothing`, [itemId,user,quantity]);
  await db.query(`insert into marketplace_orders(id,user_id,marketplace_id,external_order_id,fulfillment_stage)
    values($1::uuid,$2,'test',$1::text,'packed')`, [id,user]);
  await db.query(`insert into marketplace_order_items(user_id,marketplace_order_id,external_line_item_id,title,quantity,inventory_item_id)
    values($1,$2,'line-1','Test card',$3,$4)`, [user,id,required,itemId]);
}

export function sqlClient(db) {
  return {
    async rpc(name, args) {
      try {
        await db.exec('set role service_role');
        const query = name === 'commit_order_fulfillment'
          ? ['select public.commit_order_fulfillment($1,$2,$3,$4) as result', [args.actor_id,args.order_ids,args.requested_action,JSON.stringify(args.details)]]
          : ['select public.commit_csv_inventory_import($1,$2,$3) as result', [args.actor_id,args.import_key,JSON.stringify(args.payload)]];
        const response = await db.query(...query);
        return { data: response.rows[0].result, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
    },
  };
}

// Execute the production route and its real pure helpers, replacing only the
// framework response and the authenticated/database environment.
export function loadCommitRoute(path, db, { user = actor, denied = false } = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Error, require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name === '@/lib/platform/server-access') return { requireApiCapability: async () => denied
        ? { ok: false, response: Response.json({error:'Denied'}, {status:403}) }
        : { ok: true, user: { id:user } } };
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => sqlClient(db) };
      if (name === 'node:crypto') return cryptoModule;
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      throw new Error(`Unexpected route dependency ${name}`);
    } });
    return exports;
  }
  return load(path);
}

import * as cryptoModule from 'node:crypto';

export async function callRoute(route, body, method = 'PATCH') {
  const response = await route[method](new Request('http://test.invalid/commit', {
    method, headers: {'content-type':'application/json'}, body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}
