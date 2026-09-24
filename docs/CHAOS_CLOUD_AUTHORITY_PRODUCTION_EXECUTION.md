# Chaos cloud authority production promotion

## Schema-first execution — 2026-09-24 UTC

Production project: `bohddnajlnmknngzjsjk`. Owner approved only the following files, applied in order in one guarded transaction:

1. `20260923204804_chaos_scan_albums_v2.sql`
2. `20260924000100_chaos_cloud_authority.sql`

Start: **2026-09-24T00:02:17.5380451Z**. End: **2026-09-24T00:02:20.9919072Z**. Result: **CHAOS_SCHEMA_APPLIED_VERIFIED**. No other migration was replayed. Five-second lock timeout and 120-second statement timeout were used; historical fingerprints were asserted before and after each file, before commit.

## Fresh recovery

Fresh Supabase-aware roles, schema, COPY data, explicit migration history, managed customizations and current application grants are preserved outside Git in the access-restricted owner folder `C:\Users\Jerem\TradingDocksRecovery\trading-docks-pre-chaos-cloud-20260923`. All seven SHA-256 manifest entries were rechecked. Original backup sets remain intact.

Restore succeeded in `pre_chaos_cloud_recovery_20260923`, using the disconnected Supabase PostgreSQL 17.6.1.167 container; no application, mail or integration services were connected. Inventory/events/positions/batches/sessions/memberships fingerprints, Auth relationships, functions, policies, RLS, indexes, enums, extensions and effective application grants matched source. Two CHECK definitions differed only in redundant parentheses around conjunctions. The raw ACL representation differed for implicit/explicit database-owner rights; effective application grants matched. Owner reads, cross-tenant isolation and anonymous denial passed. Storage object bytes/offsite recovery remain outside this database restore proof.

The exact migration pair was first rehearsed on a separate clone of this fresh restore. Production's immediate read-only preflight then matched the source backup fingerprint.

## Production schema verification

| Measure | Before | After migrations |
| --- | ---: | ---: |
| Historical committed batches | 22 | 22 |
| Highest historical code | CS-000022 | CS-000022 |
| Drafts | 0 | 0 |
| Inventory rows | 1,515 | 1,515 |
| Inventory units | 1,778 | 1,778 |
| Inventory events | 1,563 | 1,563 |
| Migration entries | 18 | 20 |
| Enabled POS workspaces | 0 | 0 |
| Square connections | 0 | 0 |

Historical IDs, provenance, inventory and event fingerprints were unchanged. No historical batches 23–29 were fabricated. The new private counter was seeded at 22. Inventory, batch, album and capture RLS remain enabled. Owner history/current RPC reads passed; cross-tenant and anonymous access checks passed. Existing POS delegation does not confer Chaos owner mutation rights (covered by the isolated delegated-staff regression).

History now derives remaining quantity from authoritative inventory: for example CS-000004 reports original 85/remaining 80, and CS-000005 reports original 86/remaining 84, while retaining the original stored headers. Other historical position discrepancies are visibly flagged, not repaired by this release.

## Release validation

TypeScript, ESLint (zero errors, existing warnings), all 1,001 root tests, production build, dependency audit (zero vulnerabilities), 376 native security/contract assertions and Windows image validation passed. The reviewed local browser runs covered 14 scenarios, including clean Chrome/Edge recovery, acknowledged captures 42/43, 100-card cap, commit/label/next-batch and retained scanner connection. The reviewed isolated DB tests covered concurrent slots, replay, authorization, immutable commits, sale/removal/return reconciliation and history at 10,000 headers. Physical scanner acceptance is not implied.

Application PR, merge, deployment and hosted smoke verification are pending at this schema checkpoint. POS/Square and scanner account/workspace release gates remain unchanged; no installer is publicly distributed.
