-- Campaign creative attachment, review history, and mock outreach provenance.
-- Additive only. This migration is intentionally not applied remotely by this task.

alter table public.marketing_creatives
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejection_notes text,
  add column if not exists variant_group_id uuid;

alter table public.marketing_creatives drop constraint if exists marketing_creatives_composition_family_check;
alter table public.marketing_creatives
  add constraint marketing_creatives_composition_family_check check (composition_family in ('product_hero', 'product_cards', 'before_after', 'feature_spotlight', 'operational_pain', 'data_analytics', 'editorial_tcg', 'workflow', 'minimal_editorial', 'minimal_typography', 'social_carousel'));

alter table public.marketing_creatives drop constraint if exists marketing_creatives_status_check;
alter table public.marketing_creatives
  add constraint marketing_creatives_status_check check (status in ('draft', 'review', 'needs_review', 'approved', 'rejected', 'archived'));

alter table public.marketing_campaign_creatives
  add column if not exists placement text not null default 'email_hero';

alter table public.marketing_campaign_creatives drop constraint if exists marketing_campaign_creatives_placement_check;
alter table public.marketing_campaign_creatives
  add constraint marketing_campaign_creatives_placement_check check (placement in ('email_hero', 'instagram_square', 'instagram_portrait', 'instagram_story', 'facebook_feed', 'google_square', 'google_landscape', 'linkedin_feed', 'x_feed'));
create unique index if not exists marketing_campaign_creatives_campaign_placement_idx
  on public.marketing_campaign_creatives(campaign_id, placement);
create index if not exists marketing_campaign_creatives_creative_idx
  on public.marketing_campaign_creatives(creative_id, placement);

alter table public.marketing_outreach_drafts
  add column if not exists version integer not null default 1,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejection_notes text;

alter table public.marketing_outreach_drafts drop constraint if exists marketing_outreach_drafts_status_check;
alter table public.marketing_outreach_drafts
  add constraint marketing_outreach_drafts_status_check check (status in ('draft', 'needs_review', 'approved', 'scheduled', 'sent', 'mock_sent', 'failed', 'rejected', 'suppressed', 'cancelled'));

alter table public.marketing_outreach_messages
  add column if not exists campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  add column if not exists creative_id uuid references public.marketing_creatives(id) on delete set null,
  add column if not exists placement text,
  add column if not exists approved_version integer,
  add column if not exists body_hash text;

create table if not exists public.marketing_campaign_activities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_outbound_campaigns(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_campaign_activities_timeline_idx
  on public.marketing_campaign_activities(campaign_id, created_at desc);
alter table public.marketing_campaign_activities enable row level security;
revoke all on public.marketing_campaign_activities from anon;
grant select, insert, update, delete on public.marketing_campaign_activities to authenticated;
drop policy if exists marketing_campaign_activities_admin_only on public.marketing_campaign_activities;
create policy marketing_campaign_activities_admin_only
  on public.marketing_campaign_activities for all to authenticated
  using (public.is_admin('admin')) with check (public.is_admin('admin'));
