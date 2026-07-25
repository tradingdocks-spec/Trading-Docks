import {
  NextResponse,
} from "next/server";

export const revalidate = 86_400;

export async function GET() {
  const params = new URLSearchParams({
    q: "is:gamechanger",
    unique: "cards",
    order: "name",
  });

  const response = await fetch(
    `https://api.scryfall.com/cards/search?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks-DeckVault/2.0",
      },
      next: { revalidate: 86_400 },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { cards: [], error: "Game Changer sync failed." },
      { status: response.status },
    );
  }

  const payload = await response.json();

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    cards: (payload.data ?? []).map((card: any) => ({
      id: card.id,
      name: card.name,
      colors: card.color_identity ?? [],
      image:
        card.image_uris?.normal ??
        card.card_faces?.[0]?.image_uris?.normal ??
        "",
    })),
  });
}
