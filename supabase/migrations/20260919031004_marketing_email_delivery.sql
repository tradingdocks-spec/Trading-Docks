-- Provider-neutral marketing email delivery metadata with a disabled-by-default Resend adapter.
-- Additive only. This migration is intentionally not applied remotely by this task.

alter table public.marketing_settings
  add column if not exists sending_domain text,
  add column if not exists spf_status text not null default 'unknown' check (spf_status in ('unknown', 'pending', 'verified', 'failed')),
  add column if not exists dkim_status text not null default 'unknown' check (dkim_status in ('unknown', 'pending', 'verified', 'failed')),
  add column if not exists dmarc_status text not null default 'unknown' check (dmarc_status in ('unknown', 'pending', 'verified', 'failed')),
  add column if not exists tracking_domain text,
  add column if not exists webhook_last_valid_at timestamptz,
  add column if not exists webhook_last_invalid_at timestamptz;

alter table public.marketing_outreach_messages
  add column if not exists prospect_id uuid references public.marketing_prospects(id) on delete set null,
  add column if not exists contact_id uuid references public.marketing_prospect_contacts(id) on delete set null,
  add column if not exists subject text,
  add column if not exists preview_text text,
  add column if not exists body_html text,
  add column if not exists body_text text,
  add column if not exists cta_url text,
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists reply_to text,
  add column if not exists requested_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.marketing_outreach_messages drop constraint if exists marketing_outreach_messages_status_check;
alter table public.marketing_outreach_messages
  add constraint marketing_outreach_messages_status_check check (status in ('approved', 'queued', 'submitted', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed', 'delivery_unknown', 'suppressed'));

alter table public.marketing_email_events drop constraint if exists marketing_email_events_event_type_check;
alter table public.marketing_email_events
  add constraint marketing_email_events_event_type_check check (event_type in ('submitted', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'replied', 'unsubscribed', 'failed'));

create table if not exists public.marketing_email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  message_id uuid references public.marketing_outreach_messages(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index if not exists marketing_email_webhook_events_message_idx
  on public.marketing_email_webhook_events(message_id, received_at desc);
alter table public.marketing_email_webhook_events enable row level security;
revoke all on public.marketing_email_webhook_events from anon;
grant select, insert, update, delete on public.marketing_email_webhook_events to authenticated;
drop policy if exists marketing_email_webhook_events_admin_only on public.marketing_email_webhook_events;
create policy marketing_email_webhook_events_admin_only
  on public.marketing_email_webhook_events for all to authenticated
  using (public.is_admin('admin')) with check (public.is_admin('admin'));

create index if not exists marketing_outreach_messages_provider_idx
  on public.marketing_outreach_messages(provider, provider_message_id);
create index if not exists marketing_outreach_messages_prospect_idx
  on public.marketing_outreach_messages(prospect_id, created_at desc);
