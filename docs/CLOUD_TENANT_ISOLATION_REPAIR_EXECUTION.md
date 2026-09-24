# Production cloud tenant isolation repair execution

Schema application: **PASS**, 2026-09-24 **03:11:42.496–03:11:45.881 UTC**.
Application promotion/post-deployment verification: pending below.

## Recovery and preflight

Production identity: Trading Docks, Supabase `bohddnajlnmknngzjsjk`, us-west-2.
The 20-entry migration history, function/policy definitions, RLS, inventory,
events, positions, batches, sessions, memberships and grants matched the reviewed
baseline immediately before mutation. No baseline adjustment was made.

Fresh Supabase-aware backup is retained outside Git in the access-restricted
owner recovery folder `C:\Users\Jerem\TradingDocksRecovery\trading-docks-pre-tenant-repair-20260924`.
All seven SHA-256 manifest entries verified. Previous backup checksums verified
and previous artifacts preserved. Restore to disconnected Supabase PostgreSQL
17.6.1.167 succeeded in `pre_tenant_repair_final_20260924`, with matching business
data, functions, policies, RLS, triggers, indexes, Auth relationships and effective
application grants. Two CHECK definitions only flatten redundant parentheses;
implicit/explicit database-owner ACL text differs, effective application access does not.
Owner reads, unrelated-owner isolation and anonymous denial passed.

Recovery validation initially detected that the older managed-schema supplement
omitted the new Chaos Storage policies. Both current policies were exported
read-only and included in the fresh supplement; a clean restore of the corrected
recipe passed. An intermediate target guard rejected a stale copied restore
script before mutation; the final rehearsal used a separate target and directory.
No failed attempt is counted as recovery success. Database recovery does not prove
Storage payload, offsite backup or full hosted-platform recovery.

## Applied migrations and invariants

Applied exactly, in order, inside one transaction with checks between steps:

1. `20260924005111_chaos_legacy_workspace_normalization.sql`
2. `20260924013600_cloud_active_workspace_authority.sql`

The execution wrapper retained both reviewed SQL bodies, used one outer transaction,
recorded their exact ledger versions, and verified fingerprints/counts before,
between and after them. No historical migrations were replayed.

| Measure | Before | After |
|---|---:|---:|
| Inventory rows | 1,515 | 1,515 |
| Inventory units | 1,778 | 1,778 |
| Inventory events | 1,563 | 1,563 |
| Unscoped inventory | 0 | 0 |
| Unscoped Chaos batches | 22 | 0 |
| Existing batches, including current draft | 23 | 23 |
| Migration ledger entries | 20 | 22 |
| POS-enabled workspaces | 0 | 0 |
| Private production Square connections | 0 | 0 |

Exactly 22 legacy workspace associations changed. Whole-row fingerprints preserved
inventory, events, positions, sessions and membership; all non-workspace batch
fields were compared in-transaction. Batch IDs, owners, quantities, timestamps,
locations, acquisition records and provenance remain intact. Existing CS-000023
remains the prior cloud draft; no historical batch was fabricated.

## Authorization, REST and Storage verification

- Post-production definitions and policy fingerprints exactly match the repaired
  execution rehearsal.
- **58/58** full authorization/delegation checks rerun in the disconnected fixture DB.
  Positive POS barcode/delegation scenarios remain isolated; production POS was
  never enabled, including during tests.
- **12/12** real PostgREST matrix assertions passed in the isolated target.
- **16/16 production rollback-only checks** passed: one actual owner temporarily
  belongs to a second workspace inside a single transaction; A/B reads, price
  access, known-ID removal denial, search scope and label denial work in both
  directions. Each price/removal probe has a rollback subtransaction; the entire
  fixture/workspace/preferences transaction was rolled back. No Auth account was
  created and no production sale/removal committed.
- Permanent production integrity query: **11 checks, zero violations**, covering
  NULL scope, orphan FKs, position/batch workspace consistency and album parents.
- Rehearsal Storage RLS checks cover current owner access, inactive workspace,
  unrelated user, anonymous, valid reserved upload denial and overwrite denial.
  This does not claim synthetic production file uploads or production staff rollout.

## Security advisors

Hosted Supabase advisors ran before and after DDL. No new anonymous EXECUTE
finding appeared. Authenticated SECURITY DEFINER notices increased from 68 to 70:
the two reviewed scope helpers `can_current_user_access_workspace(uuid)` and
`current_inventory_workspace()` are intentionally callable by authenticated users.
Reviewed: fixed empty search paths, qualified relations, database membership and
active-scope validation, caller identity from Auth, scalar scope-only returns,
no DML, no private helper grant and no authorization expansion. These two notices
are accepted as intentional API exposure, not unreviewed warnings.

Existing notices remain: 39 anonymous SECURITY DEFINER notices and leaked-password
protection disabled; RLS-without-policy informational count changed 54 to 53.
These predate this repair and were not silently changed. See the
[Supabase security advisor reference](https://supabase.com/docs/guides/database/database-linter).
The local CLI's empty advisor result in the readiness report was not substituted
for these hosted production results.

## Application validation and promotion

Local `npm run check`: TypeScript, ESLint (zero errors, existing warnings),
**1,004 root tests**, dependency audit zero vulnerabilities. Mobile/shared checks
and build evidence are recorded with the final promotion result below.
Signed-in Chaos reload after schema repair recovered CS-000023 and all 23 saved
headers without a production batch or capture mutation.

PR, merge SHA, Vercel deployment, final workflow smoke checks and log review:
**PENDING**. No completion claim until deployment verification finishes.

POS disabled. Production Square disabled. Hardware certification unchanged.
