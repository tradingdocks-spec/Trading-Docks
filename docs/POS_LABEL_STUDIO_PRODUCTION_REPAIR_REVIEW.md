# Label Studio production repair review — September 21, 2026

**NOT SAFE TO APPLY. Production migration approval remains ON HOLD.**

The accepted 12-file schema/backfill rehearsal remains valid as a DDL and inventory-backfill result. It did not establish Label Studio runtime compatibility. This focused rehearsal finds an additional prerequisite and two runtime blockers. No production mutation, POS enablement, Square configuration, or application change was performed.

## Exact dependencies

| Missing production column | Introducing repository migration | Position in accepted plan |
| --- | --- | --- |
| `inventory_label_identities.inventory_position_id text` | `20260920190428_pos_barcode_labels.sql` | 2 of 12 |
| `inventory_label_identities.inventory_location_id text` | `20260920190428_pos_barcode_labels.sql` | 2 of 12 |
| `chaos_sort_inventory_positions.language text` | `202609070001_chaos_sort_sessions_and_positions.sql` | Earlier prerequisite, outside the 12 |

The deployed bootstrap query filters `inventory_position_id`; `label_targets` also reads `p.language`. Migration 2 supplies the new label RPCs but requires migration 1, `20260920181448_pos_cash_foundation.sql`, for `pos_sale_allocations` and private authorization infrastructure. Applying migration 2 alone fails atomically with missing `pos_sale_allocations`. The first two files together still produce `42703: column p.language does not exist`. `label_templates.archived_at` already exists and is not a missing prerequisite.

The three-file candidate tested, **not recommended for execution**, was:

1. `202609070001_chaos_sort_sessions_and_positions.sql`
2. `20260920181448_pos_cash_foundation.sql`
3. `20260920190428_pos_barcode_labels.sql`

The earlier file is not a column-only repair: it replaces Chaos Sort functions, policies and grants. Replaying it replaces production's current commit implementation. A valid `commit_chaos_sort_batch` succeeds before replay and fails afterward with **42702: column reference `location_id` is ambiguous**. Consequently it cannot safely precede the broader POS sequence as written.

Even with all three files, the mirrored production owner cannot use Label Studio: the application grants platform-owner access, while `pos_private.authorize` behind label RPCs requires Seller/Store membership. Read-only production inspection confirms the signed-in owner has effective membership **Free**, platform role **owner**, and owns **1,514** inventory rows. The local SQL and actual Label Studio component both reproduce **POS_FORBIDDEN**. Do not change this account's membership or broaden grants to conceal the mismatch. The intended platform-owner authorization contract needs a focused review and repair.

**Applying only these prerequisites does not restore Label Studio for the production owner.** Applying just the two identity columns would also leave missing RPC/infrastructure and language dependencies; no ad-hoc patch was attempted.

## Row effects and safety evidence

| Candidate migration | Existing data values updated by migration | Schema effect on existing rows |
| --- | --- | --- |
| Earlier Chaos prerequisite | 0 | 1,488 positions gain nullable `language`, initially NULL |
| Cash foundation | 0 | Creates POS structures; no enabled workspace inserted |
| Barcode/labels | 0 | 26 identities gain two nullable fields, initially NULL; zero templates need dimension conversion |

There is no executed historical DML backfill in these three files. DML inside newly defined function bodies runs only when those functions are invoked later. Production has two existing print jobs; the migration widens their count constraint without changing their values. The unrelated 1,489-row game identity backfill is not part of this minimal candidate and was not run.

Before/after snapshots preserve all **1,515 inventory rows**, **26 identities**, **5 locations**, **22 sessions**, **22 batches**, and **1,488 positions**, including existing ownership and data values. The functional test's synthetic writes are rolled back; browser issuance creates one intentional identity only in the disposable database after migration snapshot checks.

DDL does not fire row-level backfill triggers here. The reconstructed public-table RLS event trigger runs on table creation. The existing collector authorization function remains byte-for-byte unchanged. Normal owner metadata updates succeed; unauthorized mutations still raise `TD_COLLECTOR_UNAUTHORIZED`; cross-tenant inventory reads are denied. Existing inventory policy expressions remain unchanged, relevant tables retain RLS, and no enabled POS workspace exists. There is no migration bypass/helper left enabled.

All existing constraints/FKs and indexes were compared against the production export. Only the reviewed label count constraint widening and active-item index predicate change differed; new label indexes are valid. Newly installed label policies/triggers govern subsequent writes. These checks do not excuse the Chaos function regression.

## Application and transition results

| State | Label Studio | POS | Inventory / other workflows |
| --- | --- | --- | --- |
| Production-shaped baseline | Missing identity columns/RPCs | Database POS functions absent; existing application gate applies | Owner inventory edit and Chaos commit pass |
| Cash foundation only | Still fails | `POS_DISABLED` | Tested inventory authorization remains compatible |
| First two files | Identity query works; targets fail on `p.language` | `POS_DISABLED` | Tested inventory edits remain compatible; Label Studio remains broken |
| Earlier prerequisite alone | Still fails | POS functions absent | Chaos commit implementation replaced; candidate demonstrates regression |
| Earlier prerequisite + foundation | Still lacks label schema/RPCs | `POS_DISABLED` | Inventory checks pass; unsafe Chaos implementation remains |
| All three candidate files | Store fixture loads/prints; actual platform-owner fixture gets `POS_FORBIDDEN` | `POS_DISABLED` | Inventory checks pass; Chaos commit fails |

Thus production **can** enter a state where Label Studio still fails and POS has only partially installed schema. The tested POS command remains disabled once installed; no enabled POS operation was attempted. Ordinary tested inventory metadata writes do not fail, but a non-POS inventory-producing workflow (Chaos Sort commit) does. The candidate is not safe between steps or at its endpoint. Wrapping all files atomically would hide intermediate schema states but would not cure the final defects.

Local browser verification compiles the actual `LabelStudioWorkspace` component, uses a loopback SQL adapter and real label renderer, and proves one Store-owned target can receive a canonical barcode and prepare a rendered label with no page errors. It also proves the production-owner authorization error. This is **not** a hosted Next/Auth/PostgREST acceptance pass or print-job persistence test. Collection/inventory checks are database read, ownership and metadata-write regression checks; physical barcode scanning and full hosted Collection navigation were not repeated against the disposable database. Chaos regression is a decisive failure, so no wider production execution is justified.

## Impact and next approval gate

Observed uncontended local DDL took milliseconds per file; see the machine-readable evidence for exact timings. These are not production runtime estimates. `ALTER TABLE` needs strong table locks, index work can block writes, and the rehearsal does not model production lock contention. No maintenance window or executable production migration plan is recommended while these defects remain.

The next reviewed change must supply the missing schema through a **new forward migration** without replaying obsolete Chaos behavior, and reconcile Label Studio's platform-owner authorization contract without weakening ordinary ownership, collector, employee or tenant rules. Previously applied migrations must remain immutable. Repeat this focused rehearsal and the complete ordered transition checks after that repair, then prepare fresh preflight/verification queries and seek owner approval.

Until then: retain current production schema, POS gates and payment guards. Do not run the earlier report's execution instructions. If a future approved transaction fails verification, roll back that transaction; after a committed change, preserve inventory/financial history and prefer a reviewed forward repair or separately approved application rollback. Never drop audit tables, null identities, or erase transactions as a rollback shortcut.

Evidence: [rehearsal result](pos-label-production-repair-review.json), [database runner](../tests/label-production-repair-rehearsal.mjs), [browser runner](../tests/label-production-repair-browser.mjs). Repeat with the ignored sanitized production capture using `node tests/production-schema-rehearsal.mjs --label-repair`. This is a diagnostic regression rehearsal: a completed run records the expected blockers and does **not** mean readiness passed.
