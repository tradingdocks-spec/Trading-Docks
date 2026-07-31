import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const response = await fetch(
    "https://api.scryfall.com/cards/named?exact=Mana%20Crypt&set=mps",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks/1.0",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: "scryfall-card-data",
        status: response.status,
      },
      { status: 502 },
    );
  }

  const card = await response.json();
  const proxyUrl = card?.id
    ? `/api/scryfall-image/${encodeURIComponent(card.id)}?size=normal`
    : null;

  return NextResponse.json({
    ok: Boolean(card?.id && proxyUrl),
    cardId: card?.id ?? null,
    cardName: card?.name ?? null,
    proxyUrl,
  });
}
