import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildInventorySku,
  buildPurchaseWorkspaceLine,
  calculateBuyingOffer,
  magicScryfallToPurchasingResult,
  purchaseLineDetails,
  tcgProductToPurchasingResult,
  toPurchaseHistoryPayload,
  type PurchasingLookupResult,
} from "../src/lib/purchasing/product-lookup.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Purchasing Intelligence is search-first and photo upload is secondary", () => {
  const page = source("src/components/dashboard/purchasing/PurchasingOverview.tsx");
  const scanner = source("src/components/dashboard/purchasing/CardPhotoScanner.tsx");

  assert.match(page, /Search cards, sealed products, sets, or product IDs/);
  assert.match(page, /Search the catalog/);
  assert.match(page, /Upload image/);
  assert.doesNotMatch(page, /Drop a card photo here/);
  assert.doesNotMatch(page, /Vision matching/);
  assert.match(scanner, /Drop card front|Drop a card photo here|Vision matching/);
});

test("Pokemon lookup uses TCGTracking product identity and never Scryfall market sources", () => {
  const product = tcgProductToPurchasingResult({
    providerProductId: "528226",
    tcgplayerProductId: 528226,
    gameId: 3,
    categoryId: "3",
    name: "Pikachu VMAX",
    setId: "17688",
    setName: "Crown Zenith",
    setCode: "CRZ",
    collectorNumber: "44",
    rarity: "Ultra Rare",
    imageUrl: "https://cdn.tcgtracking.com/product/528226_200w.jpg",
    variants: ["Holo", "Reverse Holo"],
    score: 100,
  }, [{
    providerSkuId: "sku-1",
    tcgplayerSkuId: 1001,
    tcgplayerProductId: 528226,
    condition: "Near Mint",
    variant: "Holo",
    language: "English",
    marketPrice: 42,
    lowPrice: 37,
    highPrice: 50,
    activeListings: 18,
  }]);

  assert.equal(product.gameId, "pokemon");
  assert.equal(product.productType, "card");
  assert.equal(product.provider, "tcgtracking");
  assert.equal(product.marketSources.includes("Scryfall"), false);
  assert.equal(product.marketSources.includes("Mana Pool"), false);
  assert.equal(product.marketSources.includes("TCGTracking"), true);
  assert.match(product.imageUrl ?? "", /\/api\/catalog\/product-image/);
});

test("Magic lookup retains Magic enrichments and supported finish variants", () => {
  const product = magicScryfallToPurchasingResult({
    id: "scryfall-1",
    name: "Rhystic Study",
    set_name: "Wilds of Eldraine: Enchanting Tales",
    set: "wot",
    collector_number: "25",
    rarity: "rare",
    tcgplayer_id: 12345,
    finishes: ["nonfoil", "foil", "etched"],
    prices: { usd: "41.20", usd_foil: "48.50", usd_etched: "52.10" },
    image_uris: { normal: "https://cards.scryfall.io/normal/front/test.jpg" },
  });

  assert.equal(product.gameId, "magic");
  assert.equal(product.marketSources.includes("Scryfall"), true);
  assert.equal(product.marketSources.includes("Mana Pool"), true);
  assert.deepEqual(product.variants, ["Normal", "Foil", "Etched"]);
});

test("selected products create canonical purchase ledger lines with exact SKU details", () => {
  const product = pokemonProduct();
  const line = buildPurchaseWorkspaceLine({
    product,
    sku: product.skus[0],
    quantity: 2,
    offerPercent: 60,
  });
  const payload = toPurchaseHistoryPayload([line]);

  assert.equal(payload.action, "create-purchase");
  assert.equal(payload.purchase.sourceType, "collection_buying");
  assert.equal(payload.purchase.status, "pending");
  assert.equal(payload.purchase.lines[0].details.game_id, "pokemon");
  assert.equal(payload.purchase.lines[0].details.provider_product_id, "528226");
  assert.equal(payload.purchase.lines[0].details.provider_sku_id, "sku-holo-nm");
  assert.equal(payload.purchase.lines[0].totalCost, 50.4);
});

test("inventory identity merges exact product SKU condition variant and language", () => {
  const product = pokemonProduct();
  const sku = buildInventorySku({
    product,
    sku: product.skus[0],
    condition: "Near Mint",
    variant: "Holo",
    language: "English",
  });

  assert.equal(sku, "pokemon:card:528226:sku-holo-nm:near-mint:holo:english");
  assert.deepEqual(purchaseLineDetails(buildPurchaseWorkspaceLine({ product, sku: product.skus[0], quantity: 1 })).product_type, "card");
});

test("buying rules expose clear cash store-credit and spread math", () => {
  assert.deepEqual(calculateBuyingOffer(42, 60), {
    marketReference: 42,
    offerPercent: 60,
    cashOffer: 25.2,
    storeCreditOffer: 28.98,
    spread: 16.8,
  });
});

test("lookup API is buying-capability gated and supports inventory persistence", () => {
  const route = source("src/app/api/purchasing/product-lookup/route.ts");

  assert.match(route, /requireApiCapability\("buying\.manage"\)/);
  assert.match(route, /searchTcgProducts/);
  assert.match(route, /searchSealedProducts/);
  assert.match(route, /\.from\("inventory_items"\)/);
  assert.match(route, /\.eq\("user_id"/);
  assert.match(route, /onChange|add-inventory/);
  assert.doesNotMatch(route, /Scryfall.*pokemon/i);
});

test("mobile scanner architecture remains available outside Purchasing Intelligence", () => {
  const scannerPage = source("src/app/dashboard/card-photo-scanner/page.tsx");
  const scannerApi = source("src/app/api/purchasing/card-photo-scan/route.ts");

  assert.match(scannerPage, /CardPhotoScanner/);
  assert.match(scannerApi, /scanCardImageWithTcgTracking/);
});

function pokemonProduct(): PurchasingLookupResult {
  return {
    id: "pokemon:card:528226",
    gameId: "pokemon",
    gameLabel: "Pokemon",
    productType: "card",
    provider: "tcgtracking",
    providerProductId: "528226",
    tcgplayerProductId: 528226,
    name: "Pikachu VMAX",
    setName: "Crown Zenith",
    setCode: "CRZ",
    collectorNumber: "44",
    rarity: "Ultra Rare",
    imageUrl: "/api/catalog/product-image?gameId=pokemon&providerProductId=528226&productType=card",
    variants: ["Holo"],
    marketPrice: 42,
    lowPrice: 37,
    highPrice: 50,
    activeListings: 18,
    freshness: null,
    marketSources: ["TCGplayer", "TCGTracking", "Cardmarket"],
    skus: [{
      id: "sku-holo-nm",
      providerSkuId: "sku-holo-nm",
      tcgplayerSkuId: 1001,
      condition: "Near Mint",
      variant: "Holo",
      language: "English",
      marketPrice: 42,
      lowPrice: 37,
      highPrice: 50,
      activeListings: 18,
    }],
  };
}

function source(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}
