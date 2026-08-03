# Trading Docks v263 — Deck Studio dock scope fix

Fixed the TypeScript error:

`Cannot find name 'setActiveTab'`

The Deck Studio action dock renders inside `CardsWorkspace`, where the
page-level `setActiveTab` setter is unavailable.

The AI Optimize action now opens the existing Deck Studio Stats view through:

```ts
setView("stats")
```

This uses the real `CardsWorkspace` view API and keeps the action functional.

The dock was also audited for component-scope dependencies:

- `setView`
- `selectedCard`
- `trashCardFromDeck`
- `setReplacementCard`

All are available in the component where the dock renders.

No Supabase migration is required.
