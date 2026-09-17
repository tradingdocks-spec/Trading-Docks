-- Forward-only owner authority transition.
--
-- The legacy owner identity was discovered in production as a hard-coded
-- auth.users.email comparison. Preserve bootstrap access exactly once by
-- promoting that existing identity into user_roles, then use the trusted
-- role table for all future owner checks. Apply in staging first.
-- CREATE OR REPLACE FUNCTION preserves existing EXECUTE grants. The preceding
-- privilege-hardening migration therefore remains authoritative for these
-- redefined functions.

do $$
declare
  bootstrap_user_id uuid;
begin
  select id into bootstrap_user_id
  from auth.users
  where lower(email::text) = 'tradingdocks@gmail.com'
  limit 1;

  if exists (select 1 from public.user_roles where role = 'owner') then
    null;
  elsif bootstrap_user_id is not null then
    insert into public.user_roles (user_id, role, created_by)
    values (bootstrap_user_id, 'owner', null)
    on conflict (user_id) do update set role = 'owner';
  elsif not exists (select 1 from auth.users) then
    -- Empty staging/fresh environments have no identity to bootstrap yet.
    null;
  else
    raise exception 'Owner authority transition requires an existing owner or the historical bootstrap identity.';
  end if;
end;
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.protect_platform_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if exists (
       select 1 from public.user_roles
       where user_id = old.user_id and role = 'owner'
     )
     and (tg_op = 'DELETE' or new.role <> 'owner') then
    raise exception 'The platform owner role cannot be removed.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.admin_set_membership_override(
  target_user_id uuid,
  new_plan text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Owner access required';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'User not found';
  end if;

  if exists (
       select 1 from public.user_roles
       where user_id = target_user_id and role = 'owner'
     ) then
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
    user_id, plan_id, granted_by, created_at, updated_at
  )
  values (
    target_user_id, new_plan, (select auth.uid()), now(), now()
  )
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      granted_by = excluded.granted_by,
      updated_at = now();
end;
$$;

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
set search_path = pg_catalog
as $$
  select
    u.id,
    u.email::text,
    p.full_name,
    case
      -- Platform ownership is trusted authority, not a billing subscription.
      -- Store is the existing full-access commercial equivalent used by the UI.
      when exists (
        select 1
        from public.user_roles ur
        where ur.user_id = u.id
          and ur.role = 'owner'
      ) then 'store'
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

comment on function public.is_platform_owner() is
  'Canonical platform owner authority: authenticated user_roles.role = owner. Bootstrap email is used only by the one-time transition migration.';
