import type {
  TcgTrackingClient,
} from "./client.ts";
import type {
  TcgTrackingProduct,
  TcgTrackingScanCandidate,
  TcgTrackingScanResult,
  TradingDocksProductIdentity,
} from "./types.ts";
import {
  getGameByTcgTrackingGameId,
  TCGTRACKING_MAGIC_GAME_ID,
} from "../../multi-tcg/registry.ts";

export const TCGTRACKING_SCAN_PROVIDER = "tcgtracking";
export const TCGTRACKING_SCAN_DEFAULT_LIMIT = 5;
export const TCGTRACKING_SCAN_MAX_LIMIT = 10;
export const TCGTRACKING_SCAN_MAX_IMAGE_BYTES = 100_000;
export const TCGTRACKING_SCAN_TIMEOUT_MS = 4500;

export type TcgTrackingConfidenceBand =
  | "high"
  | "medium"
  | "low";

export const TCGTRACKING_SCAN_CONFIDENCE = {
  high: 0.92,
  medium: 0.78,
} as const;

export type TradingDocksScannerCandidate = {
  source: "tcgtracking";
  tcgplayerProductId?: number;
  providerProductId?: string;
  productIdentity?: TradingDocksProductIdentity | null;
  name?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  imageUrl?: string;
  confidence: number;
  requiresConfirmation: true;
};

export type TcgTrackingScanProviderRequest = {
  image: string;
  gameId?: number;
  setIds?: number[];
  limit?: 5 | 10;
};

export type TcgTrackingPreparedScanImage = {
  image: string;
  width?: number;
  height?: number;
  bytes: number;
  mimeType: "image/jpeg";
};

export type TcgTrackingScannerAdapterResult = {
  status: "candidates" | "unresolved" | "provider_failed";
  candidates: TradingDocksScannerCandidate[];
  latencyMs?: number;
  error?: string;
  topConfidence?: number;
  confidenceBand?: TcgTrackingConfidenceBand;
  fallbackRecommended: boolean;
  rawCandidateCount?: number;
  candidateProductIds?: string[];
  productLookupFailures?: number;
  httpStatus?: number;
};

export type TcgTrackingScanHealthStatus = "SUCCESS_MATCH" | "SUCCESS_NO_MATCH" | "HTTP_ERROR" | "INVALID_RESPONSE" | "IMAGE_ERROR";

export function validateTcgTrackingScanImage(image: Blob | ArrayBuffer | Uint8Array | string) {
  const bytes = typeof image === "string"
    ? decodedImageBytes(image)
    : image instanceof Blob
      ? image.size
      : image.byteLength;
  return { bytes, valid: bytes > 0 && bytes <= TCGTRACKING_SCAN_MAX_IMAGE_BYTES };
}

export async function runTcgTrackingScanHealthCheck(input: {
  client: Pick<TcgTrackingClient, "scanCardImage" | "product">;
  image: Blob | ArrayBuffer | Uint8Array | string;
  gameId?: number;
}): Promise<TcgTrackingScanHealthStatus> {
  if (!validateTcgTrackingScanImage(input.image).valid) return "IMAGE_ERROR";
  const result = await scanCardImageWithTcgTracking({ ...input, limit: 10 });
  if (result.status === "provider_failed") {
    return result.error?.toLowerCase().includes("malformed") ? "INVALID_RESPONSE" : "HTTP_ERROR";
  }
  return result.candidates.length ? "SUCCESS_MATCH" : "SUCCESS_NO_MATCH";
}

export async function scanCardImageWithTcgTracking(input: {
  client: Pick<TcgTrackingClient, "scanCardImage" | "product">;
  image: Blob | ArrayBuffer | Uint8Array | string;
  category?: string;
  gameId?: number;
  setIds?: number[];
  limit?: 5 | 10;
}): Promise<TcgTrackingScannerAdapterResult> {
  const result = await input.client.scanCardImage({
    image: input.image,
    category: input.category,
    gameId: input.gameId,
    setIds: input.setIds,
    limit: input.limit,
  });
  const rawCandidateCount = result.candidates.length;
  const candidateProductIds = result.candidates.map((candidate) => candidate.providerProductId ?? String(candidate.tcgplayerProductId ?? "")).filter(Boolean);
  const enriched = await enrichScanResultWithProducts(result, input.client);
  const adapted = scannerAdapterResult(enriched);
  return { ...adapted, rawCandidateCount, candidateProductIds, productLookupFailures: enriched.productLookupFailures ?? 0, httpStatus: result.httpStatus };
}

export function scannerAdapterResult(
  result: TcgTrackingScanResult,
): TcgTrackingScannerAdapterResult {
  if (result.status === "provider_failed") {
    return {
      status: "provider_failed",
      candidates: [],
      latencyMs: result.latencyMs,
      error: result.error,
      httpStatus: result.httpStatus,
      fallbackRecommended: true,
    };
  }

  const candidates = result.candidates
    .map(toTradingDocksScannerCandidate)
    .filter(
      (candidate): candidate is TradingDocksScannerCandidate =>
        Boolean(candidate),
    );

  return {
    status: candidates.length ? "candidates" : "unresolved",
    candidates,
    latencyMs: result.latencyMs,
    topConfidence: candidates[0]?.confidence,
    confidenceBand: classifyTcgTrackingScanConfidence(candidates[0]?.confidence ?? 0),
    fallbackRecommended:
      !candidates.length ||
      classifyTcgTrackingScanConfidence(candidates[0]?.confidence ?? 0) === "low",
  };
}

export function normalizeTcgTrackingScanProviderRequest(
  value: unknown,
): { ok: true; request: Required<Pick<TcgTrackingScanProviderRequest, "gameId" | "limit">> & TcgTrackingScanProviderRequest }
  | { ok: false; status: number; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, status: 400, error: "Provide a scan image." };
  }

  const source = value as Record<string, unknown>;
  const image = typeof source.image === "string" ? source.image.trim() : "";
  if (!image) {
    return { ok: false, status: 400, error: "Provide a compressed card image." };
  }

  const bytes = decodedImageBytes(image);
  if (bytes <= 0) {
    return { ok: false, status: 400, error: "Provide a valid base64 JPEG image." };
  }
  if (bytes > TCGTRACKING_SCAN_MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `TCGTracking scan images must be ${TCGTRACKING_SCAN_MAX_IMAGE_BYTES} bytes or less.`,
    };
  }

  const gameId = normalizePositiveInteger(source.gameId ?? source.game_id)
    ?? TCGTRACKING_MAGIC_GAME_ID;
  if (!getGameByTcgTrackingGameId(gameId)) {
    return {
      ok: false,
      status: 400,
      error: "Choose a supported scanner game.",
    };
  }
  const limitValue = normalizePositiveInteger(source.limit);
  const limit = limitValue === TCGTRACKING_SCAN_MAX_LIMIT
    ? TCGTRACKING_SCAN_MAX_LIMIT
    : TCGTRACKING_SCAN_DEFAULT_LIMIT;
  const setIds = normalizeSetIds(source.setIds ?? source.set_ids);

  return {
    ok: true,
    request: {
      image,
      gameId,
      setIds,
      limit,
    },
  };
}

export function classifyTcgTrackingScanConfidence(
  confidence: number,
): TcgTrackingConfidenceBand {
  const normalized = normalizeConfidence(confidence);
  if (normalized >= TCGTRACKING_SCAN_CONFIDENCE.high) return "high";
  if (normalized >= TCGTRACKING_SCAN_CONFIDENCE.medium) return "medium";
  return "low";
}

export function decodedImageBytes(image: string) {
  const base64 = image.includes(",") ? image.split(",").pop() ?? "" : image;
  const clean = base64.replace(/\s+/g, "");
  if (!clean || /[^A-Za-z0-9+/=_-]/.test(clean)) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export async function enrichScanResultWithProducts(
  result: TcgTrackingScanResult,
  client: Pick<TcgTrackingClient, "product">,
): Promise<TcgTrackingScanResult> {
  if (result.status !== "matched" || !result.candidates.length) return result;
  let productLookupFailures = 0;
  const enriched = await Promise.all(
    result.candidates.slice(0, TCGTRACKING_SCAN_MAX_LIMIT).map(async (candidate) => {
      const productId = candidate.providerProductId ?? candidate.tcgplayerProductId?.toString();
      if (!productId) return candidate;
      try {
        const product = await client.product(productId);
        if (!product) {
          productLookupFailures += 1;
          return candidate;
        }
        return mergeProductIdentity(candidate, product);
      } catch {
        productLookupFailures += 1;
        return candidate;
      }
    }),
  );
  return {
    ...result,
    candidates: enriched.sort((left, right) => right.confidence - left.confidence),
    productLookupFailures,
  };
}

function toTradingDocksScannerCandidate(
  candidate: TcgTrackingScanCandidate,
): TradingDocksScannerCandidate | null {
  if (!candidate.tcgplayerProductId && !candidate.providerProductId) {
    return null;
  }

  return {
    source: "tcgtracking",
    tcgplayerProductId: candidate.tcgplayerProductId,
    providerProductId: candidate.providerProductId,
    productIdentity: candidate.productIdentity,
    name: candidate.name,
    setName: candidate.setName,
    setCode: candidate.setCode,
    collectorNumber: candidate.collectorNumber,
    imageUrl: candidate.imageUrl,
    confidence: candidate.confidence,
    requiresConfirmation: true,
  };
}

function mergeProductIdentity(
  candidate: TcgTrackingScanCandidate,
  product: TcgTrackingProduct,
): TcgTrackingScanCandidate {
  const productIdentity: TradingDocksProductIdentity = {
    gameCategoryId: product.categoryId,
    tcgplayerProductId: product.tcgplayerProductId ?? candidate.tcgplayerProductId,
    name: product.name,
    setName: product.setName ?? candidate.setName,
    setCode: product.setCode ?? candidate.setCode,
    collectorNumber: product.collectorNumber ?? candidate.collectorNumber,
    scryfallId: product.scryfallId,
    mtgjsonUuid: product.mtgjsonUuid,
    cardtraderId: product.cardtraderId,
    cardmarketId: product.cardmarketId,
    imageUrl: product.imageUrl ?? candidate.imageUrl,
    providerProductId: product.providerProductId,
  };

  return {
    ...candidate,
    providerProductId: product.providerProductId,
    tcgplayerProductId: product.tcgplayerProductId ?? candidate.tcgplayerProductId,
    productIdentity,
    name: product.name ?? candidate.name,
    setName: product.setName ?? candidate.setName,
    setCode: product.setCode ?? candidate.setCode,
    collectorNumber: product.collectorNumber ?? candidate.collectorNumber,
    imageUrl: product.imageUrl ?? candidate.imageUrl,
  };
}

function normalizeConfidence(confidence: number) {
  return Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
    : 0;
}

function normalizePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeSetIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(normalizePositiveInteger)
        .filter((entry): entry is number => entry !== null),
    ),
  ];
}
