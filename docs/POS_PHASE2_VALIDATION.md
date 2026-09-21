# Phase 2 — Barcode and Label Printing validation

Date: 2026-09-20. Branch: `codex/pos-foundation`. Status: **Implemented and locally validated for continued development**. Production rollout remains unapproved. No production database, deployment, environment, secret, live payment infrastructure or main branch was changed.

## Delivered behavior

The canonical route remains `/dashboard/label-studio`. Real Code 128 replaces decorative bars. The existing label identity table binds new single-card labels to exact positions; generic merchandise and legacy item identities remain supported. Existing `TD-XXXX-XXXX` SKUs and QR tokens are not regenerated. Aliases retain their target and reject conflicts. Deleted/inactive/wrong-class labels fail safely. Current database asking price remains authoritative.

Inventory row/detail/bulk actions, put-away selection, Chaos Sort committed batches, recent inventory and POS lead into the same print queue. Queue copies can be one, inventory quantity or custom; duplicate/remove/copy barcode and current-price refresh are available. A structured organization template editor supports six system presets, duplication, rename/edit, default and archive. System presets remain immutable. Hardware diagnostics reuse the POS scanner.

Sizes: 1×0.5, 1×1, 1.5×1, 2×1, 2.25×1.25, 2×2, 3×2, 4×2, 4×6 inches, plus custom inches/mm with six-decimal database precision. Modes: one-label-per-page thermal roll; independently paginated sheet grid with Letter defaults. Code 128 rejects insufficient media width instead of shrinking its minimum module size. Small stock can use compatible text/QR layouts. Product presets may print an unambiguous manufacturer UPC while retaining the internal SKU; otherwise they fall back to the internal code.

## Migration and database surface

New migration only: `20260920190428_pos_barcode_labels.sql`.

| Object | Change |
|---|---|
| `inventory_label_identities` | Position/location binding, target constraint, scoped active uniqueness, immutable identity guard, stricter RLS, delete privilege removed from API roles |
| `inventory_barcode_aliases` | New protected workspace/value mapping; manager assignment/deactivation/reactivation; no retargeting |
| `pos_private.label_tombstones` | New private history preserving deleted codes |
| `label_templates` | Six-decimal dimension precision, unique active default, existing JSON extended with structured print settings, stricter RLS |
| `label_print_jobs` | Existing metadata history reused; counts support up to 10,000 physical pages; prepared jobs remain `preview`, never falsely `printed` |
| `pos_sale_allocations` | Added line key for separate positions of the same item |
| `pos_private.command` | Forward replacement preserving Phase 1 finalizer, with deterministic exact resolver and distinct item/position lines |
| `pos_private.protect_event_origin` | Forward replacement validating position-specific event keys |
| New private functions | `guard_label_identity`, `label_identity`, `resolve_barcode`, `retire_position_label` |
| New public functions | `label_targets`, `label_locations`, `assign_label_barcode`, `set_default_label_template`, `label_actor_allowed` |

Existing `pos_command` signature, collector locks, marketplace awareness, immutable events, cash amounts, retries and cancellation tombstones are preserved. The Phase 1 migration and all other historical migration files are unchanged.

## Exact validation results

| Check | Result |
|---|---|
| Root TypeScript | Passed (`npm run typecheck`, also production build type checking) |
| Root ESLint | **0 errors, 534 warnings**; baseline was 537 warnings |
| Full unit/regression suite | **906 passed / 906**, zero failures, zero skips |
| New label domain/render/API tests | **16 passed**, included in full suite |
| Database integration, text ledger | **48 passed** (29 preserved Phase 1 + 19 Phase 2) |
| Database integration, enum ledger | **48 passed**, same scenarios; **96 executions** across both variants |
| Browser inventory → label → PDF → exact scan → sale → movement | Passed with production components/renderer and actual local SQL |
| Phase 1 browser regressions | All **3 grouped checks passed**, including lost-response recovery and tablet layout |
| New Chromium PDF scenarios | **9 passed**: roll counts 1, 2, 5, 10, 50, 100, 250, 500; plus 31 labels on two Letter sheets |
| Preset rendering | All **6 presets** checked for overflow and captured as screenshots |
| Existing Chaos Sort browser print regressions | **30 passed** across Chrome and Edge |
| Production Next.js build | Passed |
| Diff whitespace check | Passed |
| Active Expo/mobile checks | Not applicable: active mobile runtime/contracts were not changed |

The baseline full suite was 889/890 because `tests/marketing-intelligence.test.ts:65` intermittently accepts its tampered capture token. It failed once again during development, alongside a preset expectation that was updated for 4×6. Final full-suite runs passed without changing, skipping or quarantining that unrelated marketing test. Its pre-existing flakiness remains a repository follow-up.

Database checks execute real migrations and authenticated roles in disposable PostgreSQL 17.10 bound to `127.0.0.1:55439`, using the existing Phase 1 prerequisite/dependency subset. They are not simulated SQL assertions or a replay of every historical migration. New coverage includes stable/unique codes, case normalization, repricing and moves, aliases, conflicts, inactive/deleted targets, location class, same/different tenant, owner isolation, anonymous/cashier/inactive employee restrictions, precision/default template RLS, UPC fallback, two-position checkout and per-movement allocation quantities.

Supabase CLI security advisors ran against that explicit loopback database with SSL disabled for the disposable fixture. No Phase 2 error or warning was reported. Five pre-existing/fixture mutable-search-path warnings remain: `current_admin_role`, `is_admin`, `workspace_role_rank`, `collector_inventory_error_payload`, `raise_collector_inventory_error`. No hosted project was queried.

The browser uses installed Chrome with production Label Studio/Register/renderer and a loopback HTTP adapter connected to the real SQL functions. It checks five-label PDF output, duplicate-window prevention, 768px layout, exact position selection, current price, cash/change and final movement provenance. It does not certify hosted Supabase cookies/PostgREST, production entitlements, or the full authenticated dashboard shell.

Final roll render + browser/PDF timings under concurrent validation load: 1 label 799ms; 50 labels 306ms; 250 labels 445ms; 500 labels 984ms. These are local fixture observations, not a production latency promise. Editing renders one sample rather than 500 label subtrees. PDF page boxes were 50.8×25.4mm for roll tests and Letter 612×792 points for sheets, with no trailing blank pages, duplicate hidden pages, dashboard DOM or label overflow.

## Physical acceptance matrix

| Device class | Readability | Alignment / scale / margins | Repeat counts | Status |
|---|---|---|---|---|
| USB keyboard-wedge scanner | Scan TD and UPC, repeated copies | Check Enter suffix/focus handling | Repeated scans deduct correct position | **Not performed on physical hardware** |
| Zebra thermal | Scan printed Code 128 | Correct media, 100%, no margins/headers | 1 / 2 / 10 / large batch | **Not performed** |
| Rollo / DYMO consumer thermal | Scan printed Code 128 | Driver/media alignment and scale | 1 / 2 / 10 / large batch | **Not performed** |
| Brother thermal | Scan printed labels and legacy batch QR | Exact roll profile / alignment | 1 / 2 / 10 | **Not performed** |
| Letter office printer | Scan sheet labels | Row/column gaps, margins, first/last cells | Partial/full/multiple sheets | **Not performed** |

Use Print Test Label first. Record device/driver/browser/media/DPI, scan success, measured dimensions and actual physical count. Printer selection is through the browser/OS; there is no native agent or silent printing. PDF correctness is not physical hardware certification.

## Remaining limitations and Phase 3 readiness

Phase 3 register-operations development can begin on this foundation. Production rollout cannot: physical hardware and hosted staging/authentication acceptance remain outstanding. Owner-operated inventory boundaries remain; shared employee stock is not introduced. Legacy whole-item labels retain whole-item semantics. Generic external UPCs can later become ambiguous and then require manager correction; no resolver guesses. Batch queues are bounded to 500 targets and print jobs to 10,000 copies. Rich printer profiles, a sheet-preset catalog, automatic repricing, Quick Item and a full alias activation-toggle audit remain follow-ups. Sound feedback is optional and not implemented.

See [Label and barcode architecture](LABEL_AND_BARCODE_ARCHITECTURE.md) for lifecycle, correction semantics, template compatibility and test commands. No PR, deployment, production migration or main merge was performed.

## Files changed

The following inventory is generated from this focused change, excluding build-generated files restored before commit.

36 files:

- `docs/LABEL_AND_BARCODE_ARCHITECTURE.md`
- `docs/POS_ARCHITECTURE.md`
- `docs/POS_PHASE2_VALIDATION.md`
- `package-lock.json`
- `package.json`
- `src/app/api/label-studio/aliases/route.ts`
- `src/app/api/label-studio/print/route.ts`
- `src/app/api/label-studio/route.ts`
- `src/app/api/label-studio/targets/route.ts`
- `src/app/dashboard/pos/hardware/page.tsx`
- `src/app/dashboard/pos/layout.tsx`
- `src/components/dashboard/inventory/ChaosSortBatchDetail.tsx`
- `src/components/dashboard/inventory/ChaosSortWorkspace.tsx`
- `src/components/dashboard/inventory/InventoryWorkspace.tsx`
- `src/components/dashboard/label-studio/LabelStudioWorkspace.tsx`
- `src/components/dashboard/label-studio/PrintLabelsLink.tsx`
- `src/components/dashboard/label-studio/label-studio.css`
- `src/components/dashboard/navigation.ts`
- `src/components/pos/Hardware.tsx`
- `src/components/pos/Register.tsx`
- `src/lib/label-studio/label-templates.ts`
- `src/lib/label-studio/persistence.ts`
- `src/lib/label-studio/print-document.ts`
- `src/lib/label-studio/print-settings.ts`
- `src/lib/label-studio/retail-presets.ts`
- `src/lib/label-studio/server.ts`
- `src/lib/pos/domain.ts`
- `src/lib/pos/server.ts`
- `supabase/migrations/20260920190428_pos_barcode_labels.sql`
- `tests/inventory-label-platform.test.ts`
- `tests/label-api.test.ts`
- `tests/label-db.mjs`
- `tests/label-print-browser.mjs`
- `tests/label-print.test.ts`
- `tests/label-workflow-browser.mjs`
- `tests/pos-db.mjs`
