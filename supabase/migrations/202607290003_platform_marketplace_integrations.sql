-- Admin-owned marketplace application credentials.
-- Store OAuth tokens remain in marketplace_oauth_tokens and are isolated per user.
create table if not exists public.platform_marketplace_integrations (
  marketplace_id text primary key,
  encrypted_payload text not null,
  iv text not null,
  auth_tag text not null,
  credential_labels jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  configured_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_marketplace_integrations enable row level security;

drop policy if exists "Platform owner manages marketplace integrations"
on public.platform_marketplace_integrations;
create policy "Platform owner manages marketplace integrations"
on public.platform_marketplace_integrations
for all to authenticated
using (public.is_platform_owner())
with check (public.is_platform_owner());

revoke all on public.platform_marketplace_integrations from anon;
grant select, insert, update, delete
on public.platform_marketplace_integrations to authenticated;
