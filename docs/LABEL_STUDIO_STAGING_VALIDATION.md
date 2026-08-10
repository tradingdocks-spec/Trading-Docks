# Label Studio Staging Validation Plan

Status: Staging-only procedure. Do not run against production.

Latest staging failure addressed:

`generate_trading_docks_sku()` previously called unqualified `gen_random_bytes(8)` from inside a function with a restricted `search_path`. Hosted Supabase commonly exposes pgcrypto functions through `extensions`, so unqualified resolution failed. The proposal now installs pgcrypto into `extensions` when missing and resolves the actual `gen_random_bytes(integer)` schema through `label_pgcrypto_schema()` / `label_crypto_random_bytes(integer)`.

Migration under review:

`supabase/migrations/202608090001_label_studio_inventory_qr_proposal.sql`

Verification script:

`supabase/verification/verify_label_studio_inventory_qr.sql`

Staging QA seed:

`supabase/verification/seed_label_studio_inventory_qr_staging.sql`

## Required Safety Rules

- Do not use production credentials.
- Do not run this against the production Supabase project.
- Do not rerun a failed migration before running the pre-rerun inspection below.
- Do not deploy application code as part of this validation.
- Do not merge this branch until staging results are reviewed.
- Capture row counts and audit rows before and after validation.

## Crypto Extension Preflight

Run this first in the staging SQL Editor. It does not mutate application data.

```sql
select
  e.extname as extension_name,
  n.nspname as extension_schema,
  e.extversion as extension_version
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pgcrypto';

select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('gen_random_bytes', 'gen_random_uuid', 'digest', 'encode')
order by p.proname, n.nspname;

do $$
declare
  crypto_schema text;
  bytes bytea;
begin
  select n.nspname
  into crypto_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'gen_random_bytes'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'integer'
    and n.nspname in ('extensions', 'public', 'pg_catalog')
  order by case n.nspname
    when 'extensions' then 1
    when 'public' then 2
    when 'pg_catalog' then 3
    else 4
  end
  limit 1;

  raise notice 'pgcrypto gen_random_bytes schema: %', coalesce(crypto_schema, 'not found');

  if crypto_schema is not null then
    execute format('select %I.gen_random_bytes($1)', crypto_schema)
      using 8
      into bytes;
    raise notice 'qualified gen_random_bytes byte length: %', length(bytes);
  end if;
end $$;
```

Expected staging result: `pgcrypto` is installed, normally in the `extensions` schema on hosted Supabase, and the qualified byte-length notice reports `8`.

## Pre-Rerun Partial-State Inspection

Run this after any failed attempt and before rerunning the proposal. SQL Editor statements are transactional, but do not assume staging is clean.

```sql
select
  'inventory_items.workspace_id' as object_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'workspace_id'
  ) as exists
union all
select 'inventory_items.item_kind', exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'inventory_items'
    and column_name = 'item_kind'
)
union all
select 'inventory_label_identities', to_regclass('public.inventory_label_identities') is not null
union all
select 'label_templates', to_regclass('public.label_templates') is not null
union all
select 'label_print_jobs', to_regclass('public.label_print_jobs') is not null
union all
select 'inventory_price_reviews', to_regclass('public.inventory_price_reviews') is not null
union all
select 'label_migration_audit', to_regclass('public.label_migration_audit') is not null
union all
select 'generate_trading_docks_sku()', to_regprocedure('public.generate_trading_docks_sku()') is not null
union all
select 'generate_inventory_qr_token()', to_regprocedure('public.generate_inventory_qr_token()') is not null
union all
select 'fill_inventory_label_identity()', to_regprocedure('public.fill_inventory_label_identity()') is not null
union all
select 'label_crypto_random_bytes(integer)', to_regprocedure('public.label_crypto_random_bytes(integer)') is not null;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname like any (array[
    'inventory_items_workspace%',
    'inventory_label_identities%',
    'label_templates%',
    'label_print_jobs%',
    'inventory_price_reviews%',
    'label_migration_audit%'
  ])
order by indexname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (
    tablename in (
      'inventory_items',
      'inventory_label_identities',
      'label_templates',
      'label_print_jobs',
      'inventory_price_reviews',
      'label_migration_audit'
    )
  )
order by tablename, policyname;
```

If partial objects exist, save the result and review before rerunning. The proposal uses `if not exists`/`or replace`/policy drops for its own objects, but do not drop unrelated Trading Docks tables or policies.

If all rows report `false` for the new Label Studio objects and columns, the failed SQL Editor submission most likely rolled back completely. If any rows report `true`, treat staging as partially migrated and rerun only after reviewing the object list. The proposal is designed to resume its own objects, but manual cleanup should be limited to the Label Studio objects named here.

## Supabase CLI Procedure

Use this only when the Supabase CLI is installed and configured for the staging project.

1. Confirm the linked project is staging:

```powershell
supabase projects list
supabase status
```

2. Confirm the current database is not production:

```powershell
supabase db remote list
```

3. Create a staging checkpoint or backup in the Supabase dashboard.

4. Run preflight counts in SQL Editor or `psql`:

```sql
select count(*) as inventory_items from public.inventory_items;
select count(*) as workspaces from public.workspaces;
select count(*) as workspace_members from public.workspace_members;
select count(*) as non_empty_skus from public.inventory_items where trim(coalesce(sku, '')) <> '';
select user_id, count(distinct workspace_id) as workspace_count
from public.workspace_members
group by user_id
having count(distinct workspace_id) > 1
order by workspace_count desc;
```

5. Apply the proposal to staging only:

```powershell
supabase db execute --file supabase/migrations/202608090001_label_studio_inventory_qr_proposal.sql
```

If `db execute` is unavailable in the installed CLI version, use the SQL Editor procedure below.

6. Run the rollback-only verification:

```powershell
supabase db execute --file supabase/verification/verify_label_studio_inventory_qr.sql
```

7. Run the rollback-only QA seed:

```powershell
supabase db execute --file supabase/verification/seed_label_studio_inventory_qr_staging.sql
```

8. Inspect the audit output:

```sql
select issue_type, count(*)
from public.label_migration_audit
group by issue_type
order by issue_type;
```

## SQL Editor Procedure

Use this when the Supabase CLI is unavailable.

1. Open the staging Supabase project.
2. Confirm the browser URL, project ref, and project name are staging.
3. Create a dashboard backup/checkpoint.
4. Open SQL Editor.
5. Paste and run the full contents of:

`supabase/migrations/202608090001_label_studio_inventory_qr_proposal.sql`

6. Paste and run the full contents of:

`supabase/verification/verify_label_studio_inventory_qr.sql`

The verification script starts with `begin;` and ends with `rollback;`.

7. Paste and run the full contents of:

`supabase/verification/seed_label_studio_inventory_qr_staging.sql`

The QA seed also starts with `begin;` and ends with `rollback;`.

8. Save query results for review.

## Staging QA Coverage

The seed script covers:

- single-workspace user
- multi-workspace ambiguous user
- owner, admin, manager, member, and viewer roles
- legacy valid SKU
- conflicting SKU
- blank SKU
- card item
- sealed item
- public QR enabled
- public QR disabled
- revoked and invalid QR
- template custom dimensions
- repricing review
- cross-workspace denial

## Smoke-Test Checklist

Run these against staging after the proposal is applied.

- Label Studio: route loads for a Seller/Store workspace user with `label.view`.
- Label Studio: Operations navigation exposes `Operations` -> `Label Studio`; Selling navigation does not own the Label Studio entry.
- Label Studio: `/dashboard/label-studio` is the only canonical Label Studio route.
- Label Studio: Inventory, Card Shows, Sealed Inventory, and future POS entry points open contextual flows into `/dashboard/label-studio` instead of separate builders.
- Label Studio: manager can create or preview a template once persistence is wired.
- Label Studio: member can view templates but cannot manage template definitions.
- Bulk print preview: 250-label render job records summary counts without storing full repeated label payloads.
- SKU lookup: valid legacy `TD-XXXX-XXXX` SKU is preserved.
- SKU lookup: blank SKU receives generated `TD-XXXX-XXXX`.
- SKU lookup: conflicting legacy SKU is audited and not preserved for both rows.
- QR resolution: enabled token returns one sanitized row.
- QR resolution: disabled token returns zero rows.
- QR resolution: revoked token returns zero rows.
- Public QR view: no `user_id`, workspace id, inventory id, cost basis, purchase price, supplier, private location, notes, or customer data appears.
- Sealed labels: sealed item uses `product_name` and nullable card fields safely.
- Card-show labels: card-show template accepts dimensions and pricing rule.
- Repricing preview: proposed/current prices are recorded without updating `inventory_items.asking_price`.
- Cross-workspace denial: unrelated workspace member cannot read label identities, templates, price reviews, print jobs, or workspace inventory.

## Behaviors Requiring A Real Staging Supabase Project

- RLS behavior with actual `authenticated` JWT claims.
- `auth.users` fixture compatibility in the hosted auth schema.
- Lock timing for `alter table public.inventory_items`.
- Index build timing against realistic inventory volume.
- PostgREST schema reload behavior after `notify pgrst, 'reload schema'`.
- Dashboard SQL Editor permission behavior for `security definer` functions.
- Existing production-like data backfill counts in `label_migration_audit`.
- Browser app smoke tests against the staging API.

## Rollback Criteria

Stop and restore staging from checkpoint if any of these happen:

- migration blocks active inventory reads/writes longer than the agreed staging window;
- verification finds cross-workspace access;
- public QR returns private fields;
- valid unique legacy SKUs are overwritten;
- conflicting SKUs are not audited;
- existing mobile/web inventory reads fail;
- sealed rows break existing card inventory queries.
