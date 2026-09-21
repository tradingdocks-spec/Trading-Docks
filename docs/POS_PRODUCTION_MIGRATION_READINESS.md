# Production migration readiness — September 21, 2026

**SAFE TO ASSIGN + CONTINUE** for the reviewed legacy workspace-assignment cohort. Production execution remains unapproved and has not been performed.

The [workspace-assignment review](POS_PRODUCTION_WORKSPACE_ASSIGNMENT_REVIEW.md) supersedes the previous NULL-workspace hold for these existing rows:

- 1,489 deterministic assignments: 19 from explicit inventory-event scope and 1,470 from the sole eligible owned workspace.
- 1,460 positive-quantity rows and 29 zero-quantity rows; zero ambiguous, unresolved or intentionally unscoped cases.
- All 1,515 inventory rows and 1,788 units preserved; owner/game/location/batch values, 1,550 events, marketplace allocations, collector authorization and RLS unchanged.
- Label Studio owner targets and exact-position labels pass in the disposable production-shaped rehearsal. Both POS ledger variants pass 129 checks including assigned exact-position search and staff/delegation boundaries.

Proposed rehearsal order (not execution approval):

1. `20260921195747_label_production_compatibility.sql`
2. `20260921195836_chaos_and_pos_authority_compatibility.sql`
3. `20260921201424_inventory_workspace_assignment.sql`

The assignment changes only workspace association; it does not execute the separate 1,489-row game identity backfill. The earlier accepted 12-file DDL/backfill results remain recorded in [their manifest](pos-production-schema-rehearsal.json). Do not run that historical list blindly after the standalone label repair: overlapping objects require a separately reviewed forward POS continuation plan.

The current Chaos writer still omits workspace scope on newly committed inventory. A rolled-back regression probe confirms this while preserving the existing algorithm. That recurring-write defect requires a focused follow-up before claiming durable production Label Studio readiness; the assignment verdict applies only to the reviewed existing cohort.

Production POS remains disabled/gated, production Square remains unconfigured, and hardware acceptance remains pending. There has been no production mutation, deployment or enablement. Return to the owner approval gate before any assignment or migration. Refresh read-only classification immediately before any eventual approved execution; changed evidence or cohort counts require a new review.
