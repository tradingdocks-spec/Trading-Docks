-- Stripe Billing subscription state. Apply after the authentication foundation.

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'collector', 'seller', 'business')),
  billing_cycle text
    check (billing_cycle is null or billing_cycle in ('monthly', 'annual')),
  status text not null default 'incomplete',
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_status_idx
on public.billing_subscriptions (status, current_period_end);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "Users read own billing subscription"
on public.billing_subscriptions;
create policy "Users read own billing subscription"
on public.billing_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.billing_subscriptions
from authenticated, anon;
grant select on public.billing_subscriptions to authenticated;
