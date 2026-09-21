# POS support runbook

Status: **Implemented procedures; live Square and physical hardware validation pending.**

Record safe IDs before intervening: workspace, site, register, session, sale, payment attempt, provider payment, Terminal checkout and refund. Record time, browser and visible error. Never request tokens, passwords, application secrets, signature keys, authorization headers or a full provider payload.

| Symptom | Operator action | Support verification |
|---|---|---|
| Payment uncertain or payment succeeded without sale | Keep the existing attempt. Use Check Payment Status, then Retry Finalization when available. Never charge again to clear the screen. | Compare authoritative provider status with the immutable attempt, amount, currency, merchant and location; inspect finalization error and stock/delegation state. Escalate unresolved conflicts; do not force paid. |
| Inventory deducted but browser failed | Reload and recover the original checkout/receipt. | Confirm one sale, one set of inventory events and the original idempotency key. Do not restore stock merely because the UI timed out. |
| Refund pending or response lost | Reconcile the original refund. | Match refund key/provider ID and refunded quantities. Never submit a new refund key to bypass uncertainty. |
| Cash mismatch | Recount, review opening float, cash sales/refunds, paid in/out and drops. Enter an accurate count and a reason. | Compare signed cash events and close snapshot. Card payments must not affect expected cash. Never edit historical events or variance. |
| Register cannot close | Resolve active payments, then retry close. | Inspect OPEN/CLOSING state and unresolved payment attempts. Concurrent close may already have completed; recover the original result. No direct session reassignment. |
| Terminal busy/unavailable | Check Hardware, connection and assignment. Resolve the current checkout before starting another. | Check device ID, merchant/location mapping and pending checkout. A cancellation request is not cancellation confirmation. |
| Square disconnected/revoked | Use cash if otherwise authorized; owner reconnects when setup is available. | Preserve historical payments and mapping snapshots. Reconcile outstanding attempts; do not erase credentials/history to conceal unresolved work. |
| Webhook failed | Keep the existing payment and reconcile status. | Check exact notification URL, signature verification and event ID deduplication. Retry recorded events safely; never disable signature checks. |
| Scanner not scanning | Focus POS, check keyboard-wedge mode and Enter suffix, test a known label. | Compare exact code and authorized inventory; unknown or partial codes must not select another item. |
| Labels print extra pages | Match paper preset/driver size, 100% scale, headers off. Print one before a batch. | Inspect preview/page count and driver settings. Never declare a small preset reliable without physical scan-back. |
| Inventory unavailable | Refresh stock and check mapped location. | Check reservations, exact positions/batches, current quantity and owner delegation. Do not bypass canonical availability. |
| Employee denied | Owner checks active employment, permissions, membership and store-specific inventory grant. | Manager role does not override ownership. Revocation takes effect at checkout; stale cart permission is not authority. |
| Too many provider requests | Wait one minute, then check the existing payment. | Shared per-actor budgets: OAuth 12/minute, device 60/minute, payments 120/minute. Budget failure prevents outbound work. Investigate repeated polling. |

## Disable and recover

An authorized administrator may disable the tenant POS feature to stop new sales. Resolve in-flight provider attempts before disabling provider/device assignment where possible. Disable/unassign Terminal through audited controls; a busy device must be reconciled first. Preserve sales, receipts, payments, refunds, cash events, approvals and inventory events. Use forward fixes; never drop financial tables or rewrite closed sessions.

Feature disable is not a promise that every management control remains available. Test incident access before the pilot and retain a restricted, audited support path. Backups/PITR and a restore rehearsal must be confirmed before production migration; this phase did not validate a production restore.

## Escalation and future alerts

Escalate authoritative payment success with an unfinalizable sale, suspected cross-tenant access, stock below reservations, unexplained cash variance, or mismatched provider amount/merchant. Freeze affected new work and retain evidence. No force-paid or mark-refunded override is authorized.

Recommended alerts: repeated finalization failure, webhook backlog, revoked authorization, aging pending refund, inventory finalization failure and high drawer variance. Alert with safe IDs and counts only. No new alert delivery or monitoring service was enabled in Phase 7.

## Phase 7B recovery limits

A 500-distinct-line sale is supported within the 256 KiB body limit. Split larger purchases into separate sales before payment. For a large receipt, prefer Letter output; physical roll feed/cutter limits require hardware testing.

A provider throttle displays “Payment status checks are temporarily limited. Trading Docks will retry shortly.” The client retries the same persisted request once after Retry-After, up to 60 seconds. If still limited, keep the payment open and check its status later. Do not start a replacement payment. Already confirmed payments can finalize without an outbound status call.

See [external gates](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md) before real Square or physical Terminal testing. Square Sandbox supports simulated Terminal checkout IDs, not physical hardware/Devices API pairing.
