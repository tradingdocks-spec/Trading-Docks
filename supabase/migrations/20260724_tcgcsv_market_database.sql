create table if not exists public.tcg_categories (
  category_id bigint primary key,
  name text not null,
  display_name text,
  sealed_label text,
  modified_on timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.tcg_groups (
  group_id bigint primary key,
  category_id bigint not null references public.tcg_categories(category_id) on delete cascade,
  name text not null,
  abbreviation text,
  published_on timestamptz,
  modified_on timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists tcg_groups_category_idx
  on public.tcg_groups(category_id);

create table if not exists public.tcg_products (
  product_id bigint primary key,
  category_id bigint not null references public.tcg_categories(category_id) on delete cascade,
  group_id bigint not null references public.tcg_groups(group_id) on delete cascade,
  name text not null,
  clean_name text,
  product_type text,
  image_url text,
  product_url text,
  is_sealed boolean not null default false,
  is_presale boolean not null default false,
  released_on timestamptz,
  modified_on timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists tcg_products_search_idx
  on public.tcg_products using gin (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(clean_name, '') || ' ' || coalesce(product_type, ''))
  );

create index if not exists tcg_products_sealed_idx
  on public.tcg_products(is_sealed, category_id, group_id);

create table if not exists public.tcg_current_prices (
  product_id bigint not null references public.tcg_products(product_id) on delete cascade,
  subtype_name text not null default 'Sealed',
  low_price numeric(12,2),
  mid_price numeric(12,2),
  high_price numeric(12,2),
  market_price numeric(12,2),
  direct_low_price numeric(12,2),
  captured_at timestamptz not null default now(),
  primary key (product_id, subtype_name)
);

create table if not exists public.tcg_price_history (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.tcg_products(product_id) on delete cascade,
  subtype_name text not null default 'Sealed',
  low_price numeric(12,2),
  mid_price numeric(12,2),
  high_price numeric(12,2),
  market_price numeric(12,2),
  direct_low_price numeric(12,2),
  captured_at timestamptz not null default now()
);

create index if not exists tcg_price_history_product_time_idx
  on public.tcg_price_history(product_id, captured_at desc);

alter table public.tcg_categories enable row level security;
alter table public.tcg_groups enable row level security;
alter table public.tcg_products enable row level security;
alter table public.tcg_current_prices enable row level security;
alter table public.tcg_price_history enable row level security;

drop policy if exists "Authenticated users read TCG categories" on public.tcg_categories;
create policy "Authenticated users read TCG categories"
  on public.tcg_categories for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users read TCG groups" on public.tcg_groups;
create policy "Authenticated users read TCG groups"
  on public.tcg_groups for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users read TCG products" on public.tcg_products;
create policy "Authenticated users read TCG products"
  on public.tcg_products for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users read current TCG prices" on public.tcg_current_prices;
create policy "Authenticated users read current TCG prices"
  on public.tcg_current_prices for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users read TCG price history" on public.tcg_price_history;
create policy "Authenticated users read TCG price history"
  on public.tcg_price_history for select
  to authenticated
  using (true);
