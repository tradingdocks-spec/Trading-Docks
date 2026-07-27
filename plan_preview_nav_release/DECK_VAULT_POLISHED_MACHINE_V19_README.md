# Trading Docks Deck Vault — Polished Machine V19

V19 corrects the Token Intelligence workflow, eliminates wasted space in Mana Curve, standardizes the Card Inspector controls, and introduces a Deck Readiness system.

## Token Intelligence 2.0

The token engine now detects substantially more wording patterns, including:

- Standard "create a token" wording
- Tokens that "are created"
- Named tokens
- Token copies
- Replacement effects
- "Plus that many" effects such as Chatterfang
- Treasure, Food, Clue, Blood, Map, Powerstone, and Gold
- Common creature tokens such as Squirrel, Spider, Zombie, Saproling, Insect, Spirit, Soldier, Human, Beast, Plant, Angel, Servo, and Thopter
- Emblems
- Scryfall related token parts

The engine now:

1. Enriches the deck through Scryfall.
2. Reads related token objects.
3. Parses oracle text using multiple token patterns.
4. Normalizes token names.
5. Finds recent token artwork through Scryfall.
6. Ranks token relevance.
7. Recommends practical quantities based on token frequency and the number of generators.

This specifically improves decks such as Chatterfang and Arasta that were previously returning no tokens.

## Mana Curve redesign

The oversized empty Mana Curve panel has been replaced with a denser analytics surface.

It now includes:

- Compact histogram
- Average mana value
- Number of cards at mana value 1–3
- Number of cards at mana value 5+
- Peak mana-value slot

The chart remains readable while using substantially less vertical space.

## Unified Card Inspector buttons

The following actions now use one shared component:

- Analyze on EDHREC
- Find Replacement
- Remove from Deck

They now have the exact same:

- Font family
- Font size
- Font weight
- Height
- Line height
- Alignment
- Padding
- Border radius
- Tracking

Only their semantic accent colors differ.

## Deck Readiness

Analytics now includes a Deck Readiness score combining:

- Format legality
- Inventory ownership
- Token preparation
- Deck health

The readiness checklist shows what is ready and what still needs attention before the deck is played.

## Hero refinement

Imported decks no longer have to lead with the generic title "Imported Deck." When a commander is available, the commander name becomes the primary hero title.

## Installation

Extract this ZIP into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

## Important testing note

After installing, reopen an imported token deck and allow the Intelligence request to finish. The Tokens tab should populate after Scryfall enrichment and token image resolution complete.
