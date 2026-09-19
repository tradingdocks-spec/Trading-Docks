-- Trading Docks admin marketing growth engine foundation.
-- Additive, admin-only, and intentionally not applied by deployment.
-- Real email delivery remains disabled until an owner configures a provider.

create extension if not exists pgcrypto;

create table if not exists public.marketing_feature_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'planned', 'archived')),
  internal_description text not null default '',
  customer_description text not null default '',
  target_audiences text[] not null default '{}',
  problems_solved text[] not null default '{}',
  capabilities text[] not null default '{}',
  approved_claims jsonb not null default '[]'::jsonb,
  disallowed_claims jsonb not null default '[]'::jsonb,
  proof_points jsonb not null default '[]'::jsonb,
  relevant_cta text not null default 'Learn more',
  landing_url text,
  suggested_angles text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_brand_rules (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null unique default 'default',
  personality text[] not null default '{}',
  avoid_phrases text[] not null default '{}',
  approved_language jsonb not null default '[]'::jsonb,
  prohibited_language jsonb not null default '[]'::jsonb,
  visual_rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null check (asset_type in ('logo', 'screenshot', 'product', 'card', 'background', 'texture', 'video', 'icon', 'campaign_art')),
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  tags text[] not null default '{}',
  feature_ids uuid[] not null default '{}',
  game_ids text[] not null default '{}',
  approved_for_marketing boolean not null default false,
  source text not null default 'admin_uploaded',
  license_notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  contact_name text,
  job_title text,
  email text not null,
  normalized_email text not null,
  contact_type text not null default 'unknown' check (contact_type in ('owner', 'manager', 'buyer', 'sales', 'general', 'info', 'support', 'unknown')),
  confidence text not null default 'unknown' check (confidence in ('verified', 'high', 'medium', 'low', 'unknown')),
  source_url text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prospect_id, normalized_email)
);

create table if not exists public.marketing_prospect_signals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  signal text not null,
  value text not null,
  confidence text not null default 'unknown' check (confidence in ('verified', 'high', 'medium', 'low', 'unknown')),
  source_type text not null check (source_type in ('business_finder', 'website', 'social', 'admin', 'provider')),
  source_url text,
  captured_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.marketing_prospect_feature_fit (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  feature_id uuid not null references public.marketing_feature_library(id) on delete cascade,
  relevance text not null check (relevance in ('high', 'medium', 'low', 'unknown')),
  reasons jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (prospect_id, feature_id)
);

create table if not exists public.marketing_outbound_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  feature_id uuid references public.marketing_feature_library(id) on delete set null,
  audience text not null default 'local_game_store',
  objective text not null default 'awareness',
  status text not null default 'draft' check (status in ('draft', 'ready_for_review', 'approved', 'active', 'paused', 'completed', 'archived')),
  creative_brief jsonb not null default '{}'::jsonb,
  cta text not null default '',
  landing_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_creative_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete cascade,
  prospect_id uuid references public.marketing_prospects(id) on delete set null,
  brief jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'archived')),
  revision integer not null default 0 check (revision >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete cascade,
  brief_id uuid references public.marketing_creative_briefs(id) on delete set null,
  name text not null,
  composition_family text not null check (composition_family in ('product_hero', 'product_cards', 'before_after', 'feature_spotlight', 'operational_pain', 'data_analytics', 'editorial_tcg', 'workflow', 'minimal_typography', 'social_carousel')),
  platform text not null default 'email',
  variant_key text not null default 'A',
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'rejected', 'archived')),
  copy_payload jsonb not null default '{}'::jsonb,
  asset_ids uuid[] not null default '{}',
  revision integer not null default 0 check (revision >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, variant_key, platform)
);

create table if not exists public.marketing_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  creative_id uuid references public.marketing_creatives(id) on delete set null,
  recipient_contact_id uuid references public.marketing_prospect_contacts(id) on delete set null,
  subject text not null,
  preview_text text not null default '',
  body_text text not null,
  rationale jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'sent', 'failed', 'rejected', 'suppressed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  scheduled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.marketing_outreach_drafts(id) on delete cascade,
  normalized_email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'suppressed')),
  idempotency_key text not null unique,
  provider text not null default 'mock',
  provider_message_id text,
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_email_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.marketing_outreach_messages(id) on delete cascade,
  provider_event_id text not null unique,
  event_type text not null check (event_type in ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'replied', 'unsubscribed')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.marketing_outbound_suppressions (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  reason text not null check (reason in ('manual', 'hard_bounce', 'complaint', 'unsubscribe', 'provider_suppression')),
  source text not null default 'admin',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_generation_runs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type in ('research', 'fit', 'campaign', 'creative_brief', 'copy', 'critique', 'reply_classification')),
  provider text not null default 'deterministic',
  model text,
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  prospect_id uuid references public.marketing_prospects(id) on delete set null,
  input_hash text not null,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  revision_count integer not null default 0 check (revision_count between 0 and 3),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.marketing_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null unique default 'default',
  email_provider text not null default 'mock' check (email_provider in ('mock', 'resend', 'postmark')),
  outbound_enabled boolean not null default false,
  from_name text,
  from_email text,
  reply_to text,
  business_name text,
  business_address text,
  unsubscribe_base_url text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.marketing_brand_rules (singleton_key, personality, avoid_phrases, approved_language, prohibited_language, visual_rules)
values ('default', array['premium', 'modern', 'technical', 'TCG-native', 'confident', 'restrained', 'operator-aware'], array['unlock your potential', 'revolutionize your workflow', 'game-changing solution', 'cutting-edge platform'], '[{"phrase":"Turn unsorted cards into organized inventory."},{"phrase":"Know what you own. Know where it is."}]'::jsonb, '[{"rule":"No fabricated metrics or unsupported product claims."}]'::jsonb, '{"style":"editorial, product-first, restrained","avoid":["generic SaaS gradients","fake UI","random glow"]}'::jsonb)
on conflict (singleton_key) do nothing;

insert into public.marketing_settings (singleton_key, email_provider, outbound_enabled)
values ('default', 'mock', false)
on conflict (singleton_key) do nothing;

insert into public.marketing_feature_library (slug, name, internal_description, customer_description, target_audiences, problems_solved, capabilities, approved_claims, disallowed_claims, relevant_cta, suggested_angles)
values
  ('chaos-sort', 'Chaos Sort', 'Card intake and sorting workflow.', 'Turn unsorted cards into identifiable, trackable inventory.', array['local_game_store','high_volume_online_seller'], array['unorganized collection intake','unknown card identity'], array['scan cards','build batches','assign locations'], '[{"claim":"Supports card intake, batches, and physical locations."}]'::jsonb, '[{"claim":"Sorts inventory 10x faster"}]'::jsonb, 'See Chaos Sort', array['Collections do not arrive organized.','Make intake traceable from scan to shelf.']),
  ('inventory', 'Inventory Management', 'Core inventory and provenance workflows.', 'Keep inventory records connected to real cards and their locations.', array['local_game_store','multi_location_store','high_volume_online_seller'], array['lost physical cards','unclear provenance'], array['track inventory','preserve batch and location provenance'], '[{"claim":"Keeps card records connected to physical inventory context."}]'::jsonb, '[{"claim":"Eliminates all inventory errors"}]'::jsonb, 'Explore Inventory', array['Know what you own. Know where it is.']),
  ('orders', 'Orders Center', 'Order and fulfillment workflows.', 'Keep order work visible from sale through fulfillment.', array['local_game_store','high_volume_online_seller'], array['missed fulfillment steps'], array['review orders','track fulfillment work'], '[{"claim":"Provides an operational view for order work."}]'::jsonb, '[{"claim":"Guarantees same-day fulfillment"}]'::jsonb, 'Explore Orders', array['Make the next fulfillment step obvious.'])
on conflict (slug) do nothing;

create index if not exists marketing_prospect_contacts_email_idx on public.marketing_prospect_contacts(normalized_email);
create index if not exists marketing_prospect_signals_prospect_idx on public.marketing_prospect_signals(prospect_id, captured_at desc);
create index if not exists marketing_prospect_fit_prospect_idx on public.marketing_prospect_feature_fit(prospect_id, relevance);
create index if not exists marketing_outbound_campaigns_status_idx on public.marketing_outbound_campaigns(status, updated_at desc);
create index if not exists marketing_outreach_drafts_queue_idx on public.marketing_outreach_drafts(status, scheduled_at, updated_at desc);
create index if not exists marketing_outreach_messages_status_idx on public.marketing_outreach_messages(status, created_at desc);
create index if not exists marketing_email_events_message_idx on public.marketing_email_events(message_id, occurred_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['marketing_feature_library','marketing_brand_rules','marketing_assets','marketing_prospect_contacts','marketing_prospect_signals','marketing_prospect_feature_fit','marketing_outbound_campaigns','marketing_creative_briefs','marketing_creatives','marketing_outreach_drafts','marketing_outreach_messages','marketing_email_events','marketing_outbound_suppressions','marketing_generation_runs','marketing_settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_only', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin(''admin'')) with check (public.is_admin(''admin''))', table_name || '_admin_only', table_name);
  end loop;
end $$;
