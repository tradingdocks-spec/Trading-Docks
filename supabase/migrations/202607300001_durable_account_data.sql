-- Trading Docks durable account-data foundation.
-- Safe to run on new, old, or partially migrated projects.

create extension if not exists pgcrypto;

create table if not exists public.account_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  data jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key)
);

create table if not exists public.deck_vault_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Untitled Deck',
  format text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deck_vault_decks
  alter column id set default gen_random_uuid(),
  add column if not exists deck_key text,
  add column if not exists commander text,
  add column if not exists theme text,
  add column if not exists commander_names text[] not null default '{}',
  add column if not exists colors text[] not null default '{}',
  add column if not exists market_value numeric(12,2) not null default 0,
  add column if not exists status text not null default 'Building',
  add column if not exists deck_data jsonb,
  add column if not exists unresolved_cards jsonb not null default '[]'::jsonb;

-- Recover keys and full deck documents from every previous Deck Vault shape.
update public.deck_vault_decks
set deck_key = coalesce(
  nullif(deck_key, ''),
  nullif(deck_data ->> 'id', ''),
  id::text
)
where deck_key is null or deck_key = '';

update public.deck_vault_decks
set deck_data = jsonb_build_object(
  'id', deck_key,
  'name', name,
  'commander', commander,
  'commanders', coalesce(to_jsonb(commander_names), '[]'::jsonb),
  'format', format,
  'theme', coalesce(theme, ''),
  'colors', coalesce(to_jsonb(colors), '[]'::jsonb),
  'marketValue', coalesce(market_value, 0),
  'ownedCount', 0,
  'cardCount', 0,
  'power', 5,
  'updatedAt', updated_at,
  'status', coalesce(status, 'Building'),
  'cards', '[]'::jsonb
)
where deck_data is null;

-- If an old migration produced duplicate logical decks, preserve the newest row.
delete from public.deck_vault_decks older
using public.deck_vault_decks newer
where older.user_id = newer.user_id
  and older.deck_key = newer.deck_key
  and (
    older.updated_at < newer.updated_at
    or (older.updated_at = newer.updated_at and older.id < newer.id)
  );

create unique index if not exists deck_vault_decks_user_deck_key_idx
  on public.deck_vault_decks(user_id, deck_key);
create index if not exists deck_vault_decks_user_updated_idx
  on public.deck_vault_decks(user_id, updated_at desc);

-- Inventory tables: one protected record per account and item.
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
  quantity integer not null default 0,
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

alter table public.account_documents enable row level security;
alter table public.deck_vault_decks enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "Users manage their own account documents" on public.account_documents;
create policy "Users manage their own account documents"
  on public.account_documents for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own deck vault decks" on public.deck_vault_decks;
drop policy if exists "Users manage their own decks" on public.deck_vault_decks;
drop policy if exists "Users read their own decks" on public.deck_vault_decks;
drop policy if exists "Users add their own decks" on public.deck_vault_decks;
drop policy if exists "Users update their own decks" on public.deck_vault_decks;
create policy "Users read their own decks" on public.deck_vault_decks
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add their own decks" on public.deck_vault_decks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update their own decks" on public.deck_vault_decks
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their inventory locations" on public.inventory_locations;
create policy "Users manage their inventory locations" on public.inventory_locations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their inventory items" on public.inventory_items;
create policy "Users manage their inventory items" on public.inventory_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their inventory movements" on public.inventory_movements;
create policy "Users manage their inventory movements" on public.inventory_movements
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.account_documents, public.deck_vault_decks,
  public.inventory_locations, public.inventory_items, public.inventory_movements from anon;
grant select, insert, update, delete on public.account_documents,
  public.inventory_locations, public.inventory_items, public.inventory_movements to authenticated;
grant select, insert, update on public.deck_vault_decks to authenticated;
revoke delete on public.deck_vault_decks from authenticated;
