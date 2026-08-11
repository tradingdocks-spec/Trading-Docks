import { writeFile } from "node:fs/promises";

import { createAdminClient } from "../../src/lib/supabase/admin.ts";
import {
  createTcgTrackingClient,
  marketSnapshotFromTcgTracking,
  type TcgTrackingProduct,
  type TcgTrackingSku,
} from "../../src/lib/providers/tcgtracking/index.ts";
import { normalizeProductName } from "../../src/lib/tcgplayer-catalog/normalization.ts";

type Sample = {
  label: string;
  cardName: string;
  setName: string;
};

const samples: Sample[] = [
  { label: "normal", cardName: "Arcane Signet", setName: "Commander Legends" },
  { label: "older-frame", cardName: "Rhystic Study", setName: "Prophecy" },
  { label: "older-frame", cardName: "All Is Dust", setName: "Rise of the Eldrazi" },
  { label: "older-frame", cardName: "Lightning Greaves", setName: "Mirrodin" },
  { label: "borderless", cardName: "Arcane Signet (Borderless)", setName: "Commander Masters" },
  { label: "foil-only-special", cardName: "Rhystic Study (Anime Borderless) (Confetti Foil)", setName: "Wilds of Eldraine: Enchanting Tales" },
];

const outputArg = flagValue("--output");
const client = createTcgTrackingClient({ timeoutMs: 20_000, retries: 0 });
const startedAt = new Date().toISOString();

const report = await runValidation();
const serialized = JSON.stringify(report, null, 2);

if (outputArg) {
  await writeFile(outputArg, `${serialized}\n`, "utf8");
} else {
  process.stdout.write(`${serialized}\n`);
}

async function runValidation() {
  const providerStarted = Date.now();
  const meta = await client.meta();
  const categories = await client.categories();
  const sets = await client.sets("magic");

  const localCatalog = createOptionalCatalogReader();
  const productResults = [];

  for (const sample of samples) {
    const set = sets.find((candidate) => candidate.name.toLowerCase() === sample.setName.toLowerCase());
    if (!set) {
      productResults.push({ ...sample, status: "set_not_found" });
      continue;
    }

    const cardStarted = Date.now();
    const cards = await client.cards("magic", set.id);
    const products = cards.filter((product) => normalizeProductName(product.name) === normalizeProductName(sample.cardName));
    const selectedProduct = products[0] ?? null;
    const skus = selectedProduct ? await matchingSkus(set.id, selectedProduct) : [];
    const pricing = selectedProduct
      ? (await client.pricing("magic", set.id)).filter((snapshot) => snapshot.tcgplayerProductId === Number(selectedProduct.providerProductId))
      : [];
    const localRows = selectedProduct && localCatalog
      ? await localCatalog(sample.cardName)
      : null;
    const image = selectedProduct?.imageUrl
      ? await checkImage(selectedProduct.imageUrl)
      : null;

    productResults.push({
      ...sample,
      status: selectedProduct ? "matched_provider_product" : "provider_product_not_found",
      setId: set.id,
      productCountInSet: cards.length,
      providerMatchCount: products.length,
      provider: selectedProduct ? summarizeProduct(selectedProduct) : null,
      skuCount: skus.length,
      sampleSkus: skus.slice(0, 6).map(summarizeSku),
      pricing,
      marketSnapshots: pricing.map((snapshot) => marketSnapshotFromTcgTracking(snapshot)),
      localCatalog: localRows,
      image,
      latencyMs: Date.now() - cardStarted,
    });
  }

  return {
    generatedAt: startedAt,
    providerHealth: {
      reachable: true,
      metaVersion: meta.version,
      categoryCount: categories.length,
      latencyMs: Date.now() - providerStarted,
    },
    localCatalogAvailable: Boolean(localCatalog),
    products: productResults,
    schemaRecommendation: {
      applyMigrationNow: false,
      smallestUsefulCache: [
        "tcgtracking_product_mappings keyed by provider product id and local TCGplayer product/SKU identity",
        "tcgtracking_price_snapshots keyed by provider product id, SKU id, finish, condition, language, and captured_at",
        "tcgtracking_sync_runs for bounded provider sync checkpoints",
      ],
    },
  };
}

async function matchingSkus(setId: string, product: TcgTrackingProduct) {
  const skus = await client.skus("magic", setId);
  return skus.filter((sku) => sku.tcgplayerProductId === Number(product.providerProductId));
}

function summarizeProduct(product: TcgTrackingProduct) {
  return {
    tcgplayerProductId: product.tcgplayerProductId,
    providerProductId: product.providerProductId,
    name: product.name,
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

function createOptionalCatalogReader() {
  try {
    const supabase = createAdminClient();
    return async (productName: string) => {
      const { data, error } = await supabase
        .from("tcgplayer_magic_catalog")
        .select("tcgplayer_id,set_name,product_name,collector_number,condition,finish,tcg_market_price,tcg_low_price,tcg_direct_low,tcg_low_price_with_shipping,tcg_marketplace_price,photo_url")
        .eq("normalized_product_name", normalizeProductName(productName))
        .limit(50);
      if (error) {
        return { status: "read_failed", message: error.message, code: error.code };
      }
      return { status: "read_ok", rowCount: data?.length ?? 0, rows: data ?? [] };
    };
  } catch {
    return null;
  }
}

async function checkImage(url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD" });
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Image check failed.",
      latencyMs: Date.now() - started,
    };
  }
}

function flagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}
