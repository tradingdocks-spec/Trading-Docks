-- Trading Docks v185 — marketplace reconciliation, payouts, and review queue.
alter table public.marketplace_orders
  add column if not exists payout_status text not null default 'unreconciled',
  add column if not exists payout_batch_id text,
  add column if not exists payout_amount numeric(12,2),
  add column if not exists payout_received_at timestamptz,
  add column if not exists reconciliation_note text;

do $$ begin
  alter table public.marketplace_orders add constraint marketplace_orders_payout_status_check
    check (payout_status in ('unreconciled','matched','difference','missing','not_applicable'));
exception when duplicate_object then null; end $$;

create table if not exists public.marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  external_payout_id text not null,
  payout_date timestamptz,
  gross_amount numeric(12,2) not null default 0,
  fee_amount numeric(12,2) not null default 0,
  adjustment_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open','matched','difference')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, marketplace_id, external_payout_id)
);

alter table public.marketplace_payouts enable row level security;
drop policy if exists "Users manage own marketplace payouts" on public.marketplace_payouts;
create policy "Users manage own marketplace payouts" on public.marketplace_payouts
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists marketplace_orders_reconciliation_idx
  on public.marketplace_orders (user_id, payout_status, ordered_at desc);
create index if not exists marketplace_payouts_user_date_idx
  on public.marketplace_payouts (user_id, marketplace_id, payout_date desc);

notify pgrst, 'reload schema';
