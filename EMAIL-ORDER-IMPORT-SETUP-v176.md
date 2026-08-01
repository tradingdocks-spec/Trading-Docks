# Trading Docks v176 — Email Order Import Setup

## What changed

- Replaced the technical email-connector placeholders with a three-step guided setup.
- Added separate, plain-language Gmail and Outlook forwarding instructions.
- Added TCGplayer, eBay, and Shopify selection so instructions use the marketplace's name.
- Added a stable private import-address preview for each signed-in workspace.
- Added clear explanations of what Trading Docks receives, extracts, and reviews.
- Added prominent privacy messaging: no mailbox password and no access to unrelated email.
- Added an explicit pre-launch state so users cannot mistake the setup preview for an active inbox.

## Activation boundary

This release completes the customer-facing setup experience. Inbound email receiving, parser webhooks, confirmation handling, and automatic order creation still require the production inbound-email service. The page labels this clearly and keeps verification disabled until that service is connected.

## Validation

- TypeScript passed
- Focused ESLint passed with one pre-existing React effect warning and no errors
- Next.js production build passed
- All 85 routes compiled
