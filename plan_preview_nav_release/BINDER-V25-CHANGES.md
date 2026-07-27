# Trading Docks Premium Binder Management v25

This release polishes the Virtual Binder and adds complete card-location management.

## Binder experience

- Cleaner card pockets with artwork-first presentation
- Compact three-dot actions menu instead of permanent destructive controls
- Card detail drawer with printing, condition, finish, value, and pocket address
- Larger single-page binder canvas
- Improved empty-pocket styling and visible pocket addresses
- Compact autosave status in the header
- One persistent Back to Inventory button
- Simplified footer and page presentation
- EDHREC card links from the detail drawer

## Card actions

- View card details
- Move within the current binder
- Move to another binder and choose a specific page and pocket
- Move to any configured inventory location
- Occupied destination pockets are disabled
- Replace card shortcut
- Remove from binder while retaining the inventory record
- Undo pocket removal
- The same action menu opens from the three-dot button or right-click

## Run locally

1. Extract this project into a new folder outside any existing `trading-docks` project.
2. Copy your `.env.local` into the new project folder.
3. Run `npm install`.
4. Run `npm run build`.
5. Run `npm run dev`.

The production build was verified across all 54 routes.
