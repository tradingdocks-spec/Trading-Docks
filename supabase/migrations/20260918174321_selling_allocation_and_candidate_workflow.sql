-- Selling allocation and candidate workflow. Additive refinement of the
-- foundation migration; do not apply remotely during this phase.

alter table public.selling_listing_batches
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.selling_listing_candidates
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists card_name text not null default '',
  add column if not exists game_id text,
  add column if not exists set_code text,
  add column if not exists collector_number text,
  add column if not exists allocated_quantity integer not null default 0 check (allocated_quantity >= 0),
  add column if not exists source_provenance jsonb not null default '{}'::jsonb,
  add column if not exists image_source text,
  add column if not exists selected_marketplaces text[] not null default '{}';

alter table public.selling_inventory_allocations
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.selling_marketplace_listings
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.selling_sync_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists selling_candidates_workspace_state_idx
  on public.selling_listing_candidates(workspace_id, lifecycle_status, readiness_code, updated_at desc);
create index if not exists selling_candidates_workspace_card_idx
  on public.selling_listing_candidates(workspace_id, card_name, set_code, collector_number);
create index if not exists selling_allocations_workspace_inventory_idx
  on public.selling_inventory_allocations(workspace_id, inventory_item_id, inventory_position_id, status);

drop policy if exists "Users manage own selling listing batches" on public.selling_listing_batches;
drop policy if exists "Users manage own selling candidates" on public.selling_listing_candidates;
drop policy if exists "Users manage own selling allocations" on public.selling_inventory_allocations;
drop policy if exists "Users manage own selling marketplace listings" on public.selling_marketplace_listings;
drop policy if exists "Users manage own selling sync events" on public.selling_sync_events;

create policy "Users manage own selling listing batches" on public.selling_listing_batches
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));
create policy "Users manage own selling candidates" on public.selling_listing_candidates
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));
create policy "Users manage own selling allocations" on public.selling_inventory_allocations
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));
create policy "Users manage own selling marketplace listings" on public.selling_marketplace_listings
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));
create policy "Users manage own selling sync events" on public.selling_sync_events
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));

create or replace function public.reserve_selling_inventory(
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_quantity integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  candidate public.selling_listing_candidates%rowtype;
  existing_allocation public.selling_inventory_allocations%rowtype;
  allocation_row record;
  physical_quantity integer := 0;
  reserved_quantity integer := 0;
  available_quantity integer := 0;
  linked_item_id text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Allocation quantity must be positive'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Allocation idempotency key is required'; end if;

  select * into existing_allocation
    from public.selling_inventory_allocations
    where user_id = actor and workspace_id = p_workspace_id and idempotency_key = p_idempotency_key
    for update;
  if existing_allocation.id is not null then
    select coalesce(sum(quantity), 0) into reserved_quantity
      from public.selling_inventory_allocations
      where user_id = actor and workspace_id = p_workspace_id
        and inventory_item_id = existing_allocation.inventory_item_id
        and coalesce(inventory_position_id, '') = coalesce(existing_allocation.inventory_position_id, '')
        and status in ('ALLOCATED', 'RESERVED');
    return jsonb_build_object('ok', true, 'replayed', true, 'allocationId', existing_allocation.id,
      'allocatedQuantity', existing_allocation.quantity, 'reservedQuantity', reserved_quantity);
  end if;

  select * into candidate
    from public.selling_listing_candidates
    where id = p_candidate_id and user_id = actor and workspace_id = p_workspace_id
    for update;
  if candidate.id is null then raise exception 'Selling candidate not found'; end if;
  if candidate.quantity < p_quantity then raise exception 'Allocation exceeds candidate quantity'; end if;

  if candidate.inventory_position_id is not null then
    select quantity, item_id into physical_quantity, linked_item_id
      from public.chaos_sort_inventory_positions
      where user_id = actor and id = candidate.inventory_position_id
      for update;
    if physical_quantity is null then raise exception 'Inventory position not found'; end if;
    if linked_item_id is distinct from candidate.inventory_item_id then raise exception 'Inventory position identity mismatch'; end if;
  else
    select quantity into physical_quantity
      from public.inventory_items
      where user_id = actor and id = candidate.inventory_item_id
      for update;
    if physical_quantity is null then raise exception 'Inventory item not found'; end if;
  end if;

  -- Position-specific allocations also respect item-level allocations. This
  -- is intentionally conservative for legacy item-level inventory and cannot
  -- oversell when a user later adds physical positions.
  for allocation_row in
    select quantity
    from public.selling_inventory_allocations
    where user_id = actor and workspace_id = p_workspace_id
      and inventory_item_id = candidate.inventory_item_id
      and status in ('ALLOCATED', 'RESERVED')
      and (candidate.inventory_position_id is null
        or inventory_position_id = candidate.inventory_position_id
        or inventory_position_id is null)
    for update
  loop
    reserved_quantity := reserved_quantity + allocation_row.quantity;
  end loop;

  available_quantity := greatest(0, physical_quantity - reserved_quantity);
  if p_quantity > available_quantity then
    raise exception 'Insufficient available physical quantity (requested %, available %)', p_quantity, available_quantity;
  end if;

  insert into public.selling_inventory_allocations (
    user_id, workspace_id, candidate_id, inventory_item_id, inventory_position_id, quantity, status, idempotency_key
  ) values (
    actor, p_workspace_id, candidate.id, candidate.inventory_item_id, candidate.inventory_position_id, p_quantity, 'ALLOCATED', p_idempotency_key
  ) returning * into existing_allocation;

  update public.selling_listing_candidates
    set allocated_quantity = allocated_quantity + p_quantity, updated_at = now()
    where id = candidate.id and user_id = actor and workspace_id = p_workspace_id;

  return jsonb_build_object('ok', true, 'replayed', false, 'allocationId', existing_allocation.id,
    'physicalQuantity', physical_quantity, 'reservedQuantity', reserved_quantity + p_quantity,
    'availableQuantity', greatest(0, physical_quantity - reserved_quantity - p_quantity));
end;
$$;

revoke all on function public.reserve_selling_inventory(uuid, uuid, integer, text) from public, anon;
grant execute on function public.reserve_selling_inventory(uuid, uuid, integer, text) to authenticated;

create or replace function public.release_selling_inventory_allocation(
  p_workspace_id uuid,
  p_allocation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  allocation public.selling_inventory_allocations%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  select * into allocation from public.selling_inventory_allocations
    where id = p_allocation_id and user_id = actor and workspace_id = p_workspace_id for update;
  if allocation.id is null then raise exception 'Allocation not found'; end if;
  if allocation.status = 'RELEASED' then return jsonb_build_object('ok', true, 'replayed', true, 'allocationId', allocation.id); end if;
  if allocation.status <> 'ALLOCATED' then raise exception 'Only active allocations can be released'; end if;
  update public.selling_inventory_allocations set status = 'RELEASED', released_at = now() where id = allocation.id;
  update public.selling_listing_candidates set allocated_quantity = greatest(0, allocated_quantity - allocation.quantity), updated_at = now()
    where id = allocation.candidate_id and user_id = actor and workspace_id = p_workspace_id;
  return jsonb_build_object('ok', true, 'replayed', false, 'allocationId', allocation.id, 'releasedQuantity', allocation.quantity);
end;
$$;

revoke all on function public.release_selling_inventory_allocation(uuid, uuid, text) from public, anon;
grant execute on function public.release_selling_inventory_allocation(uuid, uuid, text) to authenticated;

create or replace function public.create_selling_listing_batch(
  p_workspace_id uuid,
  p_name text,
  p_source text,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  batch_id uuid := gen_random_uuid();
  item jsonb;
  candidate_id uuid;
  created_candidate_count integer := 0;
  requested_quantity integer;
  item_id text;
  position_id text;
  reservation jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Listing batch name is required'; end if;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) = 0 then raise exception 'At least one listing candidate is required'; end if;

  insert into public.selling_listing_batches (id, user_id, workspace_id, name, source, status)
    values (batch_id, actor, p_workspace_id, trim(p_name), coalesce(nullif(trim(p_source), ''), 'inventory'), 'DRAFT');

  for item in select value from jsonb_array_elements(p_candidates)
  loop
    item_id := nullif(item->>'inventoryItemId', '');
    position_id := nullif(item->>'inventoryPositionId', '');
    requested_quantity := nullif(item->>'quantity', '')::integer;
    if item_id is null or requested_quantity is null or requested_quantity < 1 then raise exception 'Each candidate needs an inventory item and positive quantity'; end if;
    if exists (
      select 1 from public.selling_listing_candidates existing
      where existing.user_id = actor and existing.workspace_id = p_workspace_id
        and existing.inventory_item_id = item_id
        and coalesce(existing.inventory_position_id, '') = coalesce(position_id, '')
        and existing.lifecycle_status not in ('ENDED', 'FAILED')
    ) then
      raise exception 'Inventory position is already in an active listing batch';
    end if;

    insert into public.selling_listing_candidates (
      user_id, workspace_id, listing_batch_id, inventory_item_id, inventory_position_id,
      inventory_batch_id, location_id, quantity, cost_basis, market_price, listing_price,
      card_name, game_id, set_code, collector_number, condition, finish, language,
      readiness_code, readiness_message, source_provenance, image_source
    ) values (
      actor, p_workspace_id, batch_id, item_id, position_id,
      nullif(item->>'inventoryBatchId', '')::uuid, nullif(item->>'locationId', ''), requested_quantity,
      nullif(item->>'costBasis', '')::numeric, nullif(item->>'marketPrice', '')::numeric, nullif(item->>'listingPrice', '')::numeric,
      coalesce(item->>'cardName', ''), nullif(item->>'gameId', ''), nullif(item->>'setCode', ''), nullif(item->>'collectorNumber', ''),
      nullif(item->>'condition', ''), nullif(item->>'finish', ''), nullif(item->>'language', ''),
      coalesce(nullif(item->>'readinessCode', ''), 'NEEDS_MATCH_REVIEW'),
      coalesce(nullif(item->>'readinessMessage', ''), 'Candidate requires review.'),
      coalesce(item->'sourceProvenance', '{}'::jsonb), nullif(item->>'imageSource', '')
    ) returning id into candidate_id;

    select public.reserve_selling_inventory(
      p_workspace_id,
      candidate_id,
      requested_quantity,
      'selling-batch:' || batch_id::text || ':' || item_id || ':' || coalesce(position_id, 'item')
    ) into reservation;
    created_candidate_count := created_candidate_count + 1;
  end loop;

  update public.selling_listing_batches set candidate_count = created_candidate_count, updated_at = now() where id = batch_id;
  return jsonb_build_object('ok', true, 'batchId', batch_id, 'candidateCount', created_candidate_count);
end;
$$;

revoke all on function public.create_selling_listing_batch(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_selling_listing_batch(uuid, text, text, jsonb) to authenticated;

create or replace function public.update_selling_candidate_quantity(
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_quantity integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  candidate public.selling_listing_candidates%rowtype;
  allocation_row record;
  remaining_to_release integer := 0;
  released integer := 0;
  delta integer := 0;
  reservation jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be positive'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Quantity idempotency key is required'; end if;
  select * into candidate from public.selling_listing_candidates
    where id = p_candidate_id and user_id = actor and workspace_id = p_workspace_id for update;
  if candidate.id is null then raise exception 'Selling candidate not found'; end if;
  if p_quantity < candidate.allocated_quantity then
    raise exception 'Quantity cannot be below allocated quantity (%)', candidate.allocated_quantity;
  end if;
  delta := p_quantity - candidate.quantity;
  if delta > 0 then
    update public.selling_listing_candidates set quantity = p_quantity, updated_at = now()
      where id = candidate.id;
    select public.reserve_selling_inventory(p_workspace_id, candidate.id, delta, p_idempotency_key) into reservation;
  elsif p_quantity < candidate.quantity then
    remaining_to_release := candidate.quantity - p_quantity;
    for allocation_row in
      select id, quantity from public.selling_inventory_allocations
      where candidate_id = candidate.id and user_id = actor and workspace_id = p_workspace_id and status = 'ALLOCATED'
      order by created_at desc, id desc for update
    loop
      exit when remaining_to_release = 0;
      update public.selling_inventory_allocations
        set status = 'RELEASED', released_at = now()
        where id = allocation_row.id;
      released := least(remaining_to_release, allocation_row.quantity);
      if released < allocation_row.quantity then
        insert into public.selling_inventory_allocations (user_id, workspace_id, candidate_id, inventory_item_id, inventory_position_id, quantity, status, idempotency_key)
          select actor, p_workspace_id, candidate.id, candidate.inventory_item_id, candidate.inventory_position_id,
            allocation_row.quantity - released, 'ALLOCATED', p_idempotency_key || ':remainder';
      end if;
      remaining_to_release := remaining_to_release - released;
    end loop;
    update public.selling_listing_candidates set quantity = p_quantity,
      allocated_quantity = greatest(0, allocated_quantity - (candidate.quantity - p_quantity)), updated_at = now()
      where id = candidate.id;
  end if;
  return jsonb_build_object('ok', true, 'candidateId', candidate.id, 'quantity', p_quantity,
    'allocatedQuantity', (select allocated_quantity from public.selling_listing_candidates where id = candidate.id));
end;
$$;

revoke all on function public.update_selling_candidate_quantity(uuid, uuid, integer, text) from public, anon;
grant execute on function public.update_selling_candidate_quantity(uuid, uuid, integer, text) to authenticated;
