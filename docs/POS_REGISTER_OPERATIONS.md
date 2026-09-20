# POS register operations

Status: Planned. Pre-schema audit completed on 2026-09-20; Phase 3 implementation is stopped at the ownership architecture review boundary. This document does not describe shipped register operations.

Branch: `codex/pos-foundation`. Audited implementation: `fbf898190e895e923f6720157aa433d6c5c973c4`.

## Required decision

Authorize a narrowly scoped, owner-granted employee delegation extension to the canonical inventory authorization model before implementing shared staffed registers. This is a change to the accepted owner-only model, not a routine register UI decision. The Phase 3 instruction explicitly requires stopping for a major architectural departure or an authorization/ledger bypass. Phase 1 validation already identifies shared employee operation as requiring a separately reviewed ownership extension.

The requested workflow cannot currently complete under a second employee's own authentication. Promoting that employee to workspace manager does not resolve it. Merely separating session opener from sale actor, or adding cash-management tables, would leave the central multi-employee checkout requirement unsatisfied.

No schema, RLS, grants, application runtime, credentials, deployment configuration, or applied migrations were changed during this audit.

## Existing implementation audit

| Area | Implemented behavior and source |
| --- | --- |
| Registers | `20260920181448_pos_cash_foundation.sql`: `pos_registers` has UUID `id`, `workspace_id`, `site_id`, `name`, composite site FK and composite unique key. It has no active flag, description, timestamps, drawer controls or hardware preference fields. Register identity is not tied to a browser. |
| Sites and stock | `pos_store_locations` binds one `inventory_user_id`; mapped `inventory_locations` retain owner/text-ID identity. Site currency is USD and tax is basis points. No site timezone or business-day cutoff is implemented. |
| Sessions | `pos_register_sessions` records workspace/site/register, authenticated `actor_id`, opened/closed timestamps. Partial unique index permits one row with null `closed_at` per register. There is no explicit OPEN/CLOSING/CLOSED state or reconciliation record. Current command locks register/session rows and requires the same actor. |
| Sale attribution | Immutable `pos_sales` stores authenticated actor, site, register, session, request/idempotency key, minor-unit totals and receipt snapshot. Sale items/allocations retain inventory owner/item/position/batch/location. Actor currently equals inventory owner. |
| Employee attribution | POS uses `auth.uid()`, not an employee dropdown. Employee `full_name` and `linked_user_id` exist but sale receipts currently carry actor ID rather than an employee display-name snapshot. Session operator cannot change independently of opener. |
| Workspace roles | Existing workspace is the organization. Membership roles include owner/admin/manager/member/viewer, plus employee added by `202609080001_employee_account_invitations.sql`. Platform owner/admin roles are distinct from workspace roles. |
| Employee records | `202607280005_account_data_foundation.sql` defines name, linked auth user, contact/job fields, employment status, permissions JSON, compensation JSON, data and creator/timestamps. Managers manage these records; employee migration adds self-read and invitation/account status. Existence of permissions JSON does not constitute an enforced inventory delegation mechanism. |
| Invitations/team UI | `/api/workspace/employees/invite` verifies current user and active-workspace manager role, creates an employee record, invites through Supabase Auth, links the returned user, creates membership role `employee`, and sets active workspace. Existing employee UI displays names and account/invitation status. This is a real-account invitation system, not POS PIN authentication. |
| Capability framework | `src/lib/platform/server-access.ts` resolves authenticated identity, billing and workspace from trusted rows. Shared `mobile/services/platform-access.ts` defines `pos.sell` at Seller/member minimum. Its WorkspaceRole type and normalizer omit `employee`; therefore the invitation role is not recognized by this shared capability path. Shared changes would require active mobile checks. |
| POS authorization | `pos_private.authorize` independently checks authenticated workspace membership (owner/admin/manager/member), actual suspension, individual Seller/Store entitlement, linked employment status and rollout flag. It excludes `employee`. Management commands require owner/admin/manager. No inherited store employee entitlement contract is implemented here. |
| Canonical mutation authority | Latest definition in `20260917014520_entitlement_production_repair.sql` requires acting user to equal `inventory_items.user_id` for inserts, updates and deletes. `collector_inventory_acting_user()` prefers `auth.uid()` over the service fallback setting. Workspace manager status does not bypass this check; platform commercial-limit exemptions occur only after ownership validation. |
| Service mutation helper | `202608100002_security_authority.sql` grants `collector_service_mutate_inventory_item` only to service role, not authenticated users. Its fallback target-owner setting does not override a non-null authenticated actor. This background-service path is not an existing employee authorization contract and must not be used to impersonate an owner. |
| Effective POS command | Phase 2 migration `20260920190428_pos_barcode_labels.sql` replaces `pos_private.command`. Bootstrap, open, search, checkout, history and receipt paths remain actor/owner scoped. Barcode resolution independently requires an actor-owned site and owner-bound identities. Updating only the outer POS route would not fix these inner boundaries. |
| Cash | `pos_tenders` records cash applied, cash received and change. There is no opening float, drawer ledger, paid-in/out/drop/adjustment, counted close, expected cash or variance policy. Applied amount already excludes change. |
| Pricing | Database computes current asking price, manager-authorized line percentage discount with reason, per-line rounded exclusive tax and integer totals. No cart/fixed discounts, distinct price override or separate manager approver exists. |
| Receipt/history | Immutable receipt JSON lives on the sale. `src/lib/pos/receipt.ts` renders an isolated 80mm by 200mm document. History is actor-scoped and cursor-paginated; Phase 3 filters/settings/activity/refund display are not implemented. |
| Refunds | No current POS refund command or refund ledger exists. Generic marketplace/order refund concepts do not supply a canonical POS cash-and-stock return transaction. Phase 3 must introduce this foundation rather than assume one exists. |
| Audit/events | Completed sales, items, allocations, tenders and cancellation tombstones are immutable; POS inventory events are protected and carry sale/register/site/actor/allocation provenance. Both legacy enum and text inventory ledgers are supported. No reusable POS manager approval or drawer audit ledger exists. |
| Shared devices | Existing SSR/browser clients authenticate one Supabase user session. No employee PIN hash, POS operator PIN verifier, independently authenticated manager override, or secure fast-switch contract was found in the inspected source/migrations. Changing a displayed operator is not authentication. Full sign-out/sign-in or independently authenticated manager requests would be needed. |

## Reproduced boundary

`tests/pos-staffing-boundary.mjs`, invoked by `tests/pos-db.mjs`, adds three checks against real applied inventory/POS migrations in loopback-only disposable PostgreSQL:

1. A same-workspace user with invitation role `employee` receives `POS_FORBIDDEN` on bootstrap.
2. Promoting that user to manager permits bootstrap but reveals no other owner's sites/registers; opening the owner's register and checking out the owner's inventory still return `POS_FORBIDDEN`.
3. A privileged local SQL connection retaining the manager's `auth.uid()` attempts an owner-stock decrement. Even with table RLS bypass and the service fallback owner setting, the canonical trigger returns `TD_COLLECTOR_UNAUTHORIZED`. Rollback preserves quantity and creates no sale.

The third check isolates the canonical trigger from RLS; it is not an application bypass implementation. Test identities/memberships exist only in the disposable fixture. Auth and workspace prerequisites are simulated, so these are not hosted Supabase login tests.

## Proposed ownership extension for approval

Status: Planned, not implemented or approved.

Preserve `(inventory_user_id, inventory_item_id)` and every position/location/batch identity. Introduce explicit, revocable authorization from the stock owner to an existing authenticated employee, scoped to workspace and physical site. Workspace membership alone must not authorize mutations of another member's collection.

The proposed contract is:

1. Only the authenticated inventory owner can grant/revoke use of that owner's stock at a specified workspace/site. Record grantor, grantee, scope, permitted actions, creation/revocation time and immutable audit events. Direct employee edits to grants are denied.
2. Reuse linked employee accounts and memberships. Validate employment/account status, suspension, membership, grant and store entitlement on every command. Explicitly add employee POS capabilities without expanding unrelated collection, marketplace, label-management or reporting access.
3. Extend the canonical inventory authorization path through a new forward migration to recognize only narrowly authorized POS sale/return commands. Direct table writes and unrelated commands remain owner-only. The command must bind actual actor, owner, site, item/position, exact operation and transaction; client-controlled flags, caller-set PostgreSQL settings, and substituted JWTs cannot serve as proof of delegation.
4. Keep the authenticated employee as sale/refund/drawer actor and keep stock owner separate. Manager approval records an independently authenticated approver; approval never replaces the requester or grants blanket inventory access.
5. Serialize grant revocation and relevant stock commands so a command cannot authorize against a stale grant and mutate after effective revocation. Continue the existing collector/parent/position/reservation lock protocol and atomic immutable movement recording. Review lock ordering before implementation.
6. Extend barcode/site reads only to delegated sellable stock. Label management and cost-basis access do not follow automatically. Reprints and reports need explicit scope rules to avoid exposing another operator's or owner's private data.
7. Verify direct-write denial, unaffiliated member/manager denial, wrong-workspace/site/item/position denial, revoked/inactive/suspended denial, forged actor/owner/context denial, and grant-revocation races. Preserve all current owner-only and reservation regressions.

This proposal changes canonical authorization deliberately rather than weakening it accidentally inside POS. Approval would authorize design and implementation of that extension in forward migrations and disposable tests; production rollout would remain separately prohibited. Exact private command-context mechanics require security review and tests during implementation.

The alternative is an explicitly reduced owner-operated Phase 3: drawer controls and reporting for the inventory owner, with shared employee checkout deferred. That would not satisfy the requested multi-staff definition of done and must not be silently substituted.

## Subsequent register operations plan

After the ownership decision, implement explicit OPEN → CLOSING → CLOSED sessions, immutable idempotent drawer events, independently attributed operator actions, restricted paid-in/out/drop/adjustments, intent-bound manager approvals, integer pricing/refund allocation, and reconciliation under session locks. Closed sessions never reopen; a new shift creates a new session.

Expected cash is opening float + applied cash sales - cash refunds + paid-in - paid-out - cash drops + signed adjustments. `20000 + 42578 - 2500 + 5000 - 1500 - 30000 = 33578` minor units. Variance is counted minus expected. Close note/approval thresholds belong to settings; store timezone determines daily reporting boundaries.

Refunds must reference original sale quantities and immutable prices, carry the current processing session, prevent cumulative over-refund, and explicitly choose return-to-inventory or no return. Changed physical condition cannot silently restore the original condition. Manager approval, cash event, restored canonical stock/provenance and refund commit atomically where applicable.

Receipts retain immutable snapshots and gain isolated thermal/Letter output and settings. Reports require scoped permissions, site-local dates and a shared authoritative query layer. These remain Planned, along with all Phase 3 browser, printing, concurrency and hosted-auth acceptance checks.
