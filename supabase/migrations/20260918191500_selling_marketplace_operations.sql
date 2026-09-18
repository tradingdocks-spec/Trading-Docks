-- Durable staging-safe marketplace state and operation history.

alter table public.selling_marketplace_listings
  add column if not exists prepared_payload jsonb not null default '{}'::jsonb,
  add column if not exists normalized_status text not null default 'DRAFT',
  add column if not exists marketplace_status text,
  add column if not exists image_references jsonb not null default '[]'::jsonb,
  add column if not exists condition_mapping text,
  add column if not exists category_id text,
  add column if not exists environment text not null default 'mock',
  add column if not exists last_publish_attempt timestamptz,
  add column if not exists last_successful_publish timestamptz,
  add column if not exists last_error text;

create unique index if not exists selling_marketplace_candidate_market_idx
  on public.selling_marketplace_listings(workspace_id, candidate_id, marketplace_id);

create table if not exists public.selling_marketplace_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  marketplace_id text not null,
  setting_type text not null check (setting_type in ('merchant_location','fulfillment_policy','payment_policy','return_policy','category','account')),
  external_id text not null,
  display_name text not null,
  active boolean not null default true,
  marketplace_site text,
  is_default boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  unique (user_id, workspace_id, marketplace_id, setting_type, external_id)
);

create table if not exists public.selling_marketplace_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  listing_id uuid references public.selling_marketplace_listings(id) on delete set null,
  candidate_id uuid references public.selling_listing_candidates(id) on delete set null,
  marketplace_id text not null,
  operation text not null check (operation in ('prepare','validate','publish_requested','inventory_item_upserted','offer_upserted','publish_succeeded','publish_failed','retry','quantity_update','price_update','end_listing')),
  normalized_result text not null,
  external_inventory_id text,
  external_offer_id text,
  external_listing_id text,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists selling_marketplace_operations_listing_idx
  on public.selling_marketplace_operations(workspace_id, listing_id, created_at desc);
create index if not exists selling_marketplace_settings_lookup_idx
  on public.selling_marketplace_settings(workspace_id, marketplace_id, setting_type, active);

alter table public.selling_marketplace_settings enable row level security;
alter table public.selling_marketplace_operations enable row level security;

create policy "Users manage own selling marketplace settings" on public.selling_marketplace_settings
  for all to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)))
  with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));
create policy "Users view own selling marketplace operations" on public.selling_marketplace_operations
  for select to authenticated
  using ((select auth.uid()) = user_id and (workspace_id is null or public.is_workspace_member(workspace_id)));

revoke all on public.selling_marketplace_settings, public.selling_marketplace_operations from anon;
grant select, insert, update, delete on public.selling_marketplace_settings to authenticated;
grant select on public.selling_marketplace_operations to authenticated;
