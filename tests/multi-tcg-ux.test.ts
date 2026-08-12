import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectionGameEmptyTitle,
  displayGameBadge,
  getGameContextOptions,
  marketSourcesForGame,
  productIdentityLabel,
  variantLabelForGame,
  variantOptionsForGame,
} from "../src/lib/multi-tcg/index.ts";
import {
  filterCollectionCards,
  type CollectionCard,
} from "../mobile/services/collector-workspace.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("shared game context exposes All Magic and Pokemon Beta from the registry", () => {
  const options = getGameContextOptions();
  assert.deepEqual(options.map((option) => option.id), ["all", "magic", "pokemon"]);
  assert.equal(options.find((option) => option.id === "pokemon")?.status, "beta");
  assert.equal(displayGameBadge("pokemon"), "Pokemon Beta");
  assert.equal(collectionGameEmptyTitle("pokemon"), "No Pokemon Beta cards yet");
});

test("market source rules keep Magic providers out of Pokemon surfaces", () => {
  assert.deepEqual(marketSourcesForGame("magic"), [
    "Scryfall",
    "TCGplayer",
    "Mana Pool",
    "CardSphere",
    "Cardmarket",
  ]);
  assert.deepEqual(marketSourcesForGame("pokemon"), [
    "TCGplayer",
    "TCGTracking",
    "Cardmarket",
  ]);
  assert.equal(marketSourcesForGame("pokemon").includes("Scryfall"), false);
  assert.equal(marketSourcesForGame("pokemon").includes("Mana Pool"), false);
});

test("variant terminology adapts by game without changing stored identities", () => {
  assert.deepEqual(variantOptionsForGame("magic"), ["Nonfoil", "Foil", "Etched"]);
  assert.deepEqual(variantOptionsForGame("pokemon"), ["Normal", "Holo", "Reverse Holo"]);
  assert.equal(variantLabelForGame("magic", "normal"), "Nonfoil");
  assert.equal(variantLabelForGame("pokemon", "foil"), "Holo");
  assert.equal(variantLabelForGame("pokemon", "reverse holofoil"), "Reverse Holo");
});

test("collection game filter keeps same-name Magic and Pokemon products distinct", () => {
  const cards = [
    card({ id: "mtg-1", cardName: "Lightning Bolt", gameId: "magic", gameLabel: "Magic: The Gathering" }),
    card({ id: "pkm-1", cardName: "Lightning Bolt", gameId: "pokemon", gameLabel: "Pokemon" }),
  ];

  assert.deepEqual(filterCollectionCards(cards, { gameId: "all" }).map((item) => item.id), ["mtg-1", "pkm-1"]);
  assert.deepEqual(filterCollectionCards(cards, { gameId: "magic" }).map((item) => item.id), ["mtg-1"]);
  assert.deepEqual(filterCollectionCards(cards, { gameId: "pokemon" }).map((item) => item.id), ["pkm-1"]);
  assert.notEqual(
    productIdentityLabel({ gameId: cards[0].gameId, name: cards[0].cardName, setCode: "SLD", collectorNumber: "100" }),
    productIdentityLabel({ gameId: cards[1].gameId, name: cards[1].cardName, setCode: "SV08", collectorNumber: "100/191" }),
  );
});

test("visible multi-TCG surfaces consume the shared game context", () => {
  const collection = source("src/components/dashboard/collector-workspace/CollectorWorkspace.tsx");
  const scanner = source("src/components/dashboard/purchasing/CardPhotoScanner.tsx");
  const createMenu = source("src/components/dashboard/shell/create-menu-actions.ts");
  const deckVault = source("src/components/dashboard/deck-vault/DeckImportCenter.tsx");

  assert.match(collection, /GameContextControl/);
  assert.match(collection, /gameId: gameContext/);
  assert.match(collection, /Allocation by game/);
  assert.match(scanner, /GameContextControl/);
  assert.match(scanner, /Pokemon purchasing recognition is in beta/);
  assert.match(scanner, /Sources are scoped to/);
  assert.match(createMenu, /label: "Add inventory"/);
  assert.match(deckVault, /Scryfall/);
  assert.match(deckVault, /Commander/);
});

function source(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function card(overrides: Partial<CollectionCard>): CollectionCard {
  return {
    id: "card",
    cardName: "Card",
    gameId: "magic",
    gameLabel: "Magic: The Gathering",
    productType: "card",
    printing: {
      setCode: "SET",
      setName: "Set",
      collectorNumber: "1",
      language: "English",
      finish: "normal",
      imageUrl: null,
    },
    condition: "near_mint",
    quantityOwned: 1,
    storageLocation: null,
    tradeBinderStatus: "not_for_trade",
    wishlistStatus: "not_wishlisted",
    marketPrice: { amount: null, currency: "USD", source: "unavailable" },
    ...overrides,
  };
}
