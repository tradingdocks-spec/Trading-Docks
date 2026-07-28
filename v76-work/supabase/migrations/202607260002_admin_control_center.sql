-- Trading Docks owner-only Admin Control Center.
-- Apply after 202607250001_auth_foundation.sql.

create table if not exists public.account_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  monthly_price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_access (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  visibility text not null default 'enabled'
    check (visibility in ('enabled', 'coming_soon', 'hidden')),
  minimum_plan text references public.account_plans(id) on delete set null,
  usage_limit integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_access_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_id text not null references public.feature_access(id) on delete cascade,
  access text not null check (access in ('enabled', 'disabled', 'default')),
  reason text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_id)
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce((select email from auth.users where id = auth.uid()), ''))
    = 'tradingdocks@gmail.com';
$$;

alter table public.account_plans enable row level security;
alter table public.feature_access enable row level security;
alter table public.user_access_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "Authenticated users can read active plans"
on public.account_plans for select to authenticated using (active or public.is_platform_owner());
create policy "Owner manages plans"
on public.account_plans for all to authenticated
using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy "Authenticated users can read visible features"
on public.feature_access for select to authenticated
using (visibility <> 'hidden' or public.is_platform_owner());
create policy "Owner manages features"
on public.feature_access for all to authenticated
using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy "Users read own access overrides"
on public.user_access_overrides for select to authenticated
using (user_id = auth.uid() or public.is_platform_owner());
create policy "Owner manages access overrides"
on public.user_access_overrides for all to authenticated
using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy "Owner reads audit log"
on public.admin_audit_log for select to authenticated using (public.is_platform_owner());
create policy "Owner creates audit entries"
on public.admin_audit_log for insert to authenticated
with check (public.is_platform_owner() and actor_id = auth.uid());

insert into public.account_plans (id, name, description, monthly_price, sort_order)
values
  ('free', 'Free', 'Start a personal collection.', 0, 10),
  ('collector', 'Collector', 'Organize decks, binders, and inventory.', 9.99, 20),
  ('seller', 'Seller', 'Listings, pricing, and sales workflows.', 19.99, 30),
  ('business', 'Business', 'Complete multi-channel operations.', 39.99, 40)
on conflict (id) do nothing;

insert into public.feature_access (id, name, category, description, minimum_plan)
values
  ('dashboard', 'Dashboard', 'Core', 'Account overview and workspace metrics.', 'free'),
  ('inventory', 'Inventory', 'Collection', 'Singles, sealed product, boxes, and binders.', 'collector'),
  ('deck-vault', 'Deck Vault', 'Collection', 'Deck building, importing, and analysis.', 'collector'),
  ('collection-buying', 'Collection Buying', 'Purchasing', 'Appraise and purchase collections.', 'seller'),
  ('marketplaces', 'Marketplaces', 'Sales', 'Listings and marketplace workflows.', 'seller'),
  ('finances', 'Finances', 'Business', 'Expenses, payouts, and reporting.', 'business'),
  ('employees', 'Employees', 'Business', 'Team access and payroll tools.', 'business')
on conflict (id) do nothing;

create or replace function public.admin_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_platform_owner()
  order by u.created_at desc;
$$;

revoke all on function public.admin_directory() from public;
grant execute on function public.admin_directory() to authenticated;

create or replace function public.protect_platform_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce((select email from auth.users where id = old.user_id), ''))
     = 'tradingdocks@gmail.com'
     and (tg_op = 'DELETE' or new.role <> 'owner') then
    raise exception 'The platform owner role cannot be removed.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_platform_owner_role on public.workspace_members;
create trigger protect_platform_owner_role
before update or delete on public.workspace_members
for each row execute procedure public.protect_platform_owner();
