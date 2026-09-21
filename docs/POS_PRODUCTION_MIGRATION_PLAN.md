# POS production migration and disable plan

Status: **Planned — execution not approved.** Production has not been mutated or deployed by Phase 7.

## Exact order

Use `pos-phase7-migration-manifest.json` for filenames, SHA-256 hashes and hosted rehearsal mapping:

1. `20260920181448_pos_cash_foundation.sql`
2. `20260920190428_pos_barcode_labels.sql`
3. `20260920201259_pos_staff_delegation.sql`
4. `20260920201754_pos_register_operations.sql`
5. `20260920211929_pos_payment_framework.sql`
6. `20260920220340_pos_square_sandbox.sql`
7. `20260920235705_pos_square_terminal.sql`
8. `20260921004339_pos_provider_request_budget.sql`
9. `20260921010637_pos_employee_permission_precedence.sql`
10. `20260921014756_pos_search_authority_scope.sql`
11. `20260921020747_pos_cart_scale_500.sql`

Do not edit applied files or reapply these non-idempotent CREATE migrations. Hosted MCP assigned rehearsal timestamps; reconcile migration history by verified name/hash before any CLI push. Never treat differing timestamps alone as evidence that a migration is missing. No history repair or production push has been performed.

## Preflight

- Obtain separate production migration approval and a reviewed change window. Keep production application deployment and provider authorization separate.
- Verify the exact project ref, branch, working tree, migration hashes and existing migration history. Refuse staging credentials against production and vice versa.
- Verify current production prerequisites: workspaces, workspace_members, workspace_employees, profiles, user_preferences, membership helpers, canonical inventory/items/locations/events, Label Studio identities/templates/jobs, Chaos batches/positions, marketplace candidates/allocations and their canonical mutation/RLS functions.
- Do not apply the simplified local `tests/fixtures/pos-prerequisites.sql` to hosted projects. It deliberately omits production constraints.
- Confirm inventory_events event_type/source variant. Both text and enum variants passed disposable PostgreSQL regression; staging uses the enum variant.
- Rehearsal found production-only optional inventory columns game_id, product_type, tcgplayer_product_id and tcgplayer_sku_id; staging has bulk_purchase_id. No shared-column type differences were found in the seven audited prerequisite tables. This limited comparison is not a complete production schema attestation. Recheck triggers, function signatures, policies, constraints and extensions at the approval window.
- Verify membership alias `business` maps to `store`; hosted staff uses workspace role `member` plus employee records. Do not broaden role or membership constraints to match simplified fixtures.
- Obtain a restorable backup/PITR point and rehearse recovery independently. No production backup/restore has been tested in this phase. Estimate locks/index build duration using production-scale clone statistics before execution.

## Apply and verify after approval

Apply the eleven files in order, one recorded migration transaction at a time. Stop on error; capture sanitized SQLSTATE/error and add a reviewed forward correction. Do not manually patch schema. Verify every expected public/private function signature, revoked browser grants, RLS on all POS tables, indexes and immutable financial triggers. Compare with the table/function audit artifacts. The employee permission correction is mandatory: a linked member-role employee must not inherit the ordinary member sell default when explicit POS permission is denied.

Verify POS disabled by default and ordinary tenants receive no opt-in rows. Run smoke tests using an explicitly approved pilot tenant only. Confirm cash lifecycle, owner/delegation boundaries, anonymous/cross-tenant denial, last-item and marketplace races, receipt recovery and provider budgets. Deploy code only after the new budget RPC exists; absent RPC fails provider requests closed.

## Disable plan

Disable the affected tenant's POS feature; block new provider starts and unassign/disable Terminal through audited operations after resolving pending work. Preserve historical sales, payments, refunds, receipts, stock events, cash sessions, approvals, provider IDs and immutable mapping snapshots. Keep read/recovery access for authorized support. Never drop financial tables, delete a sale to resolve stock, or replay a charge with a new key. Repair with forward migrations. Restore a backup only under a separately reviewed disaster-recovery process that accounts for provider transactions after the restore point.

## Future production Square plan

The current implementation is Sandbox-only and intentionally blocks Square starts in a production-mode build. A production provider rollout requires a separate reviewed change; configuration alone cannot enable it. Use separate applications, merchants, tokens, encryption/signature keys and webhook event storage per environment.

Proposed production callback is `https://www.tradingdocks.com/api/pos/payments/square/callback` and webhook is `https://www.tradingdocks.com/api/payments/webhooks/square`; verify both exact deployed canonical HTTPS URLs before registering them in Square. Never guess a signature notification URL or reuse the Sandbox signature key. Required permissions are PAYMENTS_WRITE, PAYMENTS_READ, MERCHANT_PROFILE_READ, plus DEVICE_CREDENTIAL_MANAGEMENT for Terminal. Confirm current Square requirements at the production approval window.

Owner onboarding: authorize the correct merchant, verify merchant identity, fetch/map the correct location, explicitly enable Terminal scope when needed, pair/assign the approved hardware, and complete the separately authorized payment/refund/recovery acceptance. No production Square connection or real-money transaction is authorized by this plan.
