TRADING DOCKS — DECK VAULT BUILDER V2

MAJOR UPDATES

COMMANDER ART HEADER
- Commander card art is retrieved through Scryfall.
- The art crop becomes the deck header background.
- The full commander card is shown beside the deck title.
- Non-Commander formats receive a clean color-based header instead.

FUNCTIONAL CARDS TAB
- The Cards tab now displays the cards in the deck.
- Visual card grid and compact list views.
- Cards grouped by Commander, Creature, Instant, Sorcery, Artifact,
  Enchantment, Planeswalker, Land, and Other.
- Live Scryfall card search.
- Add cards directly from search results.
- Decrease or remove cards.
- Quantity badges.
- Game Changer badges.
- Deck composition summary.
- Save and import-update actions are prepared for Supabase persistence.

FORMAT SELECTION
- The Deck Vault home includes an All Formats filter.
- Individual deck pages include a View as Format dropdown.
- Commander and Brawl show commander-specific analysis.
- Standard, Modern, Pioneer, Legacy, Vintage, Pauper, and other formats
  display format-aware deck-health analysis without commander-specific stats.

COMMANDER BRACKETS
- Commander deck review now returns Brackets 1–5:
  1 Exhibition
  2 Core
  3 Upgraded
  4 Optimized
  5 cEDH
- Counts detected Game Changers.
- Displays Game Changer disclosures.
- Considers Game Changers, fast mana, compact win packages, tutors,
  and average mana value.
- The rules engine is intentionally transparent and shows its reasons.

CURRENT GAME CHANGERS
- /api/deck-vault/game-changers queries Scryfall using:
  is:gamechanger
- This avoids relying on a permanently hardcoded list.
- /api/deck-vault/card-search includes Scryfall's game_changer field when
  available.

NEW API ROUTES
- /api/deck-vault/card-search?q=sol+ring
- /api/deck-vault/commander-art?name=Atraxa%2C+Praetors%27+Voice
- /api/deck-vault/game-changers

SUPABASE
The Deck Vault migration was expanded for:
- Commander image and art URLs
- Commander bracket
- Game Changer count
- Card images
- Set and collector numbers
- Per-card Game Changer status
- Synced Commander Game Changer records

IMPORTANT
The Commander bracket result is a deck-building assistant and pregame
conversation aid. It should not be represented as an official tournament
rating or a substitute for discussing deck intent with the playgroup.

INSTALL
1. Extract into the project root.
2. Replace matching files.
3. Run the updated Supabase migration when ready.
4. Stop the development server.
5. Clear .next:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
6. Restart:
   npm run dev
