# Plan, Role, and Entitlement Matrix

Commercial membership and platform authority are separate dimensions. A trusted platform owner/admin may keep a Free billing membership while receiving full platform capabilities. Authorization is role- and scope-based; no user email is an authorization rule.

## Commercial plans

| Capability or limit | Free | Collector | Seller | Store |
| --- | --- | --- | --- | --- |
| Monthly / annual price | $0 / $0 | $4.99 / $49.99 | $14.99 / $149.99 | $49.99 / $499.99 |
| Total owned cards | 500 maximum for growth | Unlimited | Unlimited | Unlimited |
| Decks | 5 | Unlimited | Unlimited | Unlimited |
| Dashboard, inventory, Deck Vault, settings, support | Yes | Yes | Yes | Yes |
| Card scanner and basic collection tools | Yes | Yes | Yes | Yes |
| Analytics, CSV tools, collection value, price history, financial insights | No | Yes | Yes | Yes |
| Storage locations, trade binder, wishlist, market signals | No | Yes | Yes | Yes |
| Purchasing, CRM, selling, marketplaces, orders, card shows, automation | No | No | Yes | Yes |
| Deal Desk, buying profiles/sessions, trade calculator, sealed evaluator | No | No | Yes | Yes |
| CSV/email export and web workspace | No | No | Yes | Yes |
| Business intelligence and operations | No | No | No | Yes |
| Employee accounts and shared workflows | No | No | No | Yes; employee count remains pending configuration |

The Free card limit is a growth limit. An existing collection above the limit can be edited, have quantity reduced, or have cards removed. A quantity increase is rejected only when the resulting total exceeds 500. Unchanged quantity and metadata-only edits never re-apply the cap.

## Platform and workspace roles

| Role | Scope | Commercial membership | Platform capabilities |
| --- | --- | --- | --- |
| Platform owner/admin | Whole platform, trusted `user_roles` authority | Remains truthful to billing/override | Full platform entitlements, including admin command center; bypasses commercial card-growth cap |
| Platform support/analyst | Whole platform, trusted authority | Remains truthful to billing/override | Platform support/analyst capabilities; not automatically full owner/admin product access |
| Workspace owner/admin | One workspace | Uses resolved commercial tier | Workspace administration subject to plan and workspace-role requirements |
| Workspace manager/member/viewer | One workspace | Uses resolved commercial tier | Only capabilities allowed by both plan and workspace role |
| Authenticated member with no workspace | Personal collection scope | Uses resolved commercial tier | Personal capabilities only; no cross-workspace access |

## Resolution and enforcement

- Source of truth: `mobile/services/membership-catalog.ts` (`MEMBERSHIP_PLANS`, limits, and entitlement keys), consumed by web adapters.
- Server authority: `src/lib/platform/server-access.ts` resolves role, workspace, billing-provider state, manual override, suspension, and effective membership. `mobile/services/platform-access.ts` evaluates capabilities.
- Billing: active/trialing and still-current past-due subscriptions can retain paid access; canceled, expired, incomplete, unpaid, paused, suspended, or unresolved billing falls back according to the shared resolver. Platform authority is not inferred from billing.
- API/routes: use server capability/route guards and user/workspace predicates. APIs must not trust a client-supplied plan or user id.
- Collection growth: the API/client validator uses the canonical plan limit and growth-only semantics. The Supabase inventory trigger and ledger RPC remain authoritative for direct writes and replay; the forward-only entitlement migration adds the same semantics and trusted owner/admin bypass.
- RLS: exposed records remain scoped to the authenticated user or resolved workspace. Service-role operations are explicit and do not grant browser users cross-workspace access.
- UI: plan labels and upgrade prompts describe commercial membership. Platform admin access is shown separately and must not pretend that the admin purchased a paid plan.

Numeric values and feature names in this document must be changed together with the membership catalog and its tests. Supabase migrations are committed for deployment review; this audit does not apply them remotely.
