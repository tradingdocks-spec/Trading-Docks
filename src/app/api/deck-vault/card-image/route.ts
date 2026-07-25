import {
  NextRequest,
  NextResponse,
} from "next/server";

export const revalidate = 86_400;

export async function GET(request: NextRequest) {
  const name =
    request.nextUrl.searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return new NextResponse("Missing card name.", {
      status: 400,
    });
  }

  const params = new URLSearchParams({
    exact: name,
  });

  const cardResponse = await fetch(
    `https://api.scryfall.com/cards/named?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks-DeckVault/2.1",
      },
      next: {
        revalidate: 86_400,
      },
    },
  );

  if (!cardResponse.ok) {
    return new NextResponse("Card image unavailable.", {
      status: cardResponse.status,
    });
  }

  const card = await cardResponse.json();
  const face =
    card.card_faces?.find(
      (entry: any) => entry.image_uris,
    ) ?? card;

  const imageUrl =
    face.image_uris?.normal ??
    face.image_uris?.large ??
    face.image_uris?.png ??
    "";

  if (!imageUrl) {
    return new NextResponse("Card image unavailable.", {
      status: 404,
    });
  }

  const imageResponse = await fetch(imageUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      "User-Agent": "TradingDocks-DeckVault/2.1",
    },
    next: {
      revalidate: 86_400,
    },
  });

  if (!imageResponse.ok || !imageResponse.body) {
    return new NextResponse("Card image unavailable.", {
      status: imageResponse.status || 502,
    });
  }

  return new NextResponse(imageResponse.body, {
    headers: {
      "Content-Type":
        imageResponse.headers.get("content-type") ??
        "image/jpeg",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
