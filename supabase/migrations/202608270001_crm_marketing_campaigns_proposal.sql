-- Trading Docks CRM Marketing Campaigns proposal.
-- Forward-only, additive schema for consent-safe workspace marketing.
-- Do not apply to production until reviewed and scheduled.

create extension if not exists pgcrypto;

alter table public.crm_customers
  add column if not exists marketing_status text not null default 'unknown'
    check (marketing_status in ('subscribed', 'unsubscribed', 'suppressed', 'unknown')),
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_opt_out_at timestamptz,
  add column if not exists marketing_source text,
  add column if not exists suppression_reason text
    check (suppression_reason is null or suppression_reason in ('hard_bounce', 'spam_complaint', 'manual', 'provider_suppression', 'unknown')),
  add column if not exists marketing_consent_note text;

update public.crm_customers
set marketing_status = case
  when marketing_email_consent is true then 'subscribed'
  when marketing_status is null then 'unknown'
  else marketing_status
end
where marketing_status is null or (marketing_status = 'unknown' and marketing_email_consent is true);

create table if not exists public.marketing_email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null default 'general',
  subject text not null,
  preview_text text,
  body_text text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  subject text not null,
  preview_text text,
  sender_name text not null,
  reply_to text not null,
  audience_rule jsonb not null default '{"mode":"all_subscribed"}'::jsonb,
  body_text text not null,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'scheduled', 'sending', 'sent', 'partial_failure', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  idempotency_key text,
  eligible_count integer not null default 0 check (eligible_count >= 0),
  excluded_count integer not null default 0 check (excluded_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  unsubscribed_count integer not null default 0 check (unsubscribed_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  customer_id uuid references public.crm_customers(id) on delete set null,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'unsubscribed')),
  exclusion_reason text
    check (exclusion_reason is null or exclusion_reason in ('missing_email', 'unknown_consent', 'unsubscribed', 'suppressed', 'outside_audience')),
  provider_message_id text,
  unsubscribe_token_hash text not null,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, customer_id),
  unique (unsubscribe_token_hash)
);

create table if not exists public.marketing_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.crm_customers(id) on delete set null,
  email_hash text not null,
  reason text not null check (reason in ('hard_bounce', 'spam_complaint', 'manual', 'provider_suppression', 'unknown')),
  source text not null default 'manual',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email_hash)
);

create table if not exists public.marketing_send_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'partial_failure', 'failed', 'cancelled')),
  idempotency_key text not null,
  current_offset integer not null default 0 check (current_offset >= 0),
  batch_size integer not null default 250 check (batch_size between 1 and 1000),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists crm_customers_marketing_workspace_status_idx
  on public.crm_customers (workspace_id, marketing_status);
create index if not exists crm_customers_marketing_tags_idx
  on public.crm_customers using gin (tags);
create index if not exists marketing_campaigns_workspace_status_idx
  on public.marketing_campaigns (workspace_id, status, created_at desc);
create index if not exists marketing_campaign_recipients_campaign_status_idx
  on public.marketing_campaign_recipients (campaign_id, status);
create index if not exists marketing_campaign_recipients_workspace_customer_idx
  on public.marketing_campaign_recipients (workspace_id, customer_id);
create index if not exists marketing_suppressions_workspace_reason_idx
  on public.marketing_suppressions (workspace_id, reason);
create index if not exists marketing_send_jobs_workspace_status_idx
  on public.marketing_send_jobs (workspace_id, status, created_at desc);

alter table public.marketing_email_templates enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;
alter table public.marketing_suppressions enable row level security;
alter table public.marketing_send_jobs enable row level security;

drop policy if exists "Workspace members can view marketing templates" on public.marketing_email_templates;
create policy "Workspace members can view marketing templates"
on public.marketing_email_templates for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage marketing templates" on public.marketing_email_templates;
create policy "Workspace members can manage marketing templates"
on public.marketing_email_templates for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can view marketing campaigns" on public.marketing_campaigns;
create policy "Workspace members can view marketing campaigns"
on public.marketing_campaigns for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage marketing campaigns" on public.marketing_campaigns;
create policy "Workspace members can manage marketing campaigns"
on public.marketing_campaigns for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can view marketing recipients" on public.marketing_campaign_recipients;
create policy "Workspace members can view marketing recipients"
on public.marketing_campaign_recipients for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage marketing recipients" on public.marketing_campaign_recipients;
create policy "Workspace members can manage marketing recipients"
on public.marketing_campaign_recipients for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can view marketing suppressions" on public.marketing_suppressions;
create policy "Workspace members can view marketing suppressions"
on public.marketing_suppressions for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage marketing suppressions" on public.marketing_suppressions;
create policy "Workspace members can manage marketing suppressions"
on public.marketing_suppressions for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can view marketing jobs" on public.marketing_send_jobs;
create policy "Workspace members can view marketing jobs"
on public.marketing_send_jobs for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can manage marketing jobs" on public.marketing_send_jobs;
create policy "Workspace members can manage marketing jobs"
on public.marketing_send_jobs for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- Rollback/remediation if app deployment is delayed:
-- Leave additive objects in place. Disable new UI/API routes in the app if necessary.
-- No existing CRM rows are deleted or converted to subscribed unless explicit consent was already true.
