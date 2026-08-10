create table if not exists public.tcgplayer_magic_catalog (
  id uuid primary key default gen_random_uuid(),
  tcgplayer_id bigint not null,
  product_line text not null,
  set_name text not null,
  product_name text not null,
  title text,
  collector_number text,
  rarity text,
  raw_condition text not null,
  condition text not null,
  finish text not null,
  normalized_set_name text not null,
  normalized_product_name text not null,
  normalized_collector_number text,
  normalized_condition text not null,
  normalized_finish text not null,
  tcg_market_price numeric(12, 2),
  tcg_direct_low numeric(12, 2),
  tcg_low_price_with_shipping numeric(12, 2),
  tcg_low_price numeric(12, 2),
  total_quantity integer,
  add_to_quantity integer,
  tcg_marketplace_price numeric(12, 2),
  photo_url text,
  source_imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tcgplayer_magic_catalog_tcgplayer_id_key unique (tcgplayer_id),
  constraint tcgplayer_magic_catalog_product_line_check check (product_line = 'Magic'),
  constraint tcgplayer_magic_catalog_finish_check check (finish in ('Normal', 'Foil', 'Unopened'))
);

create index if not exists tcgplayer_magic_catalog_set_product_idx
  on public.tcgplayer_magic_catalog (normalized_set_name, normalized_product_name);

create index if not exists tcgplayer_magic_catalog_set_collector_idx
  on public.tcgplayer_magic_catalog (normalized_set_name, normalized_collector_number)
  where normalized_collector_number is not null;

create index if not exists tcgplayer_magic_catalog_product_collector_idx
  on public.tcgplayer_magic_catalog (normalized_product_name, normalized_collector_number)
  where normalized_collector_number is not null;

create index if not exists tcgplayer_magic_catalog_exact_variant_idx
  on public.tcgplayer_magic_catalog (
    normalized_set_name,
    normalized_product_name,
    normalized_collector_number,
    normalized_condition,
    normalized_finish
  );

create table if not exists public.tcgplayer_magic_catalog_imports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  status text not null default 'processing',
  filename text,
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  rejected_rows integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tcgplayer_magic_catalog_imports_status_check check (
    status in ('processing', 'completed', 'failed', 'validated')
  )
);

create index if not exists tcgplayer_magic_catalog_imports_started_idx
  on public.tcgplayer_magic_catalog_imports (started_at desc);

create or replace function public.tcgplayer_magic_catalog_stats()
returns table (
  total_records bigint,
  unique_products bigint,
  sets bigint,
  last_import jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_import as (
    select to_jsonb(i.*) as payload
    from public.tcgplayer_magic_catalog_imports i
    order by i.started_at desc
    limit 1
  )
  select
    count(*)::bigint as total_records,
    count(distinct c.normalized_product_name)::bigint as unique_products,
    count(distinct c.normalized_set_name)::bigint as sets,
    (select payload from latest_import) as last_import
  from public.tcgplayer_magic_catalog c;
$$;

create or replace function public.set_tcgplayer_magic_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tcgplayer_magic_catalog_updated_at on public.tcgplayer_magic_catalog;
create trigger set_tcgplayer_magic_catalog_updated_at
before update on public.tcgplayer_magic_catalog
for each row execute function public.set_tcgplayer_magic_catalog_updated_at();

drop trigger if exists set_tcgplayer_magic_catalog_imports_updated_at on public.tcgplayer_magic_catalog_imports;
create trigger set_tcgplayer_magic_catalog_imports_updated_at
before update on public.tcgplayer_magic_catalog_imports
for each row execute function public.set_tcgplayer_magic_catalog_updated_at();

alter table public.tcgplayer_magic_catalog enable row level security;
alter table public.tcgplayer_magic_catalog_imports enable row level security;

revoke all on table public.tcgplayer_magic_catalog from anon, authenticated;
revoke all on table public.tcgplayer_magic_catalog_imports from anon, authenticated;
revoke all on function public.tcgplayer_magic_catalog_stats() from anon, authenticated;

comment on table public.tcgplayer_magic_catalog is
  'Canonical Trading Docks reference catalog for condition/finish-specific TCGplayer Magic rows. Not user inventory.';

comment on column public.tcgplayer_magic_catalog.tcgplayer_id is
  'Unique TCGplayer row identifier from the source CSV export.';
