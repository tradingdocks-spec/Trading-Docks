import { chooseExactProductImage } from "./providers/tcgtracking/identity.ts";

export type ExactProductImageInput = {
  tradingDocksImageUrl?: string | null;
  knownExactImageUrl?: string | null;
  tcgplayerProductId?: number | string | null;
  tcgTrackingImageUrl?: string | null;
  scryfallFallbackUrl?: string | null;
};

export function resolveExactProductImageUrl(input: ExactProductImageInput) {
  return chooseExactProductImage({
    tradingDocksImageUrl: input.tradingDocksImageUrl,
    product: input.knownExactImageUrl
      ? {
        gameCategoryId: "magic",
        name: "Exact product",
        imageUrl: input.knownExactImageUrl,
      }
      : null,
    tcgTrackingImageUrl:
      input.tcgTrackingImageUrl ??
      tcgTrackingProductImageUrl(input.tcgplayerProductId),
    scryfallFallbackUrl: input.scryfallFallbackUrl,
  });
}

export function tcgTrackingProductImageUrl(productId: number | string | null | undefined) {
  const numericProductId = Number(productId);
  if (!Number.isSafeInteger(numericProductId) || numericProductId <= 0) {
    return null;
  }
  return `https://cdn.tcgtracking.com/product/${numericProductId}_200w.jpg`;
}
