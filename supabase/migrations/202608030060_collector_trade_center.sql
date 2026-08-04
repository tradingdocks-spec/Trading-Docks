create table if not exists public.collector_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_name text not null,
  set_code text,
  target_condition text,
  target_finish text,
  target_value numeric(12,2),
  priority text not null default 'medium' check (priority in ('low','medium','high','grail')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collector_wishlist_user_priority_idx on public.collector_wishlist(user_id, priority, created_at desc);
alter table public.collector_wishlist enable row level security;
drop policy if exists collector_wishlist_owner_all on public.collector_wishlist;
create policy collector_wishlist_owner_all on public.collector_wishlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.collector_wishlist from anon;
grant select, insert, update, delete on public.collector_wishlist to authenticated;

comment on table public.collector_wishlist is 'Private collector trade targets used to evaluate and compose offers.';
