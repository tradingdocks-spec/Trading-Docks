# Trading Docks v249 — Deck addCard prop type fix

Fixed the Vercel TypeScript error:

`Expected 1 arguments, but got 2`

The `addCard` implementation already supported an optional destination section.
A child component prop type still described it as a one-argument function.

The prop contract now supports:

- Main Deck
- Commander
- Sideboard
- Considering / Maybeboard

Existing one-argument calls still default to Main Deck.
