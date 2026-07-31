# File Inventory Modal Position v164

- Renders inventory dialogs at the document root so animated dashboard containers cannot offset them.
- Opens dialogs near the top of the visible browser viewport on desktop and mobile.
- Resets the dialog's internal scroll position whenever it opens.
- Locks background-page scrolling while a dialog is active.
- Adds Escape-key closing and dialog accessibility attributes.
- Preserves the v163 buylist intelligence and all earlier security, dashboard, and inventory work.

Validation: TypeScript passed, ESLint completed with zero errors, and the production build compiled all 81 routes.
