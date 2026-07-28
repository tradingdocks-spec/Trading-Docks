import { NextRequest, NextResponse } from "next/server";
import { getCardShowGame } from "@/lib/card-show-games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8_000;
const MIN_REQUEST_INTERVAL_MS = 6_500;

type SearchPayload = {
  results: unknown[];
  remaining: number | null;
  cachedForSeconds: number;
  source: "live" | "cache" | "stale";
  warning?: string;
};

type CacheEntry = {
  payload: SearchPayload;
  storedAt: number;
};

const searchCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<SearchPayload>>();
let lastProviderRequestAt = 0;

type JustTcgVariant = {
  id: string;
  uuid?: string;
  condition?: string | null;
  printing?: string | null;
  language?: string | null;
  price?: number | null;
  avgPrice30d?: number | null;
  minPrice30d?: number | null;
  maxPrice30d?: number | null;
  lastUpdated?: number | null;
};

type JustTcgCard = {
  id: string;
  uuid?: string;
  name: string;
  game: string;
  set?: string | null;
  set_name?: string | null;
  number?: string | null;
  rarity?: string | null;
  scryfallId?: string | null;
  details?: string | null;
  variants?: JustTcgVariant[];
};

function price(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function jsonError(code: string, error: string, status: number, retryAfter?: string | null) {
  return NextResponse.json(
    { code, error, retryAfter: retryAfter || null },
    {
      status,
      headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
    },
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const game = request.nextUrl.searchParams.get("game") ?? "";
  const gameConfig = getCardShowGame(game);
  const productType = request.nextUrl.searchParams.get("type") === "sealed" ? "sealed" : "single";

  if (query.length < 2) {
    return jsonError("INVALID_QUERY", "Enter at least two characters.", 400);
  }
  if (!gameConfig) {
    return jsonError("UNSUPPORTED_GAME", "Choose a supported game.", 400);
  }

  const apiKey = process.env.JUSTTCG_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(
      "MISSING_CONFIGURATION",
      "Live pricing is not connected to this deployment yet. Redeploy after adding the server API key.",
      503,
    );
  }

  const cacheKey = `${gameConfig.id}:${productType}:${query.toLocaleLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  const cacheAge = cached ? Date.now() - cached.storedAt : Number.POSITIVE_INFINITY;
  if (cached && cacheAge < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cached.payload, source: "cache" },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  const params = new URLSearchParams({
    q: query,
    game: gameConfig.apiName,
    limit: "12",
    include_price_history: "false",
    include_statistics: "30d",
    include_null_prices: "false",
  });
  if (productType === "sealed") params.set("condition", "Sealed");

  try {
    let requestPromise = inFlight.get(cacheKey);
    if (!requestPromise) {
      requestPromise = (async () => {
        const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastProviderRequestAt));
        if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
        lastProviderRequestAt = Date.now();

        const response = await fetch(`https://api.justtcg.com/v1/cards?${params}`, {
          headers: { "x-api-key": apiKey, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: JustTcgCard[];
          error?: string;
          message?: string;
          code?: string;
          _metadata?: { apiRequestsRemaining?: number; apiDailyRequestsRemaining?: number };
        };

        if (!response.ok) {
          const providerCode = payload.code || payload.error || "";
          const failure = new Error(payload.message || payload.error || "Pricing search is temporarily unavailable.");
          Object.assign(failure, {
            providerStatus: response.status,
            providerCode,
            retryAfter: response.headers.get("retry-after"),
          });
          throw failure;
        }

        const results = (payload.data ?? [])
          .map((card) => {
        const variants = (card.variants ?? [])
          .filter((variant) => productType !== "sealed" || variant.condition === "Sealed")
          .filter((variant) => price(variant.price) !== null)
          .map((variant) => ({
            id: variant.uuid || variant.id,
            condition: variant.condition || "Unspecified",
            printing: variant.printing || "Standard",
            language: variant.language || null,
            current: price(variant.price),
            low30d: price(variant.minPrice30d),
            average30d: price(variant.avgPrice30d),
            high30d: price(variant.maxPrice30d),
            updatedAt: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null,
          }));

        if (!variants.length) return null;
        return {
          id: card.uuid || card.id,
          name: card.name,
          game: card.game,
          setName: card.set_name || card.set || "Set unavailable",
          number: card.number || null,
          rarity: card.rarity || null,
          sealed: productType === "sealed",
          imageUrl: card.scryfallId ? `/api/scryfall-image/${card.scryfallId}` : null,
          variants,
        };
          })
          .filter(Boolean);

        const livePayload: SearchPayload = {
          results,
          remaining:
            payload._metadata?.apiRequestsRemaining ??
            payload._metadata?.apiDailyRequestsRemaining ??
            null,
          cachedForSeconds: CACHE_TTL_MS / 1000,
          source: "live",
        };
        searchCache.set(cacheKey, { payload: livePayload, storedAt: Date.now() });
        return livePayload;
      })();
      inFlight.set(cacheKey, requestPromise);
    }

    const result = await requestPromise;
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (reason) {
    const failure = reason as Error & {
      providerStatus?: number;
      providerCode?: string;
      retryAfter?: string | null;
    };
    if (cached && cacheAge < STALE_TTL_MS) {
      return NextResponse.json({
        ...cached.payload,
        source: "stale",
        warning: "Live pricing is temporarily unavailable. Showing the latest saved result.",
      });
    }

    const code = failure.providerCode || "";
    if (code.includes("EXCESSIVE_FREE_TIER_USAGE")) {
      return jsonError(
        "SHARED_HOST_LIMIT",
        "JustTCG temporarily blocked free-tier traffic from shared hosting. Please try again later.",
        503,
        failure.retryAfter,
      );
    }
    if (failure.providerStatus === 429) {
      return jsonError(
        "RATE_LIMITED",
        "The free-tier request limit is temporarily reached. Please wait and try again.",
        429,
        failure.retryAfter,
      );
    }
    if (failure.providerStatus === 401 || failure.providerStatus === 403) {
      return jsonError("INVALID_API_KEY", "JustTCG rejected the configured API key.", 503);
    }
    if (failure.name === "TimeoutError") {
      return jsonError("PROVIDER_TIMEOUT", "The pricing service took too long to respond. Try again shortly.", 504);
    }
    return jsonError("PROVIDER_UNAVAILABLE", "Could not reach the pricing service. Try again shortly.", 502);
  } finally {
    inFlight.delete(cacheKey);
  }
}
