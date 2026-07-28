-- Encrypted, user-owned marketplace connector credentials.
-- Plaintext values are encrypted by the Trading Docks server before insert.

create table if not exists public.marketplace_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  encrypted_payload text not null,
  iv text not null,
  auth_tag text not null,
  credential_labels jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_id)
);

alter table public.marketplace_credentials enable row level security;

drop policy if exists "Users manage own encrypted marketplace credentials"
on public.marketplace_credentials;
create policy "Users manage own encrypted marketplace credentials"
on public.marketplace_credentials
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists marketplace_credentials_user_idx
on public.marketplace_credentials (user_id);

revoke select (encrypted_payload, iv, auth_tag)
on public.marketplace_credentials from authenticated;

notify pgrst, 'reload schema';
