-- TCGTracking enrichment cache proposal.
-- Forward-only, additive, and intentionally non-authoritative.
-- Do not apply to production until reviewed and approved.

create table if not exists public.tcgtracking_product_mappings (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  tcgplayer_product_id bigint not null,
  scryfall_id uuid,
  mtgjson_uuid uuid,
  cardmarket_id text,
  cardtrader_id text,
  image_url text,
  provider_set_id text,
  set_abbr text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tcgtracking_product_mappings_product_key
    unique (category_id, tcgplayer_product_id),
  constraint tcgtracking_product_mappings_image_url_check
    check (image_url is null or image_url ~ '^https://')
);

create table if not exists public.tcgtracking_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  tcgplayer_product_id bigint not null,
  tcgplayer_sku_id bigint,
  condition text,
  finish text,
  language text,
  tcg_market numeric(12, 2),
  tcg_low numeric(12, 2),
  tcg_high numeric(12, 2),
  active_listing_count integer,
  manapool_low numeric(12, 2),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tcgtracking_price_snapshots_nonnegative_prices_check
    check (
      (tcg_market is null or tcg_market >= 0) and
      (tcg_low is null or tcg_low >= 0) and
      (tcg_high is null or tcg_high >= 0) and
      (manapool_low is null or manapool_low >= 0)
    ),
  constraint tcgtracking_price_snapshots_listing_count_check
    check (active_listing_count is null or active_listing_count >= 0)
);

create table if not exists public.tcgtracking_sync_runs (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  sync_type text not null,
  status text not null default 'queued',
  checkpoint jsonb not null default '{}'::jsonb,
  processed integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  failed integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tcgtracking_sync_runs_sync_type_check
    check (sync_type in ('product_mappings', 'price_snapshots', 'sample_reconciliation')),
  constraint tcgtracking_sync_runs_status_check
    check (status in ('queued', 'processing', 'completed', 'failed', 'paused'))
);

create index if not exists tcgtracking_product_mappings_tcgplayer_product_idx
  on public.tcgtracking_product_mappings (tcgplayer_product_id);

create index if not exists tcgtracking_product_mappings_scryfall_idx
  on public.tcgtracking_product_mappings (scryfall_id)
  where scryfall_id is not null;

create index if not exists tcgtracking_product_mappings_last_synced_idx
  on public.tcgtracking_product_mappings (last_synced_at desc);

create index if not exists tcgtracking_price_snapshots_product_observed_idx
  on public.tcgtracking_price_snapshots (tcgplayer_product_id, observed_at desc);

create index if not exists tcgtracking_price_snapshots_sku_observed_idx
  on public.tcgtracking_price_snapshots (tcgplayer_sku_id, observed_at desc)
  where tcgplayer_sku_id is not null;

create index if not exists tcgtracking_price_snapshots_variant_observed_idx
  on public.tcgtracking_price_snapshots (
    category_id,
    tcgplayer_product_id,
    condition,
    finish,
    language,
    observed_at desc
  );

create index if not exists tcgtracking_sync_runs_status_idx
  on public.tcgtracking_sync_runs (category_id, sync_type, status, started_at desc);

create or replace function public.set_tcgtracking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tcgtracking_product_mappings_updated_at
  on public.tcgtracking_product_mappings;
create trigger set_tcgtracking_product_mappings_updated_at
before update on public.tcgtracking_product_mappings
for each row execute function public.set_tcgtracking_updated_at();

drop trigger if exists set_tcgtracking_sync_runs_updated_at
  on public.tcgtracking_sync_runs;
create trigger set_tcgtracking_sync_runs_updated_at
before update on public.tcgtracking_sync_runs
for each row execute function public.set_tcgtracking_updated_at();

alter table public.tcgtracking_product_mappings enable row level security;
alter table public.tcgtracking_price_snapshots enable row level security;
alter table public.tcgtracking_sync_runs enable row level security;

revoke all on table public.tcgtracking_product_mappings from anon, authenticated;
revoke all on table public.tcgtracking_price_snapshots from anon, authenticated;
revoke all on table public.tcgtracking_sync_runs from anon, authenticated;

comment on table public.tcgtracking_product_mappings is
  'Global non-authoritative TCGTracking identity enrichment mapped to existing TCGplayer product identity.';
comment on table public.tcgtracking_price_snapshots is
  'Global non-authoritative TCGTracking SKU price observations. User inventory and pricing authority remain separate.';
comment on table public.tcgtracking_sync_runs is
  'Bounded server-side TCGTracking sync checkpoints and operational history.';
