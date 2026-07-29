-- Bulk purchase profitability foundation.
create table if not exists public.bulk_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null default '',
  purchase_type text not null default 'collection',
  purchased_at date not null default current_date,
  estimated_card_count integer not null default 0 check (estimated_card_count >= 0),
  purchase_cost numeric(14,2) not null default 0 check (purchase_cost >= 0),
  additional_expenses numeric(14,2) not null default 0 check (additional_expenses >= 0),
  payment_method text not null default '',
  status text not null default 'unsorted'
    check (status in ('unsorted', 'scanning', 'listed', 'completed')),
  valuation_source text not null default 'inventory'
    check (valuation_source in ('inventory', 'market', 'listed', 'custom')),
  cost_basis_method text not null default 'proportional'
    check (cost_basis_method in ('proportional', 'average', 'manual')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items
  add column if not exists bulk_purchase_id uuid references public.bulk_purchases(id) on delete set null;

create table if not exists public.bulk_purchase_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bulk_purchase_id uuid not null references public.bulk_purchases(id) on delete cascade,
  inventory_item_id text,
  quantity integer not null default 1 check (quantity > 0),
  gross_revenue numeric(14,2) not null default 0 check (gross_revenue >= 0),
  selling_fees numeric(14,2) not null default 0 check (selling_fees >= 0),
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  sold_at timestamptz not null default now(),
  marketplace text not null default '',
  external_order_id text,
  created_at timestamptz not null default now()
);

create index if not exists bulk_purchases_user_date_idx
  on public.bulk_purchases(user_id, purchased_at desc);
create index if not exists inventory_items_bulk_purchase_idx
  on public.inventory_items(user_id, bulk_purchase_id);
create index if not exists bulk_purchase_sales_purchase_idx
  on public.bulk_purchase_sales(user_id, bulk_purchase_id, sold_at desc);

alter table public.bulk_purchases enable row level security;
alter table public.bulk_purchase_sales enable row level security;

drop policy if exists "Users manage their bulk purchases" on public.bulk_purchases;
create policy "Users manage their bulk purchases"
  on public.bulk_purchases for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their bulk purchase sales" on public.bulk_purchase_sales;
create policy "Users manage their bulk purchase sales"
  on public.bulk_purchase_sales for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.bulk_purchases from anon;
revoke all on public.bulk_purchase_sales from anon;
grant select, insert, update, delete on public.bulk_purchases to authenticated;
grant select, insert, update, delete on public.bulk_purchase_sales to authenticated;

