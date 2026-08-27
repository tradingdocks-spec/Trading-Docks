import { rankPrintingCandidates } from "./ranking.ts";
import { ScryfallCatalogProvider } from "./scryfall-provider.ts";
import { TcgTrackingCatalogProvider } from "./tcgtracking-provider.ts";
import type { CanonicalPrinting, CardCatalogProvider, CardRecognitionResult, CardRecognitionSignals } from "./types.ts";
import { MemoryCardIntelligenceCache } from "./infrastructure.ts";

const DEFAULT_LIMIT = 5;
const PROVIDER_TIMEOUT_MS = 4000;
const defaultCache = new MemoryCardIntelligenceCache();

export async function recognizeCard(
  signals: CardRecognitionSignals,
  options: { providers?: CardCatalogProvider[]; seedCandidates?: CanonicalPrinting[]; limit?: number; signal?: AbortSignal; cache?: import("./types.ts").CardIntelligenceCache } = {},
): Promise<CardRecognitionResult> {
  const providers = options.providers ?? [new ScryfallCatalogProvider(), new TcgTrackingCatalogProvider()];
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 10));
  const statuses: CardRecognitionResult["providers"] = [];
  const candidateSets = await Promise.all(providers.map(async (provider) => {
    const startedAt = Date.now();
    try {
      const candidates = await cachedProviderSearch(provider, signals, options.signal, options.cache ?? defaultCache);
      statuses.push({ id: provider.id, status: "available", latencyMs: Date.now() - startedAt });
      return candidates;
    } catch (error) {
      statuses.push({ id: provider.id, status: "failed", latencyMs: Date.now() - startedAt, error: safeError(error) });
      return [];
    }
  }));
  const ranked = rankPrintingCandidates(signals, [...(options.seedCandidates ?? []), ...candidateSets.flat()], limit);
  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const tooClose = Boolean(top && runnerUp && top.score - runnerUp.score < 0.06);
  const requiresConfirmation = !top || top.requiresConfirmation || tooClose;
  return {
    candidates: ranked.map((candidate, index) => index === 0 && tooClose ? {
      ...candidate,
      requiresConfirmation: true,
      reason: `${candidate.reason} Another printing is within the ambiguity margin.`,
    } : candidate),
    selectedPrintingId: top && !requiresConfirmation ? top.printingId : null,
    requiresConfirmation,
    preservedSignals: sanitizeSignals(signals),
    providers: statuses.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export async function searchCards(signals: CardRecognitionSignals, options: { providers?: CardCatalogProvider[]; limit?: number; signal?: AbortSignal } = {}) {
  return recognizeCard(signals, options);
}

export async function getPrinting(id: string, providers: CardCatalogProvider[] = [new ScryfallCatalogProvider(), new TcgTrackingCatalogProvider()]) {
  for (const provider of providers) {
    const printing = await provider.printing(id).catch(() => null);
    if (printing) return printing;
  }
  return null;
}

function sanitizeSignals(signals: CardRecognitionSignals): CardRecognitionSignals {
  return {
    ...signals,
    cardName: truncate(signals.cardName, 160), setName: truncate(signals.setName, 160), setCode: truncate(signals.setCode, 20),
    collectorNumber: truncate(signals.collectorNumber, 40), ocrText: truncate(signals.ocrText, 1500), imageHash: truncate(signals.imageHash, 256),
  };
}

async function cachedProviderSearch(provider: CardCatalogProvider, signals: CardRecognitionSignals, signal: AbortSignal | undefined, cache: import("./types.ts").CardIntelligenceCache) {
  const key = `${provider.id}:${JSON.stringify(sanitizeSignals(signals))}`;
  const cached = await cache.get(key);
  if (cached) return cached;
  const controller = new AbortController();
  const relay = () => controller.abort();
  signal?.addEventListener("abort", relay, { once: true });
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const candidates = await provider.search(signals, { limit: 25, signal: controller.signal });
    await cache.set(key, candidates, 5 * 60_000);
    return candidates;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", relay);
  }
}

function truncate(value: string | null | undefined, length: number) { return value == null ? value : value.trim().slice(0, length); }
function safeError(error: unknown) { const message = error instanceof Error ? error.message : "Provider unavailable."; return message.replace(/[\r\n]/g, " ").slice(0, 180); }
