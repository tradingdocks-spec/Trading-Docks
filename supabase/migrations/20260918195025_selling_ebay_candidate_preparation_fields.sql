-- Persist seller-entered eBay preparation data on each candidate.
-- These are mappings and payload inputs, never credentials or access tokens.
alter table public.selling_listing_candidates
  add column if not exists title_override text,
  add column if not exists seller_account_id text,
  add column if not exists merchant_location_key text,
  add column if not exists fulfillment_policy_id text,
  add column if not exists payment_policy_id text,
  add column if not exists return_policy_id text,
  add column if not exists category_id text,
  add column if not exists item_specifics jsonb not null default '{}'::jsonb;

create index if not exists selling_candidates_category_idx
  on public.selling_listing_candidates(user_id, category_id);

notify pgrst, 'reload schema';
