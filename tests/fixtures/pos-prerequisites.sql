-- Disposable-test prerequisite contract, not a replacement for full migration
-- replay. Auth schema/roles emulate Supabase; stock tables use real migrations.
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key,banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.workspaces(id uuid primary key,name text,owner_id uuid references auth.users(id));
create table public.workspace_members(workspace_id uuid references public.workspaces(id),user_id uuid references auth.users(id),role text,primary key(workspace_id,user_id));
create table public.workspace_employees(id uuid primary key default gen_random_uuid(),workspace_id uuid,linked_user_id uuid,employment_status text, full_name text default 'Test operator', permissions jsonb not null default '{}');
create table public.user_preferences(user_id uuid primary key,active_workspace_id uuid,preferences jsonb default '{}');
create table public.profiles(id uuid primary key);
create table public.admin_membership_overrides(user_id uuid primary key,plan_id text);
create table public.billing_subscriptions(user_id uuid primary key,plan_id text,status text,current_period_end timestamptz);
create type public.admin_role as enum('owner','admin','user');
create function public.current_admin_role() returns public.admin_role language sql as $$select 'user'::public.admin_role$$;
create function public.is_workspace_member(w uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid())$$;
create function public.is_workspace_admin(w uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role in ('owner','admin'))$$;
create function public.is_admin() returns boolean language sql as $$select false$$;
create table public.marketplace_connections(id uuid primary key);
create table public.chaos_sort_batches(id uuid primary key,user_id uuid references auth.users(id),batch_code text,title text,status text,source_count int,confirmed_count int,destination_location_id text,destination_label text,updated_at timestamptz default now(),created_at timestamptz default now());
