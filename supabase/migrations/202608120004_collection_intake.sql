-- Collection Intake / Buy Calculator production foundation.
-- Forward-only additive schema. Does not backfill or mutate existing inventory.

create extension if not exists pgcrypto;

create table if not exists public.collection_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null default 'Collection intake',
  seller_name text not null default '',
  seller_contact text not null default '',
  status text not null default 'draft' check (
    status in ('draft', 'evaluating', 'offer_ready', 'purchased', 'declined', 'archived')
  ),
  scenario_key text not null default 'standard' check (
    scenario_key in ('conservative', 'standard', 'aggressive', 'custom')
  ),
  scenario jsonb not null default '{}'::jsonb,
  valuation jsonb not null default '{}'::jsonb,
  actual_offer numeric(14,2) check (actual_offer is null or actual_offer >= 0),
  notes text not null default '',
  completed_purchase_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.collection_intake_items (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.collection_intakes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  card_name text not null default '',
  game_id text not null default 'magic',
  product_type text not null default 'card' check (product_type in ('card', 'sealed', 'bulk')),
  set_code text,
  collector_number text,
  scryfall_id text,
  tcgplayer_product_id bigint,
  tcgplayer_sku_id bigint,
  condition text,
  finish text,
  language text not null default 'English',
  quantity integer not null default 1 check (quantity > 0),
  unit_market_value numeric(14,4) check (unit_market_value is null or unit_market_value >= 0),
  review_state text not null default 'ready' check (
    review_state in (
      'ready',
      'unresolved_identity',
      'ambiguous_printing',
      'unknown_condition',
      'unknown_finish',
      'missing_price',
      'high_value_confirmation'
    )
  ),
  allocated_total_cost numeric(14,2) check (allocated_total_cost is null or allocated_total_cost >= 0),
  allocated_unit_cost numeric(14,4) check (allocated_unit_cost is null or allocated_unit_cost >= 0),
  inventory_item_id text,
  source text not null default 'manual',
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete set null (inventory_item_id)
);

create table if not exists public.collection_purchases (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.collection_intakes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  seller_name text not null default '',
  seller_contact text not null default '',
  purchase_amount numeric(14,2) not null check (purchase_amount >= 0),
  calculated_max_offer numeric(14,2) not null default 0 check (calculated_max_offer >= 0),
  market_value numeric(14,2) not null default 0 check (market_value >= 0),
  sellable_value numeric(14,2) not null default 0 check (sellable_value >= 0),
  expected_profit numeric(14,2) not null default 0,
  roi_percent numeric(8,2),
  margin_percent numeric(8,2),
  offer_percent_of_market numeric(8,2),
  total_quantity integer not null default 0 check (total_quantity >= 0),
  unique_lines integer not null default 0 check (unique_lines >= 0),
  cost_allocation_method text not null default 'proportional_market_value',
  valuation jsonb not null default '{}'::jsonb,
  scenario jsonb not null default '{}'::jsonb,
  notes text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists collection_intakes_user_status_idx
  on public.collection_intakes(user_id, status, updated_at desc);
create index if not exists collection_intakes_workspace_status_idx
  on public.collection_intakes(workspace_id, status, updated_at desc)
  where workspace_id is not null;
create index if not exists collection_intake_items_intake_idx
  on public.collection_intake_items(intake_id, created_at);
create index if not exists collection_intake_items_user_review_idx
  on public.collection_intake_items(user_id, review_state, updated_at desc);
create index if not exists collection_intake_items_exact_printing_idx
  on public.collection_intake_items(user_id, game_id, set_code, collector_number, condition, finish, language);
create index if not exists collection_purchases_user_time_idx
  on public.collection_purchases(user_id, completed_at desc);
create index if not exists collection_purchases_workspace_time_idx
  on public.collection_purchases(workspace_id, completed_at desc)
  where workspace_id is not null;

alter table public.collection_intakes enable row level security;
alter table public.collection_intake_items enable row level security;
alter table public.collection_purchases enable row level security;

drop policy if exists "Users view their collection intakes" on public.collection_intakes;
create policy "Users view their collection intakes"
  on public.collection_intakes for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "Users create their collection intakes" on public.collection_intakes;
create policy "Users create their collection intakes"
  on public.collection_intakes for insert to authenticated
  with check (
    user_id = auth.uid()
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  );

drop policy if exists "Users update open collection intakes" on public.collection_intakes;
create policy "Users update open collection intakes"
  on public.collection_intakes for update to authenticated
  using (
    status <> 'purchased'
    and (
      user_id = auth.uid()
      or public.can_manage_workspace(workspace_id)
    )
  )
  with check (
    status <> 'purchased'
    and user_id = auth.uid()
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  );

drop policy if exists "Users delete open collection intakes" on public.collection_intakes;
create policy "Users delete open collection intakes"
  on public.collection_intakes for delete to authenticated
  using (status <> 'purchased' and user_id = auth.uid());

drop policy if exists "Users view their collection intake items" on public.collection_intake_items;
create policy "Users view their collection intake items"
  on public.collection_intake_items for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "Users manage open collection intake items" on public.collection_intake_items;
create policy "Users manage open collection intake items"
  on public.collection_intake_items for all to authenticated
  using (
    exists (
      select 1
      from public.collection_intakes ci
      where ci.id = collection_intake_items.intake_id
        and ci.status <> 'purchased'
        and ci.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.collection_intakes ci
      where ci.id = collection_intake_items.intake_id
        and ci.status <> 'purchased'
        and ci.user_id = auth.uid()
        and ci.workspace_id is not distinct from collection_intake_items.workspace_id
    )
  );

drop policy if exists "Users view their collection purchases" on public.collection_purchases;
create policy "Users view their collection purchases"
  on public.collection_purchases for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "No direct collection purchase writes" on public.collection_purchases;
create policy "No direct collection purchase writes"
  on public.collection_purchases for all to authenticated
  using (false)
  with check (false);

revoke all on public.collection_intakes from anon;
revoke all on public.collection_intake_items from anon;
revoke all on public.collection_purchases from anon;
grant select, insert, update, delete on public.collection_intakes to authenticated;
grant select, insert, update, delete on public.collection_intake_items to authenticated;
grant select on public.collection_purchases to authenticated;

create or replace function public.complete_collection_intake(
  p_intake_id uuid,
  p_actual_offer numeric,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_intake public.collection_intakes%rowtype;
  v_purchase public.collection_purchases%rowtype;
  v_key text := coalesce(nullif(p_idempotency_key, ''), 'collection-intake:' || p_intake_id::text);
  v_market_total numeric := 0;
  v_purchase_amount numeric := greatest(coalesce(p_actual_offer, 0), 0);
  v_allocated numeric := 0;
  v_line_value numeric := 0;
  v_item public.collection_intake_items%rowtype;
  v_inventory jsonb;
  v_inventory_item public.inventory_items%rowtype;
  v_total_quantity integer := 0;
  v_unique_lines integer := 0;
  v_blocking_count integer := 0;
  v_priced_quantity integer := 0;
  v_unpriced_quantity integer := 0;
  v_index integer := 0;
  v_total_items integer := 0;
  v_allocated_total numeric := 0;
  v_allocated_unit numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'P0001';
  end if;

  select *
  into v_intake
  from public.collection_intakes
  where id = p_intake_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Collection intake was not found.' using errcode = 'P0002';
  end if;

  if v_intake.status = 'purchased' then
    select *
    into v_purchase
    from public.collection_purchases
    where id = v_intake.completed_purchase_id
      and user_id = v_user_id;
    return jsonb_build_object(
      'ok', true,
      'alreadyCompleted', true,
      'purchaseId', v_purchase.id,
      'inventoryCreated', 0
    );
  end if;

  select
    count(*),
    coalesce(sum(quantity), 0),
    coalesce(sum(coalesce(unit_market_value, 0) * quantity), 0),
    coalesce(sum(case when coalesce(unit_market_value, 0) > 0 then quantity else 0 end), 0),
    coalesce(sum(case when coalesce(unit_market_value, 0) <= 0 then quantity else 0 end), 0),
    coalesce(sum(case when review_state in (
      'unresolved_identity',
      'ambiguous_printing',
      'unknown_condition',
      'unknown_finish',
      'high_value_confirmation'
    ) then 1 else 0 end), 0)
  into v_unique_lines, v_total_quantity, v_market_total, v_priced_quantity, v_unpriced_quantity, v_blocking_count
  from public.collection_intake_items
  where intake_id = p_intake_id
    and user_id = v_user_id;

  if v_unique_lines = 0 then
    raise exception 'Add at least one item before completing a collection purchase.' using errcode = 'P0003';
  end if;

  if v_blocking_count > 0 then
    raise exception 'Resolve blocking review items before completing this collection purchase.' using errcode = 'P0004';
  end if;

  insert into public.collection_purchases (
    intake_id,
    user_id,
    workspace_id,
    seller_name,
    seller_contact,
    purchase_amount,
    calculated_max_offer,
    market_value,
    sellable_value,
    expected_profit,
    roi_percent,
    margin_percent,
    offer_percent_of_market,
    total_quantity,
    unique_lines,
    valuation,
    scenario,
    notes,
    idempotency_key
  ) values (
    p_intake_id,
    v_user_id,
    v_intake.workspace_id,
    v_intake.seller_name,
    v_intake.seller_contact,
    v_purchase_amount,
    coalesce(nullif(v_intake.valuation ->> 'calculatedMaxOffer', '')::numeric, 0),
    coalesce(nullif(v_intake.valuation ->> 'marketValue', '')::numeric, v_market_total),
    coalesce(nullif(v_intake.valuation ->> 'sellableValue', '')::numeric, 0),
    coalesce(nullif(v_intake.valuation ->> 'expectedProfit', '')::numeric, 0),
    nullif(v_intake.valuation ->> 'roiPercent', '')::numeric,
    nullif(v_intake.valuation ->> 'marginPercent', '')::numeric,
    nullif(v_intake.valuation ->> 'offerPercentOfMarket', '')::numeric,
    v_total_quantity,
    v_unique_lines,
    v_intake.valuation || jsonb_build_object(
      'pricedQuantity', v_priced_quantity,
      'unpricedQuantity', v_unpriced_quantity
    ),
    v_intake.scenario,
    v_intake.notes,
    v_key
  )
  on conflict (user_id, idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into v_purchase;

  select count(*)
  into v_total_items
  from public.collection_intake_items
  where intake_id = p_intake_id
    and user_id = v_user_id;

  for v_item in
    select *
    from public.collection_intake_items
    where intake_id = p_intake_id
      and user_id = v_user_id
    order by created_at, id
  loop
    v_index := v_index + 1;
    v_line_value := coalesce(v_item.unit_market_value, 0) * v_item.quantity;
    if v_purchase_amount = 0 or v_market_total <= 0 then
      v_allocated_total := 0;
    elsif v_index = v_total_items then
      v_allocated_total := round(v_purchase_amount - v_allocated, 2);
    else
      v_allocated_total := round(v_purchase_amount * (v_line_value / v_market_total), 2);
    end if;
    v_allocated := v_allocated + v_allocated_total;
    v_allocated_unit := case when v_item.quantity > 0 then round(v_allocated_total / v_item.quantity, 4) else 0 end;

    v_inventory := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'card_name', v_item.card_name,
      'sku', coalesce(
        nullif(v_item.metadata ->> 'sku', ''),
        concat_ws(':', 'collection', v_item.game_id, v_item.set_code, v_item.collector_number, v_item.condition, v_item.finish, v_item.language, v_item.id::text)
      ),
      'location_id', nullif(v_item.metadata ->> 'storageLocationId', ''),
      'scryfall_id', v_item.scryfall_id,
      'set_code', v_item.set_code,
      'collector_number', v_item.collector_number,
      'quantity', v_item.quantity,
      'inventory_value', coalesce(v_item.unit_market_value, 0),
      'game_id', v_item.game_id,
      'product_type', v_item.product_type,
      'tcgplayer_product_id', v_item.tcgplayer_product_id,
      'tcgplayer_sku_id', v_item.tcgplayer_sku_id,
      'variant', v_item.finish,
      'language', v_item.language,
      'data', jsonb_build_object(
        'condition', v_item.condition,
        'finish', v_item.finish,
        'variant', v_item.finish,
        'language', v_item.language,
        'unitCost', v_allocated_unit,
        'costBasis', v_allocated_unit,
        'totalCostBasis', v_allocated_total,
        'collectionIntakeId', v_intake.id,
        'collectionIntakeItemId', v_item.id,
        'collectionPurchaseId', v_purchase.id,
        'purchaseSource', 'collection_purchase',
        'reviewState', v_item.review_state,
        'pricingCoverage', case when coalesce(v_item.unit_market_value, 0) > 0 then 'priced' else 'unpriced' end
      )
    );

    v_inventory_item := public.create_inventory_item_with_event(
      v_inventory,
      'collection_purchase'::public.inventory_event_source,
      concat('collection-purchase:', v_purchase.id::text, ':item:', v_item.id::text),
      'collection_purchase',
      v_purchase.id::text
    );

    update public.collection_intake_items
    set inventory_item_id = v_inventory_item.id,
        allocated_total_cost = v_allocated_total,
        allocated_unit_cost = v_allocated_unit,
        updated_at = now()
    where id = v_item.id
      and user_id = v_user_id;
  end loop;

  update public.collection_intakes
  set status = 'purchased',
      actual_offer = v_purchase_amount,
      completed_purchase_id = v_purchase.id,
      idempotency_key = v_key,
      completed_at = now(),
      updated_at = now()
  where id = p_intake_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'purchaseId', v_purchase.id,
    'inventoryCreated', v_total_items,
    'totalQuantity', v_total_quantity,
    'unpricedQuantity', v_unpriced_quantity
  );
end;
$$;

revoke execute on function public.complete_collection_intake(uuid, numeric, text) from public;
grant execute on function public.complete_collection_intake(uuid, numeric, text) to authenticated;

comment on table public.collection_intakes is
  'Server-backed collection buy-counter drafts from valuation through final purchase decision.';
comment on table public.collection_intake_items is
  'Exact-printing collection intake lines. Condition, finish, language, and identity remain materially separate.';
comment on table public.collection_purchases is
  'Completed collection purchases with transparent offer economics and inventory finalization linkage.';
comment on function public.complete_collection_intake(uuid, numeric, text) is
  'Idempotently completes a reviewed collection intake, creates inventory rows, and writes collection_purchase inventory events.';

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when undefined_function then
    null;
end $$;
