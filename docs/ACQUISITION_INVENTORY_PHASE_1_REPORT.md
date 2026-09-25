# Phase 1 — Data integrity and scanner parity

Status: **PHASE 1O VALUATION / SHOWCASE PRICE SEPARATION IMPLEMENTED LOCALLY — PHASE 1 SOFTWARE INCOMPLETE**.

The final Phase 1O follow-up below supersedes its initial architectural stop: the owner approved explicit asking-price-only Showcase requests. The total-row valuation decision is also resolved. The Phase 1M ledger remains the historical blocker classification. Earlier phase sections are chronological evidence, not concurrent verdicts. In particular, Phase 1M supersedes earlier claims that dormant MarketPulse code or standalone trade/wishlist preferences themselves block scanner certification.

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

## PHASE 1L — DURABLE CLIENT OPERATIONS + PRIVATE RECOVERY CERTIFICATION

**Implemented and rehearsed locally; not pushed or deployed. PHASE 1 INCOMPLETE.** This section supersedes Phase 1K's description of the current mobile save/replay defect. It does not supersede the retained private-build limitation or certify physical hardware.

### Client lifecycle and scope

The caller audit found one production-intended `saveScannerConfirmation` call, in `mobile/app/scanner-session.tsx`. Manual/assisted/continuous collection session finalization converges there. It now uses `scanner:<persisted-session-id>:<persisted-line-id>` for both operation and inventory identity. Synced lines are skipped. Newly created sessions carry `inventoryCommandVersion: 1`; existing sessions are not silently upgraded. Previously attempted/legacy lines without an existing durable command are held for review.

Initial delivery is now: snapshot confirmed intent → resolve current authenticated actor/workspace and canonical printing → construct versioned RPC command → persist through the Phase 1I shared queue → send saved arguments → validate matching authoritative result → persist acknowledgement. `prepare` serializes preparation per intent and returns the original entry, including its committed tombstone, on repeated Save. Storage failure prevents delivery. There is no send-then-enqueue path. No parallel queue, new inventory writer, migration or receipt store was introduced.

`inventory-command.ts` stores the endpoint, operation/item identity, actor/workspace, creation time and exact RPC args. Replay sends that args object unchanged. The timestamp inside `data.scannerAddedAt` is fixed during preparation because it participates in the Phase 1K request fingerprint; it is not regenerated as transport metadata. Source remains `scanner`; related entity and key remain fixed. Event IDs are server-owned and recovered through the existing receipt, not generated by the client.

Recognition, printing resolution, quantity-exists inspection and payload rebuilding were removed from replay. The existing Phase 1K RPC returns the same immutable inventory composite for new and prior committed operations, rather than a new `COMMITTED_NEW`/`ALREADY_COMMITTED` envelope. A matching actor/workspace/item result is required for acknowledgement. HTTP success with no definitive matching result is review-required. A later draft-cleanup failure cannot undo durable acknowledgement.

Changes to the current UI's stock intent do not overwrite a saved command. The intent comparison is a stable JSON representation, not a security hash; the authoritative server fingerprint remains the security boundary. Each batch line has its own identity. A/C completion survives a B failure, and retry only adds B once. Reconnect/resume use the existing item coordinator; server idempotency also protects independently delivered duplicates.

`IDEMPOTENCY_CONFLICT`, definitive authorization/validation failures and ambiguous legacy entries retain their original command/evidence in `review_required`. No automatic re-key, normalization or recognition occurs. Review-required operations cannot be unblocked by generic Retry. The existing explicit discard keeps a local tombstone (`discarded_by_user`); this is not a server-commit receipt, and Save does not claim it as successful inventory creation.

### Important remaining limits

- New intent that cannot confirm canonical identity/workspace is preserved for review. Offline replay of an already prepared command is supported; automatic preparation of an unresolved offline scan is not certified.
- Combined stock plus trade/wishlist intent is held before any mutation. This prevents the old partial-success gap but does not implement atomic ancillary completion. No speculative follow-up transaction system was added. J02 is partially repaired, not closed.
- Other collector/import mutation entry points are not newly certified by these scanner fixtures. Existing acquisition DB/browser coverage remains in place.
- Existing legacy sessions/queues require deliberate outcome review. Clearing or regenerating their keys is not a supported repair.

### Persistence and leakage review

The existing app-storage adapter uses native AsyncStorage and browser localStorage. This change does not claim encrypted mobile storage. The queue retains the authoritative business payload plus its confirmation for review: owner/workspace IDs, printing/provider identity, stock attributes, location/binder position, card display/image metadata, timestamps and operation identity. Confirmation may also retain public price/confidence metadata for review; these do not participate in UI stock-intent comparison, and replay never refreshes them. No user email, contact/address, password, auth session, access/refresh token or service credential is intentionally stored in the command. The initial validation access token stays transient in the existing authenticated request.

Queue diagnostics contain operation/type/attempt/depth metadata, not command bodies. New command error classifications use sanitized messages. Existing shared legacy error handling and local application storage remain their existing trust boundaries; this is a scoped review, not a complete mobile-device security certification. No production snapshots, recovery dumps, images or private fixture credentials are committed.

### Mobile mutation/recovery evidence

`mobile/tests/inventory-command-durability.test.ts` adds 17 deterministic cases; the 15 scanner replay cases now consume serialized commands. The database harness calls actual repaired PostgreSQL functions through the client delivery boundary, inspects stock/events and compares saved payloads. It does not substitute a mock stock result.

| Required scenario | Result and evidence |
|---|---|
| A Online first save | PASS: command durable before RPC; one item/unit/event |
| B Offline enqueue | PASS for confirmed/prepared command; unresolved initial intent remains review-only |
| C Reconnect replay | PASS: same operation and args through existing coordinator |
| D Response lost after commit | PASS: repeated actual RPC returns original result; one stock/event effect |
| E Force-close before send | PASS deterministic storage/runtime recreation; actual OS force-close MANUAL REQUIRED |
| F Close after commit before local ack | PASS injected acknowledgement write failure and recreated runtime; original result recovered |
| G App restart | PASS recreated coordinator reads serialized storage; real-device restart MANUAL REQUIRED |
| H Same operation twice | PASS: committed tombstone and server receipt prevent a second effect |
| I Same key with altered payload | PASS: server conflict, retained original identity, review-required |
| J Legacy ambiguous entry | PASS: no network mutation or reconstructed request |
| K Partial batch A/B/C | PASS: stable independent IDs, only failed B gains one effect on retry |
| L Reconnect/resume race | PASS: shared coordinator plus authoritative server idempotency |

Additional cases cover mutable UI references, concurrent initial preparation, storage failure, wrong workspace/anonymous context, invalid server result, definitive rejection, discard retention and intent edits. The retained server suite separately exercises real concurrent PostgreSQL claims and cross-tenant denial.

### Windows/private recovery audit and downstream parity

Windows image recovery is not mobile inventory-command recovery. Current/main Scanner Bridge 1.3.1 source keeps capture/inbox state in memory and includes the accepted `AgentLifecycle` restart fix. Retained private revision `3269e252` has an encrypted recovery store, capture authorization/binding and journal recovery. It does not persist a recognized canonical card or directly write inventory. Replacing the main tree with that private tree would also remove the accepted lifecycle implementation and reintroduce blocking restart/start behavior. No whole-tree port was made.

The Windows handoff is `local-scanner-provider.ts` → private Chaos capture reserve/upload/received API → `chaos_scan_command`. Local acknowledgement means durable cloud capture acceptance, not inventory commitment. After cloud recognition and explicit review/commit, Chaos uses its existing `commit_chaos_sort_batch` authority. Mobile scanner inventory confirmation uses `create_inventory_item_with_event`. Those are distinct existing domain operations; rerouting Chaos through mobile or adding another queue to manufacture parity would be an architectural change. Their downstream equivalence is **not certified** by this patch.

`tests/phase1l-client-db.mjs` runs 12 identical scenarios through current client modules and a separately loaded, SHA-256-manifested frozen source acceptance candidate. Both call real PostgreSQL RPCs. Compared results include item/unit/event counts, queue status/error, delivery count and key preservation. All 12 comparisons pass: online, timeout-before-delivery, lost response, offline restart, duplicate, changed payload, legacy review, invalid mutation, location A/B/retry-A, partial batch, crash-before-ack and reconnect/resume.

Final retained source candidate: `%TEMP%/td-phase1l-private-candidate-95pC9p`. Its six-module hash manifest remains outside Git. This is a source-package regression proof, **not an independently implemented private path, installed executable, mobile APK, or upgrade of `3269e252`**. Identical copied modules passing against a real database do not close J03.

| Downstream property | Mobile candidate | Frozen source candidate | Retained Windows/private path |
|---|---|---|---|
| Confirmed identity | Initial server validation, saved payload | Same modules, real RPC fixtures | Cloud recognition/review; different handoff |
| Operation identity | Persisted session/line key | Same serialized contract | Capture ID/session binding is not inventory operation ID |
| Payload and source | Frozen RPC args | Observable domain comparisons PASS | Capture metadata; later Chaos commit separately authoritative |
| Durable delivery | Existing Phase 1I queue | Same module/storage recreation exercised | Private image journal differs from main in-memory capture state |
| Server mutation | Existing creation RPC; location fixture uses collector RPC | Same real RPCs | Existing Chaos batch commit, not newly parity-certified |
| Commit/conflict interpretation | Original composite acknowledges; conflict holds | Same results in all 12 scenarios | Cloud-capture acknowledgement does not prove stock mutation |
| Installed artifact / hardware | MANUAL REQUIRED | No installed artifact produced | NOT CERTIFIED; lifecycle-preserving convergence still needed |

No physical phone/agent restart, reboot, airplane-mode capture or native force-close is represented as passed. No connected Android tooling was available. Capture parity remains MANUAL REQUIRED. Automated mutation/recovery evidence above is separate. Private artifact mutation/recovery equivalence remains a release blocker, not a hardware-only waiver.

### Validation

| Check | Result |
|---|---|
| Root check | PASS: 1,038 tests, TypeScript, ESLint (0 errors), production dependency audit 0 vulnerabilities |
| Active mobile | PASS: 613 tests (596 baseline + 17), TypeScript, lint (3 existing warnings; 0 errors) |
| Acquisition database variants | PASS: 22 current + 22 legacy-intake; both now load the required Phase 1K contract even without the optional compatibility flag |
| Phase 1K server acceptance | PASS: 7 original regressions + 16 additional checks |
| Current/frozen source RPC recovery | PASS: 12 scenarios per source, 24 executions with matching domain outcomes; not private binary certification |
| Browser shared queue | PASS: actual two-page Web Locks/localStorage, overlapping triggers and reload persistence |
| Authenticated acquisition browser | PASS: local GoTrue/PostgREST/Next; draft/reload, purchase/receipt, retries, financial invariants, owner/workspace/anonymous isolation |
| Production build | PASS: Webpack, 169 pages; pre-existing worktree/Turbopack boundary remains documented |
| Current Scanner Bridge | PASS: 376 security/contract assertions; no trust-store change |
| Scoped secret audit and diff whitespace | PASS: 16 staged text files and 355 static JS/JSON bundles, zero high-signal secret findings or sensitive artifact paths; staged diff whitespace clean |

The final mobile typecheck initially caught a Node-vs-Expo global URL type conflict in a source-audit test; importing Node's URL fixed it. Root lint also identified the now-unused per-send ID generator; it was removed. No failing check was waived. A separate agent-browser homepage screenshot was inconclusive (blank); it is not counted as visual acceptance. The authenticated harness screenshot renders the intake page but also shows existing sidebar overlap, so this task makes no general layout certification. No web UI runtime was edited here.

### Complete Phase 1 blocker review

| Prior gates | Current disposition |
|---|---|
| G01–G09, G11, G14–G16 | Prior local fixes retained; root/mobile/DB/authenticated browser regression suites pass. No fresh production certification implied. |
| G10, G12, G13, G21 | Existing documented bounded-history/accounting/receipt/import limitations retained; no expanded product claims. |
| G17 | BLOCKER: full intelligence provenance audit remains incomplete, including static/derived MarketPulse signals and broader ranking/API consumers. |
| G18 | BLOCKER: physical-attribute defaults and provider conflicts across scanner/import consumers remain; mobile near-mint/normal defaults and any-provider-ID matching are not resolved by durable delivery. |
| G19 / J02 | PARTIALLY FIXED: initial/replay scanner command identity repaired locally. Combined ancillary completion and deliberate legacy review resolution remain incomplete. |
| G20 / J03 | BLOCKER: lifecycle-safe private recovery convergence and installed-path downstream equivalence not certified. Source candidate parity is insufficient to waive this. |
| H01 | Shared queue race repair retained; current browser coordinator regression passes. No second queue added. |
| J01 | Phase 1K shared RPC repair retained and revalidated; no new SQL in this phase. |
| G22–G24 | Physical acceptance, normal-checkout CI/default build and authorized production rollout gates remain unperformed. No new waiver or promotion authorization assumed. |

**PHASE 1 INCOMPLETE.** Phase 2 has not begun. Production inventory, `CS-000023`, POS, Square, tenant settings, agent installation and hardware certification remain unchanged. The local repair may be preserved in a focused commit after validation; no push or deployment is authorized by this task.

Validation cleanup: the synthetic local Supabase acceptance stack was stopped with its volumes preserved. The isolated recovery container was not changed. Generated changes to AGENTS.md, next-env.d.ts and tsconfig.tsbuildinfo remain unstaged; no existing working-tree changes were reset or undone.

## PHASE 1M — FINAL CLOSURE AUDIT + INSTALLED-BUILD CERTIFICATION

Audit date: 2026-09-24. Runtime baseline: `1cc6321`. This phase adds diagnostic fixtures and certification documentation only. No application/schema repair, production access, live capture, pairing change, push or deployment occurred. No new architectural system is proposed; the remaining gaps concern previously identified paths.

### Definitive historical blocker ledger

Evidence keys: A = `tests/acquisition-authority-db.mjs` (current/legacy); B = `tests/acquisition-auth-browser.mjs --idempotency`; K = `tests/phase1j-idempotency-evidence.mjs --repaired --client-recovery`; Q = mobile queue suite and `tests/offline-queue-browser.mjs`; L = mobile inventory-command durability/scanner replay tests; M = `tests/phase1m-closure-evidence.mjs`; I = `tests/phase1m-installed-agent-evidence.ps1`. Source audits below supplement executable coverage; they are not runtime acceptance claims.

| ID / discovered | Original concern and affected path | Current status | Evidence / covering test | Release blocking? |
|---|---|---|---|---|
| Authority stop / A–F | Competing acquisition ledgers and finalization authority | RESOLVED | Owner chose existing purchase ledger; finalizer, A/B | No |
| G01 / A–F | Ledger/grant contradictions in collection intake | RESOLVED | Atomic purchase-ledger boundary; A/B | No |
| G02 / F | Draft/revision finalization atomicity | RESOLVED | Collection intake transaction/revision checks; A/B | No |
| G03 / F–G | Authorized receipt and replay result | RESOLVED | Receipt authorization and normalized result; A/B | No |
| G04 / F–G | Duplicate/retried financial finalization | RESOLVED | Stable finalizer identity; A/B | No |
| G05 / A–G | Generic header/line legacy financial writes | RESOLVED | Unsafe completion entry points gated; authority tests/A | No within gated scope |
| G06 / A–G | Purchasing quantity/metadata split writes | RESOLVED | Legacy stock-producing completion gated; root authority tests/A | No within gated scope |
| G07 / A–G | Card-show/bulk snapshot completion | RESOLVED | Unsafe financial finalization gated; root authority tests/A | No within gated scope |
| G08 / F–G | Later edits overwrite acquisition cost | RESOLVED | Linked cost protection; A/B | No |
| G09 / F–G | Inventory timestamps masquerade as acquisitions | RESOLVED | Ledger-derived cohorts/spending; analytics tests/B | No |
| G10 / F | Purchase history limited to 250 records | NON-BLOCKING LIMITATION | Bounded history service, not all-history accounting | No; limitation retained |
| G11 / F | Unknown dates/provenance fabricated | RESOLVED | No invented historical backfill; analytics/provenance tests | No for repaired boundary |
| G12 / F | Detailed fees/tax/shipping allocation absent | NON-BLOCKING LIMITATION | Existing adjustment/details model, no expanded accounting claim | No |
| G13 / F | Deferred/partial/reversal UI incomplete | NON-BLOCKING LIMITATION | Full receipt API covered A/B; advanced UI not claimed | No |
| G14 / G–K | Full-schema compatibility | RESOLVED | Prior cloned-schema rehearsal plus A/B/K rerun | No locally; rollout G24 |
| G15 / F–G | Tenant/anonymous authority | RESOLVED | Owner, other-tenant and anonymous checks A/B/K | No for tested seams |
| G16 / F | Exact reviewed identity/value/location at financial boundary | RESOLVED | Finalizer guards A/B; not universal scanner truth | No for financial boundary |
| G17 / B–H | Unproven intelligence | PARTIALLY RESOLVED | Market repair M passes; active portfolio missing-price aggregate below | YES |
| G18 / C–H | Unknown physical attributes/provider disagreement | PARTIALLY RESOLVED | Buylist M passes; scanner/shared resolver/import counterexamples M | YES |
| G19 / A–H | Retry and partial physical mutation safety | PARTIALLY RESOLVED | Server K and scanner L pass; generic collector intent identity M fails | YES |
| G20 / E | Private artifact downstream equivalence | PARTIALLY RESOLVED | Actual installed capture binary I passes; downstream matrix uncertified | YES |
| G21 / G | Physical imports are not financial acquisitions | NON-BLOCKING LIMITATION | Explicit stock-vs-purchase classification; attribute defects tracked G18 | No by itself |
| G22 / E | Physical device acceptance | MANUAL REQUIRED | A–O script below, not executed | Yes, final acceptance gate |
| G23 / G | Turbopack/worktree build issue | NON-BLOCKING LIMITATION | Webpack production build passes; normal promotion CI still required | Not this local audit; promotion gate |
| G24 / G | Production preflight/recovery/rollout | MANUAL REQUIRED | No current production freshness claim or deployment authorization | Yes before promotion |
| H01 / H | Shared queue snapshot overwrite/race | RESOLVED | Q browser locks/fallback and mobile queue regressions | No |
| J01 / J | Event uniqueness checked after stock change | RESOLVED | Phase K authoritative RPC correction; K 23 regressions | No |
| J02 / J | Client identity and ancillary completion | PARTIALLY RESOLVED | Scanner L repaired; generic stock edits reuse intent key M; preference-only classification below | YES for stock clients |
| J03 / J | Installed private mutation/recovery parity | PARTIALLY RESOLVED | I proves installed capture contract only; matrix below | YES |
| Legacy uncertainty / I–L | Old commands lack trustworthy outcome/identity | NON-BLOCKING LIMITATION | Review-only, no automatic re-key/replay; L | No while fail-closed |
| Native multiruntime / I | Queue coordination beyond one JS runtime | NON-BLOCKING LIMITATION | Q covers registered foreground runtime/browser coordination; no headless writer registered | No within current runtime model |

### Provenance sweep and reconciliation

Prior market-engine and buylist fixes remain effective; no regression of those fixes was reproduced. Remaining defects are incomplete cross-path coverage (A/B in the request), while the earlier MarketPulse release claim was stale (D).

| Surface / source | Classification and evidence | Decision |
|---|---|---|
| `market-engine/helpers.ts::normalizeCard` | OBSERVED sourced quote; INSUFFICIENT_DATA unsupported metrics remain null and sparkline empty. M verifies quote retained and seven unsupported metrics absent. | Prior repair RESOLVED |
| `MarketPulse.tsx` | UNAVAILABLE as business evidence: synthetic changes/trends remain, but repository import search finds declaration only, no active consumer. | Dormant, non-blocking; prior live-blocker claim withdrawn |
| `market-preview.ts`, landing MarketSection/useDemoMarketTicks | UNAVAILABLE as real market evidence; visibly demo/sample signals, cosmetic seeded trend/volume/ownership. No inventory writer. | Demo-only limitation, no unrelated redesign |
| Dashboard business intelligence | CALCULATED orders/attribution/coverage/deltas; ESTIMATED profit and possible replenishment labeled accordingly. Priority weights rank recommendations, not observed probabilities. | No fabricated sales evidence found |
| Inventory/mobile collection intelligence | CALCULATED from loaded stock with sample/coverage/missing-price disclosures. | Bounded calculations, not all-history truth |
| Collection intake valuation | ESTIMATED user scenario/realization/profit; CALCULATED aggregates with price coverage and review gates. | Existing financial finalizer remains authority |
| Purchasing product lookup | OBSERVED catalog/source/SKU quotes; best-priced SKU is a reference selection, not observed physical variant. | Legacy unsafe stock completion already gated |
| Scanner pricing/ranking | OBSERVED nullable sourced price/timestamp; CALCULATED offer/estimated margin; recognition weights are diagnostics, not calibrated market probabilities. | Attribute confidence conflict remains G18 |
| Trade/wishlist | OBSERVED user-entered target/preferences; not acquisition spending or cost basis. | No fabricated acquisition analytics found |
| `collector-portfolio-server.ts::itemFrom`, `CollectorPortfolioWorkspace.tsx` bookshelf | INSUFFICIENT_DATA is incorrectly normalized to zero via `inventory_value ?? payload.value ?? payload.marketValue ?? 0`. Binder aggregate is displayed as money beside card count, without missing-price coverage; highest-value sorting consumes it. | Active G17 BLOCKER: unknown valuation appears as a complete value |

Portfolio/showcase stored values do not prove acquisition cost or complete price coverage. This audit does not certify those missing inputs by substituting a numeric fallback. No valuation data was rewritten.

### Unknown-attribute sweep

- Buylist resolver and MTGJSON repairs remain effective: unknown finish, condition and language cannot finalize (M and existing trust tests). Current collection-intake review/finalizer retains explicit material-field validation.
- `card-intelligence/ranking.ts` accepts any matching provider ID with `.some()`: M supplies a matching Scryfall ID plus conflicting TCGplayer ID and receives high confidence with no confirmation requirement. Final `inventory-validation.ts` checks all supplied IDs and rejects disagreement; that compensating guard does not make upstream false certainty safe.
- `mobile/services/continuous-offer-scanner.ts` supplies `near_mint` when condition is omitted and normalizes unknown finish to `normal`. M reproduces missing condition becoming NM. `exact-printing-recognition.ts::defaultFinishForPrinting` picks normal from ambiguous finishes without a warning; M reproduces this and the active printing-selector consumes it. Premium scanner defaults also represent preferences, not physical observations.
- Active `CsvConversionEngine.tsx::saveToInventory` uses `row.language.trim() || "English"`. The dashboard CSV route imports it. Separately, legacy `csv-converter.ts::normalizeRows` defaults English but has no active source import; M labels that helper dormant rather than conflating it with the active converter.
- Manual `InventoryWorkspace.tsx` starts language at English; editable does not mean physically established. Older collection-buying CSV NM/nonfoil defaults are in the legacy center, while the current route uses CollectionIntakeWorkspace; they are not evidence of regression in the repaired current intake.
- Purchasing reference SKU NM/English assumptions are catalog/reference data, not permission to infer owned-copy attributes. Collector normalizers retain unknown; wishlist `any` is a preference wildcard, not a claim about physical stock. Inbound-email English fallback creates unmatched order-line metadata, not acquisition inventory; documented related follow-up outside this repair.
- Exact set/collector checks in buylist and the final catalog validator remain intact. No convenient-first-printing permission was introduced. G18 remains software-blocking for the active scanner/shared matching/import paths, not for every wildcard or dormant helper.

### Ancillary trade/wishlist classification

| Path | Stock / acquisition effects | Delivery and attributes | Classification |
|---|---|---|---|
| Mobile `trade-binder-wishlist-data.ts` | Trade-status upsert, wishlist insert/delete/priority only. No quantity/cost/acquisition writer or inventory RPC. | Shared queue, generated queue IDs, user/type/target dedupe. Uncertain outcomes review-only. Repeated preference insert may duplicate a preference; no exactly-once stock claim. `any` is intentional preference. | SAFE BUT NON-AUTHORITATIVE; NON-BLOCKING LIMITATION |
| Web `trade-binder-wishlist-client-data.ts` | Same preference tables only; no financial or stock mutation. | Direct owner-scoped writes, no shared offline replay; no inventory operation ID required. | SAFE BUT NON-AUTHORITATIVE |
| Generic collector trade/wishlist branches | Preference mutations only. | Same review/queue restrictions; do not feed purchase analytics. | SAFE BUT NON-AUTHORITATIVE |
| Scanner combined save + wishlist/trade | Currently blocked before stock mutation; neither hidden partial stock completion nor fabricated acquisition. | Explicit review; composite completion unavailable. | BLOCKED feature, NON-BLOCKING LIMITATION while fail-closed |
| Generic collector quantity/condition/finish/storage edits | Actual stock mutations through repaired RPC. These are distinct from preference branches. | `mutationQueueKey` uses owner/item/type for different intended values; M proves two quantity intents share a key. Correct server conflict rejection then prevents a legitimate second intent. Initial command is not always durably stored before sending. | NEEDS MIGRATION; G19/J02 BLOCKER |
| `storage-location-data.ts` assignment/retry | Inventory location mutation. | Initial generated operation identity and queued replay identity require convergence. Uncertain outcomes remain review-only; cannot claim universal automatic recovery. | NEEDS MIGRATION; G19/J02 |

Owner RLS and absence of inventory-writing triggers were reviewed in collector portfolio/trade schema migrations (`202608030040`, `202608030060`). No unsafe ancillary preference-to-stock writer was found to repair. Acquisition analytics reads the purchase ledger, not preference activity. Do not migrate preference operations into a second inventory authority. Generic stock-client durability remains an existing separate blocker, not a new architectural conflict.

### Actually installed private build

Read-only artifact/process/health inspection found PID `32968` at audit time, executable `%LOCALAPPDATA%\Programs\TradingDocksScannerBridge\TradingDocks.ScannerBridge.exe`. File/registry version: `1.3.1.0` / `1.3.1`; product version: `1.3.1+3269e252717817e7355617eef99244be1eeb80b9`.

- EXE SHA-256: `8C37CF5B5A72751383D159042E986DDCC6EAFA254A5884F5F5E1F09BFF6E0F7C`
- Installed Core.dll SHA-256: `9F4B39A0984815026D20872B01BDBFA671853B265187C88F00B9DA616085692F`
- Both Authenticode signatures: Valid, `CN=Trading Docks INTERNAL TEST Scanner Agent`.
- Normal TLS GET `/v1/health` on `127.0.0.1:47391` with the existing approved production origin returned running=true, bridgeVersion=1.3.1, protocolVersion=1, automaticInbox=true, durableRecovery=true. No privileged command was sent.

I copies the installed DLL bytes, verifies their hash, and compiles matching reviewed fixture code against that binary reference. It does **not** rebuild Core from source. All devices, journals and trust stores are synthetic, with isolated HTTPS port 47392; the installed process/state is untouched. **403 assertions passed against the installed assembly.** Early harness attempts exposed omitted fixture dependencies and Windows Schannel temporary-key handling; after restoring the matching reviewed fixture setup, the final run passed. Those harness failures are not product acceptance failures.

This is stronger than source-only parity but still not an installed end-to-end inventory save. Agent owns capture identity, permits and encrypted pending-image recovery. Browser `local-scanner-provider.ts` hands off through `/api/chaos-sort/scans` and `chaos_scan_command` reserve/upload/received. Recognition/review and later explicit `commit` lead to `commit_chaos_sort_batch`. Native acknowledgement means durable cloud capture acceptance, not inventory commit. Mobile durable saves reach `create_inventory_item_with_event`; collector edits use their own authoritative mutation seam. Repeated closed Chaos commit can return `SCAN_BATCH_CLOSED`, not the mobile original receipt. Different domain operations require demonstrated handoff equivalence, not forcing a capture agent to own stock.

Installed capture ID/scope and journal recovery are tested. Confirmed canonical identity, immutable stock payload, inventory RPC receipt, `ALREADY_COMMITTED`, `IDEMPOTENCY_CONFLICT` and stock-review acknowledgement are **not certified end-to-end through this installed path**. No live pairing, restart, reboot, scan or cloud commit was performed. Do not port a private source tree wholesale or replace lifecycle protections to obtain superficial parity.

### Required fixture matrix

K/L exercise the production-intended mobile command seam against local DB fixtures; I exercises the installed capture binary. Capture analogues do not count as inventory parity.

| Fixture | Production-intended mobile path | Installed private build | Equivalent? / evidence |
|---|---|---|---|
| Normal confirmed save | K/L authoritative save passes | I capture-ready/cloud-ack passes; no installed stock save exercised | NOT CERTIFIED; blocker |
| Duplicate delivery | K/L original command/receipt, one effect | I repeated capture ID avoids duplicate acquisition | NOT CERTIFIED at inventory seam |
| Lost response after commit | K/L original receipt recovery passes | I image retained until acceptance; SQL commit/reply boundary absent | NOT CERTIFIED |
| Same ID, changed payload | K rejects conflict, L does not re-key | I scope/permit checks, not stock fingerprint | NOT CERTIFIED |
| Offline persisted recovery | L same identity/payload after reload | I installed journal recovery passes with synthetic restart; physical reboot not run | NOT CERTIFIED downstream; hardware MANUAL REQUIRED |
| Review-required identity | Mobile review/validation fixtures pass; G18 upstream defects remain | Agent carries image, not canonical identity; cloud review not exercised | NOT CERTIFIED |
| Server validation rejection | K/L rejection preserves correct state | I expired/wrong-scope authorization tests pass, not stock rejection | NOT CERTIFIED |
| Location/inventory retry | K repaired RPC passes; broader generic client G19 remains blocked | No native inventory/location RPC; browser handoff not exercised | NOT CERTIFIED |
| Partial batch | L independent item receipts/recovery covered | I inbox/capture limits covered; atomic Chaos commit is a different downstream operation | NOT CERTIFIED; domain boundary must be tested |

Thus actual installed capture contract PASS does not resolve G20/J03. No software parity PASS is inferred from two independently passing suites.

### Manual real-device acceptance script — NOT EXECUTED

Use an explicitly authorized isolated acceptance account/destination and a real stack containing a known card, alternate printing, ambiguous foil and visibly worn card. Record operation IDs, exact identities, receipts and event counts. Do not use production stock or `CS-000023` without separate approval. All rows are **MANUAL REQUIRED**.

| Step | Action | Expected evidence |
|---|---|---|
| A | Scan confirmed card online | Canonical review, persisted command before send, one authoritative receipt |
| B | Confirm exact set/collector/printing | Saved exact printing, no first-result substitution |
| C | Scan ambiguous foil/nonfoil | Explicit review; unknown is not normal |
| D | Leave uncertain condition unknown | Review required, no NM inference |
| E | Enable airplane mode and scan | Durable pending state; unvalidated identity remains review-only |
| F | Reconnect | Original ID/payload replayed once |
| G | Force-close after persistence, before send | Original command recovered without recognition rerun |
| H | Controlled reply loss after observed SQL commit, then force-close | Same receipt recovered; do not infer server commit merely from timing |
| I | Restart app/agent as applicable | Pending state and supported pairing/device preference restored |
| J | Duplicate Save tap | One command/effect/receipt |
| K | Search exact saved position | Correct owner/workspace/location/printing |
| L | Compare quantity | Exactly intended delta |
| M | Inspect ledger/event history | One expected stock event; no fabricated purchase/cost |
| N | Retry and refresh again | No duplicate position/event/receipt |
| O | Scan wrong/low-confidence identity | Explicit review, no automatic stock write |

Software blockers below must be resolved before treating this script as the only remaining release gate.

### Validation and generated-file hygiene

To preserve pre-existing generated changes byte-for-byte, build/typecheck/browser runs used a detached temporary worktree at `1cc6321` with dependency junctions. `AGENTS.md`, `next-env.d.ts`, `tsconfig.tsbuildinfo` in the working branch remain pre-existing, unrelated and unstaged. No reset, rewrite or cleanup of those files is authorized.

| Check | Result |
|---|---|
| Root `npm run check` | PASS: 1,038 tests, TypeScript/lint, dependency audit 0 vulnerabilities |
| Active mobile | PASS: 613 tests and TypeScript; lint 0 errors, 3 existing warnings |
| Acquisition DB | PASS: 22 current + 22 legacy = 44 |
| Server idempotency | PASS: 23; source-candidate client matrices 12 + 12 also pass, not installed parity |
| Offline browser queue | PASS: Web Locks and localStorage coordination fallback |
| Authenticated local browser | PASS: local Next/GoTrue/PostgREST draft/reload, receipt/retry/concurrency, cost protection and tenant/anonymous checks |
| Production build | PASS: `next build --webpack`, 169 pages; no deployment |
| Installed assembly | PASS: 403 capture/recovery/security assertions; downstream certification remains blocked |
| New closure diagnostics | Completed; deliberately report unresolved G18/G19 counterexamples. Exit 0 means evidence collection completed, not release PASS |
| Focused diagnostic ESLint | PASS |

Detailed logs are local `%TEMP%\td-phase1m-*.log`; no raw customer export, agent pairing state, secret or recovery dump is included in this report or the new diagnostics.

### Full historical guarantee decision

| Guarantee | Verdict and scope |
|---|---|
| TRANSACTIONAL INTAKE | PASS at tested finalizer |
| PURCHASE LEDGER AUTHORITY | PASS |
| ACQUISITION ANALYTICS | PASS for repaired ledger-derived metrics |
| INTELLIGENCE PROVENANCE | FAIL overall: active portfolio missing-price presentation |
| UNKNOWN ATTRIBUTE SAFETY | FAIL overall: scanner/import/shared ranking counterexamples |
| SHARED OFFLINE QUEUE | PASS within supported runtime model |
| SERVER IDEMPOTENCY | PASS for repaired authoritative RPCs |
| STALE RETRY SAFETY | FAIL universal claim; server/scanner pass, generic client identity incomplete |
| PAYLOAD-CONFLICT REJECTION | PASS |
| CLIENT COMMAND DURABILITY | FAIL universal claim; Phase 1L scanner passes |
| PERSIST-BEFORE-SEND | FAIL universal claim; Phase 1L scanner passes |
| APP RESTART RECOVERY | PASS deterministic scanner fixtures; real-device MANUAL REQUIRED, broader client gaps remain |
| NO RECOGNITION ON REPLAY | PASS for durable scanner command path |
| PRIVATE INSTALLED-BUILD PARITY | FAIL certification gate; capture binary passes, inventory handoff unproven |
| TRADE/WISHLIST SAFETY | NON-BLOCKING preference-only paths; combined completion safely blocked |
| TENANT ISOLATION | PASS tested local boundaries, no production freshness assertion |
| PHYSICAL DEVICE ACCEPTANCE | MANUAL REQUIRED |

Final decision: **PHASE 1 INCOMPLETE**.

Remaining software work is precise: preserve missing-price provenance in active portfolio valuation; close physical-attribute/provider-conflict gaps across active consumers; migrate generic stock-edit clients to the existing durable immutable intent contract; certify the installed agent's cloud-to-inventory handoff against the same recovery guarantees. Standalone preference completion and dormant demo components are not substituted for those blockers. Phase 2 remains blocked. Production inventory, batch CS-000023, POS, Square, tenant settings and hardware certification remain unchanged.

Final hygiene checks: scoped credential/private-key/JWT pattern audit passed for the three Phase 1M files and 355 built browser JavaScript bundles; this is a scoped check, not a claim of exhaustive secret detection. `git diff --check` passed. Fresh SHA-256 comparison confirms all three pre-existing generated files remain byte-identical to their pre-audit state. The synthetic Supabase acceptance stack was stopped with volumes preserved; the separate recovery container was not changed. No files were staged, committed, pushed or deployed in Phase 1M.

## PHASE 1N — SEMANTIC INTEGRITY + UNIVERSAL MUTATION IDENTITY + AGENT HANDOFF

### Architectural stop: one valuation column has incompatible units

Status: **PHASE 1 SOFTWARE INCOMPLETE**. The owner requested: “If another architectural conflict is discovered: STOP. Document it. Do not create parallel inventory, pricing, identity or retry systems.” That stop condition was reached during the initial active valuation/writer audit, before runtime implementation.

This is a newly established conflict within blocker 1, not an additional product initiative: `inventory_value` is used as both unit price and extended row value. Correcting null handling alone would leave materially incorrect known totals and quantity-change calculations.

| Evidence in current local baseline | Meaning |
|---|---|
| `supabase/migrations/20260924235138_acquisition_purchase_authority.sql:235` | Saves `unitMarketValueAtAgreement` on the purchase line, explicitly per unit. |
| Same migration, line 247 | Calls existing `create_inventory_item_with_event` with `quantity = line.quantity` but `inventory_value = unitMarketValueAtAgreement`, without multiplying by quantity. |
| `supabase/migrations/202608120002_inventory_event_ledger.sql:442` | Existing create writer stores the supplied `inventory_value` without unit-to-total conversion; missing values become zero. The forward POS installation preserves this behavior. |
| `supabase/migrations/20260925024439_inventory_mutation_idempotency.sql` | Phase 1K adds authorization, immutable fingerprint and receipt/replay to the existing function; it does not normalize valuation units. Thus idempotent delivery does not fix the meaning of the value. |
| `src/lib/collector-portfolio-server.ts:55–67` | Treats the field as extended row value; divides it by quantity to produce unit market value. Binder/portfolio aggregates sum it. |
| `src/components/dashboard/tools/CsvConversionEngine.tsx:679–681`, `src/lib/inventory-persistence.ts` | Active CSV import constructs `unitMarketValue = price`, `value = price * quantity`, then stores `value` as `inventory_value`. This writer uses total-row semantics. |
| `supabase/migrations/20260922212715_collector_removal_position_authority.sql:139–146` | Scales `inventory_value` by remaining quantity / prior quantity: requires total-row semantics. |
| `supabase/migrations/202608260001_collection_location_authority.sql:114–119` | Splits value proportionally between positions: also requires total-row semantics. |
| `supabase/migrations/202607280004_inventory_persistence.sql:22` and create writer above | `NOT NULL DEFAULT 0` and explicit missing-to-zero conversion erase the distinction between some historical unpriced rows and genuine observed zero. |

Source-derived counterexample (not a production mutation or claimed live observation): three cards priced at $10 each enter the financial receipt writer with `inventory_value = 10`. Portfolio reports $10 total and approximately $3.33 each. CSV import of the same price/quantity stores $30. Removing one card from the receipt-created row proportionally leaves approximately $6.67 rather than $20. Both operations can be individually idempotent and still disagree on business meaning.

No production rows were inspected to infer incidence; no claim is made that a particular production batch has this defect. The evidence concerns active repository writer/reader contracts. Historical data cannot be normalized safely from a numeric zero or quantity alone.

### Proposed resolution for owner review, not implemented

1. Establish `inventory_value` as extended current-row market value, consistent with existing portfolio, split and removal behavior. Keep explicit unit quotes separate in existing payload/provenance fields. Preserve the historical `unitMarketValueAtAgreement` and financial cost basis unchanged.
2. Use existing `IntelligenceValue` availability/provenance vocabulary. Unknown must remain unavailable, genuine evidenced zero must remain zero, and mixed aggregates must expose known subtotal plus unpriced count/coverage. Do not infer that every historical zero is either observed or unpriced.
3. Correct the purchase-receipt caller in a forward migration, not by editing an applied migration. Coordinate any nullable storage/availability representation with the existing create writer and readers. This is a single shared value contract, not a second pricing model.
4. Treat legacy ambiguous rows as insufficient data unless trustworthy source metadata proves the interpretation. Any historical correction requires a separate evidence-based plan; no blanket multiplication, nullification or acquisition-history rewrite.
5. Rehearse multi-quantity create, removal and split across receipt/import/scanner paths, alongside the requested known/unknown/real-zero cases and ledger/idempotency invariants. Only then resume the other three blockers.

The specific decision needed is approval of that shared total-row/availability contract and a forward-only implementation under the existing authority. No production application is requested or implied.

### Other audit observations retained, not implemented

- Generic mobile collector edits still use owner/item/type keys across distinct intents; mobile location initial/replay identity differs. Web collector API creates keys from a new server timestamp. Those are blocker 3's existing command-identity gaps.
- Active CSV save invokes `persistInventorySnapshotDiff`, which upserts complete records outside the command receipt path. Its quantity, identity, valuation and retry semantics must be audited as a stock writer; labeling it a non-financial import is not equivalent to certifying universal inventory identity. Main `/dashboard/inventory` uses CollectorWorkspace; the older InventoryWorkspace autosave implementation must not be mislabeled as the active main route.
- Existing unknown-condition/finish/language and provider-disagreement findings remain blocker 2. No inference/default paths were removed this phase.
- Installed agent still produces capture data, not a canonical-card inventory command. Phase 1M's actual-DLL capture evidence remains valid historical evidence, but no new downstream integration fixture or certification was performed before this stop. Blocker 4 remains open.
- Standalone trade/wishlist preferences remain non-blocking. No new queue, pricing abstraction, alternate writer, migration or installer was created.

### Validation and hygiene at the stop

Before any runtime editing, reran the package-script baselines: **1,038 root tests PASS; 613 mobile tests PASS**. Logs: local `%TEMP%\td-phase1n-baseline-root.log` and `%TEMP%\td-phase1n-baseline-mobile.log`.

No runtime source changes were made. Database/server regressions, TypeScript, lint, build, browser recovery and 403 installed-DLL assertions retain their Phase 1M evidence; they were **not rerun in Phase 1N**, and are not represented as new closure passes. Per the explicit architectural stop, full implementation validation is deferred until the contract decision. No physical tests were performed. The Phase 1M manual A–O script remains unchanged.

Only this report was edited in Phase 1N. The Phase 1M diagnostic files and report work remain local. Pre-existing AGENTS.md, next-env.d.ts and tsconfig.tsbuildinfo must remain unstaged and byte-identical. Nothing was committed, pushed or deployed. No production settings, inventory, POS, Square, CS-000023, scanner installation or pairing state was changed.

### Full blocker recheck at stop

PASS below denotes the existing tested boundary, not a new universal implementation claim. All unresolved software remains blocking.

| Gate | Status | Basis |
|---|---|---|
| TRANSACTIONAL INTAKE | PASS | Existing atomicity tests; valuation units are separately blocked |
| PURCHASE LEDGER AUTHORITY | PASS | Existing single-ledger financial authority, not inventory valuation equivalence |
| ACQUISITION ANALYTICS | PASS | Existing ledger-derived spending/count metrics |
| INTELLIGENCE PROVENANCE | BLOCKER | Active missing-price portfolio presentation remains |
| MISSING PRICE SEMANTICS | BLOCKER | Unknown/zero conflation plus unit/total contract conflict above |
| UNKNOWN ATTRIBUTE SAFETY | BLOCKER | Active scanner/shared matching defaults and conflicts |
| IMPORT ATTRIBUTE SAFETY | BLOCKER | Active incomplete-identity/language fallback paths |
| SHARED OFFLINE QUEUE | PASS | Prior supported-runtime coordinator fixtures; baseline unchanged |
| SERVER IDEMPOTENCY | PASS | Phase 1K tested RPC boundary, no universal writer claim |
| STALE RETRY SAFETY | BLOCKER | Generic client coverage incomplete |
| PAYLOAD CONFLICT | PASS | Existing repaired RPC rejects same ID/different payload |
| CLIENT COMMAND DURABILITY | BLOCKER | Scanner repaired; not universal across supported writers |
| PERSIST BEFORE SEND | BLOCKER | Generic clients incomplete |
| APP RESTART RECOVERY | MANUAL REQUIRED | Deterministic scanner fixtures pass historically; physical test not performed |
| GENERIC INVENTORY EDIT IDENTITY | BLOCKER | Target-based and timestamp-based intent keys remain |
| GENERIC EDIT RETRY SAFETY | BLOCKER | Broader callers not migrated/rehearsed |
| SCANNER RECOVERY | PASS | Existing deterministic durable command evidence; physical test separate |
| INSTALLED AGENT DOWNSTREAM PARITY | BLOCKER | Capture DLL evidence does not certify downstream stock handoff |
| TENANT ISOLATION | PASS | Previously tested local authority boundaries; production not accessed |
| PHYSICAL ACCEPTANCE | MANUAL REQUIRED | A–O script retained, not executed |

**PHASE 1 SOFTWARE INCOMPLETE**. PHYSICAL ACCEPTANCE = MANUAL REQUIRED. Phase 2 has not begun. Resume only after the newly documented valuation-contract conflict is resolved with the owner; do not work around it with a parallel model.

## PHASE 1O — INVENTORY VALUATION CONTRACT REPAIR

### Accepted invariant and new stop condition

The owner has resolved the Phase 1N valuation-unit decision: `inventory_value` is **TOTAL ROW / LOT MARKET VALUE**, Q × authoritative unit market value when known. Unknown is unavailable, not numeric zero. Acquisition unit cost, total cost basis and market value remain separate. That decision is accepted and is not reopened here.

Phase 1O's initial repository audit found a further financial semantic: **public customer request pricing is derived from inventory market valuation**. The owner explicitly required: “If a further incompatible financial semantic is discovered: STOP. Document it. Do not hide it behind conversion logic.” Implementation stopped before any runtime edits, as required.

This is not merely another reader needing division by quantity. Converting a market valuation to a per-unit number would still silently decide that it is the seller's customer-facing request price. The total-row decision does not authorize that selling-price policy.

### Exact active call path and evidence

- `src/lib/showcase.ts::getShowcase` calls `get_public_showcase_inventory` for an enabled public profile.
- `supabase/migrations/202609100003_showcase_image_projection.sql:29` projects `greatest(0, coalesce(data.marketPrice, inventory_value, 0))` as `public_price`; line 36 also uses it for minimum-price filtering.
- `src/app/api/showcase/requests/route.ts:11` calls `submit_showcase_request`; this is an implemented request endpoint, not dormant demo code.
- `supabase/migrations/202609090001_showcase_v1.sql:157` assigns the same fallback to a variable named `unit`.
- That function persists `unit_price_snapshot = unit`, `line_total = unit * requested_quantity`, and the resulting `showcase_requests.subtotal`.
- Repository search found the original submission function and the later public-projection replacement; no later definition removing this fallback was found.

Source-derived example, not a production transaction: with owned quantity 3, known unit market value $10 and correctly stored total $30, and no `data.marketPrice`, Showcase advertises $30 as its unit request price. A request for two copies records $60. Dividing to $10/$20 would fix the units but would still assume the owner intends to quote market value. Conversely, unknown valuation becomes a $0 request snapshot. Neither policy is established by this phase's market-value decision.

These are **customer request snapshots, not proof of completed sales, charges or payments**. No production profile, row, request, sale or payment was queried or changed. Production incidence and enabled-profile configuration were not assessed.

### Inventory-value usage audit at the stop

Repository search enumerated runtime, SQL, types and test references before code changes. The initial local evidence lists are `%TEMP%\td-phase1o-value-files.txt` and `%TEMP%\td-phase1o-value-usages.txt`; they contain repository paths/source matches only. The table records classifications established so far. The full per-usage audit and implementation were interrupted by the required stop; this is **not** a claim that every import/export/legacy consumer has been certified.

| File / function group | Reader / writer | Current assumed semantics | Quantity / unknown handling | Required action, not implemented |
|---|---|---|---|---|
| `20260924235138_acquisition_purchase_authority.sql` receipt | Writer | UNIT_VALUE | Agreement unit market stored without Q multiplication; missing becomes 0 | Forward caller repair; preserve separate agreement/cost data |
| `202608120004_collection_intake.sql` historical finalizer | Historical writer | UNIT_VALUE | Same unit fallback | Do not edit applied file; verify current delegate only |
| `202608120002_inventory_event_ledger.sql` create and collector mutation | Writer/event calculation | AMBIGUOUS | Stores input unchanged; emits it as event unit value and multiplies by Q for event total; quantity edit only changes Q | Correct current forward function/event semantics together with existing fingerprint/replay |
| `20260921220051_pos_forward_installation.sql` embedded inventory functions | Forward-installed inventory bodies | AMBIGUOUS | Repeats create/event and split bodies | Inspect current definitions; never replay/edit historical migration |
| `inventory-persistence.ts` / active `CsvConversionEngine.tsx` | Writer/reader | TOTAL_ROW_VALUE | Import price × Q; missing/malformed becomes zero; snapshot stores row value | Explicit import unit/total schema and unavailable state |
| `collector-portfolio-server.ts` / portfolio item/binder types | Reader/type/aggregate | TOTAL_ROW_VALUE | Divides by Q for unit; sums row values; absent values become zero | Nullable trusted values, known subtotal and coverage |
| `mobile/services/collector-workspace.ts` shared collector normalizer | Reader | TOTAL_ROW_VALUE | Prefers explicit unit metadata, else divides positive row total; genuine zero treated absent | Preserve legitimate zero separately from unavailable/legacy uncertainty |
| `202608260001_collection_location_authority.sql` split | Writer | TOTAL_ROW_VALUE | Proportional total allocation; handles null branch but underlying column historically NOT NULL | Preserve null, established precision and audit history |
| `20260922212715_collector_removal_position_authority.sql` removal | Writer | TOTAL_ROW_VALUE | Remaining/prior Q scales total; no financial acquisition | Preserve provenance, cost and event history |
| `202609070001` / `202609070002` Chaos commit bodies | Writer/merge | TOTAL_ROW_VALUE | Quantity/value accumulation | Audit current forward definition and unknown propagation before change |
| `202607280004` / `202607300001` schema declarations | Storage/type | AMBIGUOUS | NOT NULL DEFAULT 0 loses availability | Forward contract required; do not infer old zero provenance |
| `dashboard/analytics-summary.ts`, business intelligence/command center | Reader/aggregate | TOTAL_ROW_VALUE | Sums row values; numeric fallback hides missing coverage | Known subtotal + coverage; preserve purchase-ledger acquisition metrics |
| `inventory/intelligence.ts` | Reader/recommendation | TOTAL_ROW_VALUE | Missing/zero valuation flagged together | Separate observed zero from unavailable |
| `deck-architect/server.ts` | Reader | TOTAL_ROW_VALUE | Explicit total-to-unit conversion | Audit legacy provenance, retain unit conversion only for trusted totals |
| `binder-shares/route.ts` | Reader/display | TOTAL_ROW_VALUE | Finite-number fallback zero | Availability-aware share output |
| `selling/candidate-service.ts` | Reader/listing candidate | AMBIGUOUS | Unit `data.market_price` falls back to row `inventory_value`, passed as candidate `marketPrice` | Preserve unit market vs selling-price distinction; no silent conversion policy |
| `integrations/discord/inventory/route.ts` | Reader/export | AMBIGUOUS | `price` uses marketPrice or row total or zero | Define exported unit/total/availability explicitly |
| `showcase_image_projection.sql`, `submit_showcase_request` | Public quote reader / financial snapshot writer | UNIT_VALUE plus selling-price conflation | Row value used as public unit quote and multiplied by requested Q; unknown becomes 0 | **STOP: explicit request-pricing policy needed** |
| `collector-data.ts`, collector client/storage/binder/trade data loaders | Read/select/sort | DISPLAY_ONLY at query layer | Select row value or order/cursor by it; normalization downstream | Keep cursor/order semantics consistent with actual total, audit display normalizers |
| `owned-inventory-query.ts`, `card-workspace.ts`, GlobalSearch/Chaos UI | Read/projection/type | DISPLAY_ONLY at projection layer | Value projected; downstream contract must carry availability | Do not infer full certification from SQL select alone |
| POS sale/refund SQL families | Stock update/snapshot | TOTAL_ROW_VALUE | Sales prorate row total; refunds use captured inventoryValueUnit; null-to-zero cases exist | Compatibility audit required; POS/Square behavior unchanged in this phase |
| `dashboard-v2/business/ReportsWorkspace.tsx` | Display fixture | DISPLAY_ONLY | Static report fixture | Distinguish demo from business data; not a production value writer |
| Purchasing product-lookup route | Legacy writer | UNIT_VALUE | Market/low price directly assigned | Confirm existing write gate; no unsafe legacy re-enablement |
| Acquisition/collector/removal/showcase/portfolio/intelligence tests | Fixtures/assertions | Mixed assumptions | Some assert counts/authority without valuation units | Add requested 12 semantic cases after policy resolution; existing passing tests do not certify units |
| Staging repair SQL / historical migration copies | Historical definitions | Mixed | Historical deployment bodies | Evidence only; no edits/replay |

### Proposed decision needed to resume

Recommended: Showcase request prices should use an **explicit owner-configured per-unit asking price**, independent of market valuation and acquisition cost. When absent, show price unavailable and require owner pricing before storing a priced request; never default to free. Reuse the existing asking-price representation after verifying its owner/workspace scope. Do not create a second price store or modify historical request snapshots.

Alternatively, if the intended Showcase product contract is specifically a **market-estimate request**, explicitly approve that behavior and its labeling: a trusted unit market estimate, never a row total, with unavailable values requiring review. This is a business-policy choice; the implementation must not choose it by hiding division inside a helper.

Once that decision is made, resume the already approved total-row repair: forward-only writer/reader changes; explicit unavailable values; genuine-zero support; separate cost basis; no legacy guessing; idempotent replay and unchanged payload fingerprints for existing logical retries. No prior migration or historical request/inventory/purchase data should be rewritten.

### Implementation, testing and current verdict

- Receipt, CSV, split/removal, portfolio and nullable-storage repairs: **not implemented**, stopped during audit.
- Safe historical migration: **none proposed or performed**; ambiguity remains explicit.
- Requested 12 semantic regressions, DB/server/browser/build validation: **not run for Phase 1O**, because no implementation proceeded beyond the mandated stop. Prior phase results remain historical evidence, not a new Phase 1O pass.
- Physical acceptance: **MANUAL REQUIRED**, existing script retained.
- Missing-price semantics: **BLOCKER**; total-row invariant approved, customer request-pricing policy unresolved.
- Active unknown-attribute inference: **BLOCKER**, unchanged.
- Generic inventory-edit durable identity: **BLOCKER**, unchanged.
- Installed-agent downstream parity: **BLOCKER**, unchanged; installed capture assertions do not prove stock parity.

**PHASE 1 SOFTWARE INCOMPLETE**. No runtime code, schema, production data, POS/Square setting, installer or pairing state was changed. No push/deployment/Phase 2. Only this report was updated, with existing Phase 1M work retained locally and unrelated generated files preserved.


### Phase 1O follow-up — owner price policy accepted and implemented

**Implemented locally; requires reviewed migration/application promotion. Nothing pushed or deployed.** The prior stop above is historical evidence, not the current gate. The owner approved an explicit per-unit asking price for Showcase. No market-price fallback or new parallel price store is permitted.

#### Authoritative money contract

| Concept | Representation | Contract |
|---|---|---|
| Row market valuation | `inventory_items.inventory_value` | Total row/lot market valuation Q × known unit quote. NULL is unavailable, genuine zero is known. |
| Unit market estimate | Existing `unitMarketValue` / provider market fields | Reference only; explicit row-total imports normalize unit reference by quantity. Receipt uses the immutable market quote **at agreement**, not a claim of a fresh live market price. |
| Customer asking price | Existing `inventory_items.asking_price` | Explicit owner unit price. Showcase snapshots this amount × requested quantity; never falls back to market value or cost. |
| Acquisition cost | Existing purchase ledger line `unit_cost` / `total_cost`, linked cost-basis metadata | Agreed allocation independent of valuation; valuation changes cannot rewrite the purchase ledger. |

Example verified through actual SQL: 3 units × $10 market = $30 row valuation; agreed purchase $24 gives $8 unit cost. Separate Showcase example: quantity 3, row value $30, asking price $11.99; request 2 snapshots $23.98. Changing market reference to $50 leaves asking price and historical request snapshot unchanged.

#### Forward migrations and historical policy

- `20260925061021_inventory_total_valuation_contract.sql`: permits NULL/no implicit default, documents column semantics, repairs receipt/create/event/quantity mutation bodies while retaining original permission and idempotency code. Split destination keeps NULL. Existing Chaos writer retains quantity multiplication but stops inventing zero; mixing new value with an unproven legacy total produces unavailable valuation instead of certifying that total.
- `20260925061022_showcase_explicit_asking_price.sql`: public projection/minimum-price filter use asking price; request uses canonical owner + workspace, locks stock, rejects missing/invalid asking price, and rejects a changed submitted quote. Historical requests remain untouched. It also repairs the existing invalid PL/pgSQL subtotal-variable qualification exposed by executing a real request.
- No data backfill. No existing inventory/event/purchase/request rows are updated by either migration. Newly persisted contract values are tagged `data.inventoryValueSemantics = total_row_v1`. This marker is added **after** command fingerprinting, not to the caller's immutable payload.
- Untagged historical amounts remain stored and are classified **UNKNOWN_LEGACY_SEMANTICS**, excluded from trusted valuation. No historical row is declared known-unit or known-total merely from its source label, timestamp, quantity or current market price. There is no automated safe legacy conversion in this candidate.
- Dynamic function changes fail on incompatible core definitions. These are one-time forward migrations, not a production replay script. Rehearsal does not authorize production application.

#### Reader/writer audit disposition (supplements the complete initial matrix)

| File/function family | Final semantics / quantity handling | Unknown handling / repair |
|---|---|---|
| Receipt `finalize_intake_purchase` | TOTAL_ROW_VALUE: immutable agreed unit market quote × line quantity | NULL preserved; cost allocation unchanged. Positive offers with missing allocation weights still require review. |
| `create_inventory_item_with_event` | TOTAL_ROW_VALUE; creation event unit = total/Q, total = row total | No implicit zero; marker stored outside fingerprint. |
| `apply_collector_inventory_mutation` | Proportionally recomputes proven total for new quantity | Legacy amount not reclassified; event monetary fields unavailable for ambiguous legacy values. |
| `move_inventory_lot_quantity`, `remove_inventory_lot_quantity` | TOTAL_ROW_VALUE; existing proportional precision logic retained | Unknown source/destination stays NULL. No purchase history rewrite. |
| Chaos commit writer / `ChaosSortWorkspace` projection type | Existing total calculation retained; no invented zero | Nullable type, forward marker, conservative merge with legacy. Local Supabase actual function inspected: marker present and prior `coalesce(marketPrice,0)` absent. |
| CSV templates / `CsvConversionEngine` | Explicit total takes precedence, otherwise known unit × Q once | Malformed explicit total stays unavailable; missing/malformed price and cost basis stay NULL. Explicit owner asking price separate. |
| `inventory-persistence` | Persists supplied row total, not unit value | Parses NULL without zero. Asking price only written when explicitly present; unrelated saves do not reset it. |
| Shared `mobile/services/inventory-valuation.ts` | One shared money/valuation parser and known-subtotal helper, re-exported for web | Strict nonnegative finite amounts; real zero accepted. No extra persisted valuation system. |
| Shared collector normalizer, card detail/search, mobile/web location/binder/trade loaders | Trusted row total / quantity, or explicit unit market metadata | Legacy fallback removed. Location/binder/query-only loaders normalize through the shared collector service. |
| Collector portfolio server/types/workspace/binder UI | Sum trusted TOTAL_ROW_VALUE | Nullable all-unpriced aggregate, known subtotal + unpriced rows including binder-page summaries. |
| Dashboard analytics, business capital, inventory attention, bulk-purchase history display | TOTAL_ROW_VALUE subtotals | Unknown totals unavailable; explicit zero counts as covered; unsupported projected profit unavailable. Exact missing-price predicate recognizes legacy/unavailable values. |
| Global Search | Unit reference from shared collector; placement total = unit × placement quantity | Unknown placement/group values no longer rendered as zero; groups show known subtotal and unpriced count. |
| Deck Architect, binder sharing, selling candidates, Discord inventory projection | Unit reference or trusted total/Q | No raw legacy total interpreted as per-unit price; binder share no longer uses ambiguous `data.value` as unit. |
| Mobile collection price pagination | Cursor now uses exact raw database row-total sort key, not normalized unit price | NULLs last and included in subsequent pages. Cursor is ordering metadata, not evidence that a legacy amount is a trusted valuation. |
| Showcase public component / request RPC | ASKING_PRICE ONLY; canonical price snapshotted at request time | “Price not set”; Add/Continue blocked; changed price returns `SHOWCASE_PRICE_CHANGED`; missing price returns `SHOWCASE_PRICE_REQUIRED`. No payment processing implemented or enabled. |
| TCGplayer export | Explicit owner asking price exports as Marketplace Price | Missing asking price remains blank; provider market/low price never silently fills it. |
| Legacy bulk purchase and product-lookup writers | Historical conflicting code remains behind the previously established legacy write gate | Gate not reopened. Bulk historical display repaired; blocked import preview is not certified as a supported acquisition writer. |
| POS sale/refund migration families | Existing proportional total-row stock handling | Not modified or enabled. No claim of new POS physical/payment acceptance. |
| Historical/staging SQL, backup trees, static ReportsWorkspace fixture | Historical / DISPLAY_ONLY | Not edited or presented as current financial authority. |

CSV schemas: Deck Builder `Total Price` is row total; `Single Price`/`Single Foil Price` are unit reference. Deckbox `My Price` and TCGplayer `TCG Marketplace Price` are explicit owner asking price. Dragon Shield `MARKET`, TCGplayer `TCG Market Price`, and Universal `Market Price` remain unit reference. Price Bought / Cost Basis remain cost. Other template price columns retain their mapped unit-reference semantics. A malformed explicit total does not silently fall back to a unit quote.

#### Rehearsal and regression evidence

Local synthetic data only; no production reads/mutations needed. The final browser harness uses real Next.js → API → local Supabase Auth/PostgREST/RLS → database, not mocked request success.

| Gate | Result |
|---|---|
| Root tests | PASS: 1,045 (baseline 1,038 + 7 valuation/import/shared-reader tests) |
| Active mobile tests | PASS: 613 |
| Database | PASS: 28 current + 28 legacy = 56; retains 44 baseline checks plus 12 valuation/Showcase checks |
| Server idempotency | PASS: 23 existing checks; additional post-valuation create/edit replay and changed-payload conflict exercised in each DB variant |
| Required money cases | PASS: receipt 3×$10=$30; receipt 1×$10=$10; NULL/zero distinct; explicit CSV $30 remains $30; split $30→$20+$10; NULL split; removal $50→$30; mixed/all-unknown portfolios; independent $24 cost; quantity edit; legacy object unchanged |
| Showcase database | PASS: explicit $11.99 quote, two-unit $23.98 request, changed quote denied, no market fallback, missing price denied, stock unchanged |
| Authenticated browser | PASS: draft/reload, receipt/retry/concurrent duplicate, cost protection, same-owner other-workspace/other-user/anonymous denial; real Showcase disabled unpriced Add and $23.98 request |
| Browser queue | PASS: Web Locks cross-tab recovery, worker exclusion and reload persistence |
| Installed agent regression | PASS: 403 synthetic capture/security/recovery assertions on installed 1.3.1 assembly; no live pairing/device state touched. **Not downstream inventory parity or physical acceptance.** |
| TypeScript | PASS: root and active mobile |
| ESLint | PASS: no errors; existing warning baseline retained (root 551, mobile 3) |
| Production build | PASS: isolated `next build --webpack`, 169 pages; not deployed |
| Dependency audit | PASS: 0 vulnerabilities at requested production-dependency threshold |
| Candidate secret/artifact scan | PASS: no detected credential patterns or recovery/installer/private-key artifacts in candidate files; not a claim of formal security certification |
| `git diff --check` / generated files | PASS; pre-existing AGENTS.md, next-env.d.ts, tsconfig.tsbuildinfo SHA-256s unchanged and unstaged |

During browser-fixture preparation, direct synthetic inventory insertion without an authenticated owner context correctly raised `INVENTORY_WORKSPACE_FORBIDDEN`. The fixture now supplies its synthetic owner's transaction-local claims; no production guard was changed. During receipt-case preparation, a positive offer with a missing allocation weight correctly raised `ACQUISITION_ALLOCATION_REVIEW_REQUIRED`; the missing-market test uses a legitimate zero-cost receipt, rather than bypassing allocation review.

Detailed test logs and screenshots remain outside Git under `%TEMP%/td-phase1o-*`. Build/browser work ran in the existing detached temporary validation worktree so generated files in the working branch remain byte-identical. The disposable local acceptance stack was stopped after testing; no recovery artifacts were deleted or overwritten.

#### Remaining Phase 1 gates

- **Missing-price/total-row semantics:** implemented and rehearsed for the supported forward paths above; historical ambiguous values remain explicitly unavailable. Requires separate reviewed promotion. No claim that legacy blocked acquisition writers are now supported.
- **Active unknown attribute inference / import attribute safety:** BLOCKER, unchanged. This price repair does not infer condition, finish or language or close the existing shared-provider identity conflict.
- **Generic inventory-edit durable identity:** BLOCKER, unchanged. RPC replay safety does not replace the remaining target/timestamp-based client intent keys.
- **Installed-agent downstream parity:** BLOCKER. Synthetic capture assertions do not demonstrate the installed agent's end-to-end stock handoff.
- **Physical acceptance:** MANUAL REQUIRED; the existing A–O script remains unperformed. Phase 2 has not begun.

**PHASE 1 SOFTWARE INCOMPLETE.** The Showcase architectural decision is implemented; it is no longer an unresolved policy gate. No push, merge, deployment, production migration, inventory mutation, POS/Square change, scanner installation or pairing change occurred. Earlier phase documentation and diagnostics remain local and unstaged alongside this candidate.


## Phase 1N closure continuation — local candidate, 2026-09-25

**PHASE 1 SOFTWARE INCOMPLETE. PHASE 2 BLOCKED. PHYSICAL ACCEPTANCE = MANUAL REQUIRED.**

This section supersedes older closure statements only for the explicitly repaired paths below. It continues the existing program; no new architectural phase or parallel mutation authority was introduced. The candidate is local and unpromoted. No production database, inventory, CS-000023, scanner pairing, installed agent, POS or Square state was changed. Existing Phase 1O valuation/Showcase changes remain in the working tree. Production freshness is not asserted from local fixtures.

### Price semantics recertification

**MISSING PRICE SEMANTICS = PASS. SHOWCASE ASKING PRICE SEPARATION = PASS**, for the active supported paths in this local candidate, subject to the separately blocked write paths below.

- `inventory_value` is a total row market value, not a unit asking price. Trusted forward records carry `inventoryValueSemantics: total_row_v1`. Legacy ambiguous totals remain unavailable rather than being reinterpreted or rewritten.
- Absent market values remain NULL/unavailable. Explicit numeric zero is distinct. Portfolio aggregations disclose excluded unknown values; all-unknown portfolios remain unknown.
- Unit estimates are multiplied by quantity once when constructing a known total; existing total values are not multiplied again. Split/removal/quantity adjustment behavior remains covered by both database variants.
- Showcase reads explicit owner `asking_price`; missing price displays **Price not set** and disables Add. The server rejects unpriced requests. A row with quantity 3 and internal value $30 can have asking price $11.99; requesting 2 quotes $23.98. Acquisition cost stays independent.
- A fresh source search found no active `inventory_value * quantity` or reversed equivalent in `src/` or active `mobile/`. The active Showcase request calculation uses asking price. CSV unit-to-total conversion, inventory total aggregation, and total-to-unit decomposition are internal valuation operations. Historical SQL, disabled legacy purchase completion and historical mobile snapshots are not current customer transaction paths.
- Actual authenticated browser/API/local database checks verified missing-price rejection and the $23.98 request without changing stock or purchase accounting. This is not a production deployment claim.

### Unknown attributes: repairs and remaining boundaries

Implemented locally:

- Shared ranking requires agreement across all supplied provider IDs. A matching Scryfall ID cannot hide a conflicting TCGplayer ID. Set name/code disagreements remain conflicts.
- Scanner candidates no longer manufacture normal finish or English. Rapid OCR and visual/multi-signal candidates preserve absence.
- `defaultFinishForPrinting` distinguishes `EXPLICIT`, `DERIVED_FROM_AUTHORITATIVE_CATALOG`, and `UNRESOLVED`. Only a provider-confirmed singleton finish can be derived. Multiple finishes, synthetic authority and contradictory explicit finish remain unresolved.
- Continuous scanner omitted condition becomes unknown. Bulk confirmation, manual correction, finalization and collection command construction cannot silently resolve unknown physical attributes. Automatic scanner UI starts with unresolved condition/finish/language.
- Current CSV converter defaults are unrecorded/review-required. Save rejects missing condition, finish, language, set or collector evidence before persisting. Reference matching no longer selects a unique card from the wrong set. TCGplayer resolver no longer turns absent finish into normal; provider SKU search no longer invents Normal/English. A missing resolved finish is not converted to Nonfoil by the client.
- Chaos CSV rows no longer start as NM/nonfoil and only become confirmed when physical-resolution checks pass.

| Active path | Evidence / remaining status |
|---|---|
| Primary/automatic scanner | Missing attributes preserved; save validator rejects unresolved fields. Focused scanner and root/mobile regressions pass. |
| Rapid OCR / magic / multi-signal adapters | Missing language/finish preserved instead of synthetic physical evidence. Root/mobile regressions pass. |
| Continuous/manual scanner confirmation | Bulk/manual correction cannot produce a save with unresolved physical identity; singleton derivation tested independently. |
| Offline scanner command creation/replay | Retains existing frozen canonical command/receipt contract; source-candidate recovery fixtures pass. Does not certify installed agent handoff. |
| Inventory/collection CSV converter | Actual browser missing-attribute import rejected with unchanged stock/ledger. Validated row attributes remain separate from later persistence guarantees. |
| Chaos CSV intake | Convenience defaults removed and local confirmation tightened; SQL commit authority below remains a BLOCKER. |
| Purchasing/provider resolver | Conflicting IDs/set/collector require review; SKU adapter omissions remain empty. Unsafe legacy financial completion remains gated, not re-enabled. |
| Shared resolver variant/printing ambiguity | Eight deterministic ambiguity cases reject authoritative finalization; no first-result or wrong-set proof accepted. |
| Generic direct snapshot import/manual callers | `persistInventorySnapshotDiff` still writes snapshots directly. No universal canonical identity/atomic receipt guarantee; BLOCKER. |
| Chaos live/manual review → cloud commit | `chaos_scan_command` → `commit_chaos_sort_batch` is a separate existing boundary. Current cloud ready check requires review state/name/set/collector but does not independently enforce the full physical condition/finish/language resolution policy. Local CSV protection does not close this server-side gap; BLOCKER. |
| Old `InventoryWorkspace` manual modal | Not the active inventory route (current route uses CollectorWorkspace); not edited or certified as an active entry point. |

Tests cover name-only, same-name/different-printing ambiguity, missing finish/condition/language, collector conflict, ambiguous set and variant; explicit conflicting IDs cannot be outweighed by other matches. These tests do **not** justify universal UNKNOWN ATTRIBUTE SAFETY or IMPORT ATTRIBUTE SAFETY PASS while the direct snapshot/Chaos boundaries remain.

### Generic inventory-edit command repair

`mobile/services/collector-inventory-command.ts` reuses the existing serialized `InventoryCommand`, offline-core coordinator and `apply_collector_inventory_mutation`. It is not a scanner-intent queue or a new SQL writer. Web storage uses localStorage with existing Web Locks; mobile uses the shared durable storage adapter.

Four whole-row edits — quantity, condition, finish, storage — now:

1. Snapshot input and allocate an operation UUID before delivery.
2. Resolve authenticated owner/current workspace and persist the complete command before any business request. Persistence failure means no send.
3. Reject different payload under the same ID. An unresolved command for the same item must be recovered/reviewed before another edit.
4. Send frozen original arguments to the existing RPC. Web retains its authenticated server route and suspended-account check; SQL retains owner/workspace/validation/receipt authority.
5. Accept only a matching owner/workspace/item receipt. A missing/malformed receipt cannot acknowledge success. Conflict/authorization/validation failures remain review-required; uncertain delivery retains the original command.
6. Recover using the saved command, never current form values. Collector detail exposes **Recover pending edits**. New commands are not fabricated when current identity/workspace cannot be established. Old target-key records remain review-held.

Whole-row location assignment on web/mobile now delegates to this same path. No new schema migration was added by this closure continuation.

| Client/path | Endpoint / operation identity / replay | Classification |
|---|---|---|
| Web detail quantity/condition/finish | Existing collector mutations API → apply RPC; durable UUID + frozen arguments, persisted before send, scoped receipt; lost-response browser recovery proved | SAFE |
| Mobile detail quantity/condition/finish | Same serialized command → apply RPC; shared persistent queue, context validation and receipt; source-candidate recovery fixtures | SAFE |
| Web/mobile whole-row location assignment | Same durable storage command → apply RPC; stale retry returns original receipt without moving newer state back | SAFE |
| Primary canonical scanner create/replay | Existing stable intent → `create_inventory_item_with_event`; frozen payload/receipt, Phase 1L source-candidate tests retained | SAFE within that tested source path |
| Partial-lot move/remove | Existing `move_inventory_lot_quantity` / `remove_inventory_lot_quantity`; API still derives timestamp keys per call; stable immutable client operation not completed | NEEDS REPAIR |
| Bulk removal | Frontend ID per click, API rereads quantity and includes it in derived key; uncertain partial completion/retry after changed quantity is not proven safe | NEEDS REPAIR |
| CSV/direct snapshot inventory import and snapshot-based edits | `persistInventorySnapshotDiff` direct upsert/delete in chunks; generated row IDs per import, no durable operation receipt, possible partial writes | NEEDS REPAIR |
| Installed bridge → Chaos browser/cloud album → batch commit | Capture identity is durable but is not the shared inventory mutation command; downstream equivalence not demonstrated | NEEDS REPAIR / parity BLOCKER |
| Notes and user preferences / wishlist / trade flags | Owner-scoped metadata/preference writes; no quantity or acquisition event. Uncertain legacy queued preference completion stays review-only | NON-AUTHORITATIVE |
| Gated legacy purchasing/bulk completion | Fails closed before unsupported authoritative completion; no speculative retries | NON-RETRYABLE BUT SAFE while gated |

No unknown-result stock operation above is called safe merely because the UI requires a manual retry. The remaining paths must use the existing domain RPC/receipt contract, not a second generic snapshot mutation system.

Actual local PostgreSQL assertions using the new command coordinator prove:

| Required case | Result |
|---|---|
| Same quantity edit twice | PASS — one event/effect |
| Location response lost, restart and replay | PASS — one event/effect with original arguments |
| Stale quantity replay after newer edit | PASS — newer quantity preserved |
| Stale location replay after newer move | PASS — newer location preserved |
| Same operation ID, changed payload | PASS — server conflict; no second mutation |
| Concurrent duplicate edit | PASS — one event |
| Condition correction | PASS — one condition_changed event, unchanged quantity, no acquisition event |
| Notes change | PASS — no new inventory event; browser accounting totals unchanged |

The real browser fixture additionally commits through the actual API, aborts the response after SQL success, reloads, clicks recovery, and proves one quantity effect and one event. The separate browser queue test retains cross-tab Web Locks ownership/reload evidence. These are bounded proofs for the repaired commands, not blanket bulk/import certification.

### Installed 1.3.1 downstream trace and parity decision

Installed artifact: `1.3.1+3269e252717817e7355617eef99244be1eeb80b9`, private installation under `%LOCALAPPDATA%/Programs/TradingDocksScannerBridge`. Core assembly SHA-256: `9F4B39A0984815026D20872B01BDBFA671853B265187C88F00B9DA616085692F`.

The installed-artifact harness copies the actual assembly bytes into an isolated temporary fixture directory and exercises synthetic devices/state on a separate loopback port. It does not restart/re-pair the owner's agent, alter its journal or take a physical capture. **403 assertions pass**, but they stop at the capture/security/recovery boundary.

Actual handoff:

`installed BridgeHost capture + signed session binding → local-scanner-provider → authenticated /api/chaos-sort/scans → chaos_scan_command reserve/received + private image storage → browser recognition/review → explicit batch commit → commit_chaos_sort_batch`.

The installed agent owns image acquisition, capture identity and recovery. It does **not** start with a confirmed canonical card, construct `InventoryCommand`, call `apply_collector_inventory_mutation`/`create_inventory_item_with_event`, or interpret their inventory receipts. Cloud image acceptance followed by `/v1/capture/{id}/ack` is not an inventory commit acknowledgement. Its capture duplicate/recovery behavior cannot substitute for stock idempotency.

- Same logical mutation contract / repaired inventory RPC: **not demonstrated** through this handoff. Direct agent stock writes were not found, but the existing Chaos batch commit is a separate server boundary.
- `ALREADY_COMMITTED`: native agent has no inventory-level handling; current shared source command consumer accepts an authoritative matching composite receipt on replay. Chaos commit uses its own batch state/replay handling; equivalence is unproven.
- `IDEMPOTENCY_CONFLICT`: native agent has no stock-command handling. Shared source clients retain conflicts for review; the installed downstream chain has not passed that inventory fixture.
- Restart/retry: installed capture journal recovery passes synthetic assertions. End-to-end stock/event outcome following installed capture recovery remains uncertified.

| Installed downstream fixture | Status | Exact limitation |
|---|---|---|
| Confirmed canonical normal save | BLOCKER | No fixture connects installed capture bytes to authenticated Chaos review and stock receipt |
| Duplicate delivery | BLOCKER | Capture duplicates tested; inventory duplicate outcome through installed handoff not tested |
| Lost response then retry | BLOCKER | Source/shared RPC passes; installed → Chaos commit response-loss seam absent |
| Same key / changed payload | BLOCKER | Shared RPC conflict passes; installed downstream mutation identity not proven equivalent |
| Review-required identity | BLOCKER | Capture layer has no canonical identity policy; cloud commit physical-attribute gap remains |
| Invalid mutation | BLOCKER | Native artifact has no stock command; downstream invalid command fixture absent |
| Quantity mutation | BLOCKER | Not a native agent capability; shared browser handoff parity not demonstrated |
| Location mutation | BLOCKER | Not a native agent capability; shared browser handoff parity not demonstrated |
| Restart/recovery handoff | BLOCKER | Journal recovery passes only through capture acceptance, not inventory commit |

Missing capability is an integration fixture that runs the installed assembly against an isolated authenticated web/cloud-album stack, delivers a synthetic signed capture with its original binding, completes canonical review and explicit inventory commit, and compares inventory/event receipts under retry/conflict/restart. Existing C# installed fixtures and the 12 source/private-candidate command recovery scenarios cover opposite sides, not their connection. Physical hardware availability is not used as an excuse to label this software seam passed. No new architecture conflict is declared; this is the existing G20 parity blocker.

### Required software closure matrix

Statuses below refer to this local candidate and tested scope, not deployed production.

| Gate | Status | Basis |
|---|---|---|
| TRANSACTIONAL INTAKE | PASS | Existing authoritative purchase/receipt transaction and browser/DB regressions |
| PURCHASE LEDGER AUTHORITY | PASS | Ledger controls cost/history; unsupported legacy completion remains gated |
| ACQUISITION ANALYTICS | PASS | Purchase-derived totals, later metadata edits do not create acquisitions |
| INTELLIGENCE PROVENANCE | PASS | Unsupported metrics remain unavailable; sourced/calculated distinctions retained |
| MISSING PRICE SEMANTICS | PASS | NULL/zero, total-row semantics, forward calculations and legacy exclusion verified |
| SHOWCASE ASKING PRICE SEPARATION | PASS | Explicit asking only; missing disabled; server $23.98 quote/request verified |
| UNKNOWN ATTRIBUTE SAFETY | BLOCKER | Repaired scanner/resolver consumers; Chaos cloud commit remains insufficiently guarded |
| IMPORT ATTRIBUTE SAFETY | BLOCKER | CSV negative browser case passes; snapshot/canonical-import boundary remains incomplete |
| SHARED OFFLINE QUEUE | PASS | Persistent coordinator, cross-tab locking and restart/replay regressions retained |
| SERVER IDEMPOTENCY | BLOCKER | Shared create/apply RPC passes; distinct partial/bulk/Chaos/snapshot paths not universally certified |
| STALE RETRY SAFETY | BLOCKER | Repaired setters/source scanner pass; remaining paths lack universal proof |
| PAYLOAD CONFLICT REJECTION | BLOCKER | Shared RPC rejects conflicts; not established across all authoritative writers |
| CLIENT COMMAND DURABILITY | BLOCKER | Four generic setters repaired; partial/bulk/import identities remain |
| PERSIST BEFORE SEND | BLOCKER | Repaired command flows pass; snapshot and remaining partial/bulk paths do not |
| APP RESTART RECOVERY | BLOCKER | Source queue/browser passes; installed downstream handoff not certified |
| GENERIC INVENTORY EDIT IDENTITY | BLOCKER | Whole-row setters pass; partial-lot/bulk/snapshot callers remain |
| GENERIC EDIT RETRY SAFETY | BLOCKER | Required eight cases pass on repaired apply path only |
| INSTALLED AGENT DOWNSTREAM PARITY | BLOCKER | Capture assembly assertions are not inventory handoff proof |
| TENANT ISOLATION | PASS | Authenticated owner, same-owner other workspace, other user and anonymous regressions retained; no RLS relaxation |

**PHYSICAL ACCEPTANCE = MANUAL REQUIRED.** Existing limitation notes (bounded purchase history, advanced accounting UI, gated legacy completion) remain; they do not waive the BLOCKER rows.

### Validation and artifacts

| Check | Current result |
|---|---|
| Root tests | PASS — 1,055/1,055 (baseline 1,045 retained) |
| Mobile tests | PASS — 613/613 |
| Database variants | PASS — 28 + 28 = 56 |
| Server idempotency | PASS — prior 7 + 16 = 23; additional generic actual-RPC scenarios above |
| Source/private-candidate command recovery | PASS — 12 scenarios; not installed binary parity |
| Unknown/import/price/generic tests | PASS — included in root/mobile suites plus real CSV browser rejection and real PostgreSQL generic cases |
| Browser recovery / tenancy / Showcase | PASS — actual Next → Auth → API/RLS → local database; lost response/reload preserved original generic command |
| Cross-tab queue | PASS — actual browser Web Locks/localStorage recovery |
| Installed assembly regression | PASS — 403 capture/security assertions; downstream parity BLOCKER |
| TypeScript | PASS — root and active mobile, root rerun after final edits |
| ESLint | PASS — no errors; 551 existing root warnings and 3 mobile warnings; final changed-file lint no errors |
| Production build | PASS — isolated `next build --webpack`, 169 pages; no deployment |
| Turbopack | NON-BLOCKING LIMITATION — temporary validation directory's external node_modules junction is rejected by Turbopack; Webpack used explicitly, not reported as a Turbopack pass |
| Scoped secrets/artifacts | Pattern scan of candidate changed/untracked files plus file-list review; see final verification below. No raw fixture/customer data added to report |
| Generated files | Pre-existing AGENTS.md, next-env.d.ts and tsconfig.tsbuildinfo hashes preserved; none staged |

Browser test development initially used an over-specific accessible button name; corrected to the actual inventory-import control and reran successfully. A source-candidate DB harness initially omitted the new valuation module from its isolated copy; its manifest was corrected and all scenarios reran successfully. Neither failure was hidden as a passing initial attempt.

Logs remain outside Git under `%TEMP%/td-phase1-closure-*`; installed synthetic assembly fixtures and validation build output remain private temporary artifacts. No secrets, backup dumps or production exports are included. No push, merge, production migration/deployment, physical scan, inventory commit or Phase 2 work was performed.

**Final software decision: PHASE 1 SOFTWARE INCOMPLETE.** Next work remains within Phase 1N: converge remaining partial/bulk/snapshot callers onto the existing durable domain commands, enforce unresolved identity at Chaos cloud commit, and complete installed-artifact downstream integration proof. Do not promote this partial candidate as full software closure.

Final housekeeping verification: scoped scan of 73 candidate changed/untracked files found no configured credential patterns or restricted artifact paths; this is not a formal security audit. `git diff --check` passed. All three pre-existing generated-file SHA-256 comparisons matched. Nothing staged. The disposable `td-phase1g-auth-20260924` Supabase stack was stopped with its volumes retained; the dedicated browser session was closed. The production recovery stack and unrelated services were not stopped.


## Phase 1P — existing blockers only; architectural stop (2026-09-25)

**PHASE 1 SOFTWARE INCOMPLETE.** Phase 2 remains blocked. No push, deployment, production mutation, physical scan, agent restart/pairing change, POS or Square change occurred. Earlier working-tree changes were preserved.

### Work completed before the stop

Baseline verified: 1,055 root and 613 mobile tests. Completed valuation, Showcase and scanner-default decisions were not redesigned.

**Lot removal/movement:** new local forward migration `20260925150035_inventory_lot_command_receipts.sql` extends the existing event-backed `inventoryMutationV1` request/fingerprint/result receipt to the existing `remove_inventory_lot_quantity` and `move_inventory_lot_quantity` functions. It retains existing item/workspace/owner, allocation and tracked-position guards. No applied migration is edited and no historical event/stock row is rewritten. Legacy keys without a full receipt remain review-required.

The receipt is inserted with the event in the original transaction. Replay resolves before current quantity validation/mutation. Quantity, reason, destination, actor, workspace and source participate in the canonical payload. Event conflicts roll back the business effect rather than silently dropping ledger history. The returned result contains original item, owner, workspace and operation identity. It never reads current stock to reconstruct a successful retry.

`InventoryCommand` and the existing generic coordinator now support partial remove/move endpoints. The web mutation API forwards frozen arguments; the mobile shared command path uses the same RPCs. Timestamp-based partial edit handlers are removed. Existing item authorization still occurs in SQL; suspended web accounts remain blocked.

**Bulk removal:** `inventory-command-batch.ts` uses the existing offline-core queue to persist one immutable manifest before any send. Child operation IDs and quantities are frozen; a partially completed manifest replays the same children. Successful children return their original receipts. Conflicts remain review-required, stop remaining children and never receive new keys. The web collection UI uses this path and exposes recovery even if the removed inventory no longer appears. The obsolete IDs-only bulk endpoint returns `OPERATION_ID_REQUIRED` without mutation; it cannot reread quantities on retry. Error copy now admits that earlier rows may have completed.

**Snapshot semantics established from callers, not guessed:**

- Active `CsvConversionEngine.saveToInventory()` is **APPEND**: it retains existing stock and generates additional rows. It does not intentionally replace/reconcile stock.
- Legacy `persistInventorySnapshotDiff(previous,current)` was **RECONCILE**: per-ID upserts plus deletes for missing IDs across locations/items/movements. Treating that generic implementation as APPEND would have changed its meaning.
- `InventoryWorkspace` and `TieredInventoryWorkspace` have no active imports/routes in this tree. The card-show purchase caller is already stopped by `legacyAcquisitionWriteDecision()` before its legacy persistence path.

The active CSV caller now uses explicit durable `appendInventoryRecords`: full rows, stable row IDs, owner/workspace and child commands persist before delivery; create goes through the existing `create_inventory_item_with_event` RPC. Retries use the original manifest, not a reread/reconversion of the file. Existing rows, location counters and legacy movement snapshots are not rewritten. Canonical imported events supply import provenance. The same forward migration preserves explicit `asking_price` through this existing create RPC; it does not derive asking prices from market data. The old generic reconciliation helper now refuses changes without writing; destructive reconciliation is not silently converted into append semantics. CSV provides a pending-import recovery action.

**Bounded verification:**

- Real isolated Supabase-compatible clone: quantity 10 → A removes 3 → 7; replay A → 7; B removes 2 → 5; old A → 5. Quantity/reason changes under A conflict. Two removal events total -5. Split-move replay returns the original destination ID and does not split twice.
- Real existing create RPC: append receipt replays, explicit $11.99 asking price persists, later legitimate quantity 7 survives old append replay, changed payload conflicts, one imported event.
- Durable manifest fixture: two children commit, second response is lost, coordinator restarts and retries original manifest; each child has one effect. Changed manifest conflicts. Server conflict stops before later children and is not auto-rekeyed.
- Existing SQL/server and source-candidate recovery regressions retained. A test that directly committed concurrent RPCs but left its client command pending was corrected to acknowledge/recover that command before attempting a new edit; the runtime review guard was not bypassed.

This is a partial Phase 1P candidate, not a claim that all new bulk/import UI behavior has completed an independent end-to-end acceptance matrix. No completed prior area was declared broken to justify broader work.

### Newly established architectural conflict: trusted Chaos review evidence

**Stop reason required by the owner's final gate:** complete Chaos canonical validation cannot safely be added only to the browser or API while leaving its direct authenticated SQL commit paths unchanged.

Evidence:

1. `public.chaos_scan_command(text,jsonb)` is executable by `authenticated`. Its `review` action writes the caller's `payload.item` after checking capture identity/revision, not authoritative catalog identity. Its `commit` action reads these stored client-editable items.
2. `public.commit_chaos_sort_batch(jsonb)` is also executable by `authenticated`. Existing authorization guards enforce tenancy, but the identity checks do not resolve a Scryfall printing or verify set/collector/variant against a trusted catalog record.
3. `src/app/api/chaos-sort/scans/route.ts` currently forwards the commit to that RPC. An API-only call to a catalog resolver would not protect direct authenticated RPC invocation.
4. `src/lib/card-intelligence/scryfall-provider.ts` can fetch authoritative `finishes`, language, set and collector data, but those results are application-provider objects, not a trusted database review receipt bound to this album/capture revision. Copying `identityAuthority: provider_confirmed` or a singleton `finishes` array from a client payload is not proof.
5. The existing `tcgplayer_magic_catalog` is a condition/SKU export with Normal/Foil/Unopened, set names and collector numbers. It is not a complete Scryfall printing/language/variant authority and cannot establish that an omitted SKU/finish is impossible. Deriving a singleton finish from a filtered/incomplete inventory export would recreate the forbidden convenience inference.

Consequences: a non-empty-field SQL guard could reject missing condition/language, but it would not prove exact printing or reject conflicting set/collector evidence. A client-provided catalog assertion could appear to pass the singleton-finish test while remaining forgeable. Neither is accepted as closure.

**Implementation stopped at this boundary.** No Chaos guard/attestation migration, new catalog table, alternative canonical ID system or parallel writer was added. This finding makes the previously broad Chaos blocker a concrete authority-design decision.

**Narrow proposed resolution for review, not implemented:** retain the existing canonical provider resolver and IDs, perform validation in a trusted server context, and bind its reviewed result to owner/workspace/album/capture/revision/content. The final database commit must require that trusted result; alternate direct commit paths must enforce the same requirement. Choose the binding mechanism and authenticated RPC exposure together. Do not trust browser evidence, add a second catalog identity system, or give the agent inventory credentials. The reviewed command must distinguish a corrected deliberate operation from a retry of an already accepted payload.

### Installed agent: actual artifact and downstream stop

Read-only verification reconfirmed installed version `1.3.1+3269e252717817e7355617eef99244be1eeb80b9`, valid Core signature, SHA-256 `9F4B39A0984815026D20872B01BDBFA671853B265187C88F00B9DA616085692F`. Installed state was not changed.

The actual agent produces a bound capture, not a confirmed canonical inventory command. Browser/cloud review leads to `chaos_scan_command` → `commit_chaos_sort_batch`; this is not yet the repaired shared inventory-command handoff. Capture acknowledgement means durable cloud image acceptance, not inventory mutation acceptance. No native inventory `ALREADY_COMMITTED`/`IDEMPOTENCY_CONFLICT` consumer exists in this installed artifact.

The earlier 403 installed-assembly assertions remain evidence for capture/security only; they were not relabeled as parity or rerun as substitute evidence. Environment limitations are not used to claim impossibility: a fuller installed-assembly → authenticated isolated cloud → canonical review → stock receipt fixture still needs to be built. Work on it is stopped pending the trusted-review decision above. The current C# fixture ends at capture acceptance, and source-command fixtures start after canonical confirmation; neither connects those sides.

| Required installed downstream case | Result |
|---|---|
| Normal canonical save | BLOCKER — no completed installed-to-Chaos stock receipt fixture |
| Duplicate delivery | BLOCKER — capture dedupe is not stock dedupe proof |
| Lost response and retry | BLOCKER — inventory handoff not exercised |
| Same ID with changed payload | BLOCKER — installed downstream conflict semantics unproved |
| Review-required identity | BLOCKER — trusted Chaos review boundary unresolved |
| Invalid identity | BLOCKER — canonical conflict check not enforced at final Chaos boundary |
| Quantity mutation | BLOCKER — not native agent functionality; downstream equivalence unproved |
| Location mutation | BLOCKER — not native agent functionality; downstream equivalence unproved |
| Restart/recovery handoff | BLOCKER — capture recovery evidence ends before inventory command acceptance |

### Phase 1 software gate matrix at the stop

Previous completed gates retain their tested scope. No deployment/fresh production certification is implied.

| Gate | Status |
|---|---|
| TRANSACTIONAL INTAKE | PASS |
| PURCHASE LEDGER AUTHORITY | PASS |
| ACQUISITION ANALYTICS | PASS |
| INTELLIGENCE PROVENANCE | PASS |
| MISSING PRICE SEMANTICS | PASS |
| SHOWCASE ASKING PRICE SEPARATION | PASS |
| UNKNOWN ATTRIBUTE SAFETY | BLOCKER |
| IMPORT ATTRIBUTE SAFETY | BLOCKER |
| SHARED OFFLINE QUEUE | PASS |
| SERVER IDEMPOTENCY | BLOCKER — shared create/apply/lot scopes pass, Chaos parity outstanding |
| STALE RETRY SAFETY | BLOCKER — repaired command scopes pass, universal Chaos handoff outstanding |
| PAYLOAD CONFLICT REJECTION | BLOCKER — same scope limitation |
| CLIENT COMMAND DURABILITY | BLOCKER — bulk/append implemented locally; full handoff acceptance unfinished |
| PERSIST BEFORE SEND | BLOCKER — repaired manifests pass; full end-to-end closure unfinished |
| APP RESTART RECOVERY | BLOCKER — installed downstream seam remains |
| GENERIC INVENTORY EDIT IDENTITY | BLOCKER — lot/manifest repair verified in bounded fixtures, final release gate unfinished |
| GENERIC EDIT RETRY SAFETY | BLOCKER — same acceptance limitation |
| INSTALLED AGENT DOWNSTREAM PARITY | BLOCKER |
| TENANT ISOLATION | PASS — existing tested scope; no RLS relaxation |

**PHYSICAL ACCEPTANCE = MANUAL REQUIRED.**

### Phase 1P local validation

- Root: **1,057/1,057**; all 1,055 baseline tests retained. Source-contract tests now assert the durable flow and fail-closed legacy endpoint instead of requiring obsolete timestamp handlers.
- Mobile: **613/613**; root and mobile TypeScript pass.
- Prior acquisition DB variants: **28 + 28 = 56 PASS**.
- Prior server idempotency: **7 + 16 = 23 PASS**, generic SQL fixtures PASS, 12 source/private-candidate recovery cases retained. These are not installed binary parity.
- New isolated lot/append RPC checks and manifest retry/conflict unit fixtures: PASS as scoped above.
- ESLint: no errors; the two newly unused imports/constants were removed after the full lint run (which reported 553 warnings, versus prior 551).
- Production build: isolated `next build --webpack` PASS, 169 pages; not deployed. Generated files in the working branch remain excluded from build output.
- Browser/secret/generated-file final evidence follows below. New architecture work remains stopped regardless of these checks.

Candidate source additions for this slice: `mobile/services/inventory-command-batch.ts`, `src/lib/inventory-append-client.ts`, `supabase/migrations/20260925150035_inventory_lot_command_receipts.sql`, `tests/inventory-command-batch.test.ts`, `tests/phase1p-lot-db.mjs`. Related edits extend shared command endpoints, collector web/mobile paths, API forwarding/legacy endpoint, CSV append/recovery, and regression/report files. Prior local Phase 1 files remain uncommitted and unpromoted.

**Final software decision: PHASE 1 SOFTWARE INCOMPLETE.** Stop for review of the trusted Chaos review-to-commit contract; do not start Phase 2 or promote this partial candidate.


Phase 1P final verification at the stop:

- Existing authenticated browser recovery/tenancy/Showcase/unknown-CSV rejection suite PASS on the candidate. This does not claim a newly completed full bulk/append UI release matrix.
- New full-manifest limitation: local queue rejects a changed manifest under the same parent ID; server receipts bind each child, not the entire parent manifest. Changing the set of child IDs after losing/replacing client manifest storage is not yet proven to yield a server-level parent conflict. Thus the whole-snapshot changed-payload requirement remains open even though child replay/stale replay passes. Pending batch-vs-individual command ordering also needs explicit cross-path acceptance. These are Blocker 1 follow-ups, not a fourth program blocker or a reason to invent another queue.
- Scoped scan: 82 candidate changed/untracked files; no configured credential patterns or restricted artifact paths. This is a scoped check, not formal security certification.
- `git diff --check` PASS. Pre-existing generated-file hashes all unchanged. Nothing staged, pushed or deployed.
- Final changed-file lint had no errors; two introduced unused declarations removed. Disposable local acceptance stack stopped with volumes retained. The test-created `phase1p_*` clone databases were dropped by their harness; the verified recovery source database/artifacts were preserved.
- Installed agent remains unchanged. No physical capture or inventory commit was attempted on production.

The stop is specifically for review of trusted canonical evidence at the Chaos SQL boundary. Do not describe child-command success, a passing build, or the old 403 capture assertions as closure of the three-blocker program.


## PHASE 1Q — TRUSTED CHAOS COMMIT + MANIFEST PROTECTION + AGENT PARITY

Local candidate, 2026-09-25. This section supersedes the Phase 1P three-blocker stop. The owner explicitly authorized a server-issued validation receipt using the existing provider authority. No new catalog, canonical identifier system, inventory writer, queue, production deployment, or Phase 2 feature was introduced. Work remains on `codex/acquisition-integrity-phase1`; no files were staged or pushed. Existing production inventory, `CS-000023`, POS, Square, scanner installation, pairing, and hardware certification were not changed.

### Manifest transaction and recovery semantics

Implemented `20260925152512_inventory_manifest_receipts.sql` and connected the existing shared offline batch queue to `apply_inventory_manifest`. The parent operation ID is generated and persisted before delivery. Its child operation IDs, target IDs, endpoint names and exact arguments remain frozen. CSV semantics remain **append**, not snapshot reconciliation. Bulk removal uses the existing quantity-removal RPC. The dormant destructive snapshot writer remains review-blocked.

The private parent receipt binds actor, active workspace, version, purpose and every supplied child business argument: identity, quantity, observed attributes, location, source and related-entity semantics. Unknown proposed reconcile/destructive flags cannot silently change behavior. Only child `createdAt` is transport-only. Unique independent targets are sorted by child operation ID for both execution and the canonical SHA-256 fingerprint. Object keys and numeric scale use the existing recursive canonicalizer; argument array order remains meaningful. Duplicate child IDs/targets are rejected.

Same parent + same manifest returns the original committed result directly, without reading current stock, invoking children or regenerating operations. Same parent + changed contents/version/membership/semantics raises `MANIFEST_IDEMPOTENCY_CONFLICT`, including an empty replacement manifest. SQL and real browser API checks cover A qty 2/B qty 4, a later A qty 9 edit, stale A replay retaining 9, and a conflicting A qty 7 manifest leaving inventory/events/receipt unchanged.

New manifests are **atomic**, not per-item partial imports. An exception rolls back all child inventory/event effects in a subtransaction. The parent still saves the original fingerprint and a durable failure receipt identifying the failed child, empty committed results, SQL error category and retryability. A validation/authorization/review failure replays that review outcome. Only transient database failures may retry the same frozen request. Changing a failed manifest under its existing key is also a conflict. Recovery never silently rekeys or modifies the payload. Transport loss retries the parent receipt.

Direct `inventory_append` child delivery is also guarded: only a listed child executing inside its private parent transaction can reach the existing create RPC. A browser cannot append extra children under a committed manifest or spoof this execution marker with a client setting. Parent retries return their receipt without calling children.

Pre-upgrade partial groups that have child events but no server parent claim are explicitly `MANIFEST_LEGACY_OPERATION_REVIEW_REQUIRED`: original whole membership cannot honestly be reconstructed. Existing effects are preserved. This is deliberate conservative recovery, not fabricated whole-manifest certification. In the shared queue, a pending individual edit and a manifest targeting that item block each other until recovery/review; neither can silently overtake the other.

### Trusted Chaos commit boundary

The prior defect was real: authenticated callers could submit review fields and invoke the final writer directly without provider-backed validation. `reviewed`/`confirmed` flags and client-supplied `identityAuthority` are not trusted evidence.

Implemented `src/lib/chaos-sort/trusted-commit.ts`, reusing `ScryfallCatalogProvider` and `TcgTrackingCatalogProvider`. The existing authenticated scans API reads its own RLS-scoped cloud snapshot, resolves the exact provider printing, validates the claims, and invokes the service-role-only receipt issuer. No client-supplied snapshot or provider evidence is accepted as the source for issuance.

`20260925152513_chaos_trusted_commit_receipts.sql` stores the authorization in private `chaos_scan_private.commit_validation`, with RLS and no browser table privileges. The claim binds owner, workspace, batch, destination, mode, settings revision/content, active capture IDs, original review items, capture revisions and image hashes. It stores a SHA-256 fingerprint, normalized validated items and evidence, a one-hour validity window for an uncommitted review, and the immutable committed request/result. It is a per-operation receipt, **not a catalog cache**.

The original inventory/position/event writer is moved unchanged into the private schema and is no longer directly executable by browser/service roles. The existing public `commit_chaos_sort_batch` name now guards access to that single implementation. It checks current owner/workspace, locks the album, verifies an exact current claim, checks the entire submitted payload, requires the authorized cloud COMMITTING state, and supplies the server-validated items. The browser cannot issue a receipt or call the underlying writer. Capture ordering in comparison is canonicalized by capture ID; original ordinal history is not modified.

Successful new commits save their original result. `chaos_scan_command` closed-batch retries return that durable result before any mutable provider lookup. Direct final-RPC retries require the original canonical payload; altered payloads conflict. Historical closed albums without the new receipt retain the prior initial-count replay behavior. No historical inventory, review or acquisition records are normalized.

### Attribute/evidence contract

- Exact game/printing, card name, canonical ID when supplied, set/code, collector number and all supplied provider IDs must agree with the existing provider resolver. An unknown printing or conflicting identifier is review-required.
- Condition must be explicitly supplied and match the supported NM/LP/MP/HP/DMG vocabulary or documented long-form aliases. It is stored as **USER_OBSERVED**, never catalog-verified. Missing values, invented conditions and JavaScript prototype names are rejected; there is no NM fallback.
- Finish must match the resolved printing's supported finishes. A provider-confirmed singleton may derive an absent finish; a conflicting finish or ambiguous missing finish cannot be overridden by review flags.
- Language requires a supported explicit mapping to the provider printing. English/en normalization is an explicit mapping, not a default. Providers without language evidence remain review-required. In particular the existing TCGTracking adapter exposes no verified language mapping; this candidate does not manufacture one.
- Explicit unresolved/unsupported variants remain review-required. Existing provider/catalog limitations are surfaced honestly rather than silently accepted.
- Provider identity, finish and language evidence are **CATALOG_VERIFIED** only after this server validation. Raw client evidence fields have no authority.

Direct authenticated SQL tests bypass API/UI and reject unsupported finish, mismatched set/collector, missing condition, invented language, unknown printing, and `reviewed=true` payloads. A changed stored review invalidates an earlier receipt; issuing against a stale claim is rejected. Cross-tenant/anonymous callers are denied, private receipt tables have RLS, and direct private-writer execution is denied. Later stock changes do not alter the original committed receipt.

### Installed artifact downstream parity

Actually installed artifact inspected read-only:

- Version: `1.3.1+3269e252717817e7355617eef99244be1eeb80b9`.
- Installed `Core.dll` SHA-256: `9F4B39A0984815026D20872B01BDBFA671853B265187C88F00B9DA616085692F`.
- Installed executable and Core Authenticode signatures: valid.
- The runner copies and hash-checks these installed bytes; it does not build the candidate Core implementation and call that installed evidence.

The expanded fixture goes beyond the retained **403** security assertions. `tests/fixtures/InstalledAgentDownstream.cs` runs the installed capture/authorization/recovery implementation with a synthetic hardware source and isolated journal. It produces an actual bound image/capture ID, rejects changed capture parameters, verifies wrong workspace/batch permits fail, and recreates the capture object over the retained journal without a second acquisition. No live scanner, installed process, pairing or private Inbox is touched.

`tests/helpers/phase1q-browser.mjs` then consumes that exact artifact output in a real authenticated browser:

1. Real GoTrue owner/workspace and cloud batch.
2. Browser multipart request to the actual scans API.
3. Actual private Supabase Storage HTTP upload and duplicate upload recovery.
4. The original capture ID, review revision and one active capture are retained.
5. Explicit synthetic physical observations and a real public Scryfall printing go through the existing provider resolver and receipt issuer.
6. The authenticated authoritative Chaos RPC writes one inventory position/event and returns the saved receipt.
7. Browser response loss is injected **after** the API/SQL commit, followed by reload/retry. No second commit/event occurs.
8. Changed committed payload is rejected. A later deliberate quantity edit is preserved by stale replay.
9. Unsupported finish, mismatched printing metadata, missing condition and unresolved review are denied before inventory effects; SQL bypass checks independently enforce the same boundary.

The agent does not itself own inventory commands or receive an inventory mutation receipt. Its acknowledgement means durable image acceptance. The browser/cloud consumer owns the frozen reviewed batch operation and inventory receipt. Parity is demonstrated across that real handoff, not by inventing a native inventory API.

| Required downstream case | Software result |
|---|---|
| Valid confirmed identity | PASS — installed artifact output through actual local browser/API/Storage/provider/SQL/event |
| Duplicate delivery | PASS — same cloud capture and one commit/event |
| Lost response + retry | PASS — abort after server commit; reload replays original result |
| Same key changed payload | PASS — native capture parameters and committed Chaos payload both reject changes |
| Unsupported finish | PASS — server validator and final direct RPC reject |
| Mismatched printing/set | PASS — real API and direct RPC reject |
| Missing required condition | PASS — no default and no inventory write |
| Review-required identity | PASS — review remains blocked |
| Restart/recovery | PASS for installed Core journal rehydration through downstream receipt; OS/process/hardware acceptance remains manual |

Scope limitation: synthetic hardware bytes and explicit confirmed test observations replace physical scanning/OCR. The copied installed assembly runs in an isolated test host; this is not a new certification of the live tray executable, Chrome/Windows reboot, printer, driver, or iX500. Those remain **MANUAL REQUIRED**. Unlike the earlier DLL-only assertions, the parity proof includes the actual downstream authenticated browser, API, private Storage, existing catalog provider, SQL writer and inventory event.

### Validation and evidence

Final validation completed successfully. Evidence stays outside Git under the workstation temporary directory; it contains only local fixture state, not production exports.

- Root: **1,075/1,075 PASS**, retaining all 1,057 baseline tests and adding manifest/trust regressions.
- Mobile: **613/613 PASS**; root and mobile TypeScript PASS.
- Acquisition database variants: 28 + 28 = 56 PASS.
- Prior server idempotency/generic recovery: retained PASS, including 23 server cases and the source-candidate recovery fixtures; these are not relabeled as installed parity.
- New `tests/phase1q-trusted-db.mjs`: PASS for whole-manifest replay/conflict/atomic failure/revision guards, direct-child denial, transient retry recovery, lot/append durability, direct Chaos RPC bypass and authorization checks against a disposable Supabase-compatible clone. The final fixture assertion isolates the creation operation rather than counting a later legitimate manual edit.
- Full existing authenticated browser acceptance plus installed-artifact handoff: PASS. Focused final candidate rerun after the direct-child guard: PASS.
- Existing 403 installed Core security/contract assertions retained.
- Webpack production build in an isolated validation copy: 169 pages; no deployment. No Turbopack result is implied.
- ESLint: zero errors, 551 pre-existing warnings; changed Phase 1Q files pass with zero warnings/errors.
- Scoped secret/artifact audit: 94 candidate files, no findings. `git diff --check` PASS. The three pre-existing generated-file hashes (`AGENTS.md`, `next-env.d.ts`, `tsconfig.tsbuildinfo`) remain unchanged from the incoming working tree.

### Candidate scope and release ordering

Phase 1Q adds the two forward migrations named above, the trusted-commit service, trusted-commit unit tests, the disposable SQL harness, the installed-agent downstream C# fixture, and its real-browser helper. It updates the existing shared manifest queue/transport, collector command overlap guard, collector mutations API, Chaos scans API, authenticated browser harness, installed-agent evidence runner, manifest tests, and this report. Earlier uncommitted Phase 1 work is preserved.

Any future approved promotion must apply the two new migrations before the matching application code. The old Chaos API cannot issue the required trusted receipt, so commits fail closed during that schema/application transition. No production promotion is authorized or attempted here.

### Final software gate matrix

Each PASS below describes the local reviewed candidate and tested capability scope, not a production rollout or physical certification.

| Gate | Status |
|---|---|
| TRANSACTIONAL INTAKE | PASS |
| PURCHASE LEDGER AUTHORITY | PASS |
| ACQUISITION ANALYTICS | PASS |
| INTELLIGENCE PROVENANCE | PASS |
| MISSING PRICE SEMANTICS | PASS |
| SHOWCASE ASKING PRICE | PASS |
| UNKNOWN ATTRIBUTE SAFETY | PASS — unsupported/missing evidence remains review-required |
| IMPORT ATTRIBUTE SAFETY | PASS — missing attributes cannot silently finalize |
| SHARED OFFLINE QUEUE | PASS |
| SERVER IDEMPOTENCY | PASS |
| STALE RETRY SAFETY | PASS |
| PAYLOAD CONFLICT | PASS |
| CLIENT COMMAND DURABILITY | PASS |
| PERSIST BEFORE SEND | PASS |
| APP RESTART RECOVERY | PASS — software/journal/browser scope |
| GENERIC INVENTORY EDIT IDENTITY | PASS |
| GENERIC EDIT RETRY SAFETY | PASS |
| PARTIAL REMOVAL DURABILITY | PASS |
| SNAPSHOT ITEM DURABILITY | PASS — append only; destructive legacy reconcile held for review |
| WHOLE-MANIFEST CONFLICT PROTECTION | PASS — committed and failed server receipts |
| CHAOS TRUSTED COMMIT VALIDATION | PASS — final SQL boundary required |
| INSTALLED AGENT DOWNSTREAM PARITY | PASS — installed artifact + actual downstream stack, bounded as above |
| TENANT ISOLATION | PASS |

Non-blocking limitations: legacy partial manifests without parent evidence require deliberate review; unsupported catalog language/variant evidence remains review-required; actual hardware and live installed-process lifecycle are not certified by synthetic software acceptance. None is silently treated as a successful mutation.

Final evidence logs: `td-phase1q-root-final.log`, `td-phase1q-mobile-final.log`, `td-phase1q-db-final.log`, `td-phase1q-browser-final.log`, `td-phase1q-browser-focus-final.log`, `td-phase1q-build-final.log`, and `td-phase1q-final-scope-audit.json` under the workstation temporary directory. Installed-artifact/browser handoff evidence is in `td-phase1q-browser-agent-IoQ5Xv` in that directory.

Cleanup: all test-created `phase1q_*` database clones are gone. The local `td-phase1g-auth-20260924` acceptance stack is stopped with volumes retained; the disconnected verified recovery source and artifacts remain preserved. Nothing is staged, committed, pushed, or deployed.

**Final software decision: SOFTWARE PHASE 1 GATES COMPLETE.**

**PHYSICAL ACCEPTANCE = MANUAL REQUIRED.** Do not begin Phase 2, push, merge, deploy, change production configuration, enable POS/Square, or promote hardware certification.


## Release candidate preparation

Release branch: `codex/acquisition-integrity-phase1`. It is based directly on the fetched `origin/main` commit `6f8af6c49a66ee15ffe2eabd03b99b42614a21c6`, with no commits behind and 12 existing Phase 1 commits ahead before packaging the remaining working-tree changes. The PR head SHA is the exact source revision for physical acceptance and is recorded in the PR. Build target: Trading Docks Next.js web application, Node.js 24, Next.js 16.3.4, production webpack build. The current local production build completed successfully in the isolated validation copy.

Manual acceptance must use the private Vercel Preview generated for this PR, built from its exact head SHA, with Preview variables confirmed to point only to the approved staging Supabase project. Use the existing privately installed, internally signed Scanner Agent 1.3.1 on the Windows test workstation; no agent installer is included or republished by this PR. Before the tester signs in, verify the Preview domain and Supabase project reference from the deployment configuration. If Preview is connected to production credentials or the agent does not trust the preview origin, stop and resolve that environment boundary before scanning. Do not use production inventory for this acceptance. To confirm code identity, compare the full SHA shown as the PR head / Preview source commit with the tested commit, then verify the app's build metadata or deployment source identifies that SHA. The exact Preview URL is supplied by Vercel after PR creation; no Preview URL was available during local validation.

### Phase 1 migration order

The Phase 1 migrations, in deterministic timestamp order, are:

1. `20260923204804_chaos_scan_albums_v2.sql`
2. `20260924000100_chaos_cloud_authority.sql`
3. `20260924005111_chaos_legacy_workspace_normalization.sql`
4. `20260924013600_cloud_active_workspace_authority.sql`
5. `20260924043103_chaos_intake_mode_switch.sql`
6. `20260924220000_chaos_active_capture_capacity.sql`
7. `20260924235138_acquisition_purchase_authority.sql`
8. `20260925002945_acquisition_legacy_write_gate.sql`
9. `20260925024439_inventory_mutation_idempotency.sql`
10. `20260925061021_inventory_total_valuation_contract.sql`
11. `20260925061022_showcase_explicit_asking_price.sql`
12. `20260925150035_inventory_lot_command_receipts.sql`
13. `20260925152512_inventory_manifest_receipts.sql`
14. `20260925152513_chaos_trusted_commit_receipts.sql`

No duplicate migration timestamps were found. The recovery-clone and local authenticated browser rehearsals exercised the Phase 1 migration dependencies; SQL authorization checks confirmed private receipt RLS and browser denial. The migrations are forward-only and do not rewrite historical purchase or inventory data. No manual production SQL patches are part of the candidate.

The candidate diff was screened for the listed Phase 2 workflows; no implementation of scanner-to-Chaos auto-assignment, putaway, picking, Deal Desk, Seller Portal, Purchasing Intelligence, Inventory Health expansion, or Channel Optimizer was found. Physical acceptance remains a separate manual release gate. **Do not merge until physical acceptance passes.**

### Release candidate validation rerun

- Root tests: **1,075/1,075 PASS**.
- Mobile tests: **613/613 PASS**.
- Root and mobile TypeScript: PASS.
- Root ESLint: **0 errors, 551 existing warnings**. Mobile lint: **0 errors, 3 existing warnings**.
- Production webpack build: PASS, **169 pages**.
- Dependency audit: **0 high-or-higher production dependency findings**.
- Acquisition database authority: **22 checks PASS**; purchase migration replay/recovery clone PASS.
- Mutation idempotency: **7 core and 16 additional acceptance checks PASS**.
- Lot/append and full-manifest/trusted-Chaos recovery-clone checks: PASS.
- Authenticated browser acceptance: PASS for purchase, receipt, workspace isolation, manifest replay/conflict, private capture storage, trusted Chaos commit, and installed-artifact handoff.
- Installed agent: **403 security/contract assertions PASS**; downstream parity is additionally covered by the authenticated browser handoff. The standalone DLL report correctly remains NOT CERTIFIED for inventory mutation because the agent does not issue inventory commands itself.
- Scoped secret/artifact audit: **94 candidate files, no findings**. `git diff --check` PASS. The three excluded local/generated files remain unchanged from the incoming tree.

The candidate was tested locally; production was not deployed or mutated. POS and Square remain unchanged.

## PHYSICAL ACCEPTANCE REMEDIATION — SCANNER CAPTURE + ORIENTATION

### Original failure

Physical acceptance found that a production page could show the old browser-only scanner fallback instead of the owner-gated Scanner Agent controls. A prior ScanSnap capture did reach the batch, but its image appeared upside down and recognition did not identify it. The capture path and the orientation/recognition path are separate; a recognition-provider failure does not mean the agent failed to receive the image.

### Agent architecture and capture flow

This remediation reuses the installed Trading Docks Scanner Agent; it adds no daemon and does not let the browser access TWAIN/WIA directly. The browser speaks to the agent at `https://127.0.0.1:47391`, with the existing exact-origin allowlist, loopback-only TLS listener, workstation pairing key, signed timestamped/nonce-protected requests, and device enumeration. The website continues to obtain a short-lived cloud capture permit bound to the authenticated owner, active workspace, open batch, destination, workstation, scanner, and capture ID. The agent returns the image under that stable capture identity. The browser stores it in the existing private scan album, starts the existing recognition/review path, and acknowledges/cleans the local agent copy only after cloud receipt succeeds.

WIA devices use the agent's acquisition call to request a scan. ScanSnap iX500 uses the existing ScanSnap Home integration: Trading Docks arms a single capture and waits for the user to press the physical Scan button; the agent accepts only the newly created file for that request from its controlled inbox. The UI now says this explicitly. It does not claim that the website can trigger the iX500 hardware. When the agent or selected device is unavailable, capture controls remain unavailable, the state is shown as disconnected, reconnect/install guidance is offered, and Upload Images remains available.

The page continues to render the bridge integration only through the existing server-side owner/workspace gate. Pairing, cloud authorization, album RLS, active-batch limits, capture identity, and the trusted inventory commit command are unchanged. This remediation does not grant scanner access to another account, expose agent credentials, or perform inventory mutations during capture/rotation.

### Orientation normalization and correction

The card-photo recognition route now applies EXIF orientation once with `sharp`, bounds/resizes the raster, and compares 0°, 90°, 180°, and 270° clockwise pixel candidates in the same vision request. The prompt asks for text-direction, card-name/set/collector placement, and frame/layout evidence, then returns an angle and confidence alongside card identification. Confidence below 0.80 or invalid orientation evidence selects no additional rotation and forces review. An ambiguous angle is never silently guessed as a correction.

The selected angle is attached to the existing scan review record. The inspector preserves aspect ratio, centers the card, displays the selected rotation, and provides Rotate Left/Rotate Right. A manual turn reruns recognition against the same capture ID with an explicit orientation hint; it does not create a capture or inventory mutation ID. The original private scan remains the archived evidence; display rotation and recognition correction do not overwrite it. Each capture is independently oriented, so a prior card cannot affect the next one. The confidence is model-reported rather than benchmark-calibrated; difficult borderless, dark, foil/glare, or off-center physical fixtures still need acceptance testing.

### Tests and validation

- Added orientation tests proving an asymmetric image marker is restored upright from all four quarter-turn inputs, plus bounded raster output, confidence threshold/fail-closed behavior, and manual rotation cycling. Focused orientation + Scanner Agent tests: **19/19 PASS**.
- Extended Scanner Agent protocol tests for a device disconnect during capture, disconnected status, and preventing the next scan until the device is available.
- Existing signed pairing, capture-image delivery, lost-response retry, cloud acknowledgement, reload recovery, and wrong-workspace rejection tests remain passing.
- Root tests: **1,079/1,079 PASS**. Mobile tests: **613/613 PASS**.
- TypeScript: **PASS**. Root ESLint: **0 errors, 550 warnings** across the repository. `git diff --check`: **PASS**.
- Production build: **PASS** with `next build --webpack`. Default Turbopack could not traverse this managed worktree's `node_modules` symlink and failed before compilation; the webpack build compiled and generated all 169 pages.
- Installed-agent .NET tests: **PASS** under the existing isolated .NET SDK 10.0.401 toolchain. The installed signed Core assembly fixture passed **403 security/contract assertions**; WindowsTests passed **5/5** checks for host shutdown/relaunch metadata, version alignment, image validation, and unsafe input rejection. These are synthetic tests, not physical acceptance.
- Database checks were not run because this change adds no migration, schema, policy, or SQL function. Browser recovery with the installed hardware agent and physical scanner has not been exercised in this local worktree.
- Scoped secret review and `git diff --check` found no new credentials or private scan artifacts. Production, PR #137, Vercel, inventory, POS, and Square were not changed.

### Exact candidate and retest gate

Base source commit: `b697b9240f756bf832be8b465837d7338faca6c5`.

Local code/test candidate SHA-256 manifest: `1f46d5d48aa0abb0c4d325fa67b07a5255aaa108c4f7eb0355b75aadcb4fb350`. This manifest covers the ten source/test files changed for the remediation. The remediation is now committed as `63d904ed74a6e4fb1cc335deab79519ce944a6ec`; see the release-candidate section below for the exact deployment and current gates.

**Status: BLOCKED.** The exact-HEAD Preview is READY and CI passed, but Preview-to-Supabase identity is unverified and physical scanner retest has not occurred. Do not merge PR #137, use Preview for physical acceptance, change scanner access gates, or mark physical acceptance passed until the remaining environment and hardware gates pass.

## PHYSICAL ACCEPTANCE RELEASE CANDIDATE

### Candidate and deployment gate

- Branch: `codex/acquisition-integrity-phase1`; source baseline: `b697b9240f756bf832be8b465837d7338faca6c5`. Remediation source/test manifest remains `1f46d5d48aa0abb0c4d325fa67b07a5255aaa108c4f7eb0355b75aadcb4fb350`.
- PR #137 remains OPEN and MUST NOT be merged until physical scanner retest passes.
- Remediation commit: `63d904ed74a6e4fb1cc335deab79519ce944a6ec`. Exact-HEAD Vercel Preview: [deployment](https://trading-docks-346a-hkdbuwcyf-tradingdocks-specs-projects.vercel.app), state **READY**, source SHA matches this commit. GitHub `verify` workflow passed on this SHA.
- Preview Supabase classification is **BLOCKED / UNVERIFIED**. A deployment-scoped Vercel environment pull masked `NEXT_PUBLIC_SUPABASE_URL` as a sensitive placeholder, preventing safe extraction of the project reference. No secret was printed; the temporary environment file was removed. Do not use this Preview for physical acceptance until an authorized configuration view confirms its Supabase reference is staging/test and differs from production.

### Preview services and source contract

| Service | Status | Evidence / gate |
|---|---|---|
| Supabase | **BLOCKED / UNVERIFIED** | Exact-HEAD Preview exists, but Vercel masked the project URL during a deployment-scoped environment pull. The Preview-to-production reference comparison could not be completed. Require an authorized non-secret project-ref comparison proving staging/test before physical testing. |
| Scanner Agent communication | **CONFIGURED locally; Preview origin pending** | Installed process is signed `1.3.1+3269e252717817e7355617eef99244be1eeb80b9`; its read-only health response reports protocol 1, automatic inbox, durable recovery, and capture authorization enabled. Exact trusted Preview origin remains unverified. |
| Recognition provider | **MISSING verification** | No Preview runtime check has been made. Do not substitute production credentials. A prior review screen displayed `credit_balance_exhausted`; require an explicit healthy Preview provider before physical recognition testing. |
| Trusted Chaos validation | **MISSING verification** | The route and local database contracts exist, but the Preview’s Supabase target and migrated staging schema must be confirmed before the trusted commit path is exercised. |
| Image processing/orientation | **CONFIGURED in source** | `sharp` is used by the card-photo scan route; orientation fixtures pass locally. Verify the deployed route responds on the exact Preview. |
| Scanner capture routes | **CONFIGURED in source** | Web uses `/v1/health`, pairing, `/v1/devices`, and `/v1/capture`; ScanSnap uses `/v2/session`. Cloud-authorized capture/read/ack uses `/api/chaos-sort/scans` and optional agent `/v2/capture` calls. Routes are present; Preview runtime still must be checked. |

The web client’s protocol gate is protocol version 1, and the installed agent reports protocol version 1 / bridge version 1.3.1. The installed health flags match the client’s durable-recovery and capture-authorization branches. Pairing, device enumeration, capture request/response, cancel/ack, and ScanSnap inbox session endpoints are compatible. Orientation metadata is created by the web recognition route after image receipt; the native agent transports the source image and does not choose an orientation. The Preview origin must be allowed by the existing pairing/trust configuration; no trust relaxation is approved.

### Installed-agent validation

- Existing isolated .NET SDK: **10.0.401** at `%LOCALAPPDATA%\TradingDocksBuild\dotnet`; the system default remains 9.0.317. No system PATH or registry change was made.
- Installed signed Core assembly test: **403/403 security/contract assertions PASS**, including loopback HTTPS, pairing/replay denial, enumeration, capture, retries, restart recovery, capture authorization scope, and no arbitrary file/command capabilities. No OS trust store was changed.
- WindowsTests: **5/5 PASS**. Scanner hardware was not accessed by these tests.
- Installed-agent-to-cloud handoff rehearsal against the disposable recovery clone: **BLOCKED**. Its harness left a PSQL client idle after a transaction and produced no completion result; the harness was stopped and its uniquely named temporary database was dropped and verified absent. Do not count this test as a pass; rerun with a corrected harness before relying on that downstream evidence.

### Orientation and diagnostic states

- Four-angle pixel fixtures (0°, 90°, 180°, 270°) all restore the same asymmetric marker to the canonical upright result; already-upright input remains upright. Focused orientation + bridge suite: **19/19 PASS**.
- Manual Rotate Left/Right cycles the review orientation and reruns recognition against the same capture identity. It creates no new capture or inventory mutation. Recognition receives the orientation candidates/selected hint; the inspector renders the selected orientation over the preserved private original image.
- UI exposes agent connected/disconnected status, selected scanner name, capture ready/capturing/recovery/error messages, per-card recognition/review status, and the orientation/rotation result. Inventory is unchanged before the explicit batch commit control; no consolidated inventory-state badge is implemented. Production UX was not modified outside this remediation.

### Five-card physical acceptance — staging only

Use the exact-HEAD Preview only after CI is clean, Preview state is READY, its Supabase reference is confirmed staging/test (not production), trusted Preview origin pairing succeeds, and the Preview recognition provider is healthy. Use a disposable staging workspace and five known cards; do not use production `CS-000023` or production inventory. The exact-HEAD deployment is currently READY and CI is clean, but Supabase identity remains unverified, so physical acceptance is blocked.

1. Connect the physical scanner in normal Chrome. Confirm `Agent: CONNECTED`, the named scanner, and capture `READY`.
2. Scan one normal upright card. Verify one physical capture reaches the browser automatically, appears upright in Review, recognition starts, and exact identity is correct or safely requires review.
3. Repeat with card physically upside down, then 90° clockwise, then 90° counter-clockwise. For each, verify the reviewed image is upright and identity is correct or safely requires review; no duplicate capture is created.
4. Use a card with a difficult printing/finish. Verify the UI requests human review rather than inventing the printing or finish.
5. Before committing, verify the staging inventory row/unit/event counts are unchanged and the capture/review records belong to the staging batch. Resolve all review items, commit once, then verify one intended inventory business effect per kept card and no duplicates.

For every card, record capture status, orientation result, recognition status, identity outcome, and before/after inventory evidence. Stop immediately on wrong-batch/workspace binding, duplicate capture, unexpected inventory mutation, or recognition/provider error. Only after all five cards pass should the tester proceed to a separate 25–50 card set.

**Physical acceptance remains MANUAL REQUIRED.** Automated pixel fixtures, installed-agent tests, and recovery-clone tests are not physical acceptance. Required evidence is a real scanner + real cards + actual installed agent + exact Preview + staging backend + actual review + an explicitly authorized staging commit.

**Status: BLOCKED.** Commit `63d904ed74a6e4fb1cc335deab79519ce944a6ec` is pushed, PR #137 is open/unmerged, exact-HEAD Preview is READY, and GitHub CI passed. Preview Supabase staging identity, Preview provider health/trusted-Chaos validation, and physical retest remain outstanding. PR #137 must remain unmerged. Production, production inventory, POS, and Square remain unchanged.
