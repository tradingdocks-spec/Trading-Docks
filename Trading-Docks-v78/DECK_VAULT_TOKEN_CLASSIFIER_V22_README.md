# Trading Docks Deck Vault — Token Classifier V22

## Why the previous token results were wrong

The previous parser used broad text fragments around the word `token`. This caused ordinary rules text to be mistaken for token names:

- Doubling Season → `Twice Of Those`
- Primal Vigor → `Of Those`
- Mirkwood Bats → `Or More`
- Peregrin Took → `Additional Food`

V22 replaces that behavior with a deterministic MTG-aware classifier.

## Classification model

Cards are now separated into five roles.

### Genuine token producers
Only these cards can add an item to the Required Token Kit.

Strong signals include:

1. Scryfall `all_parts` relationships to an actual token object
2. Oracle clauses that explicitly name the token being created
3. Replacement clauses that explicitly create an additional named token
4. Emblem creation

Examples:

- Chatterfang → Squirrel
- Peregrin Took → Food
- Arasta of the Endless Web → Spider
- Academy Manufactor → Food, Clue, and Treasure when those token names are explicitly present

### Token multipliers
These appear in Token Multipliers but do not create invented token types.

Examples:

- Doubling Season
- Primal Vigor
- Parallel Lives

### Token payoffs
These reward or modify tokens but do not enter the physical token kit.

Example:

- Mirkwood Bats

### Token copiers
Populate and copy effects are listed separately because they copy token types produced elsewhere.

### Token consumers
Cards that sacrifice, tap, or otherwise spend tokens are displayed as support cards rather than token producers.

## False-positive protection

The classifier explicitly rejects fragments such as:

- Twice Of Those
- Of Those
- Or More
- Or Sacrifice
- That Many
- Additional Food

`Food` remains valid when a card explicitly creates an additional Food token.

## Tokens page redesign

The Tokens page now contains:

- Required Token Kit
- Token Multipliers
- Token Copiers
- Token Payoffs
- Token Consumers

The Required Token Kit contains only genuine physical token types. The Created By list remains available for each token.

## Scryfall usage

V22 uses normal Scryfall card data as the authoritative source:

- Oracle text
- Related token objects through `all_parts`
- Exact imported-card resolution
- Token artwork search

The classifier does not depend on undocumented tags being present in normal card objects.

## Installation

Extract this ZIP into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

Reopen the affected deck and allow the Intelligence request to complete before opening Tokens.
