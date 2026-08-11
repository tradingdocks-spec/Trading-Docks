import { tcgTrackingCachePolicy } from "./cache.ts";
import {
  createTcgTrackingClient,
  TCGTRACKING_BASE_URL,
  type TcgTrackingClient,
} from "./client.ts";
import type { TcgTrackingProviderHealth } from "./types.ts";

export async function loadTcgTrackingProviderHealth(
  client: Pick<TcgTrackingClient, "categories" | "meta"> = createTcgTrackingClient(),
): Promise<TcgTrackingProviderHealth> {
  const startedAt = Date.now();
  const lastCheckedAt = new Date().toISOString();
  const cachePolicy = tcgTrackingCachePolicy();
  try {
    const meta = await client.meta();
    const categories = await client.categories();
    return {
      provider: "tcgtracking",
      status: "available",
      baseUrl: meta.baseUrl,
      metaVersion: meta.version,
      categoryCount: categories.length,
      lastCheckedAt,
      latencyMs: Date.now() - startedAt,
      cachePolicy: {
        staticDataTtlDays: cachePolicy.staticDataTtlDays,
        pricingTtlHours: cachePolicy.pricingTtlHours,
      },
      localSchema: "proposal-only",
    };
  } catch (error) {
    return {
      provider: "tcgtracking",
      status: "unavailable",
      baseUrl:
        process.env.TCGTRACKING_API_BASE_URL ?? TCGTRACKING_BASE_URL,
      lastCheckedAt,
      latencyMs: null,
      cachePolicy: {
        staticDataTtlDays: cachePolicy.staticDataTtlDays,
        pricingTtlHours: cachePolicy.pricingTtlHours,
      },
      localSchema: "proposal-only",
      error:
        error instanceof Error
          ? error.message
          : "TCGTracking status check failed.",
    };
  }
}
