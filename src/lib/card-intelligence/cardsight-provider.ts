import { CardSightAI } from "cardsightai";

import { recognizeCard } from "./service.ts";
import type { CanonicalPrinting, CardIntelligenceGame, CardRecognitionSignals } from "./types.ts";

const DEFAULT_BASE_URL = "https://api.cardsight.ai";
const DEFAULT_TIMEOUT_MS = 4500;

export type CardSightImageMode = "raw" | "cropped";

export type CardSightProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  identifyPath?: string;
  detectPath?: string;
  timeoutMs?: number;
  requestPriceUsd?: number | null;
  includedRequests?: number | null;
  planName?: string | null;
  fetch?: typeof fetch;
};

export type CardSightNormalizedHit = {
  source: "cardsight";
  game: "magic" | "pokemon" | "unknown";
  canonicalCardId: string | null;
  printingId: string | null;
  detectedSegment: string | null;
  name: string | null;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  language: string | null;
  finish: string | null;
  imageUrl: string | null;
  providerIds: Record<string, string | number>;
  confidence: number | null;
  latencyMs: number;
  raw: Record<string, unknown>;
};

export type CardSightUsageSnapshot = {
  requestCount: number;
  successCount: number;
  failureCount: number;
  medianLatencyMs: number | null;
  estimatedCostUsd: number | null;
  planName: string | null;
  includedRequests: number | null;
  requestPriceUsd: number | null;
};

export type CardSightRecognitionResult =
  | {
      ok: true;
      provider: "cardsight";
      status: "candidates";
      mode: CardSightImageMode;
      candidates: CardSightNormalizedHit[];
      topCandidate: CardSightNormalizedHit | null;
      intelligence: Awaited<ReturnType<typeof recognizeCard>>;
      metrics: CardSightUsageSnapshot;
    }
  | {
      ok: false;
      provider: "cardsight";
      status: "unavailable" | "timeout" | "malformed_response" | "provider_failed";
      mode: CardSightImageMode;
      reason: string;
      latencyMs: number | null;
      metrics: CardSightUsageSnapshot;
    };

export type CardSightSegmentSummary = {
  segmentCount: number;
  names: string[];
  ids: string[];
  matchedMagicSegmentId: string | null;
  matchedMagicSegmentName: string | null;
};

export type CardSightHealthCheckResult =
  | {
      ok: true;
      status: number;
      authenticated: true;
      latencyMs: number;
    }
  | {
      ok: false;
      status: number | null;
      authenticated: false;
      latencyMs: number | null;
      reason: string;
    };

type CardsightResponseItem = Record<string, unknown>;
type CardSightAttemptTrace = {
  endpoint: string;
  httpStatus: number | null;
  detectedSegment: string | null;
  candidateCount: number;
  topCandidateName: string | null;
  topCandidateSet: string | null;
  topCandidateCollectorNumber: string | null;
  topCandidateConfidence: number | null;
  rawProviderConfidence: unknown;
  parsingSucceeded: boolean;
};
type CardSightUsageState = { requestCount: number; successCount: number; failureCount: number; latencies: number[] };

const globalState = globalThis as typeof globalThis & { __cardsightUsageState__?: CardSightUsageState };
const segmentProbeCache = globalThis as typeof globalThis & {
  __cardsightSegmentSummary__?: CardSightSegmentSummary;
};

export class CardSightProvider {
  readonly id = "cardsight";
  private readonly config: Required<Pick<CardSightProviderConfig, "baseUrl" | "timeoutMs" | "fetch">> & CardSightProviderConfig;

  constructor(config: CardSightProviderConfig = {}) {
    this.config = {
      baseUrl: normalizeBaseUrl(config.baseUrl ?? process.env.CARDSIGHT_BASE_URL ?? DEFAULT_BASE_URL),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetch: config.fetch ?? fetch,
      apiKey: config.apiKey ?? process.env.CARDSIGHT_API_KEY,
      identifyPath: config.identifyPath,
      detectPath: config.detectPath,
      requestPriceUsd: config.requestPriceUsd ?? parseNullableNumber(process.env.CARDSIGHT_REQUEST_PRICE_USD),
      includedRequests: config.includedRequests ?? parseNullableInteger(process.env.CARDSIGHT_INCLUDED_REQUESTS),
      planName: config.planName ?? process.env.CARDSIGHT_PLAN_NAME?.trim() ?? null,
    };
  }

  isConfigured() {
    return Boolean(this.config.apiKey?.trim());
  }

  async healthCheck(signal?: AbortSignal): Promise<CardSightHealthCheckResult> {
    const started = Date.now();
    if (!this.isConfigured()) {
      return {
        ok: false,
        authenticated: false,
        status: null,
        latencyMs: null,
        reason: "CardSight API credentials are not configured on the server.",
      };
    }

    try {
      const client = this.createClient();
      const response = await withTimeout(
        client.health.checkAuth() as Promise<unknown>,
        this.config.timeoutMs,
        signal,
      ) as {
        error?: unknown;
        response?: { status?: number };
      };
      const status = response.response?.status ?? 200;
      if (response.error || status >= 400) {
        throw new Error(formatCardSightSdkError(response.error, status));
      }
      return {
        ok: true,
        authenticated: true,
        status,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        authenticated: false,
        status: extractStatus(error),
        latencyMs: Date.now() - started,
        reason: error instanceof Error ? error.message : "CardSight health check failed.",
      };
    }
  }

  async recognizeImage(input: {
    image: string;
    game: CardRecognitionSignals["game"];
    limit: number;
    mode?: CardSightImageMode;
    signal?: AbortSignal;
  }): Promise<CardSightRecognitionResult> {
    const started = Date.now();
    const mode = input.mode ?? "raw";
    if (!this.isConfigured()) {
      recordUsage(false, null);
      return {
        ok: false,
        provider: "cardsight",
        status: "unavailable",
        mode,
        reason: "CardSight API credentials are not configured on the server.",
        latencyMs: null,
        metrics: usageSnapshot(this.config),
      };
    }

    try {
      const client = this.createClient();
      const image = base64ToArrayBuffer(input.image);
      const response = await withTimeout(
        client.identify.card(image, { signal: input.signal }) as Promise<unknown>,
        this.config.timeoutMs,
        input.signal,
      ) as {
        data?: unknown;
        error?: unknown;
        response?: { status?: number };
      };
      const status = response.response?.status ?? 200;
      if (response.error || status >= 400) {
        throw new Error(formatCardSightSdkError(response.error, status));
      }

      const candidates = normalizeCardSightResponse(response.data, Date.now() - started);
      const trace = {
        endpoint: this.config.identifyPath ?? "/v1/identify/card",
        httpStatus: status,
        detectedSegment: candidates[0]?.detectedSegment ?? null,
        candidateCount: candidates.length,
        topCandidateName: candidates[0]?.name ?? null,
        topCandidateSet: candidates[0]?.setCode ?? candidates[0]?.setName ?? null,
        topCandidateCollectorNumber: candidates[0]?.collectorNumber ?? null,
        topCandidateConfidence: candidates[0]?.confidence ?? null,
        rawProviderConfidence: response.data && typeof response.data === "object"
          ? (response.data as Record<string, unknown>).confidence ?? null
          : null,
        parsingSucceeded: Boolean(candidates.length),
      };
      logCardSightResult(trace);
      if (!candidates.length) {
        recordUsage(false, Date.now() - started);
        return {
          ok: false,
          provider: "cardsight",
          status: "malformed_response",
          mode,
          reason: "CardSight returned no usable identification candidates.",
          latencyMs: Date.now() - started,
          metrics: usageSnapshot(this.config),
        };
      }

      recordUsage(true, Date.now() - started);
      const topCandidate = candidates[0] ?? null;
      const intelligence = await recognizeCard(candidateToSignals(topCandidate), {
        seedCandidates: candidates.map((candidate) => candidateToSeedCandidate(candidate)),
        limit: Math.max(1, Math.min(input.limit, 10)),
      });
      return {
        ok: true,
        provider: "cardsight",
        status: "candidates",
        mode,
        candidates,
        topCandidate,
        intelligence,
        metrics: usageSnapshot(this.config),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "CardSight identification failed.";
      recordUsage(false, Date.now() - started);
      logCardSightResult({
        endpoint: this.config.identifyPath ?? "/v1/identify/card",
        httpStatus: extractStatus(error),
        detectedSegment: null,
        candidateCount: 0,
        topCandidateName: null,
        topCandidateSet: null,
        topCandidateCollectorNumber: null,
        topCandidateConfidence: null,
        rawProviderConfidence: null,
        parsingSucceeded: false,
      });
      return {
        ok: false,
        provider: "cardsight",
        status: isTimeoutError(error) ? "timeout" : "provider_failed",
        mode,
        reason,
        latencyMs: Date.now() - started,
        metrics: usageSnapshot(this.config),
      };
    }
  }

  async listSegments(signal?: AbortSignal): Promise<CardSightSegmentSummary> {
    const cached = segmentProbeCache.__cardsightSegmentSummary__;
    if (cached) return cached;

    const client = this.createClient();
    const response = await withTimeout(
      client.catalog.segments() as Promise<unknown>,
      this.config.timeoutMs,
      signal,
    ) as {
      data?: unknown;
      error?: unknown;
      response?: { status?: number };
    };
    const status = response.response?.status ?? 200;
    if (response.error || status >= 400) {
      throw new Error(formatCardSightSdkError(response.error, status));
    }

    const summary = normalizeSegmentsResponse(response.data);
    segmentProbeCache.__cardsightSegmentSummary__ = summary;
    logCardSightSegments(summary);
    return summary;
  }

  private createClient() {
    return new CardSightAI({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      fetch: this.wrapFetch(this.config.fetch),
      timeout: this.config.timeoutMs,
    });
  }

  private wrapFetch(fetchImpl: typeof fetch): typeof fetch {
    return async (input, init) => {
      const headers = extractHeaders(input, init);
      logCardSightOutboundAuth({
        apiKeyPresent: Boolean(this.config.apiKey?.trim()),
        xApiKeyHeaderAttached: headers.has("x-api-key"),
        authorizationHeaderAttached: headers.has("authorization"),
        endpoint: safeEndpoint(input),
        method: extractMethod(input, init),
      });
      return fetchImpl(input, init);
    };
  }
}

export function resolveCardSightConfig(env: Record<string, string | undefined> = process.env) {
  return {
    apiKey: env.CARDSIGHT_API_KEY?.trim() ?? null,
    apiKeyPresent: Boolean(env.CARDSIGHT_API_KEY?.trim()),
    baseUrl: normalizeBaseUrl(env.CARDSIGHT_BASE_URL ?? DEFAULT_BASE_URL),
    identifyPath: "/v1/identify/card",
    detectPath: "/v1/detect/card",
    planName: env.CARDSIGHT_PLAN_NAME?.trim() ?? null,
    requestPriceUsd: parseNullableNumber(env.CARDSIGHT_REQUEST_PRICE_USD),
    includedRequests: parseNullableInteger(env.CARDSIGHT_INCLUDED_REQUESTS),
    configured: Boolean(env.CARDSIGHT_API_KEY?.trim()),
  };
}

export function logCardSightConfig(route: string, env: Record<string, string | undefined> = process.env) {
  if (process.env.NODE_ENV === "production") return;
  const config = resolveCardSightConfig(env);
  console.info("TD_CARDSIGHT_CONFIG", {
    apiKeyPresent: config.apiKeyPresent,
    baseUrl: config.baseUrl,
    nodeEnv: env.NODE_ENV ?? null,
    route,
  });
}

export function logCardSightOutboundAuth(input: {
  apiKeyPresent: boolean;
  xApiKeyHeaderAttached: boolean;
  authorizationHeaderAttached: boolean;
  endpoint: string;
  method: string;
}) {
  if (process.env.NODE_ENV === "production") return;
  console.info("TD_CARDSIGHT_OUTBOUND_AUTH", input);
}

export function logCardSightSegments(summary: CardSightSegmentSummary) {
  if (process.env.NODE_ENV === "production") return;
  console.info("TD_CARDSIGHT_SEGMENTS", summary);
}

export function readCardSightConfigProbe(env: Record<string, string | undefined> = process.env) {
  const config = resolveCardSightConfig(env);
  return {
    cardsightConfigured: config.configured,
    cardsightBaseUrl: config.baseUrl,
    keyPresent: config.apiKeyPresent,
  };
}

export function cardSightUsageSnapshot(config: CardSightProviderConfig = {}): CardSightUsageSnapshot {
  return usageSnapshot({
    planName: config.planName ?? null,
    includedRequests: config.includedRequests ?? null,
    requestPriceUsd: config.requestPriceUsd ?? null,
  });
}

function normalizeCardSightResponse(payload: unknown, latencyMs: number): CardSightNormalizedHit[] {
  const records = extractRecords(payload);
  return records.map((record) => normalizeRecord(record, latencyMs)).filter((record): record is CardSightNormalizedHit => Boolean(record));
}

function normalizeSegmentsResponse(payload: unknown): CardSightSegmentSummary {
  const records = extractSegmentRecords(payload);
  const names = records
    .map((record) => readText(record, ["name", "segmentName", "segment_name", "title"]))
    .filter((value): value is string => Boolean(value));
  const ids = records
    .map((record) => readText(record, ["id", "segmentId", "segment_id"]))
    .filter((value): value is string => Boolean(value));
  const magicRecord = records.find((record) => {
    const text = [readText(record, ["name", "segmentName", "segment_name", "title"]), readText(record, ["id", "segmentId", "segment_id"])]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
    return /\bmagic\b/.test(text) || /\bmtg\b/.test(text) || /\bmagic the gathering\b/.test(text);
  }) ?? null;
  return {
    segmentCount: records.length,
    names,
    ids,
    matchedMagicSegmentId: magicRecord ? readText(magicRecord, ["id", "segmentId", "segment_id"]) : null,
    matchedMagicSegmentName: magicRecord ? readText(magicRecord, ["name", "segmentName", "segment_name", "title"]) : null,
  };
}

function logCardSightResult(trace: CardSightAttemptTrace) {
  if (process.env.NODE_ENV === "production") return;
  console.info("TD_CARDSIGHT_RESULT", trace);
}

function extractSegmentRecords(payload: unknown): CardsightResponseItem[] {
  if (Array.isArray(payload)) return payload.filter((entry): entry is CardsightResponseItem => Boolean(entry && typeof entry === "object")) as CardsightResponseItem[];
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  const containers = [object.segments, object.data, object.results, object.items, object.catalog];
  for (const container of containers) {
    if (Array.isArray(container)) return container.filter((entry): entry is CardsightResponseItem => Boolean(entry && typeof entry === "object")) as CardsightResponseItem[];
  }
  if (object.segment && typeof object.segment === "object") return [object.segment as CardsightResponseItem];
  return [];
}

function extractRecords(payload: unknown): CardsightResponseItem[] {
  if (Array.isArray(payload)) return payload.filter((entry): entry is CardsightResponseItem => Boolean(entry && typeof entry === "object")) as CardsightResponseItem[];
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  const containers = [object.cards, object.candidates, object.results, object.predictions, object.data, object.identifications, object.matches, object.items, object.detections];
  for (const container of containers) {
    if (Array.isArray(container)) return container.filter((entry): entry is CardsightResponseItem => Boolean(entry && typeof entry === "object")) as CardsightResponseItem[];
  }
  if (object.card && typeof object.card === "object") return [object.card as CardsightResponseItem];
  if (object.result && typeof object.result === "object") return [object.result as CardsightResponseItem];
  return [];
}

function normalizeRecord(record: CardsightResponseItem, latencyMs: number): CardSightNormalizedHit | null {
  const card = (record.card && typeof record.card === "object" ? record.card : record) as CardsightResponseItem;
  const name = readText(card, ["name", "cardName", "card_name", "title"]);
  const printingId = readText(card, ["printingId", "printing_id", "scryfallId", "scryfall_id", "id"]) ?? null;
  const canonicalCardId = readText(card, ["canonicalCardId", "canonical_card_id", "oracleId", "oracle_id"]) ?? null;
  const cardSightId = readText(record, ["cardsightId", "cardsight_id", "identifyId", "identify_id"])
    ?? readText(card, ["cardsightId", "cardsight_id", "identifyId", "identify_id", "cardId", "card_id"]);
  const detectedSegment = readText(record, ["segmentId", "segment_id", "segmentName", "segment_name"])
    ?? readText(card, ["segmentId", "segment_id", "segmentName", "segment_name"]);
  const setCode = readText(card, ["setCode", "set_code", "set", "setId", "set_id"]);
  const setName = readText(card, ["setName", "set_name", "releaseName", "release_name"]);
  const collectorNumber = readText(card, ["collectorNumber", "collector_number", "collector", "number"]);
  const language = readText(card, ["language", "lang"]);
  const finish = readText(card, ["finish", "variant", "treatment"]);
  const imageUrl = readText(card, ["imageUrl", "image_url", "cardImageUrl", "card_image_url"]);
  const game = normalizeGame(readText(card, ["game", "gameId", "game_id"]) ?? null);
  const confidence = normalizeConfidence(record.confidence ?? card.confidence ?? record.score ?? card.score ?? record.probability ?? card.probability ?? null);
  const providerIds = normalizeProviderIds(record.providerIds ?? record.provider_ids ?? card.providerIds ?? card.provider_ids ?? null);
  if (printingId) providerIds.scryfall = printingId;
  if (cardSightId) providerIds.cardsight = cardSightId;
  const resolvedName = name ?? readText(card, ["matchedName", "matched_name"]);
  if (!resolvedName && !printingId && !canonicalCardId) return null;
  return {
    source: "cardsight",
    game,
    canonicalCardId,
    printingId,
    detectedSegment,
    name: resolvedName,
    setCode,
    setName,
    collectorNumber,
    language,
    finish,
    imageUrl,
    providerIds,
    confidence,
    latencyMs,
    raw: record,
  };
}

function candidateToSignals(candidate: CardSightNormalizedHit): CardRecognitionSignals {
  return {
    game: candidate.game,
    cardName: candidate.name,
    setCode: candidate.setCode,
    setName: candidate.setName,
    collectorNumber: candidate.collectorNumber,
    language: candidate.language,
    finish: candidate.finish,
    providerIds: candidate.providerIds,
  };
}

function candidateToSeedCandidate(candidate: CardSightNormalizedHit): CanonicalPrinting {
  const exactAuthority = Boolean(candidate.canonicalCardId && candidate.providerIds.scryfall);
  const fallbackCardId = candidate.printingId ?? `cardsight:${normalizeSlug(candidate.name ?? "unknown")}`;
  return {
    canonicalCardId: candidate.canonicalCardId ?? fallbackCardId,
    printingId: candidate.printingId ?? fallbackCardId,
    game: candidate.game === "pokemon" ? "pokemon" : "magic",
    name: candidate.name ?? "Unknown card",
    setName: candidate.setName ?? null,
    setCode: candidate.setCode ?? null,
    collectorNumber: candidate.collectorNumber ?? null,
    language: candidate.language ?? null,
    finishes: candidate.finish ? [candidate.finish] : [],
    rarity: null,
    imageUrl: candidate.imageUrl ?? null,
    providerIds: candidate.providerIds,
    provenance: ["cardsight", ...(candidate.providerIds.scryfall ? ["scryfall"] : [])],
    identityAuthority: exactAuthority ? "provider_confirmed" : "synthetic_fallback",
    prices: [],
  };
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function readText(source: CardsightResponseItem, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
  }
  return null;
}

function normalizeGame(value: string | null): CardIntelligenceGame {
  const normalized = `${value ?? ""}`.toLowerCase();
  return normalized === "pokemon" || normalized === "magic" ? normalized : "unknown";
}

function normalizeConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number > 1 ? Math.max(0, Math.min(1, number / 100)) : Math.max(0, Math.min(1, number));
}

function normalizeProviderIds(value: unknown): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.slice(0, 40);
    if (typeof entry === "string" && entry.trim()) {
      result[normalizedKey] = entry.trim();
    } else if (typeof entry === "number" && Number.isFinite(entry)) {
      result[normalizedKey] = entry;
    }
  }
  return result;
}

function usageState() {
  return globalState.__cardsightUsageState__ ??= { requestCount: 0, successCount: 0, failureCount: 0, latencies: [] };
}

function recordUsage(success: boolean, latencyMs: number | null) {
  const state = usageState();
  state.requestCount += 1;
  if (success) state.successCount += 1;
  else state.failureCount += 1;
  if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
    state.latencies.push(Math.round(latencyMs));
    if (state.latencies.length > 200) state.latencies.shift();
  }
}

function usageSnapshot(config: { planName?: string | null; includedRequests?: number | null; requestPriceUsd?: number | null }): CardSightUsageSnapshot {
  const state = usageState();
  const requestPriceUsd = config.requestPriceUsd ?? null;
  const includedRequests = config.includedRequests ?? null;
  return {
    requestCount: state.requestCount,
    successCount: state.successCount,
    failureCount: state.failureCount,
    medianLatencyMs: median(state.latencies),
    estimatedCostUsd: requestPriceUsd === null
      ? null
      : Math.max(0, state.requestCount - (includedRequests ?? 0)) * requestPriceUsd,
    planName: config.planName ?? null,
    includedRequests,
    requestPriceUsd,
  };
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2) : sorted[midpoint];
}

function isTimeoutError(error: unknown) {
  const text = extractErrorText(error);
  return /aborted|timeout|timed out/i.test(text);
}

function parseNullableNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseNullableInteger(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function extractHeaders(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  if (input instanceof Request) return new Headers(input.headers);
  return new Headers(init?.headers ?? undefined);
}

function extractMethod(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  if (input instanceof Request) return input.method;
  if (init?.method) return init.method;
  return "POST";
}

function safeEndpoint(input: Parameters<typeof fetch>[0]) {
  const url = input instanceof Request ? input.url : String(input);
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function extractStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : null;
  }
  return null;
}

function extractErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "");
}

function formatCardSightSdkError(error: unknown, status: number | null) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : null;
  if (status === 401) return "CardSight request failed (401). API key is required.";
  if (status && message) return `CardSight request failed (${status}). ${message}`;
  if (status) return `CardSight request failed (${status}).`;
  return message ? `CardSight request failed. ${message}` : "CardSight request failed.";
}

function base64ToArrayBuffer(image: string) {
  const clean = image.includes(",") ? image.split(",").pop() ?? "" : image;
  const normalized = clean.replace(/\s+/g, "");
  const buffer = Buffer.from(normalized, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("CardSight request timed out."));
        }, timeoutMs);
        signal?.addEventListener("abort", () => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(new Error("CardSight request was cancelled."));
        }, { once: true });
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
