import { NextRequest, NextResponse } from "next/server";

const MTGJSON_ROOT = "https://mtgjson.com/api/v5";
const SCRYFALL_COLLECTION = "https://api.scryfall.com/cards/collection";

type DeckIndexItem = {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
};

type DeckCard = {
  count?: number;
  name: string;
  number?: string;
  setCode?: string;
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  prices?: { usd?: string | null; usd_foil?: string | null };
  image_uris?: { normal?: string; art_crop?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; art_crop?: string } }>;
};

export const runtime = "nodejs";
export const revalidate = 21_600;

export async function GET(request: NextRequest) {
  const fileName = request.nextUrl.searchParams.get("file");
  if (fileName) return analyzeDeck(fileName);

  try {
    const payload = await fetchJson<{ data?: DeckIndexItem[] }>(`${MTGJSON_ROOT}/DeckList.json`);
    const decks = (payload.data ?? [])
      .filter((deck) => /commander/i.test(deck.type || ""))
      .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""))
      .map((deck) => ({
        ...deck,
        fileName: deck.fileName.replace(/\.json$/i, ""),
      }));

    return NextResponse.json({ decks, updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Precon catalog is temporarily unavailable." },
      { status: 502 },
    );
  }
}

async function analyzeDeck(rawFileName: string) {
  const fileName = rawFileName.replace(/\.json$/i, "");
  if (!/^[A-Za-z0-9_()' .-]{1,180}$/.test(fileName)) {
    return NextResponse.json({ error: "Invalid precon selection." }, { status: 400 });
  }

  try {
    const payload = await fetchJson<{ data?: {
      name?: string;
      code?: string;
      releaseDate?: string;
      commander?: DeckCard[];
      mainBoard?: DeckCard[];
      sideBoard?: DeckCard[];
    } }>(`${MTGJSON_ROOT}/decks/${encodeURIComponent(fileName)}.json`);
    const deck = payload.data;
    if (!deck) throw new Error("Decklist data was empty.");

    const sourceCards = [...(deck.commander ?? []), ...(deck.mainBoard ?? []), ...(deck.sideBoard ?? [])];
    const merged = new Map<string, DeckCard & { count: number }>();
    for (const card of sourceCards) {
      const key = `${card.setCode ?? ""}:${card.number ?? ""}:${card.name}`;
      const existing = merged.get(key);
      merged.set(key, { ...card, count: (existing?.count ?? 0) + Math.max(1, card.count ?? 1) });
    }

    const entries = [...merged.values()];
    const resolved = new Map<string, ScryfallCard>();
    for (let index = 0; index < entries.length; index += 75) {
      const batch = entries.slice(index, index + 75);
      const identifiers = batch.map((card) => card.setCode && card.number
        ? { set: card.setCode.toLowerCase(), collector_number: card.number }
        : { name: card.name });
      const response = await fetch(SCRYFALL_COLLECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "TradingDocks-PreconIntelligence/1.0" },
        body: JSON.stringify({ identifiers }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Card pricing returned ${response.status}.`);
      const collection = await response.json() as { data?: ScryfallCard[] };
      for (const card of collection.data ?? []) {
        resolved.set(`${card.set.toLowerCase()}:${card.collector_number}`, card);
        resolved.set(card.name.toLowerCase(), card);
      }
    }

    const cards = entries.map((entry) => {
      const match = resolved.get(`${(entry.setCode ?? "").toLowerCase()}:${entry.number ?? ""}`)
        ?? resolved.get(entry.name.toLowerCase());
      const unitPrice = number(match?.prices?.usd) || number(match?.prices?.usd_foil);
      return {
        name: entry.name,
        count: entry.count,
        setCode: entry.setCode ?? match?.set?.toUpperCase() ?? "",
        collectorNumber: entry.number ?? match?.collector_number ?? "",
        unitPrice,
        totalPrice: unitPrice * entry.count,
        image: match?.image_uris?.normal ?? match?.card_faces?.[0]?.image_uris?.normal ?? "",
      };
    }).sort((a, b) => b.totalPrice - a.totalPrice);

    return NextResponse.json({
      deck: {
        name: deck.name ?? fileName,
        code: deck.code ?? "",
        releaseDate: deck.releaseDate ?? "",
        cardCount: cards.reduce((sum, card) => sum + card.count, 0),
        pricedCount: cards.filter((card) => card.unitPrice > 0).reduce((sum, card) => sum + card.count, 0),
        grossSinglesValue: cards.reduce((sum, card) => sum + card.totalPrice, 0),
        cards,
      },
      sources: {
        decklist: "MTGJSON",
        pricing: "Scryfall daily prices",
        referenceUrl: "https://deckcheck.co/app/precons",
        pricedAt: new Date().toISOString(),
      },
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=14400" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This precon could not be analyzed." },
      { status: 502 },
    );
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 21_600 }, headers: { "User-Agent": "TradingDocks-PreconIntelligence/1.0" } });
  if (!response.ok) throw new Error(`Precon data returned ${response.status}.`);
  return response.json() as Promise<T>;
}

function number(value: string | null | undefined) {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}
