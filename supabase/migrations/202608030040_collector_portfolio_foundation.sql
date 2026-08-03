create table if not exists public.collector_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default 'Collector',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  location text,
  preferred_games text[] not null default array['Magic: The Gathering']::text[],
  theme text not null default 'aurora',
  is_public boolean not null default false,
  show_collection_value boolean not null default true,
  show_location boolean not null default false,
  featured_binder_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collector_profiles_username_format
    check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$')
);

create table if not exists public.portfolio_binders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id text not null,
  slug text not null,
  title text not null,
  description text not null default '',
  cover_type text not null default 'gradient',
  cover_url text,
  cover_color text not null default '#172554',
  accent_color text not null default '#67e8f9',
  visibility text not null default 'private'
    check (visibility in ('private','unlisted','public')),
  portfolio_order integer not null default 0,
  is_featured boolean not null default false,
  is_trade_binder boolean not null default false,
  show_values boolean not null default true,
  show_conditions boolean not null default true,
  show_finishes boolean not null default true,
  show_pocket_locations boolean not null default true,
  favorite_page integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, location_id),
  unique (user_id, slug)
);

create table if not exists public.portfolio_featured_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id text not null,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, inventory_item_id)
);

create table if not exists public.binder_card_trade_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id text not null,
  status text not null default 'not_for_trade'
    check (status in ('available','reserved','pending','not_for_trade','looking_for_upgrade','for_sale')),
  trade_value numeric(12,2),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, inventory_item_id)
);

create table if not exists public.portfolio_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_type text not null
    check (share_type in ('page','spread','binder','portfolio','featured','trade')),
  resource_id text,
  token text not null unique,
  visibility text not null default 'unlisted'
    check (visibility in ('public','unlisted','private')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  view_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_story_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'milestone',
  title text not null,
  description text not null default '',
  event_date date not null default current_date,
  image_url text,
  binder_id uuid references public.portfolio_binders(id) on delete set null,
  inventory_item_id text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_owner_id uuid not null references auth.users(id) on delete cascade,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_email text,
  status text not null default 'new'
    check (status in ('new','reviewing','accepted','declined','completed')),
  message text not null default '',
  offered_items jsonb not null default '[]'::jsonb,
  requested_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collector_profiles_username_idx on public.collector_profiles(username);
create index if not exists portfolio_binders_user_order_idx on public.portfolio_binders(user_id, portfolio_order);
create index if not exists portfolio_shares_token_idx on public.portfolio_shares(token);
create index if not exists trade_requests_owner_status_idx on public.trade_requests(portfolio_owner_id, status);

alter table public.collector_profiles enable row level security;
alter table public.portfolio_binders enable row level security;
alter table public.portfolio_featured_cards enable row level security;
alter table public.binder_card_trade_status enable row level security;
alter table public.portfolio_shares enable row level security;
alter table public.portfolio_story_events enable row level security;
alter table public.trade_requests enable row level security;

drop policy if exists collector_profiles_owner_all on public.collector_profiles;
create policy collector_profiles_owner_all on public.collector_profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists portfolio_binders_owner_all on public.portfolio_binders;
create policy portfolio_binders_owner_all on public.portfolio_binders
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists portfolio_featured_cards_owner_all on public.portfolio_featured_cards;
create policy portfolio_featured_cards_owner_all on public.portfolio_featured_cards
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists binder_trade_status_owner_all on public.binder_card_trade_status;
create policy binder_trade_status_owner_all on public.binder_card_trade_status
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists portfolio_shares_owner_all on public.portfolio_shares;
create policy portfolio_shares_owner_all on public.portfolio_shares
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists portfolio_story_owner_all on public.portfolio_story_events;
create policy portfolio_story_owner_all on public.portfolio_story_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists trade_requests_owner_read on public.trade_requests;
create policy trade_requests_owner_read on public.trade_requests
for select using (auth.uid() = portfolio_owner_id or auth.uid() = requester_user_id);

drop policy if exists trade_requests_requester_insert on public.trade_requests;
create policy trade_requests_requester_insert on public.trade_requests
for insert with check (auth.uid() = requester_user_id or requester_user_id is null);

drop policy if exists trade_requests_owner_update on public.trade_requests;
create policy trade_requests_owner_update on public.trade_requests
for update using (auth.uid() = portfolio_owner_id) with check (auth.uid() = portfolio_owner_id);

comment on table public.collector_profiles is 'Public-facing collector identity and privacy settings.';
comment on table public.portfolio_binders is 'Presentation settings layered over inventory binder locations.';
comment on table public.portfolio_shares is 'Sanitized snapshots for page, spread, binder, and portfolio sharing.';
