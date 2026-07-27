import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    set: string;
    number: string;
  }>;
};

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { set, number } = await context.params;
  const version =
    request.nextUrl.searchParams.get("version") ?? "normal";

  if (!set || !number) {
    return new NextResponse("Missing set or collector number.", {
      status: 400,
    });
  }

  const params = new URLSearchParams({
    format: "image",
    version,
  });

  const url =
    `https://api.scryfall.com/cards/` +
    `${encodeURIComponent(set.toLowerCase())}/` +
    `${encodeURIComponent(number)}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "TradingDocks/1.0",
      },
      redirect: "follow",
      next: { revalidate },
    });

    if (!response.ok || !response.body) {
      return new NextResponse("Scryfall image request failed.", {
        status: response.status || 502,
      });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Scryfall image proxy failed:", error);

    return new NextResponse("Scryfall image proxy unavailable.", {
      status: 502,
    });
  }
}
