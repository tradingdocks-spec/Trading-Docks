# Selling Marketplace Platform Audit

## CURRENT SYSTEM

Trading Docks already has `inventory_items` as the physical inventory authority, `inventory_events` as the immutable quantity history, Chaos Sort sessions/batches/positions for physical provenance, and inventory locations. Existing marketplace foundations include `marketplace_connections`, encrypted server-only OAuth credentials, listing mappings, sync runs/changes, marketplace orders/order items, fulfillment stages, eBay read-only access, Mana Pool connectors, and TCGplayer email imports. Dashboard navigation already has a seller area, but it is split across legacy selling, marketplaces, and orders routes.

## REUSABLE COMPONENTS

- Authenticated dashboard layout and user-scoped Supabase client.
- Inventory search/provenance helpers and card workspace presentation.
- Chaos Sort batch/position relationships and inventory event ledger.
- Marketplace connection, credential encryption, sync, order, and fulfillment infrastructure.
- Existing eBay server access and marketplace-specific import code.
- Existing seller navigation and dark/navy Trading Docks design system.

## GAPS

There is no normalized listing-batch/candidate layer that points to physical inventory without duplicating it, no shared marketplace capability contract, no normalized readiness engine, and no selling workstation route that brings those concepts together. Quantity allocation, publishing idempotency, and cross-market reconciliation should build on the existing event/order model rather than replace it.

## PROPOSED DATA MODEL

Phase A adds `selling_listing_batches`, `selling_listing_candidates`, `selling_inventory_allocations`, `selling_marketplace_listings`, and `selling_sync_events`. Every row is user-scoped with RLS. Candidates retain inventory item, optional Chaos Sort position/batch, location, and cost basis references. Allocations are the shared quantity reservation boundary; marketplace listings are representations, never inventory records. Existing marketplace connections and orders remain reusable.

## PROPOSED ROUTES

- `/dashboard/selling`
- `/dashboard/selling/listings`
- `/dashboard/selling/listings/[batchId]`
- `/dashboard/selling/orders`
- `/dashboard/selling/pick-pack`
- `/dashboard/selling/connections`
- `/dashboard/selling/pricing`

Phase B establishes the first two routes and leaves the remaining routes for subsequent vertical slices.

## MIGRATIONS REQUIRED

One additive local migration is created: `20260918173226_selling_marketplace_platform_foundation.sql`. It has not been applied remotely and does not modify existing tables. No production deployment or marketplace publish call is part of this phase.

## IMPLEMENTATION PHASES

1. Schema foundation and adapter contracts.
2. Selling overview, listing workstation, readiness, and candidate creation from existing inventory.
3. Side editor, bulk pricing, duplicate detection, and Chaos Sort/Inventory handoffs.
4. Marketplace OAuth/account health and draft preparation.
5. Deliberate publishing, idempotent quantity/price sync, order ingestion, reservation, and Pick & Pack.
6. Fulfillment events, realized profit, webhooks, reconciliation, and analytics.

## RISKS

External marketplace APIs have different identities, policies, rate limits, and order semantics. Live publishing must remain behind explicit confirmation and idempotency keys. Physical quantity must only change through the existing inventory event authority and future transactional allocation functions. Remote migrations and production marketplace credentials are intentionally out of scope for this branch.
