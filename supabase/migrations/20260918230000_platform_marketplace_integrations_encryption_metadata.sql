-- Add encryption metadata expected by the marketplace credential service.
-- Nullable for backwards compatibility with any credentials encrypted before
-- algorithm/key-version metadata was persisted.
alter table public.platform_marketplace_integrations
  add column if not exists encryption_algorithm text,
  add column if not exists encryption_key_version text;

comment on column public.platform_marketplace_integrations.encryption_algorithm is
  'Server-side encryption algorithm identifier for encrypted marketplace credentials.';

comment on column public.platform_marketplace_integrations.encryption_key_version is
  'Server-side key version identifier for encrypted marketplace credentials.';
