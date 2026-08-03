# Trading Docks v218 — Mana Pool API key save fix

The v217 Mana Pool panel contained instructions but the generic credential form was hidden behind disabled legacy UI.

This release adds a dedicated visible API-key form directly inside the Mana Pool setup panel:

- password-masked API-key input
- encrypted server-side Save action
- saved-key status and last-four display
- replacement-key workflow
- database-readiness warning
- official Mana Pool API settings link retained

The form uses the existing `/api/marketplaces/credentials` encrypted credential service.
