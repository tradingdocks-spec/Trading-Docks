import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCategories,
  getGroups,
  searchSealedProducts,
} from "@/lib/tcgcsv/client";
import {
  syncTcgCsvToSupabase,
} from "@/lib/tcgcsv/supabase-sync";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization =
    request.headers.get("authorization");

  if (
    cronSecret &&
    authorization !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const categories = await getCategories();
    const supported = categories.filter((category) =>
      [
        "magic",
        "pokemon",
        "lorcana",
        "one piece",
      ].some((name) =>
        `${category.name} ${category.displayName ?? ""}`
          .toLowerCase()
          .includes(name),
      ),
    );

    const groups = (
      await Promise.all(
        supported.map((category) =>
          getGroups(category.categoryId),
        ),
      )
    ).flat();

    const seedQueries = [
      ["Magic", "booster box"],
      ["Magic", "commander deck"],
      ["Pokemon", "elite trainer box"],
      ["Pokemon", "ultra-premium collection"],
      ["Lorcana", "booster box"],
      ["One Piece", "booster box"],
    ] as const;

    const productPayloads = await Promise.all(
      seedQueries.map(([category, query]) =>
        searchSealedProducts({
          categoryName: category,
          query,
          limit: 50,
        }),
      ),
    );

    const products = dedupe(
      productPayloads.flatMap(
        (payload) => payload.results,
      ),
    );

    const result = await syncTcgCsvToSupabase({
      categories: supported,
      groups,
      products,
    });

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error("TCGCSV sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown sync error.",
      },
      { status: 500 },
    );
  }
}

function dedupe<T extends { productId: number }>(
  products: T[],
) {
  const seen = new Set<number>();

  return products.filter((product) => {
    if (seen.has(product.productId)) return false;
    seen.add(product.productId);
    return true;
  });
}
