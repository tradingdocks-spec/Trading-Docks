import { NextRequest, NextResponse } from "next/server";
import { getCardShowGame } from "@/lib/card-show-games";

export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const game = request.nextUrl.searchParams.get("game") ?? "";
  const gameConfig = getCardShowGame(game);
  const productType = request.nextUrl.searchParams.get("type") === "sealed" ? "sealed" : "single";

  if (query.length < 2) {
    return NextResponse.json({ error: "Enter at least two characters." }, { status: 400 });
  }
  if (!gameConfig) {
    return NextResponse.json({ error: "Choose a supported game." }, { status: 400 });
  }

  const apiKey = process.env.JUSTTCG_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Card pricing is not configured. Add JUSTTCG_API_KEY to the deployed environment." },
      { status: 503 },
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
    const response = await fetch(`https://api.justtcg.com/v1/cards?${params}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      next: { revalidate: 900 },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: JustTcgCard[];
      error?: string;
      message?: string;
      _metadata?: { apiRequestsRemaining?: number; apiDailyRequestsRemaining?: number };
    };

    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 503 : 502;
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "The monthly pricing allowance has been reached."
              : response.status === 401 || response.status === 403
                ? "The deployed JustTCG key was rejected."
                : payload.error || payload.message || "Pricing search is temporarily unavailable.",
        },
        { status },
      );
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

    return NextResponse.json(
      {
        results,
        remaining:
          payload._metadata?.apiRequestsRemaining ??
          payload._metadata?.apiDailyRequestsRemaining ??
          null,
        cachedForSeconds: 900,
      },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not reach the pricing service. Try again shortly." }, { status: 502 });
  }
}
