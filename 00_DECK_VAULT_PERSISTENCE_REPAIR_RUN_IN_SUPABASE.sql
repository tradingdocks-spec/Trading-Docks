-- Run this once in the Supabase SQL editor for Trading Docks v136.

alter table public.deck_vault_decks enable row level security;

drop policy if exists "Users read their own decks" on public.deck_vault_decks;
drop policy if exists "Users add their own decks" on public.deck_vault_decks;
drop policy if exists "Users update their own decks" on public.deck_vault_decks;
drop policy if exists "Users delete their own decks" on public.deck_vault_decks;

create policy "Users read their own decks" on public.deck_vault_decks
  for select to authenticated using (auth.uid() = user_id);
create policy "Users add their own decks" on public.deck_vault_decks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update their own decks" on public.deck_vault_decks
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users delete their own decks" on public.deck_vault_decks
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.deck_vault_decks to authenticated;
revoke all on public.deck_vault_decks from anon;
