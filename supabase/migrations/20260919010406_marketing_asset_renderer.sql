-- Additive renderer and Asset Vault layer for the admin marketing workspace.
-- This migration is intentionally not applied remotely by this task.

alter table public.marketing_assets
  add column if not exists slug text,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists source_url text,
  add column if not exists alt_text text not null default '',
  add column if not exists product_display_allowed boolean not null default false,
  add column if not exists marketing_use_approved boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.marketing_assets drop constraint if exists marketing_assets_asset_type_check;
alter table public.marketing_assets drop constraint if exists marketing_assets_approval_status_check;
alter table public.marketing_assets
  add constraint marketing_assets_asset_type_check check (asset_type in (
    'logo', 'product_screenshot', 'feature_screenshot', 'card_image', 'background',
    'texture', 'device_mockup', 'icon', 'campaign_artwork', 'social_export',
    'email_export', 'other'
  )),
  add constraint marketing_assets_approval_status_check check (approval_status in ('draft', 'approved', 'restricted', 'archived'));

create unique index if not exists marketing_assets_slug_idx
  on public.marketing_assets(slug) where slug is not null;
create index if not exists marketing_assets_library_idx
  on public.marketing_assets(approval_status, archived_at, asset_type, updated_at desc);
create index if not exists marketing_assets_feature_idx
  on public.marketing_assets using gin(feature_ids);
create index if not exists marketing_assets_game_idx
  on public.marketing_assets using gin(game_ids);

alter table public.marketing_creatives
  add column if not exists render_spec jsonb not null default '{}'::jsonb,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists rendered_storage_path text,
  add column if not exists quality_issues jsonb not null default '[]'::jsonb,
  add column if not exists parent_creative_id uuid references public.marketing_creatives(id) on delete set null;

create index if not exists marketing_creatives_campaign_platform_idx
  on public.marketing_creatives(campaign_id, platform, status, updated_at desc);
create index if not exists marketing_creatives_parent_idx
  on public.marketing_creatives(parent_creative_id);

create table if not exists public.marketing_campaign_creatives (
  campaign_id uuid not null references public.marketing_outbound_campaigns(id) on delete cascade,
  creative_id uuid not null references public.marketing_creatives(id) on delete cascade,
  attached_by uuid references auth.users(id) on delete set null,
  attached_at timestamptz not null default now(),
  primary key (campaign_id, creative_id)
);

alter table public.marketing_campaign_creatives enable row level security;
revoke all on public.marketing_campaign_creatives from anon;
grant select, insert, update, delete on public.marketing_campaign_creatives to authenticated;
drop policy if exists marketing_campaign_creatives_admin_only on public.marketing_campaign_creatives;
create policy marketing_campaign_creatives_admin_only
  on public.marketing_campaign_creatives for all to authenticated
  using (public.is_admin('admin')) with check (public.is_admin('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-assets', 'marketing-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists marketing_assets_admin_upload on storage.objects;
create policy marketing_assets_admin_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing-assets' and public.is_admin('admin'));
drop policy if exists marketing_assets_admin_read on storage.objects;
create policy marketing_assets_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-assets' and public.is_admin('admin'));
drop policy if exists marketing_assets_admin_update on storage.objects;
create policy marketing_assets_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'marketing-assets' and public.is_admin('admin'))
  with check (bucket_id = 'marketing-assets' and public.is_admin('admin'));
drop policy if exists marketing_assets_admin_delete on storage.objects;
create policy marketing_assets_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-assets' and public.is_admin('admin'));
