-- Read-only eBay importer and reconciliation center.
-- Apply after 202607290004_platform_marketplace_integrations_server_only.sql.

alter table public.marketplace_listing_mappings
  alter column inventory_item_id type text using inventory_item_id::text;

alter table public.marketplace_listing_mappings
  drop constraint if exists marketplace_listing_mappings_match_status_check;

alter table public.marketplace_listing_mappings
  add constraint marketplace_listing_mappings_match_status_check
  check (match_status in ('unmatched', 'suggested', 'matched', 'conflict', 'ignored'));

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  external_order_id text not null,
  order_status text,
  payment_status text,
  fulfillment_status text,
  currency text,
  subtotal numeric(12,2),
  shipping numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  buyer_alias text,
  ordered_at timestamptz,
  last_modified_at timestamptz,
  raw_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_id, external_order_id)
);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  external_line_item_id text not null,
  external_listing_id text,
  external_sku text,
  title text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2),
  currency text,
  inventory_item_id text,
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'suggested', 'matched', 'conflict', 'ignored')),
  raw_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_order_id, external_line_item_id)
);

alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;

create policy "Users manage own marketplace orders"
on public.marketplace_orders for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own marketplace order items"
on public.marketplace_order_items for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists marketplace_orders_user_modified_idx
on public.marketplace_orders (user_id, marketplace_id, last_modified_at desc);

create index if not exists marketplace_order_items_match_idx
on public.marketplace_order_items (user_id, match_status);

notify pgrst, 'reload schema';
