# v201 — Professional deck identity engine

- Separates archetype (what the deck is trying to do) from themes (how it gets there).
- Detects Aggro, Chaos, Combo, Control, Group Hug, Group Slug, Midrange/Battlecruiser, Stax/Prison, and unusual/janky builds.
- Detects focused Commander themes including Voltron, Tokens, Aristocrats, Blink, Burn, Cascade, Counters, Cycling, Discard, Permission, Enchantress, Extra Combats, Infect, Theft, Lands, Lifegain, Mill, Reanimator, Spellslinger, Storm, Superfriends, Taxes, Toolbox, typal decks, Wheels, and others.
- Identifies the primary game plan, likely win method, named win-condition cards, and backup win conditions.
- Runs plan-specific candidate searches before generic role/staple searches.
- Keeps final Scryfall format-legality and commander color-identity validation independent of AI ranking.
- Uses EDHREC ranking as a popularity signal and EDHREC-style specificity as a ranking principle; plan fit takes priority over ubiquitous staples.
- Adds a visible Deck Identity panel to AI Deck Doctor.

No new Supabase SQL is required.
