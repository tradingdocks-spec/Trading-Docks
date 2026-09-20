# POS Phase 3 validation — pre-schema audit

Status: Planned. Phase 3 is **not implemented or complete**. Audit and ownership-boundary regression checks are complete; implementation stopped at the user's explicit architecture/authorization review gate.

Date: 2026-09-20. Branch: `codex/pos-foundation`.
Audited application commit: `fbf898190e895e923f6720157aa433d6c5c973c4`.
The audit/test changes are identified by the commit containing this report (`git log -1 -- docs/POS_PHASE3_VALIDATION.md`); the SHA above identifies the unchanged application under test, not Phase 3 delivery.

## Findings and required review

Invited `employee` membership is excluded by current shared capability normalization and POS SQL authorization. More fundamentally, canonical inventory mutation requires authenticated actor to equal stock owner, even for a workspace manager and even inside privileged SQL. Phase 2 also scopes registers/sites/barcodes to the inventory owner. Shared sessions alone cannot provide employee checkout.

See [register operations audit and proposed owner-granted delegation](POS_REGISTER_OPERATIONS.md). The user requested preservation of canonical ownership and explicitly required stopping for major architectural departures or authorization/ledger bypasses. No such extension has been silently implemented.

## Files changed in this audit

- `docs/POS_REGISTER_OPERATIONS.md`: required audit, evidence, concrete proposed delegation contract and remaining operational plan.
- `docs/POS_PHASE3_VALIDATION.md`: this limited validation report.
- `docs/POS_ARCHITECTURE.md`: links the Phase 3 review boundary.
- `tests/pos-staffing-boundary.mjs`: three executable checks for existing employee/manager/stock-owner boundaries.
- `tests/pos-db.mjs`: invokes those checks in the existing disposable database harness.

Migrations/tables/functions/permissions changed: **none**. Runtime and mobile files changed: **none**. Session state machine remains the accepted opened/closed timestamps; explicit OPEN/CLOSING/CLOSED, drawer events, manager approval and refunds remain Planned.

## Validation performed this turn

| Check | Result |
| --- | --- |
| Unmodified accepted database baseline | 48 checks passed on text-ledger fixture. |
| `npm run test:pos:db` after adding boundary coverage | 51 checks passed with text ledger and 51 with enum ledger: all existing 48 plus three new checks in each run. |
| New boundary checks | Employee role denied; same-workspace manager denied foreign-owner register/checkout; canonical trigger rejects foreign-owner mutation even when isolated from RLS. |
| Database scope | Loopback-only embedded PostgreSQL, real inventory/POS migrations, simulated auth/workspace prerequisite contract. No production or hosted Supabase access. |
| Focused ESLint and Node syntax | Both changed test modules pass. |
| Whitespace | `git diff --check` passes. |

Ignored local evidence: `.local-fixtures/phase3-audit-db.log` and `.local-fixtures/phase3-staffing-boundary.log`.

Full root typecheck/lint/unit/build, Expo Web/Native, Phase 3 browser flows, PDF rendering and hardware tests were not run for this audit-only change. Phase 2 results remain historical evidence in [its report](POS_PHASE2_VALIDATION.md), not a new Phase 3 validation claim. No runtime changes were made, so the required pre-runtime checks will still be needed before implementation resumes.

## Outstanding acceptance

All requested Phase 3 functional delivery and full regression/build validation remain outstanding. In particular: staffed registers, cash ledger and reconciliation, refunds/restock, intent-bound manager approval, discount/override calculations, receipt formats/settings, expanded history, sessions and daily reporting.

Hosted employee invitation/sign-in, secure shared-device account switching, independently authenticated manager approval, real receipt hardware/scanners and staged migrations have not been validated by the local SQL fixture.

Production rollout: **not approved**. No production migration/deployment, applied-migration modification, live payment connection, real charge, main merge, or authorization bypass occurred.
