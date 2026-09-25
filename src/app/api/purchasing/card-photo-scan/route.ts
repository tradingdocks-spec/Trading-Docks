import { NextResponse } from "next/server";
import { buildOrientationCandidates, resolveOrientationEvidence, type CardRotation, type OrientationResult } from "@/lib/card-photo-scanner/orientation";
import { requireApiCapability } from "@/lib/platform/server-access";
import { parseRetryAfterMs } from "@/lib/chaos-sort/batch-queue";
import { classifyProviderFailure, providerFailureDetails } from "@/lib/chaos-sort/provider-errors";

import type {
  CardCandidate,
  CardScanResponse,
  ScanIdentification,
} from "@/lib/card-photo-scanner/types";
import { resolveExactProductImageUrl } from "@/lib/card-image-authority";
import {
  TCGTRACKING_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID,
  createTcgTrackingClient,
} from "@/lib/providers/tcgtracking/client";
import {
  TCGTRACKING_SCAN_MAX_IMAGE_BYTES,
  decodedImageBytes,
  scanCardImageWithTcgTracking,
} from "@/lib/providers/tcgtracking/scanner";
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

type ProviderFailureReason = "configuration" | "auth" | "provider" | "timeout" | "parse" | "image_decode" | "catalog" | "quota_exhausted" | "rate_limited" | "temporarily_unavailable";

class RecognitionPipelineError extends Error {
  constructor(
    readonly reason: ProviderFailureReason,
    message: string,
    readonly providerCode?: string | null,
    readonly retryAfterMs?: number | null,
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

type VisionIdentification = Partial<ScanIdentification> & { rotationAppliedDegrees?: number; orientationConfidence?: number };
function parseVisionJson(text: string): VisionIdentification {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON in vision response");
  return JSON.parse(fenced.slice(start, end + 1)) as VisionIdentification;
}

async function identifyWithVision(file: File, requestItemId: string, attempt: number, orientationHint?: number): Promise<{ identification: ScanIdentification; orientation: OrientationResult } | null> {
  if (!process.env.OPENAI_API_KEY) throw new RecognitionPipelineError("configuration", "Image recognition is not configured on the server.");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength < 16) throw new RecognitionPipelineError("image_decode", "The scanner image is empty or could not be decoded.");
  recognitionLog("IMAGE DECODED", { contentType: file.type, bytes: bytes.byteLength });
  let candidates: Awaited<ReturnType<typeof buildOrientationCandidates>>;
  try { candidates = await buildOrientationCandidates(Buffer.from(bytes)); }
  catch {
    throw new RecognitionPipelineError("image_decode", "The scan could not be decoded. The original capture is retained for review or retry.");
  }
  const forcedRotation = [0, 90, 180, 270].includes(orientationHint ?? -1) ? orientationHint as CardRotation : null;
  const forced = forcedRotation !== null;
  const orientation = forced
    ? { rotationAppliedDegrees: forcedRotation, confidence: 1, source: "manual" as const, reviewRequired: false }
    : null;
  const views = forced ? candidates.filter(candidate => candidate.degrees === orientationHint) : candidates;
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
                text: forced
                  ? `This image has been normalized by applying ${orientationHint} degrees clockwise to the original scan. Identify this Magic: The Gathering card in the normalized image. Return JSON only with name, setCode, collectorNumber, language, finish, confidence, notes. Use null instead of guessing unreadable printing details.`
                  : "The same scanned trading card follows in four views labeled by the clockwise rotation applied to the source (0, 90, 180, 270 degrees). Compare text direction, card name/set/collector text placement, and frame/layout orientation. Choose the clearly upright view; do not infer orientation from card art alone. Identify the card using that upright view. Return JSON only with name, setCode, collectorNumber, language, finish, confidence, notes, rotationAppliedDegrees (0|90|180|270), orientationConfidence (0..1). If upright orientation is uncertain, set orientationConfidence below 0.8 and rotationAppliedDegrees to 0. Use null instead of guessing unreadable printing details.",
              },
              ...views.flatMap(view => [
                ...(!forced ? [{ type: "input_text" as const, text: `View with ${view.degrees} degrees clockwise rotation applied:` }] : []),
                { type: "input_image" as const, image_url: `data:image/jpeg;base64,${view.bytes.toString("base64")}`, detail: "high" as const },
              ]),
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
  let parsed: VisionIdentification;
  try {
    parsed = parseVisionJson(text);
  } catch {
    recognitionLog("PARSE FAILURE", { provider: "openai" });
    throw new RecognitionPipelineError("parse", "Recognition provider returned an unreadable result.");
  }
  if (!parsed.name || typeof parsed.name !== "string") throw new RecognitionPipelineError("parse", "Recognition did not return a card name.");
  recognitionLog("CARD NAME CANDIDATE", { name: parsed.name.trim() });
  const resolvedOrientation = orientation ?? resolveOrientationEvidence(parsed.rotationAppliedDegrees, parsed.orientationConfidence);
  const identification: ScanIdentification = {
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
  if (resolvedOrientation.reviewRequired) identification.notes = [...(identification.notes ?? []), "Image orientation is uncertain; verify upright orientation before confirming this card."];
  return { identification, orientation: resolvedOrientation };
}

async function getCandidates(identification: ScanIdentification) {
  const query = new URLSearchParams({
    q: `!\"${identification.name.replaceAll('"', "")}\" game:paper`,
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
      return [];
    }
    recognitionLog("CATALOG MATCH", { name: identification.name, matches: 1, fallback: true });
    const candidate = toCandidate((await fallback.json()) as ScryfallCard, identification, 0);
    recognitionLog("PRINTING MATCH", { name: candidate.name, setCode: candidate.setCode, collectorNumber: candidate.collectorNumber, exact: candidate.setCode.toLowerCase() === identification.setCode?.toLowerCase() && candidate.collectorNumber === identification.collectorNumber });
    return [candidate];
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
  return candidates;
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
    const orientationHintText = String(form.get("orientationHint") ?? "");
    const orientationHint = orientationHintText === "" ? undefined : Number(orientationHintText);
    if (orientationHint !== undefined && ![0, 90, 180, 270].includes(orientationHint)) return NextResponse.json({ error: "Orientation correction must be 0, 90, 180, or 270 degrees." }, { status: 400 });
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
    const visionResult = file ? await identifyWithVision(file, requestItemId, attempt, orientationHint) : null;
    let identification = visionResult?.identification ?? null;
    if (identification) recognitionMode = "vision";
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
    if (!identification) return NextResponse.json({ error: "Could not read card identity from the supplied input." }, { status: 422 });

    const candidates = await getCandidates(identification);
    const payload: CardScanResponse = {
      identification,
      orientation: visionResult?.orientation ?? null,
      candidates,
      recognitionMode,
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
    recognitionLog("CONFIDENCE RESULT", { name: identification.name, confidence: identification.confidence, candidates: candidates.length });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RecognitionPipelineError) {
      recognitionLog("CONFIDENCE RESULT", { status: "failed", reason: error.reason, itemId: requestItemId, attempt });
      return NextResponse.json({ error: error.message, recognitionStatus: "failed", failureReason: error.reason, providerCode: error.providerCode, retryAfterMs: error.retryAfterMs ?? null }, { status: error.reason === "configuration" || error.reason === "quota_exhausted" ? 503 : error.reason === "rate_limited" ? 429 : 502, headers: error.retryAfterMs ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } : undefined });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card scan failed." },
      { status: 500 },
    );
  }
}
