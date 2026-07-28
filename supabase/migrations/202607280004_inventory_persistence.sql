create table if not exists public.inventory_locations (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  location_type text not null default 'custom',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.inventory_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_name text not null default '',
  sku text not null default '',
  location_id text,
  scryfall_id text,
  set_code text,
  collector_number text,
  quantity integer not null default 0 check (quantity >= 0),
  inventory_value numeric(14,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.inventory_movements (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null default '',
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists inventory_locations_user_name_idx
  on public.inventory_locations(user_id, name);
create index if not exists inventory_items_user_name_idx
  on public.inventory_items(user_id, card_name);
create index if not exists inventory_items_user_location_idx
  on public.inventory_items(user_id, location_id);
create index if not exists inventory_items_user_printing_idx
  on public.inventory_items(user_id, set_code, collector_number);
create index if not exists inventory_items_user_scryfall_idx
  on public.inventory_items(user_id, scryfall_id);
create index if not exists inventory_items_user_updated_idx
  on public.inventory_items(user_id, updated_at desc);
create index if not exists inventory_movements_user_time_idx
  on public.inventory_movements(user_id, occurred_at desc);

alter table public.inventory_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "Users manage their inventory locations" on public.inventory_locations;
create policy "Users manage their inventory locations"
  on public.inventory_locations for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their inventory items" on public.inventory_items;
create policy "Users manage their inventory items"
  on public.inventory_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their inventory movements" on public.inventory_movements;
create policy "Users manage their inventory movements"
  on public.inventory_movements for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.inventory_locations from anon;
revoke all on public.inventory_items from anon;
revoke all on public.inventory_movements from anon;
grant select, insert, update, delete on public.inventory_locations to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;
