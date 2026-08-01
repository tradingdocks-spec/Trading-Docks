import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ListingSnapshot = {
  inventoryItem?: {
    product?: {
      imageUrls?: string[];
    };
  };
};

function isAllowedEbayImage(url: URL) {
  return url.protocol === "https:"
    && (url.hostname === "ebayimg.com" || url.hostname.endsWith(".ebayimg.com"));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await context.params;
  const { data: listing } = await supabase
    .from("marketplace_listing_mappings")
    .select("raw_snapshot")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("marketplace_id", "ebay")
    .maybeSingle();

  const snapshot = listing?.raw_snapshot as ListingSnapshot | null;
  const source = snapshot?.inventoryItem?.product?.imageUrls?.[0];
  if (!source) return new Response(null, { status: 404 });

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (!isAllowedEbayImage(imageUrl)) return new Response(null, { status: 403 });

  try {
    const image = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; TradingDocks/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const contentType = image.headers.get("content-type") ?? "";
    if (!image.ok || !contentType.toLowerCase().startsWith("image/")) {
      return new Response(null, { status: 404 });
    }
    return new Response(image.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}
