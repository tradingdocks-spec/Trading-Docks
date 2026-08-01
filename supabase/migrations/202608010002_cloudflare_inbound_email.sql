-- Secure inbound marketplace email foundation.
-- Run after 202608010001_universal_orders_center.sql.

create table if not exists public.inbound_email_mailboxes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  address_token text not null unique check (address_token ~ '^td_[a-z0-9]{16,40}$'),
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  verified_at timestamptz,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table if not exists public.inbound_email_messages (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references public.inbound_email_mailboxes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient text not null,
  sender text,
  message_id text,
  subject text,
  marketplace_id text,
  message_type text not null default 'unknown'
    check (message_type in ('order','shipment','cancellation','refund','verification','unknown')),
  processing_status text not null default 'received'
    check (processing_status in ('received','needs_review','processed','duplicate','unsupported','failed')),
  content_sha256 text not null,
  raw_message text not null,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (mailbox_id, content_sha256)
);

alter table public.inbound_email_mailboxes enable row level security;
alter table public.inbound_email_messages enable row level security;

drop policy if exists "Members can view inbound mailbox" on public.inbound_email_mailboxes;
create policy "Members can view inbound mailbox"
on public.inbound_email_mailboxes for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can update inbound mailbox" on public.inbound_email_mailboxes;
create policy "Admins can update inbound mailbox"
on public.inbound_email_mailboxes for update to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Members can view inbound messages" on public.inbound_email_messages;
create policy "Members can view inbound messages"
on public.inbound_email_messages for select to authenticated
using (public.is_workspace_member(workspace_id));

create index if not exists inbound_email_messages_workspace_received_idx
  on public.inbound_email_messages (workspace_id, received_at desc);
create index if not exists inbound_email_messages_review_idx
  on public.inbound_email_messages (workspace_id, processing_status, received_at desc);

notify pgrst, 'reload schema';
