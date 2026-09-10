import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME_TABS, sampleCards, resolveDemoCardArtwork, selectFeaturedCard, artworkIssues, artworkLayoutIssues, rankCards } from "../src/lib/card-artwork/demo-market-artwork.ts";
import { isApprovedArtworkUrl } from "../src/lib/card-artwork/providers/index.ts";

for (const game of GAME_TABS) test(`${game.label} has verified exact printings for every visible card and signal mode`, () => {
  const cards = sampleCards(game.id);
  assert.ok(cards.length >= 3);
  for (const card of cards) {
    assert.equal(card.hasVerifiedArtwork, true);
    assert.ok(card.imageUrl && card.thumbnailUrl && card.attributionLabel && card.providerCardUrl);
    assert.deepEqual(artworkIssues(card), []);
    assert.equal(card.imageSource, card.provider);
    if (game.id === "pokemon-japan") {
      assert.equal(card.language, "Japanese");
      assert.match(card.imageUrl, /\/ja\//);
      assert.match(card.name, /[\u3040-\u30ff]/);
    }
    if (game.id !== "magic") assert.notEqual(card.provider, "scryfall");
  }
  for (const mode of ["trending", "movers", "volume", "opportunities"] as const) {
    assert.ok(selectFeaturedCard(rankCards(cards, mode))?.hasVerifiedArtwork);
  }
});

test("unknown IDs and mismatched printing identities return null, never false verification", () => {
  const card = sampleCards("pokemon")[0];
  for (const patch of [{ providerId: "unknown" }, { collectorNumber: "999" }, { name: "Another card" }, { language: "Japanese" as const }]) {
    const result = resolveDemoCardArtwork({ ...card, ...patch });
    assert.equal(result.imageUrl, null);
    assert.equal(result.thumbnailUrl, null);
    assert.equal(result.hasVerifiedArtwork, false);
  }
});

test("missing, empty, unverified and unsupported images cannot become featured", () => {
  const card = sampleCards("magic")[0];
  for (const patch of [{ imageUrl: null }, { imageUrl: "" }, { thumbnailUrl: null }, { hasVerifiedArtwork: false }, { imageUrl: "https://unapproved.example/card.jpg" }]) {
    const broken = { ...card, ...patch };
    assert.equal(selectFeaturedCard([broken]), null);
    assert.ok(artworkIssues(broken, true).length);
    assert.ok(artworkLayoutIssues([broken], "normal").length);
    assert.deepEqual(artworkLayoutIssues([broken], "preview"), []);
    assert.equal(selectFeaturedCard([broken, card]), card);
  }
  assert.equal(selectFeaturedCard([]), null);
});

test("provider validation rejects protocol, credentials, host and Japanese-language mismatches", () => {
  for (const url of ["", null, "http://cards.scryfall.io/a.jpg", "https://cards.scryfall.io.evil.test/a.jpg", "https://user@cards.scryfall.io/a.jpg"]) assert.equal(isApprovedArtworkUrl("scryfall", "magic", url), false);
  assert.equal(isApprovedArtworkUrl("scryfall", "pokemon", "https://cards.scryfall.io/a.jpg"), false);
  assert.equal(isApprovedArtworkUrl("tcgdex", "pokemon-japan", "https://assets.tcgdex.net/en/a.webp"), false);
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  for (const game of GAME_TABS) for (const card of sampleCards(game.id)) assert.ok(config.includes(`hostname: "${new URL(card.imageUrl!).hostname}"`));
});
