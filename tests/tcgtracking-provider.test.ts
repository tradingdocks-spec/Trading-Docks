import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TcgTrackingClient,
  TcgTrackingProviderError,
  classifyTcgTrackingCatalogReadiness,
  chooseExactProductImage,
  liquidityLabel,
  mappingRowFromTcgTrackingProduct,
  marketSnapshotFromTcgTracking,
  normalizeTcgTrackingScanManifest,
  normalizePriceSnapshot,
  normalizeProduct,
  normalizeScanCandidate,
  normalizeSealedProduct,
  normalizeSku,
  reconcileTcgTrackingProduct,
  reconcileTcgTrackingWithLocalCatalog,
  loadTcgTrackingLocalCatalogStatus,
  runTcgTrackingCatalogReconciliation,
  scannerAdapterResult,
  serializeSupabaseError,
  skuPriceSnapshotRow,
  spreadPercent,
  summarizeCatalogReconciliation,
  summarizeImageReliability,
  summarizePricingDeltas,
  summarizeTcgTrackingScanBenchmark,
  TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_SAMPLE_SIZE,
  TCGTRACKING_CATALOG_RECONCILIATION_MAX_SAMPLE_SIZE,
  TCGTRACKING_CACHE_TABLE_PROPOSAL,
  TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS,
  TCGTRACKING_LOCAL_CATALOG_SKU_QUERY_CHUNK_SIZE,
  tcgTrackingCachePolicy,
} from "../src/lib/providers/tcgtracking/index.ts";
import {
  resolveExactProductImageUrl,
  tcgTrackingProductImageUrl,
} from "../src/lib/card-image-authority.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("TCGTracking client parses meta categories products SKUs pricing and sealed payloads", async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith("/meta")) return json({ version: "v1", generated_at: "2026-08-11T00:00:00Z" });
    if (url.endsWith("/categories")) return json({ categories: [{ id: 1, name: "Magic: The Gathering" }] });
    if (url.endsWith("/1/sets")) return json({ sets: [{ id: 123, name: "Innistrad: Midnight Hunt", abbreviation: "MID" }] });
    if (url.endsWith("/1/sets/mid/cards")) return json({ cards: [providerProduct()] });
    if (url.endsWith("/1/sets/mid/skus")) return json({ skus: [providerSku()] });
    if (url.endsWith("/1/sets/mid/pricing")) return json({ pricing: [providerSku()] });
    if (url.endsWith("/1/sets/mid/sealed")) return json({ products: [{ ...providerProduct(), product_type: "Bundle" }] });
    if (url.endsWith("/products/456789")) return json({ success: true, product: providerProduct() });
    return json({}, { status: 404 });
  };

  const client = new TcgTrackingClient({ fetch: fetcher as typeof fetch, retries: 0 });
  assert.equal((await client.meta()).version, "v1");
  assert.equal((await client.categories())[0]?.id, "1");
  assert.equal((await client.sets("magic"))[0]?.abbreviation, "MID");
  assert.equal((await client.cards("magic", "mid"))[0]?.tcgplayerProductId, 456789);
  assert.equal((await client.skus("magic", "mid"))[0]?.tcgplayerSkuId, 987654);
  assert.equal((await client.pricing("magic", "mid"))[0]?.tcgMarket, 5.41);
  assert.equal((await client.sealed("magic", "mid"))[0]?.productType, "Bundle");
  assert.equal((await client.product("456789"))?.tcgplayerProductId, 456789);
});

test("TCGTracking normalization rejects malformed payloads and unsafe image URLs", () => {
  assert.equal(normalizeProduct({ id: "", name: "" }, "magic"), null);
  assert.equal(normalizeSku({ product_id: "p1" }), null);
  assert.equal(normalizeSealedProduct(null, "magic"), null);
  assert.equal(normalizeScanCandidate({ name: "No IDs", confidence: 99 }), null);

  const product = normalizeProduct(
    { ...providerProduct(), image_url: "javascript:alert(1)" },
    "magic",
  );
  assert.equal(product?.imageUrl, undefined);
});

test("TCGTracking client flattens compact live SKU and pricing maps", async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith("/1/sets/2708/skus")) {
      return json({
        set_id: 2708,
        updated: "2026-08-11T13:35:40-04:00",
        products: {
          "226694": {
            "4537779": {
              cnd: "NM",
              var: "Foil",
              var_a: "F",
              vid: 2,
              lng: "EN",
              mkt: 1.72,
              low: 0.91,
              hi: 3.5,
              cnt: 25,
              mp: 1.44,
            },
          },
        },
      });
    }
    if (url.endsWith("/1/sets/2708/pricing")) {
      return json({
        updated: "2026-08-11T13:35:39-04:00",
        prices: {
          "226694": {
            tcg: {
              Normal: { low: 0.38, market: 0.7 },
              Foil: { low: 0.91, market: 1.72 },
            },
            manapool: { normal: 0.65, foil: 1.44 },
            mp_qty: 81,
          },
        },
      });
    }
    return json({}, { status: 404 });
  };

  const client = new TcgTrackingClient({ fetch: fetcher as typeof fetch, retries: 0 });
  const [sku] = await client.skus("Magic: The Gathering", "2708");
  assert.equal(sku?.providerProductId, "226694");
  assert.equal(sku?.tcgplayerProductId, 226694);
  assert.equal(sku?.providerSkuId, "4537779");
  assert.equal(sku?.tcgplayerSkuId, 4537779);
  assert.equal(sku?.condition, "NM");
  assert.equal(sku?.variant, "Foil");
  assert.equal(sku?.marketPrice, 1.72);
  assert.equal(sku?.manapoolLow, 1.44);

  const pricing = await client.pricing("mtg", "2708");
  assert.equal(pricing.length, 2);
  const foil = pricing.find((snapshot) => snapshot.providerSkuId === "226694:Foil");
  assert.equal(foil?.tcgMarket, 1.72);
  assert.equal(foil?.tcgLow, 0.91);
  assert.equal(foil?.manapoolLow, 1.44);
  assert.equal(foil?.activeListings, 81);
});

test("TCGTracking client surfaces HTML provider responses as structured non-JSON errors", async () => {
  const client = new TcgTrackingClient({
    retries: 0,
    fetch: (async () =>
      new Response("<!DOCTYPE html><h1>Oops! Something Went Wrong</h1>", {
        status: 404,
        headers: { "content-type": "text/html" },
      })) as typeof fetch,
  });

  await assert.rejects(
    () => client.cards("1", "MID"),
    (error) => {
      assert.equal(error instanceof TcgTrackingProviderError, true);
      const providerError = error as TcgTrackingProviderError;
      assert.equal(providerError.status, 404);
      assert.equal(providerError.contentType, "text/html");
      assert.match(providerError.url ?? "", /\/v1\/1\/sets\/MID\/cards$/);
      assert.match(providerError.bodyPreview ?? "", /Oops! Something Went Wrong/);
      assert.match(providerError.message, /HTTP 404/);
      return true;
    },
  );
});

test("TCGTracking provider auth remains optional when no API key is configured", async () => {
  const original = process.env.TCGTRACKING_API_KEY;
  delete process.env.TCGTRACKING_API_KEY;
  try {
    const client = new TcgTrackingClient({
      retries: 0,
      fetch: (async (_url, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.has("authorization"), false);
        return json({ categories: [{ id: 1, name: "Magic: The Gathering" }] });
      }) as typeof fetch,
    });

    assert.equal((await client.categories())[0]?.id, "1");
  } finally {
    if (original == null) {
      delete process.env.TCGTRACKING_API_KEY;
    } else {
      process.env.TCGTRACKING_API_KEY = original;
    }
  }
});

test("TCGTracking identity reconciliation preserves local catalog authority and reports conflicts", () => {
  const local = {
    tcgplayer_id: 456789,
    set_name: "Innistrad: Midnight Hunt",
    product_name: "Unblinking Observer",
    collector_number: "82",
    condition: "Near Mint",
    finish: "Normal",
  };
  const product = normalizeProduct(providerProduct(), "magic");
  const sku = normalizeSku(providerSku());
  assert.ok(product);
  assert.ok(sku);

  const matched = reconcileTcgTrackingWithLocalCatalog({ local, product, sku });
  assert.equal(matched.status, "matched");
  assert.equal(matched.product?.tcgplayerProductId, 456789);
  assert.equal(matched.sku?.tcgplayerSkuId, 987654);

  const conflict = reconcileTcgTrackingWithLocalCatalog({
    local: { ...local, collector_number: "999" },
    product,
    sku,
  });
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.conflicts.some((entry) => entry.field === "collectorNumber"), true);
});

test("TCGTracking market snapshots use explicit formulas and stale-cache behavior", () => {
  const snapshot = normalizePriceSnapshot(providerSku());
  assert.ok(snapshot);
  const market = marketSnapshotFromTcgTracking(
    snapshot,
    new Date("2026-08-11T13:00:00.000Z"),
  );
  assert.equal(market.freshness, "fresh");
  assert.equal(market.spreadPercent, 9.61);
  assert.equal(spreadPercent(5.41, 4.89), 9.61);
  assert.equal(market.crossMarketSpread, 0.17);
  assert.equal(liquidityLabel(84), "high");
  assert.equal(liquidityLabel(20), "medium");
  assert.equal(liquidityLabel(2), "low");

  const stale = marketSnapshotFromTcgTracking(
    { ...snapshot, updatedAt: "2026-08-01T00:00:00.000Z" },
    new Date("2026-08-11T13:00:00.000Z"),
  );
  assert.equal(stale.freshness, "stale");
});

test("TCGTracking scanner adapter returns candidates without creating inventory on ambiguity", () => {
  const result = scannerAdapterResult({
    provider: "tcgtracking",
    status: "matched",
    candidates: [
      {
        tcgplayerProductId: 456789,
        confidence: 0.82,
        name: "Unblinking Observer",
        metadata: {},
      },
    ],
  });
  assert.equal(result.status, "candidates");
  assert.equal(result.candidates[0]?.requiresConfirmation, true);
  assert.equal(result.candidates[0]?.source, "tcgtracking");

  const failed = scannerAdapterResult({
    provider: "tcgtracking",
    status: "provider_failed",
    candidates: [],
    error: "timeout",
  });
  assert.equal(failed.status, "provider_failed");
  assert.equal(failed.candidates.length, 0);
});

test("TCGTracking scan client parses candidate wrappers and timeout failures", async () => {
  const okClient = new TcgTrackingClient({
    retries: 0,
    fetch: (async () =>
      json({
        candidates: [
          {
            tcgplayer_product_id: 456789,
            confidence: 88,
            product_name: "Unblinking Observer",
          },
        ],
      })) as typeof fetch,
  });
  const result = await okClient.scanCardImage({ image: "base64-image", category: "magic" });
  assert.equal(result.status, "matched");
  assert.equal(result.candidates[0]?.confidence, 0.88);

  const failedClient = new TcgTrackingClient({
    retries: 0,
    timeoutMs: 1,
    fetch: (async () => {
      throw new Error("network down");
    }) as typeof fetch,
  });
  assert.equal((await failedClient.scanCardImage({ image: "x" })).status, "provider_failed");
});

test("TCGTracking cache proposal is non-authoritative and reuses existing catalog authority", () => {
  assert.equal(tcgTrackingCachePolicy().staticDataTtlDays, 7);
  assert.equal(tcgTrackingCachePolicy().pricingTtlHours, 24);
  assert.equal(TCGTRACKING_CACHE_TABLE_PROPOSAL.every((table) => table.authoritative === false), true);
  assert.equal(TCGTRACKING_CACHE_TABLE_PROPOSAL.some((table) => table.table === "tcgtracking_product_mappings"), true);
  assert.equal(TCGTRACKING_CACHE_TABLE_PROPOSAL.some((table) => table.table === "tcgtracking_products"), false);
});

test("TCGTracking image priority prefers existing Trading Docks image before provider fallback", () => {
  assert.equal(
    chooseExactProductImage({
      tradingDocksImageUrl: "https://images.tradingdocks.test/card.jpg",
      tcgTrackingImageUrl: "https://cdn.tcgtracking.test/card.jpg",
      scryfallFallbackUrl: "https://cards.scryfall.io/card.jpg",
    }),
    "https://images.tradingdocks.test/card.jpg",
  );
  assert.equal(tcgTrackingProductImageUrl(226694), "https://cdn.tcgtracking.com/product/226694_200w.jpg");
  assert.equal(
    resolveExactProductImageUrl({
      knownExactImageUrl: "https://cards.scryfall.io/exact.jpg",
      tcgplayerProductId: 226694,
    }),
    "https://cards.scryfall.io/exact.jpg",
  );
  assert.equal(
    resolveExactProductImageUrl({
      tcgplayerProductId: 226694,
      scryfallFallbackUrl: "https://cards.scryfall.io/fallback.jpg",
    }),
    "https://cdn.tcgtracking.com/product/226694_200w.jpg",
  );
});

test("TCGTracking proposal migration is additive global cache and keeps catalog canonical", () => {
  const migration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608110002_tcgtracking_enrichment_cache_proposal.sql"),
    "utf8",
  );

  assert.match(migration, /create table if not exists public\.tcgtracking_product_mappings/);
  assert.match(migration, /create table if not exists public\.tcgtracking_price_snapshots/);
  assert.match(migration, /create table if not exists public\.tcgtracking_sync_runs/);
  assert.match(migration, /unique \(category_id, tcgplayer_product_id\)/);
  assert.match(migration, /tcgtracking_price_snapshots_product_observed_idx/);
  assert.match(migration, /revoke all on table public\.tcgtracking_product_mappings from anon, authenticated/);
  assert.doesNotMatch(migration, /\bdrop table\b/i);
  assert.doesNotMatch(migration, /\balter table public\.tcgplayer_magic_catalog\b/i);
  assert.doesNotMatch(migration, /\binventory_items\b/);
});

test("TCGTracking mapping and price snapshot models preserve exact SKU identity", () => {
  const product = normalizeProduct(providerProduct(), "magic");
  const sku = normalizeSku(providerSku());
  assert.ok(product);
  assert.ok(sku);

  const mapping = mappingRowFromTcgTrackingProduct(product, "2026-08-11T00:00:00.000Z");
  assert.equal(mapping?.tcgplayer_product_id, 456789);
  assert.equal(mapping?.scryfall_id, "00000000-0000-4000-8000-000000000082");
  assert.equal(mapping?.image_url, "https://cdn.tcgtracking.test/magic/mid/82.jpg");

  const snapshot = skuPriceSnapshotRow({
    tcgplayerProductId: sku.tcgplayerProductId,
    tcgplayerSkuId: sku.tcgplayerSkuId,
    condition: sku.condition,
    finish: sku.variant,
    language: sku.language,
    tcgMarket: sku.marketPrice,
    tcgLow: sku.lowPrice,
    tcgHigh: sku.highPrice,
    activeListings: sku.activeListings,
    manapoolLow: sku.manapoolLow,
    observedAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(snapshot?.tcgplayer_product_id, 456789);
  assert.equal(snapshot?.tcgplayer_sku_id, 987654);
  assert.equal(snapshot?.condition, "Near Mint");
  assert.equal(snapshot?.finish, "Normal");
  assert.equal(snapshot?.language, "English");
  assert.equal(snapshot?.tcg_market, 5.41);
});

test("TCGTracking local reconciliation matches exact SKUs and classifies identity conflicts", () => {
  const product = normalizeProduct(providerProduct(), "magic");
  const exactSku = normalizeSku(providerSku());
  const foilSku = normalizeSku({
    ...providerSku(),
    sku_id: "provider-sku-987655",
    tcgplayer_sku_id: 987655,
    variant: "Foil",
    market_price: 7.5,
    low_price: 6.4,
  });
  assert.ok(product);
  assert.ok(exactSku);
  assert.ok(foilSku);

  const reconciliation = reconcileTcgTrackingProduct({
    providerProduct: product,
    providerSkus: [exactSku, foilSku],
    priceSnapshots: [],
    localRows: [
      {
        tcgplayer_id: 987654,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Normal",
        tcg_market_price: 5.4,
        tcg_low_price: 4.9,
      },
      {
        tcgplayer_id: 111111,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Foil",
        tcg_market_price: 7.42,
        tcg_low_price: 6.38,
      },
    ],
  });

  assert.equal(reconciliation.exactMatches, 1);
  assert.equal(reconciliation.missingLocalSkus, 0);
  assert.equal(reconciliation.missingProviderSkus, 1);
  assert.equal(reconciliation.skuMatches[0]?.matchType, "tcgplayer_sku_id");
  assert.equal(reconciliation.skuMatches[1]?.matchType, "condition_finish");
  assert.equal(
    reconciliation.conflicts.some((conflict) =>
      conflict.type === "identity" &&
      conflict.field === "tcgplayerSkuId"
    ),
    true,
  );
});

test("TCGTracking reconciliation reports pricing deltas as relative percentages", () => {
  const product = normalizeProduct(providerProduct(), "magic");
  const sku = normalizeSku({
    ...providerSku(),
    market_price: 10.5,
    low_price: 8.25,
  });
  assert.ok(product);
  assert.ok(sku);

  const reconciliation = reconcileTcgTrackingProduct({
    providerProduct: product,
    providerSkus: [sku],
    priceSnapshots: [],
    localRows: [
      {
        tcgplayer_id: 987654,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Normal",
        tcg_market_price: 10,
        tcg_low_price: 8,
      },
    ],
  });

  assert.equal(reconciliation.skuMatches[0]?.pricingDelta.market, 0.5);
  assert.equal(reconciliation.skuMatches[0]?.pricingDelta.marketPercent, 5);
  assert.equal(reconciliation.skuMatches[0]?.pricingDelta.lowPercent, 3.13);

  const summary = summarizePricingDeltas([reconciliation]);
  assert.equal(summary.medianMarketDelta, 0.5);
  assert.equal(summary.percentMarketWithinOnePercent, 0);
  assert.equal(summary.percentMarketWithinFivePercent, 100);
  assert.equal(summary.percentLowWithinFivePercent, 100);
  assert.equal(summary.localNullPriceCount, 0);
  assert.equal(summary.providerNullPriceCount, 0);
});

test("TCGTracking catalog reconciliation summarizes exact match readiness and bounded conflicts", () => {
  const product = normalizeProduct(providerProduct(), "magic");
  const exactSku = normalizeSku(providerSku());
  const missingSku = normalizeSku({
    ...providerSku(),
    sku_id: "provider-sku-987655",
    tcgplayer_sku_id: 987655,
    variant: "Foil",
    market_price: "",
    low_price: "",
  });
  assert.ok(product);
  assert.ok(exactSku);
  assert.ok(missingSku);

  const reconciliation = reconcileTcgTrackingProduct({
    providerProduct: product,
    providerSkus: [exactSku, missingSku],
    priceSnapshots: [],
    localRows: [
      {
        tcgplayer_id: 987654,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Normal",
        tcg_market_price: 5.41,
        tcg_low_price: 4.89,
      },
    ],
  });

  const report = summarizeCatalogReconciliation({
    generatedAt: "2026-08-11T00:00:00.000Z",
    sampleSize: 150,
    categoryId: "1",
    reconciliations: [reconciliation],
    localRows: [
      {
        tcgplayer_id: 987654,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Normal",
        tcg_market_price: 5.41,
        tcg_low_price: 4.89,
      },
    ],
    conflictLimit: 1,
  });

  assert.equal(report.productsTested, 1);
  assert.equal(report.providerSkusTested, 2);
  assert.equal(report.localSkuRowsFound, 1);
  assert.equal(report.exactSkuMatches, 1);
  assert.equal(report.missingLocalSkus, 0);
  assert.equal(report.providerOnlySkus, 1);
  assert.equal(report.localCatalogCoverageRate, 100);
  assert.equal(report.providerSkuCoverageRate, 50);
  assert.equal(report.exactSkuMatchRate, 100);
  assert.equal(report.recommendation, "green");
  assert.equal(report.pricingDeltaSummary.providerNullPriceCount, 0);
  assert.equal(TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_SAMPLE_SIZE, 150);
  assert.equal(TCGTRACKING_CATALOG_RECONCILIATION_MAX_SAMPLE_SIZE, 250);
});

test("TCGTracking readiness uses local catalog coverage instead of provider SKU denominator", () => {
  const exactMatches = 1495;
  const providerSkus = 8945;
  const products = Array.from({ length: exactMatches }, (_entry, index) => {
    const id = 1_000_000 + index;
    return reconcileTcgTrackingProduct({
      providerProduct: normalizeProduct({
        ...providerProduct(),
        product_id: `provider-${index}`,
        tcgplayer_product_id: 500_000 + index,
        name: `Sample Card ${index}`,
        collector_number: String(index + 1),
      }, "magic")!,
      providerSkus: [
        normalizeSku({
          ...providerSku(),
          sku_id: `provider-sku-${id}`,
          product_id: `provider-${index}`,
          tcgplayer_sku_id: id,
          tcgplayer_product_id: 500_000 + index,
          market_price: 1.24,
          low_price: 0.92,
        })!,
      ],
      priceSnapshots: [],
      localRows: [
        {
          tcgplayer_id: id,
          set_name: "Innistrad: Midnight Hunt",
          product_name: `Sample Card ${index}`,
          collector_number: String(index + 1),
          condition: "Near Mint",
          finish: "Normal",
          tcg_market_price: 1.23,
          tcg_low_price: 0.99,
        },
      ],
    });
  });
  products[0] = {
    ...products[0]!,
    providerSkuCount: providerSkus - exactMatches + 1,
    providerOnlySkus: providerSkus - exactMatches,
    providerOnlyLanguageVariants: {
      French: 2400,
      German: 1800,
      Japanese: 1400,
      Spanish: 1000,
    },
    skuMatches: [
      ...products[0]!.skuMatches,
      ...Array.from({ length: providerSkus - exactMatches }, (_entry, index) => ({
        providerSkuId: 2_000_000 + index,
        providerProductId: products[0]!.providerProductId ?? undefined,
        condition: "Near Mint",
        finish: "Normal",
        language: index % 2 === 0 ? "FR" : "DE",
        matchType: "provider_only_sku" as const,
        classification: "PROVIDER_ONLY_LANGUAGE_VARIANT" as const,
        pricingDelta: {
          market: null,
          marketPercent: null,
          low: null,
          lowPercent: null,
          manapoolLow: null,
        },
        pricePresence: {
          localMarket: false,
          providerMarket: true,
          localLow: false,
          providerLow: true,
        },
      })),
    ],
  };

  const report = summarizeCatalogReconciliation({
    generatedAt: "2026-08-11T00:00:00.000Z",
    sampleSize: 150,
    categoryId: "1",
    reconciliations: products,
    localRows: products.map((product) => ({
      tcgplayer_id: product.exactMatches ? product.skuMatches[0]!.localTcgplayerId! : 0,
      set_name: "Innistrad: Midnight Hunt",
      product_name: product.productName,
      collector_number: product.collectorNumber,
      condition: "Near Mint",
      finish: "Normal",
      tcg_market_price: 1.23,
      tcg_low_price: 0.99,
    })),
  });

  assert.equal(report.localCatalogCoverageRate, 100);
  assert.equal(report.exactSkuMatches, 1495);
  assert.equal(report.missingLocalSkus, 0);
  assert.equal(report.providerOnlySkus, 7450);
  assert.equal(report.providerSkuCoverageRate, 16.71);
  assert.equal(report.trueConflictCount, 0);
  assert.equal(report.recommendation, "green");
  assert.equal(report.readiness, "GREEN");
  assert.equal(report.conflictBreakdown.language, 0);
  assert.equal(report.providerOnlyLanguageVariants.French, 2400);
  assert.equal(report.pricingDeltaSummary.matchedSkuCount, 1495);
  assert.equal(report.pricingDeltaSummary.medianMarketDelta, 0.01);
  assert.equal(report.pricingDeltaSummary.medianLowDelta, -0.07);
});

test("TCGTracking catalog reconciliation decision gate follows production thresholds", () => {
  const clean = { identity: 0, condition: 0, finish: 0, language: 1, pricing: 0 };
  assert.equal(classifyTcgTrackingCatalogReadiness({
    exactSkuMatchRate: 98,
    conflictBreakdown: clean,
  }), "green");
  assert.equal(classifyTcgTrackingCatalogReadiness({
    exactSkuMatchRate: 96,
    conflictBreakdown: clean,
  }), "yellow");
  assert.equal(classifyTcgTrackingCatalogReadiness({
    exactSkuMatchRate: 99,
    conflictBreakdown: { ...clean, condition: 1 },
  }), "red");
});

test("TCGTracking catalog reconciliation reports transport failure as FAILED not RED", async () => {
  const failed = await runTcgTrackingCatalogReconciliation(
    catalogReadClient([]),
    {
      sampleSize: 150,
      client: {
        sets: async () => [
          {
            id: "2708",
            categoryId: "1",
            name: "Commander Legends",
            abbreviation: "CMR",
          },
        ],
        cards: async () => {
          throw new TcgTrackingProviderError(
            "TCGTracking returned HTTP 404.",
            "/1/sets/MID/cards",
            404,
            {
              url: "https://openapi.tcgtracking.com/v1/1/sets/MID/cards",
              method: "GET",
              contentType: "text/html",
              bodyPreview: "<!DOCTYPE html><h1>Oops! Something Went Wrong</h1>",
            },
          );
        },
        skus: async () => [],
        pricing: async () => [],
      },
    },
  );

  assert.equal(failed.status, "provider_failed");
  assert.equal(failed.readiness, "FAILED");
  assert.equal(failed.recommendation, null);
  assert.equal(failed.productsTested, 0);
  assert.equal(failed.providerSkusTested, 0);
  assert.equal(failed.failure?.stage, "tcgtracking-products");
  assert.equal(failed.failure?.status, 404);
  assert.equal(failed.failure?.contentType, "text/html");
  assert.doesNotMatch(failed.failure?.bodyPreview ?? "", /<h1>/);
});

test("TCGTracking Supabase catalog errors preserve actionable PostgREST details", async () => {
  const serialized = serializeSupabaseError({
    message: "",
    code: "PGRST204",
    details: "Could not find the 'collector_number' column in the schema cache.",
    hint: "Check selected columns.",
    status: 400,
  });

  assert.equal(serialized.message, "Could not find the 'collector_number' column in the schema cache.");
  assert.equal(serialized.code, "PGRST204");
  assert.equal(serialized.details, "Could not find the 'collector_number' column in the schema cache.");
  assert.equal(serialized.hint, "Check selected columns.");
  assert.equal(serialized.status, 400);
  assert.notEqual(serialized.message, "");

  assert.equal(serializeSupabaseError(new Error("")).message, "Supabase catalog read failed.");
  assert.equal(serializeSupabaseError("").message, "Supabase catalog read failed.");
  assert.match(serializeSupabaseError({ reason: "opaque object" }).message, /opaque object/);
});

test("TCGTracking local catalog smoke query validates minimal trusted server reads", async () => {
  const queries: CatalogQueryRecord[] = [];
  const status = await loadTcgTrackingLocalCatalogStatus(
    catalogReadClient([{ tcgplayer_id: 987654 }], { queries }),
    799149,
  );

  assert.equal(status.status, "available");
  assert.equal(status.schema, "ready");
  assert.equal(status.rows, 799149);
  assert.equal(status.sampleRowAvailable, true);
  assert.equal(status.smokeQuery, "tcgplayer_id limit 1");
  assert.equal(status.requestedColumns, TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS);
  assert.deepEqual(queries, [
    { kind: "select", columns: "tcgplayer_id" },
    { kind: "limit", count: 1 },
  ]);
});

test("TCGTracking local catalog smoke failure keeps reconciliation FAILED with DB details", async () => {
  const failed = await runTcgTrackingCatalogReconciliation(
    catalogReadClient([], {
      smokeError: {
        message: "",
        code: "PGRST204",
        details: "Could not find the 'tcgplayer_id' column in the schema cache.",
        hint: "Reload schema cache.",
        status: 400,
      },
    }),
    { sampleSize: 1 },
  );

  assert.equal(failed.status, "catalog_read_failed");
  assert.equal(failed.readiness, "FAILED");
  assert.equal(failed.recommendation, null);
  assert.equal(failed.failure?.stage, "local-catalog-read");
  assert.equal(failed.failure?.table, "tcgplayer_magic_catalog");
  assert.equal(failed.failure?.requestedColumns, "tcgplayer_id");
  assert.equal(failed.failure?.code, "PGRST204");
  assert.match(failed.failure?.details ?? "", /tcgplayer_id/);
  assert.match(failed.failure?.hint ?? "", /Reload schema cache/);
  assert.equal(failed.localCatalog.status, "failed");
  assert.notEqual(failed.error, "");
});

test("TCGTracking local SKU reconciliation chunks catalog reads and keeps exact SKU identity", async () => {
  const skuCount = TCGTRACKING_LOCAL_CATALOG_SKU_QUERY_CHUNK_SIZE * 2 + 1;
  const providerSkus = Array.from({ length: skuCount }, (_entry, index) =>
    normalizeSku({
      ...providerSku(),
      sku_id: `provider-sku-${900000 + index}`,
      tcgplayer_sku_id: 900000 + index,
    }),
  ).filter((sku): sku is NonNullable<typeof sku> => Boolean(sku));
  const localRows = providerSkus.map((sku) => ({
    tcgplayer_id: sku.tcgplayerSkuId,
    set_name: "Innistrad: Midnight Hunt",
    product_name: "Unblinking Observer",
    collector_number: "82",
    condition: "Near Mint",
    finish: "Normal",
    tcg_market_price: 5.41,
    tcg_low_price: 4.89,
  }));
  const queries: CatalogQueryRecord[] = [];

  const completed = await runTcgTrackingCatalogReconciliation(
    catalogReadClient(localRows, { queries }),
    {
      sampleSize: 1,
      client: {
        sets: async () => [
          {
            id: "2708",
            categoryId: "1",
            name: "Innistrad: Midnight Hunt",
            abbreviation: "MID",
          },
        ],
        cards: async () => [normalizeProduct(providerProduct(), "magic")!],
        skus: async () => providerSkus,
        pricing: async () => [],
      },
    },
  );

  const chunkSizes = queries
    .filter((query): query is Extract<CatalogQueryRecord, { kind: "in" }> => query.kind === "in")
    .map((query) => query.valueCount);
  assert.deepEqual(chunkSizes, [500, 500, 1]);
  assert.equal(completed.status, "completed");
  assert.equal(completed.localSkuRowsFound, skuCount);
  assert.equal(completed.exactSkuMatches, skuCount);
  assert.equal(completed.conflictBreakdown.identity, 0);
});

test("TCGTracking local catalog schema contract matches selected read columns", () => {
  const migration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608100003_tcgplayer_magic_catalog.sql"),
    "utf8",
  );
  const selectedColumns = TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS.split(",");

  for (const column of selectedColumns) {
    assert.match(migration, new RegExp(`\\b${column}\\b`));
  }
  assert.match(migration, /tcgplayer_id bigint not null/i);
  assert.match(migration, /unique \(tcgplayer_id\)/i);
  assert.doesNotMatch(TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS, /tcgplayer_product_id/);
  assert.doesNotMatch(TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS, /tcgplayer_sku_id/);
});

test("TCGTracking catalog reconciliation enriches sampled products with parent set metadata", async () => {
  const product = normalizeProduct({
    ...providerProduct(),
    set_name: undefined,
    set_abbr: undefined,
  }, "magic");
  const sku = normalizeSku(providerSku());
  assert.ok(product);
  assert.ok(sku);

  const completed = await runTcgTrackingCatalogReconciliation(
    catalogReadClient([
      {
        tcgplayer_id: 987654,
        set_name: "Innistrad: Midnight Hunt",
        product_name: "Unblinking Observer",
        collector_number: "82",
        condition: "Near Mint",
        finish: "Normal",
        tcg_market_price: 5.41,
        tcg_low_price: 4.89,
      },
    ]),
    {
      sampleSize: 1,
      client: {
        sets: async () => [
          {
            id: "mid",
            categoryId: "1",
            name: "Innistrad: Midnight Hunt",
            abbreviation: "MID",
          },
        ],
        cards: async () => [product],
        skus: async () => [sku],
        pricing: async () => [],
      },
    },
  );

  assert.equal(completed.status, "completed");
  assert.equal(completed.exactSkuMatches, 1);
  assert.equal(completed.localSkuRowsFound, 1);
});

test("TCGTracking catalog reconciliation uses numeric Magic category and provider set IDs", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/lib/providers/tcgtracking/catalog-reconciliation.ts"),
    "utf8",
  );

  assert.match(source, /TCGTRACKING_MAGIC_CATEGORY_ID/);
  assert.match(source, /const setId = set\.id/);
  assert.doesNotMatch(source, /const setId = set\.abbreviation/);
  assert.doesNotMatch(source, /\/magic\//);
});

test("TCGTracking image validation summarizes reliability without source images", () => {
  const summary = summarizeImageReliability([
    {
      url: "https://cdn.tcgtracking.test/card-a.jpg",
      ok: true,
      status: 200,
      contentType: "image/jpeg",
      contentLength: 1234,
      latencyMs: 42,
    },
    {
      url: "https://cdn.tcgtracking.test/card-b.jpg",
      ok: false,
      status: 404,
      contentType: "text/html",
      contentLength: 0,
      latencyMs: 120,
      exactPrintingMismatch: true,
    },
  ]);

  assert.equal(summary.tested, 2);
  assert.equal(summary.successRate, 0.5);
  assert.equal(summary.failures, 1);
  assert.equal(summary.exactPrintingMismatches, 1);
});

test("TCGTracking private scan manifests reject unsafe paths and export no image paths", () => {
  const manifest = normalizeTcgTrackingScanManifest(
    {
      fixtureSetId: "local-magic-fixtures",
      fixtures: [
        {
          filename: "normal/arcane-signet.jpg",
          expectedName: "Arcane Signet",
          expectedSet: "Commander Legends",
          expectedProductId: 226694,
          treatment: "normal",
        },
      ],
    },
    {
      manifestPath: path.join(repoRoot, ".local-fixtures/tcgtracking-scan/manifest.json"),
    },
  );

  assert.equal(manifest.fixtures[0]?.expectedTcgplayerProductId, 226694);
  assert.equal(manifest.fixtures[0]?.imagePath.includes(".local-fixtures"), true);

  assert.throws(
    () => normalizeTcgTrackingScanManifest(
      {
        fixtures: [
          {
            filename: "../leak.jpg",
            expectedName: "Arcane Signet",
          },
        ],
      },
      {
        manifestPath: path.join(repoRoot, ".local-fixtures/tcgtracking-scan/manifest.json"),
      },
    ),
    /escapes the private fixture directory/,
  );

  const summary = summarizeTcgTrackingScanBenchmark([
    {
      fixtureId: "arcane-signet",
      expectedName: "Arcane Signet",
      status: "matched",
      latencyMs: 510,
      top1Match: true,
      top3Match: true,
      unresolved: false,
      incorrectPrinting: false,
    },
  ]);
  assert.equal(summary.imagePathsExported, false);
  assert.equal(JSON.stringify(summary).includes("arcane-signet.jpg"), false);
});

test("TCGTracking admin sync is platform-admin only and scanner fixture roots stay ignored", () => {
  const syncRoute = readFileSync(
    path.join(repoRoot, "src/app/api/admin/tcgtracking/sync/route.ts"),
    "utf8",
  );
  const operations = readFileSync(
    path.join(repoRoot, "src/components/dashboard/admin/AdminOperationsPanels.tsx"),
    "utf8",
  );
  const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  const exampleManifest = readFileSync(
    path.join(repoRoot, "scripts/tcgtracking/scan-manifest.local.example.json"),
    "utf8",
  );

  assert.match(syncRoute, /requireServerPlatformRole\("admin"\)/);
  assert.match(syncRoute, /runTcgTrackingCatalogReconciliation/);
  assert.match(syncRoute, /Supabase server configuration unavailable/);
  assert.match(syncRoute, /localCatalog/);
  assert.match(syncRoute, /run_catalog_reconciliation/);
  assert.match(syncRoute, /sync_magic_mappings/);
  assert.match(syncRoute, /refresh_magic_pricing/);
  assert.doesNotMatch(syncRoute, /manual_command_required/);
  assert.doesNotMatch(syncRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(operations, /Validate Magic provider/);
  assert.match(operations, /Run catalog reconciliation/);
  assert.match(operations, /Failure details/);
  assert.match(operations, /safeText/);
  assert.match(operations, /Sync Magic mappings/);
  assert.match(operations, /Refresh Magic pricing/);
  assert.match(gitignore, /^\.local-fixtures\/$/m);
  assert.match(exampleManifest, /scan-manifest\.local|private/i);
  assert.doesNotMatch(exampleManifest, /C:\\\\|\/Users\//);
});

test("TCGTracking admin diagnostics are Owner/Admin gated and documented", () => {
  const route = readFileSync(
    path.join(repoRoot, "src/app/api/admin/tcgtracking/status/route.ts"),
    "utf8",
  );
  const operations = readFileSync(
    path.join(repoRoot, "src/components/dashboard/admin/AdminOperationsPanels.tsx"),
    "utf8",
  );
  const docs = readFileSync(
    path.join(repoRoot, "docs/TCGTRACKING_INTEGRATION.md"),
    "utf8",
  );
  const benchmarkScript = readFileSync(
    path.join(repoRoot, "scripts/tcgtracking/scan-benchmark.ts"),
    "utf8",
  );

  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.match(operations, /TCGTracking provider/);
  assert.match(operations, /Provider diagnostics/);
  assert.match(operations, /Local catalog/);
  assert.match(operations, /Catalog read failure/);
  assert.match(route, /loadTcgTrackingLocalCatalogStatus/);
  assert.match(route, /tcgplayer_magic_catalog_stats/);
  assert.match(operations, /Categories/);
  assert.match(operations, /Last check/);
  assert.match(docs, /Trading Docks remains the canonical application\/data authority/);
  assert.match(docs, /tcgplayer_magic_catalog remains the local exact-SKU authority/);
  assert.match(docs, /LIVE PROVIDER VALIDATION|Live Provider Validation/);
  assert.match(docs, /--allow-upload/);
  assert.match(benchmarkScript, /summarizeTcgTrackingScanBenchmark/);
  assert.match(benchmarkScript, /requires.*--allow-upload|--allow-upload/);
});

test("TCGTracking production catalog reconciliation remains read-only against local catalog", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/lib/providers/tcgtracking/catalog-reconciliation.ts"),
    "utf8",
  );

  assert.match(source, /from\("tcgplayer_magic_catalog"\)/);
  assert.match(source, /\.select\(/);
  assert.match(source, /\.in\("tcgplayer_id"/);
  assert.doesNotMatch(source, /\.insert\(/);
  assert.doesNotMatch(source, /\.upsert\(/);
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.delete\(/);
});

function providerProduct() {
  return {
    product_id: "provider-456789",
    tcgplayer_product_id: 456789,
    name: "Unblinking Observer",
    set_name: "Innistrad: Midnight Hunt",
    set_abbr: "MID",
    collector_number: "82",
    image_url: "https://cdn.tcgtracking.test/magic/mid/82.jpg",
    scryfall_id: "00000000-0000-4000-8000-000000000082",
    mtgjson_uuid: "mtgjson-82",
    cardmarket_id: "cardmarket-82",
    cardtrader_id: "cardtrader-82",
    colors: ["U"],
    mana_value: 2,
    finishes: ["Normal", "Foil"],
  };
}

function providerSku() {
  return {
    sku_id: "provider-sku-987654",
    product_id: "provider-456789",
    tcgplayer_sku_id: 987654,
    tcgplayer_product_id: 456789,
    condition: "Near Mint",
    condition_code: "NM",
    variant: "Normal",
    variant_id: "normal",
    language: "English",
    market_price: "$5.41",
    low_price: "4.89",
    high_price: 7.25,
    listing_count: 84,
    manapool_low: 4.72,
    updated_at: "2026-08-11T12:00:00.000Z",
  };
}

function json(body: unknown, init: ResponseInit = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

type CatalogQueryRecord =
  | { kind: "select"; columns: string }
  | { kind: "limit"; count: number }
  | { kind: "in"; column: string; valueCount: number };

function catalogReadClient(
  rows: unknown[],
  options: {
    queries?: CatalogQueryRecord[];
    smokeError?: unknown;
    skuError?: unknown;
  } = {},
) {
  return {
    from(table: string) {
      assert.equal(table, "tcgplayer_magic_catalog");
      return {
        select(columns: string) {
          options.queries?.push({ kind: "select", columns });
          return {
            limit(count: number) {
              options.queries?.push({ kind: "limit", count });
              if (options.smokeError) {
                return Promise.resolve({ data: null, error: options.smokeError });
              }
              const sample = rows[0] as { tcgplayer_id?: unknown } | undefined;
              const tcgplayerId = Number(sample?.tcgplayer_id ?? 987654);
              return Promise.resolve({
                data: rows.length ? [{ tcgplayer_id: tcgplayerId }] : [],
                error: null,
              });
            },
            in(column: string, values: number[]) {
              assert.equal(column, "tcgplayer_id");
              assert.ok(Array.isArray(values));
              options.queries?.push({ kind: "in", column, valueCount: values.length });
              if (options.skuError) {
                return Promise.resolve({ data: null, error: options.skuError });
              }
              return Promise.resolve({
                data: rows.filter((row) => values.includes(Number((row as { tcgplayer_id?: unknown }).tcgplayer_id))),
                error: null,
              });
            },
          };
        },
      };
    },
  };
}
