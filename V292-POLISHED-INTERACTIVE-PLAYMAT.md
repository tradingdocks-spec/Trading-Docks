# V292 — Polished Interactive Playmat

The Deck Vault playtester now behaves like a focused tabletop playmat instead of a static card-zone dashboard.

## Gameplay upgrades

- Click or tap battlefield cards to rotate them into tapped position.
- Tapped lands add mana to the live mana pool; untapping removes unused mana.
- Creatures and other spells require their mana value before they can be cast.
- Auto-pay can select and tap enough available lands, then cast the selected card.
- Instants and sorceries resolve into the graveyard.
- One land can be played each turn.
- Advancing the turn untaps all permanents, clears floating mana, draws a card, and resets the land play.
- Newly cast creatures display a summoning-sickness indicator.
- Battlefield cards retain quick controls for returning to hand or moving to the graveyard.

## Visual upgrades

- Dedicated tabletop surface with subtle playmat grid and depth.
- Separate creatures/permanents and mana-base rows.
- Smooth 90-degree tap animation with an active cyan edge.
- Compact status rail for turn, zones, available mana, and play/draw choice.
- Clear action feedback through temporary tabletop notifications.
- Improved command-zone presentation and more compact card spacing.

Mana payment currently uses each land as one generic mana because the deck record stores mana value and color identity, but not full printed mana-cost symbols or land-produced color data.
