import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_PURCHASING_BUYING_RULES,
  PURCHASING_BUYING_RULES_DOCUMENT,
  resolveEffectiveBuyingRule,
  resolvePurchasingBuyingRules,
} from "../src/lib/purchasing/buying-rules.ts";
import {
  addOrIncrementPurchaseLine,
  buildInventorySku,
  buildPurchaseWorkspaceLine,
  calculateBuyingOffer,
  magicScryfallToPurchasingResult,
  purchaseLineDetails,
  removePurchaseLine,
  summarizePurchaseCart,
  tcgProductToPurchasingResult,
  toPurchaseHistoryPayload,
  updatePurchaseLineQuantity,
  type PurchasingLookupResult,
} from "../src/lib/purchasing/product-lookup.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Purchasing Intelligence is search-first and photo upload is secondary", () => {
  const page = source("src/components/dashboard/purchasing/PurchasingOverview.tsx");
  const scanner = source("src/components/dashboard/purchasing/CardPhotoScanner.tsx");
  const canonicalRoute = source("src/app/dashboard/purchasing-intelligence/page.tsx");

  assert.match(page, /Search cards, sealed products, sets, or product IDs/);
  assert.match(page, /type="submit"[\s\S]*Search/);
  assert.match(page, /function submitSearch/);
  assert.match(page, /void runSearch\(query\)/);
  assert.match(page, /void runSearch\(trimmed\)/);
  assert.match(page, /Search the catalog/);
  assert.match(page, /Upload image/);
  assert.match(canonicalRoute, /PurchasingOverview/);
  assert.doesNotMatch(canonicalRoute, /CardPhotoScanner/);
  assert.doesNotMatch(page, /Drop a card photo here/);
  assert.doesNotMatch(page, /Scan Stage/);
  assert.doesNotMatch(page, /Recognition Assist/);
  assert.doesNotMatch(page, /Image Quality/);
  assert.doesNotMatch(page, /Accuracy Standard/);
  assert.doesNotMatch(page, /Trading Docks Vision/);
  assert.doesNotMatch(page, /Vision matching/);
  assert.match(scanner, /Drop card front|Drop a card photo here|Vision matching/);
});

test("Purchasing Intelligence canonical route is registered in navigation and access rules", () => {
  const navigation = source("src/components/dashboard/navigation.ts");
  const routeAccess = source("src/lib/platform/route-access.ts");
  const tierAccess = source("src/lib/tier-access.ts");
  const createMenu = source("src/components/dashboard/shell/create-menu-actions.ts");

  assert.match(navigation, /href: "\/dashboard\/purchasing-intelligence"/);
  assert.match(routeAccess, /purchasing-intelligence/);
  assert.match(tierAccess, /purchasing-intelligence/);
  assert.match(createMenu, /\/dashboard\/purchasing-intelligence\?action=add-inventory/);
  assert.doesNotMatch(createMenu, /href: "\/dashboard\/card-photo-scanner"[\s\S]*add-inventory-card/);
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
  assert.equal(payload.purchase.lines[0].details.buying_percent, 60);
  assert.equal(payload.purchase.lines[0].details.market_reference, 42);
  assert.equal(payload.purchase.lines[0].details.store_credit_offer, 28.98);
  assert.equal(payload.purchase.lines[0].totalCost, 50.4);
});

test("live purchase cart increments exact duplicates and preserves distinct variants", () => {
  const product = pokemonProduct();
  const first = buildPurchaseWorkspaceLine({
    product,
    sku: product.skus[0],
    quantity: 1,
    offerPercent: 60,
  });
  const duplicate = buildPurchaseWorkspaceLine({
    product,
    sku: product.skus[0],
    quantity: 2,
    offerPercent: 60,
  });
  const reverseSku = {
    ...product.skus[0],
    id: "sku-reverse-nm",
    providerSkuId: "sku-reverse-nm",
    tcgplayerSkuId: 1002,
    variant: "Reverse Holo",
    marketPrice: 30,
    lowPrice: 26,
    highPrice: 35,
  };
  const distinctVariant = buildPurchaseWorkspaceLine({
    product: { ...product, variants: ["Holo", "Reverse Holo"] },
    sku: reverseSku,
    quantity: 1,
    offerPercent: 60,
  });

  let lines = addOrIncrementPurchaseLine([], first);
  lines = addOrIncrementPurchaseLine(lines, duplicate);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);

  lines = addOrIncrementPurchaseLine(lines, distinctVariant);

  assert.equal(lines.length, 2);
  assert.equal(summarizePurchaseCart(lines).unitCount, 4);
  assert.equal(summarizePurchaseCart(lines).marketValue, 156);
  assert.equal(summarizePurchaseCart(lines).cashOffer, 93.6);
  assert.equal(summarizePurchaseCart(lines).storeCreditOffer, 107.64);
  assert.equal(summarizePurchaseCart(lines).effectiveBuyRate, 60);

  lines = updatePurchaseLineQuantity(lines, first.id, 5);
  assert.equal(lines.find((line) => line.id === first.id)?.quantity, 5);

  lines = removePurchaseLine(lines, distinctVariant.id);
  assert.equal(lines.length, 1);
});

test("purchase cart summary supports weighted singles and sealed buying rules", () => {
  const single = pokemonProduct();
  const sealed: PurchasingLookupResult = {
    ...single,
    id: "pokemon:sealed:booster-box",
    productType: "sealed",
    providerProductId: "sealed-1",
    tcgplayerProductId: 900001,
    name: "Crown Zenith Booster Bundle",
    productFamily: "Booster Bundle",
    collectorNumber: null,
    rarity: null,
    variants: ["Sealed"],
    marketPrice: 100,
    lowPrice: 92,
    highPrice: 118,
    activeListings: 41,
    skus: [],
  };
  const lines = [
    buildPurchaseWorkspaceLine({ product: single, sku: single.skus[0], quantity: 1, offerPercent: 60 }),
    buildPurchaseWorkspaceLine({ product: sealed, sku: null, quantity: 1, offerPercent: 75 }),
  ];
  const summary = summarizePurchaseCart(lines);

  assert.equal(lines[0].offerPercent, 60);
  assert.equal(lines[1].offerPercent, 75);
  assert.equal(summary.marketValue, 142);
  assert.equal(summary.cashOffer, 100.2);
  assert.equal(summary.storeCreditOffer, 115.23);
  assert.equal(summary.effectiveBuyRate, 70.56);
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

test("Purchasing Intelligence buying rules resolve singles and sealed rates from one authority", () => {
  assert.equal(PURCHASING_BUYING_RULES_DOCUMENT, "purchasing-intelligence:buying-rules:v1");
  assert.deepEqual(DEFAULT_PURCHASING_BUYING_RULES, {
    singlesPercent: 60,
    sealedPercent: 75,
    storeCreditBonusPercent: 15,
    manualOfferAllowed: false,
  });

  const singles = resolveEffectiveBuyingRule({
    productType: "card",
    rules: resolvePurchasingBuyingRules({
      singlesPercent: 58,
      sealedPercent: 72,
      storeCreditBonusPercent: 12,
    }).rules,
    configured: true,
  });
  const sealed = resolveEffectiveBuyingRule({
    productType: "sealed",
    rules: resolvePurchasingBuyingRules({
      singlesPercent: 58,
      sealedPercent: 72,
      storeCreditBonusPercent: 12,
    }).rules,
    configured: true,
  });

  assert.equal(singles.label, "58% · Singles");
  assert.equal(sealed.label, "72% · Sealed");
  assert.equal(sealed.sourceLabel, "Workspace rule");
  assert.equal(calculateBuyingOffer(100, sealed.percent ?? 0, sealed.storeCreditBonusPercent).cashOffer, 72);
  assert.equal(calculateBuyingOffer(100, sealed.percent ?? 0, sealed.storeCreditBonusPercent).storeCreditOffer, 80.64);
});

test("unavailable market prices do not become fake zero-dollar offers", () => {
  assert.deepEqual(calculateBuyingOffer(null, 60), {
    marketReference: null,
    offerPercent: 60,
    cashOffer: null,
    storeCreditOffer: null,
    spread: null,
  });
});

test("lookup API is buying-capability gated and supports inventory persistence", () => {
  const route = source("src/app/api/purchasing/product-lookup/route.ts");

  assert.match(route, /requireApiCapability\("buying\.manage"\)/);
  assert.match(route, /searchTcgProducts/);
  assert.match(route, /searchSealedProducts/);
  assert.match(route, /\.from\("inventory_items"\)/);
  assert.match(route, /\.from\("inventory_locations"\)/);
  assert.match(route, /\.from\("collector_wishlist"\)/);
  assert.match(route, /\.from\("binder_card_trade_status"\)/);
  assert.match(route, /\.eq\("user_id"/);
  assert.match(route, /add-inventory/);
  assert.match(route, /add-collection/);
  assert.match(route, /add-binder/);
  assert.match(route, /add-trade-binder/);
  assert.match(route, /add-wishlist/);
  assert.doesNotMatch(route, /Scryfall.*pokemon/i);
});

test("selected-product layout uses readable SKU controls instead of raw SKU IDs", () => {
  const page = source("src/components/dashboard/purchasing/PurchasingOverview.tsx");

  assert.match(page, /SKU details/);
  assert.match(page, /label="Condition"/);
  assert.match(page, /label="Variant"/);
  assert.match(page, /label="Language"/);
  assert.match(page, /Add to Current Purchase/);
  assert.match(page, /Current purchase/);
  assert.match(page, /Effective buy rate/);
  assert.match(page, /Decrease \$\{line\.product\.name\} quantity/);
  assert.match(page, /Increase \$\{line\.product\.name\} quantity/);
  assert.match(page, /disabled=\{Boolean\(props\.addToPurchaseDisabledReason\)\}/);
  assert.match(page, /Select a priced variant before adding to purchase/);
  assert.match(page, /Edit rules/);
  assert.match(page, /href="\/dashboard\/buying-rules"/);
  assert.match(page, /Rule source/);
  assert.doesNotMatch(page, /label="Exact SKU"/);
  assert.doesNotMatch(page, /SKU pricing unavailable/);
  assert.doesNotMatch(page, /useState\\(60\\)/);
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
