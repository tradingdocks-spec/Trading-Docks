# Production POS Pilot Phase A — cash-only retry

**PHASE A PASS — CASH PILOT HEALTHY.**

Final verification: **2026-09-21 23:52:34 UTC**. POS is disabled for all production workspaces after the controlled pilot. Production Square remains disabled/unconfigured. Physical hardware acceptance remains pending.

## Completed cleanup, pricing prerequisite, and cash retry

The owner authorized briefly enabling only the pilot workspace to close the abandoned session using their confirmed physical cash count of $200.00. Normal production UI `begin_close` / `close` commands closed session `4645a34f-e3d4-46f4-bc5d-19dcbddcfd35` at **23:47:37 UTC**: opening, expected and counted cash each 20,000 cents; variance 0. There were still zero sales, tenders and refunds. POS was immediately disabled again and zero enabled workspaces verified before pricing correction.

The exact item's `asking_price` was set to **$1.00** using the existing inventory UPDATE operation used by inventory repricing, scoped by item, owner and workspace. The database command ran as `authenticated` with the authorized owner's transaction-local identity, retaining normal RLS and collector triggers. No guard, policy, function or pricing architecture changed. The first guarded transaction rolled back because its whole-row invariant also compared `updated_at`; inspection confirmed the existing collector trigger legitimately updates that timestamp. The successful transaction permitted only `asking_price` and that normal timestamp to change, and asserted the full tracked-position row remained identical. After commit: price $1.00, quantity 1, 1,515 rows / 1,788 units / 1,550 events, no allocations. No price-change inventory event was produced.

Before retry enablement, verified no open register session, no existing sale, no marketplace allocations, listing candidates, order-item links, listing mappings, or showcase reservations for this item. The same single owner workspace was enabled under the previously authorized retry scope. All other workspaces stayed disabled.

| Step | UTC time | Verified result |
| --- | --- | --- |
| Open new Front Register session | 23:49:48 | $200.00 opening float; correct owner/site/register/workspace |
| Browser quote before checkout | Before 23:50:24 | Exact position explicitly selected; quantity 1; subtotal $1.00; tax $0.09 at 8.5%; total $1.09; received $2.00; change $0.91; no override or discount |
| One cash sale | 23:50:24 | Exactly one sale, receipt, sale item, allocation, and cash tender; original stock 1 → 0; one removal event; expected drawer $201.09 |
| Full cash refund with return to inventory | 23:51:32 | Exactly one refund/refund item; $1.09 cash returned; original position 0 → 1; one restoration event; expected drawer $200.00 |
| Final register close | 23:52:22 | CLOSED; expected $200.00; owner-confirmed counted $200.00; variance $0.00 |
| Final disable and verification | 23:52:34 | Zero enabled production workspaces; both sessions CLOSED; no Square connections or credentials |

New session: `c52d874e-d552-4ee3-b1ac-78af34a29fe3`.
Sale: `fe970122-011c-4a17-8750-170e71646bd4`.
Receipt: `TD-FE970122011C4A178750170E71646BD4`.
Cash tender: `7effe2d3-dba1-44b8-9dc0-0e6e5f77612a` (109 cents applied, 200 received, 91 change).
Sale allocation: `ff568d55-90ca-4a1c-ab32-e8fedf375c89`.
Refund: `4f15de18-2d63-4718-a121-c6469c4d1549` (100 cents subtotal + 9 tax).
Removal event: `07027f15-9fe8-41e1-812f-7a6fdb8e1d3d`.
Restoration event: `8d14b57d-7eb1-4b09-8e69-a18d718baf7d`.

The refreshed transaction page displays **Cash with refunds**, the $1.09 refund and zero remaining refundable quantity. Receipt and sale snapshots retain the exact printing, condition, finish, original stock position and storage. Inventory-event workspace/register attribution is stored in event metadata (the legacy top-level event workspace field is null). Sale/refund/session workspace and actor columns match the intended owner workspace.

Final inventory: **1,515 rows / 1,788 units / 1,552 events**. The only added inventory events are the verified sale and refund; owner, workspace, batch, location, condition, finish and valuation are preserved. Language and physical slot remain null. Asking price remains $1.00. Marketplace allocations and showcase reservations remain zero for this item. All public POS tables retain RLS.

New-session cash ledger is exactly OPENING_FLOAT +20,000, CASH_SALE +109, CASH_REFUND −109, REGISTER_CLOSE 0 cents. There are no duplicate sales, receipts, tenders, refunds or stock movements, and no paid-in/out. Physical counts are the amounts explicitly supplied by the owner, not independently observed by the agent.

No application code, schema, deployment, Square configuration, staff permission or hardware certification changed. No further transaction is authorized by this completed pilot; return to the owner approval gate.

## Historical failed attempt (resolved by the completed retry above)

## Retry outcome — 2026-09-21

Owner confirmed Sultai Charm KTK #204, NM/normal, quantity 1, exact tracked position below, $1.00 price, 8.5% tax ($0.09), $1.09 total, $2.00 tender and $0.91 change. Language and physical slot must remain unrecorded. Refund was authorized to restore the original position.

The application created UC Bulk Boxes / Front Register at **23:21:36 UTC**, mapped to the existing storage, with tax 850 basis points and America/Phoenix timezone. Register session opened at **23:21:44 UTC** with exactly one $200.00 opening-float ledger event. Owner attribution was correct.

**Stop condition:** inventory search returned the exact Sultai Charm printing, one available, with a disabled **Price required** result. Its `asking_price` remains NULL. The current Register component prevents adding an unpriced item; its cart price override cannot be reached for this item. No alternate API checkout, persistent asking-price edit, or guard bypass was attempted. The approved $1.09/$0.91 quote was therefore not produced and checkout was never submitted.

At **23:22:30 UTC**, the incident disable below was executed for the sole pilot workspace. Verified enabled-workspace count: **0**. Production Square connection and credential counts: **0**.

| Verification | Result |
| --- | --- |
| Inventory rows / units / events before and after | 1,515 / 1,788 / 1,550 — unchanged |
| Exact item and original position quantities | 1 / 1 — unchanged |
| Sales / tenders / refunds | 0 / 0 / 0 |
| Cash ledger | One OPENING_FLOAT event, 20,000 cents; no other movements |
| Calculated drawer balance | $200.00; not a physical count |
| Register session | OPEN, preserved; close/count still outstanding |
| Sale / refund / receipt acceptance | Not reached |
| POS / production Square | Disabled / disabled and unconfigured |

Site ID: `52837f8e-62a8-4145-92f8-ca6eba8dc12c`.
Register ID: `adce5a44-1f5b-44b4-b91b-24519bc2699f`.
Session ID: `4645a34f-e3d4-46f4-bc5d-19dcbddcfd35`.
Opening event ID: `cdadeed1-f455-4a52-b014-972d68ca6af5`.

Next owner gate: resolve the unset inventory asking-price prerequisite and confirm actual drawer count before authorized session cleanup/retry. Do not open a second session or claim zero variance. No runtime code or schema changes were made. Hardware certification is unchanged.

## Earlier preparation record (superseded by outcome above)

The earlier Phase A failure was the missing POS installation prerequisite. That prerequisite is now resolved; this retry has no final PASS/FAIL verdict until the authorized sale, refund and close are verified.

## Scope and current state

On **2026-09-21 23:06:14 UTC**, POS was enabled for exactly one owner-controlled workspace: `4e775109-9f6f-4264-88c8-2c3c5b944a9b`, owned by `tradingdocks@gmail.com`. The guarded enablement transaction verified the owner/Auth/member relationship, exactly one owner membership, no employees, no existing sale/session and no Square credentials/connections. Enabled workspaces: **1**; other enabled workspaces: **0**.

Signed-in owner browser verification now shows **Set up your first register**. No POS site/register has been created or opened yet, because the site tax treatment requires owner confirmation. Intended register: **Front Register**; intended inventory storage: **UC Bulk Boxes**. Opening float authorized: **$200.00**, physical readiness not yet confirmed.

Production Square remains disabled/unconfigured. No card tender, Terminal, employee delegation, additional workspace or hardware certification change was made.

## Selected single-item candidate — not yet approved for sale

| Field | Reconfirmed value |
| --- | --- |
| Item | Sultai Charm |
| Printing | KTK #204 |
| Condition / finish | NM / normal |
| Inventory quantity / proposed sale quantity | 1 / 1 |
| Exact position quantity / state | 1 / active |
| Inventory owner | `3ea45327-7984-4108-ada8-511748e73fd8` — canonical workspace owner |
| Workspace | `4e775109-9f6f-4264-88c8-2c3c5b944a9b` |
| Storage | UC Bulk Boxes |
| Storage ID | `0abd559d-acfc-4073-aa7f-a68309fe80e0` |
| Batch | `00790698-e8b0-403d-9251-7d5458d21c29` |
| Item and exact tracked position ID | `chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7` |
| Language | Unrecorded in both inventory and position; no value invented |
| Physical ordinal/slot | Unrecorded; owner must locate the actual card |
| Asking price | Unconfigured; awaits explicit approval |
| Recorded inventory valuation | $0.24; this is not a sale price |

Rechecked production references: zero inventory allocations, listing candidates, marketplace order-item links, marketplace listing mappings and showcase reservations for this item. There are zero POS payment checkouts. Recheck immediately before checkout in case concurrent marketplace activity changes availability.

No inventory row, quantity, price, language, location or reservation was changed. Baseline remains **1,515 inventory rows / 1,788 units / 1,550 inventory events**.

## Required owner confirmation

Approval requested for this exact card, an explicit sale price and tax treatment/rate. Also requested: physically locate the card, confirm the $200 float is present, and specify actual cash tendered. No 8.5% rate, tax exemption, default price or physical cash count is assumed.

After approval: configure the one register/site and storage mapping, open with the approved float, quote one unit, show subtotal/tax/total, and stop again if the total differs from the approved expectation. Then one cash sale only.

The controlled refund will **restore inventory** to the exact original position, unless the owner changes that choice before execution. Final counted cash must be a physical count; expected cash alone is not evidence of counted cash.

## Pending verification

- Sale, receipt and cash tender: **not created**.
- Register session: **not opened**.
- Stock decrement/event and operator/workspace/location attribution: **not run**.
- Refund/restock and receipt history: **not run**.
- Register close and zero variance: **not run**.

If any verification fails, stop the pilot and disable this workspace as needed, preserving all history. The narrowly scoped incident operation is:

```sql
begin;
update public.pos_workspace_settings
set enabled = false
where workspace_id = '4e775109-9f6f-4264-88c8-2c3c5b944a9b';
select workspace_id, enabled from public.pos_workspace_settings
where workspace_id = '4e775109-9f6f-4264-88c8-2c3c5b944a9b';
commit;
```

The incident disable was executed as recorded in the retry outcome. The preparation notes above describe the earlier state, not current readiness.
