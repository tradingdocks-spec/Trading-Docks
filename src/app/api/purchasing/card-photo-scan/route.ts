import { NextResponse } from "next/server";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

import type {
  CardCandidate,
  CardScanResponse,
  ScanIdentification,
} from "@/lib/card-photo-scanner/types";

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "purchasing")) {
    return NextResponse.json(
      { error: "Purchasing requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRYFALL = "https://api.scryfall.com";
const USER_AGENT = "TradingDocks/0.56 card-photo-scanner";

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

export async function POST(request: Request) {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  try {
    const form = await request.formData();
    const image = form.get("image");
    const manualName = String(form.get("cardName") ?? "").trim();
    const file = image instanceof File && image.size > 0 ? image : null;
    if (!file && !manualName) {
      return NextResponse.json({ error: "Add a card photo or enter a card name." }, { status: 400 });
    }
    if (file && file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be 12 MB or smaller." }, { status: 413 });
    }
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
    }

    const warnings: string[] = [];
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
