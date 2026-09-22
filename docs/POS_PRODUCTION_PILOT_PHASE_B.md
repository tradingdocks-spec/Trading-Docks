# Production POS Pilot Phase B — limited live cash operations

**Session OPEN — first sale quoted, awaiting actual cash tender.** No Phase B sale has been submitted. No final PASS/FAIL verdict is claimed before execution completes.

## Approved scope

- Workspace: `4e775109-9f6f-4264-88c8-2c3c5b944a9b`.
- Owner/operator: `3ea45327-7984-4108-ada8-511748e73fd8` (`tradingdocks@gmail.com`). Owner-only; no staff access changes.
- Storage: UC Bulk Boxes, `0abd559d-acfc-4073-aa7f-a68309fe80e0`.
- POS site: `52837f8e-62a8-4145-92f8-ca6eba8dc12c`.
- Front Register: `adce5a44-1f5b-44b4-b91b-24519bc2699f`.
- Owner confirmed new opening cash: **$200.00**.
- Actual tender must be requested separately before each sale. Actual closing count must be requested at session end; neither may be assumed.
- Cash only; one short session, target 5–10 sales, multi-item and quantity coverage, one small policy-permitted approved discount, and one refund with an explicit inventory return decision.
- Production Square remains disabled. Physical hardware certification remains unchanged.

## Read-only preflight

At **2026-09-21 23:58:27 UTC**: zero enabled workspaces, zero open register sessions, zero Square connections. Inventory baseline: **1,515 rows / 1,788 units / 1,552 inventory events**. Existing UC Bulk Boxes tax is **850 basis points (8.5%)**; do not change it.

Screened inventory belongs to the owner and pilot workspace, has positive exact-position stock at UC Bulk Boxes, and has no selling allocations, listing candidates, marketplace order-item links, listing mappings or showcase reservations. Recheck selected positions before transactions.

| Candidate | Exact position | Available | Asking price | Status |
| --- | --- | --- | --- | --- |
| Sultai Charm, KTK #204, NM/normal | `chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7` | 1 | $1.00 | Existing price |
| Prodigy's Prototype, NEO #231, NM/normal | `chaos-62e742fa4f174ec995e9c15ce2e7b563-468db788725e4ca6` | 10 | $0.50 | Owner approved and persisted |
| Serra Angel, W16 #3, NM/normal | `chaos-4a2bfbcd52ea4bcf910742ffaebf7da9-59f0584f58c846cd` | 8 | $0.25 | Owner approved and persisted |

Language and physical slot are unrecorded; do not fabricate either. Initially only Sultai Charm was priced. The owner subsequently approved the two prices above. The existing inventory asking-price UPDATE was executed under the authenticated owner role, with RLS and collector triggers retained. Transaction assertions proved only asking_price and the normal updated_at timestamp changed; both full position records were unchanged. Counts remained 1,515 / 1,788 / 1,552. POS was disabled throughout pricing correction. All five categories of marketplace references/reservations were rechecked absent before enabling the single pilot workspace.

## Open session and first checkpoint

- Session: `a6cea5c0-6db4-455b-831a-272a58a89d4d`.
- Opened through production UI: **2026-09-22 00:01:17.513306 UTC** (September 21, 17:01:17 America/Phoenix).
- Opening cash: **20,000 cents**, owner-provided physical count.
- Database verified correct owner, Front Register and pilot workspace attribution. Other workspaces remain disabled; Square connection/credential counts zero.
- Sale #1 draft: one Prodigy's Prototype from exact position ending `468db788725e4ca6`, no discount/override. UI subtotal $0.50, tax $0.04, total $0.54.
- Independent tax check: 50 cents × 850 / 10,000 = 4.25 cents, rounded to 4 cents; total 54 cents.
- Actual tender has been requested and is pending. No checkout submitted, no change amount assumed.

## Execution evidence pending

Transaction summaries, discount, refund, closing count/variance, exact-position reconciliation, independent reporting reconciliation, authorization observations, production log review and non-POS smoke checks will be recorded during the live session. No schema/code, staff permission or Square configuration changes have occurred.

Reconciliation: expected cash = opening + cash sales − cash refunds + paid-in − paid-out − cash drops (using actual signed ledger movements once). Ending stock = starting stock − sold quantity + returned quantity. Do not invent cash movements to exercise features or force zero variance.

Stop new activity on a critical defect, reconcile/close if safe, disable the pilot workspace and preserve history. At completion return to the owner approval gate; no broader rollout is authorized.
