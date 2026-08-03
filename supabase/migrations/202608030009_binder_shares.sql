create table if not exists public.binder_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null default 'showcase' check (mode in ('showcase', 'trade')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists binder_shares_owner_id_idx on public.binder_shares(owner_id);
create index if not exists binder_shares_token_idx on public.binder_shares(token);
alter table public.binder_shares enable row level security;
comment on table public.binder_shares is 'Read-only public binder snapshots created by Binder Showcase Studio.';
