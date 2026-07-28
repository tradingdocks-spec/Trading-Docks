TRADING DOCKS — DECK VAULT CARD POLISH V5

UPDATES

CARD DENSITY
- Tightened the card grid to reduce wasted horizontal space.
- Supports up to seven cards per row on wide screens.
- Reduced card gaps.
- Added total card count badges to every category.
- Category summaries now show total cards, unique cards, average mana value,
  and section value.

HOVER EFFECTS
- Added a subtle Trading Docks cyan glow around normal cards.
- Game Changers receive an amber glow.
- Legality violations receive a red glow.
- Hover enlargement remains active and floats above nearby cards.

CARD NAME
- Card names are centered below the artwork.
- Hover details also center the card name.

FORMAT LEGALITY
- Commander and Brawl use a singleton copy limit.
- Sixty-card formats use a four-copy limit.
- Basic lands are exempt from copy-limit warnings.
- Cards above the format copy limit receive a red overlay and red quantity pill.
- A starter Commander banned-card check is included.
- Banned cards receive a red overlay identifying the selected format.

GAME CHANGERS
- Replaced the small purple tag with a brighter gold banner.
- Added a sparkle icon, stronger contrast, and amber glow.

PRINTING SELECTOR
- Added a discreet Printing button below each card.
- The button opens a small dropdown.
- Includes current, cheapest, and premium printing placeholders.
- The component is ready to connect to live Scryfall printing results.

LIVE SUMMARY
- Added Unique Cards and Copy Limit metrics to the sticky command center.

IMPORTANT
The built-in banned list is only a starter rules layer. For production,
connect format legality to Scryfall legalities or a regularly synchronized
rules database.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
