# Trading Docks Signature Experience

Status: Implemented foundation, Partially Implemented across active mobile surfaces.

## Purpose

Trading Docks should feel like a physical collection operating system, not only a dark SaaS interface. The signature language prioritizes collectible objects, spatial inventory, restrained motion, and tactile controls while preserving the frozen product architecture.

## Semantic Color Roles

- Cyan: Implemented for active navigation and scanner state.
- Electric blue: Implemented for primary actions.
- Emerald: Implemented for synced, complete, and success states.
- Amber: Implemented for attention, missing data, stale cache, and location emphasis.
- Indigo/violet: Implemented for Deck Vault and special collectible objects.
- Navy: Implemented for app structure and surface depth.
- Off-white: Implemented for primary content.
- Muted steel: Implemented for secondary metadata.

## Material Hierarchy

- Canvas: background field.
- Structural Dock: navigation and persistent workspace rails.
- Inset Bay: recessed software controls and meters.
- Raised Control: tactile buttons and selected controls.
- Collectible Object: cards, decks, and objects that should sit visually above software.
- Active Instrument: scanner, Home instrument, and focused operational surfaces.

## Collectible Object Behavior

Implemented shared primitives:

- `CollectibleCard`
- `CollectibleThumbnail`
- `CollectibleStack`
- `CollectibleWell`
- `CollectibleHero`

Rules:

- Card and deck art should visually outrank surrounding software.
- Pressed collectibles use Lift: a small rise, sharper shadow, and no layout jump.
- Missing images remain honest and never invent artwork.
- Geometry is shared-element ready, but no native transition dependency is required.

## Spatial Inventory

Implemented shared primitive:

- `LocationBreadcrumb`

Rules:

- Storage location should answer “where is this card?” at a glance.
- Breadcrumbs prefer physical terms such as Binder, Box, Shelf, Page, Slot.
- Unassigned cards are displayed honestly as `Unassigned`.
- Location UI is present in Collection, Card Detail, and Storage Manager.
- Binder, Search, and Scanner result usage remains Partially Implemented.

## Signature Interactions

- DOCK: control settles into selected state.
- LIFT: collectible rises on press.
- SLOT: card or location placement snaps into position.
- SCAN LOCK: scanner moves from searching to found, locked, reading, added, remove, ready.
- REVEAL: object expands into detail.

## Haptics

- light: Dock and segment selection.
- selection: filter and location choice.
- medium: Slot and move-card actions.
- success: scan, add, and share completion.
- Passive animation must not trigger haptics.

## Motion Timing

- Tap: 120ms.
- Fast: 180ms.
- Standard: 260ms.
- Slow: 420ms.
- Launch choreography target: 700-1000ms.
- Reduce Motion must disable decorative motion while keeping state changes visible.

## Loading Choreography

Implemented:

- `TradingDocksLaunchChoreography` for auth/app-loading presentation.
- `SignatureSkeleton` for material-aware product skeleton contracts.

Rules:

- Launch animation must never block app readiness.
- If initialization is slower than animation, transition to the matching skeleton surface.
- Primary product surfaces should prefer material skeletons over generic spinners.

## Bottom Dock

Status: Implemented.

Primary mobile navigation remains exactly:

- Home
- Collection
- Scan
- Decks
- Account

Rules:

- Scan is centered and mechanically docked into the rail.
- Active state uses material rise plus cyan role color.
- Inactive destinations recede but remain readable.
- Deal Desk and admin destinations remain contextual, never primary tabs.

## Remaining Debt

- Binder and Wishlist should adopt `LocationBreadcrumb` in their custom rows.
- Scanner result sheets should use `LocationBreadcrumb` when storage assignment is visible.
- Deck open transition is a documented concept; full shared-element animation remains Planned.
- Material-aware skeletons are available but not yet adopted on every route.
- Physical-device review is still required for fine spacing on 320px wide devices.
