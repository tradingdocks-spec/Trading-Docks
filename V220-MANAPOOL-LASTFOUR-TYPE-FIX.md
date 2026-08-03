# Trading Docks v220 — Mana Pool saved-key type fix

Fixed the Vercel TypeScript error:

`Property 'lastFour' does not exist on type 'SavedCredentials'`

The `SavedCredentials` type now includes:

```ts
lastFour?: string | null;
```

This preserves the saved-key confirmation badge that displays only the final
four characters of the stored Mana Pool credential.
