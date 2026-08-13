import { NextResponse } from "next/server";

import {
  isAllowedTcgPlayerProductImageUrl,
  isAllowedTcgTrackingImageUrl,
  normalizeTcgPlayerProductImageUrl,
  normalizeTcgTrackingImageUrl,
  tcgTrackingProductImageUrl,
} from "@/lib/card-image-authority";
import { getSupportedGame } from "@/lib/multi-tcg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TIMEOUT_MS = 4500;
const ALLOWED_PRODUCT_TYPES = new Set(["card", "sealed"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId");
  const productType = url.searchParams.get("productType") ?? "card";
  const providerProductId = url.searchParams.get("providerProductId");
  const tcgplayerProductId = url.searchParams.get("tcgplayerProductId");
  const source = url.searchParams.get("source");

  const game = getSupportedGame(gameId);
  if (!game || (game.id !== "pokemon" && game.id !== "magic")) {
    return NextResponse.json({ error: "Unsupported product image game." }, { status: 400 });
  }
  if (!ALLOWED_PRODUCT_TYPES.has(productType)) {
    return NextResponse.json({ error: "Unsupported product image type." }, { status: 400 });
  }

  const productId = tcgplayerProductId ?? providerProductId;
  const numericProductId = Number(productId);
  if (!Number.isSafeInteger(numericProductId) || numericProductId <= 0) {
    return NextResponse.json({ error: "Invalid product image identity." }, { status: 400 });
  }

  const sourceUrl =
    source && isAllowedProductImageUrl(source, numericProductId)
      ? normalizeProductImageUrl(source)
      : tcgTrackingProductImageUrl(numericProductId);
  if (!sourceUrl) {
    return NextResponse.json({ error: "Product image unavailable." }, { status: 404 });
  }

  const upstream = await fetchProviderImage(sourceUrl, numericProductId);
  if (!upstream.ok) {
    return NextResponse.json({ error: "Product image unavailable." }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function fetchProviderImage(sourceUrl: string, productId: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      cache: "force-cache",
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = normalizeProductImageUrl(response.url);
    const contentType = response.headers.get("content-type") ?? "";
    const safe = Boolean(finalUrl) && isAllowedProductImageUrl(finalUrl, productId);
    const image = contentType.toLowerCase().startsWith("image/");
    if (process.env.NODE_ENV !== "production") {
      console.info("Product image fetch", {
        productId,
        source: safe ? "provider" : "fallback",
        status: response.status,
        contentType,
      });
    }
    if (!response.ok || !safe || !image || !response.body) {
      return { ok: false, status: response.ok ? 502 : response.status, body: null, contentType };
    }
    return { ok: true, status: 200, body: response.body, contentType };
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.info("Product image fetch", {
        productId,
        source: "fallback",
        status: 504,
        contentType: "",
      });
    }
    return { ok: false, status: 504, body: null, contentType: "" };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeProductImageUrl(value: string | null | undefined) {
  return normalizeTcgTrackingImageUrl(value) ?? normalizeTcgPlayerProductImageUrl(value);
}

function isAllowedProductImageUrl(value: string | null | undefined, productId: number) {
  return (
    isAllowedTcgTrackingImageUrl(value, productId) ||
    isAllowedTcgPlayerProductImageUrl(value, productId)
  );
}
