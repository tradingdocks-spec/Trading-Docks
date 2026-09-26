# STOREFRONT V1A Data Authority Audit

## Production application — 2026-09-26

The owner authorized production promotion. Both reviewed SQL files were applied successfully in order through Supabase migration tooling. The service recorded execution versions `20260926041555` (storefront_v1a_forward_only; reviewed file 20260925194250) and `20260926041601` (storefront_v1a_legacy_transition_guarded; reviewed file 20260926025045). These are the same reviewed SQL, not additional migrations. Do not reapply based solely on filename/history timestamp differences.

Production postconditions: 1,454 listings, 1,452 enabled, 2 PRICE_REQUIRED, 1,454 unique inventory links and Magic mappings; all published prices match the preflight inventory_value snapshot. Full inventory/event/position fingerprints and 1,515 rows / 1,775 units / 1,566 events are unchanged. The actual public RPC returns 1,452 unique Magic products with positive prices. Legacy profile and function remain intact. PR #137, POS and Square are unchanged. Application promotion and final verification are tracked in STOREFRONT_V1A_RELEASE.md.


## Approved resolution — 2026-09-26

**DATA AUTHORITY RESOLVED** under the owner's explicit listing-snapshot contract. The historical audit below describes the evidence and the earlier unresolved decision; its hold recommendations are superseded by this approval.

The migration now snapshots the current production-rendered inventory_value into storefront_listings.storefront_listing_price. This is storefront-controlled sale pricing, not inventory asking-price authority. No asking-price backfill or inventory/event writes occur. Subsequent asking/market/valuation/cost changes do not alter a listing snapshot.

- All 1,454 listings are migrated with preserved inventory/workspace links.
- 1,452 positive-price listings are publishable and retain exact customer-visible prices.
- Sultai Charm KTK #204 retains $0.24; Serra Angel W16 #3 retains $0.48; Prodigy's Prototype NEO #231 retains $1.60. The conflicting inventory asking values remain untouched.
- Aegar MUL #31 (inventory chaos-c60a727e2c9640d4be78e8819f46c042-d3205ae6908c4537; listing ca892505-bc12-32f0-ba4f-edb3fcef7158) and Shark Shredder TMT #320 (inventory chaos-3995102bbeb4450dbd3171836055c969-529c7240d437478d; listing 00b9180e-6955-a226-ed84-484d2c460b83) retain zero snapshots but are disabled and PRICE_REQUIRED. Neither appears publicly or in cart revalidation.
- The eight-game mapping is implemented consistently in the forward catalog. All 1,454 records remain Magic; no blanket Other fallback remains.
- Recovery database checks passed 55/55. Both V1A routes passed at desktop, 390px and 320px widths with exact conflict prices, cart revalidation and no blocking browser errors. Inventory/event fingerprints match production.
- An explicit server-only legacy read mode preserves both URLs without inventory writes or re-enabling legacy commerce. Production remains unchanged.

Exact current migration, field semantics, rollback, validation and file list: [Production transition report](STOREFRONT_V1A_PRODUCTION_TRANSITION.md).

## Historical audit evidence (before approval)

Status: **Historical pre-approval outcome: blocked**

Audit date: 2026-09-26 UTC. Read-only production inspection; documentation and audit evidence only.
No production writes, migration application, deployment, merge, PR #137 changes, inventory changes, POS enablement, or Square enablement were performed.

## Decision

Current production storefront price authority is the legacy RPC's `public_price`, which resolves to **inventory_items.inventory_value for all 1,454 eligible products**. It is not asking_price. Production HTML independently confirms all three conflicts and both zero-price records.

The reviewed V1A contract requires explicit asking_price. These are different contracts: 1,451 products have no asking price; the other three have asking prices different from today's display. The audit resolves what the software does, but does not establish merchant approval to use inventory valuation as a sell price or to replace existing asking prices.

A deterministic transition **can preserve all 1,454 current prices and Magic labels without writing inventory**, through an explicitly approved storefront price snapshot or scoped compatibility resolver. That requires a new reviewed forward change to the price contract and game resolver, followed by rehearsal. It is not supported by the unchanged V1A migration. No option was selected or applied in this audit.

Remaining decisions: approve a storefront price authority, decide whether the two already-visible $0.00 prices are intentionally preserved, and explicitly resolve or preserve the three conflicts. The taxonomy fix is specified below but not installed.

## Scope and evidence

- Production Supabase project: `bohddnajlnmknngzjsjk`.
- Profile: `d6bffb23-850f-4fe3-926d-fb1344bdc4ca`.
- Workspace: `4e775109-9f6f-4264-88c8-2c3c5b944a9b`.
- Owner: `3ea45327-7984-4108-ada8-511748e73fd8`.
- Slug: `trading-docks`; enabled and show_prices are true; minimum_price is null.
- Population: 1,454 distinct eligible inventory IDs, not a legacy listing table.
- Source revision inspected: `6f8af6c49a66ee15ffe2eabd03b99b42614a21c6` (origin/main baseline), plus the reviewed V1A transplant.
- Live SQL definition and server-rendered production HTML were checked, rather than assuming local V1A code was deployed.
- [Per-product authority manifest](storefront-v1a-data-authority-records.csv): 1,454 unique IDs with observed source values, classification, proposed game mapping and row timestamps. Blank CSV price cells mean NULL, never zero.
- [Proposed complete game mapping](storefront-v1a-game-taxonomy-map.json).
- [Earlier transition mapping and rehearsal](STOREFRONT_V1A_PRODUCTION_TRANSITION.md) remains blocked; this audit does not supersede its migration guard.

Production HTTP checks used GET without executing browser JavaScript, avoiding the legacy component's automatic analytics POST. No customer request, reservation, payment or sale was created. HTML verification is a targeted read-only check, not a claim of rerunning desktop/mobile acceptance.

## Price coverage: all 1,454 products

“Legacy price” below means the actual non-null value produced by the live public query, including existing zero values.

| Classification | Count |
| --- | ---: |
| Legacy price only | 1,451 |
| Asking price only | 0 |
| Both, equal | 0 |
| Both, different | 3 |
| Neither | 0 |
| Total | 1,454 |

All 1,454 have non-null inventory_value; 1,452 are positive and 2 are zero; none is negative. Exactly 3 have asking_price. All 1,454 have NULL market_price and label_price. None has data.marketPrice or any other price/value/cost/override key in inventory JSON; its only matching provenance key is source, uniformly chaos_sort.

### Available sources inspected

The public schema column catalog was surveyed for price, value, cost and override fields, followed by inventory-owner/item joins for relevant sources.

| Source | Relevant products / records | Finding |
| --- | --- | --- |
| inventory_items.inventory_value | 1,454 / 1,454 | Supplies every current public price |
| inventory_items.asking_price | 3 / 3 | Explicit current asking values, all conflict |
| inventory_items.market_price | 0 populated | Not used by the legacy storefront |
| inventory_items.label_price | 0 populated | Not used by either catalog query |
| inventory_items.data.marketPrice and other JSON price/override keys | 0 populated | Legacy JSON fallback is not exercised by this population |
| inventory_price_reviews.current_asking_price / proposed_asking_price / market_price | 0 / 0 | Entire production table empty; no pending or approved review establishes an alternative |
| selling_listing_candidates.listing_price / market_price / cost_basis | 0 / 0 | Entire table empty |
| selling_marketplace_listings.price | 0 / 0 | Entire table empty; live column is price |
| marketplace_listing_mappings.last_seen_price / raw_snapshot | 0 linked products | 382 records globally, none linked to this owner's eligible IDs |
| showcase_request_items.unit_price_snapshot | 0 / 0 | Entire table empty |
| chaos_sort_items.market_price | 0 / 0 | Entire table empty; no retained per-item recognition price |
| chaos_scan_captures.item.marketPrice | 0 applicable | One global capture, blank card name, no Scryfall ID and NULL marketPrice |
| chaos_sort_batches.estimated_market_value / acquisition_cost | Batch-level | Aggregate valuation/cost, not a per-listing sell price; cannot allocate without a new rule |
| inventory_events value/cost fields | Historical | Conflict histories contain creation and quantity events, no asking-price edit event or approved price reconciliation |
| pos_sale_items.unit_price_minor / snapshot.priceSource | 3 products / 7 historical rows | $1.00, $0.25 and $0.50 respectively; priceSource is asking_price |
| marketplace_order_items.unit_price / unit_cost | 0 linked products | Historical transaction prices are not current listing authority |
| purchase_inventory_links.cost_basis | 0 linked products | Cost basis is not sell price |
| inventory_label_identities.data | 0 price/value/cost/override keys on linked identities | No alternate label override found |
| tcgplayer_magic_catalog market/low/marketplace fields | 0 products linked by tcgplayer_product_id | 799,149 catalog rows globally; market evidence, not an approved sell price |

Catalog discovery by case-insensitive exact product name plus collector number found no candidates for 111 products and multiple candidates for 1,343; no unique candidates. This is deliberately a broad candidate search, not a validated printing/condition/finish match. It does not establish that further provider resolution is impossible. No catalog value was selected, averaged, or copied. Scryfall IDs exist on all 1,454 items, but fetching new external quotes would create market observations, not establish existing approved sell prices.

Subscription prices, buylist purchase offers, collection/trade values, acquisition costs and historical sale overrides are not inputs to the current public storefront. No hidden current per-item sell-price override was found in the inspected inventory, review, listing or label sources. Historical POS evidence was read only; no POS settings or operations were changed.

### Valuation semantics are a material risk

The importer in `202609070002_fix_chaos_sort_commit_order.sql` calculates inventory_value as marketPrice multiplied by item_quantity and adds values when combining inventory. Collection movement/removal code prorates that value by quantity. Thus the same column is treated as a total valuation by inventory workflows but as a unit price by the legacy storefront.

This is evidence of a semantic mismatch, not permission to divide by quantity or correct prices. The provenance data does not prove a merchant approved the displayed scalar as a sell price. Preserving the scalar exactly and approving it for future sales are separate decisions. A live compatibility read can continue to change displayed prices when valuation changes; a snapshot avoids that drift but needs explicit future price-editing ownership.

## Current production route → query → field → display

1. `GET /s/trading-docks?q=...` resolves `src/app/s/[storeSlug]/page.tsx`.
2. The origin/main version invokes `getShowcase(slug, q)` in `src/lib/showcase.ts`.
3. It selects enabled `showcase_profiles` by slug and calls `get_public_showcase_inventory(requested_slug, search_query, 48, 0)`.
4. The live RPC joins profile → workspace → inventory by workspace owner. It requires quantity > 0 and excludes private/excludedFromShowcase rows; optional minimum_price uses the same public price expression.
5. Its exact price expression is:

```sql
greatest(
  0,
  coalesce(nullif(i.data->>'marketPrice', '')::numeric, i.inventory_value, 0)
) as public_price
```

6. The legacy `ShowcasePublicExperience.tsx` renders `profile.show_prices ? money(card.public_price) : "Ask in store"`. The money function formats finite JavaScript numbers as USD; otherwise it renders “Price on request”. There is no asking-price substitution.
7. HTTP HTML for the conflict rows contains the numeric dollar prices in the table below, not “Price on request”. The cart display also uses public_price.

The SQL expression contains an existing zero fallback. It was not introduced or authorized by this audit. It is not used for a missing source in this population: even the two zero rows have stored inventory_value = 0.00.

Current `https://www.tradingdocks.com/s/trading-docks` is HTTP 200. Current `https://www.tradingdocks.com/shop` is HTTP 404, reconfirmed here. Future cutover must retain these exact paths and make /shop the intended alias; do not claim it already works in legacy production or change the slug.

A live 15-page SQL RPC traversal returned 1,454 rows but only 1,452 distinct IDs because the legacy ORDER BY lacks an ID tie-breaker. Every returned price matched inventory_value and every game was Magic. Therefore the audit manifest and population counts use the underlying eligibility predicate and unique IDs, not OFFSET pagination. A migration/export must use a stable ID order and fail duplicate/missing identity checks.

## Exact three conflicts

Legacy public_id is the inventory ID below; there is no separate legacy listing ID. Current V1A production listings do not exist.

| Card identity | Product / legacy public ID | Legacy RPC price | Asking price | Production rendered price |
| --- | --- | ---: | ---: | ---: |
| Sultai Charm — KTK #204, NM, normal | chaos-00790698e8b0403d92517d5458d21c29-000aead89e5c49c7 | $0.24 | $1.00 | $0.24 |
| Serra Angel — W16 #3, NM, normal | chaos-4a2bfbcd52ea4bcf910742ffaebf7da9-59f0584f58c846cd | $0.48 | $0.25 | $0.48 |
| Prodigy's Prototype — NEO #231, NM, normal | chaos-62e742fa4f174ec995e9c15ce2e7b563-468db788725e4ca6 | $1.60 | $0.50 | $1.60 |

Scryfall identities respectively:
- `993c9028-9b1b-4903-81b2-3cf4f37b7229`
- `8752c1db-b924-4dda-8b71-4c254d0ef2de`
- `be046e0a-6509-450b-b34f-29d5a5e3472e`

Direct GET checks:
- `/s/trading-docks?q=Sultai%20Charm`: KTK #204, $0.24.
- `/s/trading-docks?q=Serra%20Angel`: W16 #3, $0.48; distinguished from DVD #10 and W17 #3.
- `/s/trading-docks?q=Prodigy%27s%20Prototype`: NEO #231, $1.60.

All times below are UTC.

| Card | Inventory created_at | Inventory updated_at | Earliest retained asking-price sale snapshot | Latest snapshot |
| --- | --- | --- | --- | --- |
| Sultai Charm | 2026-09-08 00:27:17.550495 | 2026-09-21 23:51:32.118856 | 2026-09-21 23:50:24.555492 | Same |
| Serra Angel | 2026-09-09 03:02:56.243915 | 2026-09-22 21:53:16.214234 | 2026-09-22 00:07:19.160797 | 2026-09-22 00:23:56.223826 |
| Prodigy's Prototype | 2026-09-09 02:42:02.182775 | 2026-09-22 00:32:46.237703 | 2026-09-22 00:02:54.842939 | 2026-09-22 00:32:46.237703 |

Source of displayed values: current inventory_value, source=chaos_sort, through the live RPC. Source of asking values: inventory_items.asking_price, corroborated by historical snapshots explicitly marked asking_price (1, 2 and 4 sale-item records respectively). These snapshots establish that asking values were used, not that they should replace the public price.

There is no field-specific price_modified_at or retained price-review record. Row updated_at is **not** an asking-price edit timestamp: quantity events explain the latest updates. The exact writer/time of each asking-price assignment and original import quote time cannot be established from this evidence. No automatic reconciliation was performed.

### Existing zero-price records

| ID | Identity | Observed HTML |
| --- | --- | --- |
| chaos-c60a727e2c9640d4be78e8819f46c042-d3205ae6908c4537 | Aegar, the Freezing Flame — MUL #31 | $0.00 |
| chaos-3995102bbeb4450dbd3171836055c969-529c7240d437478d | Shark Shredder, Killer Clone — TMT #320 | $0.00 |

Both asking prices are NULL. Preserving current prices includes these two existing zeros; holding them would reduce visible count to 1,452. This audit neither converts missing prices to zero nor approves selling at zero.

## V1A price contract and concrete option matrix

Reviewed migration: `supabase/migrations/20260925194250_storefront_v1a_forward_only.sql`.

`storefront_listings` has identity, ownership, enabled and timestamps, but **no independent listing-price column**. Both branches of `search_public_storefront_catalog` require non-null, nonnegative inventory_items.asking_price. That value drives minimum price, price filters, sorting, catalog response and cart revalidation. Merely creating 1,454 listing rows cannot make 1,451 unpriced products visible.

The following counts assume the same 1,454 identities, approved profile/listing creation and the game mapping fix. They are projections, not applied changes.

| Option | Exact effect | Required data/code change | Customer-visible effect | Risk / inventory authority |
| --- | --- | --- | --- | --- |
| A. Preserve current storefront prices exactly in a storefront-owned snapshot | 1,454 snapshots; 1,451 missing asking values remain missing; 3 asking conflicts remain untouched | New forward schema/read contract for explicit storefront price + source + captured_at, or equivalent approved manifest; no inventory writes | 1,454 products, 0 changed displayed prices, including 2 existing zeros | Best point-in-time parity and price provenance; new editing/staleness policy required. Quantity authority remains inventory/positions |
| B. Require explicit asking price / hold missing sell prices | Hold 1,451; retain 3 priced products | No asking-price backfill; create only approved eligible listings; taxonomy fix | 1,451 disappear; all 3 remaining prices change: +$0.76, -$0.23, -$1.10 | Matches reviewed V1A contract but does not preserve current storefront. No inventory writes. Holding conflicts too yields 0 visible products pending approval |
| C1. Deterministic asking-first fallback | 1,451 use legacy values; 3 use asking | Approved explicit resolver shared by listing eligibility, sorting, filters, detail/cart revalidation | 1,454 visible; 3 changed prices | Not parity-preserving; cannot silently treat legacy valuation as an approved fallback. No inventory writes |
| C2. Scoped legacy-first compatibility / dual read | 1,454 migrated IDs use legacy price; 0 asking prices win in this population | Versioned cohort/provenance rule; one price resolver; deduplicate by workspace + owner + inventory ID; use V1A quantity authority | 1,454 visible; 0 immediate changes | Preserves current dynamic behavior, including valuation drift and 2 zeros. Temporary mode needs exit rule and precedence; no inventory writes |
| D1. Backfill only missing asking from legacy | Update 1,451 asking fields; leave 3 conflicts | Explicit future inventory metadata-write approval + guarded backfill + audit history | 1,454 visible; 3 price changes remain | Changes shared price metadata used by labels and other consumers; quantity/event authority must remain untouched. Not authorized here |
| D2. Backfill/overwrite all asking to preserve legacy | Update 1,454 asking fields, including 3 overwrites | Explicit future approval for 1,451 fills, 3 reconciliations and 2 zero values | 1,454 visible; 0 public price changes | Overwrites previously used asking values and changes shared inventory metadata; largest cross-feature impact |
| Hold unknown/missing sell prices and preserve unresolved conflicts unpublished | 1,451 missing + 3 conflicted held | No pricing data changes | 0 visible products until decisions | Safe ambiguity gate, but cannot satisfy continuity |

For D, “listing price” refers to the derived legacy public_price, not a nonexistent stored legacy listing column. Neither D variant is permitted by the current read-only instruction. Changing asking_price changes inventory metadata even when quantity is unchanged. The absence of physical inventory changes would not make such a backfill authorized.

Evidence-based recommendation for review: if the objective is exact current customer-price preservation with no inventory writes, evaluate **A** first and **C2** only if continuing legacy valuation-driven price changes is intentional. B is the unchanged V1A contract but fails continuity. D introduces shared-data changes without resolving the underlying valuation semantics. No final policy choice is made here.

Any future resolver must apply identically to eligibility, minimum/maximum filters, sorting, catalog, detail, cart and refresh/revalidation. Require provenance and explicit handling of zero, NULL, negative, conflicting and newly added records. Fail on unknown values; never silently substitute market prices or zero.

## Game taxonomy: exact cause and prepared correction

This is not a database enum rejection. V1A returns a text game label. The application's core `SupportedGameId` TypeScript union contains magic, pokemon, yu-gi-oh, flesh-and-blood and digimon.

Legacy RPC:
```sql
coalesce(nullif(i.data->>'game', ''), 'Magic: The Gathering')
```

All 1,454 rows lack game_id and JSON game/game_id/gameName. All have Scryfall IDs. Their linked batch sessions say **mixed**, not Magic; session game must not be used as per-card taxonomy evidence.

V1A position mapper:
```sql
coalesce(
  case coalesce(nullif(i.game_id, ''), i.data->>'game_id')
    when 'magic' then 'Magic: The Gathering'
    when 'pokemon' then 'Pokémon'
    when 'yu-gi-oh' then 'Yu-Gi-Oh!'
    when 'flesh-and-blood' then 'Flesh and Blood'
    when 'digimon' then 'Digimon'
  end,
  nullif(i.data->>'game', ''),
  nullif(i.data->>'gameName', ''),
  'Other'
)
```

The aggregate branch instead returns JSON game/gameName or raw i.game_id, then Other. It does not even apply the same five-ID mapping. Consequently the same underlying game can split facets by raw ID, display spelling, accent, or branch. For this population all inputs are absent, so all 1,454 would become Other if admitted by price eligibility.

### Deterministic mapping specification (prepared, not applied)

Normalize strings with Unicode NFKC, trim, collapse whitespace and lowercase, then match complete aliases. Do not use substring matches. The JSON companion is the executable mapping data.

| Canonical ID | Public label | Accepted aliases (case-insensitive) | Existing capability status |
| --- | --- | --- | --- |
| magic | Magic: The Gathering | magic; mtg; magic: the gathering; magic-the-gathering | Core production |
| pokemon | Pokémon | pokemon; pokémon; ptcg; pkm | Core beta; reconciles core “Pokemon” with V1A/market accent |
| yu-gi-oh | Yu-Gi-Oh! | yu-gi-oh; yu-gi-oh!; yugioh; ygo | Core planned |
| flesh-and-blood | Flesh and Blood | flesh-and-blood; flesh and blood; fab | Core planned |
| digimon | Digimon | digimon | Core planned |
| pokemon-japan | Pokémon Japan | pokemon-japan; pokemon japan; pokémon japan | Market/card-show; keep regional identity distinct |
| lorcana | Disney Lorcana | lorcana; disney-lorcana; disney lorcana | Market/card-show |
| one-piece | One Piece | one-piece; one-piece-card-game; one piece; one piece card game | Market/card-show |

Sources audited: `src/lib/multi-tcg/registry.ts`, `src/lib/card-show-games.ts`, `src/lib/market-engine/types.ts`, `src/lib/market-engine/index.ts`, artwork provider game IDs and `src/lib/tcgcsv/client.ts` category names. The broader market/card-show union is covered without pretending it enables planned inventory/provider capabilities.

Resolver rules:
1. Resolve all explicit inventory and JSON game identifiers/labels using the table. If nonempty values disagree or are unknown, classify ambiguous and block publication.
2. If no explicit values exist, only the exact audited legacy manifest cohort may preserve its observed legacy Magic label as canonical magic. Require matching workspace, owner, inventory ID and retained Scryfall identity, with no contradictory game evidence. This is provenance-based preservation of a known public label, not a universal missing-value default.
3. For this manifest, the result is 1,454 magic / Magic: The Gathering; 0 Other; 0 ambiguous public-label mappings. This does not constitute a fresh provider verification of every Scryfall ID.
4. Missing metadata outside the manifest, “mixed”, “Other” and unknown games must remain unresolved and block publication. Do not infer a card's game from a mixed batch.
5. Use the same canonicalization for active-position and aggregate rows, excluded-games settings, facets, search filters and cart responses. Preserve capability gating separately from label mapping.
6. Do not update inventory game fields in this read-only task. A future forward RPC/resolver change can map at read time without editing already-reviewed migrations.

The prepared mapping is deterministic; the deployed/ reviewed runtime remains unfixed until a separate approved implementation and validation.

## Reproducible population and coverage query

Read only; do not replace these SELECTs with writes:

```sql
with eligible as (
  select i.*,
    greatest(0, coalesce(nullif(i.data->>'marketPrice','')::numeric,
                         i.inventory_value, 0)) as legacy_price
  from public.showcase_profiles p
  join public.workspaces w on w.id = p.workspace_id
  join public.inventory_items i on i.user_id = w.owner_id
  where p.slug = 'trading-docks' and p.enabled and i.quantity > 0
    and not coalesce(i.data->>'private','false')::boolean
    and not coalesce(i.data->>'excludedFromShowcase','false')::boolean
    and (p.minimum_price is null or
      greatest(0, coalesce(nullif(i.data->>'marketPrice','')::numeric,
                           i.inventory_value, 0)) >= p.minimum_price)
)
select count(*) as total,
  count(*) filter (where legacy_price is not null and asking_price is null) as legacy_only,
  count(*) filter (where legacy_price is null and asking_price is not null) as asking_only,
  count(*) filter (where legacy_price = asking_price) as both_equal,
  count(*) filter (where legacy_price <> asking_price) as both_different,
  count(*) filter (where legacy_price is null and asking_price is null) as neither
from eligible;
```

Because the existing RPC always coalesces a price, also audit raw source NULL/zero coverage; a zero result alone cannot prove an explicit sell price. This audit did both.

## Validation and production safety

- Fresh read-only SQL: 1,454 unique eligible records; categories sum to 1,454; source coverage and three conflicts confirmed.
- HTTP GET: all three conflict cards and both existing zero-price cards confirmed in rendered HTML; /s/trading-docks HTTP 200; /shop HTTP 404.
- Mapping artifact: 33 assertions passed, covering 26 aliases across eight identities, unknown/conflicting inputs and consistent Magic aliases. All 1,454 manifest price/game mappings and unique IDs passed validation. Repository diff check passed; the three new audit files also passed trailing-whitespace checks.
- No application code or migration was edited by this audit. Full build/root-suite rerun is not required for documentation/evidence-only work.
- Production inventory: **1,515 rows / 1,775 units / 1,566 events**, unchanged from the preceding transition audit. These are production counts, not staging's 10,042 / 109,146 / 4,807.
- Final full-row fingerprints match both the earlier transition baseline and this audit's prior read:
  - inventory: `0fef56d528f9b9bb3d83c397935b2891`
  - inventory events: `85a8820f5ea75430c3440a60f0ff8093`
  - positions: `b1f2188986662e4ac941542ad5f3377b`
  - showcase profiles: `5be86f73004ed09192f0987174d8791f`
- No production fixtures, profile/listing changes, environment changes, PR operations, POS/Square configuration changes, deployment or merge.

Files added for this audit:
1. `docs/STOREFRONT_V1A_DATA_AUTHORITY_AUDIT.md`
2. `docs/storefront-v1a-data-authority-records.csv`
3. `docs/storefront-v1a-game-taxonomy-map.json`

Pre-existing promotion/transition worktree changes were left intact. No new migration SQL is applied or revised here.

**Historical pre-approval outcome: blocked** — current production behavior is established, but merchant price-authority approval is unresolved. The unchanged V1A asking-price contract cannot preserve all 1,454 products and their displayed prices. Exact parity is technically achievable through an approved storefront-only price policy and the prepared taxonomy correction; it must not be inferred or silently applied.
