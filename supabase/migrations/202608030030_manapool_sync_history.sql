-- Mana Pool sync audit history.
create table if not exists public.marketplace_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace_id text not null,
  status text not null check (status in ('running','success','partial','failed')),
  imported_orders integer not null default 0,
  imported_items integer not null default 0,
  failed_records integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

alter table public.marketplace_sync_runs enable row level security;

drop policy if exists "Users manage own marketplace sync runs"
on public.marketplace_sync_runs;

create policy "Users manage own marketplace sync runs"
on public.marketplace_sync_runs for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists marketplace_sync_runs_user_marketplace_idx
on public.marketplace_sync_runs (user_id, marketplace_id, started_at desc);

notify pgrst, 'reload schema';
