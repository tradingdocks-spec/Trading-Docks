-- Trading Docks public sharing security boundary.
-- Anonymous visitors never receive direct table access. Public pages use
-- controlled server routes with the service role and return sanitized payloads.

alter table if exists public.binder_shares
  add column if not exists is_active boolean not null default true,
  add column if not exists revoked_at timestamptz,
  add column if not exists view_count bigint not null default 0,
  add column if not exists allow_interested_lists boolean not null default false,
  add column if not exists require_account_for_actions boolean not null default true,
  add column if not exists noindex boolean not null default true;

alter table if exists public.portfolio_shares
  add column if not exists is_active boolean not null default true,
  add column if not exists revoked_at timestamptz,
  add column if not exists allow_interested_lists boolean not null default false,
  add column if not exists require_account_for_actions boolean not null default true,
  add column if not exists noindex boolean not null default true;

create index if not exists binder_shares_active_token_idx
  on public.binder_shares(token)
  where is_active = true and revoked_at is null;

create index if not exists portfolio_shares_active_token_idx
  on public.portfolio_shares(token)
  where is_active = true and revoked_at is null;

alter table public.binder_shares enable row level security;
alter table public.portfolio_shares enable row level security;

-- Owners can manage only their own share records through an authenticated client.
drop policy if exists binder_shares_owner_select on public.binder_shares;
create policy binder_shares_owner_select on public.binder_shares
for select to authenticated
using (auth.uid() = owner_id);

drop policy if exists binder_shares_owner_insert on public.binder_shares;
create policy binder_shares_owner_insert on public.binder_shares
for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists binder_shares_owner_update on public.binder_shares;
create policy binder_shares_owner_update on public.binder_shares
for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists binder_shares_owner_delete on public.binder_shares;
create policy binder_shares_owner_delete on public.binder_shares
for delete to authenticated
using (auth.uid() = owner_id);

drop policy if exists portfolio_shares_owner_select on public.portfolio_shares;
create policy portfolio_shares_owner_select on public.portfolio_shares
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists portfolio_shares_owner_insert on public.portfolio_shares;
create policy portfolio_shares_owner_insert on public.portfolio_shares
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists portfolio_shares_owner_update on public.portfolio_shares;
create policy portfolio_shares_owner_update on public.portfolio_shares
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists portfolio_shares_owner_delete on public.portfolio_shares;
create policy portfolio_shares_owner_delete on public.portfolio_shares
for delete to authenticated
using (auth.uid() = user_id);

-- Explicitly remove any accidental anonymous grants. Public rendering happens
-- through server-only routes after token, status, and expiration validation.
revoke all on public.binder_shares from anon;
revoke all on public.portfolio_shares from anon;
revoke all on public.inventory_items from anon;
revoke all on public.inventory_locations from anon;
revoke all on public.collector_profiles from anon;
revoke all on public.portfolio_binders from anon;
revoke all on public.binder_card_trade_status from anon;
revoke all on public.trade_requests from anon;

create table if not exists public.public_share_security_events (
  id uuid primary key default gen_random_uuid(),
  share_kind text not null check (share_kind in ('binder', 'portfolio')),
  share_id uuid,
  event_type text not null check (
    event_type in (
      'view',
      'signup_click',
      'signin_click',
      'interested_list_click',
      'report_click',
      'revoked_access'
    )
  ),
  request_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.public_share_security_events enable row level security;
revoke all on public.public_share_security_events from anon;
revoke all on public.public_share_security_events from authenticated;

comment on table public.public_share_security_events is
  'Server-written audit events for public share access and conversion actions.';
