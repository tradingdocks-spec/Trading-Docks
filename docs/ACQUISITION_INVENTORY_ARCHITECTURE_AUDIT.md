# Acquisition and inventory intelligence architecture audit

Audit date: 2026-09-24. Source baseline: `main` at `6f8af6c49a66ee15ffe2eabd03b99b42614a21c6`. Audit branch: `codex/product-direction-audit`.

**Decision: preserve the inventory/ledger foundation; repair authority and evidence gaps before building Deal Desk or recommendations. Phase 1 implementation has not started.**

Follow-up correction from the Phase 1 investigation: the collection-intake completion RPC described below has a contradictory invoker/grant/RLS contract and is absent from the inspected retained recovery database. Its transactional shape is reusable design evidence, not proof of working completion. See `ACQUISITION_INVENTORY_PHASE_1_REPORT.md` for the architectural stop and proposed acquisition authority.

This is a repository audit, not a new production penetration test or certification. It examines routes, services, domain functions, migrations, tests and recent release evidence. No production queries or mutations were performed for this audit. Previously verified production counts (1,515 inventory rows, 1,775 units, 1,566 events), disabled POS/Square, and CS-000023 are historical observations from the preceding release, not a fresh attestation. No settings, inventory, batches, credentials, installed agents or deployments were changed.

## Evidence and classification

Implementation classifications:

- **WORKING:** a bounded behavior has executable/test or earlier release evidence. This does not certify the entire enclosing workflow.
- **PARTIAL:** real implementation exists, but the requested operational workflow or acceptance gate is incomplete.
- **BROKEN:** a specific contradictory or unsafe behavior is identifiable in source or accepted incident evidence.
- **STUB:** an interface/UI declares functionality without its operation being implemented.
- **DEAD CODE:** no references found in the inspected application import paths, or explicitly historical snapshots. Verify build/export/dynamic references before deleting.

Operational classifications are separate: **PRODUCTION** means a current routed surface or prior verified deployment, not proof of every integration; **PARTIAL** means incomplete/unverified operation; **MOCKED** means synthetic/test behavior; **UNSUPPORTED** means no supported operational implementation found. No live merchant, pricing-provider availability, hardware certification, or fresh RLS verification is inferred from code.

## 1. Current architecture

The active web application is Next.js App Router/React under `src/`, with server-rendered pages, client workspaces, route handlers, browser Supabase reads and PostgreSQL RPC mutations. `src/lib/platform/server-access.ts` centralizes capability resolution. `src/lib/supabase/` separates request and privileged clients. Cloud authority is strongest in the newer Chaos/collector paths.

The active mobile app is Expo 54/React Native under `mobile/`. Web services frequently import or re-export mobile domain/services directly, including collector mutations, inventory search terms, workspace and platform access. This already provides sharing, but makes mobile a de facto common package with ambiguous ownership and dependency boundaries. Extract a neutral shared package incrementally; do not duplicate these functions.

The Windows bridge is a separate .NET application with Core, Windows, Installer, Tests and WindowsTests projects. It is independently installed/versioned; a website deployment cannot upgrade it. Private acceptance branches and main have different native capabilities despite similar version labels.

Repository breadth is substantial: 114 migration files, 102 root `*.test.ts` files, and parallel `dashboard` / `dashboard-v2` component trees. Deck construction, marketing/outreach, events, affiliates, subscription and collector-social features coexist with inventory. These are outside the new critical loop, not automatically disposable.

Recommended architecture remains a **modular monolith**: authenticated application commands, deterministic domain functions, database transactions, provider adapters, durable jobs where needed. No new frontend framework or microservice split is justified by this audit.

## 2. Existing database/domain model and proposed mapping

Migration declarations are historical evidence, not the effective production catalog. Forward repairs overlap historical definitions; the POS forward installer is not a migration to blindly replay after every historical POS file. A complete fresh-install manifest remains a release prerequisite.

| Desired concept | Existing model to preserve/extend | Gap / proposed evolution |
|---|---|---|
| CanonicalProduct / CanonicalPrinting | `card-intelligence/types.ts` CanonicalPrinting; `multi-tcg/identity.ts` CatalogProduct/CatalogSku; Scryfall/TCGplayer/provider IDs; `tcgplayer_magic_catalog` | Canonical TS contracts exist, but are not one enforced cross-domain identity. Establish a shared identity contract and provider mappings before proposing another catalog. Add durable canonical keys only after mapping existing rows without name-only guesses. |
| InventoryUnit / InventoryLot | `inventory_items`, exact `chaos_sort_inventory_positions`, provenance/lot and purchase links | Preserve aggregate and position IDs; define which quantity is authoritative and how sums reconcile. Do not create one row per physical card without a business need. |
| PhysicalLocation | `inventory_locations`, location metadata, position location/batch links | Existing hierarchy/capacity concepts occur in legacy UI JSON. Normalize validated parent/capacity/category/status fields and audited movements only after extracting compatible data. |
| ScanSession / ScanObservation | `chaos_sort_batches`, `chaos_sort_items`, `chaos_sort_sessions`, `chaos_scan_albums`, `chaos_scan_captures`, private capacity metadata | Keep cloud batch IDs, capture IDs, ordinals, tombstones and image provenance. Separate recognition attempts from immutable capture originals. |
| AcquisitionDeal / AcquisitionLine / Offer | `collection_intakes`, `collection_intake_items`, scenario/valuation JSON, actual offer | Evolve intake into Deal Desk. Add versioned offers, seller references, receiving state and explicit immutable calculation inputs; do not start a parallel deal database. |
| Financial acquisition | `collection_purchases`, `purchase_ledger`, `purchase_ledger_lines`, `purchase_inventory_links` | Define responsibility and link the two acquisition histories; avoid double counting the same receipt/payment. |
| SellerSubmission | No complete submission → receipt → final offer → acceptance → payout workflow found | Add a restricted submission boundary linked to intake, not seller access to internal inventory tables. |
| PricingObservation / InventoryValuation | `tcg_current_prices`, `tcg_price_history`, `tcgtracking_price_snapshots`, price review data, intake valuation | Normalize source, observed/fetched time, currency, exact identity, freshness and uncertainty; snapshot references into decisions. A cache is not an immutable offer record. |
| MarketListing / SalesChannel | `selling_listing_candidates`, listing batches, allocations, marketplace listings/operations/settings | Reuse exact-position allocation; truthful capability registry and external reconciliation required. |
| Sale | `marketplace_orders`/items and `pos_sales`/items/tenders/refunds | Preserve both ledgers; create a normalized reporting projection, not replacement sale records. POS remains disabled. |
| InventoryMovement / AuditEvent | `inventory_movements`, `inventory_events`, purchase events, POS and selling audit tables | Define append-only event meanings, signed quantities and movement links. Prevent broad snapshot edits from becoming an alternative ledger. |
| StoreDemandMetric / PurchaseRecommendation | Inventory attention, market scores, purchasing scenarios and financial domain helpers | No verified store-demand decision system. Derive measured facts from sales/inventory history and retain assumptions separately. |

## 3. Inventory: WORKING core, PARTIAL consistency across surfaces

The current `/dashboard/inventory` page renders `CollectorWorkspace`, not the similarly named old `InventoryWorkspace`. The current owned query (`src/lib/owned-inventory-query.ts`) requires owner and active workspace, excludes quantity zero, pages at 250, supports partial/plural terms and returns exact identities. Global search shares this query and bounded provenance. Preserve these primitives and exact positions rather than creating a separate search index as a first step.

Collector mutation/creation and Chaos commit/removal repairs use database authority. Preserve `create_inventory_item_with_event`, collector mutation commands, `remove_inventory_lot_quantity`, position reconciliation and financial history. The accepted removal repair only reconciles provable historical discrepancies; do not normalize all mismatches.

**Competing path:** `src/lib/inventory-persistence.ts` loads whole snapshots and `persistInventorySnapshotDiff` directly upserts/deletes items, locations and movements in separate requests. It favors some `data` JSON fields over relational columns and maps item → one batch code, which cannot represent all multiple-position provenance. The current main Inventory route does not use the old component, but snapshot services still have consumers in CSV conversion and deck-related code. Existing database guards may reject unsafe calls; this is not proof of a production authorization bypass. It is a real contract conflict and failure risk.

Acceptance gap: enumerate every writer and require owner/workspace, idempotency, exact position, atomic event and quantity behavior for imports, receipt, adjustment, sale and refund. Reconcile old snapshot readers before expanding bulk operations.

## 4. Scanner: PARTIAL, physical certification not complete

Reusable layers exist: `scanner-provider.ts`, `local-scanner-provider.ts`, `LiveScanStation.tsx`, `capture-permit.ts`, the scans API, card-intelligence providers/ranking and private cloud images. Browser/camera and upload implementations also exist in purchasing/mobile; they are not one fully unified acquisition pipeline.

The scans API (`src/app/api/chaos-sort/scans/route.ts`) supports cloud commands, tenant-protected image reads, image decoding/size limits, reserve → immutable upload → received, hash-based lost-response recovery, and short-lived signed capture authorization. Cloud capture authorization is an action on this route, not a separate `/api/scanner/capture-authorization` route. Owner acceptance gates are explicit.

**Native capability drift:** main's bridge 1.3.1 includes the lifecycle repair, but `Core/Captures.cs` still keeps jobs in a dictionary and `BridgeHost.cs` health reports automatic Inbox support without durableRecovery/captureAuthorization capabilities. The browser negotiates these flags. The private Phase 1 agent's full encrypted recovery/permit implementation must not be declared present merely because main's version is 1.3.1. Preserve backward compatibility, but require an artifact/version/capability matrix and reproducible installer manifest before another acceptance release.

WIA and ScanSnap backends exist. ScanSnap iX500 currently uses website arming plus the physical Scan button/output-directory workflow. TWAIN/universal website-triggered iX500 acquisition is **UNSUPPORTED** in this baseline. Emulator coverage is **MOCKED**, not physical certification. Restart tests do not prove card capture, crop quality or recognition.

Accepted physical evidence includes an upside-down image and recognition failure with provider credit exhaustion. These are separate problems: EXIF auto-orientation (`sharp.rotate()`) cannot infer an upside-down card with no orientation metadata; a provider quota failure is not low-confidence identification. Keep the image/capture, expose actionable provider status, and allow manual review. Do not claim the unrelated orientation/retry work was promoted with the capacity or lifecycle releases.

Required acceptance remains: refresh, browser restart, Windows restart, agent crash, before-upload and after-upload/before-ack recovery, duplicate retry, wrong workspace/batch denial, then actual capture and recognition. Inventory commit is a separate deliberate operation.

## 5. Catalog / identity: PARTIAL

`card-intelligence/service.ts` already separates catalog providers and ranks candidates with a close-score ambiguity margin; it preserves signals and provider failure status. `multi-tcg/identity.ts` already normalizes product/SKU/provider identities. Reuse these.

Gaps: multiple shape definitions across buylist, intake, inventory JSON, market cards, scanner and listing candidates; differing game registries; finish/variant vocabulary drift; legacy defaults for missing condition/language/game; and no proven universal persisted canonical key. `multi-tcg/registry.ts` lists Magic production, Pokemon beta, other games planned, while market-engine has another game list including Lorcana/One Piece/Pokemon Japan. A market preview does not establish inventory/recognition support for that game.

Exact identity must distinguish printing, language and finish; condition is inventory state, not a printing identity. Preserve unknown values and match candidates explicitly. Add mappings with evidence/confidence and quarantine ambiguity instead of assigning English/NM automatically.

## 6. Pricing / finance: WORKING calculators, PARTIAL decision evidence

Good foundations include TCGTracking snapshots with missing/stale states, existing price-history tables, collection valuation scenarios, buy rules, cost allocation and `financials/domain.ts`. Cost-basis coverage explicitly distinguishes known/partial/unknown.

**BROKEN for authoritative intelligence:** `market-engine/helpers.ts::normalizeCard` derives volume, opportunity, demand and sparklines from deterministic hashes/sine functions, including when a price source is live. Missing changes are synthesized; low price is derived from an index-dependent multiplier. These are not measured demand or sales velocity. `fallbacks.ts` is correctly marked `dataQuality: fallback` / Sample market snapshot, but includes seeded owned counts and prices. Never feed either into an offer or claim measured store inventory.

Buying rules are fixed percentages; collection valuation improves this with realization, fees, per-item cost and target profit, but not measured store demand/days of supply/channel velocity. Preserve calculator functions while extending their input evidence.

`calculateRealizedProfit` treats missing fees/shipping as zero and determines completeness primarily from cost basis. This can overstate certainty even when costs are unobserved. Define gross/net/tax/discount/shipping semantics per importer, prevent double subtraction, and expose completeness for every financial component. Use integer minor units or a consistent decimal policy for auditable allocations and rounding.

## 7. Marketplaces: PARTIAL / MOCKED, not a universal live channel layer

Real eBay authorization/import client code exists under `marketplaces/ebay.ts`, with explicit environment safeguards; TCGplayer email parsing and imported orders are separate acquisition paths. Credentials use AES-256-GCM and key-version metadata. No live merchant readiness was tested in this audit.

The inspected selling publish route calls `publishCandidatesInMockMode`; results persist `environment: mock`, mock IDs and mock operations. Classify that path **MOCKED**, not a successful live listing. `createMarketplaceAdapter` returns only marketplace/capabilities while advertising publishing, quantity sync and order import for eBay/Mana Pool/Shopify. The factory is a **STUB**; the capability declarations alone are not implementation. Direct integration code elsewhere must be assessed per operation.

Preserve candidate readiness checks, exact-position allocations, listing operation history and order normalization. Add capability states per operation/environment, publish/sync idempotency, reconciliation and reversal handling before channel optimization. Do not enable Square or expand POS as part of this product realignment.

## 8. Buylist / intake: PARTIAL; strongest starting point for Deal Desk

`BuylistWorkspace` imports authorized CSV offers and matches owned items against identity/condition/finish/language. It explicitly avoids sample offers. However it reads only `inventory_items.data`, filters by user rather than an explicit workspace, and does not use the shared active paginated inventory reader. `buylist.ts::offerMatchesItem` defaults missing finish/language/condition to nonfoil/English/NM. CSV import similarly supplies defaults. Thus an “exact match” can actually rely on invented attributes. Correct this before purchasing decisions; RLS may still constrain visible rows, so this is not a demonstrated tenant leak.

Collection intake has real status/review models, saved scenarios/valuation, seller contact and an idempotent completion RPC. The SQL completion function locks intake and calls the event-backed inventory writer. This is reusable receiving/finalization infrastructure, not a placeholder.

**BROKEN failure atomicity:** `saveCollectionIntake` updates/inserts header, deletes all prior lines, then inserts replacements as separate API requests. Failure between those operations can lose the saved line set or leave valuation/header inconsistent. Line IDs are also not carried into the inserted rows. Move draft saves to a transactional version-checked command, preserving line identity and offer history.

`isMissingSchemaError` broadly matches table/function names in error text; an authorization/constraint failure mentioning the table may be mislabeled “schema unavailable.” Match actual error codes and preserve actionable failures.

No complete external Seller Portal or measured-demand Deal Desk workflow was found. `seller-launch` is not evidence of the requested seller submission/receiving/payout lifecycle. Model these as **UNSUPPORTED target workflows**, not broken existing production promises.

## 9. Locations / Chaos: WORKING bounded batch authority; PARTIAL warehouse model

Preserve server-generated batch identity, cloud drafts/reviews, paginated history, private albums, exact positions, original-versus-remaining reconciliation and commit → label → next-batch gate. The current localStorage uses in Chaos are history-display preference and a development-only scanner preference, not authoritative batch numbering.

The active-capacity migration separates lifetime ordinal from the 100-kept-capture limit. Removed captures retain identity/history; a replacement gets a new ID/ordinal. Do not erase captures, reuse IDs, fabricate historical batches 23–29 or reinterpret removals as new acquisition.

Physical-location hierarchy/capacity fields exist in older component metadata, but the active Chaos UI explicitly describes small locations as guidance, not enforced capacity. The 100-card batch limit is not a bin capacity allocator. No complete concurrent capacity reservation/putaway/pick/return system was established. Preserve locations and position links; extend them with validated hierarchy and paired, auditable movement commands.

## 10. Analytics: PARTIAL; several metrics unsuitable for decisions

Inventory attention provides useful missing-price/cost/location/condition/finish tasks and labels sampling (500 rows). It is not sell-through, aging, capital turnover or demand forecasting.

Concrete issues:

1. `dashboard/analytics-summary.ts` counts recently updated quantity as `addedLast30Days`. Repricing or editing old stock can look like acquisition. Use immutable receipt/acquisition events.
2. Analytics page queries all owner rows without explicit paging/error handling and converts no data to zero totals. A capped or failed query can look like complete inventory.
3. `loadInventoryAttentionSummary` accepts workspaceId but does not apply it in its queries. Current restrictive RLS may provide the boundary; align query intent and add multi-workspace tests rather than alleging a proven leak.
4. `orders/order-repository.ts` is explicitly owner-scoped, limits to 1,000 then filters dates in memory. Beyond that cap historical reporting can undercount; a workspace parameter in diagnostics does not make it workspace-scoped.
5. Synthetic market scores and unknown-cost assumptions must not become purchasing recommendations.

Define measured acquisition cohorts, time-in-stock, reserved versus available quantity, returns and channel fee completeness before aging/margin recommendations. A valid “insufficient evidence” result is preferable to a confident invented score.

## 11. Tests and validation

Fresh audit execution at this SHA:

| Check | Result / limits |
|---|---|
| Root Node suite | **1,014 passed**, zero failed/skipped; 102 test files |
| Active mobile Node suite | **580 passed**, zero failed/skipped |
| Initial mobile run | Environment failure: audit checkout lacked mobile dependencies. Linked existing mobile node_modules and reran successfully; not classified as a product defect. |
| Recent release CI | Preceding PR #136 passed quality/security and production build on its release head; merged baseline is this audit SHA. Not rerun as a fresh audit build. |
| Recent native evidence | Lifecycle release: 376 assertions and 5 Windows checks; artifact/lifecycle evidence, not physical scanning certification. |
| DB/browser/physical acceptance | Not rerun in this audit. Existing focused harnesses are present, not assumed passed merely because files exist. |

Read-only local function probes additionally returned:

- `summarizeAnalyticsInventory`: a recently edited row with quantity 10 produces `addedLast30Days: 10`, regardless of original acquisition time.
- `offerMatchesItem`: a matching printing with no recorded item finish/language/condition matches a confirmed nonfoil/English/NM offer (`true`).
- `calculateRealizedProfit`: grossSale 10 and allocatedCostBasis 2, with fees/shipping absent, produces `completeness: known`.

These synthetic inputs exercised existing functions directly; they were not production records or new implementation tests.

Existing coverage includes collector/financial/intake domain tests, scanner protocol/permits, Chaos cloud/capacity/intake-mode DB harnesses, hosted tenant matrices, global search, POS security/transactions, browser batch/print flows and mobile camera/replay tests. Some security tests assert SQL/source strings rather than execute authorization under real roles; keep them but do not substitute them for database tests.

Normal `.github/workflows/quality.yml` runs npm ci/check/build on Node 22, while package engines declare Node 24. It does not run the optional DB/browser/Windows/mobile suites. Align the runtime matrix and enforce affected-domain gates. Thousands of passing assertions cannot prove the complete acquire → sell → margin loop, which was not exercised here.

## 12. Prioritized defects / incomplete functionality

| Priority | Finding | Classification | Next evidence/fix gate |
|---|---|---|---|
| P0 for new direction | Synthetic demand/opportunity/price-history outputs can be mistaken for evidence | BROKEN for recommendations; MOCKED inputs | Trace all consumers; isolate preview fields and require observed evidence per metric |
| P1 | Nontransactional intake header/line replacement | BROKEN failure recovery | Inject failure after delete; atomic save + stable IDs/version conflict test |
| P1 | Native version/capabilities differ from private acceptance feature set | PARTIAL release integrity | Signed artifact manifest, negotiated capability tests and restart/capture gate |
| P1 | Buylist defaults missing identity and reads legacy JSON | BROKEN exactness / PARTIAL scope | Unknown identity must block exact match; reuse scoped active query |
| P1 | Multiple stock write/read models | PARTIAL authority | Trace every reachable writer; DB guards + no duplicate/lost ledger effects |
| P1 | Analytics acquisition/date/paging semantics and fee completeness | BROKEN metric semantics | Ledger-based calculations and >1,000-row fixtures |
| P1 | Repository migration paths overlap | PARTIAL install reproducibility | Empty install and current-production upgrade manifests tested separately |
| P2 | Generic adapter advertises absent methods | STUB | Capabilities generated from actual adapter implementation and environment |
| P2 | Provider quota/orientation and physical scan acceptance incomplete | PARTIAL / accepted failure evidence | Preserve capture; explicit provider failure, preprocessing and physical gate |
| P2 | Hierarchical location enforcement, Seller Portal, demand-driven Deal Desk | PARTIAL / UNSUPPORTED | Design against existing models; do not advertise completion |

## 13. Duplicates, preservation and removal candidates

**Preserve:** collector inventory/RPC authority; exact positions; acquisition/events; Chaos cloud identity/captures/tombstones; scoped owned search; financial pure functions; provider adapters/ranking; location and label IDs; selling allocation and order history; existing authentication and restrictive RLS.

**Consolidate:** web imports from mobile into a neutral shared domain boundary; CanonicalPrinting/CatalogProduct/InventoryGameIdentity contracts; buylist and inventory readers; collection purchases versus purchase ledger semantics; provider game/capability registries; source-aware financial observations.

**Dead-code candidates:** old standalone InventoryWorkspace/TieredInventoryWorkspace and several dashboard-v2 counterparts have no import references in the inspected route/source search. They are not the current Inventory page. Validate reachability before removal. Do not delete all dashboard-v2: bulk purchases still imports a component from it. Snapshot persistence remains consumed elsewhere and is not dead.

`mobile_backup/`, `mobile-sdk54-clean-backup/`, `mobile-sdk57-backup/` are historical snapshots per repository policy. Archive outside active build/search scope after owner review; check tooling references before deletion. Keep Git history, not parallel operational implementations.

Defer broad deck/marketing/community/hardware/POS feature expansion. Do not delete live screens, customer records, financial ledgers or applied migrations because they are outside the new navigation. Navigation reduction and deprecation require a separate usage/migration review.

## 14. Security / RLS concerns

Positive controls include capability guards, authenticated inventory clients, active-workspace restrictive policies, workspace/owner triggers, private scan storage, owner-only scanner gate, short-lived scoped permits, loopback HTTPS, exact origins, pairing proofs/replay protection, and encrypted marketplace credentials. Recent tenant/collector repairs must be preserved.

Audit risks, not newly proven exploits:

- Owner-only queries and workspace-aware queries coexist. RLS may enforce the missing predicate, but reports can still have inconsistent semantics; test owner with two workspaces, delegated employee, nondelegated manager, outsider and anonymous users separately.
- `createAdminClient` uses a service-role key and lacks an explicit `server-only` import. Enforce module-boundary tests and consider the guard; no exposed key was established by this audit.
- Legacy direct snapshot upsert/delete can conflict with immutable audit intent. Inspect effective grants/triggers before changing it; do not loosen guards to accommodate obsolete callers.
- `recordInventoryEvent` catches broad text mentioning inventory_events before duplicate classification. A ledger error may be mislabeled unavailable. Require atomic event writes and exact error classification for business commands.
- Active policies are the cumulative result of many migrations. Historical broad policies alone are not proof of current access. Compare effective functions, grants, restrictive/permissive policies, security-definer search paths, storage rules and foreign keys in an isolated restored target.
- Credential metadata supports key versions, but decryption uses the current configured key; establish rotation/read-old-key behavior before calling rotation complete.
- Browser/agent trust is necessary but not a substitute for batch authorization. Capability negotiation must not silently promise durable recovery on an older native implementation.

No passwords, production exports, private keys or raw customer data belong in this report. This was not an exhaustive repository-history secret scan. A release secret audit remains mandatory before any later promotion.

## 15. Technical debt blocking the direction

The core blockers are semantic inconsistency, not missing screens: canonical identities versus JSON snapshots; item quantity versus position authority; observation versus synthetic estimate; draft versus immutable financial record; source tests versus operational acceptance; installed binary versus source version.

Large components amplify these risks. Current source includes a 7,552-line DeckDetailWorkspace, 4,447-line legacy InventoryWorkspace, 3,098-line CollectionBuyingCenter, 1,791-line ChaosSortWorkspace and 1,550-line CardPhotoScanner, plus large parallel versions. Split orchestration, pure calculation, persistence and presentation only as the relevant workflow is repaired. A wholesale rewrite would jeopardize working behavior.

## Proposed implementation sequence — review required before Phase 1

### Phase 1: authority and evidence contract

Inventory every reachable stock writer, identity shape, financial source and integration capability. Fix intake save atomicity, unknown identity defaults and false metric certainty first. Establish shared domain contracts and explicit errors; align affected CI/runtime gates. Preserve database guards and IDs. Deliver end-to-end tests before refactoring screens.

Exit gate: two-workspace tenant matrix; intake failure leaves prior draft intact; zero-quantity excluded; exact positions preserved; no sample data enters financial decisions; duplicate request creates one business effect. This is the proposed product phase, not approval to begin scanner Phase 2 or deploy changes.

### Phase 2: dependable scan → review → receive

Unify capture/preprocessing/provider recognition/catalog resolution/confidence/review boundaries using existing services. Reconcile agent artifact capabilities and complete physical acceptance. Connect acquisition context to existing inventory finalization. Require 100 kept-card capacity and immutable removed capture history; recognition retries never duplicate inventory.

Exit gate: known/unknown/ambiguous/unavailable-provider cards, interrupted upload, duplicate ack, refresh/restart, exact printing/finish/language, one deliberate inventory commit with provenance. Physical certification remains pending until tested.

### Phase 3: locations and operational inventory

Normalize location hierarchy/capacity while retaining existing location IDs; transactionally reserve capacity and record receive/putaway/transfer/pick/return/adjustment movements. Reuse exact-position allocation and label references.

Exit gate: concurrent putaway cannot overfill; pick points to actual position; partial move/return preserves quantity/cost/event history; keyboard and batch flow demonstrated at store scale.

### Phase 4: Deal Desk and receiving

Evolve collection_intakes into a versioned deal lifecycle with immutable offers, observed pricing inputs, inventory exposure, transparent assumptions, approvals and receiving exceptions. Link purchase history and cost allocation. Do not make seller payout implicit in inventory creation.

Exit gate: offer accepted/rejected/revised, partial receipt, condition mismatch, unknown pricing, rounding allocation, retry and reversal; acquisition → inventory → sale cost can be traced without guessing.

### Phase 5: Seller Portal and channel reliability

Add scoped seller submissions linked to deals, explicit shipping/dropoff and final acceptance/payout status. Implement only supported marketplace operations; preserve mock separation and reconcile external orders before presenting channel recommendations.

Exit gate: sellers cannot read internal stock or other submissions; duplicate callbacks are safe; external failures recover; fees/shipping/tax provenance survives refunds. No POS/Square enablement is implied.

### Phase 6: measured intelligence

Build inventory aging/sell-through/capital exposure from ledger cohorts, then recommendations from observed channel economics and store demand. Persist algorithm version, observation IDs/timestamps, assumptions, confidence, overrides and actual outcomes. Treat missing demand as insufficient evidence; backtest and calibrate before automated actions.

Exit gate: reproducible recommendation from retained inputs; known-cost coverage; zero mocked signals; tenant-scoped cohort tests; actual versus predicted outcome analysis.

## Migration and verification strategy

1. Produce an effective schema manifest from approved read-only catalog inspection; distinguish main's declarations from deployed migrations. Do not replay the whole historical directory.
2. Maintain two tested paths: canonical empty install and additive upgrade from the current repaired production baseline. Preserve applied migration files and financial IDs/history.
3. Use expand → dual-compatible readers → audited deterministic backfill → verify → switch authoritative writer → retire legacy path. Avoid independent dual writers. Quarantine ambiguous identity/cost/location records.
4. Before each production schema change, verify representative backup/restore readiness under the existing policy. Rehearse on isolated Supabase-compatible data; never use staging acceptance state as a disposable target.
5. Assert row/quantity/event/position/allocation/batch invariants and compare RLS/functions/grants. Use transaction failures, concurrency, retry and external timeout cases, not only happy paths.
6. Deploy schema before dependent application code; use a focused PR and explicit owner release approval. Roll back application behavior or feature gate; preserve newly written financial/event history rather than destructive reverse migrations.
7. Release matrix: root/mobile domain tests; effective DB security/transaction tests; authenticated browser critical workflows; native agent/protocol tests when touched; provider contract fixtures plus separately authorized live checks; production build and secret audit. Keep physical hardware acceptance distinct.

**Owner review gate:** approve prioritization and the Phase 1 contract/failure-recovery scope before implementation. This audit makes no production repair, migration, merge, deployment or hardware-certification change.
