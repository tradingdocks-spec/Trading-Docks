# Deck Showcase Compact Modules and Speed — v140

## Showcase layout

- Categories containing only one or two unique cards now render as smaller,
  content-sized modules instead of stretching to fill an entire lane.
- Compact modules use narrower containers, reduced empty space, and card-sized
  heights while keeping names and quantity badges readable.
- The same compact sizing rules are applied to both the live preview and the
  downloaded HD PNG.
- Larger categories continue using the full-width stacked-card treatment.

## Performance

- Deck autosave now waits for 1.2 seconds of inactivity, reducing repeated
  database writes while quantities, names, or sections are being edited.
- Removed the redundant full-deck database read immediately after every save.
  The account and deck keys are still confirmed by the database upsert result.
- Deck intelligence waits for the same idle window instead of competing with
  rapid editing.
- Showcase thumbnails now lazy-load and decode asynchronously.
- PNG export loads only the grouped cards actually used by the poster.

No Supabase migration is required.
