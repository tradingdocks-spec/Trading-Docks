-- Reliable Deck Vault persistence.
-- Each deck is its own row, so concurrent imports cannot overwrite a shared list.
create table if not exists public.deck_vault_decks (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null check (length(deck_id) between 1 and 160),
  name text not null default 'Untitled Deck',
  format text not null default '',
  commander text,
  deck_data jsonb not null,
  unresolved_cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create index if not exists deck_vault_decks_user_updated_idx
  on public.deck_vault_decks(user_id, updated_at desc);

alter table public.deck_vault_decks enable row level security;

drop policy if exists "Users manage their own decks" on public.deck_vault_decks;
create policy "Users manage their own decks"
  on public.deck_vault_decks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.deck_vault_decks from anon;
grant select, insert, update, delete on public.deck_vault_decks to authenticated;
