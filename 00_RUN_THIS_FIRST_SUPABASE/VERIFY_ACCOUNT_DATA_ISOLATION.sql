-- Run after 202607280004_inventory_persistence.sql and
-- 202607280005_account_data_foundation.sql.

-- 1. Every account/business table must have RLS enabled and forced status is
-- shown for review. All rows below should report rls_enabled = true.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'account_documents',
    'inventory_locations',
    'inventory_items',
    'inventory_movements',
    'workspace_employees',
    'tournaments',
    'tournament_players',
    'tournament_rounds',
    'tournament_matches'
  )
order by c.relname;

-- 2. Review the actual policies. Personal tables must compare user_id with
-- auth.uid(); store tables must use workspace membership/management helpers.
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'account_documents',
    'inventory_locations',
    'inventory_items',
    'inventory_movements',
    'workspace_employees',
    'tournaments',
    'tournament_players',
    'tournament_rounds',
    'tournament_matches'
  )
order by tablename, policyname;

-- 3. Anonymous visitors must have no table privileges. This should return zero
-- rows.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and table_name in (
    'account_documents',
    'inventory_locations',
    'inventory_items',
    'inventory_movements',
    'workspace_employees',
    'tournaments',
    'tournament_players',
    'tournament_rounds',
    'tournament_matches'
  );

-- 4. Authenticated users should have CRUD privileges, with RLS deciding which
-- specific rows are visible.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'account_documents',
    'inventory_locations',
    'inventory_items',
    'inventory_movements',
    'workspace_employees',
    'tournaments',
    'tournament_players',
    'tournament_rounds',
    'tournament_matches'
  )
group by table_name
order by table_name;

