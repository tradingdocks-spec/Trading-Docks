# Hardware Compatibility Center validation

Date: September 21, 2026. Branch: `codex/pos-foundation`.

Result: **Implemented and validated locally. Not deployed.** Production, hosted schemas, Square connections, secrets and tenant enablement remain unchanged. Affiliate monetization remains disabled. Existing unrelated inventory/acceptance changes in the working tree were preserved.

## Delivered

One typed registry (`src/lib/hardware/catalog.ts`) supplies `/hardware`, four `/hardware/[slug]` guides, POS Setup and POS Hardware. Header/footer navigation and the sitemap expose the public routes. Existing scanner input, Terminal pairing/assignment, Label Studio and receipt history remain available. An authenticated print-only test receipt reuses the existing receipt renderer without any ledger write.

Records: Zebra DS2208 USB; Zebra ZD421 Direct Thermal/203 dpi; Epson TM-T20IV USB/Ethernet reference; Square Terminal with requested-v2 revision caveat. All four remain **PENDING_TEST**. No product has a Trading Docks Tested badge. Cash drawer/accessory categories exist without fabricated reference models.

Square's official public page does not identify the requested v2 designation, so the display name follows Square's published name and the guide records the revision verification requirement. Physical acceptance remains pending and pilot readiness remains NOT READY.

Affiliate URL generation is centralized and disabled by default. No Amazon listing/tag was invented or activated. All seed CTAs use official manufacturer destinations. Tests use synthetic Amazon URLs and a synthetic tag only; no Amazon request, scraping or purchase occurred. Active affiliate fixtures render both disclosures directly below the CTA with sponsored/noopener/noreferrer. Disabled fixtures remove the tag and disclosure. Invalid or inactive destinations fall back to approved manufacturers.

The outbound route resolves catalog IDs only, ignores arbitrary destination parameters, emits bounded structured hardware_purchase_click dimensions and returns a no-store redirect. Four real local route requests produced the expected catalog/source events in the local server log. No PII or purchase revenue is recorded by the event. Dedicated admin editing/aggregated analytics are deliberately deferred as documented; config and existing server logs are the initial management/measurement paths.

## Validation results

| Check | Result |
|---|---|
| Baseline root TypeScript / unit tests | PASS; 949 tests before implementation |
| Root unit suite after implementation | PASS; 956 tests, including seven new hardware tests |
| Root TypeScript after implementation | PASS |
| Changed-file ESLint | PASS, zero errors/warnings in captured scoped output |
| Baseline full-repository lint | Zero errors, 534 existing warnings; no broad unrelated lint cleanup |
| Isolated optimized Next build | PASS; all routes generated; no application dotenv files or production credentials loaded |
| Catalog loading/order/inactive filtering and evidence-required certification | PASS |
| Affiliate enabled/disabled/missing tag; query preservation; URL/domain/path rejection; manufacturer fallback | PASS |
| Typed outbound event and source allowlist | PASS |
| Receipt fixture labeling/totals/existing print renderer | PASS |
| Component browser tests at 1280 px and 390 px | PASS; onboarding, Hardware scanner input, four cards, all tier rendering, inactive hidden, affiliate disclosure on/off, no horizontal overflow or runtime errors |
| Built public page at 1440 px and 390 px | PASS; heading, four loaded manufacturer images, guides, no product TESTED badge, no inactive affiliate disclosure, no overflow/runtime errors |
| Built metadata/canonical/sitemap/navigation | PASS; hardware links from home, guides, mobile menu open/Escape/focus |
| Outbound redirect security | PASS; four active catalog destinations, arbitrary url parameter ignored, unknown ID 404, no-store |
| Receipt test anonymous access | PASS; redirects to sign-in |
| Existing POS regression (`node tests/pos-db.mjs --browser`) | PASS; 128 database groups plus register, cash, labels, Square/Terminal, recovery and tablet browser scenarios |
| Git diff whitespace check | PASS |

The optimized build emits existing membership-catalog/revenuecat export warnings; it completes successfully. Initial isolated-copy attempts lacked imported mobile/design source directories; the copy was completed and the final build passed. No application code was altered to suppress those warnings. Browser QA found and fixed duplicate ThemeCorner rendering on the new marketing routes, which otherwise covered the mobile menu. The screenshot/keyboard checks were repeated afterward.

## Reproducible checks

```
npm test
npm run typecheck
node --test --experimental-strip-types tests/hardware.test.ts
node tests/hardware-browser.mjs
node tests/hardware-public-browser.mjs
node tests/pos-db.mjs --browser
```

`hardware-browser.mjs` uses the existing disposable POS test runtime's esbuild installation and installed Chrome, with synthetic API responses and no remote database. `hardware-public-browser.mjs` targets only `http://127.0.0.1:4317`, expecting a local Next production server. The build for this run used an ignored `.local-fixtures/hardware-preview` source copy, a node_modules junction and a sanitized child environment. It included the imported mobile/services, mobile/design and design-system sources but no application env files. No deployment was made. This setup avoids accidentally loading the repository's unrelated production configuration.

Local evidence: `.local-fixtures/hardware-build-final.log`, `hardware-tests.log`, `hardware-unit.log`, `hardware-typecheck.log`, `hardware-lint.log`, `hardware-browser.log`, `hardware-public-browser.log`, `hardware-pos-regression.log`, and screenshots under `.local-fixtures/hardware-browser/`. These are development artifacts, not customer data.

## Limits and follow-up

- Responsive web was exercised; Expo/native code was not modified. No native device certification is claimed.
- POS integration tests use the existing disposable database/browser harness, not the signed-in owner's hosted workspace. No staging writes were necessary for this feature.
- Physical scanner, label printer, printed scan-back, receipt printer and Terminal acceptance remain **PENDING**. Browser print output is not a physical printer pass.
- Hardware photos are official remote manufacturer images; they can become unavailable. The explicit fallback links to manufacturer photos. Exact SKU and image-use arrangements require review before a production launch.
- Affiliate activation requires explicit owner approval, an approved destination and configuration. No affiliate revenue reporting or durable analytics dashboard is implemented.
- No production deploy/migration, main merge, real-money transaction or production tenant enablement occurred.

See [architecture and certification process](HARDWARE_COMPATIBILITY.md).


## Amazon Associates configuration update

Owner-approved ID `tradingdocks-20` is now the centralized default in `src/lib/hardware/affiliate-config.ts`, consumed only through the existing server configuration path. Environment overrides remain supported; the existing explicit activation flag remains unchanged. No approved Amazon product destinations exist in the seed catalog, so all current cards still use manufacturer links, including Square Terminal. No production environment, deployment, listing, price or disclosure behavior changed. Targeted tests verify the approved tag, preserved query parameters, explicit enable/disable behavior, disclosure configuration and official-link fallback.


## Exact DS2208 destination activation

Owner approved DS2208 SKU `DS2208-SR7U2100SGW` and ASIN `B06VYGFGR7`. The catalog now enables that canonical Amazon US destination only on `zebra-ds2208`; the central resolver produces `https://www.amazon.com/dp/B06VYGFGR7?tag=tradingdocks-20` when enabled. Reference SKUs are visible on cards and guides. ZD421 records `ZD4A042-D01E00EZ` with USB/USB Host/Ethernet; the mismatched ASIN `B09DTKNSVB` is deliberately absent. Epson `C31CL47002` and Square retain official links.

Nine hardware unit tests pass, including exact identity, unique approved destination, untagged disabled behavior and unchanged manufacturer fallbacks. Scoped lint and TypeScript pass. Local preview activation uses its ignored, sanitized launcher only; no hosted environment configuration or production setting changed. No Amazon page, price, rating, review, Prime status or availability was fetched. Earlier no-approved-listing statements in this report describe the previous state.

Final verification: isolated optimized build PASS; built-page browser checks with --affiliates PASS at 1440/390 px, exactly one Amazon disclosure, sponsored link attributes, exact DS2208 tagged redirect, and official redirects without tags for the remaining devices. Redirects were inspected without following them to Amazon. Production remains untouched.

## Consumable catalog acceptance — September 21, 2026

Implemented three owner-approved COMPATIBLE consumables with exact ASIN routing and catalog-driven printer associations. ZD421 guide shows both BETCKEY sizes; TM-T20IV shows only Thermalino receipt paper; unrelated guides show neither. Public center/POS Hardware present secondary setup content; Label Studio has a collapsible label-stock section. No physical TESTED claim was introduced.

Validation PASS:
- 959 unit tests, including 10 hardware tests covering exact destinations, central tag, association isolation, inactive records, fallback and certification.
- TypeScript and scoped ESLint.
- Credential-free isolated optimized Next build. Existing unrelated RevenueCat normalizeMembershipTier export warning remains.
- Component browser coverage at 390/1280 px: POS Hardware, onboarding, scanner input, affiliate enabled/disabled, inactive records, certification tiers and overflow/runtime errors.
- Built public browser coverage at 390/1440 px: seven catalog entries/guides, four affiliate disclosures, exact tagged redirects inspected without following to Amazon, correct two/one/zero printer associations, mobile navigation/focus, metadata/sitemap and anonymous receipt protection.
- Disposable POS harness: 128 database checks plus browser flows including Label Studio five-page PDF, scan-to-item, cash sale, recovery and receipt regressions.
- Agent-browser local page snapshot and visual verification.

Evidence: ignored local consumables-baseline.log, consumables-tests.log, consumables-lint.log, consumables-typecheck.log, consumables-build.log, consumables-pos.log and hardware-browser screenshots. No Amazon content was fetched or scraped. No hosted configuration, production deployment, schema, secret or production tenant changed. Native code was not modified or physically tested.

Fallback limitation: BETCKEY has a verified manufacturer site. Thermalino paper-brand fallback is not verified; its clearly labeled Epson printer/media guidance link is available without substituting another Amazon product. Availability is not automatically monitored. Physical acceptance of all three supplies remains pending.

## Owner acceptance and catalog freeze — September 21, 2026

Hardware affiliate integration is ACCEPTED. The seven-record catalog is FROZEN; no additional affiliate products or substitutions without explicit owner approval. Next hardware work is physical acceptance only. Existing four PENDING_TEST device states and three COMPATIBLE consumable states remain unchanged. No physical pass was supplied or recorded by this documentation update.

Use the exact-record evidence requirements in HARDWARE_COMPATIBILITY.md before promoting any individual record to TESTED: exact model/SKU, OS/browser, connection, media, test date, application version and relevant notes/report. A passed SKU does not certify its product family or associated consumables. Production remains untouched; pilot readiness remains NOT READY pending the intended hardware set's physical acceptance.
