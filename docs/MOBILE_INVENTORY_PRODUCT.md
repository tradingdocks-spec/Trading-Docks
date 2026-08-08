# Mobile Inventory Product

Status: Partially Implemented

## Mobile V1 Purpose

Trading Docks Mobile V1 is the field inventory companion:

- Implemented: Scan, search, review, and manage user-owned collection records.
- Implemented: Find saved cards by name, set, collector number, condition, finish, and matching storage location names.
- Partially Implemented: Storage assignment, movement, Trade Binder, Wishlist, and scanner finalization use shared collection contracts, but broad physical-device QA is still required.
- Planned: Deep seller, store, employee, buying, and operations workflows remain Headquarters-first.

## Primary Navigation

Status: Implemented

Mobile uses exactly five primary tabs for every account composition:

1. Home
2. Collection
3. Scan
4. Intelligence
5. Account

Deal Desk is no longer a bottom-tab destination. It remains available only as a contextual secondary route for existing scanner/session review paths.

## Inventory Search

Status: Partially Implemented

Current Collection search includes:

- Implemented: Card name.
- Implemented: Set code.
- Implemented: Collector number.
- Implemented: Storage location name matches through user-scoped `inventory_locations`.
- Implemented: Condition and finish filters through the existing collection filter contract.
- Partially Implemented: Binder-aware search depends on the existing Trade Binder and physical binder contracts; full binder slot search is still future UI work.

Missing prices and images remain unavailable rather than invented.

## Storage Hierarchy

Status: Partially Implemented

The product language supports a flexible real-world path:

`Area > Shelf > Container > Section > Slot`

Existing simple storage locations remain compatible. Rich hierarchy, favorite/recent persistence, and database-enforced parent/child constraints remain migration-planned work unless already present in the active schema.

## Mobile Versus Headquarters

- Mobile owns fast intake, card lookup, storage awareness, location movement, scanner review, and physical binder viewing/building.
- Headquarters owns deep seller/store operations, admin control, billing administration, bulk operational reporting, and high-density workflows.
- Mobile must not create a separate inventory, binder, or membership authority.

## Remaining Work

- Planned: Make Card Detail the primary control center for Move, Edit, Binder, Trade, and Remove.
- Planned: Add first-class scan destination selection such as Collection, Binder, Storage Location, or Trade Binder.
- Planned: Add physical-device performance measurements for Home, Collection search, card images, scanner, OCR, Scryfall lookup, and binder pages.
