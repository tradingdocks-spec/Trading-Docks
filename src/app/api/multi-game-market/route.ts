import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";
import {
  loadMarketPayload,
  MARKET_REFRESH_SECONDS,
  type GameId,
} from "@/lib/market-engine";

const GAME_IDS: GameId[] = [
  "magic",
  "pokemon",
  "lorcana",
  "one-piece",
];

// Next.js requires this segment configuration to be statically analyzable.
export const revalidate = 300;

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "purchasing")) {
    return NextResponse.json(
      { error: "Purchasing requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(
  request: NextRequest,
) {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  const value =
    request.nextUrl.searchParams.get("game");

  const requestedGame =
    value &&
    GAME_IDS.includes(value as GameId)
      ? (value as GameId)
      : undefined;

  const payload = await loadMarketPayload(
    requestedGame,
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control":
        `public, s-maxage=${MARKET_REFRESH_SECONDS}, stale-while-revalidate=${MARKET_REFRESH_SECONDS * 3}`,
    },
  });
}
