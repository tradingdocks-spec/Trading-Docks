-- Deck Vault account persistence repair.
--
-- An older Trading Docks migration already created deck_vault_decks with a
-- UUID `id` primary key. The prior persistence migration used
-- `create table if not exists`, so its new columns were never added to an
-- existing installation. This migration upgrades either schema in place and
-- deliberately disables deletion for signed-in users.

create table if not exists public.deck_vault_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Deck',
  format text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deck_vault_decks
  add column if not exists deck_key text,
  add column if not exists commander text,
  add column if not exists deck_data jsonb,
  add column if not exists unresolved_cards jsonb not null default '[]'::jsonb;

-- Preserve any rows written by v125's alternate `deck_id` schema.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deck_vault_decks'
      and column_name = 'deck_id'
  ) then
    execute 'update public.deck_vault_decks
      set deck_key = coalesce(deck_key, deck_id::text)
      where deck_key is null';

    -- A database first created by v125 used (user_id, deck_id) as its primary
    -- key. The application now keys rows through deck_key, so release the old
    -- NOT NULL/primary-key requirement after preserving its values.
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.deck_vault_decks'::regclass
        and conname = 'deck_vault_decks_pkey'
        and pg_get_constraintdef(oid) ilike '%deck_id%'
    ) then
      alter table public.deck_vault_decks
        drop constraint deck_vault_decks_pkey;
    end if;
    alter table public.deck_vault_decks
      alter column deck_id drop not null;
  end if;
end
$$;

create unique index if not exists deck_vault_decks_user_deck_key_idx
  on public.deck_vault_decks(user_id, deck_key);

create index if not exists deck_vault_decks_user_updated_idx
  on public.deck_vault_decks(user_id, updated_at desc);

alter table public.deck_vault_decks enable row level security;

drop policy if exists "Users manage their own decks" on public.deck_vault_decks;
drop policy if exists "Users manage own deck vault decks" on public.deck_vault_decks;
drop policy if exists "Users read their own decks" on public.deck_vault_decks;
drop policy if exists "Users add their own decks" on public.deck_vault_decks;
drop policy if exists "Users update their own decks" on public.deck_vault_decks;

create policy "Users read their own decks"
  on public.deck_vault_decks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users add their own decks"
  on public.deck_vault_decks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update their own decks"
  on public.deck_vault_decks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.deck_vault_decks from anon;
revoke delete on public.deck_vault_decks from authenticated;
grant select, insert, update on public.deck_vault_decks to authenticated;
