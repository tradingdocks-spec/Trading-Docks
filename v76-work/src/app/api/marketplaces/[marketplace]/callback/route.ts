import { NextResponse } from "next/server";

const OAUTH_MARKETPLACES = new Set(["amazon", "ebay", "etsy", "shopify"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ marketplace: string }> },
) {
  const { marketplace } = await context.params;
  const destination = new URL("/dashboard/marketplaces", request.url);
  destination.searchParams.set(
    "connector",
    OAUTH_MARKETPLACES.has(marketplace) ? marketplace : "unsupported",
  );
  destination.searchParams.set("authorization", "received");
  return NextResponse.redirect(destination);
}
