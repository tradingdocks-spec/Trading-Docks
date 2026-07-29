-- Platform marketplace developer credentials are configured once by the
-- Trading Docks owner and are accessed only by trusted server routes.
-- Individual stores never receive direct table access.
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

revoke all on public.platform_marketplace_integrations from anon;
revoke all on public.platform_marketplace_integrations from authenticated;

comment on table public.platform_marketplace_integrations is
  'Encrypted platform marketplace application credentials; service-role access only.';
