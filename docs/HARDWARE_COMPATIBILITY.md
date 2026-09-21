# Hardware Compatibility Center

Status: **Implemented in the development branch; not deployed.** Physical certification and pilot readiness remain pending. The approved DS2208 Amazon destination is active in the catalog and affiliate generation is enabled only in the isolated local preview; production enablement is unchanged.

## Audit and architecture

The public site uses App Router pages, the shared landing Header/Footer, theme tokens, CSS modules and a public sitemap. POS setup is an existing location/register form, not a multi-step wizard. POS Hardware already provides keyboard-wedge input, Label Studio navigation and live Square Terminal pairing/assignment. These workflows are preserved. The setup page now adds a concise, optional hardware section after the form; buying equipment never gates setup submission.

There was no shared hardware catalog or general affiliate helper. The marketing product registry describes software features, not purchasable devices. Admin pages use platform authorization, but a mutable catalog would require new persistence, audit and write authorization. The initial implementation deliberately uses a reviewed typed config instead of a new database/admin subsystem. No migration, role grant, environment change or rollout change is required. Existing POS capability/rollout controls continue to apply.

Canonical source: `src/lib/hardware/catalog.ts`. The public page, guides, onboarding and Hardware area all use it. `activeHardware()` filters inactive records and orders recommendations. Cash drawer and accessory categories exist without invented models; they are not presented as purchasable categories. The Hardware area explicitly says drawer certification is forthcoming.

Routes:

- `/hardware`: compatibility tiers, reference register stack and product cards.
- `/hardware/[slug]`: concise shared setup/test/troubleshooting guides for all four devices.
- `/hardware/out/[id]?source=...`: catalog-ID-only outbound link resolution and structured click event.
- `/dashboard/pos/setup`: optional recommendations following the existing setup form.
- `/dashboard/pos/hardware`: recommendations plus existing scanner, Terminal and printing workflows.
- `/dashboard/pos/hardware/test-receipt`: capability-protected, print-only 80 mm fixture using the existing receipt renderer. It clearly says TEST ONLY and writes no sale, inventory or payment data.

## Reference stack and certification

| Reference | Configuration | Current certification |
|---|---|---|
| Zebra DS2208 | DS2208-SR7U2100SGW; USB keyboard-wedge, Enter suffix, linear and QR labels | PENDING_TEST |
| Zebra ZD421 | ZD4A042-D01E00EZ; Direct Thermal, 203 dpi; USB/USB Host/Ethernet; Label Studio 2 × 1, 2.25 × 1.25 and 4 × 6 inch presets | PENDING_TEST |
| Epson TM-T20IV | 80 mm; prefer USB + Ethernet SKU (US C31CL47002 includes serial) | PENDING_TEST |
| Square Terminal | Requested v2 reference; exact revision must be verified with Square | PENDING_TEST |

Square's current official product page names **Square Terminal**, not “Terminal v2.” The requested revision is recorded in compatibility notes and its guide; the public model name follows the official source. Do not confuse Square Register (2nd generation) with Terminal. Use Square's official source rather than inventing an Amazon listing.

`TESTED` means exact-model physical acceptance. `COMPATIBLE` means supported standards with physical acceptance incomplete. `BEST_EFFORT` means unvalidated, potentially usable. `PENDING_TEST` explicitly identifies our current reference selections. Tier explanations may describe Trading Docks Tested, but no current product displays that badge. `certificationFor()` falls back to PENDING_TEST if a TESTED record lacks complete evidence.

Promotion procedure: physically run the existing `POS_HARDWARE_ACCEPTANCE_SHEET.md` for the exact SKU, interface, driver, browser, OS and app version. Retain scanner burst/unknown scans, print alignment/batches/scan-back, receipt/cutter/reprint, and applicable Terminal interruption/refund results. Obtain owner review, then update certification plus `evidence.testedAt`, `version`, `browser`, `os`, `notes`, and `report` in a focused reviewed change. Update `updatedAt`. Filling fields is not a substitute for performing physical QA.

Catalog certification never changes store configuration. Scanner/printer cards say ready to test, not connected. Terminal status comes from the existing live Terminal controls. Nothing in this catalog enables production payments. Physical Terminal operation is unavailable in Sandbox.

Printing uses existing browser/PDF + OS-driver workflows. Direct ZPL, automatic cash drawer opening and direct network printer control are **Planned**, not implemented.

## Affiliate links and disclosures

`src/lib/hardware/links.ts` centralizes HTTPS validation, exact hostname allowlists, Amazon US product-path validation, tag replacement and manufacturer fallback. It rejects credentials, nonstandard ports, executable URLs, lookalike domains, shorteners and Amazon redirect paths. Caller-provided destinations are never accepted by the outbound route; only an active catalog ID resolves to a reviewed URL. Query strings on approved Amazon product URLs are preserved while existing `tag` is removed and replaced only when enabled.

**Only Zebra DS2208 is approved for Amazon US:** reference SKU `DS2208-SR7U2100SGW`, ASIN `B06VYGFGR7`, canonical destination `https://www.amazon.com/dp/B06VYGFGR7`. Other records retain official manufacturer sources. There are no prices, scraping, ratings, Prime claims or generated hardware photos. Product images use official manufacturer-hosted photos with attribution/variant alt text and an explicit unavailable-image fallback. The CSP permits only the additional exact manufacturer image hosts; no broad wildcard was added.

Amazon Associates account approval and Associate ID `tradingdocks-20` were supplied by the owner. The ID is the centralized default in `src/lib/hardware/affiliate-config.ts`; the existing server resolver and outbound route use it. It is a public tracking identifier, not a credential. No component contains the tag. Deployment activation and listing approval remain separate; no production settings were changed.

Activating approved Amazon links in an authorized environment uses:

- `HARDWARE_AFFILIATES_ENABLED=true`
- `AMAZON_ASSOCIATE_TAG=tradingdocks-20` (optional explicit override; the approved ID is now the default)
- Optional `HARDWARE_AFFILIATE_DISCLOSURE=<reviewed site-level disclosure>`

Then set the catalog record's `purchase` to `{ retailer: 'AMAZON_US', destination: '<approved https product URL>', active: true, region: 'US' }`. This is data configuration in the typed registry, not a component rewrite. An absent override uses the owner-approved central tag. Invalid overrides disable monetization; a valid approved Amazon destination remains a normal untagged link. Missing, inactive or invalid Amazon destinations fall back to the manufacturer. No credentials or env object are sent to clients; public-safe resolved links may inherently contain the tracking tag.

Active affiliate CTAs show the configured commission disclosure and “As an Amazon Associate I earn from qualifying purchases.” directly beneath each button. Affiliate links use `sponsored noopener noreferrer`; normal links use `noopener noreferrer`. Disclosure is neither a tooltip nor modal. No affiliate disclosure is shown when there is no active affiliate link. Disable the flag to return to untagged behavior. Pages are dynamic and outbound responses no-store so deployment configuration and disclosure cannot diverge because of static caching.

To add future retailers: extend the typed retailer union and one resolver with an exact domain/path policy, regional configuration and tests. Never implement a generic `?url=` redirect.

## Tracking and administration

The existing showcase event store is tenant/showcase-specific and unsuitable for this public catalog. The implementation follows the existing structured server-event logging approach. Outbound GETs emit `hardware_purchase_click` with hardware_id, manufacturer, model, category, retailer, effective certification_status and a bounded source_page (`public_hardware`, `pos_onboarding`, `pos_hardware`). No account, email, IP, referrer, arbitrary query string or user-entered metadata is included by this event. Platform access logs remain subject to the platform's existing policy.

These are outbound request counts, not deduplicated people or revenue; crawlers/repeated requests may be counted. Existing log tooling can group these dimensions. A dedicated analytics dashboard, durable aggregates and affiliate revenue import are **Planned**; no revenue is claimed. Tracking failure must not justify collecting personal information.

Catalog administration is currently a reviewed config change by repository maintainers. No ordinary store owner can edit recommendations, links or certification. A future DB-backed platform-admin manager needs an approved migration, platform-only authorization, audit history and validated URLs/evidence; store hardware status must remain separate.

## Sources checked September 21, 2026

- [Zebra DS2208](https://www.zebra.com/us/en/products/scanners/general-purpose-handheld-scanners/ds2200-series/ds2208.html)
- [Zebra ZD421](https://www.zebra.com/us/en/products/printers/desktop/zd400-series/zd421.html)
- [Epson TM-T20IV](https://epson.com/For-Work/Printers/POS/TM-T20IV-Thermal-Receipt-Printer/p/C31CL47002)
- [Square Terminal](https://squareup.com/us/en/hardware/terminal)

Manufacturer specifications establish model capabilities, not Trading Docks physical validation or manufacturer endorsement. Confirm exact SKU and image-use arrangements before a future public production launch.


## Exact listing approval

The DS2208 canonical destination is attached only to `zebra-ds2208`; the outbound resolver adds `tradingdocks-20` centrally when enabled. No Amazon page was fetched or scraped for this configuration change; the owner supplied the verified identity. Price, ratings, reviews, Prime and availability remain absent.

Do not map ASIN `B09DTKNSVB` to the ZD421 Ethernet reference: the owner verified that it corresponds to `ZD4A042-D0EM00EZ`, not `ZD4A042-D01E00EZ`. A later approved USB/BTLE variant must be a distinct entry. Epson remains `C31CL47002` with no approved Amazon destination. Square stays on its official link. All physical certifications remain PENDING_TEST.

## Approved consumables — implemented September 21, 2026

The active catalog now contains four reference devices and three owner-approved consumables. All consumables remain COMPATIBLE, never physically TESTED.

| Catalog ID | Exact Amazon US ASIN | Intended hardware |
|---|---|---|
| betckey-2x1 | B072B9VR1K | zebra-zd421 |
| betckey-2-25x1-25 | B0CT5B6632 | zebra-zd421 |
| thermalino-80mm-230ft | B0D6K6LNCD | epson-tm-t20iv |

`relatedHardwareIds` is the canonical association. Shared consumable recommendations derive printer-guide contents from those relationships. The public Hardware Center and POS Hardware show a secondary media setup section; Label Studio exposes the two label sizes in a collapsible setup section. The four-device onboarding stack remains unchanged. Media guides describe preset selection, calibration and physical acceptance.

All destinations use the existing validated outbound resolver and centralized affiliate configuration/disclosure. No Amazon page is fetched; specifications are owner-supplied. No prices, ratings, reviews, Prime or availability claims are collected or displayed.

Fallbacks remain visible next to consumable Amazon links. BETCKEY uses its verified [manufacturer site](https://betckey.com/). No Thermalino paper-brand site was verified; its fallback is explicitly labeled [Epson printer & media guidance](https://epson.com/For-Work/Printers/POS/TM-T20IV-Thermal-Receipt-Printer/p/C31CL47002), not a substitute Thermalino listing or retailer. Maintainers can set purchase.active=false to route to the fallback. Availability is not polled automatically. A verified Thermalino manufacturer/retailer fallback can be added after review.

Earlier four-record/DS2208-only statements describe prior milestones. Current approved Amazon destinations total four; ZD421, Epson printer hardware and Square Terminal still retain official links. Production configuration and deployments remain untouched.

## Catalog freeze and physical acceptance gate — September 21, 2026

Owner accepted the hardware affiliate integration. The current seven-record catalog is FROZEN. Do not add affiliate products, substitute listings/configurations, or expand hardware families without explicit owner approval. The next hardware work is physical acceptance only. Production remains untouched.

| Record | Exact approved reference | Current certification |
|---|---|---|
| zebra-ds2208 | Zebra DS2208, DS2208-SR7U2100SGW | PENDING_TEST |
| zebra-zd421 | Zebra ZD421, ZD4A042-D01E00EZ | PENDING_TEST |
| betckey-2x1 | BETCKEY 2 x 1 inch, ASIN B072B9VR1K | COMPATIBLE |
| betckey-2-25x1-25 | BETCKEY 2.25 x 1.25 inch, ASIN B0CT5B6632 | COMPATIBLE |
| epson-tm-t20iv | Epson TM-T20IV, C31CL47002 | PENDING_TEST |
| thermalino-80mm-230ft | Thermalino 3 1/8 inch x 230 ft, ASIN B0D6K6LNCD | COMPATIBLE |
| square-terminal | Square Terminal; record actual model/SKU/revision from tested unit | PENDING_TEST |

Keep these certification states until physical acceptance passes for each exact record. A device pass does not automatically certify associated consumables; each label size and receipt paper must have its own physical result. Never promote an entire product family based on one SKU or infer a Terminal revision.

For every physical acceptance result, record:

- Catalog record ID and exact tested manufacturer/model/SKU (and revision or ASIN where applicable).
- Tested OS and version, browser and version, and Trading Docks version/commit.
- Actual tested connection type; record not applicable with a reason for consumables and identify the host printer/connection.
- Exact tested media, dimensions/core where applicable, and printer/preset settings; explicitly record not applicable for tests without media.
- Test date, executed cases, results and relevant notes/limitations.
- Evidence/report location, including physical print/scan-back evidence where relevant.

Only after a documented physical PASS, promote that exact record from COMPATIBLE/PENDING_TEST to TESTED and attach the acceptance evidence. Populate the existing evidence fields and include connection/media details in the notes and linked report. Certification applies only to the documented configuration; untested connection/media combinations remain unverified. Software/emulation passes cannot substitute for physical evidence. Pilot readiness remains NOT READY until the intended physical hardware set has passed.
