# Trading Docks v224 — Mana Pool in Orders channel filter

The Orders dropdown previously used only marketplaces already present in
`marketplace_orders`. That meant Mana Pool stayed hidden until a successful
Mana Pool order import created at least one normalized order.

The Orders page now also loads marketplace connections whose status is `ready`
and passes those channel IDs into the Orders Center.

The filter combines:
- channels represented by imported orders
- connected/ready marketplaces

Mana Pool now appears immediately after its connection is ready. Selecting it
may show zero orders until the first successful Mana Pool order import.
