# Production POS Pilot Phase B — limited live cash operations

**Session OPEN — sales #1–#3 verified; sale #4 drafted, awaiting actual tender.** No final PASS/FAIL verdict is claimed before execution completes.

## Sale #4 multi-item draft

Owner requested one Prodigy's Prototype NEO #231 NM/nonfoil ($0.50) and one Serra Angel W16 #3 NM/nonfoil ($0.25). Fresh production checks verified both original item/position quantities are **7**, owner/workspace/UC Bulk Boxes match, positions active and no marketplace allocations/listing/order/mapping/showcase reservation references exist. Language and physical slot remain unrecorded. Current expected drawer $201.90; session OPEN; tax 850 basis points; Square connections zero.

The browser explicitly selected both exact positions ending `468db788725e4ca6` and `59f0584f58c846cd`, quantity 1 each, with no discount/override. Subtotal **$0.75**, tax **$0.06**, total **$0.81**. Independent per-line tax is round(50 × 8.5%) = 4 cents plus round(25 × 8.5%) = 2 cents. Actual cash tender is pending; checkout not submitted. Required post-sale checks: each position 7 → 6, one sale/receipt/tender, two lines and one mutation/event per position, no duplicates, expected drawer $202.71. These remain expectations until completion.

## Sale #3 completed checkpoint

Owner supplied actual tender $2.00. Browser verified subtotal $1.00, tax $0.09, total $1.09, cash $2.00 and change $0.91 before one checkout submission. Completed **2026-09-22 00:17:05.603732 UTC**.

- Sale: `8e9d0fcf-601e-4f06-a644-f4c0b896628a`; receipt: `TD-8E9D0FCF601E4F06A644F4C0B896628A`.
- Idempotency key: `51b6e2d7-f744-455f-bd9b-09b025334cc8`.
- Exactly one cash tender `6d89e11b-7dc5-430a-924c-edbe53c31d12`: applied 109, received 200, change 91 cents.
- Exact Prodigy's Prototype item and position both **9 → 7**. Allocation `beca1b6f-fee0-4162-9e06-2fd87d8149af` records quantity 2 against the original position/batch/location.
- Exactly one inventory event `379d211d-29c1-4557-b4f3-8be0a4525025`: before 9, change −2, after 7, linked to this sale.
- Correct owner, workspace, site, Front Register and Phase B session attribution; no discount or override. One sale and receipt for this command, one tender/allocation/event; no duplicates. Phase B now has exactly 3 sales.
- Expected cash **$201.90** = $200.00 + $0.54 + $0.27 + $1.09. Global units 1,784; events 1,555.
- Browser confirms Payment Complete with $1.09 paid and $0.91 change. Square connection and credential counts remain zero.
- Stopped after verification; no subsequent sale prepared. Register remains OPEN. Final refund, discount, multi-item, reconciliation, log, smoke and close gates remain outstanding.

## Sale #3 draft checkpoint

Owner requested 2 × Prodigy's Prototype NEO #231, NM/nonfoil, at $0.50 each. Fresh production read verified item and exact position `chaos-62e742fa4f174ec995e9c15ce2e7b563-468db788725e4ca6` both have quantity 9, correct owner/workspace/UC Bulk Boxes, active status and no marketplace allocation/listing/order/mapping/showcase reservation references. Language/slot remain unrecorded. Session remains OPEN with expected cash $200.81; site tax remains 850 basis points; Square connections zero.

Browser draft explicitly selects this position and quantity 2, no discount/override: subtotal **$1.00**, tax **$0.09**, total **$1.09**. Independent tax: 100 × 850 / 10,000 = 8.5 cents, rounded to 9. Cash is not entered and checkout is not submitted. Actual tender requested from owner. After authorized completion, required checkpoint is one additional sale/receipt/tender, one quantity −2 event, exact stock 9 → 7 and drawer $201.90; these are expectations, not completed results.

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
- Owner provided actual tender **$1.00**, expected change **$0.46**, and instructed stopping after sale #1 verification. The browser matched all five approved amounts before checkout.

## Sale #1 verified checkpoint

Completed **2026-09-22 00:02:54.842939 UTC**. Sale `e23e436c-f3ec-462b-ac0c-72a4876a366a`; receipt `TD-E23E436CF3EC462BAC0C72A4876A366A`; idempotency key `2741986b-bb9d-4700-bb45-d05a8a6c2349`.

Exactly one Phase B sale, receipt and cash tender were found. Tender `b93f7a9e-714e-4700-89f8-26fbe1df9b19` records 54 cents applied, 100 received, 46 change. Subtotal 50 cents, tax 4 cents, discount zero. Correct owner/operator, workspace, Front Register, site and Phase B session attribution were verified in sale/receipt/allocation records.

Allocation `931239b1-2550-40dd-b4a4-0dcf080ca677` references the exact Prodigy's Prototype position and batch. Both item and position decreased **10 → 9** once. Inventory event `cb8e62da-968f-4c68-a95a-7c73ac9941df` records before 10, change −1, after 9, and links to the sale with correct workspace/register/owner metadata. No duplicate sale, tender, allocation or event was found. Total inventory units **1,787**; events **1,553**.

Expected drawer is **$200.54**, independently reconciled as $200.00 + $1.00 received − $0.46 change. Browser confirms Payment Complete, $0.54 paid and $0.46 change. No sale #2 has been prepared or submitted. Session remains open for this bounded pilot; no closing count has been assumed. Production log review and final reporting/smoke checks remain pending.

## Execution evidence pending

### Sale #2 completed checkpoint

Owner supplied $1.00 actual cash. Before submission the browser showed subtotal $0.25, tax $0.02, total $0.27, cash $1.00 and change $0.73, exactly as approved. Completed **2026-09-22 00:07:19.160797 UTC**.

- Sale: `5c6e9dbf-924c-4f32-9ce8-d7bf0949240e`; receipt: `TD-5C6E9DBF924C4F329CE8D7BF0949240E`.
- Idempotency key: `c6d567a0-9e53-4316-9fe0-9e785494ef48`.
- Exactly one corresponding cash tender `63f787d8-3952-4a5c-8848-2e9896171398`: amount 27, received 100, change 73 cents.
- Exact Serra Angel item/position quantity **8 → 7** once; one allocation `a467ec80-d595-46f4-a233-ca399d0c8c0d` and one event `099c28df-d140-439c-be54-88696161076e` (before 8, change −1, after 7).
- Owner, workspace, site/storage, register, session and original batch attribution match the approved position. No discount/override; language remains unrecorded.
- Exactly **two Phase B sales** now exist. No duplicate sale/receipt/tender/allocation/event for sale #2. Global units **1,786**, inventory events **1,554**.
- Expected cash **$200.81** = $200.00 + $0.54 + $0.27. Browser confirms Payment Complete, $0.27 paid, $0.73 change.
- Stopped without preparing/submitting sale #3, as requested. Register remains OPEN. Phase B final log/report/smoke/close gates remain outstanding.

Sale #2 preparation: owner selected Serra Angel W16 #3, NM/nonfoil, quantity 1 at $0.25. Fresh database checks confirmed exact position `chaos-4a2bfbcd52ea4bcf910742ffaebf7da9-59f0584f58c846cd`, item/position stock 8, correct owner/workspace/UC Bulk Boxes, active position and zero marketplace allocation/reservation/reference rows. Language and physical slot remain null. The browser explicitly selected this position and quotes subtotal $0.25, tax $0.02, total $0.27, without discount/override. Independent tax check: 25 × 850 / 10,000 = 2.125 cents, rounded to 2 cents. Cash received is blank; checkout has not been submitted. Production Square connection count remains zero.

Transaction summaries, discount, refund, closing count/variance, exact-position reconciliation, independent reporting reconciliation, authorization observations, production log review and non-POS smoke checks will be recorded during the live session. No schema/code, staff permission or Square configuration changes have occurred.

Reconciliation: expected cash = opening + cash sales − cash refunds + paid-in − paid-out − cash drops (using actual signed ledger movements once). Ending stock = starting stock − sold quantity + returned quantity. Do not invent cash movements to exercise features or force zero variance.

Stop new activity on a critical defect, reconcile/close if safe, disable the pilot workspace and preserve history. At completion return to the owner approval gate; no broader rollout is authorized.
