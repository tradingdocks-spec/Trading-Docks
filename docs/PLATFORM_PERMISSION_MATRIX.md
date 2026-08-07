# Platform Permission Matrix

Status: Partially Implemented

Permissions are resolved from identity, platform role, account type, membership tier, billing status, and explicit overrides. No single source other than the final server-side access resolver should be treated as complete authority.

## Platform Roles

| Role | Canonical authority | Status | Permissions |
| --- | --- | --- | --- |
| owner | `user_roles` | Partially Implemented | Adds Command Center access. Does not automatically grant paid entitlements. |
| admin | `user_roles` | Partially Implemented | Adds Command Center access. Does not automatically grant paid entitlements. |
| support | `user_roles` | Partially Implemented | Intended for limited operational support. Route coverage is incomplete. |
| analyst | `user_roles` | Partially Implemented | Intended for analytics/observability access. Route coverage is incomplete. |
| user | default role | Implemented | Normal workspace access based on account type and membership. |

## Membership Feature Matrix

| Feature group | Free | Collector | Seller | Store | Status |
| --- | --- | --- | --- | --- | --- |
| Card scanner | Yes | Yes | Yes | Yes | Partially Implemented |
| Basic collection tools | Yes | Yes | Yes | Yes | Partially Implemented |
| 500-card limit | Yes | No | No | No | Partially Implemented |
| 5-deck limit | Yes | No | No | No | Partially Implemented |
| Unlimited cards/decks | No | Yes | Yes | Yes | Partially Implemented |
| Collection value and price history | No | Yes | Yes | Yes | Partially Implemented |
| Financial insights | No | Yes | Yes | Yes | Partially Implemented |
| Storage locations | No | Yes | Yes | Yes | Partially Implemented |
| Trade Binder | No | Yes | Yes | Yes | Partially Implemented |
| Wishlist | No | Yes | Yes | Yes | Partially Implemented |
| Market signals | No | Yes | Yes | Yes | Partially Implemented |
| Deal Desk | No | No | Yes | Yes | Partially Implemented |
| Buying profiles/sessions | No | No | Yes | Yes | Partially Implemented |
| CSV/email export | No | No | Yes | Yes | Partially Implemented |
| Full web workspace access | No | No | Yes | Yes | Partially Implemented |
| Employee accounts | No | No | No | Pending configuration | Planned |
| Shared inventory/store operations | No | No | No | Yes | Partially Implemented |

## Permission Order

Status: Partially Implemented

Server-side order must remain:

1. Confirm authenticated Supabase user.
2. Resolve platform role from `user_roles`.
3. Resolve account/workspace context.
4. Resolve billing state and explicit membership override.
5. Resolve membership tier and entitlement set.
6. Apply route/API permission checks.
7. Fail closed when required authority is missing.

## P0/P1 Permission Gaps

| Gap | Severity | Notes |
| --- | --- | --- |
| Historical email-based owner helpers still exist in Supabase migrations/functions. | P1 | Active application code should not authorize admin access from email alone. |
| Direct inventory writes need database-level total quantity enforcement for Free accounts. | P0/P1 | Proposal migration exists but production application requires approval. |
| Support and analyst roles are typed but not fully mapped to route-specific capabilities. | P1 | Requires explicit product-owner permission model. |
| Unknown dashboard paths currently fail closed to a high-tier feature bucket. | P1 | Safe default, but should be replaced by complete route registry coverage. |
