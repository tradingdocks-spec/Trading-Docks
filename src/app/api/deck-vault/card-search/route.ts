import {
  NextRequest,
  NextResponse,
} from "next/server";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const basic =
    request.nextUrl.searchParams.get("basic") === "true";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const exactBasicNames = new Set([
    "plains",
    "island",
    "swamp",
    "mountain",
    "forest",
    "wastes",
  ]);

  const normalized = query.toLowerCase();
  const scryfallQuery =
    basic || exactBasicNames.has(normalized)
      ? `!"${query}" t:basic t:land`
      : query;

  const params = new URLSearchParams({
    q: scryfallQuery,
    unique: "cards",
    order:
      basic || exactBasicNames.has(normalized)
        ? "released"
        : "edhrec",
    dir: "desc",
  });

  const response = await fetch(
    `https://api.scryfall.com/cards/search?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks-DeckVault/2.0",
      },
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { results: [], error: "Card search failed." },
      { status: response.status },
    );
  }

  const payload = await response.json();

  return NextResponse.json({
    results: (payload.data ?? [])
      .slice(0, 20)
      .map(normalizeCard),
  });
}

function normalizeCard(card: any) {
  const face =
    card.card_faces?.find(
      (entry: any) => entry.image_uris,
    ) ?? card;

  return {
    id: card.id,
    name: card.name,
    manaValue: Number(card.cmc ?? 0),
    colors: card.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    typeLine: card.type_line ?? "",
    setCode: card.set ?? "",
    setName: card.set_name ?? "",
    collectorNumber: card.collector_number ?? "",
    image:
      face.image_uris?.normal ??
      face.image_uris?.large ??
      "",
    artCrop:
      face.image_uris?.art_crop ??
      face.image_uris?.normal ??
      "",
    price: Number(
      card.prices?.usd ??
        card.prices?.usd_foil ??
        0,
    ),
    gameChanger: Boolean(card.game_changer),
    legalities: card.legalities ?? {},
  };
}
