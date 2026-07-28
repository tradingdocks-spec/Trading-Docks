import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ScryfallCard = {
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
      large?: string;
    };
  }>;
};

export const revalidate = 86400;

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const size = request.nextUrl.searchParams.get("size") ?? "normal";

  if (!id) {
    return new NextResponse("Missing card id.", { status: 400 });
  }

  const cardResponse = await fetch(
    `https://api.scryfall.com/cards/${encodeURIComponent(id)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks/1.0",
      },
      next: { revalidate },
    },
  );

  if (!cardResponse.ok) {
    return new NextResponse("Card not found.", {
      status: cardResponse.status,
    });
  }

  const card: ScryfallCard = await cardResponse.json();
  const imageUrl = selectImage(card, size);

  if (!imageUrl) {
    return new NextResponse("Card image not found.", { status: 404 });
  }

  const imageResponse = await fetch(imageUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "TradingDocks/1.0",
    },
    next: { revalidate },
  });

  if (!imageResponse.ok || !imageResponse.body) {
    return new NextResponse("Image could not be loaded.", {
      status: imageResponse.status || 502,
    });
  }

  return new NextResponse(imageResponse.body, {
    status: 200,
    headers: {
      "Content-Type":
        imageResponse.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

function selectImage(card: ScryfallCard, size: string) {
  const normal =
    card.image_uris ??
    card.card_faces?.[0]?.image_uris;

  if (!normal) return null;

  if (size === "small") {
    return normal.small ?? normal.normal ?? normal.large ?? null;
  }

  if (size === "large") {
    return normal.large ?? normal.normal ?? normal.small ?? null;
  }

  return normal.normal ?? normal.large ?? normal.small ?? null;
}
