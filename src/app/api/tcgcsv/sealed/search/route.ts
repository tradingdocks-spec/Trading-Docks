import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  searchSealedProducts,
} from "@/lib/tcgcsv/client";

export const revalidate = 86_400;

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const category =
    request.nextUrl.searchParams.get("category")?.trim() ??
    "All";
  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(
        request.nextUrl.searchParams.get("limit") ?? 30,
      ),
    ),
  );

  if (query.length < 2) {
    return NextResponse.json({
      query,
      category,
      updatedAt: new Date().toISOString(),
      scannedGroups: 0,
      results: [],
      message:
        "Enter at least two characters to search TCGCSV.",
    });
  }

  try {
    const payload = await searchSealedProducts({
      query,
      categoryName: category,
      limit,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("TCGCSV sealed search failed:", error);

    return NextResponse.json(
      {
        query,
        category,
        updatedAt: new Date().toISOString(),
        scannedGroups: 0,
        results: [],
        error:
          error instanceof Error
            ? error.message
            : "TCGCSV search failed.",
      },
      { status: 502 },
    );
  }
}
