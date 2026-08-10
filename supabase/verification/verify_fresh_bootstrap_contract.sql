-- Fresh Supabase bootstrap contract verification.
-- Run in a disposable/staging Supabase project after applying every file in
-- supabase/migrations in filename order. This script is read-only.

do $$
declare
  missing_objects text[];
  insecure_tables text[];
begin
  select array_agg(required_object)
  into missing_objects
  from (
    values
      ('table public.profiles'),
      ('table public.workspaces'),
      ('table public.workspace_members'),
      ('table public.user_preferences'),
      ('table public.user_roles'),
      ('table public.admin_membership_overrides'),
      ('table public.billing_subscriptions'),
      ('table public.billing_provider_subscriptions'),
      ('table public.inventory_items'),
      ('table public.inventory_locations'),
      ('table public.inventory_movements'),
      ('table public.inventory_label_identities'),
      ('table public.label_templates'),
      ('table public.label_print_jobs'),
      ('table public.inventory_price_reviews'),
      ('table public.marketplace_orders'),
      ('table public.marketplace_order_items'),
      ('table public.workspace_documents'),
      ('function public.handle_new_user()'),
      ('function public.current_admin_role()'),
      ('function public.is_admin(public.admin_role)'),
      ('function public.is_platform_owner()'),
      ('function public.collector_effective_membership_tier(uuid)'),
      ('function public.enforce_collector_inventory_mutation()'),
      ('function public.collector_mutate_inventory_item(jsonb)'),
      ('function public.generate_trading_docks_sku()'),
      ('function public.generate_inventory_qr_token()'),
      ('function public.resolve_public_inventory_qr(text)')
  ) as required(required_object)
  where case
    when required_object like 'table %' then to_regclass(replace(required_object, 'table ', '')) is null
    when required_object like 'function %' then to_regprocedure(replace(required_object, 'function ', '')) is null
    else true
  end;

  if missing_objects is not null then
    raise exception 'Fresh bootstrap is missing required objects: %', array_to_string(missing_objects, ', ');
  end if;

  select array_agg(format('%I.%I', schemaname, tablename) order by schemaname, tablename)
  into insecure_tables
  from pg_tables t
  join pg_class c on c.oid = to_regclass(format('%I.%I', t.schemaname, t.tablename))
  where t.schemaname = 'public'
    and t.tablename in (
      'profiles',
      'workspaces',
      'workspace_members',
      'user_preferences',
      'user_roles',
      'admin_membership_overrides',
      'billing_subscriptions',
      'billing_provider_subscriptions',
      'inventory_items',
      'inventory_locations',
      'inventory_movements',
      'inventory_label_identities',
      'label_templates',
      'label_print_jobs',
      'inventory_price_reviews',
      'marketplace_orders',
      'marketplace_order_items',
      'workspace_documents'
    )
    and not c.relrowsecurity;

  if insecure_tables is not null then
    raise exception 'Expected RLS enabled for: %', array_to_string(insecure_tables, ', ');
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'enforce_collector_inventory_mutation_insert'
      and tgrelid = 'public.inventory_items'::regclass
      and not tgisinternal
  ) then
    raise exception 'Collector inventory insert enforcement trigger is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'enforce_collector_inventory_mutation_update'
      and tgrelid = 'public.inventory_items'::regclass
      and not tgisinternal
  ) then
    raise exception 'Collector inventory update enforcement trigger is missing.';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'feedback-attachments'
      and public = false
      and file_size_limit = 10485760
  ) then
    raise exception 'feedback-attachments storage bucket is missing or not private.';
  end if;
end $$;

select
  'fresh_bootstrap_contract_ok' as result,
  now() as checked_at;
