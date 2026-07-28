import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SCRYFALL = "https://api.scryfall.com";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  try {
    if (mode === "names") {
      const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
      if (query.length < 2) return NextResponse.json({ data: [] });
      const response = await scryfallFetch(
        `${SCRYFALL}/cards/autocomplete?q=${encodeURIComponent(query)}`,
      );
      return NextResponse.json(await response.json(), { status: response.status });
    }

    if (mode === "printings") {
      const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
      if (!name) {
        return NextResponse.json(
          { details: "Choose a card name first." },
          { status: 400 },
        );
      }

      const cards: unknown[] = [];
      let nextPage: string | null =
        `${SCRYFALL}/cards/search?${new URLSearchParams({
          q: `!"${name.replaceAll('"', '\\"')}"`,
          unique: "prints",
          order: "released",
          dir: "desc",
          include_extras: "true",
        })}`;

      while (nextPage) {
        const response = await scryfallFetch(nextPage);
        const payload = (await response.json()) as {
          data?: unknown[];
          has_more?: boolean;
          next_page?: string;
          details?: string;
        };
        if (!response.ok) {
          return NextResponse.json(
            { details: payload.details ?? "Scryfall printing search failed." },
            { status: response.status },
          );
        }
        cards.push(...(payload.data ?? []));
        nextPage = payload.has_more ? payload.next_page ?? null : null;
      }

      return NextResponse.json({ data: cards });
    }

    return NextResponse.json(
      { details: "Unknown card-search mode." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        details:
          error instanceof Error
            ? error.message
            : "The card service is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}

async function scryfallFetch(url: string) {
  return fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingDocks/1.0 tradingdocks@gmail.com",
    },
    cache: "no-store",
  });
}
