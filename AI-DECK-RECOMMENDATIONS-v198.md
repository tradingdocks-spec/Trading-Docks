# AI Deck Recommendations — v198

- Uses the commander card's authoritative Scryfall color identity.
- Treats colorless cards as legal while rejecting every off-color candidate.
- Re-validates format legality and color identity after Scryfall search.
- Prevents AI ranking from introducing cards outside the verified candidate pool.
- Ranks candidates by structural role, commander/deck theme synergy, curve fit,
  and EDHREC popularity instead of popularity alone.
- Shows format and commander-color verification in the recommendation interface.
- Shows strategy-synergy signals on recommended cards.
- Preserves the existing account-saved Deck Vault workflow.

No Supabase migration is required.
