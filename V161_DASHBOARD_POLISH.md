# Trading Docks v161 — Dashboard Polish

## Dashboard experience

- Replaced the oversized modular-workspace banner with a compact, personalized header.
- Removed placeholder inventory, revenue, order, team, and marketplace figures from new accounts.
- Added consistent zero-state metric cards with direct next actions.
- Added a three-step first-run checklist for inventory, Deck Vault, and marketplaces.
- Replaced the oversized empty chart and calendar with focused collection activity and upcoming-event panels.
- Moved dashboard customization into one overflow menu.

## Navigation and interface

- Changed the global `Create` action to the contextual `Add cards` action.
- Added platform-aware `Ctrl K` / `⌘ K` search hints.
- Simplified the primary sidebar and moved advanced analytics, automation, and store operations into a collapsed Business tools group.
- Updated the account label to Personal workspace.
- Increased secondary-text contrast and reduced visual noise from borders, shadows, and cyan accents.
- Preserved responsive mobile behavior and reduced-motion support.

## Verification

- ESLint: 0 errors
- TypeScript: passed
- Next.js production build: passed (79 routes)
- Security and stability hardening from v160 preserved

