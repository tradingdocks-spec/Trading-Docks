TRADING DOCKS — DECK VAULT

WHAT WAS ADDED

Sidebar:
- Deck Vault now appears directly under Inventory in Core Workspace.

Routes:
- /dashboard/deck-vault
- /dashboard/deck-vault/import
- /dashboard/deck-vault/new
- /dashboard/deck-vault/decks/atraxa-superfriends
- /dashboard/deck-vault/decks/ur-dragon
- /dashboard/deck-vault/decks/krenko-mob-boss

DECK VAULT HOME

- Premium collector-focused landing page
- Mana-color visual identity
- Deck cards with value, power, ownership, format, and status
- Combined deck value
- Collection coverage
- AI deck-review insights
- Import and create actions
- Collector workflow guidance

UNIVERSAL IMPORT CENTER

- Paste decklists
- URL import entry point
- File upload entry point
- Format detection
- Moxfield examples
- ManaBox examples
- MTGGoldfish examples
- Quantity parsing
- Import preview

DECK ANALYTICS

- Mana curve
- Average mana value
- Color demand
- Card-type distribution
- Functional categories
- Ramp
- Card draw
- Removal
- Board wipes
- Tutors
- Protection
- Proliferate
- Mana-source health
- Collection ownership
- Missing cards
- Deck value
- Power estimate
- AI review
- Recommendations
- Tabs for Overview, Cards, Analytics, Ownership, Prices, Playtest, and History

SUPABASE

Migration included:

supabase/migrations/20260724_deck_vault.sql

Tables:
- decks
- deck_cards
- deck_snapshots

The interface currently uses polished sample data so the experience is visible
immediately. The migration provides the production database foundation for
connecting saved decks, cards, ownership, price snapshots, and analytics.

NEXT IMPLEMENTATION STEPS

1. Connect the import parser to Scryfall card resolution.
2. Save imported decks to Supabase.
3. Match deck cards against Trading Docks inventory.
4. Add live historical deck-value snapshots.
5. Add drag-and-drop deck editing.
6. Add opening-hand playtesting.
7. Add shareable public and unlisted deck links.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Run the Supabase migration when ready.
4. Stop the development server.
5. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
6. Restart:
   npm run dev
