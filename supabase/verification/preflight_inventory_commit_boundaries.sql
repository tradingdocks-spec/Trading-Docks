-- READ ONLY. Run against the explicitly verified staging project before backup/apply.
-- This inventories compatibility; it does not authorize a target or certify it.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';

select current_database() as database_name, current_user as database_role,
  current_setting('server_version') as server_version, now() as observed_at;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in
  ('inventory_items','inventory_locations','inventory_movements','marketplace_orders',
   'marketplace_order_items','inventory_import_commits')
order by table_name,ordinal_position;

select c.relname as table_name, k.conname, pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('inventory_items','inventory_locations','inventory_movements','marketplace_orders',
   'marketplace_order_items','inventory_import_commits') order by c.relname,k.conname;

select c.relname as table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and c.relname in
  ('inventory_items','inventory_locations','inventory_movements','marketplace_orders',
   'marketplace_order_items','inventory_import_commits') order by c.relname,t.tgname;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,p.proconfig as function_settings,
  md5(pg_get_functiondef(p.oid)) as definition_fingerprint,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('collector_inventory_acting_user','enforce_collector_inventory_mutation',
   'collector_effective_membership_tier','commit_order_fulfillment','commit_csv_inventory_import')
order by p.proname;

select c.relname as table_name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls,
  has_table_privilege('service_role',c.oid,'SELECT') as service_select,
  has_table_privilege('service_role',c.oid,'INSERT') as service_insert,
  has_table_privilege('service_role',c.oid,'UPDATE') as service_update,
  has_table_privilege('authenticated',c.oid,'INSERT') as client_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') as client_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in
  ('inventory_items','inventory_locations','inventory_movements','marketplace_orders',
   'marketplace_order_items','inventory_import_commits') order by c.relname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in
  ('inventory_items','inventory_locations','inventory_movements','marketplace_orders',
   'marketplace_order_items','inventory_import_commits') order by tablename,policyname;

-- The migration only checks for an insert guard; all deployed inventory guards
-- must be reviewed rather than treating that minimal check as full certification.
select count(*) filter (where tgname='enforce_collector_inventory_mutation_insert' and tgenabled in ('O','A')) as insert_guard,
  count(*) filter (where tgname='enforce_collector_inventory_mutation_update' and tgenabled in ('O','A')) as update_guard,
  count(*) filter (where tgname='enforce_collector_inventory_mutation_delete' and tgenabled in ('O','A')) as delete_guard
from pg_trigger where tgrelid=to_regclass('public.inventory_items');

commit;
