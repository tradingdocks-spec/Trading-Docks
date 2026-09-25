# Phase 1 — Data integrity and scanner parity

Status: **PHASE 1F IMPLEMENTED LOCALLY — REVIEW / RELEASE GATES REMAIN OPEN**.

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
