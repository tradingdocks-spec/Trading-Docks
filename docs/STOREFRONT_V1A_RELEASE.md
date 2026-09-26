# STOREFRONT V1A release gate

Branch: codex/storefront-v1a-production. Base: origin/main at 6f8af6c49a66ee15ffe2eabd03b99b42614a21c6. Only the reviewed storefront changes were transplanted; runtime/test/migration hashes match the accepted worktree. No scanner/Chaos/POS/Square changes, staging environment files or fixtures are included.

## Production database gate

Preflight profile, 1,454 identities, price hash and full inventory/event/position fingerprints matched rehearsal. No storefront schema existed; neither migration was previously recorded. Legacy /s/trading-docks returned 200; /shop returned its reviewed pre-cutover 404.

All nine recovery artifact sizes/SHA256 values passed. The September 24 recovery plus its preserved, verified capacity migration accounts for production's 24-entry preflight history. Relevant data is unchanged; no backup refresh was required under the existing refresh/revalidate-on-change policy.

Applied only the reviewed base and transition. Supabase execution history: 20260926041555 storefront_v1a_forward_only and 20260926041601 storefront_v1a_legacy_transition_guarded. The source files retain reviewed identifiers 20260925194250 and 20260926025045. No unrelated migrations or manual production row patches ran.

Results: 0 → 1,454 V1A listings; 1,452 published; 2 disabled PRICE_REQUIRED. All 1,454 inventory/workspace links and Magic labels preserved; no duplicates. Published-price parity 1,452/1,452. Conflict prices remain $0.24 / $0.48 / $1.60. Inventory asking prices were not backfilled.

Disabled listing IDs: ca892505-bc12-32f0-ba4f-edb3fcef7158 (Aegar MUL #31) and 00b9180e-6955-a226-ed84-484d2c460b83 (Shark Shredder TMT #320).

Inventory remains 1,515 rows / 1,775 units / 1,566 events. Full inventory/event/position hashes are unchanged, including inventory acquisition/provenance metadata. Both legacy objects and the reviewed STOREFRONT_READ_MODE=legacy fallback are retained. No new production environment variables are required.

## Exact promotion paths

- src/app/api/integrations/discord/messages/route.ts
- src/app/api/showcase/settings/route.ts
- src/app/dashboard/showcase/page.tsx
- src/app/dashboard/showcase/settings/page.tsx
- src/app/s/[storeSlug]/page.tsx
- src/components/dashboard/showcase/ShowcaseDashboard.tsx
- src/components/dashboard/showcase/ShowcaseSettings.tsx
- src/components/showcase/ShowcasePublicExperience.tsx
- src/components/theme/ThemeProvider.tsx
- src/lib/platform/api-access.ts
- src/lib/platform/route-access.ts
- src/lib/showcase.ts
- src/lib/supabase/proxy-routing.ts
- tests/showcase-contract.test.ts
- docs/STOREFRONT_V1A_DATA_AUTHORITY_AUDIT.md
- docs/STOREFRONT_V1A_PRODUCTION_TRANSITION.md
- docs/storefront-v1a-data-authority-records.csv
- docs/storefront-v1a-game-taxonomy-map.json
- docs/storefront-v1a-legacy-ancillary-records.csv
- docs/storefront-v1a-price-contract-browser.json
- docs/storefront-v1a-price-contract-rehearsal.json
- src/app/api/storefront/catalog/route.ts
- src/app/api/storefront/settings/route.ts
- src/app/api/storefront/tags/route.ts
- src/app/dashboard/showcase/tags/page.tsx
- src/app/shop/page.tsx
- src/components/dashboard/showcase/ShowcaseTagManager.tsx
- src/components/storefront/LegacyStorefrontReadOnly.tsx
- src/components/storefront/StorefrontExperience.tsx
- src/lib/showcase-tag-admin.ts
- src/lib/storefront/cart.ts
- src/lib/storefront/query.ts
- supabase/migrations/20260925194250_storefront_v1a_forward_only.sql
- supabase/migrations/20260926025045_storefront_v1a_legacy_transition_guarded.sql
- tests/storefront-transition-browser.mjs
- tests/storefront-transition-db.mjs
- tests/storefront-v1a.test.ts
- docs/STOREFRONT_V1A_RELEASE.md

CI, merge and production deployment are later release gates; no success is claimed here before they finish.

## Clean branch validation

PASS: focused 21/21; root 1,023/1,023; TypeScript; production build; diff check; ESLint 0 errors / 551 existing warnings; production dependency audit 0 vulnerabilities. Desktop/mobile browser checks passed on both URLs at 1440, 390 and 320 pixels, including exact conflict prices, hidden zero-price products, details, snapshot filters, cart revalidation, refresh, rollback mode and saved-light-theme readability. No blocking console/CSP errors or failed same-origin requests were recorded.
