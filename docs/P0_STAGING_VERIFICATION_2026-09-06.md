# P0 staging verification — September 6, 2026

**Status: BLOCKED on verified staging access. Both P0 launch blockers remain OPEN. Trading Docks remains NO-GO.**

This pass prepares verification of the existing remediation. It does not change application code or the migration, deploy an app, apply database changes, repair historical records, or certify production readiness.

## Target and access evidence

- Local public Supabase configuration identifies `bohddnajlnmknngzjsjk.supabase.co`, but nothing inspected identifies it as a separate staging database. No database requests were made to that target.
- Authenticated Vercel metadata for `trading-docks-346a` lists the Supabase URL and service-role key entries as scoped to both **Production and Preview**. No staging-specific override was identified. A Preview app is therefore insufficient evidence of database isolation.
- Existing Preview deployments were listed; the newest was approximately six days old. None was established to contain the current uncommitted candidate or use a separate staging database.
- No linked Supabase project configuration, direct database credentials, staging QA credentials, or authenticated browser session was found. `supabase`, `psql`, `pg_dump`, and Docker were unavailable on PATH.
- Secret values were not pulled from Vercel or printed. No backup or staging mutation has occurred.

The user has authorized staging application after backup. Further permission is not the blocker: the missing information is the explicit staging project/branch, its app URL, and secure access to its database/backup and QA accounts. Do not infer staging from a deployment name or reuse a shared Production/Preview database.

## Migration review

Reviewed candidate: `supabase/migrations/202609060001_inventory_commit_boundaries_proposal.sql`.

SHA-256: `20822395BE0D0AF7B1206196C65B6B2DC89E38F5376578D4BC75160ABF563CE6`.

The source wraps its DDL in a transaction. It adds an import receipt table keyed by owner and import key and replaces two server-only, security-invoker RPCs. Runtime operations use the existing inventory lock and transaction boundary to commit inventory, ledger, markers, order/location state, and receipts together. There is no historical deduction backfill or automatic stock repair.

Reapplication succeeded against the isolated PostgreSQL fixture while preserving an existing successful fulfillment. This is limited evidence of repeatable DDL, **not certification of compatibility with deployed data or schema**. `CREATE TABLE IF NOT EXISTS` does not reconcile a preexisting table with a different definition. `CREATE OR REPLACE FUNCTION` requires compatible existing signatures and replacement privileges. Prerequisite functions, table grants, RLS, and enabled inventory guards must be inspected in the target; the migration's insert-trigger prerequisite check alone is insufficient. Historical ambiguous orders deliberately fail closed and require reconciliation before retry.

Use [the read-only preflight](../supabase/verification/preflight_inventory_commit_boundaries.sql) to collect deployed columns, constraints, triggers, function fingerprints, grants, and policies before applying anything. Compare the target against the repository migrations and the exact candidate. Inspect any schema drift before proceeding. Production-data compatibility remains unverified until an authorized data snapshot or read-only production evidence is available.

## Backup and application gate

1. Resolve the explicitly named staging database and confirm separation from production using provider project/branch identity and connection metadata. Confirm the authenticated candidate app points to it.
2. Run the read-only preflight. Obtain a consistent staging backup with a restore path before DDL. Record project identity, UTC time, backup identifier/location, checksum where applicable, included schemas/data, tool version, warnings, and restore verification. Store database contents outside the repository in an access-controlled location.
3. A logical backup can use PostgreSQL custom archive format; role/global definitions need separate handling. Supabase database backups do not include the underlying Storage object files. Do not claim a complete platform backup from a database dump alone. See [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) and [Supabase backups](https://supabase.com/docs/guides/platform/backups).
4. Only after successful backup and compatibility review, apply the exact candidate to staging with stop-on-error behavior, capture the result, rerun preflight, and verify grants and function definitions. Do not apply the migration to production.
5. Identify the candidate app revision before UI testing. If the staging app lacks these fixes, that must be resolved before claiming database-backed UI verification.

## Required real staging matrix — all NOT RUN

Use isolated QA accounts and record baseline and post-request database snapshots for each case. Assert through the authenticated app/API and an independent database connection. Capture record IDs and response/error state without secrets. Any failure injection must be confined to dedicated staging QA records and be removed and verified afterward; never introduce a blanket failure trigger into a shared database.

| Scenario | Required authoritative evidence |
| --- | --- |
| Fulfillment success | Stock decreases exactly by ordered units; column and JSON quantities agree; one matching ledger event per line; deduction marker present; order shipped only after commit; UI acknowledges committed state. |
| Forced deduction failure | Non-success response and explicit UI failure; unchanged stock, ledger, markers, and order status. |
| Retry after failure | One eventual deduction and fulfillment, with no residual writes from the failed attempt. |
| Duplicate/concurrent fulfillment and lost-response replay | Exactly one deduction/event per line; stable marker and fulfillment state. Verify both fulfillment and bulk Orders entry points. |
| Later fulfillment write failure | Inject ledger/marker/order failure after deduction; all earlier changes roll back; retry remains recoverable. |
| Existing-location CSV | Existing owned location reused; each imported item references its authoritative ID in columns and JSON; ledger and receipt share batch provenance; Inventory and Location views show the rows. |
| New-location CSV | Exactly one new owned location, complete inventory, ledger, totals, and receipt commit together; rendered views agree. |
| Failed location write | Explicit API/UI failure; no imported items, movement events, location, or committed receipt. |
| Failed inventory/later receipt write | No orphan location or partial inventory/batch; baseline quantities and totals preserved. |
| Duplicate/concurrent/replayed CSV and retry after failure | One receipt, one batch identity, one intended location, and one inventory set; successful replay returns existing result. |

There is no new Batch screen in this remediation. Verify durable receipt and item/movement batch provenance directly; verify any applicable existing Batch view rather than claiming a screen exists. Actual rendered Inventory/Location visibility remains untested.

## Historical reconciliation

[The read-only report](../supabase/verification/report_historical_fulfillment.sql) flags shipped orders without markers, markers without corroborating deterministic ledger evidence, possible multiple deductions, quantity mismatches, unallocated legacy events, missing inventory links, mismatched inventory projections, and orphaned ledger provenance. It also compares recorded order deductions to ordered units.

These are investigation categories, not automatic repair instructions. Current stock and absent legacy markers cannot establish whether a historical deduction actually happened. An excess recorded in the ledger is evidence to investigate, not proof of a second stock mutation. Resolution may require prior snapshots and marketplace/order history. The report makes no stock or marker changes and runs in a read-only repeatable-read transaction with a timeout.

**No live historical records have been examined. The historical deduction ambiguity is unresolved.** Run the report against an authorized historical dataset; a staging database containing only synthetic QA records cannot resolve production history. Review scope and execution cost on large tables before running; a timeout is a failed report, not an empty findings result.

## Validation this pass

- `node .launch-audit/staging/verify-report-queries.mjs`: PASS locally. Both queries execute against the actual migration fixture; a shipped order without evidence is flagged; a healthy committed fulfillment is not flagged; quantity remains correct; migration reapplication preserves evidence.
- Real staging backup, migration, database scenario matrix, authenticated UI, and historical reconciliation: **NOT RUN — access/target unavailable**.
- No runtime files changed, so full application suites from the prior remediation were not repeated for these read-only artifacts. Earlier local results are documented in [the remediation report](P0_INVENTORY_TRANSACTION_REMEDIATION_2026-09-06.md); they are not staging certification evidence.
- Authenticated tier coverage, tenant isolation, billing, production verification, root lint, and all remaining P1/P2 certification gates remain open. No tests were suppressed or weakened.

## Files added in this pass

- `supabase/verification/preflight_inventory_commit_boundaries.sql`
- `supabase/verification/report_historical_fulfillment.sql`
- `.launch-audit/staging/verify-report-queries.mjs`
- `docs/P0_STAGING_VERIFICATION_2026-09-06.md`

No production deployment or migration occurred. Neither P0 is closed by this preparatory pass.
