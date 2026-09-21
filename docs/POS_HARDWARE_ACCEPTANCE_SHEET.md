# POS hardware acceptance sheet

Status: **PENDING — external hardware required**. Duplicate this table for every tested connection/browser. Record PASS/FAIL only after execution; unavailable hardware stays PENDING.

| Field | Scanner | Label printer | Receipt printer | Square Terminal |
|---|---|---|---|---|
| Manufacturer | | | | |
| Model / firmware | | | | |
| Connection | | | | |
| Driver / OS version | | | | |
| Browser / version | | | | |
| Media / dimensions | N/A | | | N/A |
| Test performed | | | | |
| PASS / FAIL / PENDING | PENDING | PENDING | PENDING | PENDING |
| Notes / evidence | | | | |
| Tester / date | | | | |

- Scanner: focused/unfocused scan, terminator, 100 rapid scans, repeated code, unknown code, manual typing and modal keyboard focus.
- Labels: 1, 5, 25 and 100 labels; roll and sheet where supported; actual dimensions/margins; no blank trailing labels/pages; scan every sample back to the correct item and owner.
- Receipts: cash/card/refund/reprint, 58/80 mm, long names, 25 and 500 lines; verify totals and final item. The 500-line 80 mm PDF is approximately 6.8 metres long; use Letter fallback for practical large-sale output. Check feed/cutter/driver limits explicitly.
- Terminal: pair correct merchant/location; approve/cancel/decline, disconnect network mid-payment, close/reopen browser, recover, refund and reconcile one sale/receipt/stock mutation. Physical Terminal requires separately authorized production configuration; Square hardware does not operate in Sandbox.

Attach sanitized output/photos and record printer scaling (100% / actual size). Do not record secrets or payment card data. See [external checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md).

External acceptance intake: no newly connected hardware or physical results were supplied. All device rows remain PENDING. Physical Square Terminal operation in Sandbox is NOT AVAILABLE under Square’s documented environment restrictions; this is not a failed device test.
