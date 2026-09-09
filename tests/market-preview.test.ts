import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAME_TABS } from "../src/lib/card-artwork/demo-market-artwork.ts";
import { createDemoMarketCards, calculateDemoMarketTick, advanceDemoFeed, calculateSuggestedAction, calculateOpportunityScore, rankPreviewCards, formatMarketValue, formatMovePercent, startDemoTickLoop, DEMO_TICK_MS, MAX_PRICE_DRIFT } from "../src/lib/market-preview.ts";

test("opening snapshots and histories are stable, game-specific and financially consistent", () => {
  const prices = new Set<string>();
  for (const game of GAME_TABS) {
    const cards = createDemoMarketCards(game.id);
    assert.deepEqual(cards, createDemoMarketCards(game.id));
    prices.add(cards.map(card => card.marketPrice).join(","));
    assert.ok(cards.some(card => card.change24h < 0));
    assert.ok(cards.some(card => card.unrealized < 0));
    for (const card of cards) {
      assert.equal(card.tick, 0);
      assert.equal(card.history.at(-1), card.marketPrice);
      assert.ok(card.history.every(value => Number.isFinite(value) && value > 0));
      assert.ok(card.listed <= card.owned);
      assert.equal(card.unrealized, Math.round((card.marketPrice - card.averageCost) * card.owned * 100) / 100);
      assert.equal(card.opportunityScore, calculateOpportunityScore(card));
    }
  }
  assert.equal(prices.size, GAME_TABS.length);
});

test("long-running ticks stay bounded and derive percentage changes from the current quote", () => {
  for (const game of GAME_TABS) for (const seed of createDemoMarketCards(game.id)) {
    let card = seed;
    let rose = false; let fell = false;
    for (let tick = 1; tick <= 1000; tick++) {
      const next = calculateDemoMarketTick(card, tick);
      assert.deepEqual(next, calculateDemoMarketTick(card, tick));
      assert.ok(next.marketPrice >= seed.marketPrice * (1 - MAX_PRICE_DRIFT) - 1e-9);
      assert.ok(next.marketPrice <= seed.marketPrice * (1 + MAX_PRICE_DRIFT) + 1e-9);
      assert.ok(Math.abs(next.marketPrice - card.marketPrice) <= Math.max(0.01, seed.marketPrice * 0.003) + 0.0051);
      assert.ok(next.opportunityScore >= 0 && next.opportunityScore <= 100);
      assert.ok(Math.abs(next.opportunityScore - seed.opportunityScore) <= 8);
      assert.ok(next.bid <= next.marketPrice && next.ask >= next.marketPrice);
      assert.ok(next.sellThrough >= 0 && next.sellThrough <= 100);
      assert.equal(next.history.at(-1), next.marketPrice);
      assert.deepEqual(next.history.slice(0, -1), seed.history.slice(0, -1));
      assert.ok(Math.abs(next.change24h - ((next.marketPrice / seed.marketPrice * (1 + seed.change24h / 100) - 1) * 100)) <= 0.0051);
      rose ||= next.direction > 0; fell ||= next.direction < 0;
      card = next;
    }
    assert.ok(rose && fell);
  }
});

test("a feed tick updates only one card and preserves the other object identities", () => {
  const feed = { cards: createDemoMarketCards("magic"), tick: 0 };
  const next = advanceDemoFeed(feed);
  assert.equal(next.tick, 1);
  assert.equal(next.cards.filter((card, index) => card !== feed.cards[index]).length, 1);
  assert.equal(next.cards[0].updatedAtTick, 1);
  assert.equal(feed.cards[0].tick, 0);
  assert.equal(advanceDemoFeed(next).cards[1].updatedAtTick, 2);
});

test("action thresholds determine changes and use owned/listed quantities", () => {
  const base = { ...createDemoMarketCards("magic")[0], volumeScore: 78, spreadPercent: 8, listed: 2, owned: 6, change24h: 1.79, opportunityScore: 66 };
  assert.equal(calculateSuggestedAction(base), "LIST");
  assert.equal(calculateSuggestedAction({ ...base, change24h: 1.8 }), "REPRICE");
  assert.equal(calculateSuggestedAction({ ...base, change24h: -0.5 }), "REPRICE");
  assert.equal(calculateSuggestedAction({ ...base, volumeScore: 77 }), "HOLD");
  assert.equal(calculateSuggestedAction({ ...base, opportunityScore: 65 }), "HOLD");
  assert.equal(calculateSuggestedAction({ ...base, owned: 2 }), "HOLD");
  assert.equal(calculateSuggestedAction({ ...base, spreadPercent: 17 }), "REVIEW");
  assert.equal(calculateSuggestedAction({ ...base, volumeScore: 47 }), "REVIEW");
  assert.ok(calculateOpportunityScore({ ...createDemoMarketCards("magic")[0], spreadPercent: 18 }) < calculateOpportunityScore({ ...createDemoMarketCards("magic")[0], spreadPercent: 12 }));
});

test("signal ranking is specific to price movement, demand, spread and position", () => {
  const cards = createDemoMarketCards("magic");
  const orders = new Set(["trending", "movers", "volume", "opportunities"].map(mode => rankPreviewCards(cards, mode as "trending").map(card => card.id).join(",")));
  assert.ok(orders.size >= 3);
  assert.equal(rankPreviewCards(cards, "opportunities")[0].spreadPercent, Math.max(...cards.map(card => card.spreadPercent)));
  assert.equal(rankPreviewCards(cards, "volume")[0].volumeScore, Math.max(...cards.map(card => card.volumeScore)));
});

test("formatting handles signed, zero and invalid values without NaN output", () => {
  assert.equal(formatMarketValue(23.94), "$23.94");
  assert.equal(formatMovePercent(1.34), "+1.34%");
  assert.equal(formatMovePercent(-0.82), "-0.82%");
  assert.equal(formatMovePercent(0), "0.00%");
  assert.equal(formatMovePercent(-0.001), "0.00%");
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(formatMarketValue(value), "—");
    assert.equal(formatMovePercent(value), "—");
  }
});

test("the tick loop stays idle when paused and disposes its interval", context => {
  context.mock.timers.enable({ apis: ["setInterval"] });
  let count = 0;
  startDemoTickLoop(() => count++, false);
  context.mock.timers.tick(DEMO_TICK_MS * 3);
  assert.equal(count, 0);
  const stop = startDemoTickLoop(() => count++, true);
  context.mock.timers.tick(DEMO_TICK_MS * 2);
  assert.equal(count, 2);
  stop();
  context.mock.timers.tick(DEMO_TICK_MS * 3);
  assert.equal(count, 2);
});

test("SSR code has no random/clock seeds and reduced motion has CSS and lifecycle guards", () => {
  const model = readFileSync(new URL("../src/lib/market-preview.ts", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../src/components/landing/useDemoMarketTicks.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/components/landing/MarketPreview.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(model, /Math\.random|Date\.now|new Date/);
  assert.match(hook, /!reducedMotion && !paused/);
  assert.match(hook, /observer\.disconnect/);
  assert.match(hook, /removeEventListener/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
});
