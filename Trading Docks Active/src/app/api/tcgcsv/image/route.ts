import {
  NextRequest,
  NextResponse,
} from "next/server";

const ALLOWED_HOSTS = new Set([
  "tcgplayer-cdn.tcgplayer.com",
  "product-images.tcgplayer.com",
]);

export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const value =
    request.nextUrl.searchParams.get("url");

  if (!value) {
    return new NextResponse("Missing image URL.", {
      status: 400,
    });
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return new NextResponse("Invalid image URL.", {
      status: 400,
    });
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname)
  ) {
    return new NextResponse(
      "Image host is not permitted.",
      { status: 403 },
    );
  }

  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      "User-Agent": "TradingDocks/1.0",
    },
    next: {
      revalidate: 86400,
    },
  });

  if (!response.ok || !response.body) {
    return new NextResponse("Image unavailable.", {
      status: response.status || 502,
    });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Type":
        response.headers.get("content-type") ??
        "image/jpeg",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
