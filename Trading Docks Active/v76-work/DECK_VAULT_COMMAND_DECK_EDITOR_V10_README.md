# Trading Docks Deck Vault — Command Deck Editor V10

V10 replaces the long, vertically grouped deck-list page with a professional three-panel deck workspace.

## Default Table View

The editor now opens in a compact table designed to show substantially more of the deck at once.

Columns include:

- Quantity
- Card
- Type
- Mana value
- Price
- Ownership and card status

The table has:

- Sticky column headers
- Internal desktop-height scrolling
- Sortable quantity, type, mana value, and price columns
- Larger 11–14px typography
- Row selection and bulk deletion
- Card artwork thumbnails
- Game Changer and ownership badges

## Four Editor Views

### Table
The default compact whole-deck view.

### Grid
Artwork-focused card gallery.

### Role
Cards grouped by functional purpose such as ramp, removal, card draw, tutors, protection, and finishers.

### Stats
Compact type totals, unique-card counts, and category values.

## Three-Panel Workspace

### Left — Deck Explorer
- Pinned commander
- Type navigation
- Category card counts
- Quick Add Basics

### Center — Deck Workspace
- Search
- Type filter
- Ownership filter
- Sortable deck table
- Grid, Role, and Stats views
- Search results for adding cards

### Right — Card Inspector
- Selected card artwork
- Type
- Quantity
- Mana value
- Price
- Ownership
- Analyze Card
- Find Replacement
- Remove from Deck
- Live deck-health summary

## Persistent Command Bar

The editor toolbar remains visible while working and includes:

- Total cards
- Unique cards
- Deck value
- Search
- Filters
- View switching
- Change Commander
- Bulk actions

## Retained Features

- Working Change Commander picker
- Standalone commander
- Basic-land quick add
- Exact basic-land search
- Authentic MTG mana symbols
- AI Deck Doctor
- Format legality and duplicate warnings
- Premium analytics command center

## Installation

Extract the ZIP into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
