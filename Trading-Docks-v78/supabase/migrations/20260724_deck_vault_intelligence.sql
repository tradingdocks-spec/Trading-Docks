-- Trading Docks Deck Vault Intelligence V18

create table if not exists public.deck_vault_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  format text not null,
  theme text,
  commander_names text[] not null default '{}',
  colors text[] not null default '{}',
  market_value numeric(12,2) not null default 0,
  status text not null default 'Building',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deck_vault_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.deck_vault_decks(id) on delete cascade,
  scryfall_id text not null,
  card_name text not null,
  quantity integer not null default 1,
  board text not null default 'main',
  legality_status text,
  legality_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.deck_vault_inventory_links (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.deck_vault_decks(id) on delete cascade,
  deck_card_id uuid not null references public.deck_vault_cards(id) on delete cascade,
  inventory_id text not null,
  quantity integer not null default 1,
  physical_location text,
  condition text,
  printing text,
  platform text,
  listing_id text,
  reserved_for_deck boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.deck_vault_tokens (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.deck_vault_decks(id) on delete cascade,
  token_name text not null,
  image_url text,
  estimated_quantity text,
  created_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.deck_vault_decks enable row level security;
alter table public.deck_vault_cards enable row level security;
alter table public.deck_vault_inventory_links enable row level security;
alter table public.deck_vault_tokens enable row level security;

create policy "Users manage own deck vault decks"
on public.deck_vault_decks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage cards in own decks"
on public.deck_vault_cards
for all
using (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
);

create policy "Users manage inventory links in own decks"
on public.deck_vault_inventory_links
for all
using (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
);

create policy "Users manage tokens in own decks"
on public.deck_vault_tokens
for all
using (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.deck_vault_decks d
    where d.id = deck_id and d.user_id = auth.uid()
  )
);
