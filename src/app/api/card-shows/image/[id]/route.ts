import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TCGPLAYER_IMAGE_HOST = "tcgplayer-cdn.tcgplayer.com";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^\d{1,12}$/.test(id)) {
    return new NextResponse("Invalid product image ID.", { status: 400 });
  }

  try {
    const imageUrls = [
      `https://${TCGPLAYER_IMAGE_HOST}/product/${id}_in_1000x1000.jpg`,
      `https://${TCGPLAYER_IMAGE_HOST}/product/${id}_in_800x800.jpg`,
      `https://${TCGPLAYER_IMAGE_HOST}/product/${id}_in_200x200.jpg`,
    ];
    let response: Response | null = null;
    for (const imageUrl of imageUrls) {
      const candidate = await fetch(imageUrl, {
        headers: { Accept: "image/avif,image/webp,image/*" },
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: AbortSignal.timeout(6_000),
      });
      if (candidate.ok && candidate.body) {
        response = candidate;
        break;
      }
    }

    if (!response?.ok || !response.body) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch {
    return new NextResponse(null, { status: 504 });
  }
}
