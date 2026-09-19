-- Reply ingestion and sales inbox. Additive only; do not apply remotely from this task.

alter table public.marketing_prospects drop constraint if exists marketing_prospects_status_check;
alter table public.marketing_prospects
  add constraint marketing_prospects_status_check check (status in ('new','researched','ready_to_contact','emailed','opened','clicked','replied','engaged','interested','demo_requested','demo_scheduled','trial','trial_started','customer','not_interested','do_not_contact'));

create table if not exists public.marketing_conversations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.marketing_prospects(id) on delete set null,
  contact_id uuid references public.marketing_prospect_contacts(id) on delete set null,
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  feature_id uuid references public.marketing_feature_library(id) on delete set null,
  acquisition_campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  acquisition_feature_id uuid references public.marketing_feature_library(id) on delete set null,
  acquisition_creative_id uuid references public.marketing_creatives(id) on delete set null,
  acquisition_message_id uuid references public.marketing_outreach_messages(id) on delete set null,
  status text not null default 'open' check (status in ('open','needs_review','snoozed','closed','unmatched_inbound')),
  subject text not null default '',
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketing_conversations(id) on delete cascade,
  prospect_id uuid references public.marketing_prospects(id) on delete set null,
  contact_id uuid references public.marketing_prospect_contacts(id) on delete set null,
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  direction text not null check (direction in ('outbound','inbound')),
  provider text not null default 'internal',
  provider_message_id text,
  provider_thread_id text,
  in_reply_to_provider_message_id text,
  subject text not null default '',
  body_text text not null default '',
  body_html text,
  sanitized_body_html text,
  sender_email text not null default '',
  sender_name text,
  recipient_emails jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  received_at timestamptz,
  classification text check (classification in ('interested','question','demo_request','trial_request','not_interested','unsubscribe','out_of_office','wrong_contact','pricing_question','integration_question','support_question','other')),
  classification_confidence text check (classification_confidence in ('high','medium','low')),
  classification_source text check (classification_source in ('deterministic','ai','manual')),
  is_read boolean not null default false,
  headers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create table if not exists public.marketing_tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.marketing_prospects(id) on delete cascade,
  conversation_id uuid references public.marketing_conversations(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_interest_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.marketing_prospects(id) on delete cascade,
  conversation_id uuid references public.marketing_conversations(id) on delete cascade,
  campaign_id uuid references public.marketing_outbound_campaigns(id) on delete set null,
  feature_id uuid references public.marketing_feature_library(id) on delete set null,
  message_id uuid references public.marketing_conversation_messages(id) on delete set null,
  event_type text not null check (event_type in ('email_reply','positive_reply','demo_request','trial_request','pricing_question','integration_question','support_question','unsubscribe','not_interested')),
  source text not null default 'inbound_email',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (message_id, event_type)
);

alter table public.marketing_outreach_messages
  add column if not exists conversation_id uuid references public.marketing_conversations(id) on delete set null,
  add column if not exists provider_thread_id text,
  add column if not exists in_reply_to_provider_message_id text;

create index if not exists marketing_conversations_inbox_idx on public.marketing_conversations(status, last_message_at desc);
create index if not exists marketing_conversations_prospect_idx on public.marketing_conversations(prospect_id, updated_at desc);
create index if not exists marketing_conversation_messages_thread_idx on public.marketing_conversation_messages(conversation_id, created_at);
create index if not exists marketing_conversation_messages_provider_idx on public.marketing_conversation_messages(provider, provider_message_id);
create index if not exists marketing_tasks_queue_idx on public.marketing_tasks(status, due_at, updated_at desc);
create index if not exists marketing_interest_events_campaign_idx on public.marketing_interest_events(campaign_id, created_at desc);

create or replace function public.marketing_sales_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists marketing_conversations_updated_at on public.marketing_conversations;
create trigger marketing_conversations_updated_at before update on public.marketing_conversations for each row execute function public.marketing_sales_touch_updated_at();
drop trigger if exists marketing_tasks_updated_at on public.marketing_tasks;
create trigger marketing_tasks_updated_at before update on public.marketing_tasks for each row execute function public.marketing_sales_touch_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['marketing_conversations','marketing_conversation_messages','marketing_tasks','marketing_interest_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_only', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin(''admin'')) with check (public.is_admin(''admin''))', table_name || '_admin_only', table_name);
  end loop;
end $$;
