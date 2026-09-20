# Trading Docks POS architecture

Status: Partially Implemented. Accepted architecture with Phase 1 cash POS and Phase 2 barcode/label source implementation, 2026-09-20. Phase 3 onward remains Planned. Hosted rollout Requires Production Configuration and staging acceptance.
Audited source: `121297b`; working branch: `codex/pos-foundation`.

Phase 2 extends the canonical Label Studio identity with exact position and storage bindings, protected external aliases, authoritative scan precedence and immutable deleted-code history. Cart/checkout lines preserve separate positions of the same item and per-line allocation provenance. Label Studio now uses real Code 128 and isolated physical roll/sheet output. Legacy codes remain supported; current price, owner boundaries, stock locks and retry semantics remain authoritative. See [Label and barcode architecture](LABEL_AND_BARCODE_ARCHITECTURE.md) and [Phase 2 validation](POS_PHASE2_VALIDATION.md). Neither phase is approved for production rollout.

The original audit below is retained as the accepted design direction. Phase 1 implementation, deliberate scope refinements, actual routes/schema, validation evidence and remaining release gates are recorded in [POS_PHASE1_VALIDATION.md](./POS_PHASE1_VALIDATION.md). No production database, deployment or payment connection was changed. Source inspection does not establish which migrations are applied to a hosted database.

## Review boundary

The user explicitly accepted the foundation documentation and review gate on 2026-09-20 and authorized Phase 1 on `codex/pos-foundation`. No further routine implementation approval is required. The following proposed sections describe direction; consult the implementation report for what shipped in source and what remains planned.

The master request authorizes development of additive migration files and test infrastructure. It explicitly excludes production deployment, direct production Supabase changes, real Square merchant connection, real charges, and merging to main. Those exclusions remain in force after foundation acceptance. Do not interpret foundation acceptance as production release approval.

## 1. Current architecture findings

| Area | Evidence and current state | POS consequence |
| --- | --- | --- |
| Web | Implemented: installed Next.js **16.3.4**, React 19.2.4, TypeScript, App Router in `src/app`; scripts in `package.json`. `docs/ARCHITECTURE.md` still names 16.2.12. | Use installed `node_modules/next/dist/docs`, not the older version claim. |
| Rendering | Implemented: `src/app/dashboard/layout.tsx` authenticates on the server and supplies access context to `TieredDashboardShell`; interactive areas use client components. | Server page resolves access/configuration; bounded client register handles scanning/cart, with server checkout authority. |
| Supabase | Implemented: cookie-aware SSR client in `src/lib/supabase/server.ts`, browser client, proxy session refresh, and privileged admin client. | Use user session for ordinary POS commands. No browser admin key or routine service-role bypass. |
| Identity and roles | Implemented: `workspaces`, `workspace_members`, `user_roles`, `user_preferences`; access resolution in `src/lib/platform/server-access.ts`. Workspace selection fails closed on ambiguity. | Reuse workspace as organization; resolve actor and workspace on server. Never infer owner from email or editable metadata. |
| Entitlements | Implemented: shared `mobile/services/platform-access.ts` and membership catalog; existing `pos.sell` capability requires Seller/member minimums. Stripe/RevenueCat billing resolution is separate. | Reuse the capability system, with a Store rollout gate and explicit POS action permissions. Do not change subscription pricing. |
| Employees | Implemented: `workspace_employees` with `linked_user_id`, permissions, active employment state; workspace membership remains distinct. | Attribute every sale to authenticated user and optional employee record; verify both authority and employment rules. |
| Store geography | Partially Implemented: `inventory_locations` represents owner-scoped storage, including hierarchy in data. No canonical physical store-site table was found in inspected migrations. | A display case is not a retail branch. Add a workspace-scoped site and explicit mapping to existing storage locations. |
| Inventory | Implemented: canonical `inventory_items`, composite identity `(user_id, id)`; text item IDs, quantity, location, SKU, metadata. Label migration adds workspace, asking/market price, UPC/barcode and product fields. | Retain owner plus item ID on every link. Never create POS stock copies or assume IDs are globally unique. |
| Events | Partially Implemented: August ledger migration defines enums, constraints and append-only trigger; September migration uses `create table if not exists` with text fields and a broader policy. | Replay and inspect effective schema; the later declaration does not reconcile earlier types. Preserve append-only behavior and verify grants. |
| Chaos Sort | Implemented: sessions, batches, position rows and atomic `commit_chaos_sort_batch`; September 18 migration allows multiple positions per item per batch. | Checkout must update canonical item and exact physical positions, batch counts, and events together. |
| Marketplace stock | Implemented: `selling_inventory_allocations` with ALLOCATED/RESERVED/FULFILLED/RELEASED states, item or position scope. `reserve_selling_inventory` locks position for positioned candidates, item otherwise. | Establish shared locking across POS and reservations; checking only total item quantity permits overselling. |
| Labels and identity | Implemented source: `inventory_label_identities`, `label_templates`, print jobs, pricing reviews, QR resolver in the August 9 migration; `src/lib/label-studio/*`, `/api/label-studio`. Some older docs call the identity table `inventory_identity`. | Reuse actual migration table names and stable `TD-XXXX-XXXX` identifiers. Validate deployment prerequisites rather than trusting older prose. |
| Pricing | Partially Implemented for POS: asking/market/label prices and label pricing rules exist; `applyPricingRule` uses decimal JS arithmetic. `inventory_value` is a value aggregate, not an authoritative per-unit selling price. | Use reviewed `asking_price` for Phase 1, convert in Postgres to minor units. Missing price blocks checkout. Do not treat label-only formula previews as checkout authority. |
| Catalog | Implemented: multi-TCG identity/registry, TCGplayer/provider IDs, Scryfall identity, TCGCSV and provider adapters. | Sell existing singles, sealed/custom inventory through the same inventory identity, retaining printing/condition/finish/language. |
| Orders and analytics | Implemented: `src/lib/orders/order-repository.ts` reads owner-scoped `marketplace_orders`; canonical metrics and financial helpers exist. | POS sales need an explicit channel adapter later, not invented marketplace orders or double-counted totals. |
| Customers | Partially Implemented: customer UI exists and CRM marketing migration references `crm_customers`. Full clean-replay customer contract needs verification. | Guest checkout in Phase 1; reuse verified CRM identity in Phase 7. Do not introduce another customer table blindly. |
| Payments | Implemented subscription integrations: Stripe and RevenueCat. No operational POS terminal integration found. | Subscription credentials and account relationships are not merchant payment connections. |
| Secrets/webhooks | Implemented: `src/lib/marketplaces/credentials.ts` uses AES-256-GCM with IV, authentication tag and key version; existing webhook registry includes billing/email/provider paths. | Reuse reviewed encryption mechanics, but give merchant payments their own scoped credential storage and lifecycle. |
| UI/navigation | Implemented: shared design tokens, Tailwind v4/Radix-based primitives; `src/lib/navigation/contract.ts`, dashboard adapter, route/API access registries. | Add one gated POS destination; register is a compact checkout workspace, not another metric dashboard. |
| Flags | Partially Implemented: explicit product visibility helper exists in `src/lib/product-visibility.ts`; no general POS rollout service found. | Add a server-authoritative per-workspace disabled-by-default rollout setting; hiding a link alone is insufficient. |
| Tests | Implemented: Node test runner with TS stripping, TypeScript, ESLint, Playwright, staging target guard; isolated Chaos Sort print/PDF tests. | Extend these tools. Older architecture prose claiming no root test script is stale. |
| Mobile | Implemented active app is `mobile/`; other named mobile directories are historical. | Phase 1 is web register; shared capability changes require active mobile checks too. |

## 2. Reuse decisions

Reuse `workspaces` rather than adding organizations; `workspace_members` and linked employees rather than separate POS authentication; canonical inventory and Chaos Sort positions rather than a stock database; existing events rather than a second movement ledger; label identities/templates rather than another SKU generator/editor; centralized artwork/provider fallbacks rather than ad hoc image requests; existing access registries and membership resolution rather than browser role checks.

The old `PosCartItemContract.unitPrice` is a display-era nullable number. New persisted DTOs must use explicit `unitPriceMinor` and currency, with a deliberate adapter rather than silently changing that existing contract's units. Financial reporting helpers may consume converted snapshots later; they are not the checkout calculator.

## 3. Proposed domain and release scope

Status: Planned.

Workspace → retail site → register → employee session → checkout → sale → sale lines and tenders → inventory events and immutable receipt.

Phase 1 delivers a complete **online cash-only** path: configure site/storage mapping and tax, choose/open register, search/scan real available stock, edit quantity, preview totals, take cash, atomically finalize, print receipt and reopen transaction history. Basic register/session attribution belongs in Phase 1; drawer reconciliation and management workflows expand in Phase 3.

No reservations on cart addition. Carts may remain in browser memory until checkout; durable checkout identity is required before committing. Refresh during an uncertain checkout must recover that identity. Offline completion is unavailable. Missing setup, missing schema, missing price and unmapped inventory produce actionable errors, never demo data or inferred zero prices.

Initial policies: USD; tax-exclusive location configuration with explicit taxable/exempt treatment; no silent price override; guest checkout. Use configurable permission primitives for discount/override approval. Inclusive tax, quick items, attached customers and split-tender UI remain later capabilities; sale-to-many-tenders is present from day one.

## 4. Proposed additive database changes

Status: Planned; no migration applied or authored yet.

| Relation | Required contract |
| --- | --- |
| `pos_workspace_settings` | Workspace PK; rollout disabled by default; currency and policy version. Ordinary cashiers cannot enable rollout. |
| `pos_store_locations` | UUID, workspace FK, name, timezone, tax configuration, active state; separate from inventory storage. |
| `pos_location_inventory_locations` | Workspace/site plus canonical inventory owner/location composite FK. Reject ambiguous physical assignment. |
| `pos_registers` | Workspace/site, name, active status; composite parent FK prevents cross-workspace association. |
| `pos_register_sessions` | Register/site/workspace, authenticated actor, opened/closed time; one active session per register via partial unique index. |
| `pos_checkouts` | Workspace, actor, register/session/site, client-generated UUID idempotency key, canonical request fingerprint, state, timestamps. Unique `(workspace_id, idempotency_key)`; replay with different intent is a conflict. |
| `pos_sales` | Workspace/site/register/session/actor, checkout unique FK, receipt number, currency, subtotal/discount/tax/total in bigint minor units, completed timestamp. Completed financial snapshot immutable. |
| `pos_sale_items` | Workspace/sale composite FK, inventory owner/item, exact product snapshot, price source, quantity, original/charged unit price, discount/tax/line total, nullable cost basis snapshot. Preserve history if catalog changes. |
| `pos_sale_allocations` | Sale line, inventory owner/item/position, batch and storage location snapshot, exact quantity removed. One line may consume multiple positions. |
| `pos_tenders` | Many rows per sale; currency, method, applied amount, received cash/change, actor/time, verification class. Cash is recorded cash, never processor-verified. |
| `pos_receipts` | One versioned immutable snapshot per sale; reprints use snapshots, not current prices or names. Receipt number unique within workspace/site scope. |

Extend canonical inventory events with sale references through existing related-entity fields and metadata (actor, register, site, allocation, batch). Choose enum-compatible event/source additions after effective-schema inspection. Do not overwrite applied migration files.

Required constraints: positive integral quantities; nonnegative amounts; bounded rates; total = subtotal - discount + tax; discount <= subtotal; cash received >= applied cash and change = received - applied cash; matching currency; tenant-composite FKs; unique checkout/receipt identity. Cross-row totals must be enforced in the finalizer, with client table writes revoked. Handle overflow before casting JSON amounts to JS numbers.

Indexes: workspace/site/time/id for sale pagination; workspace checkout idempotency; site/register open session; existing SKU/UPC/barcode indexes; owner/item/position plus allocation status; indexed normalized inventory search. Use parameterized full-text/prefix search with limits, not arbitrary client PostgREST filters or a full inventory download.

Before migration: inspect actual event column types, policies, triggers and privilege grants; verify label prerequisite schema, inventory workspace mapping and ambiguous legacy SKU audit. Run clean replay in disposable Postgres/Supabase. Rollback is rollout disable plus retained immutable records; do not drop completed sales or restore old inventory quantities from backups as a feature rollback.

## 5. Routes and register experience

Status: Planned.

| Route | Purpose |
| --- | --- |
| `/dashboard/pos` | Register with compact stock results/cart and persistent totals/payment panel. |
| `/dashboard/pos/setup` | Site, existing inventory location mapping, explicit tax configuration and first register. |
| `/dashboard/pos/transactions` | Cursor-paginated history, receipt/date/status filters. |
| `/dashboard/pos/transactions/[saleId]` | Immutable transaction detail and receipt reprint. |
| `/dashboard/pos/transactions/[saleId]/receipt` | Authenticated standalone print document, isolated from dashboard layout. |
| `/api/pos/inventory` | Bounded site-scoped search/exact identifier resolution. |
| `/api/pos/register-sessions` | Open/select session with server authority. |
| `/api/pos/checkouts` | Validated idempotent cash finalization command. |
| `/api/pos/checkouts/[id]` | Recover authoritative checkout result after uncertainty. |
| `/api/pos/transactions` | Tenant-scoped history. |

Classify every page/API in the existing access registries. Enforce rollout, capability, workspace/site and session in server routes and database functions. Use `Cache-Control: no-store`, same-origin mutation checks, bounded request bodies and rate limits. Return safe domain error codes/messages; keep raw SQL errors out of the UI.

Register layout: wide cart/search area and narrow checkout panel; collapse to stacked touch-friendly layout on tablets. Clear printing/condition/finish/language/location/batch context; small centralized thumbnails; large total; visible focus and announced scan result. No decorative dashboard metrics. Use existing theme tokens.

Scanner controller mounts only in register mode. A bounded fast-character buffer ending in Enter invokes exact resolution; timing is a heuristic, with a dedicated input supporting slower scanners/manual barcode entry. Ignore modifier shortcuts, IME composition and editable targets other than the dedicated scanner input. Escape clears scan/search state; Backspace edits only the appropriate input. Queue scans in order and use functional cart updates so repeated scans increment rather than overwrite. Ambiguous identifiers require selection and never silently add the first result.

## 6. Money and checkout lifecycle

Status: Planned.

1. Client obtains stable checkout UUID and submits inventory/position identities, quantities, requested authorized discounts and cash received. Client totals are previews; an expected quote revision/total may detect a changed quote but cannot set the price.
2. Server resolves session/user/workspace/site, validates payload limits and invokes one transactional cash command.
3. Database serializes the idempotency key, checks stored fingerprint/result, locks open register session and stock using the shared lock protocol, revalidates availability and permission.
4. Read authoritative asking prices and site tax policy; calculate integer minor-unit line totals, discounts and taxes. Explicitly document half-up rounding and deterministic cart-discount allocation by largest remainder with stable line tie-breaks. Keep original prices and reason/actor for approved discounts. Reject changed quote before accepting completion.
5. Within the same transaction insert sale, line/allocation snapshots, tender, inventory decrements, events and receipt; set checkout completed. Any failure rolls back all changes.
6. Return receipt plus authoritative change. Retrying the same intent returns the same sale. UI disables edits/submission while uncertain and checks the original checkout; it must not create a new key automatically.

Money is bigint in Postgres; TS preview uses bounded integer/BigInt arithmetic. Convert existing numeric prices to cents in SQL; do not multiply JS floating-point dollars. Zero price must be explicitly configured, not substituted for absent data. Null cost basis stays unknown; tax collected is not sales revenue. Numeric bounds, rounding, discount allocation and refunds must share golden vectors.

## 7. Inventory integration and concurrency

Status: Planned.

Existing inventory item identity includes owner and item ID, with workspace and physical site checked independently. Cashier ID must not replace the inventory owner's ID. Exclude unmapped stock; never infer site solely from employee ownership.

Exact position labels consume only that position. Existing item-level labels resolve the item and use an explicit site allocation policy: matching storage locations, stable oldest-position ordering with ID tie-break. Snapshot all consumed positions. Reject inconsistent/missing provenance rather than falling back to an arbitrary batch. Non-positioned stock is eligible only when it belongs to mapped site storage and its unpositioned quantity can be established safely.

Available quantity accounts for all active marketplace allocations, including item-level reservations and position-specific reservations. Avoid counting an item and its positions as separate stock. Update item quantity, relevant position quantities/status and batch current quantities in one transaction; keep initial batch quantity intact.

**Shared locking is a prerequisite:** establish item-before-position ordering across reservation, POS and relevant quantity mutation paths; lock item IDs and then position IDs in deterministic order. Current marketplace RPC locks positions without the parent item on one branch, so a POS-only item lock does not serialize those writers. Any change to existing RPCs must be additive and regression-tested. Direct table mutation grants also need review: a transactional RPC alone cannot protect against alternate authorized writers bypassing its invariants.

Use existing `inventory_events` append-only enforcement. Sale events identify receipt/sale and inventory allocation; maintain before/delta/after invariants. Ordinary users must not fabricate POS-origin events or edit ledger history. A replay cannot create a second decrement/event.

## 8. Security and RLS strategy

Status: Planned.

All new tenant tables enable RLS and explicitly revoke anonymous privileges. Reads require workspace membership and the applicable POS permission; financial detail/cost basis needs separate authorization. Site/register assignments are checked in addition to organization membership. Workspace owner roles are tenant roles, not global administrator access.

Do not grant client insert/update/delete on completed sales, tenders, receipts or allocation history. Perform mutations through narrowly authorized transactional functions. Prefer invoker functions where grants support them; if immutable ledger writes require elevated execution, use an explicitly reviewed private-schema implementation with fixed search path, authenticated actor checks, full tenant/role validation and a narrow exposed wrapper. Revoke default PUBLIC execution. Never use a definer merely to make an RLS error disappear.

Reuse `pos.sell`, extend the existing capability registry for checkout/cash/session/history/settings/discount/override/refund actions, and preserve existing employee semantics. Do not assume a Store billing tier grants cashier or manager authority. The database must enforce the rollout and business authority as well as the HTTP endpoint.

Threat model and tests must cover cross-tenant IDs, removed membership, inactive employee, suspended user, mismatched site/register, direct RPC bypass, forged money, replay with changed payload, receipt enumeration, XSS in product/customer names, CSRF, cash fraud and immutable-history tampering. Logs contain correlation IDs and safe error codes, not tokens, raw provider bodies or customer payment data.

## 9. Payments, Square and refund extension

Status: Planned; Square integration and production configuration are not present.

Payment provider adapter exposes capabilities plus connect/disconnect/status, locations/devices/pairing, create/cancel terminal checkout, status lookup, refund and verified event normalization. Cash remains a local transactional tender. Manual/external tender is explicitly unverified. A deterministic test-only adapter covers approval, decline, timeout, cancel and refund; it is never selectable in production.

Future tables: merchant connections, provider location mappings/devices, payment attempts, deduplicated provider events, refunds and refund allocations. Store many attempts/tenders per sale, unique provider payment IDs scoped by connection/environment, and provider idempotency keys. Refunds reference original lines/tenders and enforce cumulative quantity/amount ceilings. Explicit restock decisions generate new events to the exact returned identity; never mutate/delete the original sale or restore stock merely because money was refunded.

External processor actions cannot join the inventory transaction. Before terminal payment, persist checkout/quote and acquire an explicit expiring reservation using the common stock authority. Keep cash carts unreserved. Reconcile late approvals after expiration as a distinct exception; never silently mark paid without fulfillment or automatically charge again. Persist provider confirmation before finalization/recovery. Completed payment with failed inventory commit requires recoverable exception handling and controlled refund/cancel workflow.

Square uses each merchant's OAuth relationship, single-use expiring state bound to user/workspace, server-only encrypted tokens and refresh handling. Separate sandbox/live identity and device/location mapping. Pair terminals only to authorized site/register. Webhooks verify signature against raw bytes and configured notification URL, deduplicate event IDs, validate merchant mapping, and reconcile authoritative provider status; stale events cannot regress completed state.

Future configuration names (documentation only): `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_OAUTH_REDIRECT_URI`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL`, `POS_CREDENTIAL_ENCRYPTION_KEY`, `POS_CREDENTIAL_KEY_VERSION`. Define exact configuration at the Square phase; do not add or populate runtime secrets in Phase 1. Encrypted credential storage must not be readable through browser Data API. Raw PAN/CVV/PIN/track/chip data never enters Trading Docks.

## 10. Labels, registers and recovery

Status: Planned POS integration; existing printing components are reusable.

Reuse stable label identities and current templates. Existing SKU uniqueness is workspace-scoped, not global; resolver requires workspace. Phase 2 must address globally unambiguous new barcode payloads and position-level identity without invalidating old labels. UPC/product IDs may identify multiple eligible stock lots; resolve to choices or explicit allocation, not a unique inventory claim.

Reuse isolated document printing from `src/lib/chaos-sort/print-document.ts`; preserve concrete physical `@page` dimensions, zero margins, exact label roots and no trailing break. Add actual PDF page-count/dimension tests for one and five labels. Existing single-batch tests are not proof of future multi-label behavior. Preview and print share a renderer; browser/driver settings still require physical printer QA. ZPL remains later optional export.

Phase 3 adds opening float, paid-in/out reasons, immutable cash events, closing count/variance and role controls. Expected cash = opening float + applied cash sales - cash refunds + paid-in - paid-out. Change is already removed from received cash; do not subtract it twice. Closing a session must serialize against checkout to prevent a sale after close.

Recovery: query original checkout UUID after timeout; reprint persisted receipt; retry finalization only for the original authorized payment; reconcile provider status by stored provider IDs. Do not create another charge as a retry. Disable rollout to stop new sales while retaining read-only transaction access and recovery. Future schema rollback preserves history.

## 11. Implementation phases and evidence gates

| Phase | Deliverable and gate |
| --- | --- |
| 1 — Foundation | Site/register/session setup, gated navigation, real search/scans, cart, integer cash checkout, exact stock/events, receipts/history. Must pass actual database atomicity/RLS/concurrency tests and authenticated browser flow before being described as usable. |
| 2 — Labels | Extend existing labels/identities for POS and Chaos Sort selection; one/five-label PDF regression and physical printer QA. |
| 3 — Register operations | Drawer events, reconciliation, employee permissions, audit trail and session-close race tests. |
| 4 — Payment architecture | Provider capabilities, attempts/state machine, secure connections, reservations and deterministic mock E2E. |
| 5 — Square connection | Sandbox OAuth, refresh/disconnect, locations, verified webhooks and reconciliation. |
| 6 — Terminal | Sandbox pairing/checkout/late responses/cancel/refund; physical terminal QA before release. |
| 7 — Advanced checkout | Existing CRM customers, quick items, governed overrides/discounts, split tender and partial returns. |
| 8 — Analytics | POS channel adapter into existing Orders/analytics, correct net tax/refunds/cost basis and no duplication. |

Before runtime edits run root `typecheck`, `lint`, `test` and relevant baseline build. After each slice rerun required checks, integration/E2E, production build and `git diff --check`. Changes to shared mobile contracts additionally require relevant scripts from `mobile/package.json`; do not test historical backups as active apps.

Required Phase 1 database cases: anonymous/wrong-tenant/viewer deny; same-tenant permitted employee; composite FK mismatch; direct ledger write denial; duplicate and simultaneous identical requests yield one sale; changed-payload replay rejected; two registers compete for last copy; marketplace allocation races POS; position and batch count consistency; malformed/missing price; rollback after each financial/inventory write failure; closed register; receipt totals and snapshot immutability. Run tests against an explicitly verified disposable target, not whichever database environment happens to be configured.

Required browser cases: setup/open register, real inventory search, scan twice, typing into quantity field without interception, unavailable/ambiguous scan, cash/change, lost-response recovery, transaction detail/reprint, keyboard/tablet layout. Regression-test Inventory, Chaos Sort, Orders, Catalog, Analytics, authentication and marketplace flows. No simulated SQL/source-text assertion may be represented as an executed RLS test.

## 12. Major risks and present validation status

1. **Foundation acceptance recorded:** Phase 1 is authorized; staging and production release acceptance remain separate.
2. **Tenant/owner mismatch:** workspace-read label infrastructure does not make owner-only stock mutations safe for employees.
3. **Concurrent stock authority:** POS and marketplace reservations must share locks; legacy direct writers can bypass an otherwise correct finalizer.
4. **Migration drift:** incompatible event declarations and older proposal docs require clean replay plus effective-schema inspection before migration authoring.
5. **Physical site ambiguity:** storage location hierarchy cannot safely stand in for store locations without explicit mapping.
6. **Pricing authority:** missing or stale asking prices must block or request review; aggregate market value is not a selling price.
7. **Historical identity:** item-level SKUs do not select exact positions; workspace-scoped uniqueness must not be advertised as global uniqueness.
8. **External payment uncertainty:** future terminal success needs reservations, durable attempts, deduplication and recovery before it can be production-capable.

The initial documentation-only audit ran no runtime checks. Subsequent Phase 1 code and local Postgres/browser validation are reported in [POS_PHASE1_VALIDATION.md](./POS_PHASE1_VALIDATION.md). Do not interpret the original proposed scope above as a claim that later phases or shared employee stock access are implemented.

## References

- Repository authority: `AGENTS.md`, `docs/ROADMAP.md`, `docs/DEFINITION_OF_DONE.md`.
- Source contracts: `src/lib/platform/*`, `mobile/services/platform-access.ts`, `src/lib/label-studio/*`, `src/lib/selling/allocation.ts`, `src/lib/orders/order-repository.ts`, `src/lib/inventory-provenance.ts`.
- Schema: auth foundation; inventory persistence; Label Studio proposal; August inventory event ledger; September inventory events; Chaos Sort sessions/positions; Selling foundation/allocation/multiplicity migrations.
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security): grants and row policies must both enforce access; tests must exercise database roles.
- [Square Terminal API overview](https://developer.squareup.com/docs/terminal-api/overview): future terminal adapter reference. Recheck current OAuth, webhook and sandbox specifics during their implementation phases.
