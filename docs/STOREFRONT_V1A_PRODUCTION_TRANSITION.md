# STOREFRONT V1A Production Transition

## Production application — 2026-09-26

The owner authorized production promotion. Both reviewed SQL files were applied successfully in order through Supabase migration tooling. The service recorded execution versions `20260926041555` (storefront_v1a_forward_only; reviewed file 20260925194250) and `20260926041601` (storefront_v1a_legacy_transition_guarded; reviewed file 20260926025045). These are the same reviewed SQL, not additional migrations. Do not reapply based solely on filename/history timestamp differences.

Production postconditions: 1,454 listings, 1,452 enabled, 2 PRICE_REQUIRED, 1,454 unique inventory links and Magic mappings; all published prices match the preflight inventory_value snapshot. Full inventory/event/position fingerprints and 1,515 rows / 1,775 units / 1,566 events are unchanged. The actual public RPC returns 1,452 unique Magic products with positive prices. Legacy profile and function remain intact. PR #137, POS and Square are unchanged. Application promotion and final verification are tracked in STOREFRONT_V1A_RELEASE.md.


Status: **STOREFRONT V1A TRANSITION READY** — implemented, recovery-rehearsed and migrated in production; application promotion is tracked in the release gate.

## Approved price contract

The owner approved storefront-controlled price snapshots seeded from the currently rendered legacy price, `inventory_items.inventory_value`. The prior asking-price-only migration is superseded.

`storefront_listings.storefront_listing_price` is the explicit customer-facing sale price. Migration records `price_source=legacy_inventory_value` and `price_captured_at`. After capture, inventory valuation, market value, acquisition cost and asking-price changes do not change the listing price. There is no automatic sync or fallback. `asking_price` remains untouched inventory metadata.

A strictly positive listing price is required for publication. The generated `price_status` is READY or PRICE_REQUIRED. A database constraint prevents enabling NULL/zero-price listings. The catalog, detail display, minimum/maximum filters, sorting, and cart revalidation all use the listing snapshot. Existing admin publication controls preserve snapshots and return PRICE_REQUIRED for unpriced selections. A future explicit pricing editor is outside this transition.

## Legacy schema and population

| Entity | Identity |
| --- | --- |
| Production project | bohddnajlnmknngzjsjk |
| Legacy showcase_profiles ID | d6bffb23-850f-4fe3-926d-fb1344bdc4ca |
| Workspace | 4e775109-9f6f-4264-88c8-2c3c5b944a9b |
| Owner | 3ea45327-7984-4108-ada8-511748e73fd8 |
| Slug | trading-docks |
| Eligible products | 1,454 distinct inventory_items IDs |

Legacy products are dynamically projected, not stored legacy listing rows. `get_public_showcase_inventory` joins showcase_profiles → workspaces → owner inventory_items; it includes positive quantities and excludes private/excludedFromShowcase records. The legacy price formula is `greatest(0,coalesce(data.marketPrice,inventory_value,0))`. Every audited product currently uses inventory_value. The absent-game legacy default is Magic: The Gathering.

All eligible inventory belongs to the expected workspace and has exactly one positive active position. Direct image fields are empty; all products retain Scryfall IDs. One position has a different quantity from aggregate inventory, but V1A's approved quantity cap preserves effective availability. No inventory correction is made.

Legacy ancillary tables contain 75 showcase_events, 7 kiosk_devices and 5 kiosk_pairing_codes; request/request-item/reservation records were empty at audit. These are excluded from V1A. See the retained [ancillary manifest](storefront-v1a-legacy-ancillary-records.csv). No request/reservation/POS/payment behavior is enabled.

Current deployed production serves `/s/trading-docks` (200), while `/shop` is presently 404. The rehearsed V1A app and its rollback mode serve both exact paths; the slug is unchanged.

## Revised migration and mappings

The reviewed [base migration](../supabase/migrations/20260925194250_storefront_v1a_forward_only.sql) is unchanged. SHA-256: `A5BF56AE6B54297B966137646CDB245CA5C050757BA71D418E1A4C036A62F93D`.

The complete revised SQL is [20260926025045_storefront_v1a_legacy_transition_guarded.sql](../supabase/migrations/20260926025045_storefront_v1a_legacy_transition_guarded.sql). This previously blocked draft was never applied to production and was revised under the owner's explicit instruction. It adds listing columns, replaces the catalog function, defines the shared taxonomy resolver and performs the guarded transition atomically. Apply only after the reviewed base and only under later production authorization. Do not apply unrelated worktree migrations.

| Legacy field/entity | V1A field/rule |
| --- | --- |
| Profile ID/workspace/slug/display_name/description/logo | Same fields in storefront_profiles |
| enabled/show_prices/show_quantities/minimum_price/exclusions | Preserve supported audited values |
| Profile timestamps | Preserve created_at/updated_at |
| Inventory owner/workspace/ID | listing user_id/workspace_id/inventory_item_id |
| Legacy product identity | deterministic listing ID: md5(workspace + ':storefront-v1a:legacy:' + inventory ID)::uuid |
| Current rendered inventory_value | storefront_listing_price snapshot |
| Price > 0 | enabled=true; price_status=READY |
| Price = 0 | snapshot 0.00; enabled=false; price_status=PRICE_REQUIRED |
| Price provenance | price_source=legacy_inventory_value; price_captured_at=transaction timestamp |
| Audited legacy Magic label | listing game_id=magic; public label Magic: The Gathering |
| Inventory created_at/updated_at | Initial listing timestamps |
| Title/set/condition/finish/language/media | Continue reading the same inventory/position references; checked for parity |
| Quantity/availability | Approved inventory/position authority; no new authoritative quantity store |
| V1A public ID | position: + md5(workspace UUID + ':' + position ID) |
| Tags | Existing storefront_tags/storefront_inventory_tags; no invented legacy tags |

All 1,454 records undergo a deterministic price/taxonomy transformation: 1,452 publishable and 2 intentionally unavailable. No ambiguous cohort records remain under the approved policy. Unsupported legacy commerce records remain excluded.

### Exact zero-price records

| Product | Inventory / legacy public ID | V1A listing ID |
| --- | --- | --- |
| Aegar, the Freezing Flame — MUL #31 | chaos-c60a727e2c9640d4be78e8819f46c042-d3205ae6908c4537 | ca892505-bc12-32f0-ba4f-edb3fcef7158 |
| Shark Shredder, Killer Clone — TMT #320 | chaos-3995102bbeb4450dbd3171836055c969-529c7240d437478d | 00b9180e-6955-a226-ed84-484d2c460b83 |

Both are migrated with preserved ownership/inventory links, 0.00 snapshots, disabled publication and PRICE_REQUIRED. Neither is returned by the normal catalog or explicit-ID cart revalidation. No free checkout item is exposed and no price is invented.

### Three conflicts preserved

| Product | Inventory ID | Snapshot | Asking price, untouched |
| --- | --- | ---: | ---: |
| Sultai Charm KTK #204 | chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7 | $0.24 | $1.00 |
| Serra Angel W16 #3 | chaos-4a2bfbcd52ea4bcf910742ffaebf7da9-59f0584f58c846cd | $0.48 | $0.25 |
| Prodigy's Prototype NEO #231 | chaos-62e742fa4f174ec995e9c15ce2e7b563-468db788725e4ca6 | $1.60 | $0.50 |

## Taxonomy

The [validated alias map](storefront-v1a-game-taxonomy-map.json) is implemented in pure SQL helpers `resolve_storefront_game` and `storefront_game_label`. Both catalog branches and excluded-game settings share the resolver. Unicode NFKC, trim, whitespace collapse and lowercase precede exact alias matching. Unknown/conflicting values return NULL and fail publication instead of becoming Other.

| Canonical ID | Public label |
| --- | --- |
| magic | Magic: The Gathering |
| pokemon | Pokémon |
| yu-gi-oh | Yu-Gi-Oh! |
| flesh-and-blood | Flesh and Blood |
| digimon | Digimon |
| pokemon-japan | Pokémon Japan |
| lorcana | Disney Lorcana |
| one-piece | One Piece |

The audited cohort preserves its observed Magic label only after identity, workspace, price, Scryfall-presence and explicit-game consistency guards. Mixed batch labels are not card taxonomy. All 1,454 listing records retain Magic; the public catalog has 1,452 Magic products and zero Other. This does not broaden provider/game capabilities or modify inventory game fields.

## Cutover and safe failure

Use **A. Atomic cutover**: populate V1A in one transaction, verify, then switch application reads. No dual-read union or duplicated catalog is used.

The migration has a 5-second lock timeout and locks source/destination tables while checking membership and prices. Concurrent source writes may wait during the transition transaction. Do not weaken guards to avoid a failure.

Guarded evidence:

- Exact enabled profile, workspace, owner, slug and unchanged legacy RPC definition.
- Supported branding/exclusions and no active legacy reservations.
- Exactly 1,454 IDs; sorted identity hash `f48ebf4c9d144d49c3b6ab99c41ba470`.
- Sorted inventory_value price hash `1ece8ffe38b4b92fa1829069200ab546`.
- Legacy rendered price equals snapshot source, exact two zero identities, valid taxonomy and Scryfall reference.
- Same workspace and exactly one active position per source row.
- No conflicting/extra destination rows.
- Actual public RPC parity for all 1,452 publishable products: unique identity, title, metadata, media, price and effective quantity.

Repeat runs preserve the original snapshot and capture timestamp. Merchant-edited destination records fail rather than being overwritten. A changed source price or membership requires re-audit. The SQL contains no inventory, position or event INSERT/UPDATE/DELETE.

Future authorized deployment sequence: recheck production hashes; retain rollback mode/artifact; apply only the base and transition; verify parity while legacy reads remain active; deploy V1A separately; verify both routes and cart. The database steps were subsequently authorized and completed as recorded above; application promotion is tracked in the release gate.

## Rollback

The application includes an explicit server-only `STOREFRONT_READ_MODE=legacy` mode for both `/shop` and `/s/trading-docks`. In that mode, `LegacyStorefrontReadOnly` queries the unchanged `showcase_profiles` and `get_public_showcase_inventory` directly; it does not read V1A prices or listings. Return to V1A by unsetting the mode.

Rollback preserves both paths and the slug without changing inventory, positions, events or snapshots. Keep V1A rows for diagnosis. Do not restore the entire database or drop forward schema. Legacy profile and RPC remain intact.

The rollback display is intentionally read-only and degraded: search and up to 48 legacy results, no cart planning, advanced filters, analytics POSTs, requests, reservations, orders, payments or POS. It excludes nonpositive prices, retaining the approved zero-price safety policy. Returning to the old main artifact alone is insufficient because `/shop` did not exist and legacy request actions must remain excluded.

The optional rollback variable is documented here, not set in production. Normal V1A requires no new production environment variable. Local rehearsal configuration contains only local URL and dummy anonymous credentials.

## Rehearsal evidence

Latest verified recovery source: `pre_active_capacity_v3_20260924`, recovered 2026-09-24T20:45:15.751Z. Fresh clone: `storefront_price_contract_20260926` in `supabase_db_trading-docks-recovery-test`. Its relevant full-row fingerprints match current production.

Browser copy: same data in local container `td-storefront-v1a-rehearsal-20260925`, real PostgREST v16.2, optimized Next server at 127.0.0.1:3017. A loopback gateway only removes the `/rest/v1` URL prefix; queries and prices are not mocked. No production credentials are used.

The browser-copy restore reported 30 managed-service role/permission warnings involving Realtime, privileged extension/Vault grants and managed default privileges. Storefront schema/data/functions and anonymous RPC work. Managed Realtime/Vault behavior is not part of the browser rehearsal; the authoritative database migration tests run on the intact recovery clone.

| Check | Result |
| --- | --- |
| Legacy records accounted for | 1,454 |
| Publishable listings | 1,452 |
| Zero-price unavailable listings | 2 |
| Duplicate listings | 0 |
| Price parity | 1,452/1,452, including all three conflicts |
| Taxonomy parity | 1,454 Magic listings; zero Other |
| Database assertions | 55/55, including repeat success and atomic conflict rollback |
| Both V1A routes | HTTP 200 with correct prices and clickable cart |
| Viewports | 1440×1000, 390×844, 320×740 |
| Detail, price filters, cart refresh/revalidation | Passed |
| Zero records in normal/cart-ID catalog | Excluded |
| Blocking browser runtime/CSP errors | None recorded |
| Failed same-origin browser requests | None recorded |
| Root suite | 1,023/1,023 |
| Focused storefront + Showcase suite | 21/21 |
| Production build / TypeScript | Final build and typecheck passed |
| ESLint | 0 errors; existing 551 warnings |
| Base migration | Byte-for-byte unchanged |
| Legacy rollback routes | Both HTTP 200; conflicts retained, zero-price entries hidden, no commerce actions |
| Diff check | Passed |

Evidence: [database results](storefront-v1a-price-contract-rehearsal.json), [browser results](storefront-v1a-price-contract-browser.json). Reproducible test scripts target explicit loopback/recovery resources, never a hosted connection string.

Final production read-only check: **1,515 inventory rows / 1,775 units / 1,566 events**. Production storefront_listings remains absent. No deployment, merge, PR #137 change, POS enablement or Square enablement occurred.

| Protected source | Full-row fingerprint, unchanged |
| --- | --- |
| Inventory | 0fef56d528f9b9bb3d83c397935b2891 |
| Inventory events | 85a8820f5ea75430c3440a60f0ff8093 |
| Positions | b1f2188986662e4ac941542ad5f3377b |
| Legacy profiles | 5be86f73004ed09192f0987174d8791f |

## Exact files changed for this contract

- supabase/migrations/20260926025045_storefront_v1a_legacy_transition_guarded.sql
- src/lib/showcase.ts
- src/lib/storefront/cart.ts
- src/app/api/storefront/tags/route.ts
- src/app/shop/page.tsx
- src/app/s/[storeSlug]/page.tsx
- src/components/storefront/StorefrontExperience.tsx
- src/components/storefront/LegacyStorefrontReadOnly.tsx
- src/components/showcase/ShowcasePublicExperience.tsx
- src/components/dashboard/showcase/ShowcaseDashboard.tsx
- src/components/dashboard/showcase/ShowcaseTagManager.tsx
- tests/storefront-v1a.test.ts
- tests/storefront-transition-db.mjs
- tests/storefront-transition-browser.mjs
- docs/STOREFRONT_V1A_PRODUCTION_TRANSITION.md
- docs/STOREFRONT_V1A_DATA_AUTHORITY_AUDIT.md
- docs/storefront-v1a-price-contract-rehearsal.json
- docs/storefront-v1a-price-contract-browser.json
- docs/storefront-v1a-game-taxonomy-map.json

Pre-existing promotion/audit worktree changes remain separate. Dependency versions and production settings are unchanged.

Final migration SHA-256: `5710AED7BE3AC17FA6D1D34728104C30E92845AB6225890DC766CEDF05844EC1`. Final repeat after the profile visibility guard passed. Browser rerun passed after restarting local servers against the final build; an earlier stale-server asset run was discarded.

No remaining transition implementation or rehearsal blockers. Production application remains explicitly deferred. **STOREFRONT V1A TRANSITION READY**.
