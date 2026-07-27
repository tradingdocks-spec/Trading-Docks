TRADING DOCKS — POLISHED DECK BUILDER V3

MAJOR VISUAL AND WORKFLOW CHANGES

COMMANDER
- Commander is now a standalone card.
- It is not shown in Creature or any other main-deck section.
- It is not counted in the main-deck card total.
- Dedicated commander panel includes value, mana value, ownership,
  Change Commander, and Choose Printing actions.

MAIN DECK
- Denser, cleaner card layout.
- Cards are grouped separately from the commander.
- Type View and Role View toggle.
- Role View supports Ramp, Card Draw, Removal, Board Wipe, Protection,
  Tutor, Proliferate, Land, and Other.
- Each section shows card count, average mana value, and section value.
- Card metadata is minimized so the artwork remains the focus.
- Hover actions expose View and Remove controls.
- Improved spacing, card lift, glow, and image zoom.

LIVE COMMAND CENTER
- Sticky right sidebar remains visible while scrolling.
- Main-deck count
- Deck value
- Owned and missing counts
- Section totals
- Live Deck Doctor recommendations
- Save and Import Updated List controls

ANALYTICS
- Main deck previews exclude the commander.
- Commander remains available in commander-specific analytics and header data.

INSTALL
1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear .next:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
