# Trading Docks v222 — Mana Pool self-service connection

## Corrected behavior

- Mana Pool no longer shows an administrator-activation warning.
- Each customer connects using the API key generated in their own Mana Pool
  seller account.
- A saved Mana Pool credential is treated as a connected/ready marketplace.
- The marketplace card shows Connected even if an older database row still says
  `setup_required`.
- The saved key stays masked.
- Import and Replace Key actions remain available.
- The customer-facing security message now correctly explains that the seller
  API key is entered here and encrypted server-side.

No Trading Docks administrator approval is required for an individual customer
after their Mana Pool seller key is saved.
