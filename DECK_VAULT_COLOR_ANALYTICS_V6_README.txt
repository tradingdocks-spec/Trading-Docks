TRADING DOCKS — DECK VAULT COLOR ANALYTICS V6

CARDS
- Reduced card size significantly.
- Supports up to eight cards per row on wide screens.
- Removed the Printing button and placeholder printing dropdown.
- Reduced hover enlargement from 20% to 11%.
- Added a stronger, clearly visible Trading Docks hover glow:
  cyan outer glow with a subtle violet secondary glow.
- Game Changers receive an amber glow.
- Legality warnings receive a red glow.
- Card names remain centered.

CHANGE COMMANDER
- Change Commander is now functional.
- Opens a full commander-search modal.
- Searches Scryfall using is:commander.
- Selecting a result updates:
  commander card
  commander name
  commander artwork
  header background
  commander color identity
- Existing commander is replaced rather than added to the main deck.

MANA SYMBOLS
- Replaced letter-based colored circles with custom mana-symbol glyphs:
  white sun
  blue water drop
  black skull
  red flame
  green tree/leaf
  colorless star
- Updated the shared ManaPips component and deck detail interface.

COLOR DEMAND
- Added a color-coded donut/pie chart.
- Uses the deck's calculated colored mana demand.
- Includes percentages, labels, and mana symbols.
- Preserved the detailed color-demand bars below the chart.

INSTALL
1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear .next:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
