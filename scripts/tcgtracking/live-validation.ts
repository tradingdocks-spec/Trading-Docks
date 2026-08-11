import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createAdminClient } from "../../src/lib/supabase/admin.ts";
import {
  createTcgTrackingClient,
  marketSnapshotFromTcgTracking,
  reconcileTcgTrackingProduct,
  summarizeImageReliability,
  summarizePricingDeltas,
  type ImageProbeResult,
  type TcgTrackingLocalCatalogRow,
  type TcgTrackingPriceSnapshot,
  type TcgTrackingProduct,
  type TcgTrackingProductReconciliation,
  type TcgTrackingSet,
  type TcgTrackingSku,
} from "../../src/lib/providers/tcgtracking/index.ts";
import { normalizeProductName } from "../../src/lib/tcgplayer-catalog/normalization.ts";

type TargetSet = {
  name: string;
  labels: string[];
  preferredNames?: string[];
};

type CatalogReader = (product: TcgTrackingProduct) => Promise<{
  status: "read_ok" | "read_failed";
  rowCount?: number;
  rows?: TcgTrackingLocalCatalogRow[];
  message?: string;
  code?: string;
}>;

const targetSets: TargetSet[] = [
  {
    name: "Commander Legends",
    labels: ["commander", "normal"],
    preferredNames: ["Arcane Signet", "Command Tower", "Sol Ring"],
  },
  {
    name: "Prophecy",
    labels: ["older-frame"],
    preferredNames: ["Rhystic Study"],
  },
  {
    name: "Rise of the Eldrazi",
    labels: ["older-frame"],
    preferredNames: ["All Is Dust"],
  },
  {
    name: "Mirrodin",
    labels: ["older-frame", "artifact"],
    preferredNames: ["Lightning Greaves"],
  },
  {
    name: "Commander Masters",
    labels: ["commander", "borderless"],
    preferredNames: ["Arcane Signet (Borderless)", "Jeweled Lotus"],
  },
  {
    name: "Wilds of Eldraine: Enchanting Tales",
    labels: ["showcase", "foil"],
    preferredNames: ["Rhystic Study (Anime Borderless) (Confetti Foil)"],
  },
  {
    name: "Secret Lair Drop",
    labels: ["promo", "alternate-treatment"],
  },
  {
    name: "Modern Horizons 3",
    labels: ["recent-set", "showcase"],
  },
  {
    name: "Magic: The Gathering Foundations",
    labels: ["recent-set", "beginner"],
  },
  {
    name: "Final Fantasy",
    labels: ["recent-set", "showcase"],
  },
];

const outputArg =
  flagValue("--output") ??
  path.join("artifacts", "tcgtracking-reconciliation.json");
const sampleSize = boundedInteger(flagValue("--sample-size"), 75, 50, 200);
const client = createTcgTrackingClient({ timeoutMs: 20_000, retries: 0 });
const startedAt = new Date().toISOString();

const report = await runValidation();
const serialized = JSON.stringify(report, null, 2);
await mkdir(path.dirname(outputArg), { recursive: true });
await writeFile(outputArg, `${serialized}\n`, "utf8");
process.stdout.write(`${serialized}\n`);

async function runValidation() {
  const providerStarted = Date.now();
  const meta = await client.meta();
  const categories = await client.categories();
  const sets = await client.sets("magic");
  const localCatalog = createOptionalCatalogReader();
  const providerSets = resolveTargetSets(sets);
  const productResults = [];
  const reconciliations: TcgTrackingProductReconciliation[] = [];
  const imageChecks: ImageProbeResult[] = [];
  let sampledProducts = 0;

  for (const [setIndex, targetSet] of providerSets.entries()) {
    if (sampledProducts >= sampleSize) break;
    const setStarted = Date.now();
    const cards = await client.cards("magic", targetSet.set.id);
    const skus = await client.skus("magic", targetSet.set.id);
    const pricing = await client.pricing("magic", targetSet.set.id);
    const setsRemaining = providerSets.length - setIndex;
    const perSetLimit = Math.min(
      10,
      Math.ceil((sampleSize - sampledProducts) / setsRemaining),
    );
    const sampled = sampleProducts(cards, targetSet.target, perSetLimit);

    for (const product of sampled) {
      const productStarted = Date.now();
      const providerSkus = skus.filter((sku) =>
        sku.tcgplayerProductId === Number(product.providerProductId),
      );
      const priceSnapshots = pricing.filter((snapshot) =>
        snapshot.tcgplayerProductId === Number(product.providerProductId),
      );
      const localRows = localCatalog
        ? await localCatalog(product)
        : null;
      const image = product.imageUrl
        ? await checkImage(product.imageUrl)
        : null;
      if (image) imageChecks.push(image);

      const reconciliation = localRows?.status === "read_ok"
        ? reconcileTcgTrackingProduct({
          providerProduct: product,
          providerSkus,
          priceSnapshots,
          localRows: localRows.rows ?? [],
        })
        : null;
      if (reconciliation) reconciliations.push(reconciliation);

      productResults.push({
        labels: targetSet.target.labels,
        setId: targetSet.set.id,
        setName: targetSet.set.name,
        product: summarizeProduct(product),
        providerSkuCount: providerSkus.length,
        pricingCoverage: summarizePricingCoverage(priceSnapshots),
        sampleSkus: providerSkus.slice(0, 6).map(summarizeSku),
        sampleMarketSnapshots: priceSnapshots
          .slice(0, 4)
          .map((snapshot) => marketSnapshotFromTcgTracking(snapshot)),
        localCatalog: localRows
          ? {
            status: localRows.status,
            rowCount: localRows.rowCount ?? localRows.rows?.length ?? 0,
            message: localRows.message,
            code: localRows.code,
          }
          : {
            status: "not_run_missing_supabase_credentials",
            rowCount: 0,
          },
        reconciliation: reconciliation
          ? summarizeReconciliation(reconciliation)
          : null,
        image,
        latencyMs: Date.now() - productStarted,
      });
      sampledProducts += 1;
      if (sampledProducts >= sampleSize) break;
    }

    productResults.push({
      setName: targetSet.set.name,
      labels: targetSet.target.labels,
      status: "set_processed",
      cardCountInSet: cards.length,
      skuCountInSet: skus.length,
      pricingRowsInSet: pricing.length,
      latencyMs: Date.now() - setStarted,
    });
  }

  return {
    generatedAt: startedAt,
    requestedSampleSize: sampleSize,
    sampledProductCount: sampledProducts,
    providerHealth: {
      reachable: true,
      metaVersion: meta.version,
      categoryCount: categories.length,
      latencyMs: Date.now() - providerStarted,
    },
    localCatalogAvailable: Boolean(localCatalog),
    localCatalogStatus: localCatalog
      ? "available"
      : "not_run_missing_NEXT_PUBLIC_SUPABASE_URL_or_SUPABASE_SERVICE_ROLE_KEY",
    reconciliationSummary: summarizeReconciliationSet(reconciliations),
    pricingDeltaSummary: summarizePricingDeltas(reconciliations),
    imageReliability: summarizeImageReliability(imageChecks),
    scannerBenchmark: {
      status: "not_run_no_private_fixture_manifest",
      reason: "No product-owner-supplied private image manifest was available in the repository or shell.",
      harness: "scripts/tcgtracking/scan-benchmark.ts",
    },
    currentScannerComparison: {
      status: "not_run",
      reason: "The current mobile scanner requires native/private image fixtures; no committed image fixtures were used.",
    },
    products: productResults,
    schemaRecommendation: {
      applyMigrationNow: false,
      minimumUsefulSchema: [
        "tcgtracking_product_mappings",
        "tcgtracking_price_snapshots",
        "tcgtracking_sync_runs",
      ],
      avoidForNow: [
        "A full tcgtracking_products mirror that duplicates tcgplayer_magic_catalog before evidence proves it is necessary.",
      ],
    },
  };
}

function resolveTargetSets(sets: TcgTrackingSet[]) {
  return targetSets
    .map((target) => {
      const exact = sets.find((candidate) =>
        candidate.name.toLowerCase() === target.name.toLowerCase(),
      );
      const fuzzy = exact ?? sets.find((candidate) => {
        const setName = candidate.name.toLowerCase();
        const targetName = target.name.toLowerCase();
        return (
          setName.includes(targetName) &&
          !setName.includes("art series") &&
          !setName.includes("tokens")
        );
      });
      return { target, set: fuzzy };
    })
    .filter((entry): entry is { target: TargetSet; set: TcgTrackingSet } =>
      Boolean(entry.set),
    );
}

function sampleProducts(
  products: TcgTrackingProduct[],
  target: TargetSet,
  limit: number,
) {
  const selected = new Map<string, TcgTrackingProduct>();
  for (const preferredName of target.preferredNames ?? []) {
    const match = products.find((product) =>
      normalizeProductName(product.name) === normalizeProductName(preferredName),
    );
    if (match) selected.set(match.providerProductId, match);
  }

  const foilOrTreatment = products.filter((product) =>
    /foil|borderless|showcase|extended|retro|promo/i.test(product.name) ||
    product.finishes.some((finish) => /foil/i.test(finish)),
  );
  for (const product of evenlySpaced(foilOrTreatment, 4)) {
    selected.set(product.providerProductId, product);
  }

  for (const product of evenlySpaced(products, Math.max(0, limit - selected.size))) {
    selected.set(product.providerProductId, product);
  }

  return [...selected.values()].slice(0, limit);
}

function evenlySpaced<T>(items: T[], limit: number) {
  if (limit <= 0 || !items.length) return [];
  if (items.length <= limit) return items;
  const result: T[] = [];
  const step = items.length / limit;
  for (let index = 0; index < limit; index += 1) {
    result.push(items[Math.floor(index * step)]);
  }
  return result;
}

function summarizeProduct(product: TcgTrackingProduct) {
  return {
    tcgplayerProductId: product.tcgplayerProductId,
    providerProductId: product.providerProductId,
    name: product.name,
    setName: product.setName,
    setCode: product.setCode,
    collectorNumber: product.collectorNumber,
    scryfallId: product.scryfallId,
    mtgjsonUuid: product.mtgjsonUuid,
    cardmarketId: product.cardmarketId,
    cardtraderId: product.cardtraderId,
    imageUrl: product.imageUrl,
    finishes: product.finishes,
  };
}

function summarizeSku(sku: TcgTrackingSku) {
  return {
    tcgplayerSkuId: sku.tcgplayerSkuId,
    tcgplayerProductId: sku.tcgplayerProductId,
    condition: sku.condition,
    finish: sku.variant,
    language: sku.language,
    marketPrice: sku.marketPrice,
    lowPrice: sku.lowPrice,
    highPrice: sku.highPrice,
    activeListings: sku.activeListings,
    manapoolLow: sku.manapoolLow,
  };
}

function summarizePricingCoverage(snapshots: TcgTrackingPriceSnapshot[]) {
  return {
    rows: snapshots.length,
    finishes: [...new Set(snapshots.map((snapshot) =>
      snapshot.providerSkuId?.split(":").at(-1)).filter(Boolean))],
    hasMarket: snapshots.some((snapshot) => snapshot.tcgMarket != null),
    hasLow: snapshots.some((snapshot) => snapshot.tcgLow != null),
    hasManapool: snapshots.some((snapshot) => snapshot.manapoolLow != null),
  };
}

function summarizeReconciliation(reconciliation: TcgTrackingProductReconciliation) {
  return {
    localSkuCount: reconciliation.localSkuCount,
    providerSkuCount: reconciliation.providerSkuCount,
    exactMatches: reconciliation.exactMatches,
    missingLocalSkus: reconciliation.missingLocalSkus,
    missingProviderSkus: reconciliation.missingProviderSkus,
    conflictCount: reconciliation.conflicts.length,
    conflicts: reconciliation.conflicts,
  };
}

function summarizeReconciliationSet(reconciliations: TcgTrackingProductReconciliation[]) {
  const conflictsByType: Record<string, number> = {};
  for (const reconciliation of reconciliations) {
    for (const conflict of reconciliation.conflicts) {
      conflictsByType[conflict.type] = (conflictsByType[conflict.type] ?? 0) + 1;
    }
  }

  const localSkuCount = reconciliations.reduce((sum, item) => sum + item.localSkuCount, 0);
  const providerSkuCount = reconciliations.reduce((sum, item) => sum + item.providerSkuCount, 0);
  const exactMatches = reconciliations.reduce((sum, item) => sum + item.exactMatches, 0);
  const missingLocalSkus = reconciliations.reduce((sum, item) => sum + item.missingLocalSkus, 0);
  const missingProviderSkus = reconciliations.reduce((sum, item) => sum + item.missingProviderSkus, 0);

  return {
    productsComparedToLocalCatalog: reconciliations.length,
    localSkuCount,
    providerSkuCount,
    exactMatches,
    exactMatchRate: providerSkuCount ? exactMatches / providerSkuCount : null,
    missingLocalSkus,
    missingProviderSkus,
    conflictCount: Object.values(conflictsByType).reduce((sum, count) => sum + count, 0),
    conflictsByType,
  };
}

function createOptionalCatalogReader(): CatalogReader | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    return async (product) => {
      const { data, error } = await supabase
        .from("tcgplayer_magic_catalog")
        .select("tcgplayer_id,set_name,product_name,collector_number,condition,finish,tcg_market_price,tcg_low_price,photo_url")
        .eq("normalized_product_name", normalizeProductName(product.name))
        .limit(200);
      if (error) {
        return {
          status: "read_failed",
          message: error.message,
          code: error.code,
        };
      }
      return {
        status: "read_ok",
        rowCount: data?.length ?? 0,
        rows: (data ?? []) as TcgTrackingLocalCatalogRow[],
      };
    };
  } catch {
    return null;
  }
}

async function checkImage(url: string): Promise<ImageProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD" });
    return {
      url,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: numberOrNull(response.headers.get("content-length")),
      latencyMs: Date.now() - started,
    };
  } catch {
    return {
      url,
      ok: false,
      latencyMs: Date.now() - started,
    };
  }
}

function numberOrNull(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function flagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
