-- Forward-only entitlement fix. Do not apply remotely from this task.
-- Collection card limits are growth limits, not edit locks. Trusted platform
-- owners/admins also have full platform entitlements without changing their
-- commercial billing tier.

create or replace function public.enforce_collector_inventory_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid;
  target_user_id uuid;
  effective_tier text;
  existing_quantity_total bigint;
  previous_quantity_total bigint;
  next_quantity_total bigint;
  has_full_platform_access boolean := false;
begin
  acting_user_id := public.collector_inventory_acting_user();

  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  if acting_user_id is null or target_user_id is null or acting_user_id <> target_user_id then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_UNAUTHORIZED',
      'You can only mutate your own collection records.',
      target_user_id
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.quantity is null or new.quantity < 0 then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_INVALID_QUANTITY',
      'Quantity must be a whole number at or above zero.',
      target_user_id
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('collector-inventory:' || target_user_id::text, 0));

  effective_tier := public.collector_effective_membership_tier(target_user_id);
  if effective_tier is null then
    perform public.raise_collector_inventory_error(
      'TD_COLLECTOR_MISSING_MEMBERSHIP',
      'Membership could not be resolved for this collection mutation.',
      target_user_id
    );
  end if;

  has_full_platform_access := coalesce(public.current_admin_role() in ('owner'::public.admin_role, 'admin'::public.admin_role), false);
  if effective_tier = 'free' and not has_full_platform_access then
    select coalesce(sum(quantity), 0)
      into existing_quantity_total
      from public.inventory_items
     where user_id = target_user_id
       and id <> new.id;

    next_quantity_total := existing_quantity_total + new.quantity;
    if tg_op = 'UPDATE' then
      previous_quantity_total := existing_quantity_total + old.quantity;
    else
      previous_quantity_total := existing_quantity_total;
    end if;

    -- Only growth is gated. Metadata edits, unchanged quantities, decreases,
    -- and removals must remain possible for an already over-limit collection.
    if next_quantity_total > 500
       and (tg_op = 'INSERT' or next_quantity_total > previous_quantity_total) then
      perform public.raise_collector_inventory_error(
        'TD_COLLECTOR_FREE_LIMIT_EXCEEDED',
        'Collection limit reached: Free accounts can hold up to 500 total owned cards. Reduce quantity or upgrade to add more.',
        target_user_id
      );
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.enforce_collector_inventory_mutation() is
  'Authoritatively enforces owned inventory mutations; Free card limits apply only to quantity growth, while trusted platform owners/admins bypass commercial limits.';

notify pgrst, 'reload schema';
