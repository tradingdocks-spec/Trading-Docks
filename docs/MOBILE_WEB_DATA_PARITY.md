# Mobile Web Data Parity

Status: Partially Implemented.

Trading Docks mobile is not a separate product database. Permanent account data should resolve from the same Supabase auth user and shared backend tables used by TradingDocks.com. Mobile may keep caches, scanner work-in-progress, offline queues, preferences, camera settings, and diagnostics locally, but those are not canonical records.

## Source Matrix

| Feature | Web Source | Mobile Source | Canonical Source | Sync Status |
| --- | --- | --- | --- | --- |
| Authentication identity | Supabase SSR clients using `NEXT_PUBLIC_SUPABASE_URL` and publishable key | Expo Supabase client using `EXPO_PUBLIC_SUPABASE_URL` and anon key | Supabase Auth user UUID | Implemented |
| Profile | `profiles`, `user_preferences`, identity access helpers | Auth/account providers, profile routes | `profiles` keyed by auth user | Partially Implemented |
| Workspace | `workspace_members`, `user_preferences.active_workspace_id`, active workspace helpers | Mobile primarily uses user-scoped data and local account type | `workspace_members` plus active workspace preference | Partially Implemented |
| Membership / plan | `billing_subscriptions`, membership catalog, tier access | Shared mobile membership catalog and local account provider | Billing tables plus canonical entitlement catalog | Partially Implemented |
| Collection / inventory | `inventory_items`, `inventory_locations` | `mobile/services/collector-data.ts` reads the same tables by `user_id` | `inventory_items` and `inventory_locations` | Implemented for user-owned collection |
| Scanner sessions | Web purchase scanner surfaces are route-local/product-specific | `continuousScannerSessionKey(userId)` in mobile app storage | Local scanner intake until finalization | Partially Implemented |
| Scanner finalization | Web inventory writes use Supabase inventory tables | Review List now calls `saveScannerConfirmation` for collection destinations | `inventory_items` with user ownership | Partially Implemented |
| Trade Binder | `binder_card_trade_status` through web client data helpers | `binder_card_trade_status` through mobile data helpers | `binder_card_trade_status` | Implemented |
| Wishlist | `collector_wishlist` through web client data helpers | `collector_wishlist` through mobile data helpers | `collector_wishlist` | Implemented |
| Storage locations | `inventory_locations` and `inventory_items.location_id` | Mobile storage and collection services use the same fields | `inventory_locations` | Implemented for flat/user-owned storage |
| Deck Vault | `deck_vault_decks` plus local recovery cache | No full active mobile Deck Vault workspace yet | `deck_vault_decks` | Planned for mobile |
| Purchasing / offers | Web purchasing and order tables/routes | Mobile scanner session offer math and Deal Desk session data | Mixed: shared inventory plus route-specific purchasing tables | Partially Implemented |
| Seller/store data | Web marketplace/order/workspace tables | Mobile surfaces mostly show honest unavailable or scanner/session state | Shared backend tables where implemented | Partially Implemented |

## Auth Parity

- Implemented: Mobile and web both use Supabase public client keys and the Supabase auth user UUID as identity.
- Implemented: The mobile client rejects `sb_secret` style keys in browser/native client construction.
- Partially Implemented: Mobile account type remains provider/local-state driven in several screens and should be reconciled against the same profile, membership, and billing records as web.
- Requires Production Configuration: Supabase project settings, OAuth callbacks, RLS verification, and production auth policies must be validated outside source inspection.

## Workspace Model

- Implemented on web: Active workspace resolution exists through `workspace_members` and `user_preferences`.
- Partially Implemented on mobile: Collection, scanner, Trade Binder, Wishlist, and storage use `user_id` ownership. Store/workspace shared inventory is not yet a complete mobile authority model.
- Planned: Mobile should resolve active workspace membership before store/team workflows rely on shared workspace-owned records.

## Collection And Inventory Ownership

- Implemented: Mobile Collection reads `inventory_items` with `eq('user_id', user.id)`, joins related `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist`, and caches the result as stale/offline fallback only.
- Implemented: Scanner finalization now writes collection-destination reviewed lines through `saveScannerConfirmation`, which inserts canonical `inventory_items` records or queues the same payload when offline.
- Partially Implemented: Direct mobile writes still rely on current RLS and the Collector mutation security proposal for database-enforced Free-plan total-quantity limits.
- Planned: Workspace-owned inventory should be added only after the active schema and RLS model are approved.

## Scanner Finalization

Scanner intake remains local-first:

1. Camera or manual search creates a user-scoped scanner session in local storage.
2. Review List resolves quantity, condition, finish, language, storage, trade status, and review state.
3. Finalize confirms unresolved lines.
4. Collection-destination lines persist to `inventory_items` through the existing scanner confirmation contract.
5. Offline or failed writes become pending/failed sync states instead of silently becoming permanent local records.

## Offline Behavior

- Allowed local data: scanner work-in-progress, offline queue entries, collection cache, recent lookup cache, preferences, camera settings, and diagnostics.
- Not canonical locally: permanent collection, inventory, membership, balances, business records, and authoritative card ownership.
- Implemented: Mobile scanner add queues are user-scoped and deduplicated by scanner idempotency rules.
- Implemented: Shared mobile sync labels are `Synced`, `Syncing`, `Offline`, `Pending`, and `Failed`.
- Partially Implemented: Mobile native network reachability remains limited; some retries are driven by app resume, session restoration, and manual recovery.

## RLS

- Implemented in migrations: `inventory_items`, `inventory_locations`, `collector_wishlist`, and `binder_card_trade_status` have user-owner RLS policies.
- Partially Implemented: The proposed Collector mutation security migration would strengthen direct mobile writes and Free-plan limits, but it has not been applied.
- Requirement: Mobile UI filters must never be treated as the authority for user isolation.

## Remaining Parity Gaps

- Mobile account/workspace resolution is not yet fully server-authoritative.
- Store/team workspace-owned inventory is not fully modeled on mobile.
- Scanner finalization now uses the canonical collection write path, but duplicate-success interruption should still be validated against staging RLS and database constraints.
- Deck Vault is web-backed and does not yet have a full mobile workspace.
- Seller/store operational data remains web-first except where mobile scanner/session workflows explicitly support it.
