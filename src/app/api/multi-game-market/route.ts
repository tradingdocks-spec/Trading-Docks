import {
  NextRequest,
  NextResponse,
} from "next/server";

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

export const revalidate =
  MARKET_REFRESH_SECONDS;

export async function GET(
  request: NextRequest,
) {
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
        "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
