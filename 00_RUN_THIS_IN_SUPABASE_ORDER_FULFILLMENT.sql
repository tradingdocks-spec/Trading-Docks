-- Trading Docks v184 — safe order fulfillment state.
alter table public.marketplace_orders
  add column if not exists fulfillment_stage text not null default 'new',
  add column if not exists inventory_reserved_at timestamptz,
  add column if not exists pull_started_at timestamptz,
  add column if not exists packed_at timestamptz;

do $$ begin
  alter table public.marketplace_orders add constraint marketplace_orders_fulfillment_stage_check
    check (fulfillment_stage in ('new','needs_review','ready_to_pull','pulling','packed','shipped','completed'));
exception when duplicate_object then null; end $$;

alter table public.marketplace_order_items
  add column if not exists picked_quantity integer not null default 0,
  add column if not exists inventory_reserved_quantity integer not null default 0,
  add column if not exists inventory_deducted_at timestamptz;

create index if not exists marketplace_orders_user_fulfillment_idx
  on public.marketplace_orders (user_id, fulfillment_stage, ordered_at desc);

notify pgrst, 'reload schema';
