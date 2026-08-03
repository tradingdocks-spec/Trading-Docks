# Trading Docks v225

The Orders channel filter now treats a saved Mana Pool seller credential as a connected channel, even when an older `marketplace_connections` row still says `setup_required`.

Also included:
- a one-time SQL repair for existing Mana Pool connection rows
- a clear message when Mana Pool is connected but no normalized orders have been imported yet

The filter appearing does not itself create sales. Mana Pool sales appear only after the import endpoint retrieves and normalizes the seller's orders into `marketplace_orders`.
