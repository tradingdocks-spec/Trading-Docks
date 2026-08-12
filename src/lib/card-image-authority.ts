import { chooseExactProductImage } from "./providers/tcgtracking/identity.ts";

export type ExactProductImageInput = {
  gameId?: "magic" | "pokemon" | string | null;
  productType?: "card" | "sealed" | string | null;
  tradingDocksImageUrl?: string | null;
  knownExactImageUrl?: string | null;
  providerProductId?: number | string | null;
  tcgplayerProductId?: number | string | null;
  tcgTrackingImageUrl?: string | null;
  scryfallFallbackUrl?: string | null;
};

const TCGTRACKING_IMAGE_ORIGIN = "https://cdn.tcgtracking.com";
const TCGTRACKING_IMAGE_HOST = "cdn.tcgtracking.com";

export function resolveExactProductImageUrl(input: ExactProductImageInput) {
  const tcgTrackingImageUrl =
    input.tcgTrackingImageUrl ??
    tcgTrackingProductImageUrl(input.tcgplayerProductId ?? input.providerProductId);
  if (input.gameId === "pokemon" && (input.providerProductId || input.tcgplayerProductId)) {
    return productImageProxyUrl({
      gameId: input.gameId,
      productType: input.productType,
      providerProductId: input.providerProductId ?? input.tcgplayerProductId,
      tcgplayerProductId: input.tcgplayerProductId,
      sourceUrl: tcgTrackingImageUrl,
    });
  }

  return chooseExactProductImage({
    tradingDocksImageUrl: input.tradingDocksImageUrl,
    product: input.knownExactImageUrl
      ? {
        gameCategoryId: "magic",
        name: "Exact product",
        imageUrl: input.knownExactImageUrl,
      }
      : null,
    tcgTrackingImageUrl,
    scryfallFallbackUrl: input.scryfallFallbackUrl,
  });
}

export function tcgTrackingProductImageUrl(productId: number | string | null | undefined) {
  const numericProductId = Number(productId);
  if (!Number.isSafeInteger(numericProductId) || numericProductId <= 0) {
    return null;
  }
  return `${TCGTRACKING_IMAGE_ORIGIN}/product/${numericProductId}_200w.jpg`;
}

export function normalizeTcgTrackingImageUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = raw.startsWith("//")
      ? new URL(`https:${raw}`)
      : raw.startsWith("/")
        ? new URL(raw, TCGTRACKING_IMAGE_ORIGIN)
        : new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== TCGTRACKING_IMAGE_HOST) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isAllowedTcgTrackingImageUrl(
  value: string | null | undefined,
  productId?: number | string | null,
) {
  const url = normalizeTcgTrackingImageUrl(value);
  if (!url) return false;
  if (productId == null || productId === "") return true;
  const numericProductId = Number(productId);
  if (!Number.isSafeInteger(numericProductId) || numericProductId <= 0) {
    return false;
  }
  return new URL(url).pathname.startsWith(`/product/${numericProductId}_`);
}

export function productImageProxyUrl(input: {
  gameId: string;
  productType?: string | null;
  providerProductId?: number | string | null;
  tcgplayerProductId?: number | string | null;
  sourceUrl?: string | null;
}) {
  const productId = input.tcgplayerProductId ?? input.providerProductId;
  const numericProductId = Number(productId);
  if (!Number.isSafeInteger(numericProductId) || numericProductId <= 0) {
    return null;
  }

  const params = new URLSearchParams({
    gameId: input.gameId,
    providerProductId: String(input.providerProductId ?? numericProductId),
    productType: input.productType ?? "card",
  });
  if (input.tcgplayerProductId != null) {
    params.set("tcgplayerProductId", String(input.tcgplayerProductId));
  }
  const sourceUrl = normalizeTcgTrackingImageUrl(input.sourceUrl);
  if (sourceUrl && isAllowedTcgTrackingImageUrl(sourceUrl, numericProductId)) {
    params.set("source", sourceUrl);
  }
  return `/api/catalog/product-image?${params.toString()}`;
}
