import {
  NextRequest,
  NextResponse,
} from "next/server";

export const revalidate = 86400;

const SCRYFALL_TIMEOUT_MS = 5000;

type ScryfallCardImagePayload = {
  image_uris?: {
    normal?: string;
    large?: string;
    png?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal?: string;
      large?: string;
      png?: string;
    };
  }>;
};

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

async function fetchWithTimeout(
  input: string,
  init: NextFetchInit,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SCRYFALL_TIMEOUT_MS,
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: NextRequest) {
  const name =
    request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const setCode =
    request.nextUrl.searchParams.get("set")?.trim() ??
    request.nextUrl.searchParams.get("setCode")?.trim() ??
    "";
  const collectorNumber =
    request.nextUrl.searchParams
      .get("collectorNumber")
      ?.trim() ?? "";

  if (!name) {
    return new NextResponse("Missing card name.", {
      status: 400,
    });
  }

  const cardLookupUrl =
    setCode && collectorNumber
      ? `https://api.scryfall.com/cards/${encodeURIComponent(
          setCode.toLowerCase(),
        )}/${encodeURIComponent(collectorNumber)}`
      : `https://api.scryfall.com/cards/named?${new URLSearchParams({
          exact: name,
        }).toString()}`;

  let cardResponse: Response;

  try {
    cardResponse = await fetchWithTimeout(cardLookupUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingDocks-DeckVault/2.1",
      },
      next: {
        revalidate: 86400,
      },
    });
  } catch {
    return new NextResponse("Card image lookup timed out.", {
      status: 504,
    });
  }

  if (!cardResponse.ok) {
    return new NextResponse("Card image unavailable.", {
      status: cardResponse.status,
    });
  }

  const card = (await cardResponse.json()) as ScryfallCardImagePayload;
  const face =
    card.card_faces?.find((entry) => entry.image_uris) ?? card;

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

  let imageResponse: Response;

  try {
    imageResponse = await fetchWithTimeout(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "TradingDocks-DeckVault/2.1",
      },
      next: {
        revalidate: 86400,
      },
    });
  } catch {
    return new NextResponse("Card image fetch timed out.", {
      status: 504,
    });
  }

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
