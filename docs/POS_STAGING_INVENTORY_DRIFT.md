# Staging inventory schema drift â€” blocked

Acceptance disposition: **CLOSED — user accepted the inventory schema/backfill repair.** Do not reopen without a new regression. External Square acceptance continues separately.

Date: 2026-09-21. Target: isolated Supabase `ukrcbmujzdyclrkghbvo` only. Production was not accessed or modified.

## Original investigation (before corrective migration)

The active Inventory selectors in `src/lib/collector-workspace-client-data.ts` require four columns absent from staging: `game_id`, `product_type`, `tcgplayer_product_id`, and `tcgplayer_sku_id`.

The exact forward migration is `supabase/migrations/202608120001_multi_tcg_inventory_identity_proposal.sql`. Its other five columns already exist in staging. It adds two CHECK constraints, six game-context indexes, column comments, a nullable product-type default of `card`, and a historical backfill. It introduces no game foreign key and changes no RLS policies.

Preflight found 10,037 inventory rows: 10,009 meet the migration's Magic-shaped identifier predicate; 28 do not. No conflicting game/provider values or sealed rows appeared in the grouped preflight. The migration intentionally leaves unidentified historical rows nullable; its default applies to subsequent inserts.

Inventory RLS is enabled. Existing policies restrict mutations to `auth.uid() = user_id` and allow workspace-member reads. Existing user, workspace, and bulk-purchase FKs are present. Inventory events and selling candidates already have game context. Collection-intake tables are absent; that separate workflow is not a prerequisite for this column migration and was not installed. Older migration names cannot be compared mechanically because staging includes consolidated prerequisite repair migrations.

## Attempt and stop condition

Applied the original repository SQL through Supabase `apply_migration`, without modification. The backfill was rejected by `public.enforce_collector_inventory_mutation()` with `TD_COLLECTOR_UNAUTHORIZED`: the administrative migration has no acting collector identity. That trigger requires the acting user to match the row owner; its delegated POS exception does not authorize this backfill.

Stopped without disabling triggers, impersonating owners, changing security functions, or manually patching rows. A follow-up forward migration needs explicit review of how administrative identity backfills interact with collector authorization.

Post-attempt read-only verification confirmed all four columns remain absent, no `multi_tcg_inventory_identity_proposal` migration history entry exists, and row count remains 10,037. The failed migration transaction rolled back.

## Acceptance status

- Schema repair: BLOCKED by existing authorization trigger.
- Backfill/default/index/constraint installation: NOT APPLIED.
- Inventory column drift: FAIL; the same four required columns remain absent.
- Hosted Inventory and POS search/barcode regression after repair: PENDING; no successful repair to validate.
- Complete dependent-schema drift certification: PENDING. Collection-intake schema is also absent, outside this Inventory-read repair.
- Production: untouched.


## Corrective forward migration — implemented and validated

Approved repair: `supabase/migrations/20260921154907_inventory_identity_trusted_backfill.sql`.
Applied only to isolated staging via Supabase `apply_migration`; hosted history version is `20260921155304`, name `inventory_identity_trusted_backfill`. This timestamp mapping is explicit; the original failed proposal has no history entry and was not marked applied. Neither the original proposal nor any previously applied file was edited.

The historical backfill ran without an acting collector identity, so the existing ownership check correctly rejected it. The corrective migration adds the original identity schema and uses an atomic DO block to temporarily refine the existing trigger function. It requires the trusted `postgres` session with no SET ROLE, pins the exception to its backend PID and transaction ID, and admits only exact full-row before/after pairs stored in a private temporary table. Only game, provider category, and product type may differ. Row owner, workspace, quantity, prices, timestamps, and all other fields remain identical. Conflicting non-Magic historical identifiers abort the operation.

An ACCESS EXCLUSIVE inventory lock prevents concurrent unrelated inventory writes. No trigger is disabled or dropped. The original function definition is restored within the DO block; failure rolls the block back. CREATE OR REPLACE preserves ownership and grants. The temporary table is explicitly dropped (and also ON COMMIT DROP). No helper function, mode flag, user impersonation, role grant, or persistent authorization exception remains. Run this file through the transactional repository migration runner, never as hand-selected statements. The original historical migration remains unmodified; this corrective file closes its schema gap rather than falsifying old history.

### Verified immediately after migration

- Exactly 10,037 rows before and after; 10,009 Magic/card/category-1 rows and 28 unidentified historical rows preserved.
- All 33 inventory columns from repository CREATE/ALTER migrations are available through the hosted authenticated API, including the four missing columns.
- Product type defaults to `card`; unidentified historical rows remain nullable.
- Six game-context indexes valid; both identity CHECK constraints validated. No game FK is specified by this design; existing user/workspace/bulk-purchase FKs are unchanged.
- RLS enabled, both policies unchanged, authorization function hash unchanged: `ada4ed7cd790a481fa9baec736dc9f8a`.
- Non-backfill field fingerprint unchanged: `d48a84aae056cd97c90ac663d521b476`. This includes ownership/workspace relationships, quantities and timestamps.
- Evidence: `inventory-identity-migration-evidence.json`. Later hosted staff tests intentionally create their own fixture stock through authorized application APIs, so subsequent total row counts can increase independently of the migration.

### Regression and hosted acceptance

- Before hosted mutation: 132 local DB test groups passed for EACH text and enum ledger, including trusted backfill, malicious ownership reassignment rejection, rollback, no remaining helper, exact original trigger restoration, owner writes, cross-tenant denial, delegated stock-only permissions, idempotence, and 25/100/250/500-line carts.
- Hosted Inventory page renders for the actual staging owner; Inventory search and MTG/PKM filtering pass. Screenshot: `.local-fixtures/inventory-staging-fixed.png`.
- Hosted and deployed POS inventory search and exact barcode resolution pass. Browser/API automation uses existing fixtures; no physical scanner was available or claimed tested.
- Hosted staff/delegation matrix: 29 passing boundaries; explicit sell=false retained-delegation regression passes.
- Hosted security: 15 real JWT/anonymous isolation checks pass. Additional direct inventory tests deny cross-tenant, delegated general identity edits, and anonymous writes, with unchanged owner row afterward. No migration RPC exists.
- 10,000-item hosted search performance guard passes for name, set and location.
- Read-only inventory drift audit: 33 expected columns, zero missing (`inventory-staging-drift.json`). This certifies the inventory table, not every unrelated repository feature. Collection-intake schema remains outside this repair.
- Changed test files pass ESLint. No web/mobile runtime code changed; no app rebuild or deployment was needed.

### Advisor scope

Supabase security advisor still reports existing definer-function exposure warnings, default-deny RLS tables without policies, and disabled leaked-password protection. This migration creates no persistent function or table and changes no existing grants or Auth settings. These warnings are not a claim of a clean project-wide security audit. Remediation references: [function exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [default-deny RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Production remains untouched. No production deployment, migration, environment change, or merge was performed.
