-- Trading Docks authentication, profiles, workspaces, and tenant security.
-- Run this once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.user_preferences enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Members can view workspaces" on public.workspaces;
create policy "Members can view workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces"
on public.workspaces for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Members can view workspace membership" on public.workspace_members;
create policy "Members can view workspace membership"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can add workspace members" on public.workspace_members;
create policy "Admins can add workspace members"
on public.workspace_members for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Admins can update workspace members" on public.workspace_members;
create policy "Admins can update workspace members"
on public.workspace_members for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Admins can remove workspace members" on public.workspace_members;
create policy "Admins can remove workspace members"
on public.workspace_members for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "Users manage their preferences" on public.user_preferences;
create policy "Users manage their preferences"
on public.user_preferences for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'Trading Docks Owner'
  );

  insert into public.profiles (id, full_name)
  values (new.id, display_name)
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('Trading Docks', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.user_preferences (user_id, active_workspace_id)
  values (new.id, new_workspace_id)
  on conflict (user_id) do update
    set active_workspace_id = excluded.active_workspace_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute procedure public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute procedure public.set_updated_at();
