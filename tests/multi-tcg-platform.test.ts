import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  activeSupportedGames,
  gameAwareSearchResult,
  getGameByTcgTrackingCategory,
  getGameByTcgTrackingGameId,
  getSupportedGame,
  inventoryGameIdentityFromRow,
  inventoryIdentityKey,
  isGameCapabilitySupported,
  magicCatalogRowToGenericProduct,
  marketSnapshotForGame,
  productInspectorFromSku,
  productFromTcgTrackingProduct,
  runMultiTcgProviderProof,
  sealedProductFromTcgTracking,
  skuFromTcgTrackingSku,
  TCGTRACKING_MAGIC_CATEGORY_ID,
  TCGTRACKING_MAGIC_GAME_ID,
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  variantVocabularyForGame,
} from "../src/lib/multi-tcg/index.ts";
import {
  normalizeTcgTrackingScanProviderRequest,
} from "../src/lib/providers/tcgtracking/index.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("supported game registry keeps Magic production and Pokemon beta categories explicit", () => {
  assert.equal(getSupportedGame("magic")?.status, "production");
  assert.equal(getSupportedGame("mtg")?.tcgTrackingCategoryId, "1");
  assert.equal(getSupportedGame("pokemon")?.status, "beta");
  assert.equal(getSupportedGame("ptcg")?.tcgTrackingCategoryId, "3");
  assert.equal(getGameByTcgTrackingCategory(TCGTRACKING_MAGIC_CATEGORY_ID)?.id, "magic");
  assert.equal(getGameByTcgTrackingCategory(TCGTRACKING_POKEMON_CATEGORY_ID)?.id, "pokemon");
  assert.equal(getGameByTcgTrackingGameId(TCGTRACKING_MAGIC_GAME_ID)?.id, "magic");
  assert.equal(getGameByTcgTrackingGameId(TCGTRACKING_POKEMON_GAME_ID)?.id, "pokemon");
  assert.deepEqual(
    activeSupportedGames().map((game) => game.id),
    ["magic", "pokemon"],
  );
});

test("Magic-only platform capabilities do not leak into Pokemon", () => {
  assert.equal(isGameCapabilitySupported("magic", "scryfall"), true);
  assert.equal(isGameCapabilitySupported("magic", "manapool"), true);
  assert.equal(isGameCapabilitySupported("magic", "commander"), true);
  assert.equal(isGameCapabilitySupported("pokemon", "scryfall"), false);
  assert.equal(isGameCapabilitySupported("pokemon", "manapool"), false);
  assert.equal(isGameCapabilitySupported("pokemon", "commander"), false);
});

test("TCGTracking card and sealed products adapt into generic catalog identity", () => {
  const pokemonProduct = productFromTcgTrackingProduct({
    providerProductId: "553927",
    categoryId: "3",
    setId: "sv08",
    tcgplayerProductId: 553927,
    name: "Pikachu ex",
    setName: "Surging Sparks",
    setCode: "SV08",
    collectorNumber: "057/191",
    rarity: "Double Rare",
    imageUrl: "https://images.example.test/pikachu.jpg",
    colors: [],
    finishes: ["Holofoil", "Reverse Holofoil"],
    raw: {},
  });
  assert.equal(pokemonProduct.game.id, "pokemon");
  assert.equal(pokemonProduct.productType, "card");
  assert.equal(pokemonProduct.externalIds.scryfallId, undefined);
  assert.deepEqual(pokemonProduct.gameSpecific, {
    variants: ["Holofoil", "Reverse Holofoil"],
  });

  const sealedProduct = sealedProductFromTcgTracking({
    providerProductId: "999001",
    categoryId: "3",
    setId: "sv08",
    tcgplayerProductId: 999001,
    name: "Surging Sparks Booster Box",
    productType: "Booster Box",
    imageUrl: "https://images.example.test/box.jpg",
    marketPrice: 146.25,
    lowPrice: 139.99,
    highPrice: 175,
    raw: {},
  });
  assert.equal(sealedProduct.game.id, "pokemon");
  assert.equal(sealedProduct.productType, "sealed");
  assert.equal(sealedProduct.gameSpecific.sealedType, "Booster Box");
});

test("SKU identity preserves per-game condition variant and language without Magic foil assumptions", () => {
  const product = productFromTcgTrackingProduct({
    providerProductId: "553927",
    categoryId: "3",
    tcgplayerProductId: 553927,
    name: "Pikachu ex",
    colors: [],
    finishes: ["Holofoil", "Reverse Holofoil"],
    raw: {},
  });
  const sku = skuFromTcgTrackingSku(
    {
      providerSkuId: "777",
      providerProductId: "553927",
      tcgplayerSkuId: 777,
      tcgplayerProductId: 553927,
      condition: "Near Mint",
      variant: "Reverse Holofoil",
      language: "English",
      marketPrice: 8.32,
      lowPrice: 7.5,
      highPrice: 11,
      activeListings: 42,
      manapoolLow: 5,
      raw: {},
    },
    product,
  );

  assert.equal(sku.game.id, "pokemon");
  assert.equal(sku.variant, "Reverse Holofoil");
  assert.equal(sku.language, "English");
  assert.equal(sku.marketPrice.manapoolLow, null);
  assert.equal(sku.marketPrice.crossMarketSpread, null);
});

test("variant vocabularies are game-specific and use generic variant language", () => {
  assert.deepEqual(variantVocabularyForGame("magic"), ["Normal", "Foil", "Etched"]);
  assert.deepEqual(variantVocabularyForGame("pokemon"), ["Normal", "Holofoil", "Reverse Holofoil"]);
});

test("Magic catalog rows adapt through the generic interface without replacing the table", () => {
  const adapted = magicCatalogRowToGenericProduct({
    tcgplayer_id: 123456,
    product_line: "Magic",
    set_name: "Innistrad: Midnight Hunt",
    set_code: "MID",
    product_name: "Unblinking Observer",
    collector_number: "82",
    condition: "Near Mint",
    finish: "Foil",
    language: "English",
    photo_url: "https://images.example.test/unblinking.jpg",
    tcg_market_price: "0.23",
    tcg_low_price: "0.16",
    tcg_high_price: "0.5",
  });

  assert.equal(adapted?.product.game.id, "magic");
  assert.equal(adapted?.product.provider, "tcgplayer");
  assert.equal(adapted?.product.gameSpecific.sourceTable, "tcgplayer_magic_catalog");
  assert.equal(adapted?.sku.variant, "Foil");
  assert.equal(adapted?.sku.marketPrice.tcgMarket, 0.23);
});

test("market snapshots keep ManaPool Magic-only", () => {
  const snapshot = {
    tcgMarket: 10,
    tcgLow: 8,
    tcgHigh: 12,
    activeListings: 80,
    manapoolLow: 7,
    updatedAt: new Date().toISOString(),
  };
  assert.equal(marketSnapshotForGame(snapshot, "magic").manapoolLow, 7);
  assert.equal(marketSnapshotForGame(snapshot, "magic").crossMarketSpread, 1);
  assert.equal(marketSnapshotForGame(snapshot, "pokemon").manapoolLow, null);
  assert.equal(marketSnapshotForGame(snapshot, "pokemon").crossMarketSpread, null);
});

test("inventory identity keys include game product type SKU variant and language", () => {
  const magicIdentity = inventoryGameIdentityFromRow({
    card_name: "Lightning Bolt",
    set_code: "SLD",
    collector_number: "123",
    scryfall_id: "8b11",
    data: { condition: "Near Mint", finish: "Foil", language: "English" },
  });
  const pokemonIdentity = inventoryGameIdentityFromRow({
    game_id: "pokemon",
    product_type: "card",
    card_name: "Lightning Bolt",
    provider_product_id: "pokemon-1",
    provider_sku_id: "pokemon-sku-1",
    data: { condition: "Near Mint", variant: "Holofoil", language: "English" },
  });

  assert.equal(magicIdentity.gameId, "magic");
  assert.equal(pokemonIdentity.gameId, "pokemon");
  assert.notEqual(
    inventoryIdentityKey(magicIdentity),
    inventoryIdentityKey(pokemonIdentity),
  );

  const english = inventoryGameIdentityFromRow({
    game_id: "pokemon",
    product_type: "card",
    provider_product_id: "pokemon-1",
    provider_sku_id: "pokemon-sku-1",
    data: { condition: "Near Mint", variant: "Holofoil", language: "English" },
  });
  const japanese = inventoryGameIdentityFromRow({
    game_id: "pokemon",
    product_type: "card",
    provider_product_id: "pokemon-1",
    provider_sku_id: "pokemon-sku-1",
    data: { condition: "Near Mint", variant: "Holofoil", language: "Japanese" },
  });
  assert.notEqual(inventoryIdentityKey(english), inventoryIdentityKey(japanese));
});

test("global search labels identify the game without calling Magic-only providers for Pokemon", () => {
  const product = productFromTcgTrackingProduct({
    providerProductId: "553927",
    categoryId: "3",
    name: "Charizard ex",
    setName: "Obsidian Flames",
    setCode: "OBF",
    collectorNumber: "125/197",
    colors: [],
    finishes: ["Holofoil"],
    raw: {},
  });
  const result = gameAwareSearchResult(product);
  assert.equal(result.game.id, "pokemon");
  assert.equal(result.label, "[PKM] Charizard ex");
  assert.match(result.subtitle ?? "", /Pokemon/);
  assert.doesNotMatch(result.subtitle ?? "", /Scryfall/);
});

test("Product Inspector keeps generic identity shared and Magic extensions isolated", () => {
  const magicProduct = productFromTcgTrackingProduct({
    providerProductId: "123",
    categoryId: "1",
    name: "Arcane Signet",
    setName: "Commander Legends",
    setCode: "CMR",
    collectorNumber: "312",
    scryfallId: "scryfall-arcane",
    mtgjsonUuid: "mtgjson-arcane",
    manaValue: 2,
    colors: [],
    finishes: ["Normal", "Foil"],
    raw: {},
  });
  const magicSku = skuFromTcgTrackingSku(
    {
      providerSkuId: "magic-sku",
      providerProductId: "123",
      condition: "Near Mint",
      variant: "Foil",
      language: "English",
      marketPrice: 1.25,
      manapoolLow: 1,
      raw: {},
    },
    magicProduct,
  );
  const pokemonProduct = productFromTcgTrackingProduct({
    providerProductId: "553927",
    categoryId: "3",
    name: "Pikachu ex",
    setName: "Surging Sparks",
    setCode: "SV08",
    collectorNumber: "057/191",
    colors: [],
    finishes: ["Holofoil"],
    raw: {},
  });
  const pokemonSku = skuFromTcgTrackingSku(
    {
      providerSkuId: "pokemon-sku",
      providerProductId: "553927",
      condition: "Near Mint",
      variant: "Holofoil",
      language: "English",
      marketPrice: 8.32,
      raw: {},
    },
    pokemonProduct,
  );

  const magicInspector = productInspectorFromSku(magicSku);
  const pokemonInspector = productInspectorFromSku(pokemonSku);

  assert.equal(magicInspector.game.id, "magic");
  assert.equal(magicInspector.magic?.scryfallId, "scryfall-arcane");
  assert.equal(magicInspector.magic?.manapoolLow, 1);
  assert.equal(pokemonInspector.game.id, "pokemon");
  assert.equal(pokemonInspector.productNumber, "057/191");
  assert.equal(pokemonInspector.variant, "Holofoil");
  assert.equal(pokemonInspector.magic, undefined);
});

test("scanner request accepts Magic and Pokemon game contexts and rejects unsupported ids", () => {
  const base = Buffer.from("ok").toString("base64");
  const magic = normalizeTcgTrackingScanProviderRequest({ image: base });
  const pokemon = normalizeTcgTrackingScanProviderRequest({
    image: base,
    gameId: 3,
    limit: 10,
  });
  const unsupported = normalizeTcgTrackingScanProviderRequest({
    image: base,
    gameId: 62,
  });

  assert.equal(magic.ok, true);
  if (magic.ok) assert.equal(magic.request.gameId, 1);
  assert.equal(pokemon.ok, true);
  if (pokemon.ok) {
    assert.equal(pokemon.request.gameId, 3);
    assert.equal(pokemon.request.limit, 10);
  }
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.status, 400);
});

test("provider proof harness reports Pokemon card sealed SKU and pricing coverage", async () => {
  const proof = await runMultiTcgProviderProof({
    client: {
      categories: async () => [
        { id: "1", name: "Magic: The Gathering" },
        { id: "3", name: "Pokemon" },
      ],
      sets: async (category) => [
        {
          id: category === "3" ? "sv08" : "mid",
          categoryId: category,
          name: category === "3" ? "Surging Sparks" : "Innistrad: Midnight Hunt",
          abbreviation: category === "3" ? "SV08" : "MID",
        },
      ],
      cards: async (category) => category === "3"
        ? [
            {
              providerProductId: "553927",
              categoryId: "3",
              name: "Pikachu ex",
              tcgplayerProductId: 553927,
              collectorNumber: "057/191",
              imageUrl: "https://images.example.test/pikachu.jpg",
              colors: [],
              finishes: ["Holofoil"],
              raw: {},
            },
          ]
        : [],
      sealed: async (category) => category === "3"
        ? [
            {
              providerProductId: "999001",
              categoryId: "3",
              name: "Surging Sparks Elite Trainer Box",
              productType: "Elite Trainer Box",
              imageUrl: "https://images.example.test/etb.jpg",
              raw: {},
            },
          ]
        : [],
      skus: async (category) => category === "3"
        ? [
            {
              providerSkuId: "777",
              variant: "Reverse Holofoil",
              language: "English",
              raw: {},
            },
          ]
        : [],
      pricing: async (category) => category === "3"
        ? [
            {
              tcgMarket: 8.32,
              tcgLow: 7.5,
              tcgHigh: 11,
              activeListings: 42,
              manapoolLow: null,
              updatedAt: new Date().toISOString(),
            },
          ]
        : [],
    },
  });

  assert.equal(proof.pokemonProof?.status, "available");
  assert.equal(proof.pokemonProof?.sampleSet?.id, "sv08");
  assert.equal(proof.pokemonProof?.cardCount, 1);
  assert.equal(proof.pokemonProof?.sealedCount, 1);
  assert.deepEqual(proof.pokemonProof?.variants, ["Reverse Holofoil"]);
});

test("multi-TCG schema proposals are category-aware and do not replace Magic authority", () => {
  const cacheMigration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608110002_tcgtracking_enrichment_cache_proposal.sql"),
    "utf8",
  );
  const inventoryMigration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608120001_multi_tcg_inventory_identity_proposal.sql"),
    "utf8",
  );

  assert.match(cacheMigration, /category_id text not null/);
  assert.doesNotMatch(cacheMigration, /tcgtracking_magic_/);
  assert.match(inventoryMigration, /add column if not exists game_id text/);
  assert.match(inventoryMigration, /add column if not exists product_type text/);
  assert.match(inventoryMigration, /add column if not exists tcgplayer_sku_id bigint/);
  assert.doesNotMatch(inventoryMigration, /product_type text not null default 'card'/);
  assert.match(inventoryMigration, /set product_type = 'sealed'/);
  assert.match(inventoryMigration, /alter column product_type set default 'card'/);
  assert.match(inventoryMigration, /inventory_items_user_game_provider_sku_idx/);
  assert.doesNotMatch(inventoryMigration, /drop table/i);
  assert.doesNotMatch(inventoryMigration, /drop column/i);
  assert.doesNotMatch(inventoryMigration, /drop constraint/i);
  assert.doesNotMatch(inventoryMigration, /tcgplayer_magic_catalog/);
});
