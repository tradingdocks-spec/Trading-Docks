-- Additive Trading Docks brand governance for deterministic marketing creatives.
-- Reviewed artifact only; do not apply remotely as part of this change.

alter table public.marketing_brand_rules
  add column if not exists brand_profile_version integer not null default 1,
  add column if not exists brand_tokens jsonb not null default '{}'::jsonb,
  add column if not exists logo_usage_rules jsonb not null default '{}'::jsonb,
  add column if not exists copy_rules jsonb not null default '{}'::jsonb;

alter table public.marketing_assets
  add column if not exists brand_role text,
  add column if not exists screenshot_role text,
  add column if not exists focal_x numeric,
  add column if not exists focal_y numeric,
  add column if not exists safe_crop boolean not null default false,
  add column if not exists preferred_aspect_ratios text[] not null default '{}';

alter table public.marketing_assets drop constraint if exists marketing_assets_brand_role_check;
alter table public.marketing_assets add constraint marketing_assets_brand_role_check check (brand_role is null or brand_role in ('logo_primary', 'logo_wordmark', 'logo_icon', 'logo_light', 'logo_dark', 'logo_monochrome', 'product_chaos_sort_primary', 'product_inventory_primary', 'product_orders_primary', 'background_editorial_01', 'background_dark_texture_01'));
alter table public.marketing_assets drop constraint if exists marketing_assets_screenshot_role_check;
alter table public.marketing_assets add constraint marketing_assets_screenshot_role_check check (screenshot_role is null or screenshot_role in ('primary', 'secondary', 'detail', 'mobile', 'workflow', 'before', 'after'));

create table if not exists public.marketing_campaign_visual_families (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete cascade,
  feature_id uuid references public.marketing_feature_library(id) on delete set null,
  name text not null,
  concept_id text not null check (concept_id in ('product', 'transformation', 'editorial')),
  concept_payload jsonb not null default '{}'::jsonb,
  brand_profile_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_creatives
  add column if not exists campaign_visual_family_id uuid references public.marketing_campaign_visual_families(id) on delete set null,
  add column if not exists concept_direction text,
  add column if not exists brand_profile_version integer not null default 1,
  add column if not exists gold_standard boolean not null default false,
  add column if not exists brand_signature jsonb not null default '{}'::jsonb,
  add column if not exists quality_review jsonb not null default '[]'::jsonb;
alter table public.marketing_creatives drop constraint if exists marketing_creatives_concept_direction_check;
alter table public.marketing_creatives add constraint marketing_creatives_concept_direction_check check (concept_direction is null or concept_direction in ('product', 'transformation', 'editorial'));

create index if not exists marketing_assets_brand_role_idx on public.marketing_assets(brand_role, approval_status, archived_at);
create index if not exists marketing_creatives_gold_standard_idx on public.marketing_creatives(gold_standard, status, updated_at desc);
create index if not exists marketing_creatives_visual_family_idx on public.marketing_creatives(campaign_visual_family_id, platform, status);

alter table public.marketing_campaign_visual_families enable row level security;
revoke all on public.marketing_campaign_visual_families from anon;
grant select, insert, update, delete on public.marketing_campaign_visual_families to authenticated;
drop policy if exists marketing_campaign_visual_families_admin_only on public.marketing_campaign_visual_families;
create policy marketing_campaign_visual_families_admin_only on public.marketing_campaign_visual_families for all to authenticated using (public.is_admin('admin')) with check (public.is_admin('admin'));

update public.marketing_brand_rules
set brand_tokens = jsonb_build_object('colors', jsonb_build_object('backgroundPrimary', '#0a101b', 'backgroundSecondary', '#14243b', 'surface', '#182a42', 'accent', '#35cafa', 'textPrimary', '#eff6ff', 'textSecondary', '#b9cae1', 'border', '#304762', 'success', '#52d69a', 'warning', '#f4c95d'), 'typography', jsonb_build_object('displayFamily', 'Geist, Arial, sans-serif', 'headlineFamily', 'Geist, Arial, sans-serif', 'bodyFamily', 'Geist, Arial, sans-serif', 'labelFamily', 'Geist Mono, monospace'), 'radii', jsonb_build_object('productFrame', 18, 'cta', 22, 'card', 16), 'spacing', jsonb_build_object('safeMargin', 72, 'logoClearSpace', 24)),
logo_usage_rules = '{"preferredVariants":["wordmark","mark"],"minimumSizing":"Preserve aspect ratio and clear space.","prohibited":["stretching","skewing","rotation","unapproved recoloring","heavy glow"]}'::jsonb,
copy_rules = '{"voice":["concise","confident","TCG-native","operator-aware","understated","direct"],"preferredPhrases":["Sort the chaos.","Know what you own. Know where it is."],"prohibitedPhrases":["revolutionize your workflow","unlock your potential","game-changing solution"]}'::jsonb
where singleton_key = 'default' and brand_tokens = '{}'::jsonb;
