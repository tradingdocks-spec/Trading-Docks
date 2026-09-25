import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  clearTcgProductSearchCache,
  isExcludedPokemonUtilityProduct,
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

test("Pokemon exact SKU resolution maps product finish pricing when SKU rows omit prices", async () => {
  const resolved = await resolveTcgProductSkus({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    providerProductId: "188370",
    setId: "swsh4",
    client: {
      product: async () => pokemonProduct({ providerProductId: "188370" }),
      skus: async () => [
        {
          providerSkuId: "sku-reverse-nm",
          providerProductId: "188370",
          tcgplayerSkuId: 445567,
          tcgplayerProductId: 188370,
          conditionCode: "NM",
          variant: "Reverse Holofoil",
          language: "English",
          raw: {},
        },
      ],
      pricing: async () => [
        {
          providerProductId: "188370",
          providerSkuId: "188370:Reverse Holo",
          tcgplayerProductId: 188370,
          tcgMarket: 24,
          tcgLow: 21.5,
          tcgHigh: 31,
          activeListings: 18,
          manapoolLow: null,
          updatedAt: "2026-08-12T10:00:00.000Z",
        },
      ],
    },
  });

  assert.equal(resolved.skus[0]?.condition, "Near Mint");
  assert.equal(resolved.skus[0]?.variant, "Reverse Holo");
  assert.equal(resolved.skus[0]?.marketPrice, 24);
  assert.equal(resolved.skus[0]?.lowPrice, 21.5);
  assert.equal(resolved.skus[0]?.highPrice, 31);
  assert.equal(resolved.skus[0]?.activeListings, 18);
});

test("Pokemon utility code cards are excluded from ordinary product discovery", async () => {
  clearTcgProductSearchCache();
  assert.equal(isExcludedPokemonUtilityProduct({ name: "Code Card - Crown Zenith Elite Trainer Box", cleanName: "Code Card Crown Zenith Elite Trainer Box" }), true);
  assert.equal(isExcludedPokemonUtilityProduct({ name: "Pokemon TCG Live Code Card - Scarlet & Violet", cleanName: "Pokemon TCG Live Code Card Scarlet Violet" }), true);
  assert.equal(isExcludedPokemonUtilityProduct({ name: "Codebreaker Pikachu", cleanName: "Codebreaker Pikachu" }), false);

  const results = await searchTcgProducts({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    query: "Pikachu VMAX",
    limit: 10,
    client: {
      sets: async (category) => [{ id: "swsh4", categoryId: category, name: "Vivid Voltage", abbreviation: "VIV" }],
      cards: async () => [
        pokemonProduct({ providerProductId: "code-1", name: "Code Card - Pikachu VMAX", collectorNumber: "" }),
        pokemonProduct({ providerProductId: "188370", name: "Pikachu VMAX", collectorNumber: "44" }),
      ],
    },
  });

  assert.equal(results.some((result) => result.name.startsWith("Code Card")), false);
  assert.equal(results[0]?.name, "Pikachu VMAX");
});

test("Pokemon discovery preserves set context required for exact SKU pricing", async () => {
  clearTcgProductSearchCache();

  const results = await searchTcgProducts({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    query: "Pikachu VMAX",
    limit: 1,
    client: {
      sets: async (category) => [{ id: "swsh4", categoryId: category, name: "Vivid Voltage", abbreviation: "VIV" }],
      cards: async () => [
        pokemonProduct({
          providerProductId: "188370",
          name: "Pikachu VMAX",
          collectorNumber: "44",
          setId: undefined,
          setName: undefined,
          setCode: undefined,
        }),
      ],
    },
  });

  assert.equal(results[0]?.setId, "swsh4");
  assert.equal(results[0]?.setName, "Vivid Voltage");
  assert.equal(results[0]?.setCode, "VIV");
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
  setId: string | undefined;
  setName: string | undefined;
  setCode: string | undefined;
}> = {}) {
  return {
    providerProductId: overrides.providerProductId ?? "188370",
    categoryId: "3",
    setId: Object.prototype.hasOwnProperty.call(overrides, "setId") ? overrides.setId : "swsh4",
    tcgplayerProductId: Number(overrides.providerProductId ?? "188370"),
    name: overrides.name ?? "Pikachu VMAX",
    cleanName: overrides.name ?? "Pikachu VMAX",
    setName: Object.prototype.hasOwnProperty.call(overrides, "setName") ? overrides.setName : "Vivid Voltage",
    setCode: Object.prototype.hasOwnProperty.call(overrides, "setCode") ? overrides.setCode : "VIV",
    collectorNumber: overrides.collectorNumber ?? "44",
    rarity: "Ultra Rare",
    imageUrl: "https://cdn.tcgtracking.com/product/188370_200w.jpg",
    colors: [],
    finishes: ["Normal", "Holo"],
    raw: {},
  };
}


test("Pokemon SKU omissions never manufacture Normal or English", async () => {
  const resolved = await resolveTcgProductSkus({
    gameId: TCGTRACKING_POKEMON_GAME_ID, providerProductId: "188370", setId: "swsh4",
    client: {
      product: async () => pokemonProduct({ providerProductId: "188370" }),
      skus: async () => [{ providerSkuId: "unknown", providerProductId: "188370", raw: {} }],
      pricing: async () => [],
    },
  });
  assert.equal(resolved.skus[0]?.variant, "");
  assert.equal(resolved.skus[0]?.language, "");
  assert.equal(resolved.skus[0]?.condition, "Condition unavailable");
  assert.equal(resolved.skus[0]?.marketPrice, null);
});
