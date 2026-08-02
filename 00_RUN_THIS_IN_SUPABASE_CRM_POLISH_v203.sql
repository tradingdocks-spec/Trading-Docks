-- Trading Docks v203: additive Customer CRM profile polish.
-- Run once in the Supabase SQL Editor after the v202 CRM foundation script.

alter table public.crm_customers
  add column if not exists customer_type text not null default 'individual',
  add column if not exists customer_source text not null default 'walk_in';

alter table public.crm_customers
  drop constraint if exists crm_customers_customer_type_check,
  add constraint crm_customers_customer_type_check
    check (customer_type in ('individual', 'business'));

alter table public.crm_customers
  drop constraint if exists crm_customers_customer_source_check,
  add constraint crm_customers_customer_source_check
    check (customer_source in ('walk_in', 'website', 'card_show', 'marketplace', 'referral', 'other'));

-- Fast workspace-level duplicate checks. Partial indexes avoid blank contacts.
create index if not exists crm_customers_workspace_email_normalized_idx
  on public.crm_customers (workspace_id, lower(trim(email)))
  where email is not null and trim(email) <> '';

create index if not exists crm_customers_workspace_phone_normalized_idx
  on public.crm_customers (workspace_id, regexp_replace(phone, '[^0-9]', '', 'g'))
  where phone is not null and trim(phone) <> '';

comment on column public.crm_customers.customer_type is 'Individual or business customer classification.';
comment on column public.crm_customers.customer_source is 'Acquisition source recorded by the workspace.';
