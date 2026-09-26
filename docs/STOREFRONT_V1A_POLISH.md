# STOREFRONT V1A customer-facing polish

Status: Implemented locally for review. **Not deployed, pushed, merged, or applied to production.**

Branch: `codex/storefront-polish`, based on main `99f2bd2b4be468c98ebe63d598a3a0e480d81505`.

## Public-access gate

Before editing, production `/shop` and `/s/trading-docks` were each opened in three fresh, nonpersistent Chromium contexts: signed out, incognito-equivalent private context, and direct navigation without an existing session. All six contexts started with zero cookies. Both routes returned HTTP 200 without redirects. Actual printing artwork and public sale prices loaded; anonymous Add to Cart and cart display worked. No owner account was used. Authorization was not changed.

## Before → after

- Large cards and a visually heavy 250px sidebar → compact, consistent cards and a quiet 196px sidebar without a surrounding panel.
- Four columns at 1440px → five, with four at 1024px and six at 1920px. Phones at 390/430px retain two columns; one column is reserved for widths below 360px.
- Permanent mobile filters → an accessible filter sheet with scrollable content and an Apply action; desktop retains labeled checkbox groups and counts.
- Small price beside a bright button → prominent sale price, secondary stock count, and a full-width, restrained Add action. Set code, collector number, condition and finish distinguish printings. Other metadata remains available in details.
- Filter chips now include search and descriptive filter names, individual removal, and Clear all. Existing sort options and server-side behavior are retained.
- `/shop` now supports actual light and dark palettes, with an in-header theme toggle. The floating picker remains hidden. The compact `/s/*` surface and legacy rollback keep their dark presentation.
- Images keep the existing exact-printing candidate resolver, with a fixed ratio, lazy loading, loading skeleton and fallback. No artwork substitution or new image service.
- Cart/details/filter dialogs now contain keyboard focus, close with Escape, restore trigger focus, and prevent background scrolling. Add feedback tracks the existing asynchronous revalidation, with no artificial delay or button size change.

## Scope preserved

No database, migration, API, query, route authorization, workspace tenancy, price/quantity authority, listing availability, inventory, event, checkout, POS, Square, dependency, or deployment changes. The saved-cart storage, quantity rules, subtotal calculation and revalidation requests are unchanged. Only Add feedback timing and dialog presentation changed. The page still retrieves 24 cards per server-rendered page; filters and sorts remain server-side. No eager full-catalog client fetch was added.

Local acceptance uses the existing production-shaped recovery database through loopback services, with the existing local anonymous configuration. It performs no data writes. No fixture records were created.

## Validation

- Baseline and post-change root suite: **1,023/1,023**.
- Focused storefront/Showcase suite: **21/21**.
- TypeScript and optimized production build: passed.
- Full ESLint: **0 errors, 551 existing warnings**; changed-file lint has no errors.
- Production dependency audit: zero vulnerabilities; dependencies unchanged.
- Browser matrix: **13/13 scenarios** — `/shop` in both themes at 390, 430, 820, 1024, 1440 and 1920px, plus anonymous `/s/trading-docks` regression.
- Each `/shop` scenario checks public access, 24-card pagination size, artwork, price, grid columns, no overflow, keyboard focus, cart/dialogs, filters, chips, search, sort, duplicate printings, details, refresh persistence, empty results and saved theme switching.
- Normal acceptance: **zero runtime/console/CSP errors and zero failed same-origin responses**. Production-mode CSP contains no unsafe-eval.
- Browser-intercepted fault scenarios: **2/2**, one per theme. Delayed revalidation preserves pending feedback and button dimensions; simulated 503 preserves the cart and recovers on refresh; delayed/invalid artwork shows the skeleton/fallback. These intentional failures never reach the server.
- Final-build smoke: **12/12** — both themes at 320, 390, 430, 820 and 1440px, including image/layout screenshots and next/previous pagination; both rollback URLs remain read-only and dark with a saved light preference. The 320px grid correctly uses one column. The final mobile search placeholder fits without truncation.
- `git diff --check`: passed. Only the nine files listed below are included.
- Palette contrast: light text 14.72:1, muted text 6.01:1, primary-button pair 6.34:1; dark 14.92:1, 7.75:1 and 9.49:1 respectively. Keyboard controls have visible focus, checkboxes have labels, and headings follow h1 → h2 → h3.

The updated application was tested anonymously in private browser contexts against the local production-mode build. Production remains the previously deployed V1A version pending review.

Reproduce with `npm run check`, `npm run build`, a local production server on port 3020, then `node tests/storefront-polish-browser.mjs` and `node tests/storefront-polish-states.mjs`. Browser screenshots and JSON evidence are written to ignored `.local-fixtures/storefront-polish/`.

## Exact changed files

- `src/components/storefront/StorefrontExperience.tsx` — storefront presentation, filters, theme control and feedback.
- `src/components/storefront/storefront.module.css` — scoped responsive layout and light/dark palettes.
- `src/components/storefront/StorefrontImage.tsx` — lazy artwork, skeleton and fallback using the existing resolver.
- `src/components/storefront/StorefrontDialog.tsx` — accessible native modal wrapper.
- `src/components/storefront/LegacyStorefrontReadOnly.tsx` — dark theme attribute only, preserving rollback appearance.
- `src/components/theme/ThemeProvider.tsx` — allow `/shop` to follow the selected theme.
- `tests/storefront-polish-browser.mjs` — anonymous desktop/mobile/theme acceptance.
- `tests/storefront-polish-states.mjs` — browser-only loading/error/artwork checks.
- `docs/STOREFRONT_V1A_POLISH.md` — this review record.

Remaining release gate: owner review. No deployment was attempted.
