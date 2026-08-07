-- RevenueCat provider-state reconciliation for mobile StoreKit subscriptions.
-- This migration is forward-only and preserves existing Stripe subscription rows.

alter table public.billing_subscriptions
  alter column stripe_customer_id drop not null;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_plan_id_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_plan_id_check
  check (plan_id in ('free', 'collector', 'seller', 'store', 'business'));

create table if not exists public.billing_provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'stripe', 'manual')),
  provider_customer_id text not null,
  provider_subscription_id text not null,
  provider_transaction_id text,
  product_id text not null,
  plan_id text not null check (plan_id in ('collector', 'seller', 'store', 'business')),
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'annual')),
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  environment text,
  raw_event_type text,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists billing_provider_subscriptions_user_idx
on public.billing_provider_subscriptions (user_id, provider, status, current_period_end);

alter table public.billing_provider_subscriptions enable row level security;

drop policy if exists "Users read own provider subscriptions"
on public.billing_provider_subscriptions;
create policy "Users read own provider subscriptions"
on public.billing_provider_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.billing_provider_subscriptions
from authenticated, anon;
grant select on public.billing_provider_subscriptions to authenticated;

create table if not exists public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index if not exists billing_provider_events_user_idx
on public.billing_provider_events (user_id, received_at desc);

alter table public.billing_provider_events enable row level security;

revoke all on public.billing_provider_events from authenticated, anon;
