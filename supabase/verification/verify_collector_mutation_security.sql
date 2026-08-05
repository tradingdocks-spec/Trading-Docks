-- Verification proposal for 202608050001_collector_mutation_security_proposal.sql.
-- Run only in disposable local/staging Supabase databases.
-- Covers: Free below/reaching/exceeding limit, quantity increase/decrease,
-- zero quantity, paid tiers, admin role with Free membership, explicit
-- membership override, missing identity data, cross-user rejection, and
-- duplicate/offline replay behavior through idempotent repeated RPC calls.

begin;

do $$
declare
  free_user uuid := '00000000-0000-0000-0000-000000000501';
  collector_user uuid := '00000000-0000-0000-0000-000000000502';
  seller_user uuid := '00000000-0000-0000-0000-000000000503';
  store_user uuid := '00000000-0000-0000-0000-000000000504';
  admin_free_user uuid := '00000000-0000-0000-0000-000000000505';
  other_user uuid := '00000000-0000-0000-0000-000000000506';
  override_user uuid := '00000000-0000-0000-0000-000000000507';
  missing_profile_user uuid := '00000000-0000-0000-0000-000000000508';
  missing_preferences_user uuid := '00000000-0000-0000-0000-000000000509';
begin
  insert into auth.users (id, aud, role, email)
  values
    (free_user, 'authenticated', 'authenticated', 'free@example.test'),
    (collector_user, 'authenticated', 'authenticated', 'collector@example.test'),
    (seller_user, 'authenticated', 'authenticated', 'seller@example.test'),
    (store_user, 'authenticated', 'authenticated', 'store@example.test'),
    (admin_free_user, 'authenticated', 'authenticated', 'admin-free@example.test'),
    (other_user, 'authenticated', 'authenticated', 'other@example.test'),
    (override_user, 'authenticated', 'authenticated', 'override@example.test'),
    (missing_profile_user, 'authenticated', 'authenticated', 'missing-profile@example.test'),
    (missing_preferences_user, 'authenticated', 'authenticated', 'missing-preferences@example.test')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name)
  values
    (free_user, 'Free Test User'),
    (collector_user, 'Collector Test User'),
    (seller_user, 'Seller Test User'),
    (store_user, 'Store Test User'),
    (admin_free_user, 'Admin Free Test User'),
    (other_user, 'Other Test User'),
    (override_user, 'Override Test User'),
    (missing_preferences_user, 'Missing Preferences Test User')
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id, preferences)
  values
    (free_user, '{"account_type":"collector"}'::jsonb),
    (collector_user, '{"account_type":"collector"}'::jsonb),
    (seller_user, '{"account_type":"seller"}'::jsonb),
    (store_user, '{"account_type":"store"}'::jsonb),
    (admin_free_user, '{"account_type":"collector"}'::jsonb),
    (other_user, '{"account_type":"collector"}'::jsonb),
    (override_user, '{"account_type":"collector"}'::jsonb)
  on conflict (user_id) do update
  set preferences = excluded.preferences;

  insert into public.billing_subscriptions (user_id, stripe_customer_id, plan_id, status)
  values
    (collector_user, 'cus_collector_test', 'collector', 'active'),
    (seller_user, 'cus_seller_test', 'seller', 'active'),
    (store_user, 'cus_store_test', 'business', 'active')
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      status = excluded.status;

  begin
    insert into public.user_roles (user_id, role)
    values (admin_free_user, 'admin')
    on conflict (user_id) do update set role = excluded.role;
  exception
    when undefined_table then
      raise notice 'user_roles table is not present in this replay target; admin-role separation check is skipped.';
  end;

  insert into public.admin_membership_overrides (user_id, plan_id, granted_by)
  values (override_user, 'collector', admin_free_user)
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      granted_by = excluded.granted_by,
      updated_at = now();
end;
$$;

-- Free user below and reaching limit.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('free-a', '00000000-0000-0000-0000-000000000501', 'Free A', 499);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('free-b', '00000000-0000-0000-0000-000000000501', 'Free B', 1);

-- Zero quantity remains non-destructive and does not consume the Free limit.
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('free-zero', '00000000-0000-0000-0000-000000000501', 'Free zero', 0);

-- Free user adding 1 beyond 500 should fail.
do $$
begin
  insert into public.inventory_items (id, user_id, card_name, quantity)
  values ('free-over-one', '00000000-0000-0000-0000-000000000501', 'Too many', 1);
  raise exception 'Expected Free limit rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_FREE_LIMIT_EXCEEDED%' then
      raise;
    end if;
end;
$$;

-- Free user adding 2 beyond 500 should fail with the same stable code.
do $$
begin
  insert into public.inventory_items (id, user_id, card_name, quantity)
  values ('free-over-two', '00000000-0000-0000-0000-000000000501', 'Too many again', 2);
  raise exception 'Expected Free limit rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_FREE_LIMIT_EXCEEDED%' then
      raise;
    end if;
end;
$$;

-- Quantity decrease then crossing-limit increase.
update public.inventory_items
set quantity = 498
where user_id = '00000000-0000-0000-0000-000000000501'
  and id = 'free-a';

do $$
begin
  update public.inventory_items
  set quantity = 500
  where user_id = '00000000-0000-0000-0000-000000000501'
    and id = 'free-a';
  raise exception 'Expected crossing-limit rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_FREE_LIMIT_EXCEEDED%' then
      raise;
    end if;
end;
$$;

-- Paid unlimited behavior.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('collector-many', '00000000-0000-0000-0000-000000000502', 'Collector many', 501);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000503', true);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('seller-many', '00000000-0000-0000-0000-000000000503', 'Seller many', 501);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000504', true);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('store-many', '00000000-0000-0000-0000-000000000504', 'Store many', 501);

-- Explicit membership override grants paid collection limit behavior without Stripe.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000507', true);
insert into public.inventory_items (id, user_id, card_name, quantity)
values ('override-many', '00000000-0000-0000-0000-000000000507', 'Override many', 501);

-- Platform role alone does not grant paid entitlement.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000505', true);
do $$
begin
  insert into public.inventory_items (id, user_id, card_name, quantity)
  values ('admin-free-over', '00000000-0000-0000-0000-000000000505', 'Admin Free over', 501);
  raise exception 'Expected admin Free limit rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_FREE_LIMIT_EXCEEDED%' then
      raise;
    end if;
end;
$$;

-- Missing profile should fail with a structured membership/profile code.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000508', true);
do $$
begin
  insert into public.inventory_items (id, user_id, card_name, quantity)
  values ('missing-profile-card', '00000000-0000-0000-0000-000000000508', 'Missing profile', 1);
  raise exception 'Expected missing-profile rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_MISSING_MEMBERSHIP%' then
      raise;
    end if;
end;
$$;

-- Missing preferences should fail with the same structured membership/profile code.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000509', true);
do $$
begin
  insert into public.inventory_items (id, user_id, card_name, quantity)
  values ('missing-preferences-card', '00000000-0000-0000-0000-000000000509', 'Missing preferences', 1);
  raise exception 'Expected missing-preferences rejection did not occur.';
exception
  when raise_exception then
    if sqlerrm not like '%TD_COLLECTOR_MISSING_MEMBERSHIP%' then
      raise;
    end if;
end;
$$;

-- Cross-user mutation rejection.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000506', true);
do $$
begin
  update public.inventory_items
  set quantity = 1
  where user_id = '00000000-0000-0000-0000-000000000501'
    and id = 'free-a';
  if found then
    raise exception 'Expected RLS/cross-user rejection did not occur.';
  end if;
end;
$$;

-- Offline replay duplicate/idempotency behavior through repeated same RPC.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
select public.collector_mutate_inventory_item('{"type":"quantity","inventoryItemId":"collector-many","quantity":502}'::jsonb);
select public.collector_mutate_inventory_item('{"type":"quantity","inventoryItemId":"collector-many","quantity":502}'::jsonb);

-- Simultaneous inserts are protected by per-user advisory locks in the trigger.
-- Validate with two concurrent staging sessions inserting Free quantities whose
-- combined total exceeds 500; one must raise TD_COLLECTOR_FREE_LIMIT_EXCEEDED.
--
-- Service-role import behavior: direct inventory writes with only a service-role
-- key and no user JWT should raise TD_COLLECTOR_UNAUTHORIZED because auth.uid()
-- is null. Production imports must either execute as the authenticated user or
-- use a reviewed server pathway that supplies an auditable target user context.

rollback;
