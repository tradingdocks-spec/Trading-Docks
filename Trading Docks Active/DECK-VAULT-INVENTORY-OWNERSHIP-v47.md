# Deck Vault inventory ownership v47

- Deck Vault now reads the current account-scoped inventory item and location records.
- Inventory matches include binders, bulk boxes, custom storage, and all other configured locations.
- Binder matches display the physical page and pocket, such as `Binder 1 · Page 1 · A1`.
- Ownership is quantity-aware and distinguishes fully owned, partially owned, and missing cards.
- The card inspector lists every matching location, quantity, condition, and printing.
- The ownership totals and filters use covered deck copies rather than an all-or-nothing card flag.
- Legacy inventory records remain supported as a fallback.
