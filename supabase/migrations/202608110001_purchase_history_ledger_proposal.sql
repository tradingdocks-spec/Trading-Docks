-- Canonical Purchase History acquisition ledger proposal.
-- Forward-only schema proposal; do not apply to production without review.
-- Purchase History is the inbound-acquisition counterpart to the Universal
-- Orders Center. Inventory ownership remains authoritative in inventory_items.

create table if not exists public.purchase_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  source_type text not null check (
    source_type in (
      'bulk_buying',
      'collection_buying',
      'sealed_buying',
      'buylist_intake',
      'vendor_purchase',
      'card_show_buy',
      'trade_in',
      'manual_purchase'
    )
  ),
  seller_name text not null default '',
  seller_customer_id text,
  vendor_id text,
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'received', 'cancelled')
  ),
  payment_method text not null default 'unknown' check (
    payment_method in (
      'cash',
      'card',
      'store_credit',
      'trade_value',
      'bank_transfer',
      'check',
      'other',
      'unknown'
    )
  ),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  adjustment numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  unit_count integer not null default 0 check (unit_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  purchased_at timestamptz not null default now(),
  received_at timestamptz,
  notes text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_ledger(id) on delete cascade,
  line_type text not null default 'line',
  description text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  unit_count integer not null default 0 check (unit_count >= 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  inventory_item_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists purchase_ledger_lines_id_purchase_idx
  on public.purchase_ledger_lines(id, purchase_id);

create table if not exists public.purchase_inventory_links (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_ledger(id) on delete cascade,
  purchase_line_id uuid references public.purchase_ledger_lines(id) on delete cascade,
  inventory_user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  cost_basis numeric(14,2) check (cost_basis is null or cost_basis >= 0),
  created_at timestamptz not null default now(),
  unique (purchase_id, purchase_line_id, inventory_user_id, inventory_item_id),
  foreign key (purchase_line_id, purchase_id)
    references public.purchase_ledger_lines(id, purchase_id)
    on delete cascade,
  foreign key (inventory_user_id, inventory_item_id)
    references public.inventory_items(user_id, id)
    on delete cascade
);

create index if not exists purchase_ledger_workspace_date_idx
  on public.purchase_ledger(workspace_id, purchased_at desc);
create index if not exists purchase_ledger_user_date_idx
  on public.purchase_ledger(user_id, purchased_at desc);
create index if not exists purchase_ledger_workspace_status_idx
  on public.purchase_ledger(workspace_id, status, purchased_at desc);
create index if not exists purchase_ledger_source_idx
  on public.purchase_ledger(workspace_id, source_type, purchased_at desc);
create index if not exists purchase_ledger_customer_idx
  on public.purchase_ledger(workspace_id, seller_customer_id, purchased_at desc)
  where seller_customer_id is not null;
create index if not exists purchase_ledger_vendor_idx
  on public.purchase_ledger(workspace_id, vendor_id, purchased_at desc)
  where vendor_id is not null;
create index if not exists purchase_ledger_payment_idx
  on public.purchase_ledger(workspace_id, payment_method, purchased_at desc);
create index if not exists purchase_ledger_seller_name_idx
  on public.purchase_ledger(workspace_id, lower(seller_name), purchased_at desc)
  where seller_name <> '';
create index if not exists purchase_ledger_lines_purchase_idx
  on public.purchase_ledger_lines(purchase_id);
create index if not exists purchase_inventory_links_purchase_idx
  on public.purchase_inventory_links(purchase_id);
create index if not exists purchase_inventory_links_inventory_idx
  on public.purchase_inventory_links(inventory_user_id, inventory_item_id);

alter table public.purchase_ledger enable row level security;
alter table public.purchase_ledger_lines enable row level security;
alter table public.purchase_inventory_links enable row level security;

drop policy if exists "Workspace members can view purchase ledger" on public.purchase_ledger;
create policy "Workspace members can view purchase ledger"
  on public.purchase_ledger for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = purchase_ledger.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "Workspace managers can write purchase ledger" on public.purchase_ledger;
create policy "Workspace managers can write purchase ledger"
  on public.purchase_ledger for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = purchase_ledger.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    created_by = auth.uid()
    and (
      user_id = auth.uid()
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = purchase_ledger.workspace_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'admin', 'manager')
      )
    )
  );

drop policy if exists "Members can view purchase lines" on public.purchase_ledger_lines;
create policy "Members can view purchase lines"
  on public.purchase_ledger_lines for select to authenticated
  using (
    exists (
      select 1
      from public.purchase_ledger p
      where p.id = purchase_ledger_lines.purchase_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = p.workspace_id
              and wm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Managers can write purchase lines" on public.purchase_ledger_lines;
create policy "Managers can write purchase lines"
  on public.purchase_ledger_lines for all to authenticated
  using (
    exists (
      select 1
      from public.purchase_ledger p
      where p.id = purchase_ledger_lines.purchase_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = p.workspace_id
              and wm.user_id = auth.uid()
              and wm.role in ('owner', 'admin', 'manager')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_ledger p
      where p.id = purchase_ledger_lines.purchase_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = p.workspace_id
              and wm.user_id = auth.uid()
              and wm.role in ('owner', 'admin', 'manager')
          )
        )
    )
  );

drop policy if exists "Members can view purchase inventory links" on public.purchase_inventory_links;
create policy "Members can view purchase inventory links"
  on public.purchase_inventory_links for select to authenticated
  using (
    inventory_user_id = auth.uid()
    or exists (
      select 1
      from public.purchase_ledger p
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = purchase_inventory_links.purchase_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "Managers can write purchase inventory links" on public.purchase_inventory_links;
create policy "Managers can write purchase inventory links"
  on public.purchase_inventory_links for all to authenticated
  using (
    inventory_user_id = auth.uid()
    or exists (
      select 1
      from public.purchase_ledger p
      join public.workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = purchase_inventory_links.purchase_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_ledger p
      join public.inventory_items ii
        on ii.user_id = purchase_inventory_links.inventory_user_id
       and ii.id = purchase_inventory_links.inventory_item_id
      where p.id = purchase_inventory_links.purchase_id
        and (
          ii.workspace_id = p.workspace_id
          or (
            ii.workspace_id is null
            and p.user_id = ii.user_id
            and p.user_id = auth.uid()
          )
        )
    )
    and exists (
      select 1
      from public.inventory_items ii
      where ii.user_id = purchase_inventory_links.inventory_user_id
        and ii.id = purchase_inventory_links.inventory_item_id
    )
    and (
      inventory_user_id = auth.uid()
      or exists (
        select 1
        from public.purchase_ledger p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = purchase_inventory_links.purchase_id
          and wm.user_id = auth.uid()
          and wm.role in ('owner', 'admin', 'manager')
      )
    )
  );

revoke all on public.purchase_ledger from anon;
revoke all on public.purchase_ledger_lines from anon;
revoke all on public.purchase_inventory_links from anon;
grant select, insert, update, delete on public.purchase_ledger to authenticated;
grant select, insert, update, delete on public.purchase_ledger_lines to authenticated;
grant select, insert, update, delete on public.purchase_inventory_links to authenticated;

comment on table public.purchase_ledger is
  'Canonical inbound acquisition ledger across bulk buying, collection buying, sealed buying, vendors, buylists, trade-ins, card shows, and manual purchases.';
comment on table public.purchase_ledger_lines is
  'Source-specific acquisition line details. Does not own inventory; inventory_items remains authoritative.';
comment on table public.purchase_inventory_links is
  'Optional linkage between acquisition cost basis and resulting canonical inventory rows.';
