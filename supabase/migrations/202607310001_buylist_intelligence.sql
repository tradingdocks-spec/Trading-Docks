-- User-scoped buylist feeds. Import/API adapters write normalized exact-printing offers here.
create table if not exists public.buylist_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  scryfall_id text,
  card_name text not null,
  set_code text not null default '',
  collector_number text not null default '',
  finish text not null default 'nonfoil',
  language text not null default 'English',
  condition text not null default 'NM',
  cash_price numeric(12,2) not null check (cash_price >= 0),
  credit_price numeric(12,2) check (credit_price is null or credit_price >= 0),
  quantity_wanted integer not null default 1 check (quantity_wanted >= 0),
  source_url text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buylist_offers_user_printing_idx
  on public.buylist_offers(user_id, scryfall_id, set_code, collector_number);
create index if not exists buylist_offers_user_card_idx
  on public.buylist_offers(user_id, lower(card_name));
create unique index if not exists buylist_offers_exact_offer_idx
  on public.buylist_offers(user_id, store_name, card_name, set_code, collector_number, finish, language, condition);

alter table public.buylist_offers enable row level security;
drop policy if exists "Users manage their buylist feeds" on public.buylist_offers;
create policy "Users manage their buylist feeds" on public.buylist_offers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.buylist_offers from anon;
grant select, insert, update, delete on public.buylist_offers to authenticated;

comment on table public.buylist_offers is
  'Normalized, user-scoped buylist offers imported from authorized store feeds or CSV files.';
