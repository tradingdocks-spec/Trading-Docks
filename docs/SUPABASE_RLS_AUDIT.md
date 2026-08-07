# Supabase RLS Audit

Status: Partially Implemented

This audit summarizes current Supabase ownership and authorization controls from repository migrations. It is not a production database introspection report.

## Active Tables And Policies

| Area | Tables | Status | Current RLS posture |
| --- | --- | --- | --- |
| Identity/profile | `profiles`, `user_preferences` | Partially Implemented | User-owned reads/writes are scoped to `auth.uid()` in foundation migrations. |
| Workspaces | `workspaces`, `workspace_members` | Partially Implemented | Workspace membership exists, but app-wide workspace authority is not fully unified. |
| Inventory | `inventory_items`, `inventory_locations`, `inventory_movements` | Partially Implemented | User-owned RLS exists for direct table reads/writes. |
| Billing | `billing_subscriptions` | Partially Implemented | Authenticated users can read their own state; client writes are revoked. |
| Provider billing | `billing_provider_subscriptions`, `billing_provider_events` | Partially Implemented | Server-only writes; users can read own provider subscription rows where policies allow. |
| Admin overrides | `admin_membership_overrides`, admin tables | Partially Implemented | Historical owner helpers include email-based assumptions. |

## P0 Findings

| Finding | Status | Why it matters |
| --- | --- | --- |
| Free 500-card limit is not guaranteed at the database layer unless the proposal migration is applied. | Requires Production Configuration | Client enforcement and UI checks are insufficient for direct mobile writes or offline replay. |
| Direct inventory mutations rely on RLS ownership but need transactional total-quantity enforcement. | Partially Implemented | Race conditions can occur without database-level locks/checks. |

## P1 Findings

| Finding | Status | Why it matters |
| --- | --- | --- |
| Historical migrations define email-based owner helper behavior. | Legacy still referenced risk | Platform owner/admin authority should come from `user_roles`. |
| `business` remains in historical billing constraints and override records. | Compatibility risk | Runtime normalizes to `store`, but schema cleanup needs a reviewed migration. |
| Workspace-owned inventory semantics are not fully authoritative. | Partially Implemented | Store/team inventory requires clear user-versus-workspace ownership rules. |
| Repeated repair/proposal migrations make current production state hard to infer from files alone. | Documentation gap | Production should be verified through Supabase introspection before schema changes. |

## Recommended RLS Direction

Status: Planned

1. Apply a reviewed forward-only migration for Collector mutation ownership and Free total quantity limits.
2. Replace email-based owner helpers with role-table helpers.
3. Formalize workspace-owned inventory policies.
4. Add SQL verification scripts for user-owned, workspace-owned, admin, and service-role paths.
5. Keep service-role writes server-only.
