// Disposable loopback PostgreSQL 17. No .env, hosted URL or Docker fallback.
import EmbeddedPostgres from '../../.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
export async function chaosNativeFixture(port) {
 const root=resolve('.local-fixtures/chaos-forward');mkdirSync(root,{recursive:true});
 const pg=new EmbeddedPostgres({databaseDir:resolve(root,`browser-${port}-${Date.now()}`),user:'postgres',password:'local-test-only',port,persistent:true,postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog(){},onError(){}});
 await pg.initialise();await pg.start();const db=pg.getPgClient('postgres','127.0.0.1');await db.connect();
 const read=p=>readFileSync(p,'utf8');
 try {
  await db.query(read('tests/fixtures/chaos-synthetic-prerequisites.sql'));
  const foundation=read('supabase/migrations/20260923204804_chaos_scan_albums_v2.sql');
  await db.query(foundation.slice(0,foundation.indexOf('create or replace function public.chaos_scan_command')));
  const cloud=read('supabase/migrations/20260924000100_chaos_cloud_authority.sql');
  await db.query(cloud.slice(0,cloud.indexOf('create or replace function public.chaos_scan_command')));
  const capacity=read('supabase/migrations/20260924220000_chaos_active_capture_capacity.sql');
  await db.query(capacity.slice(0,capacity.indexOf('do $migration$'))+'commit;');
  for(const f of JSON.parse(read('tests/fixtures/chaos-production-functions.json')))await db.query(f.definition);
  await db.query(read('tests/fixtures/chaos-production-commit.sql'));
  await db.query(`revoke all on function public.chaos_scan_command(text,jsonb) from public,anon;
   grant execute on function public.chaos_scan_command(text,jsonb) to authenticated,service_role;
   create policy active_workspace_boundary on public.chaos_scan_albums as restrictive for all to authenticated using(public.can_current_user_access_workspace(workspace_id)) with check(public.can_current_user_access_workspace(workspace_id));
   create trigger chaos_scan_batch_guard before insert or update or delete on public.chaos_sort_batches for each row execute function chaos_scan_private.guard_batch();
   alter table storage.objects add unique(bucket_id,name);
   create table public.pos_workspace_settings(enabled boolean default false);
   grant select on public.pos_workspace_settings to authenticated;
   create function public.chaos_batch_history(p_before timestamptz default null,p_id uuid default null,p_limit integer default 25) returns jsonb language sql security definer set search_path='' as $$
    select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.chaos_sort_batches b where b.user_id=auth.uid() and b.workspace_id=public.current_inventory_workspace()
   $$;
   revoke all on function public.chaos_batch_history(timestamptz,uuid,integer) from public,anon;
   grant execute on function public.chaos_batch_history(timestamptz,uuid,integer) to authenticated;`);
  await db.query(read('supabase/migrations/20260927163241_chaos_scan_images_forward.sql'));
  return {pg,db};
 } catch(error){await db.end();await pg.stop();throw error;}
}
