# Production POS Pilot Phase C — trusted employee delegation

**Preparation blocked — nominated employee has no existing production Auth account.** No Phase C PASS/FAIL verdict is claimed. No production permissions, flags, inventory or cash records have been changed for Phase C.

## Employee identity checkpoint

Owner nominated `employee@example.com` and confirmed **$200.00** actual opening cash for Phase C. A case-insensitive, read-only production Auth lookup returned **zero matching accounts**, and consequently zero matching pilot workspace memberships or linked employee permission records. The required existing real authenticated identity could not be verified. No account, invitation, membership, permission or delegation was created; no register was opened.

Production still has **zero enabled workspaces, zero open sessions, zero Square connections and zero Square credentials**. Continue only after the owner supplies the trusted employee's real registered account email and that identity is verified. Keep the supplied opening count recorded; reconfirm if the drawer changes before opening.

Owner subsequently nominated `the-real-registered-email@example.com` and reconfirmed the $200.00 opening count. A fresh case-insensitive production Auth lookup also returned zero matching accounts, memberships or linked employee permissions for that exact address. The identity prerequisite remains unmet despite the reported account creation. No access or delegation was granted; all production workspaces remain disabled, all registers closed and Square connections/credentials absent.

## Approved scope

- Exactly one real, authenticated trusted employee, using their own login; identity remains pending. No fixtures, shared credentials or owner-session impersonation.
- Workspace `4e775109-9f6f-4264-88c8-2c3c5b944a9b`; canonical inventory owner `3ea45327-7984-4108-ada8-511748e73fd8`.
- Site `52837f8e-62a8-4145-92f8-ca6eba8dc12c`, UC Bulk Boxes storage `0abd559d-acfc-4073-aa7f-a68309fe80e0`, Front Register `adce5a44-1f5b-44b4-b91b-24519bc2699f`.
- Two low-value cash sales planned; three maximum. Ask for actual tender before each sale and actual physical cash count before close.
- Production Square disabled; no additional workspaces, broad staff rollout or hardware certification changes.

## Read-only preparation

After accepted Phase B closure, production checks confirm zero enabled workspaces, zero non-closed register sessions, zero Square connections/credentials, and zero active inventory delegations in the pilot workspace. Inventory baseline: **1,515 rows, 1,782 units, 1,559 events**. Recheck immediately before Phase C operations.

The pilot site's only inventory-location mapping is the canonical owner's UC Bulk Boxes. Repository authorization/delegation code and the live permission function were inspected. A manager role is not required or appropriate.

## Planned minimum permissions

Verify the selected account's real Auth identity, existing workspace membership, employee status and existing permissions before granting anything. Record the baseline so temporary pilot rights can be removed without accidentally retaining expanded access.

- Employee membership and active linked employee record, subject to inspection of existing state.
- `pos.sell=true` for POS access/checkout; owner-granted site-scoped delegation with capability **sell only**.
- Keep `pos.refund`, `pos.discount`, `pos.override` and `pos.cash` false. In the current implementation `pos.cash` controls cash movements (including paid-in/out), not ordinary cash tender checkout. Granting it would exceed this pilot's scope.
- No manager/admin role, payment-provider, credentials, hardware or workspace management rights.
- Owner handles register setup and final close; actual sale actor must be the independently signed-in employee.

## Acceptance gates — pending

1. Verify employee identity/membership/permissions and owner account access; record exact grant, grantor, timestamp and site scope.
2. Verify delegated inventory read, outside-scope denial, cross-tenant denial, inability to self-grant scope/change ownership/manage providers or hardware. Use non-destructive checks; preserve owner access/revocation ability.
3. Obtain actual opening cash; open Front Register. Verify employee session/operator and workspace/site/register in the browser before checkout.
4. Reconfirm exact low-value priced stock, ownership, quantity, location and zero marketplace reservations. Obtain actual tender for each approved sale. Verify unique sale/receipt/tender/event, original inventory owner and employee actor; maximum three sales.
5. Verify one restricted action is denied without executing an inventory/cash mutation. Optional secure owner approval flow remains NOT TESTED unless exercised with distinct requestor/approver identities.
6. Mandatory revocation while employee stays signed in: owner revokes delegation; employee attempts to begin another sale and is denied. No denied transaction is completed. Historical employee attribution must remain intact.
7. Ask for physical closing count, close normally, reconcile sales/tax/tenders/stock/cash/variance, and inspect grant/revocation audit records and production logs. Distinguish deliberate denials from defects.
8. Smoke-test Dashboard, Inventory, Collection, Chaos Sort, Label Studio and Orders Center.
9. Revoke temporary Phase C delegation and remove temporary pilot permissions, disable the pilot, verify all production workspaces disabled and Square disabled. Return to owner approval.

Employee identity, opening/closing cash, transactions, attribution, denied-action/revocation results, audit trail, reconciliation, logs and smoke results remain pending. Do not infer a physical cash count from Phase B.
