# Deck Format and Legality Update

## Supported formats

- EDH
- Pauper EDH
- Standard
- Modern
- Pioneer
- Legacy
- Vintage
- Alchemy
- Premodern
- Pauper

## Format-aware interface

Commander selection, command-zone cards, Change Commander controls, and
Commander-specific card actions are shown only for EDH and Pauper EDH.
Changing to a non-Commander format immediately removes those controls.
Returning to EDH or Pauper EDH restores them.

Older saved decks labeled `Commander` are normalized to `EDH`.

## Legality checks

Deck cards are resolved through Scryfall and checked against the selected
format's current legality field:

- `commander`
- `paupercommander`
- `standard`
- `modern`
- `pioneer`
- `legacy`
- `vintage`
- `alchemy`
- `premodern`
- `pauper`

Banned and not-legal cards are errors. Vintage restricted cards are identified
as restricted and become an error when the deck contains more than one copy.
The validator also checks normal four-copy limits, EDH singleton construction,
Commander presence, and 100-card EDH deck size.

No manually uploaded ban-list files are required.
