-- Trading Docks Command Center RBAC foundation
-- Review this migration before running if your project already defines similarly named objects.

do $$ begin
  create type public.admin_role as enum ('owner', 'admin', 'support', 'analyst');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'free' check (account_type in ('free','collector','seller','store')),
  subscription_status text not null default 'free' check (subscription_status in ('free','trialing','active','past_due','canceled','suspended')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.user_roles enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_account_access enable row level security;

create or replace function public.current_admin_role()
returns public.admin_role
language sql stable security definer set search_path = public
as $$ select role from public.user_roles where user_id = auth.uid() $$;

create or replace function public.is_admin(minimum_role public.admin_role default 'analyst')
returns boolean
language sql stable security definer set search_path = public
as $$
  select case minimum_role
    when 'owner' then public.current_admin_role() = 'owner'
    when 'admin' then public.current_admin_role() in ('owner','admin')
    when 'support' then public.current_admin_role() in ('owner','admin','support')
    else public.current_admin_role() is not null
  end
$$;

-- Recreate policies safely.
drop policy if exists "admins can read roles" on public.user_roles;
drop policy if exists "owners can manage roles" on public.user_roles;
drop policy if exists "admins can read audit" on public.admin_audit_log;
drop policy if exists "admins can insert audit" on public.admin_audit_log;
drop policy if exists "admins can read account access" on public.admin_account_access;
drop policy if exists "admins can manage account access" on public.admin_account_access;

create policy "admins can read roles" on public.user_roles for select using (public.is_admin('support'));
create policy "owners can manage roles" on public.user_roles for all using (public.is_admin('owner')) with check (public.is_admin('owner'));
create policy "admins can read audit" on public.admin_audit_log for select using (public.is_admin('analyst'));
create policy "admins can insert audit" on public.admin_audit_log for insert with check (public.is_admin('support'));
create policy "admins can read account access" on public.admin_account_access for select using (public.is_admin('support'));
create policy "admins can manage account access" on public.admin_account_access for all using (public.is_admin('admin')) with check (public.is_admin('admin'));

create or replace function public.admin_list_users(search_text text default '', result_limit integer default 100)
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_type text,
  subscription_status text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin('support') then raise exception 'Admin access required'; end if;
  return query
    select u.id, u.email::text,
      coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')::text,
      coalesce(a.account_type, 'free')::text,
      coalesce(a.subscription_status, 'free')::text,
      r.role::text,
      u.created_at, u.last_sign_in_at
    from auth.users u
    left join public.admin_account_access a on a.user_id = u.id
    left join public.user_roles r on r.user_id = u.id
    where coalesce(search_text,'') = ''
       or coalesce(u.email,'') ilike '%' || search_text || '%'
       or coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','') ilike '%' || search_text || '%'
    order by u.created_at desc
    limit least(greatest(result_limit,1),500);
end $$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin('analyst') then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'active_subscriptions', (select count(*) from public.admin_account_access where subscription_status in ('active','trialing')),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'admin_users', (select count(*) from public.user_roles)
  );
end $$;

create or replace function public.admin_update_user_access(target_user_id uuid, next_account_type text, next_subscription_status text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare actor_email_value text;
begin
  if not public.is_admin('admin') then raise exception 'Administrator access required'; end if;
  if next_account_type not in ('free','collector','seller','store') then raise exception 'Invalid account type'; end if;
  if next_subscription_status not in ('free','trialing','active','past_due','canceled','suspended') then raise exception 'Invalid subscription status'; end if;
  insert into public.admin_account_access(user_id,account_type,subscription_status,updated_at,updated_by)
  values(target_user_id,next_account_type,next_subscription_status,now(),auth.uid())
  on conflict(user_id) do update set account_type=excluded.account_type,subscription_status=excluded.subscription_status,updated_at=now(),updated_by=auth.uid();
  select u.email into actor_email_value from auth.users u where u.id=auth.uid();
  insert into public.admin_audit_log(actor_id,actor_email,action,target_type,target_id,metadata)
  values(auth.uid(),actor_email_value,'update_user_access','user',target_user_id::text,jsonb_build_object('account_type',next_account_type,'subscription_status',next_subscription_status));
end $$;

-- One-time bootstrap helper for use from the Supabase SQL Editor only.
create or replace function public.promote_owner(target_email text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare target_id uuid;
begin
  select id into target_id from auth.users where lower(email)=lower(target_email);
  if target_id is null then raise exception 'No auth user found for %', target_email; end if;
  insert into public.user_roles(user_id,role,created_by) values(target_id,'owner',null)
  on conflict(user_id) do update set role='owner';
end $$;

revoke all on function public.promote_owner(text) from public, anon, authenticated;
grant execute on function public.admin_list_users(text,integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_update_user_access(uuid,text,text) to authenticated;
