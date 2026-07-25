create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  commander_name text,
  format text not null default 'Commander',
  theme text,
  color_identity text[] not null default '{}',
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'building'
    check (status in ('complete', 'building', 'wishlist', 'archived')),
  power_estimate numeric(4,2),
  market_value numeric(12,2) not null default 0,
  primer text,
  source_name text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deck_cards (
  id bigint generated always as identity primary key,
  deck_id uuid not null references public.decks(id) on delete cascade,
  product_id bigint,
  card_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  board text not null default 'main'
    check (board in ('commander', 'main', 'sideboard', 'maybeboard', 'token')),
  category text,
  mana_value numeric(5,2),
  colors text[] not null default '{}',
  type_line text,
  market_price numeric(12,2),
  owned_quantity integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_updated_idx
  on public.decks(user_id, updated_at desc);

create index if not exists deck_cards_deck_idx
  on public.deck_cards(deck_id, board, sort_order);

create table if not exists public.deck_snapshots (
  id bigint generated always as identity primary key,
  deck_id uuid not null references public.decks(id) on delete cascade,
  market_value numeric(12,2),
  owned_count integer,
  missing_count integer,
  average_mana_value numeric(6,3),
  analytics jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists deck_snapshots_deck_time_idx
  on public.deck_snapshots(deck_id, captured_at desc);

alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.deck_snapshots enable row level security;

drop policy if exists "Users manage their decks" on public.decks;
create policy "Users manage their decks"
  on public.decks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage cards in their decks" on public.deck_cards;
create policy "Users manage cards in their decks"
  on public.deck_cards for all
  to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_cards.deck_id
      and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks
      where decks.id = deck_cards.deck_id
      and decks.user_id = auth.uid()
    )
  );

drop policy if exists "Users read their deck snapshots" on public.deck_snapshots;
create policy "Users read their deck snapshots"
  on public.deck_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.decks
      where decks.id = deck_snapshots.deck_id
      and decks.user_id = auth.uid()
    )
  );


alter table public.decks
  add column if not exists commander_card_id uuid,
  add column if not exists commander_image_url text,
  add column if not exists commander_art_crop_url text,
  add column if not exists commander_bracket integer,
  add column if not exists game_changer_count integer not null default 0;

alter table public.deck_cards
  add column if not exists image_url text,
  add column if not exists art_crop_url text,
  add column if not exists set_code text,
  add column if not exists collector_number text,
  add column if not exists is_game_changer boolean not null default false;

create table if not exists public.commander_game_changers (
  scryfall_id uuid primary key,
  card_name text not null,
  color_identity text[] not null default '{}',
  image_url text,
  synced_at timestamptz not null default now()
);

alter table public.commander_game_changers enable row level security;

drop policy if exists "Authenticated users read Commander Game Changers"
  on public.commander_game_changers;

create policy "Authenticated users read Commander Game Changers"
  on public.commander_game_changers for select
  to authenticated
  using (true);
