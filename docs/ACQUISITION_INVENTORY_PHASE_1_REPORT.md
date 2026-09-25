# Phase 1 — Data integrity and scanner parity

Status: **PHASE 1K SHARED RPC REPAIR IMPLEMENTED AND REHEARSED LOCALLY — PHASE 1 INCOMPLETE**.

The owner resolved the architectural stop on 2026-09-24: the existing purchase ledger is the sole acquisition financial authority. The Phase 1F implementation below supersedes the stop recommendation. Sections after “Historical investigation” preserve the original investigation as historical evidence, not the current implementation status. Phase 2 has not begun.

## Phase 1F: purchase ledger audit

Inspected `202608110001_purchase_history_ledger_proposal.sql`, `202608120004_collection_intake.sql`, the inventory persistence/event migrations, collection-intake services/API/UI, purchase-history services/types/tests and dashboard analytics consumers before changing runtime behavior.

| Concern | Existing representation and finding |
|---|---|
| Purchase | `purchase_ledger`: one purchase header, not one card or movement. Source, seller/customer/vendor, actor, workspace, status, payment method, purchased/received timestamps, notes and JSON details exist. |
| Lines/quantity | `purchase_ledger_lines`: purchase children with quantity, unit_count, unit_cost, total_cost, description and optional inventory ID. Header item_count counts lines; unit_count counts units. |
| Money | Header subtotal + adjustment and total_cost; line cost allocation. Decimal columns and nonnegative checks exist, but legacy services normalize invalid/missing values and do not prove historical cost. |
| Fees/tax/shipping | No dedicated authoritative breakdown. Adjustment/details can hold information, but are not a verified fees/taxes/shipping model. This release does not invent one. |
| Identity | Line `details` carries game/product/printing/variant/language data. No typed catalog FK on purchase lines. Scryfall ID, SKU, or set+collector and explicit condition/finish/language can preserve reviewed exact identity; the ledger does not independently verify a catalog match. |
| Stock lineage | `purchase_inventory_links` references purchase, line and composite inventory owner/item; quantity and cost_basis. Lines also have inventory_item_id. These links support receipt without making stock the financial ledger. |
| Constraints/indexes | Existing header/line/link PKs and FKs, monetary/count checks, source/status/payment checks, owner/workspace/date and parent indexes. Legacy delete cascades/set-null behavior remains; no historical rewrite. New intake links use RESTRICT and unique indexes. |
| RLS/grants | Existing owner/workspace-member SELECT and owner/manager write policies; authenticated DML grants; anon revoked. These do not make the old collection-purchases completion valid. The new boundary protects intake-linked finance from direct edits while retaining legacy manual-ledger behavior. |
| Triggers/RPCs | Existing updated_at triggers and event-backed inventory writer are reused. The old intake SECURITY INVOKER finalizer contradicts its write grants/policies and writes a second financial table. It is replaced by a compatibility delegate to the single finalizer. |
| Services/APIs/UI | `purchase-history/server.ts`, `/api/purchase-history`, purchase-history types, and purchasing bulk/collection consumers represent the existing financial model. Generic `createPurchaseLedgerRecord` inserts header then lines separately; it is **not** reused by the atomic intake command and remains a legacy limitation. |
| Analytics | Dashboard inventory timestamps previously implied acquisitions and fabricated age buckets. Purchase History also counted pending records in spending. Both calculations are corrected below. Purchase History's legacy 250-record load remains a bounded list, not an all-history accounting report. |

No new `collection_purchases` table is installed. If the old proposal was installed, its historical table and records remain untouched. Legacy purchased intakes with only completed_purchase_id cannot be silently finalized again; mapping requires reviewed evidence.

## Phase 1F: domain and state contract

`collection_intakes` → optional `purchase_ledger` → `purchase_ledger_lines` → on receipt, `inventory_items` + `purchase_inventory_links` + `inventory_events`.

Intake is operational intent/review. A purchase is a financial commitment. Inventory is physically received stock. An edit or inventory event is not another financial purchase.

Retain existing states:

- `draft`, `evaluating`, `offer_ready`: editable pre-purchase workflow. Explicit `declined` and `archived` have no financial effect; reopening for review is permitted through an authorized save.
- Only `evaluating` / `offer_ready` with fully reviewed lines can finalize.
- Intake `purchased`: financial agreement persisted; immutable through draft commands. `purchase_ledger_id` is its authoritative link.
- Purchase `completed`: committed financially, awaiting physical receipt. `received_at` is null and stock does not yet exist.
- Purchase `received`: physical receipt succeeded. Purchased timestamp/value remains unchanged; received_at records the separate receipt time.
- Pending/cancelled purchase headers do not contribute to financial acquisition aggregates. No new state vocabulary is installed.

`receiveNow=false` enables commitment now and receipt later using the same stable request/key. The current intake screen keeps its existing immediate purchase+receipt behavior. Split shipment, partial acceptance, payable settlement, cancellation/refund accounting and a deferred-receipt UI are not implemented here.

## Phase 1F: transactional authority, permission and retry

New forward migration: `20260924235138_acquisition_purchase_authority.sql`.

`save_collection_intake(jsonb)` atomically saves the header and stable line IDs, with an optimistic revision and a transaction-level draft lock. It derives actor/current workspace in the database and refuses cross-owner drafts, conflicting revisions, duplicate line IDs and finalized drafts. Unknown language is preserved rather than defaulted to English. New UI drafts contain no seeded pretend cards or implied condition/finish.

`finalize_intake_purchase(uuid,numeric,text,boolean,text)` is the **one** financial finalization implementation. `complete_collection_intake` delegates to it. The server service invokes this RPC rather than coordinating finance in React or inserting a second purchase table.

The finalizer locks the intake, validates authenticated current-workspace owner/admin/manager membership and account ban state, then requires the intake's canonical owner and workspace to match. Client user/workspace claims cannot select another owner. It requires reviewed identity, positive whole quantities and finite nonnegative two-decimal agreed money. Paid allocations require saved positive valuation evidence for every line. Invalid states/locations or unresolved identity fail before completion.

SECURITY DEFINER with empty search_path safely encapsulates the transaction: explicit authorization happens before writes; object references are qualified; only authenticated callers receive public command EXECUTE; private helpers/schema are not exposed. Direct authenticated draft DML is revoked. Restrictive policies protect newly linked financial headers, lines and links against direct mutation. Legacy non-intake ledger permissions are unchanged. This resolves the old invoker/grant mismatch without opening anonymous, employee or cross-tenant writes.

The transaction creates the purchase and lines, then optionally invokes the existing event-backed inventory writer, records links/cost attribution and transitions receipt/intake states. Any exception rolls back that entire call. Failed **later** receipt preserves the earlier valid commitment and leaves it awaiting receipt. Diagnostic logs contain stage and SQLSTATE, not seller/card/provider data.

One unique purchase per source_intake_id and one finalization_key per owner, plus the intake row lock, prevent concurrent duplicate purchases. Repeated matching keys/amounts return the same IDs. Changed key/amount or conflicting receipt location is rejected. Inventory ID and receipt event key derive from the persisted purchase-line UUID. The UI retains an uncertain completion request for retry instead of attempting to edit a potentially finalized draft. A lost draft-save response requires reloading its revision; it does not create another draft automatically.

## Phase 1F: cost and analytics

Purchase header total_cost is the agreed amount. Existing proportional-market allocation is retained using **saved, reviewed** item values at agreement; cents round on lines with remainder on the final line. Line totals sum to agreed cost; rounded unit cost and exact total are both retained. No live market revaluation rewrites cost. Unpriced paid collections are blocked for allocation review, not allocated arbitrary zero/equal costs. Purchase lines snapshot identity and valuation; stock data and purchase_inventory_links point back to the original purchase/line.

Future allocation methods require explicit versioned policy, review and any corrections as auditable operations. They are not introduced by this migration. Current schema does not prove historical cost basis for stock without purchase links; those records remain unattributed. No guessed backfill, acquisition-date reset or historical acquisition rewrite occurs.

Dashboard acquisition metrics now page through authorized owner/workspace purchase rows. Completed/received purchase dates drive financial counts/cost; received_at separately drives physical receipt units. Failed ledger loads show unavailable, and invalid financial attribution shows insufficient data. Inventory updated_at is no longer an acquisition signal. Fabricated inventory-aging buckets were removed and replaced with the existing panel's ledger-backed metrics; age remains unavailable without lineage. Purchase History spending excludes pending/cancelled rows. Movement, condition, repricing and notes do not enter the acquisition inputs.

## Phase 1F: validation and limitations

Local automated evidence (no production calls or data mutation):

- Root suite: 1,024 passing (baseline 1,014 retained), including intake, purchase ledger, financial/receipt separation and edit-invariance tests.
- Mobile suite: 580 passing; no mobile runtime changes.
- Real PostgreSQL roles/RLS: 19 checks in each of two isolated synthetic schemas, with and without the historical intake proposal. Tests cover retry/concurrency, invalid states/identity/money/location, anonymous/employee/cross-tenant denial, direct financial mutation denial, deferred receipt, and failures injected at purchase, line, stock, event and link writes.
- Migration replay: empty and populated replay passes in both variants; populated financial/stock/event/intake snapshots remain identical.
- The two minimal DB fixtures execute real ledger/writer/forward SQL with a minimal workspace helper/identity schema. A separate Supabase Postgres 17.6 rehearsal cloned the preserved recovery database, applied the reviewed cloud baseline **only to that clone**, then replayed this migration. Actual owner receipt and retry passed under the existing inventory triggers: one item / two units / one event / one purchase / one link / zero unscoped items / $4 agreed cost. Cross-tenant and anonymous finalization were denied. Existing non-fixture inventory rows, units, events and Chaos batch totals remained unchanged. Original recovery database untouched. Harness: `tests/acquisition-supabase-db.mjs`; retained local clone: `acquisition_rehearsal_1790295038844`. This is a production-shaped local rehearsal, not a live production freshness check.
- TypeScript passed. ESLint: zero errors, 551 existing warnings (unchanged baseline). Root final check and npm audit passed; audit reports zero vulnerabilities.
- Production build: `next build --webpack` passed, including compilation, TypeScript, page generation and traces. Default `next build` failed because Turbopack rejects this worktree's node_modules junction outside its filesystem root. No production bundler/config change was made to conceal that local limitation. A subsequently found single Windows-1252 dash in the edited analytics component was corrected to UTF-8; the successful build is after that fix.
- Changed/untracked release file audit: 18 text files, valid UTF-8, zero private-key/token pattern or sensitive-path findings. No dumps, credentials, recovery artifacts or private fixtures added. `git diff --check` passed. Generated next-env/tsbuildinfo changes were reverted.
- Scanner runtime was not touched; existing root scanner regressions passed as part of the full suite. No physical scanner test was attempted. No authenticated browser end-to-end acceptance was claimed.

The legacy generic purchase-header/line service is still nontransactional, old ledger data may carry normalized unknowns, purchase-history list totals are bounded, and complete-catalog identity validation is not provided by this SQL. The current live schema must still be compared against the successful local recovery-clone rehearsal before release. These are explicit boundaries, not evidence that every acquisition entry point is repaired.

Manual/private acceptance still required: authenticated owner finalization and response-loss retry in the browser; two-workspace isolation with the current full Supabase schema; physical receipt cost/location provenance; reload a purchased intake; verify reporting against a known purchase/receipt cohort. No production purchase or stock may be created merely to satisfy this checklist without separate authorization.

**Phase 1 completion recommendation: NOT COMPLETE / NOT RELEASE READY.** Phase 1F's local architecture and executable transaction proof resolve the financial-model stop. Remaining Phase 1B–1E issues, legacy writer limitations, authenticated browser acceptance and production release review still gate completion. Phase 2 remains blocked. Production, CS-000023, inventory, POS/Square settings and hardware certification were not changed.

---

## Historical investigation (before the approved Phase 1F decision)

Date: 2026-09-24. Runtime baseline: `6f8af6c49a66ee15ffe2eabd03b99b42614a21c6`. Branch: `codex/acquisition-integrity-phase1`.

The Phase 1 instruction explicitly says: “If implementation reveals a larger architectural conflict, STOP and document it rather than building a second competing system.” The initial implementation investigation found that the proposed collection-intake finalizer is not a usable existing authority: its privilege model contradicts its writes, and the retained recovery database contains a different purchase ledger without the collection-intake purchase table/function. Work stopped before runtime or schema changes. Independent Phase 1B–1E repairs are not represented as completed.

## 1. Issues found

Beyond the five reviewed audit findings:

- `complete_collection_intake` is SECURITY INVOKER but inserts/upserts `collection_purchases`; authenticated users receive SELECT only and a deny-write policy. It also transitions the intake to `purchased`, which conflicts with the draft update policy's WITH CHECK. A normal authenticated completion cannot satisfy the declared contract.
- The preserved local recovery database has `purchase_ledger` and the event-backed inventory writer, but no `collection_purchases` or `complete_collection_intake`. This is a read-only schema observation of the recovery target, **not a new production observation**. Its freshness/completeness must be checked before any production conclusions.
- Purchasing existing-stock additions mutate quantity in one RPC and then overwrite location/cost/identity metadata in a separate request. Failure can leave quantity changed without its intended acquisition metadata.
- The existing event-backed creation function inserts a stock row before inserting its event; an event idempotency conflict uses DO NOTHING. A request key is not by itself proof that a second stock row was prevented when the supplied item ID differs. A transactional wrapper must define stable operation identity and payload conflict semantics, not merely add another event key.
- Mobile scanner confirmation creates stock, then separately performs trade/wishlist operations and draft cleanup. Its catch path queues the operation after a later failure. Retry semantics must distinguish completed inventory from failed optional follow-up work.

## 2. Root causes and architectural stop

There are two financial acquisition models:

1. `purchase_ledger`, `purchase_ledger_lines`, `purchase_inventory_links`, described by their migration as canonical Purchase History and consumed by Purchase History services.
2. `collection_purchases`, created by the collection-intake proposal and referenced by `completed_purchase_id`, but not linked to the first ledger by its completion function.

Treating the second as an already-working authoritative finalizer was too strong in the architecture audit. It has useful transaction logic, but source inspection now shows its permission contradiction. No runtime permission failure was induced in production.

Installing the old proposal and changing it wholesale to SECURITY DEFINER would neither settle which purchase history is canonical nor prove tenant safety. Creating a third generic acquisition ledger would violate the explicit no-competing-system rule. This is why the stop applies before implementing a draft-only fix that could appear to make the full intake workflow reliable.

### Recommended decision for review

Use **purchase_ledger + lines + inventory links as the sole financial acquisition authority**. Retain collection-intake drafts/review/scenario concepts as workflow state and link successful completion to the existing purchase ledger. Preserve any existing collection_purchases records found in later approved environment inspection as historical references; do not delete, recreate, double-count or blindly backfill them.

After review, design one authenticated transactional completion command using existing inventory/event primitives, narrow privilege boundaries and explicit workspace/owner checks. Decide draft-save revision/idempotency separately from financial completion. If an environment already uses collection_purchases authoritatively, first map its real references and offer a compatible bridge into the canonical ledger; do not assume it is empty everywhere.

This recommendation is not a migration or authorization to install historical SQL.

## 3. Files changed

- `docs/ACQUISITION_INVENTORY_ARCHITECTURE_AUDIT.md`: preserved the previously reviewed audit in Git; adds a correction pointing to this new finding.
- `docs/ACQUISITION_INVENTORY_PHASE_1_REPORT.md`: this implementation-gate report.

No runtime, test, package, installer, environment or production configuration files changed. No push, PR, merge or deployment performed.

## 4. Schema changes and evidence

None authored or applied. Read-only inspection used the existing local container `supabase_db_trading-docks-recovery-test`, database `postgres`, and queried catalog metadata only. No customer records, secrets or capture files were read.

Observed catalog results:

| Object | Recovery target result |
|---|---|
| `public.purchase_ledger` | Present |
| `public.collection_purchases` | Absent |
| `public.complete_collection_intake` | Absent |
| `public.create_inventory_item_with_event(jsonb,inventory_event_source,text,text,text)` | Present, SECURITY DEFINER |
| `inventory_events` | Enum event/source model; UUID workspace; quantity_before/change/after and cost/value fields |

Source evidence: `202608120004_collection_intake.sql` defines only SELECT grant on collection_purchases, SECURITY INVOKER completion, purchase INSERT/ON CONFLICT UPDATE, and a final purchased-state update. Repository-wide search found no later replacement of this completion function. `202608110001_purchase_history_ledger_proposal.sql` defines the separate purchase ledger. File names marked proposal do not establish deployed state.

Effective production schema/privileges must be inspected read-only before choosing a forward installation path. Do not replay the migration directory: existing tests explicitly support differing ledger baselines.

## 5. Intake transactional design and mutation sequences

| Path | Current sequence | Integrity issue / required boundary |
|---|---|---|
| Collection draft save | Normalize/valuate → header write → delete old lines → insert new lines | Separate requests can lose saved lines; use atomic versioned save preserving line IDs. |
| Collection completion proposal | Lock draft → insert collection purchase → create each inventory item/event → allocate line costs → mark purchased | Intended single transaction, but unusable declared privilege model and competing purchase authority. Resolve authority first. |
| Purchasing product lookup, new stock | Resolve product → create inventory/event RPC → optional trade binder action | Request key includes time; stock and optional action have separate outcomes. Financial acquisition linkage is not a complete atomic receipt. |
| Purchasing lookup, existing stock | Find match → quantity RPC → location/cost/identity UPDATE | Quantity can succeed while metadata fails; merging must not overwrite historical cost of prior units. |
| Mobile scanner save | Validate identity online → stock/event RPC → trade/wishlist → local cleanup | Later failure can queue already-created stock. Keep original operation ID and expose independent optional-action status. |
| Mobile replay | Revalidate → check existing item → insert if needed → follow-up handling | Existence checks are not an atomic deduplication boundary. Bind actor/workspace/operation/payload in the authoritative mutation. |
| Chaos commit | Cloud command → reviewed batch transaction/positions/events | Preserve the existing transaction and immutable capture IDs; verify, do not replace. |
| Snapshot consumers (CSV/card-show/legacy components) | Upsert snapshot chunks → delete removed records by collection | Not an atomic receipt; reachable call sites need explicit intake intent or independent per-item results. Do not broaden grants to make snapshot writes succeed. |

This is an initial writer map, not certification that every importer is covered. Remaining inventory writers and their effective triggers must be enumerated before Phase 1A can pass.

Proposed receipt boundary after authority review: validate exact identity and confirmation → authorize owner/workspace/location → lock stable operation → validate payload fingerprint → create purchase/line/link + inventory/position + event + financial metadata → store result → commit. Any required-stage error rolls back all effects. An identical retry returns the original result; a changed payload under the same key fails explicitly. External recognition precedes this transaction and cannot create inventory by itself.

For deliberately independent items, use a stable batch and per-item key, with explicit SUCCESS / REVIEW_REQUIRED / FAILED outcomes. An all-or-nothing Chaos commit must not silently become partial. Optional wishlist/trade updates must not turn inventory success into a retry of the entire receipt.

## 6. Intelligence/provenance changes

Not implemented because work stopped. Required work remains: eliminate synthesized demand/opportunity/sparklines from business metrics; keep observation, calculation and estimation distinct; do not convert missing fees/prices into observed zero. `market-engine/helpers.ts` and fallback consumers need a field-level availability contract, not only a page-wide “live” label. Store evidence/time/inputs for calculations. No new recommendation features are authorized.

## 7. Buylist uncertainty behavior

Not changed. Existing missing finish/language/condition defaults remain a known defect in `buylist.ts` and buylist import/UI. Proposed behavior: unknown values require review, explicit provider conflicts remain unresolved, exact printing does not imply physical finish or condition, and financial matching requires sufficiently confirmed identity. Share existing CanonicalPrinting normalization/ranking rather than introduce a competing identity system.

## 8. Acquisition event semantics

Proposed mapping only; no enum/history rewrite:

| Meaning | Quantity | Acquisition / age | Financial / location effect |
|---|---|---|---|
| ACQUIRED | May coincide with receipt; avoid double count | Only confirmed purchase/link evidence starts acquisition cohort | Preserve paid amount and allocated cost |
| RECEIVED | Positive receipt | Link to acquisition; must not count purchase twice | Record physical arrival/location |
| QUANTITY_ADJUSTED | Signed correction | Not acquisition without purchase evidence | Explicit correction; do not invent spend |
| CONDITION_CORRECTED | Unchanged | No new acquisition/age reset | May change valuation; preserve paid cost |
| LOCATION_CHANGED | Total unchanged | No new acquisition/age reset | Auditable movement |
| PRICE_CHANGED / note edit | Unchanged | No new acquisition/age reset | Changes asking/valuation data, not acquisition cost |
| LISTED | Total unchanged; allocation may change | No acquisition | Reserve exact available stock |
| SOLD | Negative | End sold-unit holding period | Realized margin from actual sale/cost/fees |
| RETURNED | Depends on restock decision | Original acquisition lineage retained | Reverse sale/cost effects explicitly |
| REMOVED | Negative | Not new acquisition | Preserve history; disposition reason |

Existing inventory_created/imported/quantity_added events alone do not prove a financial purchase. Historical ambiguous rows must remain unknown for acquired-dollar and age reporting. A final mapping requires the financial-authority decision above.

## 9. Scanner capability matrix

Source evidence, not a physical certification:

| Capability | Main native 1.3.1 | Private Phase 1 native (`3269e252`) | Web/cloud | Mobile |
|---|---|---|---|---|
| Camera capture | WIA acquisition, not browser camera | Same hardware scope | Purchasing camera/upload components | Camera/native vision components |
| Rapid / batch capture | ScanSnap Inbox / acquisition | Inbox with recovery additions | Cloud Chaos 100 kept captures | Scanner/replay flows; equivalent Chaos lifecycle not proven |
| OCR / visual matching | Not native agent responsibility | Not native agent responsibility | Recognition provider + catalog resolution | Native/provider signal paths; parity not proven |
| Exact printing | Delegated to cloud/UI | Delegated to cloud/UI | Candidate ranking + confirmation | Server identity validation before inventory save |
| Finish / language / condition | Not determined by agent | Not determined by agent | Candidate/review metadata; defaults need audit | Confirmation/validation; parity audit incomplete |
| Confidence/manual review | No business confidence authority | Same | Ranking and review | Candidate confirmation |
| Offline handling | In-memory capture jobs | Encrypted recovery store/journal | Browser pairing/recovery state | Offline queue + replay |
| Inventory validation/mutation | No direct inventory ownership | No direct inventory ownership | Authenticated commands / RPCs | Validation then inventory RPC + separate follow-ups |
| Location assignment | No business authority | No business authority | Cloud batch destination | Confirmation payload, server checks |
| Error recovery | Lifecycle fix; no full private durable feature set | Durable journal, permit and ack additions | Capability negotiation and recovery UI | Queue/retry classification |

## 10. Scanner parity changes

None implemented. The source diff is 18 native files (396 additions / 122 deletions). It includes CaptureAuthorization, RecoveryStore, EncryptedRecoveryStore and recovery tests, but also removes main's AgentLifecycle file and changes restart tests when viewed as a straight tree replacement. Therefore **do not replace main with the private tree**: port recovery/authorization intentionally while preserving the accepted lifecycle repair.

One recognition/inventory contract should normalize acquisition signals → exact candidate resolution → confirmation → authorized mutation. Native hardware providers retain their acquisition capabilities; acceptance uses the same deployed recognition and inventory validation contract. Version/capability/build metadata must distinguish artifacts. This is a parity task, not approval for TWAIN, public installers or hardware certification.

## 11. Tests added

None; no runtime repair was made before the stop condition. Required executable regressions after the authority decision:

- Failure after identity resolution, inventory insert, acquisition/link persistence, location assignment and event insert leaves no invalid partial receipt.
- Stable-key retry after lost response creates one stock/purchase/event effect; changed payload under the same key is rejected.
- One failed independently processed card returns explicit failure without hiding other outcomes; atomic batches roll back together.
- Authenticated completion succeeds under real privileges while direct purchase writes, cross-tenant and nondelegated writes remain denied.
- Concurrent draft saves preserve line IDs or report a revision conflict.
- Unknown finish/language/condition and conflicting printing/provider evidence cannot auto-value.
- Edit/move/reprice/correction does not inflate acquisition; purchase-linked additions do.
- Main/private shared scanner contract and lifecycle survive recovery port; hardware gates remain separate.

## 12. Validation results

This turn: source/reference tracing, read-only local recovery catalog inspection, main/private native diff. No production endpoint invoked. No database mutation/replay, E2E, physical scan or installation performed.

Previously measured audit baseline: root 1,014 passing, mobile 580 passing. These are historical baseline results, not new Phase 1 validation. TypeScript/lint/build/DB/scanner/E2E Phase 1 gates are **NOT RUN / NOT SATISFIED** because implementation stopped. Source-string tests for the collection migration did not establish executable purchase completion; add real-role DB tests.

## 13. Remaining limitations

All five approved integrity repairs remain open. Current production schema freshness has not been revalidated in this turn. No assumption is made that the recovery target is identical to current production. No proof is claimed that a customer experienced the newly found privilege failure. The conflict is established in the repository contract and observed recovery schema.

## 14. Manual QA still required

After a reviewed, rehearsed implementation: real owner/two-workspace receipt, failure/retry, buylist uncertainty, acquisition reporting, scanner restart/recovery and physical capture on a private acceptance path. No inventory commit merely to prove scanning; production financial tests require a separate controlled authorization.

## 15. Phase 2 recommendation

**NOT READY.** First review the recommendation to make the existing purchase ledger the sole financial acquisition authority, with collection intake retained as draft/review workflow. Then resume Phase 1A–1E implementation and all release gates. Passing existing unit tests would not resolve this authority conflict.

Production, inventory, CS-000023, POS/Square settings and hardware certification were not changed. No second acquisition system was built.

## PHASE 1 RELEASE CERTIFICATION

Certification date: 2026-09-25 UTC / 2026-09-24 Arizona. Scope: Phase 1G local certification and narrowly scoped integrity gates. No production migration, deployment, financial transaction, inventory mutation, POS/Square change or physical scanner activity.

### 1. Remaining-item disposition checklist

This checklist supersedes the earlier open-item narrative without erasing it. A documented limitation is not automatically a release blocker, but a BLOCKER cannot be waived by passing unit tests.

| ID | Previously open item | Disposition | Evidence / remaining work |
|---|---|---|---|
| G01 | Competing financial ledgers / unusable invoker permission model | FIXED | Phase 1F finalizer and compatibility delegate write existing purchase ledger; real authenticated receipt passes. |
| G02 | Atomic draft save, stable lines, stale revisions | PASS | Browser save/reload and DB revision/rollback checks. |
| G03 | Real authenticated intake → purchase → receipt | PASS | Real Next app, GoTrue, PostgREST, capability resolution and existing database triggers; no mocked user/RPC. |
| G04 | Retry after completion, double submission/refresh | PASS | Real Complete purchase button/confirmation/double-click; API concurrent submissions and refresh retry retain one purchase/receipt. |
| G05 | Generic header-then-lines purchase service | FIXED | Permanent application gate before any insert, plus authenticated direct ledger DML revoked by new forward migration. |
| G06 | Purchasing lookup existing-stock quantity then metadata update | FIXED | Inventory-producing lookup actions gated before either mutation; read lookup/wishlist remain available. |
| G07 | Card-show purchase / bulk-purchase CSV snapshot finalization | FIXED | Purchase/import actions gated before stock writes; optional bulk_purchases DML revoked. Historical data preserved. |
| G08 | Inventory edits overwrite linked acquisition cost | FIXED | Trigger rejects linked cost/provenance changes; authenticated condition/storage/notes/market/list-price edits pass. |
| G09 | Acquisition metrics from inventory timestamps | FIXED | Ledger financial/receipt cohorts; real analytics page unchanged by edits. |
| G10 | Bounded Purchase History summaries | DOCUMENTED LIMITATION | Latest 250 accessible records; visible scope notice added. Not all-history accounting. |
| G11 | Unknown historical purchase dates and provenance | FIXED | Missing date stays empty, not today. Unlinked inventory excluded from financial acquisitions; no backfill. |
| G12 | Fees, taxes, shipping, alternate collection allocation | DOCUMENTED LIMITATION | No verified detailed breakdown; existing saved-value proportional allocation only. No new accounting policy invented. |
| G13 | Deferred receipt, partial shipments and reversal UI | DOCUMENTED LIMITATION | Full later receipt supported/tested through authenticated API; UI remains immediate receipt. Partial receipt/reversal not implemented. |
| G14 | Current full-schema/workspace interaction | PASS | Recovery clone plus schema-only copy into dedicated local Supabase Auth stack. Live schema freshness remains a production preflight, not assumed. |
| G15 | Anonymous / other user / same-owner other-workspace isolation | PASS | Actual Auth/PostgREST and application API tests; manager may receive their own intake in shared workspace, not owner intake. |
| G16 | Exact identity/financial value validation | PASS | Unknown metadata blocks finalization; invalid amount, invalid location, stale/finalized intake and one-invalid-line rollbacks tested. Catalog correctness remains human-reviewed, not inferred from IDs alone. |
| G17 | Synthesized demand/opportunity/sparklines and missing fee provenance (Phase 1B) | BLOCKER | `src/lib/market-engine/helpers.ts` still constructs deterministic demand/sparkline signals. Field-level observed/calculated/estimated/unknown treatment remains unimplemented. |
| G18 | Buylist unknown physical attributes / provider conflicts (Phase 1C) | BLOCKER | `src/lib/buylist.ts` still substitutes nonfoil/English/NM for absent attributes when matching. Needs review-first behavior and conflict regressions. |
| G19 | Mobile save/replay optional follow-up failure and snapshot partial writes (Phase 1A) | BLOCKER | Current scanner save/replay can perform stock then separate follow-ups. Financial ledger is not invoked, but physical idempotency/partial-success semantics still need the previously scoped repair. |
| G20 | Main/private scanner contract parity and lifecycle-safe recovery port (Phase 1E) | BLOCKER | Earlier native diff includes lifecycle replacement risk; no parity port or physical certification in this task. Do not replace main with the private tree. |
| G21 | Generic CSV/manual inventory snapshots | DOCUMENTED LIMITATION | Physical inventory import, not a financial acquisition. No inferred purchase. Chunked import atomicity is not represented as atomic purchase completion. |
| G22 | Physical scanner acceptance / hardware claims | DOCUMENTED LIMITATION | PENDING; no physical test or certification change. Does not become PASS through database tests. |
| G23 | Default Turbopack worktree junction | DOCUMENTED LIMITATION | Local resolution boundary, supported by installed Next documentation; Webpack build passes. CI still uses default build and must run on a normal checkout before promotion. |
| G24 | Production preflight, release/rollback and post-deployment verification | DOCUMENTED LIMITATION | MANUAL REQUIRED in readiness matrix; not authorized or performed during this local certification. |

No unresolved integrity issue was relabeled DEFERRED TO PHASE 2 to manufacture completion. Phase 2 remains blocked by G17–G20.

### 2. Authenticated browser acceptance

Harness: `tests/acquisition-auth-setup.mjs` and `tests/acquisition-auth-browser.mjs`. Dedicated local Supabase project `td-phase1g-auth-20260924`, API `127.0.0.1:55321`, Next development app `127.0.0.1:4331`. Schema-only recovery copy; no production users, inventory, credentials or sessions copied. Synthetic users sign in through the real `/sign-in` form and GoTrue. Application code, SSR cookies, capability checks, `/api/collection-intake`, financial RPC, PostgREST and RLS are real.

Test setup omits platform-managed ALTER DEFAULT PRIVILEGES statements that the local postgres role cannot execute; explicit application grants/policies are restored. Only the Playwright context bypasses production CSP to allow its loopback Auth URL; application authorization is not bypassed. No hosted authentication claim is made. Agent-browser CLI was unavailable; existing Playwright infrastructure was used. Screenshots/results stay in the private temporary directory, not Git.

Passing sequence:

1. Sign in, create reviewed draft in Collection Buying, save and reload. Zero financial purchases and zero owned stock.
2. Authenticated completion API with `receiveNow=false`: one $4 commitment, no stock or receipt event.
3. Receive the same purchase: one stock row, two units, one receipt event and link. Stable-key retries, reload retry and repeated requests retain the same purchase ID/value.
4. Analytics renders `Financial purchases: 1` and `Agreed acquisition cost: $4.00` from real data.
5. Authenticated condition correction, storage move, notes, market value and asking-price edits. Purchase count/value remain unchanged; acquisition cost overwrite is denied.
6. Switch the same owner to a different workspace: original private purchase SELECT returns no rows and finalization is denied. Restore context. Unrelated authenticated user and anonymous caller denied.
7. Client-supplied foreign user and malformed workspace on draft save cannot override database actor/current workspace. Two simultaneous API finalizations return one new purchase.
8. Real New intake → Complete purchase button → confirmation → double-click: exactly one additional $2 single-card purchase. Owner cohort finishes at three purchases / $7 / three stock rows / four units.
9. A manager in the shared workspace successfully receives their **own** intake and cannot finalize the owner's intake. This preserves the existing partner-owner inventory model; it is not staff delegation over owner stock.

No physical inventory was committed outside the disposable local stack. The first harness iteration used an unsupported `location` mutation name; it was corrected to the existing `storage` command. A transient saved toast was replaced by authoritative response/state assertions because reload/recovery can replace the toast. These were test-harness corrections, not production fixes.

### 3. Legacy acquisition-path audit

Search covered tracked web/server/mobile source, SQL migrations/triggers, scanner C#, import/CSV/bulk consumers, POS/provider integrations, jobs and tests. Historical mobile backup trees remain snapshots, not active application entry points. No Supabase Edge Functions directory exists in this checkout. A path being present in an old migration is not proof it is the effective installed function.

| Path/category | Classification | Certification behavior |
|---|---|---|
| Intake server/API → finalize_intake_purchase | AUTHORITATIVE | Only approved purchase finalization and receipt writer. |
| complete_collection_intake compatibility RPC | COMPATIBILITY PATH | Delegates to the same finalizer; does not write collection_purchases. |
| createPurchaseLedgerRecord / purchase-history POST / bulk calculator/product purchase payload | LEGACY UNSAFE | Gated in service before header insert; API returns 409 with Collection Intake guidance. Database blocks direct authenticated ledger DML. |
| CardShowsWorkspace.finalizePurchase | LEGACY UNSAFE | Gated before snapshot stock creation. Cart/history not deleted. |
| BulkPurchasesWorkspace creation/import | LEGACY UNSAFE | Gated before purchase/stock writes; existing historical reads remain. Optional table DML revoked. |
| Purchasing product-lookup stock upsert and binder/trade follow-up | LEGACY UNSAFE | Inventory-producing actions return gate before any stock action. Lookup and wishlist paths do not represent acquisitions. |
| collection-buying/[id] legacy collection_purchases reader | COMPATIBILITY PATH | Historical read path only; not a new writer or authoritative acquisition aggregate. |
| Inventory manual edits / CSV / marketplace imports / persistInventorySnapshotDiff | NOT AN ACQUISITION | Physical inventory operations or user-reported historical metadata. No ledger write; never counted as financial purchases. Linked cost fields now protected. |
| Mobile scanner-data.ts / scanner-replay.ts | NOT AN ACQUISITION | A: inventory-only. Existing owned/manual import or ambiguous provenance; stock creation alone is not acquisition proof. Separate physical retry blocker G19 remains. |
| Mobile collector-mutation-data.ts / storage-location-data.ts | NOT AN ACQUISITION | Quantity/condition/finish/storage commands; do not create financial headers. |
| Chaos cloud commit/capture and native Scanner Bridge | NOT AN ACQUISITION | Physical capture/import and cloud stock commit; no forced purchase entry. Native agent owns no financial business state. |
| POS sales/refunds / Square / marketplace sales and returns | NOT AN ACQUISITION | Sales and physical restoration are not fresh purchases. No workflow or provider enablement changed. |
| RevenueCat/Stripe subscriptions and background billing jobs | NOT AN ACQUISITION | Product subscription purchases, not trading-card acquisition. No ledger bridge introduced. |
| Inventory cost resolvers / card workspace / selling candidate views | COMPATIBILITY PATH | Read stored cost metadata; not proof of purchase lineage. Market/list/sale price must not substitute for missing financial acquisition cost. |
| Dashboard financial acquisition summary | AUTHORITATIVE | Purchase ledger only; receipt date cohort separate. |

Forward migration `20260925002945_acquisition_legacy_write_gate.sql` follows Phase 1F. It revokes unsafe direct writes, narrows purchase reads to current workspace, and guards acquisition-linked cost/provenance fields during inventory updates. It does not modify historical rows, backfill links, change POS/Square or replay applied migrations. Promotion would intentionally pause the gated legacy actions and requires release review.

### 4. Purchase ledger invariants

| Invariant | Evidence | Result |
|---|---|---|
| Intake without purchase | Draft/rejected SQL and browser reload | PASS |
| Stock edit is not purchase | Authenticated edits + stable ledger totals | PASS |
| Receipt cannot duplicate finance | Deferred receipt + retries | PASS |
| Acquisitions derive from ledger | Real analytics page and pure summary tests | PASS |
| Market cannot overwrite linked acquisition cost | Allowed market/asking updates; rejected cost overwrite | PASS |
| Retry cannot duplicate purchase or receipt | Locked finalizer, concurrent API requests, UI double-click | PASS |
| No private purchase read/write across workspace | Same-owner second workspace and unrelated user tests | PASS |
| Location does not change acquisition history | Actual storage RPC + unchanged reporting | PASS |
| Condition does not change acquisition history | Actual condition RPC + unchanged reporting | PASS |
| Unknown history cannot become known by default | Missing date regression; no inventory-to-ledger backfill | PASS |

### 5. Cost provenance and history

Single-card UI purchase, quantity-two exact printing and multi-card SQL collection all pass. Multi-card allocation sums to the agreed total and keeps distinct line/inventory identities. Unreviewed identity and unpriced paid allocations are blocked by the existing finalizer. Acquisition unit/total cost lives in purchase lines and receipt lineage; market value and asking/list price can change independently. Sale price is NOT APPLICABLE: no sale/POS action was exercised. No profit or fee calculation was certified by these tests.

Historical ledger records with valid original financial metadata can be displayed as recorded purchases. Existing inventory-only metadata is user-reported historical cost, not independently verified purchase provenance. Missing dates remain unknown; unknown-workspace financial records are excluded from current-workspace private reads rather than attributed by guessing. Future backfill requires source documents/ledger evidence, explicit mapping and review. Records without that evidence intentionally remain unattributed.

### 6. Failure, rollback and security

`tests/acquisition-authority-db.mjs`: **21 checks per variant / 42 total** (with and without legacy intake proposal). Actual Postgres roles execute functions; injected purchase/header, line, inventory, event and link failures roll back. Invalid money, identity, location, stale revisions and finalized edits are rejected. Failed later receipt preserves the earlier valid commitment. Replay over populated data preserves snapshots. New gate replay, direct-write denial, linked cost protection and multi-card allocation pass.

Prior production-shaped recovery-clone proof is retained; Phase 1G additionally runs the real Auth application against its schema-only counterpart and synthetic data. Service credentials are setup-only and never given to the browser. RLS/tenant checks execute using authenticated user sessions. Recovery dumps and private local runtime keys remain outside Git.

### 7. Production readiness matrix

| Area / check | Status | Qualification |
|---|---|---|
| Database migrations/replay | PASS | Both local starting variants; schema-first production application not performed. |
| Database constraints / RLS | PASS | Authenticated and negative checks; no broader grants. |
| Database transactionality / idempotency | PASS | Failure injection, receipt separation, concurrency. |
| Server authorization / validation | PASS | Real capability checks and DB owner/current workspace checks. |
| Server failure handling / structured errors | PASS | Atomic errors; 400/403/409 and gated legacy message. |
| Web authenticated intake / retry | PASS | Actual screen and API, real login. |
| Web loading / error / success | PASS | Save response/reload, success, permission errors and gate; no forced finance success. |
| Mobile acquisition nonregression | PASS | 580 tests; no financial ledger writes introduced. |
| Mobile domain semantics | PASS | Inventory-only is not financial acquisition. |
| Mobile physical retry safety / scanner parity | FAIL | G19/G20 remain. |
| Analytics ledger / no edit inflation | PASS | Live local page after edits. |
| Analytics unknown history | PASS | Unknown date preserved; unlinked stock excluded from finance. |
| Intelligence provenance / buylist uncertainty | FAIL | G17/G18 remain. |
| Security tenant / owner enforcement | PASS | Actual authenticated API/PostgREST plus negative DB checks. |
| Security secret exposure | PASS | 13 changed/new text files and 355 browser bundles audited; zero findings, valid UTF-8. No private fixtures/artifacts committed. |
| Testing root | PASS | 1,026 tests (baseline retained). |
| Testing mobile | PASS | 580 tests. |
| Testing database / E2E / recovery shape | PASS | Evidence above; local only. |
| Testing production build | PASS | Optimized Webpack build, TypeScript, page generation and traces passed. Normal-checkout default-build CI still required for promotion. |
| Hosted production smoke / migration readiness | MANUAL REQUIRED | Production remains untouched. |
| Physical scanner / POS / Square testing | NOT APPLICABLE | No enablement or certification changes in Phase 1G. |

### 8. Turbopack determination

**LOCAL ENVIRONMENT ONLY for the observed failure.** The error identifies the node_modules junction pointing outside the worktree root. Installed Next 16 documentation (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md`, Root directory) explicitly excludes linked dependencies outside that root unless a common root is configured. No broad root expansion into personal folders or dependency rewrite was performed.

Webpack is a passing local production-build cross-check, **not established as the deployed build strategy**. `package.json` uses `next build`; `.github/workflows/quality.yml` uses `npm run build`; no Vercel build-command override was inspected or changed. A normal-checkout CI build remains a promotion requirement. The local junction failure alone is not a production application defect.

### 9. Final decision and next gate

**PHASE 1 INCOMPLETE.** Authenticated acquisition/receipt authority is now demonstrated and unsafe legacy financial entry points are gated locally. G17 (intelligence provenance), G18 (buylist uncertainty), G19 (mobile/physical retry) and G20 (scanner parity) remain substantive blockers from the accepted Phase 1 scope. They are not waived or moved to Phase 2.

## PHASE 1H — TRUST / RETRY / SCANNER CONVERGENCE

### Decision and stop condition

**PHASE 1 INCOMPLETE.** Local trust changes and diagnostic evidence only. No schema migration, production mutation, deployment, hardware operation, POS/Square change or Phase 2 work occurred.

The current instruction requires: **“If another architectural conflict appears, STOP and document it. Do not create parallel systems to bypass the conflict.”** The mobile retry audit found a shared-queue ownership conflict, H01, that prevents scanner-only durable recovery. Implementation stopped when this was established. Validation of already-made changes continued; the stop is not a claim that the four blockers are resolved.

### H01: competing writers can erase durable offline work

`mobile/services/storage/offline.ts` stores all operation types in one `td-offline-operation-queue-v1` JSON array. Enqueue is read/modify/write. Scanner replay snapshots this array, awaits authentication/validation/network writes, then replaces the entire queue using the stale snapshot. Scanner discard also replaces a snapshot. Collector edits, storage moves and trade/wishlist replay independently use the same replacement API. There is no queue revision, atomic per-operation acknowledgement, claim/lease, or common replay ownership.

**Reproduced with synthetic fixtures:** start scanner operation A; enqueue B while A waits for its insert response; A succeeds and replaces the queue with its original remaining list; B disappears without being attempted. `tests/phase1h-offline-evidence.mjs` invokes the actual replay function with controlled persistence/network dependencies. Output is `DEFECT_REPRODUCED`, not a passing retry-safety test. No network, real user, database or device storage is used. This proves the algorithmic race, not an assertion that a specific production scan was lost.

Other paths that can overwrite or resurrect work: `collector-mutation-data.ts`, `storage-location-data.ts`, `trade-binder-wishlist-data.ts`, plus concurrent scanner retry triggers in `scanner-replay-bridge.tsx`, scanner recovery and automatic scanner screens. A per-screen busy flag does not establish shared queue ownership.

**Required architectural continuation:** evolve the existing queue into one versioned, serialized operation journal used by every enqueue/replay/discard consumer; acknowledge/update only the claimed operation, preserve operations appended during network waits, and prevent stale workers from overwriting terminal state. Persist operation identity before any network mutation. Migrate existing queued operations without discarding or guessing whether uncertain requests committed. Pair this with server-side operation/payload identity and transactional stock/event/location outcomes through the existing inventory writer. This is a shared storage/replay change, not a second scanner queue or a second inventory ledger. Do not ship a scanner-only acknowledgement workaround while whole-queue replacement writers remain.

### Intelligence provenance changes — partially implemented

- Added `intelligence-provenance.ts`: value/status/source/input/time/confidence/explanation metadata. Synthetic, unsourced, invalid and unavailable values are suppressed at this boundary; no default confidence or observation timestamp is invented.
- `market-engine/helpers.ts` no longer synthesizes demand/opportunity scores, percentage changes, low quotes or sparklines from hashes/indexes. No inferred buy/sell signal remains there.
- The public market feed has no authenticated owner inventory query. Seeded owned quantities and projected revenue now return null, not invented personal holdings.
- Real provider quotes retain source/printing provenance and explicitly unknown observation time. Static reference/fallback prices return insufficient data. The Pokémon adapter no longer substitutes its seed price for a missing provider quote.
- Both Market Center components use the shared nullable contract and display unavailable/insufficient states without treating null as a zero price or percentage.

**Still open:** this is not an exhaustive provenance conversion. `dashboard/home/MarketPulse.tsx` still has static changes/sparklines and derived previous prices; card ranking scores still need field-level calculation provenance; other intelligence/recommendation/API paths and landing demo isolation require the full requested audit. Clearly labeled marketing simulations are not evidence of real market conditions. G17 remains open.

### Buylist uncertainty changes — partially implemented

- `card-intelligence/resolution.ts` provides explicit resolution states and physical-attribute review reasons. Only `CONFIRMED` yields `canFinalize`; catalog identity does not establish physical condition/finish/language.
- Exact buylist matching no longer substitutes nonfoil/English/NM. Blank, unknown, unrecorded and conflicting inputs require review. Matching provider IDs no longer override conflicting set/collector values. Candidate multiplicity, supplied provider conflicts and variant ambiguity block automation.
- CSV import and display no longer invent those attributes. MTGJSON matching requires known physical attributes, scopes name/number lookup by set, rejects explicit provider-ID fallback and collector/set conflicts. Finish matching recognizes nonfoil explicitly instead of treating the substring “foil” in “nonfoil” as foil.

**Still open:** end-to-end import/provider ambiguity evidence, legacy already-defaulted offers without original observations, and all scanner consumers are not certified. In particular mobile continuous scanning still defaults absent condition to near-mint and can substitute normal finish; these were identified after the local buylist slice and remain unchanged at the architectural stop. Existing `rankCandidate` provider-ID matching also accepts any matching known provider ID rather than requiring agreement across supplied identities. G18 remains open; unit fixtures are not proof all provider paths are safe.

### Retry / idempotency findings — not implemented

Online `saveScannerConfirmation` generates a new inventory ID for each invocation. Its key differs from replay's `scanner-replay:<item>` key. Replay checks item existence before insert and treats broad duplicate/unique errors as success; that is not payload-verified operation deduplication. Trade and wishlist actions occur after stock creation; wishlist insertion has a separate queued lifetime. Storage moves generate a new timestamp key during replay. Session finalization loops reviewed collection lines without durable per-line acknowledgement before continuing.

The existing purchase finalizer's tested financial idempotency does not fix these mobile physical paths. H01 must be resolved through the shared queue first; then server-side keys, payload conflicts, lost responses, quantity/cost/history and duplicate movement must be proved with actual database concurrency tests. No new idempotency table/RPC or alternative authority was introduced in this step.

### Scanner capability matrix — source audit, not certification

No new private mobile artifact was supplied or built in Phase 1H. “Private acceptance” below refers to the retained Windows native candidate `3269e252`, not an assumed equivalent mobile release. Main mobile is the active `mobile/` tree. Browser/cloud behavior is distinct from hardware acquisition.

| Capability | Main mobile | Private Windows candidate | Web / cloud | Main Windows 1.3.1 | Fallback |
|---|---|---|---|---|---|
| Camera capture | Expo/native vision paths | WIA / ScanSnap acquisition | Image upload/camera inputs | WIA / ScanSnap | Manual lookup/upload |
| Rapid scan | Continuous scanner | Inbox capture | Live scanner intake | Inbox capture | Manual pacing |
| OCR | Native/provider signals | Cloud responsibility | Provider pipeline | Cloud responsibility | Manual correction |
| Visual recognition | Native/index/provider paths | Cloud responsibility | Provider pipeline | Cloud responsibility | No invented recognition |
| Exact printing | Candidate then server validation | Delegated to website | Canonical catalog ranking | Delegated to website | Explicit selection |
| Finish | Observation/review; unsafe defaults still present | Not hardware authority | Confirmation required; audit open | Not hardware authority | Human confirmation |
| Language | Catalog/confirmation; not fully converged | Not hardware authority | Candidate/review metadata | Not hardware authority | Unknown preserved where implemented |
| Confidence | Separate native confidence model | No business score | Canonical ranking model | No business score | Shared semantics not proved |
| Manual review | Session review | Website | Cloud review | Website | Manual selection |
| Batch mode | Local session lines | Active capture binding | Cloud 100 active capture contract | Active session | Upload/CSV |
| Offline mode | Shared JSON queue, H01 | Encrypted pending journal | Recovery UI/cloud acknowledgement | In-memory jobs | Manual retry |
| Retry safety | BLOCKED H01/G19 | No new parity proof | Separate capture protocol | Lifecycle repair retained | Not equivalent |
| Inventory validation | Server printing validation | None directly | Authorized commands | None directly | Must use same validation |
| Inventory mutation | Inventory RPC plus follow-ups | None directly | Authoritative cloud writer | None directly | No separate authority approved |
| Location assignment | Payload + separate move RPC | No location authority | Cloud batch destination | No location authority | Human selects destination |
| Error recovery | Queue classification; race remains | Journal/permit/ack additions | Recovery controls | Lifecycle fix | Review/manual retry |
| Provider fallback | Cached/manual candidates | Hardware capabilities only | Configured providers | Hardware capabilities only | No substitute confidence certified |
| Diagnostics | Fragmented | Recovery diagnostics | Request/provider diagnostics | Lifecycle logs | Unified safe event contract pending |

### Parity, recovery and observability

No native capability was removed. No private tree was copied over main. The native difference still includes removal of `AgentLifecycle.cs`; recovery additions require a selective lifecycle-preserving port, not tree replacement. Same-fixture recognition parity is unproved.

Recovery classification remains a required implementation, not a new unused wrapper: permission/capture/OCR/provider failures must expose retry/review without claiming a save; conflicts/low confidence/unsupported identity require review; unknown commit outcomes need durable reconciliation; confirmed DB commit must be distinguishable from pending optional follow-ups. A timeout must not be labeled `FAILED_WITHOUT_MUTATION` without evidence. H01 currently prevents trustworthy pending/offline state. Existing mobile errors remain; no claim of unified recovery completion.

No new production diagnostics were added after the stop. The synthetic reproduction reports operation categories only and emits no tokens, customer data or raw recognition payloads. Operation/session identity, normalized provider/resolution/confidence, replay attempt and separate inventory/location outcomes still need wiring into the eventual shared journal and existing telemetry, with explicit redaction.

### Added tests and acceptance scope

`tests/acquisition-trust.test.ts`: 12 passing focused tests covering explicit confirmed match; foil ambiguity; unknown condition/language; multiple printings; collector/provider/set/variant conflict; name-only/blank offer rejection; synthetic/unsourced suppression; absence of generated market metrics and invented owner exposure. These are domain tests, not financial end-to-end certification.

`tests/phase1h-offline-evidence.mjs`: deterministic queue-loss reproduction, **known failure evidence, not a safety PASS**.

| Requested acceptance | Phase 1H result |
|---|---|
| A unknown attributes | Buylist domain cases pass; scanner end-to-end still blocked |
| B duplicate retry | Not certified; G19/H01 remain |
| C offline commit race | Queue-loss defect reproduced; actual DB committed-timeout acceptance still required |
| D provider failure | Market fallback suppression tested; full scanner fallback pending |
| E low confidence | Existing policy not newly certified |
| F post-scan mutation failure | H01 prevents reliable recovery certification |
| G main/private fixture parity | Not run; no shared parity port yet |

Local validation completed:

| Check | Result |
|---|---|
| Root suite | PASS, 1,038 tests (baseline 1,026 plus 12 trust tests) |
| Mobile suite | PASS, 580 tests; unchanged mobile implementation |
| Real acquisition DB variants | PASS, 21 minimal + 21 legacy-intake checks |
| Authenticated acceptance | PASS, real local GoTrue / Next / PostgREST / RLS: draft, financial commitment, receipt, duplicates, edits, cost protection, owner/workspace/anonymous isolation and actual purchase button |
| TypeScript / ESLint | PASS, zero errors; existing warnings remain |
| Webpack production build | PASS, `npx next build --webpack` |
| Dependency audit | PASS, zero vulnerabilities from `npm run check` |
| Secret/artifact audit | No matches across 18 changed/generated files and 355 static assets; high-signal key/credential patterns and sensitive artifact paths checked. Generated agent/types/cache files subsequently excluded. This is a scoped scan, not proof all possible secrets are absent. |
| Diff whitespace | PASS |
| Offline loss reproduction | DEFECT REPRODUCED; not counted as a retry acceptance PASS |
| Physical scanner / same-fixture private parity | NOT RUN at architectural stop |

Private logs: `%TEMP%/td-phase1h-{check,mobile,db,db-legacy,browser,build}.log`. Existing local acceptance project `td-phase1g-auth-20260924` was restarted for the browser run and stopped afterwards with its fixture volumes preserved; no hosted project or production data was used. No secrets or raw customer payloads were added to Git. The known local Turbopack dependency-junction issue was not rerun or addressed with dependency churn; Webpack success is not a claim about production CI/deployment strategy.

Passing baseline acquisition tests does not override the scanner stop or complete requested scanner scenarios A–G.

### Exact remaining blockers and final decision

- **G17:** complete provenance inventory and every production consumer; this step fixes the multi-game normalization boundary only.
- **G18:** converge physical-attribute policy across imports/catalog/scanner, resolve provider disagreement, and prove full unknown-attribute flow.
- **H01 / G19:** establish one shared queue ownership/acknowledgement contract across all existing writers, then durable operation identity and transactional server retry proof.
- **G20:** lifecycle-preserving native recovery convergence and actual same-fixture main/acceptance parity; no physical acceptance claimed.

**PHASE 1 INCOMPLETE. Phase 2 is not ready.** Resume implementation only after the H01 architectural stop is reviewed. Keep the existing cloud inventory and purchase authorities; do not add a competing queue or ledger.

## PHASE 1I — SHARED OFFLINE QUEUE CONCURRENCY REPAIR

The owner's Phase 1I approval supersedes the H01 stop above. The existing queue abstraction was repaired locally; no second queue, new schema, production change, scanner feature or UI redesign was introduced. The historical Phase 1H reproduction is retained in Git history and now asserts the repaired result.

### 1. Root cause and complete shared-queue audit

Native storage is AsyncStorage; Expo web uses localStorage via `app-storage.ts`. One JSON array lives at `td-offline-operation-queue-v1`. The original operation held `id`, `type`, `payload`, `userId`, `dedupeKey`, `createdAt`, optional error fields. There was no shared lock, revision or item claim. Malformed JSON previously looked like an empty queue. Enqueue, replay, discard and the unused clear/replace exports could overwrite an entire persisted snapshot.

| Consumer | Enqueue / replay / removal | Current treatment |
|---|---|---|
| `scanner-data.ts` | Queue offline/failed scanner confirmation | Stable inventory ID used as explicit queue operation ID; ancillary uncertain workflows held for review |
| `scanner-replay.ts` | List, retry one/all, discard | Claim exact operation; item-only completion/failure; owner/type-scoped discard |
| `collector-mutation-data.ts` | Offline/failed inventory edits, retry export | Shared claim coordinator; uncertain replies require review |
| `storage-location-data.ts` | Failed storage assignment, retry export | Shared claim coordinator; replay key derives from claimed ID, not current timestamp |
| `trade-binder-wishlist-data.ts` | Offline/failed trade/wishlist changes, retry export | Shared claim coordinator; uncertain replies require review |
| `scanner-replay-bridge.tsx` | Auth session restoration, auth change, app foreground, browser online | Calls the same replay service; local busy flag remains only a UX optimization |
| `scanner-recovery.tsx`, `automatic-scanner-screen.tsx` | Manual retries / discard / scanner workflow | Same coordinator; no separate component-level authority |

No native headless/background task registration was found for this queue. The non-scanner retry functions are exported but no automatic startup/reconnect call sites were found in the active app. They were still migrated because they share persistence and may be invoked later. Pure `addOfflineOperation` / `discardQueuedScannerAddFromQueue` helpers remain for in-memory calculations/tests only; neither is a persistent replacement API. There are no `replaceOfflineQueue`, `replaceQueue`, or `clearOfflineQueue` callers/exports remaining in runtime services.

The original lost-item schedule was not scanner-specific: any delayed snapshot replacement could erase newer cross-type work or resurrect entries another worker completed. The reproduction now ends with `[B]`, not `[]`.

### 2. New concurrency model

`offline-core.ts` supplies the queue implementation; `offline.ts` supplies its platform storage and lock adapter. They operate on the same existing storage key. A shared storage critical section reloads the latest durable state and changes only the target operation. Network requests do not hold the global storage lock.

Replay takes an operation-specific lock, persists `processing` plus a unique claim token/attempt count, releases the storage lock, executes the request, then reloads current state and acknowledges only the matching claim. The per-operation lock covers the request, preventing overlapping handlers for A while permitting B to enqueue or complete. There is no unsafe timer-based lease expiry that can launch a second worker while the first still runs.

Native uses one globally retained coordinator/mutex in the current JS runtime, including module reloads. Web uses browser Web Locks for both storage and per-item locks across tabs. Web without locking support fails closed and preserves storage; it does not silently fall back to a tab-local mutex. SSR is not allowed to report a durable enqueue through a no-op storage write.

Success retains a terminal `committed` tombstone and removes only that item from the active list. Discard retains a terminal marker and refuses to discard an in-flight claim. Tombstones preserve explicit-operation deduplication. No pruning policy is invented in this phase.

### 3. Stable identity and server boundaries

Queue ID/payload remain immutable across retries, claim changes, app resume and restart. Re-enqueue with the same explicit ID returns the original record, including its claim or terminal state; a conflicting payload fails without replacing it. Pending dedupe keys are scoped by user and type. A new logical intent may use a new ID; content-based keys are not proof that two separate online intentions are the same operation.

For stock-only scanner replay, the same persisted inventory ID is used on every delivery. The existing database primary key prevents a second stock row with that ID. Recovery checks that owner's exact item before reapplying collection limits or inserting. An existing committed item is reconciled even if its receipt filled the free-plan limit. Broad duplicate/unique errors are no longer swallowed as successful writes.

**Actual database acceptance:** invoke the real scanner replay function with real PostgreSQL inventory/event creation, throw a simulated client timeout after SQL committed, then replay. Result: one stock row, quantity 2, one event, zero new purchases/links, one creation call, queue converges to committed. Both schema variants pass.

**Exact remaining gaps:** `create_inventory_item_with_event` is not a general operation/payload receipt protocol: item-ID uniqueness and reconciliation prove the tested same-ID path, not changed-payload retry correctness. Online `saveScannerConfirmation` still allocates an item ID per invocation; separate repeated online submissions/session finalization need durable intent creation before the first network request. Collector keys are still derived from target/content, wishlist inserts lack transactional operation deduplication, and optional trade/wishlist follow-ups are not one atomic stock transaction. These are G19 follow-ups, not silently certified by a mutex. No financial mutation was moved into this queue.

### 4. Multi-worker prevention, crash and poison behavior

| Situation | Behavior |
|---|---|
| B/C/D enqueue while A awaits server | Persist independently under shared storage lock; A completion keeps them |
| Two workers replay A | Same item lock; second sees terminal/blocked state and skips |
| B completes before A | Each completion checks its own claim; neither replaces the other's snapshot |
| Claim write fails | No server request starts |
| Server commits, reply lost | Retry-safe handler retains stable identity; stock-only DB acceptance proves no duplicate |
| Completion write fails | Persisted processing item remains; local success is not returned |
| App restarts with processing item | Browser locks release on termination; fresh native runtime has no live old worker. Retry-safe handler can reclaim; unsafe handler transitions to review |
| Unknown unsafe response | Retain `review_required`; do not automatically repeat wishlist/movement/ancillary writes |
| Legacy entry without status | Retain original ID/payload as review-required: prior server outcome is unknowable from the old format |
| Invalid individual row | Preserve raw local evidence as quarantined review record; valid neighbors still run |
| Invalid JSON/root format | Throw explicit recovery error, never turn it into an empty queue or overwrite it |
| Unsupported mutation payload | Retain failed/review state; do not claim a no-op was committed |

This phase deliberately does not add a reconciliation UI or guess the outcome of legacy operations. Warnings state when automatic replay is blocked. No historical queue item is silently dropped to obtain a passing test. A queue promise that fails persistence has not succeeded; shutdown acceptance models both claim and acknowledgement interruption, not a physical device reboot.

### 5. Structured diagnostics

The shared coordinator emits enqueue, duplicate enqueue, claim, replay start/success/failure, blocked/duplicate replay, restart recovery/review, and discard events with operation ID, type, attempts and queue depth. Payloads, user IDs, auth data and raw error messages are omitted. Diagnostic failures cannot fail a persisted operation. There is no fabricated `idempotent_server_response` flag: the existing scanner API does not return an authoritative replay receipt; its exact-record reconciliation is tested separately. A server receipt/response diagnostic remains part of the G19 protocol work.

### 6. Scanner parity follow-up

Rechecked the retained main/prior candidate and `3269e252`: both referenced the same **old** `mobile/services/storage/offline.ts` blob (`40fefbe746e9699c00e449cf51951d7d7ed61e9b`). The new local candidate changes that module and all active mobile replay consumers together. No build-specific mobile retry implementation was added.

| Path | Phase 1I queue/retry result |
|---|---|
| Active main-mobile source candidate | Shared repaired queue; 596 mobile tests, mobile TS/lint pass |
| Expo web queue | Same core; cross-tab Web Locks/localStorage test passes |
| Retained private acceptance revision | Still old code; not rebuilt/promoted. Cannot claim new semantics in that artifact |
| Windows Scanner Agent | Separate hardware-only encrypted capture journal is platform-specific; not a stock mutation queue. Unchanged, equivalence/lifecycle recovery acceptance still pending |
| Web Chaos cloud capture | Existing cloud acceptance authority unchanged; not rerouted into mobile offline queue |
| Camera/OCR/visual/exact printing/finish/language/confidence/manual review | Phase 1H matrix remains applicable; no capabilities removed or new parity certification claimed |

Old and new browser builds must not run concurrently against this queue during a future rollout: old writers do not participate in Web Locks. A coordinated client refresh/upgrade and pending-item review are release gates. Native multi-process/headless queue access would also require an inter-process transactional adapter; none exists in the audited runtime. These limitations are explicit, not evidence of current production readiness.

### 7. Regression and integration tests

- A/B/H: A in flight plus one, three or 50 new operations; every unique item remains.
- C: failed A updates only A and preserves B/its attempts.
- D: two coordinators share a claim; only one handler runs.
- E: simulated idempotent server plus real PostgreSQL scanner commit/lost-response/replay in two variants.
- F: pending/processing restart, failed claim write, failed completion write, safe recovery and unsafe-outcome review.
- G: poison row retained; valid neighbor completes; malformed root never overwritten.
- I/J: cross-type enqueue and out-of-order completion.
- Additional: duplicate payload conflict, in-flight discard denied, terminal retry suppression, legacy preservation, redacted diagnostics, free-limit reconciliation of already committed stock.
- Original Phase 1H reproducer now prints **RACE_FIXED** using actual scanner replay and the shared coordinator.
- `tests/offline-queue-browser.mjs`: two real browser pages sharing localStorage/Web Locks, cross-tab enqueue, overlapping workers and reload persistence.

### 8. Validation and remaining blockers

Validation completed locally on 2026-09-24:

| Check | Result |
|---|---|
| Root tests | 1,038 passed |
| Mobile tests, including concurrency/scanner replay | 596 passed; 15 new shared-queue tests and one scanner reconciliation regression |
| Database checks | 44 passed across minimal and legacy variants |
| Original lost-item reproducer | RACE_FIXED; newly enqueued B survives A completion |
| Real browser storage/concurrency | Two pages, shared localStorage/Web Locks, duplicate-worker suppression and reload passed |
| Authenticated acquisition acceptance | Passed against isolated local Auth/PostgREST/database fixtures |
| Root/mobile TypeScript | Passed |
| Root/mobile lint | Passed with existing warnings; no errors |
| Webpack production build | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Scoped secret/artifact audit | Passed: 14 changed/new text files and 355 static bundles; no high-signal secret matches or sensitive artifact paths |
| Whitespace integrity | git diff --check passed |

No production credentials, migrations or data were used. All database/browser fixtures are local and synthetic. The dedicated local acceptance stack was stopped after testing. These checks do not certify physical hardware, a private installer, or multi-process native recovery.

H01's same-version lost-item race is repaired and reproduced safely. **G19 is only partially resolved:** the queue is safe, but all online-to-offline intent/transaction boundaries are not yet certified. Legacy uncertain operations are retained for review rather than retried speculatively. **G20 remains:** retained private builds and hardware recovery have not demonstrated equivalent semantics. **G17/G18** retain their broader provenance/uncertainty work from Phase 1H.

**PHASE 1 INCOMPLETE. Phase 2 is not ready to begin.** No push, production deployment, schema change, inventory mutation, POS/Square change, installer distribution or physical certification occurred.

Before production promotion: review the legacy workflow gates, compare the actual production schema and recovery freshness, apply only reviewed forward migrations in schema-first order, run normal CI, and conduct separately authorized post-deployment checks. No such promotion is performed here. **Phase 2 is not ready to begin.**

## PHASE 1J — END-TO-END IDEMPOTENCY + RECOVERY PARITY

Status: **STOPPED AT ARCHITECTURAL CONFLICT J01. PHASE 1 INCOMPLETE.**

The Phase 1J instruction explicitly says: “If another fundamental architectural conflict is discovered: STOP. Document the evidence. Do not create a parallel mutation or recovery architecture to bypass it.” The conflict below was confirmed in a disposable loopback database. This section is an audit/evidence deliverable, **not an implemented server repair or release certification**. No runtime, schema, migration, production, installer or hardware changes were made.

### 1. New conflict: ledger deduplication is not command idempotency

`create_inventory_item_with_event` and `apply_collector_inventory_mutation` execute the business mutation **before** inserting the event with `ON CONFLICT (user_id, idempotency_key) ... DO NOTHING`. The unique index protects the number of events, not the number or meaning of stock effects. There is no persisted canonical command request/result at this boundary. A key collision can suppress the evidence of a successful stock change. This is more serious than returning an unhelpful duplicate error.

The functions are shared by scanner, collector edits, storage assignment and acquisition receipt. Fixing only the mobile queue, or adding a scanner-only receipt beside unchanged RPCs, would leave the same key namespace and mutation boundary inconsistent. It would also fail the requirement that changed payloads under a committed operation ID are rejected. The next repair must establish one contract **inside the existing authoritative RPC infrastructure**, including an explicit policy for legacy keys without an original payload/result. No competing inventory ledger or queue is appropriate.

### 2. Executable evidence

Run `node tests/phase1j-idempotency-evidence.mjs` with `TD_TEST_RUNTIME` pointing to the approved local embedded-Postgres runtime. It creates only a new temporary loopback database on port 55449, runs synthetic requests as `authenticated`, and stops the database in `finally`. It never loads application environment files or contacts production.

The fixture loads the actual inventory persistence/event migrations; applies the exact creation-RPC transformation from the workspace-writer repair; and applies the actual active-workspace helper/collector-RPC guard plus the restrictive inventory policy. It does **not** claim a full production recovery-clone rehearsal, all collector/POS triggers, or physical acceptance. The identity/auth prerequisites come from the existing isolated DB fixture. Those limits do not turn the demonstrated event-after-write sequence into command deduplication.

| Diagnostic case | Observed current behavior |
|---|---|
| Identical create delivered twice | First commits; second raises SQLSTATE `23505`, not a canonical already-committed response |
| Same key, different item ID/quantity | Both succeed: **2 rows, 3 units, 1 event** |
| Concurrent same key with different item IDs | Both succeed: **2 rows, 2 units, 1 event** |
| Quantity operation A sets 2, B sets 3, old A retries | Quantity returns **3 → 2**, original A event count remains 1 |
| Same quantity key with changed payload | New quantity **7** accepted; original event retained rather than payload conflict |
| Location A, then B, then old A retries | Old location restored without another location-change event |
| Wrong active workspace | Existing guard rejects with `42501`; the defects occur inside authorized scope |

The diagnostic exits successfully only when these unsafe counterexamples are reproduced and prints `UNSAFE_SHARED_MUTATION_BOUNDARY_REPRODUCED`. That is **not a PASS for server reliability**. After repair its assertions must be replaced/superseded with safe invariants; never count it as release acceptance.

### 3. Mutation-path matrix

Classification refers to the current source contract and the operation shown, not an assertion that deployed/private artifacts were tested. `IDEMPOTENT` is limited to the stated operation; incomplete canonical response semantics are called out explicitly.

| Origin / operation | Endpoint and tables / transaction | Identity, retry and effect | Classification |
|---|---|---|---|
| Mobile single/manual/rapid confirmation | `saveScannerConfirmation` → printing validation → `create_inventory_item_with_event`; `inventory_items`, `inventory_events` in one RPC | A fresh item ID is created inside each save invocation; initial source/key differs from replay. Duplicate same-ID delivery errors; changed ID under same key can create unledgered stock. No financial purchase | **NOT IDEMPOTENT** |
| Mobile continuous/batch finalize and partial retry | `mobile/app/scanner-session.tsx` loops through collection lines and calls the same save | Loop does not skip already-synced lines; stable session line ID is not passed as mutation ID. Results are persisted through React session state after the loop; a crash can leave A/C committed but locally unresolved. New invocation creates new IDs | **NOT IDEMPOTENT** |
| Shared offline scanner replay; startup/auth, foreground, online and manual retry | `scanner-replay.ts` → same creation RPC; same stock/event tables | Queue preserves item ID; existence lookup can avoid repeat insert, but does not prove original payload or canonical receipt. Source `scanner_replay`, key `scanner-replay:<itemId>` differs from initial scanner key. Client mitigation is not server idempotency | **NOT IDEMPOTENT** |
| Scanner trade-status follow-up | `runMobileTradeWishlistMutation` → `binder_card_trade_status` upsert | Composite upsert avoids duplicate rows, but an old retry can overwrite a newer status; no immutable operation receipt; separate transaction from stock | **NOT IDEMPOTENT** |
| Scanner wishlist follow-up | Same service → `collector_wishlist` insert | No operation key passed; repeated delivery can insert another wishlist row; separate transaction and independent review-required queue | **NOT IDEMPOTENT** |
| Scanner-related quantity correction | `apply_collector_inventory_mutation`; stock + event transaction | Absolute target quantity, row lock, event-only unique key; old retry overwrites later state, changed payload accepted | **NOT IDEMPOTENT** |
| Initial location in scanner stock payload | Creation RPC stores `location_id` with stock | Within the same unsafe creation boundary; no separate slot allocator in this path | **NOT IDEMPOTENT** |
| Location assignment following scan | `assignMobileStorageLocation` → `apply_collector_inventory_mutation`; inventory + location-change event, then separate location recent-use metadata | Online and queued identities are generated at different boundaries; server can reapply an old location even with same key. No quantity split/slot consumption in this call | **NOT IDEMPOTENT** |
| Scanner printing-validation follow-up | `/api/card-intelligence/inventory-validation` | Authenticated resolution response; does not write stock, movement or purchase | **NOT APPLICABLE** |
| Scanner-origin data explicitly routed into accepted acquisition intake | `save_collection_intake`, then `finalize_intake_purchase` / `complete_collection_intake`; intake, purchase ledger/lines, stock/events and purchase-stock links | Purchase finalization locks intake, uniquely links source intake, checks offer/key, persists purchase/line identity. Deferred receipt locks same authority, checks receipt location; line-derived stock IDs. Existing 44-check acquisition baseline covers concurrent finalization and duplicate receipt. This does not make direct scanner save a purchase | **IDEMPOTENT** for exact purchase/receipt retry under that existing authority |
| Native WIA/ScanSnap main/private capture | Local agent hardware API and Inbox/journal | Produces image/capture data; no direct stock, movement or financial mutation. Different persistence implementations still block recovery parity | **NOT APPLICABLE** to server stock mutation; parity FAIL |
| Web cloud capture reserve/upload/received | `/api/chaos-sort/scans` → `chaos_scan_command`; album/capture rows and private storage | Album/capture identity and SHA conflict checks, album lock; same accepted capture is reused. These are capture acceptance effects, not inventory receipt | **IDEMPOTENT** for repeated matching capture acceptance; current-turn full cloud rehearsal NOT RUN |
| Web cloud batch inventory commit | `chaos_scan_command('commit')` → `commit_chaos_sort_batch`; batch, positions, stock/events | Existing album lock and closed/immutable gate prevent a second commit. Repeating a closed command can report `SCAN_BATCH_CLOSED`, not the original canonical result; snapshot recovery remains separate | **IDEMPOTENT** for stock effects under the same closed batch; canonical response/recovery parity gate NOT SATISFIED |
| Headless/background native mobile replay | No registered headless consumer found in prior audited active runtime | Current shared queue assumes one native JS runtime; web tabs coordinate with Web Locks | **NOT APPLICABLE** today; future multi-runtime support is not certified |

Primary source anchors: `mobile/services/scanner-data.ts`, `scanner-replay.ts`, `scanner-foundation.ts`, `trade-binder-wishlist-data.ts`, `storage-location-data.ts`, `collector-mutation-data.ts`, `mobile/app/scanner-session.tsx`, `mobile/services/continuous-offer-scanner.ts`, `src/app/api/card-intelligence/inventory-validation/route.ts`, `src/app/api/chaos-sort/scans/route.ts`, and the inventory ledger/workspace/acquisition/cloud migrations named above. No POS, Square, orders or marketplace implementation was changed.

### 4. Required operation contract and repair boundary (not implemented)

- Create and durably persist one logical operation ID before the first request. A stable confirmed session-line intent must survive retries/restarts; changing business payload requires a new explicit intent, not silent reuse. Do not use product identity alone: scanning another physical copy is a distinct intent.
- Freeze the normalized mutation payload before delivery. `buildScannerAddPayload` currently generates `scannerAddedAt` at each call; payload comparison must not include a newly generated attempt timestamp. Capture/operation time should be fixed once.
- Validate actor and active workspace **before any prior-result lookup**. Scope keys to the existing owner/workspace contract and reject conflicting context. Never return another tenant's receipt.
- At the existing authoritative RPC boundary, serialize the operation key before modifying stock, validate the immutable request (full normalized JSONB equality or a deterministic fingerprint), execute business mutation and event creation atomically, and persist its canonical result in the same transaction.
- Return explicit `COMMITTED_NEW` / `ALREADY_COMMITTED`; changed payload is `REJECTED`; uncertain legacy intent is `REVIEW_REQUIRED`. Do not infer committed request identity solely from the current inventory row: that row can legitimately change after the original request.
- Decide how the current shared event key namespace maps to command identity across creation, quantity and location calls. Include operation kind, actor, workspace, item and business payload in conflict protection. Do not allow one operation kind to consume another's event key silently.
- Historical events lack original request/result fingerprints. Preserve them; do not fabricate receipts from current stock or blindly replay old uncertain rows. A migration must fail closed for ambiguous legacy keys and leave auditable review state.
- Fold scanner follow-up changes into an explicitly defined transaction or give each derived sub-operation a stable, server-enforced child identity under the same command contract. Current independent follow-ups can return queued/failed outcomes that scanner callers do not check before reporting success.
- Batch orchestration must persist each line's operation/result independently, replay unchanged A/C IDs and recover B once. No second queue or batch ledger is required.

### 5. Private-build and recovery parity

Read-only comparison against retained private revision `3269e252` confirms different mobile scanner-data/replay/offline modules. The private revision has not been rebuilt with `6b8c1b9d`. Native comparison still shows the private durable authorization/recovery additions but removal of main's `AgentLifecycle.cs` under whole-tree replacement. Those are **DOMAIN/RETRY DIFFERENCES**, not acceptable capture-only differences. Whole-tree cherry-pick/replacement would regress the accepted lifecycle repair.

WIA versus ScanSnap capture APIs are legitimate **PLATFORM/CAPTURE DIFFERENCES**. They do not authorize differing confirmation policy, stock mutation endpoints or lost-response handling. No private binary was executed, signed, distributed or certified this turn. Identical-fixture main/private parity is **NOT RUN / FAIL gate**, not inferred from matching filenames or a test harness.

### 6. Unknown-commit and restart states

Phase 1I queue behavior remains: pending work is retained; processing work can retry only with a proven safe handler; unsafe processing is held for review; committed tombstones suppress duplicate queue delivery; review-required rows remain; unsupported/malformed rows do not erase neighbors. A server permanent rejection must remain explicitly rejected/review-required and never be blindly converted to a new operation ID. No new state machine was added here.

The existing stock-existence shortcut is insufficient to certify unknown-commit recovery end to end. Exact same-request server retry currently errors; same-key changed payload can mutate without an event. Therefore pending/processing/server-committed-before-local-ack restart acceptance cannot be declared globally safe yet. A private agent's durable capture recovery does not solve the separate server stock command gap.

### 7. Validation and release gate

New execution: seven diagnostic cases in `tests/phase1j-idempotency-evidence.mjs`, including two concurrent authenticated clients, payload mismatch, quantity/location replay and wrong-workspace denial. Output confirms **unsafe current behavior**, not a repaired invariant. No runtime change was made, so no new migration or recovery-clone deployment was attempted.

The accepted baseline remains historical evidence from `6b8c1b9d`: 1,038 root tests, 596 mobile tests, 44 database checks, authenticated/browser acceptance, TypeScript, lint, Webpack build and scoped audit passed. Full suites/build/authenticated browser acceptance were **not rerun at this architectural stop**; they cannot certify the unsafe cases that the new diagnostic now demonstrates. New-file `node --check`, ESLint, scoped secret audit (two files, zero findings) and `git diff --check` all passed.

| Phase 1J requirement | Gate |
|---|---|
| Identical/concurrent duplicate returns canonical result | FAIL: 23505 or silent event conflict |
| Unknown-commit recovery | FAIL at shared server boundary |
| Payload mismatch protection | FAIL: changed stock payload accepted |
| Batch/partial batch retries | FAIL source contract: per-save new ID; A/C are not skipped |
| Duplicate receipt under existing purchase authority | Prior isolated acquisition baseline PASS; not re-certified here |
| Duplicate location/old-operation replay | FAIL: later location can be reverted silently |
| Cross-workspace protection | Diagnostic guard denial PASS; full release tenant suite not rerun |
| Main/private same-fixture parity | NOT RUN / gate unsatisfied |
| Full restart/physical recovery | NOT RUN / gate unsatisfied |
| Production readiness | NOT READY |

Exact blockers: **J01** shared mutation-after-key-collision semantics; **J02** durable initial/session-line identity and atomic/explicit follow-up outcome; **J03** private/main lifecycle-preserving recovery convergence and executable parity; legacy uncertain operations also remain review-only. These are not deferred into Phase 2.

**PHASE 1 INCOMPLETE**

No production access or change, no inventory mutation outside synthetic disposable fixtures, no POS/Square change, no push/deploy, no private installer change, and no Phase 2 work. Review J01's shared command/event boundary before resuming implementation; a scanner-only parallel receipt implementation is not the proposed solution.

## PHASE 1K — AUTHORITATIVE INVENTORY MUTATION RPC REPAIR

**Implemented and rehearsed locally. Not deployed. PHASE 1 INCOMPLETE.** This phase implements the owner's approved shared-RPC repair; it does not promote code, change production, or waive the remaining initial-client-identity/private-recovery gates.

### 1. Root cause and former transaction sequence

Both `create_inventory_item_with_event` and `apply_collector_inventory_mutation` authenticated the owner (and, after the tenancy repair, checked active workspace). Creation then inserted stock; collector mutation locked the target row and updated quantity/location/attributes. Only afterward did either append `inventory_events`, using `ON CONFLICT (user_id,idempotency_key) DO NOTHING`. Neither checked an immutable command/result before the stock write.

Consequences reproduced in Phase 1J: different stock IDs under one key bypassed the inventory primary key while the event unique index suppressed the second event; old absolute-value updates reran and replaced later quantity/location state; different payloads under one key were not compared. Concurrent transactions could each mutate separate stock rows and then compete only over the event append. A row lock alone serialized updates but did not recognize that an old operation had already committed.

Inventory uniqueness is intentionally **owner + exact inventory ID**, not product/printing alone. Distinct lots, batches and positions must remain distinct. The repair does not collapse natural product identities or introduce a product-level uniqueness constraint.

### 2. Migration and authoritative record

New forward migration: `supabase/migrations/20260925024439_inventory_mutation_idempotency.sql`, created with the Supabase migration CLI. No historical migration was edited.

The existing inventory event is the durable command receipt. `metadata.inventoryMutationV1` stores the canonical request, SHA-256 fingerprint, and complete committed `inventory_items` response snapshot. The event itself supplies owner, workspace, operation key, event ID and commit/creation timestamp. Request `kind` distinguishes creation from mutation, with the mutation subtype included. No second ledger, queue, writer, table, public endpoint or competing mutation path was introduced.

The existing unique partial index on `(user_id,idempotency_key)` remains the final durable uniqueness constraint. This preserves the existing **owner-global operation-key namespace**, which is stronger than independently reusing a key in two workspaces for that owner. Same owner/key in another workspace conflicts without returning old identifiers; another tenant has an independent owner/key namespace and cannot read or mutate the first tenant's result. The workspace is also protected in the immutable request and existing active-workspace authorization.

Legacy keyed events are unchanged. A retry encountering a legacy event without the saved request/result raises `INVENTORY_LEGACY_OPERATION_REVIEW_REQUIRED` (`55000`). No payload/result is guessed from today's inventory. Null/blank keys now fail with `INVENTORY_OPERATION_ID_REQUIRED`; callers must carry an actual durable key. Optional argument signatures remain for wire compatibility, but omission no longer authorizes an untraceable command. This is an intentional rollout compatibility requirement.

### 3. New transaction/locking sequence

1. Preserve the existing RPC names, parameter lists, composite return type, grants, business body and downstream collector/tenant triggers. The migration edits definitions in place and fails on an unrecognized body rather than replacing newer logic blindly.
2. Resolve the authenticated active workspace. Creation rejects a foreign supplied actor/workspace; mutation checks the existing target authorization before reading prior results. Existing parameter casts are retained and do not access business rows.
3. Build the canonical request, including actor, workspace, operation kind, complete creation input or mutation target/parameters, event source and related-entity fields where applicable.
4. Take a **transaction-scoped advisory lock** derived from owner + key before stock insert/update. The existing append-only event cannot serve as a row lock until the business result exists; this avoids adding a dummy claim table. Hash collisions only serialize unrelated operations; they cannot identify or equate requests, which are checked separately.
5. Look up the exact owner/key event. Check workspace first, then original request/fingerprint. Same request returns its stored result; different request raises `INVENTORY_IDEMPOTENCY_CONFLICT` (`22023`); ambiguous legacy receipt is review-only.
6. For a new operation, execute the existing business mutation and append exactly one event with receipt metadata. The old conflict-suppressing `DO NOTHING` is removed. Any insert/event/constraint failure rolls back the entire function's effects; it cannot leave stock without its event.
7. Commit the business result and receipt together. The advisory lock releases on transaction completion/rollback. No network call is held inside this database transaction.

Under normal PostgREST **READ COMMITTED**, a blocked duplicate sees the winner's committed receipt and returns the same result. The test explicitly holds the first transaction open and observes the second waiting on an advisory lock before releasing it. Under **REPEATABLE READ**, an already-frozen snapshot may not see the winning stock/event. Such uniqueness conflicts become `INVENTORY_RETRY_TRANSACTION` (`40001`); the entire transaction must restart with the same operation key. A fresh-transaction retry returns the stored result. The repair never replays into an obsolete snapshot or claims the client may continue an aborted transaction.

### 4. Payload and response semantics

`inventory_private.canonical_command` recursively orders JSONB object representation and removes insignificant numeric scale. It preserves array order, explicit nulls, strings, and business differences. Known actor/workspace fields are canonical server values. It does not trim/reinterpret condition, finish, language, printing, quantity, target, location, source or related IDs. The full canonical JSONB and its SHA-256 must agree; a hash alone is not trusted as payload proof.

Creation retains every supplied inventory/data field. Therefore clients must freeze timestamps and other attempt-varying fields before first delivery; they cannot rebuild a different request under the old key. This is deliberately strict. Current mobile `scannerAddedAt`, initial/replay source/key differences and per-save IDs remain part of J02, not silently normalized away here.

The public response remains the existing `inventory_items` composite, allowing current callers to consume the original shape. A retry returns the **exact original snapshot**, including original timestamps/location/quantity, even if later operation B has changed the live row. It does not restore that snapshot into the database. UI needing current state must separately refresh the current row. Receipt event ID and replay/new disposition are retained in the ledger/diagnostics; no incompatible response envelope was added.

Structured database logs distinguish `NEW_COMMIT`, `REPLAYED_COMMIT`, `IDEMPOTENCY_CONFLICT`, `AUTHORIZATION_FAILURE`, `BUSINESS_VALIDATION_FAILURE`, `TRANSACTION_FAILURE`, and `REVIEW_REQUIRED`. Logs use a deterministic operation-key hash, workspace, kind, safe identifiers and SQLSTATE; no payload, raw exception text, credentials, card names or arbitrary caller key text is logged. New/replayed commit logs include event and inventory identifiers. The raw key stays only in its existing authorized ledger record.

### 5. Security and history

No RLS policy or existing RPC grant was loosened. Private helper/schema privileges are revoked from browser roles and service_role. Public RPCs continue using their established authenticated/tenant checks and trusted writer triggers. The event ledger remains browser-read-only. An unauthorized context cannot retrieve a prior result by guessing a key. No business row, history, batch, purchase, event, or legacy metadata was backfilled or rewritten by the migration.

The existing event ledger's trusted-administrator boundary still applies; this is not a claim of protection against a database administrator intentionally rewriting history. Ordinary authenticated callers cannot alter saved receipts. Keys used by different operation kinds conflict inside the repaired RPCs. Other inventory RPCs are not silently reclassified as certified by this phase; existing removal/movement/Chaos/POS/Square implementations were not rewritten.

### 6. Seven exact diagnostics: before and after

`tests/phase1j-idempotency-evidence.mjs` retains the original unsafe diagnostics as its default mode; `--repaired` installs the forward migration and runs the same operations with safe assertions. The original seven were not replaced with simpler scenarios.

| Original diagnostic | Before | After |
|---|---|---|
| Identical creation twice | Second request `23505` | Exact original response; 1 stock row / 1 event |
| Same key, different item/quantity | 2 rows / 3 units / 1 event | Conflict; first row/unit/event unchanged |
| Concurrent key collision, distinct stock payloads | 2 rows / 2 units / 1 event | One winner; conflicting caller rejected; 1 row / 1 event |
| Quantity A=2, B=3, retry A | Reverted to 2 without event | Live quantity remains 3; A's original result returned |
| Same quantity key, changed quantity 7 | Accepted 7 without event | Conflict; newer quantity remains 3 |
| Location A, B, retry A | Reverted to A without event | Live location remains B; no duplicate movement event |
| Wrong active workspace | Denied | Still denied with `42501`; no result leakage |

Sixteen additional acceptance checks cover migration replay/data preservation, identical concurrent requests, an observed database claim wait, canonical numeric scale, business-field conflicts, repeatable-read recovery, creation replay after later edits, different mutation kinds, legacy review, missing key, injected event failure/rollback, partial batch A/B/C recovery, actual RPC response loss plus shared-queue restart, receipt/event contents, cross-workspace namespace rules, tenant/anonymous denial and helper/event write restrictions (some grouped within one check). Together: **23 Phase 1K database regression/acceptance checks**.

The lost-response test calls the repaired RPC again after recreating the shared queue coordinator. It does **not** use inventory-existence inspection to skip the request. The server returns the original result and the queue marks the operation committed. Per-item batch keys remain independent: successful A/C return prior results, while failed B can later commit once under its unchanged key/payload after its prerequisite becomes available.

### 7. Recovery-clone rehearsal

`tests/inventory-rpc-recovery-rehearsal.mjs` creates a new database from the existing isolated acquisition recovery rehearsal inside `supabase_db_trading-docks-recovery-test`. It asserts the container has no attached Docker networks. The source recovery database and original backup artifacts are untouched. The clone is retained locally; no raw rows, recovery dump or credentials enter Git.

Final rehearsal target: `inventory_rpc_rehearsal_1790305193035`, Supabase-compatible PostgreSQL **17.6**. Migration and a second application both passed; full-row digests were unchanged for all eight checked business tables. These are the retained rehearsal's counts, **not a fresh production baseline**:

| Table | Preserved rows |
|---|---:|
| inventory_items | 1,516 |
| inventory_events | 1,551 |
| inventory_movements | 0 |
| chaos_sort_batches | 22 |
| chaos_sort_inventory_positions | 1,488 |
| purchase_ledger | 1 |
| purchase_ledger_lines | 1 |
| purchase_inventory_links | 1 |

Both original RPCs contain the repair; stock/event RLS remains enabled; authenticated roles cannot execute the private receipt helper. Separate real-Auth/PostgREST/Next acceptance uses only synthetic local accounts and the production-shaped schema, including the reviewed acquisition authority and repaired RPCs. No production preflight, migration, or smoke mutation was performed.

### 8. Validation and complete Phase 1 gate

| Check | Result |
|---|---|
| Root `npm run check` | PASS: 1,038 tests, TypeScript, ESLint (551 existing warnings; 0 errors), npm audit (0 vulnerabilities) |
| Active mobile | PASS: 596 tests, TypeScript, ESLint (3 existing warnings; 0 errors) |
| Existing acquisition database variants after repair | PASS: 22 current + 22 legacy-intake checks; 44 retained checks |
| Phase 1K authoritative RPC acceptance | PASS: all 7 original regressions + 16 additional checks; 23 total |
| Before-repair diagnostic evidence | PASS: all 7 original unsafe behaviors reproduced in the isolated baseline |
| Authenticated acquisition browser acceptance | PASS on final migration: real local Auth/PostgREST/Next, receipt/retry, financial history, tenant and anonymous protections |
| Shared queue recovery / browser Web Locks | PASS: actual lost-response RPC replay, partial-batch recovery, and browser coordination |
| Supabase-compatible recovery clone | PASS: migration applied twice; eight business-table full-row digests/counts unchanged; RPC/RLS/helper checks passed |
| Webpack production build | PASS: 169 static pages |
| Focused test-file ESLint | PASS |
| Local security advisors | PASS: error-level security advisor returned no issues; this does not certify every advisor severity |
| Current Scanner Bridge core/security suite | PASS: 376 assertions |
| Current Windows lifecycle suite | PASS: 5 checks, using the existing local .NET 10 SDK and ignored build payload |
| Retained private `3269e252` core suite | PASS independently: 403 assertions; source archived to a temporary local folder |
| Private/current identical-fixture recovery parity | NOT CERTIFIED: independent suites do not close J03; durable journal/authorization behavior differs and whole-tree replacement would remove the accepted lifecycle repair |
| Scoped secret/artifact audit | PASS: 6 changed/new text files and 355 generated static JS/JSON bundles; 0 high-signal secret findings and 0 sensitive artifact paths in the proposed commit |
| `git diff --check` | PASS |

The secret check is scoped evidence, not a blanket security certification. No recovery dumps, fixture credentials, installer binaries, certificates or private artifacts are included. Generated tracked build files were restored. The synthetic local acceptance Supabase stack was stopped after validation; the isolated recovery container and retained rehearsal clones remain local. No installed-agent change, physical scan, production mutation or deployment occurred.

The database baseline is preserved and the server repair passes its local gate. The complete Phase 1 gate remains **INCOMPLETE** because J02 and J03 below remain unresolved; independent scanner test passes do not waive either gate.

### 9. Remaining blockers and rollout limits

**J01's two shared RPC boundaries are repaired locally. Phase 1 is not complete.**

- **J02 remains:** initial scanner save still creates a new identity per invocation; continuous finalize does not persist/pass an immutable per-line command through the first online attempt; initial/replay source and payload timestamps differ. Separate wishlist/trade follow-ups still have independent outcome/transaction gaps. The repaired database correctly rejects conflicts, but cannot infer that two different keys are the same physical intent without collapsing legitimate distinct copies. No client rewrite or false certification was made in this database phase.
- **J03 remains:** current/main bridge contract suite and retained private `3269e252` suite each pass independently, but differ in durable journal/authorization/recovery behavior. Whole-tree replacement still removes the accepted lifecycle fix. Passing two different suites does not prove same-fixture domain/recovery parity. No private artifact promotion, installed-agent upgrade or physical restart/capture acceptance occurred.
- Legacy uncertain queue entries/keys remain review-only. No historical payload provenance is fabricated. Missing-key callers require coordinated remediation before deployment. Older creation/replay key conventions must not be presented as a fully upgraded client contract.
- Mutation receipts increase event metadata size by storing request and result. Indexed owner/key lookup is constant-scope; normal row locks and unique checks still apply. The migration performs function DDL, no business-table scan/backfill, with a 5-second lock timeout. It fails closed on unexpected function definitions. Production rollout still needs an exact schema/definition review, fresh recovery assessment and explicit authorization.
- Reverting to the old RPC body would restore the defect; preserve all receipt/history metadata. No destructive receipt pruning or unsafe rollback script is supplied.

**PHASE 1 INCOMPLETE**

Phase 2 remains blocked. Production inventory, CS-000023, POS, Square, tenant configuration and physical hardware certification are unchanged.
