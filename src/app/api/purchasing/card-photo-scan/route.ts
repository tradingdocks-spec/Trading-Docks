import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
import { parseRetryAfterMs } from "@/lib/chaos-sort/batch-queue";
import { classifyProviderFailure, providerFailureDetails } from "@/lib/chaos-sort/provider-errors";
import sharp from "sharp";

import type {
  CardCandidate,
  CardScanResponse,
  ScanIdentification,
} from "@/lib/card-photo-scanner/types";
import { resolveExactProductImageUrl } from "@/lib/card-image-authority";
import {
  TCGTRACKING_MAGIC_GAME_ID,
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  createTcgTrackingClient,
} from "@/lib/providers/tcgtracking/client";
import {
  TCGTRACKING_SCAN_MAX_IMAGE_BYTES,
  decodedImageBytes,
  scanCardImageWithTcgTracking,
} from "@/lib/providers/tcgtracking/scanner";
import { chaosSortRecognitionMessage } from "@/lib/chaos-sort/recognition-messages";
import {
  resolveTcgProductSkus,
  searchTcgProducts,
  type TcgProductSearchResult,
  type TcgProductSkuOption,
} from "@/lib/providers/tcgtracking/product-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRYFALL = "https://api.scryfall.com";
const USER_AGENT = "TradingDocks/0.56 card-photo-scanner";
const POKEMON_GAME = "pokemon";
const VISION_TIMEOUT_MS = 30_000;
const OPENAI_FALLBACK_ENABLED = process.env.CHAOS_SORT_OPENAI_FALLBACK === "true";
const candidateCache = new Map<string, { expiresAt: number; candidates: CardCandidate[] }>();
const scryfallPrintingCache = new Map<string, { expiresAt: number; candidate: CardCandidate | null }>();

type ProviderFailureReason = "configuration" | "auth" | "provider" | "timeout" | "parse" | "image_decode" | "catalog" | "quota_exhausted" | "rate_limited" | "temporarily_unavailable" | "tcgtracking_scan" | "product_lookup" | "malformed_provider" | "image_normalization";

class RecognitionPipelineError extends Error {
  constructor(
    readonly reason: ProviderFailureReason,
    message: string,
    readonly providerCode?: string | null,
    readonly retryAfterMs?: number | null,
    readonly httpStatus?: number | null,
  ) {
    super(message);
    this.name = "RecognitionPipelineError";
  }
}

function recognitionLog(stage: string, details: Record<string, unknown> = {}) {
  console.info("Chaos Sort recognition", { stage, ...details });
}

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  finishes?: string[];
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  scryfall_uri?: string;
  purchase_uris?: { tcgplayer?: string; cardmarket?: string };
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
};

function numeric(value: string | null | undefined) {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function cardImage(card: ScryfallCard) {
  return (
    card.image_uris?.large ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.large ??
    card.card_faces?.[0]?.image_uris?.normal ??
    null
  );
}

function toCandidate(
  card: ScryfallCard,
  identification: ScanIdentification,
  index: number,
): CardCandidate {
  const exactSet = identification.setCode?.toLowerCase() === card.set.toLowerCase();
  const exactCollector = identification.collectorNumber === card.collector_number;
  const confidence = Math.min(
    0.995,
    Math.max(0.55, identification.confidence - index * 0.05) +
      (exactSet ? 0.1 : 0) +
      (exactCollector ? 0.14 : 0),
  );

  return {
    id: card.id,
    name: card.name,
    setName: card.set_name,
    setCode: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    language: card.lang,
    finishes: card.finishes ?? [],
    imageUrl: cardImage(card),
    scryfallUrl: card.scryfall_uri ?? null,
    gameId: "magic",
    provider: "scryfall",
    confidence,
    prices: [
      {
        label: "Nonfoil reference",
        value: numeric(card.prices?.usd),
        currency: "USD",
        source: "Scryfall",
        available: Boolean(card.prices?.usd),
        url: card.scryfall_uri ?? null,
      },
      {
        label: "Foil reference",
        value: numeric(card.prices?.usd_foil),
        currency: "USD",
        source: "Scryfall",
        available: Boolean(card.prices?.usd_foil),
        url: card.scryfall_uri ?? null,
      },
      {
        label: "Etched reference",
        value: numeric(card.prices?.usd_etched),
        currency: "USD",
        source: "Scryfall",
        available: Boolean(card.prices?.usd_etched),
        url: card.scryfall_uri ?? null,
      },
      {
        label: "TCGplayer exact-printing listings",
        value: null,
        currency: "USD",
        source: "TCGplayer",
        available: Boolean(card.purchase_uris?.tcgplayer),
        url: card.purchase_uris?.tcgplayer ?? null,
        note: "Live listing API connection can be added later.",
      },
      {
        label: "Cardmarket exact-printing listings",
        value: null,
        currency: "EUR",
        source: "Cardmarket",
        available: Boolean(card.purchase_uris?.cardmarket),
        url: card.purchase_uris?.cardmarket ?? null,
      },
    ],
  };
}

function parseVisionJson(text: string): Partial<ScanIdentification> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON in vision response");
  return JSON.parse(fenced.slice(start, end + 1)) as Partial<ScanIdentification>;
}

async function identifyWithVision(file: File, requestItemId: string, attempt: number): Promise<ScanIdentification | null> {
  if (!process.env.OPENAI_API_KEY) throw new RecognitionPipelineError("configuration", "Image recognition is not configured on the server.");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength < 16) throw new RecognitionPipelineError("image_decode", "The scanner image is empty or could not be decoded.");
  recognitionLog("IMAGE DECODED", { contentType: file.type, bytes: bytes.byteLength });
  const data = Buffer.from(bytes).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  let response: Response;
  try {
    recognitionLog("REQUEST SENT", { provider: "openai", model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini", itemId: requestItemId, attempt });
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Identify this Magic: The Gathering card. Return JSON only with name, setCode, collectorNumber, language, finish, confidence, notes. Use null instead of guessing unreadable printing details.",
              },
              {
                type: "input_image",
                image_url: `data:${file.type};base64,${data}`,
                detail: "high",
              },
            ],
          },
        ],
        max_output_tokens: 300,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      recognitionLog("TIMEOUT", { provider: "openai", timeoutMs: VISION_TIMEOUT_MS });
      throw new RecognitionPipelineError("timeout", "Recognition request timed out.");
    }
    recognitionLog("PROVIDER FAILURE", { provider: "openai", message: error instanceof Error ? error.message : "network error" });
    throw new RecognitionPipelineError("provider", "The recognition provider could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    let providerPayload: unknown = null;
    try {
      providerPayload = await response.clone().json();
    } catch {
      // The status and headers are still useful when the provider does not return JSON.
    }
    const details = providerFailureDetails(providerPayload);
    const reason = classifyProviderFailure(response.status, details);
    const retryAfter = response.headers.get("retry-after");
    const retryAfterMs = parseRetryAfterMs(retryAfter);
    if (response.status === 401 || response.status === 403) {
      recognitionLog("AUTH FAILURE", { provider: "openai", status: response.status, type: details.type, code: details.code, itemId: requestItemId, attempt });
      throw new RecognitionPipelineError("auth", "Recognition provider authentication failed.", details.code);
    }
    recognitionLog("PROVIDER FAILURE", { provider: "openai", status: response.status, type: details.type, code: details.code, requestId: response.headers.get("x-request-id"), retryAfter, itemId: requestItemId, attempt });
    throw new RecognitionPipelineError(
      reason,
      reason === "quota_exhausted" ? "Recognition quota is unavailable." : reason === "rate_limited" ? "Recognition is temporarily unavailable." : "Recognition provider is temporarily unavailable.",
      details.code,
      retryAfterMs,
    );
  }
  let payload: {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    recognitionLog("PARSE FAILURE", { provider: "openai", response: "json" });
    throw new RecognitionPipelineError("parse", "Recognition provider returned invalid JSON.");
  }
  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ??
    "";
  if (!text) throw new RecognitionPipelineError("parse", "Recognition provider returned no readable result.");
  recognitionLog("OCR RESULT", { provider: "openai", characters: text.length });
  let parsed: Partial<ScanIdentification>;
  try {
    parsed = parseVisionJson(text);
  } catch {
    recognitionLog("PARSE FAILURE", { provider: "openai" });
    throw new RecognitionPipelineError("parse", "Recognition provider returned an unreadable result.");
  }
  if (!parsed.name || typeof parsed.name !== "string") throw new RecognitionPipelineError("parse", "Recognition did not return a card name.");
  recognitionLog("CARD NAME CANDIDATE", { name: parsed.name.trim() });
  return {
    name: parsed.name.trim(),
    setCode: typeof parsed.setCode === "string" ? parsed.setCode.trim() : null,
    collectorNumber:
      typeof parsed.collectorNumber === "string" ? parsed.collectorNumber.trim() : null,
    language: typeof parsed.language === "string" ? parsed.language : "en",
    finish:
      parsed.finish === "foil" || parsed.finish === "etched" || parsed.finish === "nonfoil"
        ? parsed.finish
        : "unknown",
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.72,
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((item): item is string => typeof item === "string")
      : [],
    gameId: "magic",
    provider: "scryfall",
  };
}

async function prepareDeterministicScanImage(file: File) {
  const source = Buffer.from(await file.arrayBuffer());
  let quality = 82;
  let normalized = await sharp(source).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  while (normalized.byteLength > TCGTRACKING_SCAN_MAX_IMAGE_BYTES && quality > 45) {
    quality -= 8;
    normalized = await sharp(source).rotate().resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  }
  const metadata = await sharp(normalized).metadata();
  return { buffer: normalized, width: metadata.width ?? null, height: metadata.height ?? null };
}

async function identifyWithDeterministicScanner(file: File, requestItemId: string, attempt: number) {
  const client = createTcgTrackingClient();
  let normalized: Awaited<ReturnType<typeof prepareDeterministicScanImage>>;
  try {
    normalized = await prepareDeterministicScanImage(file);
  } catch {
    throw new RecognitionPipelineError("image_normalization", "Image normalization failed.");
  }
  if (normalized.buffer.byteLength > TCGTRACKING_SCAN_MAX_IMAGE_BYTES) throw new RecognitionPipelineError("image_normalization", "Image normalization failed.");
  recognitionLog("IMAGE NORMALIZED", { itemId: requestItemId, attempt, bytes: normalized.buffer.byteLength, width: normalized.width, height: normalized.height, mimeType: "image/jpeg" });
  recognitionLog("TCGTRACKING SCAN REQUEST", { itemId: requestItemId, attempt, endpoint: "https://tcgtracking.com/tcgapi/v1/scan", gameId: TCGTRACKING_MAGIC_GAME_ID, encoding: "multipart/form-data", imageField: "image", imageBytes: normalized.buffer.byteLength, mimeType: "image/jpeg" });
  const result = await scanCardImageWithTcgTracking({ client, image: normalized.buffer, gameId: TCGTRACKING_MAGIC_GAME_ID, limit: 10 });
  recognitionLog("TCGTRACKING SCAN RESPONSE", { itemId: requestItemId, attempt, status: result.status, httpStatus: result.httpStatus ?? null, rawCandidateCount: result.rawCandidateCount ?? result.candidates.length, candidateProductIds: result.candidateProductIds ?? [], providerError: result.error ?? null });
  if (result.status === "provider_failed") {
    throw new RecognitionPipelineError(result.error?.includes("malformed") ? "malformed_provider" : "tcgtracking_scan", result.error?.includes("malformed") ? "Malformed provider response." : "TCGTracking scan failed.", null, null, result.httpStatus);
  }
  if (result.productLookupFailures && result.candidates[0] && !result.candidates[0].productIdentity) {
    throw new RecognitionPipelineError("product_lookup", "Product metadata lookup failed.");
  }
  const candidates = result.candidates.map((candidate, index) => {
    const identity = candidate.productIdentity;
    return {
      id: identity?.scryfallId ?? candidate.providerProductId ?? `tcgtracking:${candidate.tcgplayerProductId ?? index}`,
      name: identity?.name ?? candidate.name ?? "Unknown card",
      setName: identity?.setName ?? candidate.setName ?? "Set unavailable",
      setCode: identity?.setCode ?? candidate.setCode ?? "",
      collectorNumber: identity?.collectorNumber ?? candidate.collectorNumber ?? "",
      language: "English",
      finishes: [],
      rarity: null,
      imageUrl: identity?.imageUrl ?? candidate.imageUrl ?? null,
      scryfallUrl: null,
      gameId: "magic" as const,
      provider: "tcgtracking" as const,
      providerProductId: identity?.providerProductId ?? candidate.providerProductId ?? null,
      tcgplayerProductId: identity?.tcgplayerProductId ?? candidate.tcgplayerProductId ?? null,
      confidence: candidate.confidence,
      prices: [],
    } satisfies CardCandidate;
  });
  const best = candidates[0];
  recognitionLog("TCGTRACKING CANDIDATE", { itemId: requestItemId, attempt, selectedCandidate: best?.id ?? null, candidateCount: candidates.length });
  if (best?.providerProductId) recognitionLog("PRODUCT LOOKUP", { itemId: requestItemId, attempt, productId: best.providerProductId, status: best.name !== "Unknown card" ? "success" : "failed", name: best.name, setCode: best.setCode || null, collectorNumber: best.collectorNumber || null, scryfallId: best.id.match(/^[0-9a-f-]{36}$/i) ? best.id : null });
  return {
    configured: true,
    candidates,
    identification: best ? {
      name: best.name,
      setCode: best.setCode || null,
      collectorNumber: best.collectorNumber || null,
      language: best.language,
      finish: "unknown",
      confidence: best.confidence,
      notes: ["Deterministic scanner candidate matched against Trading Docks provider identity."],
      gameId: "magic" as const,
      provider: "tcgtracking" as const,
    } : null,
  };
}

async function getCandidates(identification: ScanIdentification) {
  const cacheKey = [identification.name, identification.setCode ?? "", identification.collectorNumber ?? ""].join("|").toLowerCase();
  const cached = candidateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.candidates;
  const queryParts = [`!\"${identification.name.replaceAll('"', "")}\"`, "game:paper"];
  if (identification.setCode) queryParts.push(`set:${identification.setCode.replace(/[^a-z0-9]/gi, "")}`);
  if (identification.collectorNumber) queryParts.push(`cn:${identification.collectorNumber.replace(/[^a-z0-9/★]/gi, "")}`);
  const query = new URLSearchParams({
    q: queryParts.join(" "),
    unique: "prints",
    order: "released",
    dir: "desc",
  });
  const response = await fetch(`${SCRYFALL}/cards/search?${query.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    const fallback = await fetch(
      `${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(identification.name)}`,
      { headers: { "User-Agent": USER_AGENT }, cache: "no-store" },
    );
    if (!fallback.ok) {
      recognitionLog("CATALOG MATCH", { name: identification.name, matches: 0 });
      candidateCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, candidates: [] });
      return [];
    }
    recognitionLog("CATALOG MATCH", { name: identification.name, matches: 1, fallback: true });
    const candidate = toCandidate((await fallback.json()) as ScryfallCard, identification, 0);
    recognitionLog("PRINTING MATCH", { name: candidate.name, setCode: candidate.setCode, collectorNumber: candidate.collectorNumber, exact: candidate.setCode.toLowerCase() === identification.setCode?.toLowerCase() && candidate.collectorNumber === identification.collectorNumber });
    const candidates = [candidate];
    candidateCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, candidates });
    return candidates;
  }
  const payload = (await response.json()) as { data?: ScryfallCard[] };
  const cards = payload.data ?? [];
  cards.sort((a, b) => {
    const aScore =
      (a.set.toLowerCase() === identification.setCode?.toLowerCase() ? 1 : 0) +
      (a.collector_number === identification.collectorNumber ? 2 : 0);
    const bScore =
      (b.set.toLowerCase() === identification.setCode?.toLowerCase() ? 1 : 0) +
      (b.collector_number === identification.collectorNumber ? 2 : 0);
    return bScore - aScore;
  });
  recognitionLog("CATALOG MATCH", { name: identification.name, matches: Math.min(cards.length, 8) });
  const candidates = cards.slice(0, 8).map((card, index) => toCandidate(card, identification, index));
  const best = candidates[0];
  if (best) recognitionLog("PRINTING MATCH", { name: best.name, setCode: best.setCode, collectorNumber: best.collectorNumber, exact: best.setCode.toLowerCase() === identification.setCode?.toLowerCase() && best.collectorNumber === identification.collectorNumber });
  candidateCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, candidates });
  return candidates;
}

async function verifyScryfallPrinting(id: string, identification: ScanIdentification, requestItemId: string, attempt: number) {
  const cached = scryfallPrintingCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    recognitionLog("SCRYFALL VERIFICATION", { itemId: requestItemId, attempt, scryfallId: id, status: cached.candidate ? "cached_success" : "cached_failed" });
    return cached.candidate;
  }
  try {
    const response = await fetch(`${SCRYFALL}/cards/${encodeURIComponent(id)}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, next: { revalidate: 86400 } });
    if (!response.ok) {
      recognitionLog("SCRYFALL VERIFICATION", { itemId: requestItemId, attempt, scryfallId: id, status: "failed", httpStatus: response.status });
      scryfallPrintingCache.set(id, { expiresAt: Date.now() + 5 * 60_000, candidate: null });
      return null;
    }
    const candidate = toCandidate((await response.json()) as ScryfallCard, identification, 0);
    recognitionLog("SCRYFALL VERIFICATION", { itemId: requestItemId, attempt, scryfallId: id, status: candidate ? "success" : "failed" });
    scryfallPrintingCache.set(id, { expiresAt: Date.now() + 24 * 60 * 60_000, candidate });
    return candidate;
  } catch {
    recognitionLog("SCRYFALL VERIFICATION", { itemId: requestItemId, attempt, scryfallId: id, status: "failed" });
    return null;
  }
}

function normalizeGameId(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "magic").trim().toLowerCase();
  if (
    normalized === POKEMON_GAME ||
    normalized === String(TCGTRACKING_POKEMON_GAME_ID) ||
    normalized === "pkm" ||
    normalized === "ptcg"
  ) {
    return POKEMON_GAME;
  }
  return "magic";
}

function preferredSku(skus: TcgProductSkuOption[]) {
  return (
    skus.find((sku) => sku.marketPrice != null) ??
    skus.find((sku) => sku.lowPrice != null || sku.highPrice != null) ??
    skus[0] ??
    null
  );
}

function skuVariants(skus: TcgProductSkuOption[], product: TcgProductSearchResult) {
  const variants = [
    ...new Set(
      [...product.variants, ...skus.map((sku) => sku.variant)]
        .map((variant) => variant.trim())
        .filter(Boolean),
    ),
  ];
  return variants.length ? variants : ["Normal"];
}

function pokemonCandidate(
  product: TcgProductSearchResult,
  skus: TcgProductSkuOption[],
  index: number,
): CardCandidate {
  const sku = preferredSku(skus);
  return {
    id: `pokemon:${product.providerProductId}`,
    name: product.name,
    setName: product.setName ?? "Pokemon set unavailable",
    setCode: product.setCode ?? product.setId ?? "PKM",
    collectorNumber: product.collectorNumber ?? "Unknown",
    language: sku?.language ?? "English",
    finishes: skuVariants(skus, product),
    rarity: product.rarity ?? null,
    imageUrl: resolveExactProductImageUrl({
      gameId: "pokemon",
      productType: "card",
      providerProductId: product.providerProductId,
      tcgplayerProductId: product.tcgplayerProductId,
      tcgTrackingImageUrl: product.imageUrl,
    }),
    scryfallUrl: null,
    gameId: "pokemon",
    provider: "tcgtracking",
    providerCategoryId: TCGTRACKING_POKEMON_CATEGORY_ID,
    providerProductId: product.providerProductId,
    providerSkuId: sku?.providerSkuId ?? null,
    tcgplayerProductId: product.tcgplayerProductId,
    tcgplayerSkuId: sku?.tcgplayerSkuId ?? null,
    skuOptions: skus.map((option) => ({
      providerSkuId: option.providerSkuId,
      tcgplayerSkuId: option.tcgplayerSkuId,
      condition: option.condition,
      variant: option.variant,
      language: option.language,
      marketPrice: option.marketPrice,
      lowPrice: option.lowPrice,
      highPrice: option.highPrice,
      activeListings: option.activeListings,
    })),
    exactSkuRequired: true,
    confidence: Math.max(0.58, Math.min(0.98, product.score / 120 - index * 0.03)),
    prices: [
      {
        label: "TCG Market",
        value: sku?.marketPrice ?? null,
        currency: "USD",
        source: "TCGplayer",
        available: sku?.marketPrice != null,
        note: "Provider SKU market price.",
      },
      {
        label: "TCG Low",
        value: sku?.lowPrice ?? null,
        currency: "USD",
        source: "TCGplayer",
        available: sku?.lowPrice != null,
        note: "Provider SKU low price.",
      },
      {
        label: "TCG High",
        value: sku?.highPrice ?? null,
        currency: "USD",
        source: "TCGplayer",
        available: sku?.highPrice != null,
        note: "Provider SKU high price.",
      },
      {
        label: "Active Listings",
        value: sku?.activeListings ?? null,
        currency: "USD",
        source: "TCGTracking",
        available: sku?.activeListings != null,
        note: "Listing count, not a price.",
      },
      {
        label: "Cardmarket exact product",
        value: null,
        currency: "EUR",
        source: "Cardmarket",
        available: false,
        note: "Regional marketplace pricing is not connected for Pokemon.",
      },
    ],
  };
}

async function pokemonCandidatesFromProducts(products: TcgProductSearchResult[]) {
  return Promise.all(
    products.slice(0, 10).map(async (product, index) => {
      const exact = await resolveTcgProductSkus({
        gameId: TCGTRACKING_POKEMON_GAME_ID,
        providerProductId: product.providerProductId,
        setId: product.setId,
      });
      return pokemonCandidate(exact.product ?? product, exact.skus, index);
    }),
  );
}

async function getPokemonCandidates(input: {
  manualName: string;
  compressedImage: string;
}) {
  const client = createTcgTrackingClient();
  if (input.compressedImage) {
    const bytes = decodedImageBytes(input.compressedImage);
    if (bytes > TCGTRACKING_SCAN_MAX_IMAGE_BYTES) {
      throw new Error(
        `Pokemon photo recognition requires a compressed image under ${TCGTRACKING_SCAN_MAX_IMAGE_BYTES.toLocaleString("en-US")} bytes.`,
      );
    }
    const scan = await scanCardImageWithTcgTracking({
      client,
      image: input.compressedImage,
      gameId: TCGTRACKING_POKEMON_GAME_ID,
      limit: 10,
    });
    const scanProducts = scan.candidates
      .map((candidate): TcgProductSearchResult | null => {
        const product = candidate.productIdentity;
        const providerProductId =
          product?.providerProductId ?? candidate.providerProductId;
        if (!providerProductId) return null;
        return {
          providerProductId,
          tcgplayerProductId:
            product?.tcgplayerProductId ?? candidate.tcgplayerProductId ?? null,
          gameId: TCGTRACKING_POKEMON_GAME_ID,
          categoryId: TCGTRACKING_POKEMON_CATEGORY_ID,
          name: product?.name ?? candidate.name ?? "Unknown Pokemon card",
          setId: undefined,
          setName: product?.setName ?? candidate.setName,
          setCode: product?.setCode ?? candidate.setCode,
          collectorNumber: product?.collectorNumber ?? candidate.collectorNumber,
          imageUrl: product?.imageUrl ?? candidate.imageUrl,
          variants: [],
          score: candidate.confidence * 120,
        };
      })
      .filter((product): product is TcgProductSearchResult => Boolean(product));
    if (scanProducts.length) return pokemonCandidatesFromProducts(scanProducts);
  }

  if (!input.manualName) return [];
  const products = await searchTcgProducts({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    query: input.manualName,
    limit: 10,
    client,
  });
  return pokemonCandidatesFromProducts(products);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const surface = String(form.get("surface") ?? "purchasing");
  const requestItemId = String(form.get("itemId") ?? "unknown");
  const parsedAttempt = Number(form.get("attempt") ?? 1);
  const attempt = Number.isFinite(parsedAttempt) ? Math.max(1, Math.floor(parsedAttempt)) : 1;
  const capability = await requireApiCapability(surface === "chaos-sort" ? "collection.write" : "buying.manage");
  if (!capability.ok) return capability.response;
  try {
    const image = form.get("image");
    const manualName = String(form.get("cardName") ?? "").trim();
    const gameId = normalizeGameId(form.get("gameId"));
    const compressedImage = String(form.get("compressedImage") ?? "").trim();
    const file = image instanceof File && image.size > 0 ? image : null;
    if (file) recognitionLog("FILE INGESTED", { surface, contentType: file.type, bytes: file.size });
    if (!file && !manualName && !compressedImage) {
      return NextResponse.json({ error: "Add a card photo or enter a card name." }, { status: 400 });
    }
    if (file && file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be 12 MB or smaller." }, { status: 413 });
    }
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
    }

    const warnings: string[] = [];
    if (gameId === POKEMON_GAME) {
      const candidates = await getPokemonCandidates({
        manualName,
        compressedImage,
      });
      if (!candidates.length) {
        const message = manualName
          ? `No Pokemon products found for "${manualName}".`
          : "Pokemon scan could not resolve a product. Enter a product name to search manually.";
        return NextResponse.json({ error: message }, { status: 404 });
      }
      const payload: CardScanResponse = {
        identification: {
          name: manualName || candidates[0]?.name || "Pokemon card",
          setCode: null,
          collectorNumber: null,
          language: "English",
          finish: "unknown",
          confidence: candidates[0]?.confidence ?? 0.72,
          notes: ["Pokemon recognition uses TCGTracking product identity. Confirm the exact version and SKU before purchase."],
          gameId: "pokemon",
          provider: "tcgtracking",
        },
        candidates,
        recognitionMode: compressedImage ? "tcgtracking" : "manual",
        warnings,
        pricingCoverage: {
          checked: 3,
          available: candidates.some((candidate) =>
            candidate.prices.some((price) => price.available),
          )
            ? 2
            : 1,
          sources: [
            { name: "TCGplayer", status: "available" },
            { name: "TCGTracking", status: "available" },
            { name: "Cardmarket", status: "planned" },
          ],
        },
      };
      return NextResponse.json(payload);
    }

    let recognitionMode: CardScanResponse["recognitionMode"] = "manual";
    let recognitionMethod: CardScanResponse["recognitionMethod"] = manualName ? "MANUAL" : "OCR_CATALOG";
    let deterministicCandidates: CardCandidate[] = [];
    let deterministicScanConfigured = false;
    let deterministicScanFailed = false;
    let identification = null as ScanIdentification | null;
    if (file) {
      try {
        const deterministic = await identifyWithDeterministicScanner(file, requestItemId, attempt);
        deterministicCandidates = deterministic.candidates;
        deterministicScanConfigured = deterministic.configured;
        identification = deterministic.identification;
        if (identification) {
          recognitionMode = "tcgtracking";
          recognitionMethod = identification.setCode && identification.collectorNumber ? "COLLECTOR_NUMBER" : "IMAGE_MATCH";
        }
      } catch (error) {
        deterministicScanFailed = true;
        recognitionLog("PROVIDER FAILURE", { provider: "tcgtracking", itemId: requestItemId, attempt, message: error instanceof Error ? error.message : "deterministic scanner failed" });
      }
    }
    if (!identification && file && OPENAI_FALLBACK_ENABLED) {
      identification = await identifyWithVision(file, requestItemId, attempt);
      if (identification) {
        recognitionMode = "vision";
        recognitionMethod = "OPENAI_FALLBACK";
      }
    }
    if (!identification && deterministicScanFailed && !OPENAI_FALLBACK_ENABLED) {
      throw new RecognitionPipelineError("provider", "Deterministic recognition is temporarily unavailable.");
    }
    if (!identification && manualName) {
      identification = {
        name: manualName,
        setCode: null,
        collectorNumber: null,
        language: "en",
        finish: "unknown",
        confidence: 0.91,
        notes: ["Name supplied by the user; confirm the exact printing."],
        gameId: "magic",
        provider: "scryfall",
      };
    }
    if (!identification && !file) return NextResponse.json({ error: "Could not read card identity from the supplied input." }, { status: 422 });

    let candidates = deterministicCandidates.length ? deterministicCandidates : identification ? await getCandidates(identification) : [];
    let canonicalPrintingResolved = false;
    if (identification && candidates.length) {
      const top = candidates[0];
      const verified = top?.id && /^[0-9a-f-]{36}$/i.test(top.id)
        ? await verifyScryfallPrinting(top.id, identification, requestItemId, attempt)
        : null;
      if (verified) {
        candidates = [verified, ...candidates.filter((candidate) => candidate.id !== verified.id)];
        canonicalPrintingResolved = true;
      } else if (identification.setCode && identification.collectorNumber) {
        const catalogCandidates = await getCandidates(identification);
        const exact = catalogCandidates.find((candidate) => candidate.setCode.toLowerCase() === identification.setCode?.toLowerCase() && candidate.collectorNumber === identification.collectorNumber);
        if (exact) {
          candidates = [exact, ...candidates.filter((candidate) => candidate.id !== exact.id)];
          canonicalPrintingResolved = true;
        }
      }
    }
    const responseIdentification = identification ?? {
      name: "",
      setCode: null,
      collectorNumber: null,
      language: "en",
      finish: "unknown",
      confidence: 0,
      notes: [deterministicScanConfigured ? "The deterministic scanner returned no reliable identity." : "No deterministic scanner is configured for this server."],
      gameId: "magic" as const,
      provider: "scryfall" as const,
    };
    const payload: CardScanResponse = {
      identification: responseIdentification,
      candidates,
      recognitionMode,
      recognitionMethod,
      canonicalPrintingResolved,
      recognitionEvidence: {
        recognitionMethod,
        tcgTrackingProductId: candidates[0]?.providerProductId ?? null,
        tcgTrackingConfidence: recognitionMethod === "IMAGE_MATCH" || recognitionMethod === "COLLECTOR_NUMBER" ? candidates[0]?.confidence ?? null : null,
        candidateCount: candidates.length,
        scryfallId: candidates[0]?.provider === "scryfall" ? candidates[0].id : null,
        setCode: responseIdentification.setCode ?? null,
        collectorNumber: responseIdentification.collectorNumber ?? null,
        resolutionReason: canonicalPrintingResolved ? "Exact Scryfall/catalog printing verified." : candidates.length ? "Candidate identity returned; exact printing needs review." : "No reliable card match found.",
      },
      warnings,
      pricingCoverage: {
        checked: 5,
        available: 2,
        sources: [
          { name: "Scryfall", status: "available" },
          { name: "TCGplayer links", status: "available" },
          { name: "eBay live listings", status: "connection_required" },
          { name: "Mana Pool", status: "connection_required" },
          { name: "Store/buylist feeds", status: "planned" },
        ],
      },
    };
    recognitionLog("FINAL RESOLUTION", { itemId: requestItemId, attempt, state: canonicalPrintingResolved ? "READY" : candidates.length ? "NEEDS_REVIEW" : "UNKNOWN", reason: canonicalPrintingResolved ? "Exact Scryfall/catalog printing verified." : candidates.length ? "Card candidate found but exact printing is not verified." : "TCGTracking returned no match." });
    recognitionLog("CONFIDENCE RESULT", { name: payload.identification.name, confidence: payload.identification.confidence, candidates: candidates.length, recognitionMethod });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RecognitionPipelineError) {
      recognitionLog("CONFIDENCE RESULT", { status: "failed", reason: error.reason, itemId: requestItemId, attempt });
      const status = error.reason === "configuration" || error.reason === "quota_exhausted" ? 503 : error.reason === "rate_limited" ? 429 : 502;
      const mapped = chaosSortRecognitionMessage(error.reason);
      return NextResponse.json({ error: mapped.message, recognitionStatus: "failed", failureReason: error.reason, resolutionReason: error.reason, stage: mapped.stage, httpStatus: error.httpStatus ?? status, providerCode: error.providerCode, retryAfterMs: error.retryAfterMs ?? null }, { status, headers: error.retryAfterMs ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } : undefined });
    }
    const mapped = chaosSortRecognitionMessage("parse");
    recognitionLog("CONFIDENCE RESULT", { status: "failed", reason: "parse", itemId: requestItemId, attempt });
    return NextResponse.json(
      { error: mapped.message, recognitionStatus: "failed", failureReason: "parse", resolutionReason: "parse", stage: mapped.stage, httpStatus: 500 },
      { status: 500 },
    );
  }
}
