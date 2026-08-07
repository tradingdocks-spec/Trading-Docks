# Headquarters Product

Status: Partially Implemented

Headquarters is the protected operational/admin product area for platform owners and authorized staff. It is additive to a user's normal workspace.

## Product Rule

Status: Implemented

Owner/admin users keep their normal Collector, Seller, or Store workspace and gain a protected Command Center entry. Admin access must not replace the primary user workspace unless the user explicitly enters Headquarters.

## Intended Modules

| Module | Status | Current route state |
| --- | --- | --- |
| Command Center | Partially Implemented | `/dashboard/admin` |
| Users | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |
| Subscriptions | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |
| Sessions | Planned | Listed in nav contract. |
| System Health | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |
| Audit Log | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |
| Plans | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |
| Feature Flags | Partially Implemented | Listed in nav contract, currently collapsed to admin surface. |

## Authority

Status: Partially Implemented

- Platform role authority should come from `user_roles`.
- Historical email-based owner helpers are legacy database debt and should not be used for active authorization.
- Support and analyst role scopes are not fully specified yet.
- Admin role does not imply paid Seller or Store entitlements.

## Security Requirements

Status: Planned

1. Every Headquarters route must resolve server-side role authority.
2. Every privileged API route must enforce role checks on the server.
3. UI links are convenience only and must not be treated as authorization.
4. Manual membership overrides need future audit logging.
5. Headquarters activity should have a dedicated audit model before operational rollout.
