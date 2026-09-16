import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";

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

async function identifyWithVision(file: File): Promise<ScanIdentification | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
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
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ??
    "";
  if (!text) return null;
  const parsed = parseVisionJson(text);
  if (!parsed.name || typeof parsed.name !== "string") return null;
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
    if (!fallback.ok) throw new Error("No matching Magic card was found.");
    return [toCandidate((await fallback.json()) as ScryfallCard, identification, 0)];
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
  return cards.slice(0, 8).map((card, index) => toCandidate(card, identification, index));
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
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;
  try {
    const form = await request.formData();
    const image = form.get("image");
    const manualName = String(form.get("cardName") ?? "").trim();
    const gameId = normalizeGameId(form.get("gameId"));
    const compressedImage = String(form.get("compressedImage") ?? "").trim();
    const file = image instanceof File && image.size > 0 ? image : null;
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
    let identification = file ? await identifyWithVision(file) : null;
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
    if (!identification) {
      warnings.push(
        process.env.OPENAI_API_KEY
          ? "Vision could not confidently identify this image. Enter the card name and retry."
          : "Vision recognition needs OPENAI_API_KEY in Vercel. Enter the card name to use exact-printing search now.",
      );
      return NextResponse.json({ error: warnings[0] }, { status: 422 });
    }

    const candidates = await getCandidates(identification);
    const payload: CardScanResponse = {
      identification,
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
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card scan failed." },
      { status: 500 },
    );
  }
}
