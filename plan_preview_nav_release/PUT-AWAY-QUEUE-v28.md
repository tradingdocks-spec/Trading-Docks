# Trading Docks Put-Away Queue v28

## What changed

- **Send to Put-Away Queue** replaces the unreliable remove-from-binder action.
- Cards leave their binder pocket only after the inventory record is safely queued.
- The original location, binder page, and pocket are retained for Undo and history.
- A compact **Put Away** button shows the current queue count without crowding the binder.
- The right-side queue drawer shows card value, prior location, search, and filing actions.
- Cards can be filed individually or selected in groups.
- Binder destinations use validated open pockets and stop safely when no pocket is available.
- Cards moved out of the queue retain their identity, quantity, value, and movement history.
- An empty-state confirms when all inventory has been put away.

## Run

```powershell
npm install
npm run build
npm run dev
```

Open `http://localhost:3000/dashboard/inventory`.
