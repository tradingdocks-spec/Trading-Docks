# Trading Docks v290 — Commander Combo Intelligence

## Added to Deck Builder

- Live Commander Spellbook analysis inside the existing Intelligence tab.
- Complete, verified combos already present in the deck.
- One-card-away combo recommendations restricted to the commander's legal color identity.
- Missing-piece checks against the user's Trading Docks Inventory, including quantity and storage location.
- Verified combo outcomes, prerequisites, setup mana, execution steps, popularity, and estimated total combo value.
- Commander and command-zone piece identification.
- Bracket-sensitive combo summary.
- Direct attribution and links back to the verified Commander Spellbook entry.

## Reliability

- Commander Spellbook requests run server-side with a timeout and a graceful unavailable state.
- Combo results are normalized before reaching the browser.
- Combo analysis is limited to EDH and Pauper EDH; other formats retain the existing Deck Intelligence tools.
- Deck editing and all existing intelligence features continue working if the external combo service is unavailable.
