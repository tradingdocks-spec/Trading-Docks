-- Owner-managed membership overrides for testing and promotional access.
-- This does not modify Stripe subscriptions or payment records.

create table if not exists public.admin_membership_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('free', 'collector', 'seller', 'business')),
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_membership_overrides enable row level security;

create policy "Users read own membership override"
on public.admin_membership_overrides for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_owner());

create or replace function public.admin_set_membership_override(
  target_user_id uuid,
  new_plan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
begin
  if not public.is_platform_owner() then
    raise exception 'Owner access required';
  end if;

  select lower(coalesce(email::text, ''))
  into target_email
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  if target_email = 'tradingdocks@gmail.com' then
    raise exception 'The permanent owner membership cannot be changed';
  end if;

  if new_plan is null then
    delete from public.admin_membership_overrides
    where user_id = target_user_id;
    return;
  end if;

  if new_plan not in ('free', 'collector', 'seller', 'business') then
    raise exception 'Invalid membership level';
  end if;

  insert into public.admin_membership_overrides (
    user_id,
    plan_id,
    granted_by,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    new_plan,
    (select auth.uid()),
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    plan_id = excluded.plan_id,
    granted_by = excluded.granted_by,
    updated_at = now();
end;
$$;

revoke all on function public.admin_set_membership_override(uuid, text) from public;
grant execute on function public.admin_set_membership_override(uuid, text) to authenticated;

create or replace function public.admin_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  membership_level text,
  membership_override text,
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
      when amo.plan_id is not null then amo.plan_id
      when bs.status in ('active', 'trialing') then bs.plan_id
      when bs.status = 'past_due'
        and bs.current_period_end is not null
        and bs.current_period_end > now() then bs.plan_id
      else 'free'
    end as membership_level,
    amo.plan_id as membership_override,
    coalesce(acu.card_units, 0)::bigint,
    coalesce(acu.unique_inventory_rows, 0)::integer,
    u.created_at,
    u.last_sign_in_at,
    acu.updated_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.billing_subscriptions bs on bs.user_id = u.id
  left join public.admin_membership_overrides amo on amo.user_id = u.id
  left join public.account_card_usage acu on acu.user_id = u.id
  where public.is_platform_owner()
  order by u.created_at desc;
$$;

revoke all on function public.admin_directory() from public;
grant execute on function public.admin_directory() to authenticated;
