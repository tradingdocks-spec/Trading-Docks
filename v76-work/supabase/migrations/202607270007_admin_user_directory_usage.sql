-- Account inventory usage and owner-only user directory metrics.
-- Apply after 202607270006_stripe_billing.sql.

create table if not exists public.account_card_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  card_units bigint not null default 0 check (card_units >= 0),
  unique_inventory_rows integer not null default 0 check (unique_inventory_rows >= 0),
  updated_at timestamptz not null default now()
);

alter table public.account_card_usage enable row level security;

create policy "Users read own card usage"
on public.account_card_usage for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_owner());

create policy "Users insert own card usage"
on public.account_card_usage for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own card usage"
on public.account_card_usage for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.admin_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  membership_level text,
  card_units bigint,
  unique_inventory_rows integer,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  usage_updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    p.full_name,
    case
      when lower(coalesce(u.email::text, '')) = 'tradingdocks@gmail.com' then 'business'
      when bs.status in ('active', 'trialing') then bs.plan_id
      when bs.status = 'past_due'
        and bs.current_period_end is not null
        and bs.current_period_end > now() then bs.plan_id
      else 'free'
    end as membership_level,
    coalesce(acu.card_units, 0)::bigint,
    coalesce(acu.unique_inventory_rows, 0)::integer,
    u.created_at,
    u.last_sign_in_at,
    acu.updated_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.billing_subscriptions bs on bs.user_id = u.id
  left join public.account_card_usage acu on acu.user_id = u.id
  where public.is_platform_owner()
  order by u.created_at desc;
$$;

revoke all on function public.admin_directory() from public;
grant execute on function public.admin_directory() to authenticated;

