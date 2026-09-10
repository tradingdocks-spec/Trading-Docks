import { sampleCards, type MarketCard, type MarketMode } from "./card-artwork/demo-market-artwork.ts";
import type { ArtworkGame } from "./card-artwork/providers/index.ts";

export const DEMO_TICK_MS = 3200;
export const MAX_PRICE_DRIFT = 0.025;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cents = (value: number) => Math.round(value * 100) / 100;
const seedFor = (id: string) => [...id].reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 7);

export type PreviewCard = MarketCard & {
  opening: { price: number; change24h: number; change7d: number; demand: number; spread: number; sellThrough: number };
  owned: number;
  listed: number;
  averageCost: number;
  unrealized: number;
  bid: number;
  ask: number;
  spreadPercent: number;
  sellThrough: number;
  history: number[];
  tick: number;
  updatedAtTick: number;
  direction: number;
  reason: string;
  actionCopies: number;
};

export function calculateOpportunityScore(card: Pick<PreviewCard, "volumeScore" | "spreadPercent" | "owned" | "listed" | "change7d">) {
  // A modest gap contributes to opportunity; a very wide gap adds uncertainty, not free profit.
  return clamp(Math.round(card.volumeScore * 0.48 + Math.min(card.spreadPercent, 12) * 1.2 - Math.max(0, card.spreadPercent - 12) * 2
    + Math.min(card.owned - card.listed, 8) * 3 + clamp(card.change7d, -10, 10) * 0.8), 0, 100);
}

export function calculateSuggestedAction(card: Pick<PreviewCard, "volumeScore" | "spreadPercent" | "listed" | "owned" | "change24h" | "opportunityScore">): MarketCard["suggestedAction"] {
  if (card.spreadPercent >= 17 || card.volumeScore < 48) return "REVIEW";
  if (card.listed > 0 && (card.change24h <= -0.5 || card.change24h >= 1.8)) return "REPRICE";
  if (card.owned > card.listed && card.volumeScore >= 78 && card.opportunityScore >= 66) return "LIST";
  return "HOLD";
}

function derivePosition(card: PreviewCard): PreviewCard {
  const opportunityScore = calculateOpportunityScore(card);
  const suggestedAction = calculateSuggestedAction({ ...card, opportunityScore });
  const reason = suggestedAction === "REVIEW" ? "Wide spread or softer demand; check the position first."
    : suggestedAction === "REPRICE" ? "The quote has moved away from your listed position."
    : suggestedAction === "LIST" ? "Strong demo demand meets copies ready to list."
    : "No action threshold crossed; keep the position in view.";
  return { ...card, opportunityScore, suggestedAction, reason,
    demand: card.volumeScore >= 78 ? "High" : "Medium",
    bid: cents(card.marketPrice * (1 - card.spreadPercent / 200)), ask: cents(card.marketPrice * (1 + card.spreadPercent / 200)),
    unrealized: cents((card.marketPrice - card.averageCost) * card.owned),
    actionCopies: suggestedAction === "REPRICE" ? card.listed : suggestedAction === "LIST" ? card.owned - card.listed : card.owned };
}

export function createDemoMarketCards(game: ArtworkGame): PreviewCard[] {
  return sampleCards(game).map((card, index) => {
    const seed = seedFor(card.id);
    const volumeScore = [83, 64, 94, 71, 88][index] - seed % 7;
    const spreadPercent = [8.6, 14.3, 18.2, 11.7, 7.8][index] + (seed % 11) / 10;
    const sellThrough = cents(volumeScore * 0.76 + (seed % 10));
    const change24h = cents(card.change24h + ((seed % 13) - 6) / 100);
    const change7d = cents(card.change7d + ((seed % 31) - 15) / 100);
    const start = card.marketPrice / (1 + change7d / 100);
    const history = Array.from({ length: 15 }, (_, point) => {
      const progress = point / 14;
      // Fixed seven-day path. Ticks change its final quote, not the time axis.
      return cents(start + (card.marketPrice - start) * progress + Math.sin(point * 1.7 + seed % 9) * Math.sin(progress * Math.PI) * card.marketPrice * 0.006);
    });
    const owned = [6, 4, 2, 8, 5][index];
    return derivePosition({ ...card, change24h, change7d, volumeScore, spreadPercent, sellThrough,
      opening: { price: card.marketPrice, change24h, change7d, demand: volumeScore, spread: spreadPercent, sellThrough },
      owned, listed: [2, 3, 0, 5, 1][index], averageCost: cents(card.marketPrice * [0.78, 1.08, 0.91, 1.04, 0.82][index]),
      history, tick: 0, updatedAtTick: 0, direction: 0, bid: 0, ask: 0, unrealized: 0, reason: "", actionCopies: owned });
  });
}

export function calculateDemoMarketTick(card: PreviewCard, tickIndex: number): PreviewCard {
  const phase = (seedFor(card.id) % 628) / 100;
  const activity = card.opening.demand >= 78 ? 0.011 : 0.007;
  const wave = Math.sin(phase + tickIndex * 0.24) - Math.sin(phase);
  const target = card.opening.price * (1 + clamp(wave * activity, -MAX_PRICE_DRIFT, MAX_PRICE_DRIFT));
  // Both total deviation and each individual step are limited. Rounding stays inside the total bound.
  const low = Math.ceil(card.opening.price * (1 - MAX_PRICE_DRIFT) * 100) / 100;
  const high = Math.floor(card.opening.price * (1 + MAX_PRICE_DRIFT) * 100) / 100;
  const step = Math.max(0.01, card.opening.price * 0.003);
  const marketPrice = clamp(cents(clamp(target, card.marketPrice - step, card.marketPrice + step)), low, high);
  const drift = marketPrice / card.opening.price;
  const volumeScore = clamp(Math.round(card.opening.demand + wave * 2), 1, 99);
  return derivePosition({ ...card, marketPrice,
    change24h: cents((drift * (1 + card.opening.change24h / 100) - 1) * 100),
    change7d: cents((drift * (1 + card.opening.change7d / 100) - 1) * 100),
    volumeScore, spreadPercent: cents(card.opening.spread + wave * 0.65),
    sellThrough: cents(clamp(card.opening.sellThrough + (volumeScore - card.opening.demand) * 0.45, 0, 100)),
    history: [...card.history.slice(0, -1), marketPrice], tick: tickIndex, direction: Math.sign(marketPrice - card.marketPrice) });
}

export type DemoFeed = { cards: PreviewCard[]; tick: number };
export function advanceDemoFeed(feed: DemoFeed): DemoFeed {
  if (!feed.cards.length) return feed;
  const tick = feed.tick + 1;
  // A single quote changes per interval. Unchanged cards retain their object identity.
  const selected = feed.tick % feed.cards.length;
  return { tick, cards: feed.cards.map((card, index) => index === selected
    ? { ...calculateDemoMarketTick(card, card.tick + 1), updatedAtTick: tick } : card) };
}

export function rankPreviewCards(cards: PreviewCard[], mode: MarketMode): PreviewCard[] {
  const score = (card: PreviewCard) => mode === "movers" ? Math.abs(card.change24h) * 2 + Math.abs(card.change7d)
    : mode === "volume" ? card.volumeScore + card.sellThrough * 0.3
    : mode === "opportunities" ? card.spreadPercent
    : card.opportunityScore + Math.min(card.owned, 10) * 1.5 + Math.abs(card.change24h);
  return [...cards].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function formatMarketValue(value: number) { return Number.isFinite(value) ? usd.format(value) : "—"; }
export function formatMovePercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  const rounded = cents(value);
  return `${rounded > 0 ? "+" : ""}${Object.is(rounded, -0) ? "0.00" : rounded.toFixed(2)}%`;
}
export function formatGain(value: number) { return `${value > 0 ? "+" : ""}${formatMarketValue(value)}`; }

export function startDemoTickLoop(onTick: () => void, enabled: boolean) {
  if (!enabled) return () => {};
  const interval = setInterval(onTick, DEMO_TICK_MS);
  return () => clearInterval(interval);
}
