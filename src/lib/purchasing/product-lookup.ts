import { resolveExactProductImageUrl } from "../card-image-authority.ts";
import type { SupportedGameId } from "../multi-tcg/index.ts";
import { marketSourcesForGame, variantOptionsForGame } from "../multi-tcg/index.ts";
import type { TcgProductSearchResult, TcgProductSkuOption } from "../providers/tcgtracking/product-search.ts";
import type { SealedProductSearchResult } from "../tcgcsv/types.ts";

export type PurchasingProductType = "card" | "sealed";
export type PurchasingGameId = Extract<SupportedGameId, "magic" | "pokemon">;

export type PurchasingSkuOption = {
  id: string;
  providerSkuId: string | null;
  tcgplayerSkuId: number | null;
  condition: string;
  variant: string;
  language: string;
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  activeListings: number | null;
  lastSyncedAt?: string | null;
};

export type PurchasingLookupResult = {
  id: string;
  gameId: PurchasingGameId;
  gameLabel: string;
  productType: PurchasingProductType;
  provider: "scryfall" | "tcgtracking" | "tcgcsv";
  providerProductId: string | null;
  tcgplayerProductId: number | null;
  scryfallId?: string | null;
  name: string;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  productFamily?: string | null;
  variants: string[];
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  activeListings: number | null;
  freshness: string | null;
  marketSources: string[];
  skus: PurchasingSkuOption[];
};

export type PurchaseWorkspaceLine = {
  id: string;
  product: PurchasingLookupResult;
  sku: PurchasingSkuOption | null;
  quantity: number;
  marketReference: number | null;
  offerPercent: number | null;
  unitOffer: number;
  storeCreditOffer: number | null;
  storageLocationId?: string | null;
};

export type PurchaseCartSummary = {
  itemCount: number;
  unitCount: number;
  marketValue: number;
  cashOffer: number;
  storeCreditOffer: number;
  effectiveBuyRate: number | null;
};

export function tcgProductToPurchasingResult(
  product: TcgProductSearchResult,
  skus: TcgProductSkuOption[] = [],
): PurchasingLookupResult {
  const skuOptions = skus.map(tcgSkuToPurchasingSku);
  const selectedSku = bestPricedSku(skuOptions);
  return {
    id: `pokemon:card:${product.providerProductId}`,
    gameId: "pokemon",
    gameLabel: "Pokemon",
    productType: "card",
    provider: "tcgtracking",
    providerProductId: product.providerProductId,
    tcgplayerProductId: product.tcgplayerProductId,
    name: product.name,
    setName: product.setName ?? null,
    setCode: product.setCode ?? null,
    collectorNumber: product.collectorNumber ?? null,
    rarity: product.rarity ?? null,
    imageUrl: resolveExactProductImageUrl({
      gameId: "pokemon",
      productType: "card",
      providerProductId: product.providerProductId,
      tcgplayerProductId: product.tcgplayerProductId,
      tcgTrackingImageUrl: product.imageUrl,
    }),
    variants: product.variants.length ? product.variants : variantOptionsForGame("pokemon"),
    marketPrice: selectedSku?.marketPrice ?? null,
    lowPrice: selectedSku?.lowPrice ?? null,
    highPrice: selectedSku?.highPrice ?? null,
    activeListings: selectedSku?.activeListings ?? null,
    freshness: selectedSku?.lastSyncedAt ?? null,
    marketSources: marketSourcesForGame("pokemon"),
    skus: skuOptions,
  };
}

export function pokemonSealedToPurchasingResult(product: TcgProductSearchResult): PurchasingLookupResult {
  return {
    ...tcgProductToPurchasingResult(product, []),
    id: `pokemon:sealed:${product.providerProductId}`,
    productType: "sealed",
    imageUrl: resolveExactProductImageUrl({
      gameId: "pokemon",
      productType: "sealed",
      providerProductId: product.providerProductId,
      tcgplayerProductId: product.tcgplayerProductId,
      tcgTrackingImageUrl: product.imageUrl,
    }),
    productFamily: product.setName ?? null,
    variants: ["Sealed"],
    marketSources: ["TCGplayer", "TCGTracking", "Cardmarket"],
    skus: [],
  };
}

export function magicSealedToPurchasingResult(product: SealedProductSearchResult): PurchasingLookupResult {
  return {
    id: `magic:sealed:${product.productId}`,
    gameId: "magic",
    gameLabel: "Magic",
    productType: "sealed",
    provider: "tcgcsv",
    providerProductId: String(product.productId),
    tcgplayerProductId: product.productId,
    name: product.name,
    setName: product.groupName,
    setCode: null,
    collectorNumber: null,
    rarity: null,
    imageUrl: resolveExactProductImageUrl({
      gameId: "magic",
      productType: "sealed",
      providerProductId: product.productId,
      tcgplayerProductId: product.productId,
      knownExactImageUrl: product.imageUrl,
    }),
    productFamily: product.productType,
    variants: ["Sealed"],
    marketPrice: product.marketPrice || null,
    lowPrice: product.lowPrice || null,
    highPrice: product.midPrice || null,
    activeListings: null,
    freshness: product.modifiedOn ?? null,
    marketSources: ["TCGplayer"],
    skus: [],
  };
}

export function magicScryfallToPurchasingResult(card: Record<string, unknown>): PurchasingLookupResult {
  const prices = isRecord(card.prices) ? card.prices : {};
  const imageUris = isRecord(card.image_uris) ? card.image_uris : {};
  const finishes = Array.isArray(card.finishes) ? card.finishes.filter((value): value is string => typeof value === "string") : [];
  const normalPrice = money(prices.usd);
  const foilPrice = money(prices.usd_foil);
  const etchedPrice = money(prices.usd_etched);
  const market = normalPrice ?? foilPrice ?? etchedPrice;
  const low = [normalPrice, foilPrice, etchedPrice].filter((value): value is number => value != null).sort((a, b) => a - b)[0] ?? null;

  return {
    id: `magic:card:${stringValue(card.id)}`,
    gameId: "magic",
    gameLabel: "Magic",
    productType: "card",
    provider: "scryfall",
    providerProductId: stringValue(card.id),
    tcgplayerProductId: numberOrNull(card.tcgplayer_id),
    scryfallId: stringValue(card.id),
    name: stringValue(card.name) || "Magic card",
    setName: stringValue(card.set_name) || null,
    setCode: stringValue(card.set)?.toUpperCase() || null,
    collectorNumber: stringValue(card.collector_number) || null,
    rarity: stringValue(card.rarity) || null,
    imageUrl: stringValue(imageUris.normal) || stringValue(imageUris.large) || null,
    variants: finishes.length ? finishes.map(formatMagicFinish) : variantOptionsForGame("magic"),
    marketPrice: market,
    lowPrice: low,
    highPrice: Math.max(...[normalPrice, foilPrice, etchedPrice].filter((value): value is number => value != null), 0) || null,
    activeListings: null,
    freshness: stringValue(card.released_at) || null,
    marketSources: marketSourcesForGame("magic"),
    skus: magicFinishSkus(finishes, { normalPrice, foilPrice, etchedPrice }),
  };
}

export function calculateBuyingOffer(marketPrice: number | null | undefined, offerPercent: number | null | undefined = 60, storeCreditBonusPercent = 15) {
  const market = marketPrice == null ? null : Number(marketPrice);
  const rawPercent = offerPercent == null ? Number.NaN : Number(offerPercent);
  const percent = Number.isFinite(rawPercent) ? Math.max(0, Math.min(100, rawPercent)) : null;
  const storeCreditBonus = Math.max(0, Math.min(100, Number(storeCreditBonusPercent)));
  const hasMarket = market != null && Number.isFinite(market);
  const cashOffer = hasMarket && percent != null ? roundMoney(market * (percent / 100)) : null;
  return {
    marketReference: hasMarket ? roundMoney(market) : null,
    offerPercent: percent,
    cashOffer,
    storeCreditOffer: cashOffer == null ? null : roundMoney(cashOffer * (1 + storeCreditBonus / 100)),
    spread: hasMarket && cashOffer != null ? roundMoney(Math.max(0, market - cashOffer)) : null,
  };
}

export function buildPurchaseWorkspaceLine(input: {
  product: PurchasingLookupResult;
  sku?: PurchasingSkuOption | null;
  quantity: number;
  offerPercent?: number;
  storeCreditBonusPercent?: number;
}): PurchaseWorkspaceLine {
  const quantity = Math.max(1, Math.floor(input.quantity));
  const market = input.sku?.marketPrice ?? input.sku?.lowPrice ?? input.product.marketPrice ?? input.product.lowPrice;
  const offer = calculateBuyingOffer(market, input.offerPercent, input.storeCreditBonusPercent);
  return {
    id: purchaseLineIdentity(input.product, input.sku),
    product: input.product,
    sku: input.sku ?? null,
    quantity,
    marketReference: offer.marketReference,
    offerPercent: offer.offerPercent,
    unitOffer: offer.cashOffer ?? 0,
    storeCreditOffer: offer.storeCreditOffer,
  };
}

export function addOrIncrementPurchaseLine(
  lines: PurchaseWorkspaceLine[],
  line: PurchaseWorkspaceLine,
) {
  const existing = lines.find((item) => item.id === line.id);
  if (!existing) return [...lines, line];
  return lines.map((item) =>
    item.id === line.id
      ? { ...item, quantity: item.quantity + line.quantity }
      : item,
  );
}

export function updatePurchaseLineQuantity(
  lines: PurchaseWorkspaceLine[],
  lineId: string,
  quantity: number,
) {
  const parsedQuantity = Math.floor(Number(quantity));
  const nextQuantity = Number.isFinite(parsedQuantity) ? Math.max(1, parsedQuantity) : 1;
  return lines.map((line) =>
    line.id === lineId ? { ...line, quantity: nextQuantity } : line,
  );
}

export function removePurchaseLine(lines: PurchaseWorkspaceLine[], lineId: string) {
  return lines.filter((line) => line.id !== lineId);
}

export function summarizePurchaseCart(lines: PurchaseWorkspaceLine[]): PurchaseCartSummary {
  const marketValue = roundMoney(lines.reduce((sum, line) =>
    sum + (line.marketReference ?? 0) * line.quantity, 0));
  const cashOffer = roundMoney(lines.reduce((sum, line) =>
    sum + line.unitOffer * line.quantity, 0));
  const storeCreditOffer = roundMoney(lines.reduce((sum, line) =>
    sum + (line.storeCreditOffer ?? line.unitOffer) * line.quantity, 0));
  return {
    itemCount: lines.length,
    unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    marketValue,
    cashOffer,
    storeCreditOffer,
    effectiveBuyRate: marketValue > 0 ? roundMoney((cashOffer / marketValue) * 100) : null,
  };
}

export function purchaseLineIdentity(product: PurchasingLookupResult, sku?: PurchasingSkuOption | null) {
  return [
    product.gameId,
    product.productType,
    product.providerProductId ?? product.scryfallId ?? product.id,
    sku?.providerSkuId ?? sku?.id ?? "default",
    sku?.condition ?? "default",
    sku?.variant ?? product.variants[0] ?? "default",
    sku?.language ?? "English",
  ].join(":");
}

export function toPurchaseHistoryPayload(lines: PurchaseWorkspaceLine[]) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.unitOffer * line.quantity, 0));
  return {
    action: "create-purchase",
    purchase: {
      sourceType: "collection_buying",
      sellerName: "Purchasing Intelligence draft",
      status: "pending",
      paymentMethod: "unknown",
      subtotal,
      adjustment: 0,
      totalCost: subtotal,
      itemCount: lines.length,
      unitCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      notes: "Created from Purchasing Intelligence.",
      details: { source: "purchasing-intelligence" },
      lines: lines.map((line) => ({
        lineType: line.product.productType === "sealed" ? "sealed_product" : "single",
        description: line.product.name,
        quantity: line.quantity,
        unitCount: line.quantity,
        unitCost: line.unitOffer,
        totalCost: roundMoney(line.unitOffer * line.quantity),
        inventoryItemId: null,
        details: purchaseLineDetails(line),
      })),
    },
  };
}

export function buildInventorySku(input: {
  product: PurchasingLookupResult;
  sku?: PurchasingSkuOption | null;
  condition?: string;
  variant?: string;
  language?: string;
}) {
  const product = input.product;
  return [
    product.gameId,
    product.productType,
    product.providerProductId ?? product.scryfallId ?? product.id,
    input.sku?.providerSkuId ?? "sku",
    input.condition ?? input.sku?.condition ?? "default",
    input.variant ?? input.sku?.variant ?? "default",
    input.language ?? input.sku?.language ?? "English",
  ].map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")).join(":");
}

export function purchaseLineDetails(line: PurchaseWorkspaceLine) {
  return {
    game_id: line.product.gameId,
    product_type: line.product.productType,
    provider: line.product.provider,
    provider_product_id: line.product.providerProductId,
    tcgplayer_product_id: line.product.tcgplayerProductId,
    provider_sku_id: line.sku?.providerSkuId ?? null,
    tcgplayer_sku_id: line.sku?.tcgplayerSkuId ?? null,
    condition: line.sku?.condition ?? null,
    variant: line.sku?.variant ?? line.product.variants[0] ?? null,
    language: line.sku?.language ?? "English",
    market_reference: line.marketReference ?? line.sku?.marketPrice ?? line.product.marketPrice,
    buying_percent: line.offerPercent,
    unit_offer: line.unitOffer,
    store_credit_offer: line.storeCreditOffer,
  };
}

function tcgSkuToPurchasingSku(sku: TcgProductSkuOption): PurchasingSkuOption {
  return {
    id: sku.providerSkuId,
    providerSkuId: sku.providerSkuId,
    tcgplayerSkuId: sku.tcgplayerSkuId,
    condition: sku.condition,
    variant: sku.variant,
    language: sku.language,
    marketPrice: sku.marketPrice,
    lowPrice: sku.lowPrice,
    highPrice: sku.highPrice,
    activeListings: sku.activeListings,
    lastSyncedAt: sku.lastSyncedAt ?? null,
  };
}

function bestPricedSku(skus: PurchasingSkuOption[]) {
  return [...skus]
    .filter((sku) => sku.marketPrice != null || sku.lowPrice != null)
    .sort((left, right) => (right.marketPrice ?? right.lowPrice ?? 0) - (left.marketPrice ?? left.lowPrice ?? 0))[0] ?? null;
}

function magicFinishSkus(finishes: string[], prices: { normalPrice: number | null; foilPrice: number | null; etchedPrice: number | null }): PurchasingSkuOption[] {
  const available = finishes.length ? finishes : ["nonfoil", "foil"];
  return available.map((finish) => {
    const label = formatMagicFinish(finish);
    const marketPrice = finish === "foil" ? prices.foilPrice : finish === "etched" ? prices.etchedPrice : prices.normalPrice;
    return {
      id: `magic-${finish}`,
      providerSkuId: null,
      tcgplayerSkuId: null,
      condition: "Near Mint",
      variant: label,
      language: "English",
      marketPrice,
      lowPrice: marketPrice,
      highPrice: marketPrice,
      activeListings: null,
    };
  });
}

function formatMagicFinish(value: string) {
  if (value === "nonfoil") return "Normal";
  if (value === "etched") return "Etched";
  if (value === "foil") return "Foil";
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? roundMoney(number) : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
