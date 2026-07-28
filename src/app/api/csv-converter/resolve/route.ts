import { NextResponse } from "next/server";

type InputRow = {
  scryfallId?: string;
  name?: string;
  setCode?: string;
  collectorNumber?: string;
};

type ScryfallCard = {
  id?: string;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  tcgplayer_id?: number;
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; small?: string } }>;
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { rows?: InputRow[] } | null;
  const rows = body?.rows?.slice(0, 500) ?? [];
  if (!rows.length) return NextResponse.json({ cards: [] });

  const cards: Array<ScryfallCard | null> = [];
  for (let offset = 0; offset < rows.length; offset += 75) {
    const identifiers = rows.slice(offset, offset + 75).map((row) => {
      if (row.scryfallId) return { id: row.scryfallId };
      if (row.setCode && row.collectorNumber) return { set: row.setCode, collector_number: row.collectorNumber };
      return { name: row.name };
    });
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "TradingDocks/1.0 (tradingdocks@gmail.com)" },
      body: JSON.stringify({ identifiers }),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Card verification failed (${response.status}).` }, { status: 502 });
    }
    const payload = (await response.json()) as { data?: ScryfallCard[]; not_found?: unknown[] };
    const returned = payload.data ?? [];
    const chunk = rows.slice(offset, offset + 75);
    for (const row of chunk) {
      const match = returned.find((card) =>
        (row.scryfallId && card.id === row.scryfallId) ||
        (row.setCode && row.collectorNumber && card.set?.toLowerCase() === row.setCode.toLowerCase() && card.collector_number === row.collectorNumber) ||
        (!row.setCode && card.name?.toLowerCase() === row.name?.toLowerCase()),
      );
      cards.push(match ?? null);
    }
  }
  return NextResponse.json({ cards });
}
