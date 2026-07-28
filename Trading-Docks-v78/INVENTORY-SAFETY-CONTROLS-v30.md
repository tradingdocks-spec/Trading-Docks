# Inventory Safety Controls v30

## Added

- **Delete from Inventory** in the binder card menu.
- **Delete from Inventory** in the binder card details drawer.
- **Delete from Inventory** in the bulk-box item details panel.
- **Delete Box** in the bulk-box header.
- **Return to Inventory** in the bulk-box header.

## Safeguards

- Permanent deletion always requires confirmation.
- The confirmation explains the difference between deletion and Put-Away.
- Deleting an item updates the location's unit and value totals.
- A location containing inventory cannot be deleted.
- Empty location deletion requires confirmation.

## Validation

- Next.js production build completed successfully.
- TypeScript validation completed successfully.
- All 54 application routes generated successfully.
