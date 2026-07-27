# Trading Docks v45

## Trial management

- Every trial can now be permanently deleted.
- Deletion uses a clear confirmation dialog before removing the trial.
- Related trial usage events are removed automatically by the existing database relationship.

## Trial invitation email

- Redesigned as a polished, responsive marketing email.
- Stronger value-focused headline and clearer call to action.
- Highlights inventory organization, market intelligence, financial tracking, purchasing, collections, tasks, and seller operations.
- Reinforces that no credit card is required.
- Keeps the invited email visible so customers know which address to use.

## Installation

No new Supabase migration is required for v45. Copy the existing `.env.local`
from v44, then run `npm install`, `npm run build`, and `npm run dev`.
