# Trading Docks v203 — Premium Customer CRM Polish

This release refines the Seller/Store CRM into a denser, guided customer workspace.

## Highlights

- Segmented directory filters for marketing, store credit, and loyalty audiences
- Guided first-customer empty state and future CSV-import entry point
- Redesigned responsive customer form with sticky header/footer
- Customer type and acquisition source
- Chip-based tags and formatted phone entry
- Explicit email/SMS consent cards
- Duplicate email/phone warning before profile creation
- Collapsible staff-only notes
- Live loyalty reward example, recent activity, save confirmations, and stronger contrast

## Database

After the v202 CRM foundation, run `00_RUN_THIS_IN_SUPABASE_CRM_POLISH_v203.sql` once.
It only adds two profile fields, validation constraints, and lookup indexes; existing customer records are preserved.
