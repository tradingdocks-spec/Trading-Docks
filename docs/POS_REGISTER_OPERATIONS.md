# POS register operations

Status: Implemented in development source, 2026-09-20. Requires Production Configuration and independent hosted-auth/hardware acceptance before rollout. Branch: `codex/pos-foundation`.

## Accepted ownership boundary

**Inventory ownership remains canonical and unchanged. POS employee access is granted through explicit, owner-controlled, revocable, location-scoped operational delegation.**

The Phase 3 audit at `d7cdaabc03258bf77b16b7d1f919c1c6c1d162e9` established that employee checkout could not safely be implemented by granting workspace managers owner-like powers. The user subsequently approved the narrow delegation extension. That review gate is satisfied for development; production remains blocked.

Canonical `(user_id, item_id)` ownership, position and batch provenance, cost basis, marketplace allocations and immutable inventory history remain authoritative. The employee never impersonates the owner. Multiple owners may map their own storage into a shared workspace site; grants remain independent for each owner, site and employee. Label Studio administrative permissions are unchanged.

## Authorization and revocation

`pos_inventory_delegations` records workspace, site, canonical stock owner, employee user, sell/return capabilities, grantor/time, optional expiry and retained revocation actor/time. Only the inventory owner grants or revokes access to their mapped stock. Scope changes revoke the old record and create a new one. `pos_access_events` retains attributable snapshots. Existing `workspace_employees.permissions` stores the separate POS capability layer; owner/admin controls employee permissions.

`pos_private.can_transact` composes authenticated workspace membership, active employee/account, POS sell or refund permission, eligible paid inventory owner, site/storage eligibility, and either canonical ownership or a current explicit grant. Search, barcode resolution, checkout and returns use this common rule. A manager without a grant cannot sell foreign stock. A grant without checkout permission is insufficient. Refund permission and return scope are independently checked. Authorization failure denies the operation.

Grant/revoke and checkout acquire the same owner advisory lock. Checkout rechecks authorization after acquiring it, before canonical mutation. Revocation that obtains the lock first invalidates an existing cart; a transaction that obtained it first completes before revocation. Owner locks are ordered before parent inventory and physical positions, preserving shared marketplace reservation serialization. No cash cart reserves stock.

The canonical mutation guard accepts delegated changes only with a private, transaction/backend/actor-bound exact-row permit minted immediately around the authorized stock update. The permit fixes owner, item, old row and resulting quantity; only quantity, aggregate inventory value and updated timestamp may change. Clients cannot read/write permits or mint them through a public helper. Client GUCs, service-role flags and fabricated owner JWTs provide no proof. Direct table writes remain denied.

All new public tables enable RLS and revoke direct client privileges. Narrow authenticated POS RPCs provide scoped reads/writes; private helpers revoke PUBLIC execution and use fixed search paths. Real cashier and independent manager identities are retained separately.

## Registers and cash

Registers belong to one workspace/site, with active state, name, description and hardware preference fields. The UI creates and activates/deactivates registers. Deactivation cannot strand an active session. Sessions record opener, opening float and OPEN → CLOSING → CLOSED state. CLOSING blocks sales; a manager may resume OPEN. Closed sessions are immutable. Closing requires the displayed session identity, a counted amount, configured variance notes and independent approval when a cashier exceeds the configured threshold. Blind counting hides expected cash from nonmanagers until count completion.

Immutable `pos_cash_events` records opening float, applied cash sale, cash refund, paid in, paid out, cash drop, adjustment and register close. Every manual movement requires a structured reason and explanation. Adjustments require a manager or a separately authenticated manager approval. Cash sale entries use the applied sale amount, so change is not subtracted twice.

Expected cash = opening + applied cash sales − cash refunds + paid in − paid out − cash drops + signed adjustments. For example, 20000 + 42578 − 2500 + 5000 − 1500 − 30000 = 33578 minor units. Counted cash and variance never rewrite the ledger. Historical sessions have unknown opening float represented as zero; migration does not invent historical counts.

Open, close, cash movements, refunds and approvals carry persisted idempotency keys. The operation receipt binds actor/key to exact action and intent. Retrying an identical request returns the original result; changed intent fails. Browser recovery retains uncertain requests and retries their original key. Session locks serialize checkout, refund and closing.

## Pricing and approvals

SQL requotes canonical current prices at checkout. Fixed and percentage line discounts, fixed and percentage cart discounts, and explicit unit-price overrides are separate controls. Mutually exclusive forms are validated; discounts cannot exceed the sale. Cart discount allocation uses cumulative integer proportions in stable owner/item/position order, with Unicode code-point ordering shared by SQL and browser preview. Tax rounds per line after discounts. Snapshots preserve original price, effective price, discount and allocation details; public receipts omit cost basis.

Manager approval consists of immutable request and decision records, with actual requester and approver identities. The approver must be a different, currently authorized manager. Approval binds workspace, site, operation and exact intended values and can be consumed once. It includes a sanitized authoritative pricing summary or expected cash. Changed prices or cash invalidate the approval even if a price override leaves the charged total unchanged. The original cashier executes the approved operation; approval does not transfer inventory authority.

## Refunds and provenance

Refunds reference original immutable sale items, permit partial quantities, require structured reason/notes and an explicit restock decision, and prevent cumulative over-refunding. Cumulative integer allocation preserves original net and tax totals across split refunds. Cash refunds belong to the current processing session, not the original sale's drawer.

Restocking revalidates current return permission and owner/site mapping, then restores original item, exact allocation/position and batch provenance. Deleted, retired or condition/printing/location-changed provenance fails closed. No-restock refunds move cash without stock. Legacy sale snapshots lacking the per-unit inventory-value basis cannot automatically restock; use a no-restock refund and separately authorized inventory review. Original receipts, tenders and events are never edited. Return events attribute the real actor while retaining canonical stock ownership.

## Receipts, history and reporting

Payment Complete shows amount/change and a deliberate New Sale action; scanning cannot silently start another sale. Isolated receipt documents support 58mm, 80mm and Letter, with long thermal pages measured from rendered content. Settings include store address/footer/return policy and employee/SKU/location visibility. Reprinting reads the immutable sale snapshot; later refunds are separately annotated. The renderer is reusable for future email delivery; no email service is connected.

History supports store-local date ranges, register, employee, payment, status and receipt/SKU/product search, with cursor pagination. Detail includes refunds, inventory events, cash activity and approval evidence. Register history shows opener/latest operator/closer, state, expected/count/variance, notes and activity. The current session listing is bounded to the latest 200 records; full historical session pagination is a follow-up.

Daily reporting uses the configured IANA site timezone and calendar-day boundaries. It includes gross/net sales, discounts, tax, refunds, cash, transaction count, average sale, registers, hours, employee activity and reconciliation variances. Noncash is zero in this cash-only phase. Queries read the authoritative POS records; they do not invent marketplace Orders or duplicate warehouse analytics.

## Remaining release gates and later phases

Hosted Supabase invitation/sign-in/RLS, real shared-device sign-out/account switching, production prerequisite migration replay, physical scanner/printer/drawer behavior and installed native app acceptance remain unverified. Local browser tests use real SQL with isolated synthetic auth prerequisites, not hosted authentication or full Next HTTP transport. There is no PIN fast-switch, offline checkout, card processor, split tender, automated email or production rollout. Mobile shared access semantics are validated; the register remains web-based.

Future external card authorization can outlive a delegation. Phase 4/5 must persist payment/reservation/recovery state and reconcile a payment approved before revocation without financial loss. Do not treat an old cart grant as permanent authority or silently retry a charge. That state machine is Planned and is not needed for atomic online cash.
