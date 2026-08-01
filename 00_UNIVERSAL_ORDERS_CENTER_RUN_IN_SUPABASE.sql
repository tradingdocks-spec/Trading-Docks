-- Run this once in Supabase SQL Editor before using bulk statuses and profit tracking.
alter table public.marketplace_orders
  add column if not exists normalized_status text not null default 'new',
  add column if not exists marketplace_fees numeric(12,2) not null default 0,
  add column if not exists shipping_cost numeric(12,2) not null default 0,
  add column if not exists cost_of_goods numeric(12,2) not null default 0,
  add column if not exists refund_amount numeric(12,2) not null default 0,
  add column if not exists net_profit numeric(12,2) generated always as
    (coalesce(total,0) - coalesce(tax,0) - marketplace_fees - shipping_cost - cost_of_goods - refund_amount) stored,
  add column if not exists tracking_number text,
  add column if not exists shipping_carrier text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists source_type text not null default 'api',
  add column if not exists import_batch_id text,
  add column if not exists notes text;

do $$ begin
  alter table public.marketplace_orders add constraint marketplace_orders_normalized_status_check
    check (normalized_status in ('new','processing','shipped','delivered','cancelled','refunded'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.marketplace_orders add constraint marketplace_orders_source_type_check
    check (source_type in ('api','csv','email','manual','pos'));
exception when duplicate_object then null; end $$;

alter table public.marketplace_order_items
  add column if not exists image_url text,
  add column if not exists condition text,
  add column if not exists language text,
  add column if not exists finish text,
  add column if not exists unit_cost numeric(12,2) not null default 0,
  add column if not exists marketplace_fee numeric(12,2) not null default 0,
  add column if not exists realized_profit numeric(12,2) generated always as
    ((coalesce(unit_price,0) * quantity) - (unit_cost * quantity) - marketplace_fee) stored;

create index if not exists marketplace_orders_user_status_date_idx
  on public.marketplace_orders (user_id, normalized_status, ordered_at desc);
create index if not exists marketplace_orders_user_channel_date_idx
  on public.marketplace_orders (user_id, marketplace_id, ordered_at desc);
create index if not exists marketplace_order_items_order_idx
  on public.marketplace_order_items (marketplace_order_id, created_at);

notify pgrst, 'reload schema';
