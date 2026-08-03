# Trading Docks v253 — Deck Builder scope fix

## Root cause

`replaceCard` was declared inside `DeckDetailWorkspace`, while the replacement
modal renders inside the separate `CardsWorkspace` child component. The handler
was not passed through the component boundary, so TypeScript correctly reported
that it did not exist in the child scope.

## Fix

- Passes `replaceCard={replaceCard}` into `CardsWorkspace`
- Adds `replaceCard` to the child destructuring contract
- Adds the typed child prop:
  `(currentCard: DeckCard, replacement: ScryfallCardResult) => void`
- Preserves the replacement modal and all drag/drop features

## Verification

The child workspace was audited against all parent-defined handlers it uses:

- addCard
- replaceCard
- removeCard
- beginDrag
- finishDrag
- acceptDrop

All six are now declared in the child prop contract and passed at the call site.

A complete local Next.js build could not be run because the sandbox npm mirror
does not contain the existing `zod-validation-error@4.0.2` dependency. The
globally available TypeScript compiler was run as a secondary check; dependency
type errors are expected without node_modules, but the former replaceCard scope
error no longer appears.
