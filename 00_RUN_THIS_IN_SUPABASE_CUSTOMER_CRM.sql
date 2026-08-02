-- Trading Docks v202: Customer CRM, store credit, and loyalty foundation.
-- Run this entire file once in the Supabase SQL Editor before deploying v202.

create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  first_name text not null check (length(first_name) between 1 and 100),
  last_name text not null check (length(last_name) between 1 and 100),
  email text,
  phone text,
  notes text,
  tags text[] not null default '{}',
  marketing_email_consent boolean not null default false,
  marketing_sms_consent boolean not null default false,
  marketing_consent_updated_at timestamptz,
  store_credit_cents bigint not null default 0 check (store_credit_cents >= 0),
  loyalty_points bigint not null default 0 check (loyalty_points >= 0),
  lifetime_spend_cents bigint not null default 0 check (lifetime_spend_cents >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_customers_workspace_idx on public.crm_customers(workspace_id, updated_at desc);
create index if not exists crm_customers_email_idx on public.crm_customers(workspace_id, lower(email));
alter table public.crm_customers enable row level security;

create table if not exists public.crm_customer_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('credit','points')),
  amount bigint not null check (amount <> 0),
  reason text not null check (length(reason) between 1 and 500),
  order_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists crm_ledger_customer_idx on public.crm_customer_ledger(workspace_id, customer_id, created_at desc);
alter table public.crm_customer_ledger enable row level security;

create table if not exists public.crm_loyalty_programs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  enabled boolean not null default true,
  points_per_dollar numeric(10,2) not null default 1 check (points_per_dollar >= 0),
  reward_points integer not null default 100 check (reward_points > 0),
  reward_value_cents integer not null default 500 check (reward_value_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_loyalty_programs enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['crm_customers','crm_customer_ledger','crm_loyalty_programs'] loop
    execute format('drop policy if exists "CRM members read" on public.%I', table_name);
    execute format('create policy "CRM members read" on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', table_name);
    execute format('drop policy if exists "CRM members create" on public.%I', table_name);
    execute format('create policy "CRM members create" on public.%I for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid())', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

drop policy if exists "CRM members update" on public.crm_customers;
create policy "CRM members update" on public.crm_customers for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "CRM managers delete" on public.crm_customers;
create policy "CRM managers delete" on public.crm_customers for delete to authenticated using (public.can_manage_workspace(workspace_id));
grant select, insert, update, delete on public.crm_customers to authenticated;

-- Ledger rows are append-only. Corrections are represented by a new reversing entry.
drop policy if exists "CRM members update" on public.crm_customer_ledger;
drop policy if exists "CRM managers delete" on public.crm_customer_ledger;
revoke update, delete on public.crm_customer_ledger from authenticated;
grant select, insert on public.crm_customer_ledger to authenticated;

drop policy if exists "CRM members update" on public.crm_loyalty_programs;
create policy "CRM members update" on public.crm_loyalty_programs for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "CRM managers delete" on public.crm_loyalty_programs;
create policy "CRM managers delete" on public.crm_loyalty_programs for delete to authenticated using (public.can_manage_workspace(workspace_id));
grant select, insert, update, delete on public.crm_loyalty_programs to authenticated;

drop trigger if exists crm_customers_set_updated_at on public.crm_customers;
create trigger crm_customers_set_updated_at before update on public.crm_customers for each row execute procedure public.set_updated_at();
drop trigger if exists crm_loyalty_set_updated_at on public.crm_loyalty_programs;
create trigger crm_loyalty_set_updated_at before update on public.crm_loyalty_programs for each row execute procedure public.set_updated_at();

create or replace function public.adjust_crm_customer_balance(p_workspace_id uuid, p_customer_id uuid, p_entry_type text, p_amount bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare current_credit bigint; current_points bigint;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if p_entry_type not in ('credit','points') or p_amount = 0 or length(trim(p_reason)) = 0 then raise exception 'Invalid adjustment'; end if;
  select store_credit_cents, loyalty_points into current_credit, current_points from public.crm_customers where id = p_customer_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Customer not found'; end if;
  if (p_entry_type = 'credit' and current_credit + p_amount < 0) or (p_entry_type = 'points' and current_points + p_amount < 0) then raise exception 'Adjustment cannot create a negative balance'; end if;
  insert into public.crm_customer_ledger(workspace_id, customer_id, created_by, entry_type, amount, reason) values (p_workspace_id, p_customer_id, auth.uid(), p_entry_type, p_amount, trim(p_reason));
  update public.crm_customers set store_credit_cents = case when p_entry_type = 'credit' then store_credit_cents + p_amount else store_credit_cents end, loyalty_points = case when p_entry_type = 'points' then loyalty_points + p_amount else loyalty_points end where id = p_customer_id and workspace_id = p_workspace_id;
end; $$;
revoke all on function public.adjust_crm_customer_balance(uuid,uuid,text,bigint,text) from public;
grant execute on function public.adjust_crm_customer_balance(uuid,uuid,text,bigint,text) to authenticated;
