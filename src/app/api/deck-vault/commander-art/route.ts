import {
  NextRequest,
  NextResponse,
} from "next/server";

export const revalidate = 86_400;

export async function GET(request: NextRequest) {
  const name =
    request.nextUrl.searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "Commander name is required." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    exact: name,
  });

  const response = await fetch(
    `https://api.scryfall.com/cards/named?${params.toString()}`,
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
      { image: "", artCrop: "" },
      { status: response.status },
    );
  }

  const card = await response.json();
  const face =
    card.card_faces?.find(
      (entry: any) => entry.image_uris,
    ) ?? card;

  return NextResponse.json({
    name: card.name,
    image:
      face.image_uris?.normal ??
      face.image_uris?.large ??
      "",
    artCrop:
      face.image_uris?.art_crop ??
      face.image_uris?.normal ??
      "",
    colors: card.color_identity ?? [],
  });
}
