# Production compatibility repair execution — September 21, 2026

## Database repair: complete

Owner-authorized production transaction started **21:40:47 UTC** and completed **21:40:53 UTC**. The command exited successfully; independent post-commit reads confirmed the result. No historical POS continuation migrations were applied.

Exact execution order:

1. `20260921195747_label_production_compatibility.sql`
2. `20260921195836_chaos_and_pos_authority_compatibility.sql`
3. `20260921203415_inventory_authoritative_workspace_writer.sql`
4. `20260921201424_inventory_workspace_assignment.sql`

All four original files executed in one transaction with 5-second lock and 60-second statement timeouts. Inventory was locked before the first file; assignment evidence remained locked through verification. Each exact file was recorded once in migration history, increasing its count from 12 to 16. The execution wrapper was first successfully rehearsed with ROLLBACK on the isolated Supabase restore target.

Preflight matched the verified recovery baseline: critical table hashes, ownership and Auth relationships, functions, policies, RLS, triggers, enums, schema columns, indexes, constraints and application grants. Both original backup checksums remained unchanged. The assignment classification remained 1,489 deterministic rows: 1,460 positive, 29 zero quantity, 19 explicit-event assignments and 1,470 sole-eligible-owner assignments; zero ambiguous, unresolved or marketplace-linked affected rows.

| Invariant | Before | After |
| --- | ---: | ---: |
| Inventory rows | 1,515 | 1,515 |
| Inventory units | 1,788 | 1,788 |
| Inventory events | 1,550 | 1,550 |
| Unscoped inventory rows | 1,489 | 0 |
| Active workspace-backed unscoped rows | 1,460 | 0 |
| Workspaces / memberships | 5 / 5 | 5 / 5 |
| Chaos batches / positions | 22 / 1,488 | 22 / 1,488 |
| Existing label identities | 26 | 26 |

Full-row comparisons inside the transaction proved that only the approved 1,489 workspace fields changed. Other inventory fields, owners, game identity, quantities, batches, locations, inventory events and marketplace allocation/mapping/order-item records remained unchanged. The collector guard was restored verbatim; existing inventory policies and RLS were preserved. No temporary assignment permit remains. Both private writer triggers are enabled and no browser/service role has EXECUTE on their private helpers.

Label Studio prerequisites, indexes and new constraints are present. Four pre-existing inventory CHECK constraints remain NOT VALID exactly as before: item kind, asking price, label price and market price. No invalid related indexes were found. This repair did not broaden their scope or silently validate historical constraints.

Authenticated owner `label_access` succeeds and read-only `label_targets` returns 500 targets. The owner sees no foreign inventory. Anonymous inventory SELECT and label RPC execution remain denied. The live database has no POS tables; production Vercel has no Square/POS environment variables. Production Square execution remains blocked by the unchanged runtime guard.

## Application promotion gate

Schema verification completed before application promotion. The reviewed runtime change remains limited to `src/lib/label-studio/server.ts`; the PR also carries the four migrations, focused regression tests and review/recovery evidence.

Fresh validation: `npm run validate` passed (TypeScript, ESLint with 535 existing warnings and zero errors, 960 unit tests, production dependency audit with zero vulnerabilities, Next.js production build). The production-shaped compatibility/writer/assignment rehearsal passed. Both POS ledger variants passed 134 checks each, including 500-line carts, scoped delegation, owner authorization, cross-tenant denial and future inventory writer paths. Those mutations ran only in disposable local databases. Expo web/native were not rerun: no mobile code changed.

Before promotion, production-safe signed-in reads loaded Dashboard, Inventory/Collection and Orders Center (253 imported orders). Marketplace connections rendered its existing reconnect-required state; no reconnect, import, payment, fulfillment or customer-data mutation was performed.

PR, merge, deployed Label Studio/Chaos/Inventory smoke results and runtime-log observation are recorded after deployment. At this checkpoint they remain pending, not a claimed completion.

**POS DISABLED. PRODUCTION SQUARE DISABLED. PHYSICAL HARDWARE ACCEPTANCE PENDING.**

Recovery and rollback remain as documented in `POS_PRODUCTION_RECOVERY_READINESS.md` and `POS_PRODUCTION_MIGRATION_READINESS.md`: preserve schema and financial/inventory history after commit, pause affected mutations if necessary, and use a reviewed forward correction. Never null the new workspace assignments or drop history to roll back.
