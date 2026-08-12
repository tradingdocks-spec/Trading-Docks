import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  clearTcgProductSearchCache,
  resolveTcgProductSkus,
  searchTcgProducts,
} from "../src/lib/providers/tcgtracking/index.ts";
import {
  marketSourcesForGame,
  variantOptionsForGame,
} from "../src/lib/multi-tcg/index.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Pokemon product search uses TCGTracking category 3 set card endpoints instead of set search", async () => {
  clearTcgProductSearchCache();
  const calls: string[] = [];
  const results = await searchTcgProducts({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    query: "Pikachu VMAX",
    limit: 10,
    client: {
      sets: async (category) => {
        calls.push(`sets:${category}`);
        return [
          {
            id: "swsh4",
            categoryId: category,
            name: "Vivid Voltage",
            abbreviation: "VIV",
          },
        ];
      },
      cards: async (category, setId) => {
        calls.push(`cards:${category}:${setId}`);
        return [
          pokemonProduct({
            providerProductId: "188370",
            name: "Pikachu VMAX",
            collectorNumber: "44",
          }),
          pokemonProduct({
            providerProductId: "188371",
            name: "Charizard",
            collectorNumber: "25",
          }),
        ];
      },
    },
  });

  assert.deepEqual(calls, ["sets:3", "cards:3:swsh4"]);
  assert.equal(TCGTRACKING_POKEMON_CATEGORY_ID, "3");
  assert.equal(results[0]?.name, "Pikachu VMAX");
  assert.equal(results[0]?.gameId, 3);
  assert.equal(results[0]?.providerProductId, "188370");
});

test("Pokemon exact SKU resolution preserves condition variant language and pricing", async () => {
  const resolved = await resolveTcgProductSkus({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    providerProductId: "188370",
    setId: "swsh4",
    client: {
      product: async () => pokemonProduct({ providerProductId: "188370" }),
      skus: async (category, setId) => {
        assert.equal(category, "3");
        assert.equal(setId, "swsh4");
        return [
          {
            providerSkuId: "sku-normal-nm",
            providerProductId: "188370",
            tcgplayerSkuId: 445566,
            tcgplayerProductId: 188370,
            condition: "Near Mint",
            variant: "Normal",
            language: "English",
            marketPrice: 9.42,
            lowPrice: 8.15,
            highPrice: 12.5,
            activeListings: 24,
            raw: {},
          },
        ];
      },
      pricing: async () => [],
    },
  });

  assert.equal(resolved.product?.name, "Pikachu VMAX");
  assert.equal(resolved.skus[0]?.variant, "Normal");
  assert.equal(resolved.skus[0]?.language, "English");
  assert.equal(resolved.skus[0]?.marketPrice, 9.42);
  assert.equal(resolved.skus[0]?.activeListings, 24);
});

test("Pokemon purchasing UI excludes Magic-only market and variant vocabulary", () => {
  assert.deepEqual(variantOptionsForGame("pokemon"), [
    "Normal",
    "Holo",
    "Reverse Holo",
  ]);
  assert.equal(marketSourcesForGame("pokemon").includes("Scryfall"), false);
  assert.equal(marketSourcesForGame("pokemon").includes("Mana Pool"), false);
  assert.equal(marketSourcesForGame("pokemon").includes("TCGTracking"), true);
});

test("Purchasing scanner route wires Pokemon through TCGTracking scan and not Scryfall-only recognition", () => {
  const route = readFileSync(
    path.join(repoRoot, "src/app/api/purchasing/card-photo-scan/route.ts"),
    "utf8",
  );
  const scanner = readFileSync(
    path.join(repoRoot, "src/components/dashboard/purchasing/CardPhotoScanner.tsx"),
    "utf8",
  );

  assert.match(route, /TCGTRACKING_POKEMON_GAME_ID/);
  assert.match(route, /scanCardImageWithTcgTracking/);
  assert.match(route, /searchTcgProducts/);
  assert.match(route, /resolveExactProductImageUrl/);
  assert.match(route, /No Pokemon products found/);
  assert.doesNotMatch(route, /\.search\(/);
  assert.match(scanner, /compressImageForTcgTracking/);
  assert.match(scanner, /form\.set\("gameId", gameContext\)/);
  assert.match(scanner, /Image unavailable/);
  assert.match(scanner, /onImageError/);
  assert.doesNotMatch(scanner, /Pokemon purchasing recognition is in beta/);
});

test("Pokemon product images use provider-locked first-party image route", () => {
  const imageRoute = readFileSync(
    path.join(repoRoot, "src/app/api/catalog/product-image/route.ts"),
    "utf8",
  );
  const scannerRoute = readFileSync(
    path.join(repoRoot, "src/app/api/purchasing/card-photo-scan/route.ts"),
    "utf8",
  );

  assert.match(imageRoute, /isAllowedTcgTrackingImageUrl/);
  assert.match(imageRoute, /tcgTrackingProductImageUrl/);
  assert.match(imageRoute, /content-type/);
  assert.match(imageRoute, /startsWith\("image\/"\)/);
  assert.match(imageRoute, /Cache-Control/);
  assert.doesNotMatch(imageRoute, /scryfall/i);
  assert.match(scannerRoute, /productType: "card"/);
  assert.match(scannerRoute, /providerProductId: product\.providerProductId/);
  assert.match(scannerRoute, /tcgplayerProductId: product\.tcgplayerProductId/);
});

test("Collection Buying exposes Pokemon context and does not guess ambiguous Pokemon printings", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/collection-buying/CollectionBuyingCenter.tsx"),
    "utf8",
  );

  assert.match(source, /GameContextControl/);
  assert.match(source, /gameContext === "pokemon"/);
  assert.match(source, /\/api\/purchasing\/card-photo-scan/);
  assert.match(source, /Multiple Pokemon products found/);
});

function pokemonProduct(overrides: Partial<{
  providerProductId: string;
  name: string;
  collectorNumber: string;
}> = {}) {
  return {
    providerProductId: overrides.providerProductId ?? "188370",
    categoryId: "3",
    setId: "swsh4",
    tcgplayerProductId: Number(overrides.providerProductId ?? "188370"),
    name: overrides.name ?? "Pikachu VMAX",
    cleanName: overrides.name ?? "Pikachu VMAX",
    setName: "Vivid Voltage",
    setCode: "VIV",
    collectorNumber: overrides.collectorNumber ?? "44",
    rarity: "Ultra Rare",
    imageUrl: "https://cdn.tcgtracking.com/product/188370_200w.jpg",
    colors: [],
    finishes: ["Normal", "Holo"],
    raw: {},
  };
}
