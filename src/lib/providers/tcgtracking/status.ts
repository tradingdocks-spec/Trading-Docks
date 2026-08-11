import { tcgTrackingCachePolicy } from "./cache.ts";
import {
  createTcgTrackingClient,
  TCGTRACKING_BASE_URL,
  type TcgTrackingClient,
} from "./client.ts";
import type { TcgTrackingProviderHealth } from "./types.ts";

export async function loadTcgTrackingProviderHealth(
  client: Pick<TcgTrackingClient, "meta"> = createTcgTrackingClient(),
): Promise<TcgTrackingProviderHealth> {
  const startedAt = Date.now();
  try {
    const meta = await client.meta();
    return {
      provider: "tcgtracking",
      status: "available",
      baseUrl: meta.baseUrl,
      metaVersion: meta.version,
      latencyMs: Date.now() - startedAt,
      cachePolicy: {
        staticDataTtlDays: tcgTrackingCachePolicy().staticDataTtlDays,
        pricingTtlHours: tcgTrackingCachePolicy().pricingTtlHours,
      },
      localSchema: "proposal-only",
    };
  } catch (error) {
    return {
      provider: "tcgtracking",
      status: "unavailable",
      baseUrl:
        process.env.TCGTRACKING_API_BASE_URL ?? TCGTRACKING_BASE_URL,
      latencyMs: null,
      cachePolicy: {
        staticDataTtlDays: tcgTrackingCachePolicy().staticDataTtlDays,
        pricingTtlHours: tcgTrackingCachePolicy().pricingTtlHours,
      },
      localSchema: "proposal-only",
      error:
        error instanceof Error
          ? error.message
          : "TCGTracking status check failed.",
    };
  }
}
