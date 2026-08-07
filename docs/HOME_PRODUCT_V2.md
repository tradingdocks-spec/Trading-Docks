# Home Product V2

Status: Implemented for the active mobile Home route.

## Product Goal

Home answers three questions only:

1. What do I own or manage?
2. What changed recently?
3. What should I do next?

It is not a dense dashboard, analytics wall, or duplicated navigation system.

## Current Hierarchy

- Implemented: Compact brand/account header.
- Implemented: One hero summary block.
- Implemented: Up to four quick actions with Scan as the dominant action.
- Implemented: Recent Adds horizontal carousel backed by real saved collection records.
- Implemented: One contextual insight.
- Implemented: Bottom tabs remain the only primary persistent navigation.

## Hero Rules

- Collector and Free accounts show collection value when a positive saved value exists; otherwise they show `Value unavailable`.
- Seller accounts show inventory-oriented copy over the same real collection summary.
- Store accounts show a business snapshot only from supported collection data. Unsupported operations metrics are not invented.
- Empty accounts show `Start your collection` with Scan and manual-entry paths.
- Stale or unavailable collection data is labeled explicitly.

## Quick Actions

Canonical active actions:

- Scan
- Collection
- Add Card
- Review, or Deal Desk for Seller/Store accounts

Rules:

- Maximum four actions.
- Scan is the strongest action.
- Actions route into existing destinations only.
- The action row is a shortcut surface, not another navigation bar.

## Recent Adds

- Implemented: Recent Adds uses the first loaded Collector Workspace page, sorted by `updatedAt`.
- Implemented: Each card uses the owned inventory record for title, printing, condition, finish, quantity, image URL, and price label.
- Implemented: Missing images render an unavailable image state.
- Implemented: Missing prices render `Price unavailable`.
- Implemented: Tapping a card opens the existing collection detail route.

## Empty State

- Implemented: Empty Home shows a lightweight starter state: scan, review, organize.
- Planned: A more guided onboarding checklist can be considered only after the product owner approves it as a feature.

## Remaining Work

- Planned: Real notifications.
- Planned: Real recent activity feed.
- Planned: Real market movement or collection insight source.
- Planned: Store/team shared workspace resolver for true multi-user business snapshots.
- Requires Production Configuration: Physical-device visual QA across small iPhone, large iPhone, Android, Expo Web narrow viewport, larger text, reduced motion, and stale/offline collection states.
