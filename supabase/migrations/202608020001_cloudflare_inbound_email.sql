-- Secure per-account inbound email addresses and review queue.
create table if not exists public.inbound_email_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  address_token text not null unique check (address_token ~ '^td_[a-f0-9]{18}$'),
  status text not null default 'pending' check (status in ('pending','active','paused','attention')),
  authorized_forwarder text,
  verified_at timestamptz,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inbound_address_id uuid not null references public.inbound_email_addresses(id) on delete cascade,
  fingerprint text not null,
  envelope_from text,
  recipient text not null,
  message_id text,
  subject text not null default '',
  sender text not null default '',
  marketplace_id text,
  event_type text not null default 'unknown' check (event_type in ('order','shipment','cancellation','refund','verification','unknown')),
  processing_status text not null default 'received' check (processing_status in ('received','needs_review','imported','duplicate','unsupported','verification','failed')),
  external_order_id text,
  failure_reason text,
  parsed_snapshot jsonb not null default '{}'::jsonb,
  raw_email text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (user_id, fingerprint)
);

alter table public.inbound_email_addresses enable row level security;
alter table public.inbound_emails enable row level security;

drop policy if exists "Users read own inbound address" on public.inbound_email_addresses;
create policy "Users read own inbound address" on public.inbound_email_addresses for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read own inbound emails" on public.inbound_emails;
create policy "Users read own inbound emails" on public.inbound_emails for select to authenticated using ((select auth.uid()) = user_id);

create index if not exists inbound_emails_user_received_idx on public.inbound_emails (user_id, received_at desc);
create index if not exists inbound_emails_review_idx on public.inbound_emails (user_id, processing_status, received_at desc);
notify pgrst, 'reload schema';
