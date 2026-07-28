import { NextRequest, NextResponse } from "next/server";
import type { DeckCard, ManaColor } from "@/lib/deck-vault/types";

type Entry = { quantity: number; name: string; setCode?: string; collectorNumber?: string; board: "commander" | "main" | "sideboard" | "maybeboard" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body.entries) ? (body.entries as Entry[]) : [];
    if (!entries.length) return NextResponse.json({ error: "No cards were supplied." }, { status: 400 });

    const cards: DeckCard[] = [];
    const unresolved: Entry[] = [];
    const colors = new Set<ManaColor>();
    let marketValue = 0;

    for (let index = 0; index < entries.length; index += 75) {
      const chunk = entries.slice(index, index + 75);
      const response = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "TradingDocks-DeckImport/1.0" },
        body: JSON.stringify({ identifiers: chunk.map((entry) => entry.setCode && entry.collectorNumber ? { set: entry.setCode, collector_number: entry.collectorNumber } : { name: entry.name }) }),
        cache: "no-store",
      });
      if (!response.ok) { unresolved.push(...chunk); continue; }
      const payload = await response.json();
      const returned = payload.data ?? [];
      const byName = new Map<string, any>();
      const byPrinting = new Map<string, any>();
      for (const card of returned) {
        byName.set(String(card.name).toLowerCase(), card);
        byPrinting.set(`${String(card.set).toLowerCase()}:${String(card.collector_number).toLowerCase()}`, card);
      }

      chunk.forEach((entry) => {
        const printingKey = entry.setCode && entry.collectorNumber
          ? `${entry.setCode.toLowerCase()}:${entry.collectorNumber.toLowerCase()}`
          : "";
        const card = (printingKey ? byPrinting.get(printingKey) : undefined) ?? byName.get(entry.name.toLowerCase());
        if (!card) { unresolved.push(entry); return; }
        const face = card.card_faces?.find((item: any) => item.image_uris) ?? card;
        const identity = (card.color_identity?.length ? card.color_identity : card.colors?.length ? card.colors : ["C"]) as ManaColor[];
        identity.forEach((color) => colors.add(color));
        const price = Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0);
        marketValue += price * entry.quantity;
        cards.push({
          id: `${card.id}-${entry.board}`,
          name: card.name,
          quantity: entry.quantity,
          manaValue: Number(card.cmc ?? 0),
          colors: identity,
          typeLine: card.type_line ?? "",
          category: inferCategory(card.type_line ?? "", card.oracle_text ?? ""),
          price,
          owned: false,
          image: face.image_uris?.normal ?? face.image_uris?.large ?? "",
          artCrop: face.image_uris?.art_crop ?? "",
          setCode: card.set ?? entry.setCode,
          collectorNumber: card.collector_number ?? entry.collectorNumber,
          gameChanger: Boolean(card.game_changer),
          board: entry.board,
        });
      });
    }

    return NextResponse.json({ cards, unresolved, colors: Array.from(colors), marketValue: Number(marketValue.toFixed(2)) });
  } catch (error) {
    console.error("Deck import resolution failed", error);
    return NextResponse.json({ error: "The imported cards could not be resolved." }, { status: 500 });
  }
}

function inferCategory(typeLine: string, oracleText: string) {
  const type = typeLine.toLowerCase();
  const oracle = oracleText.toLowerCase();
  if (type.includes("land")) return "Land";
  if (/draw (a|two|three|x|\d+) cards?/.test(oracle)) return "Card Draw";
  if (/destroy target|exile target|counter target spell/.test(oracle)) return "Removal";
  if (/destroy all|exile all/.test(oracle)) return "Board Wipe";
  if (/search your library for .* card/.test(oracle)) return "Tutor";
  if (/add \{|treasure token|search your library for .* land/.test(oracle)) return "Ramp";
  if (/hexproof|indestructible|phase out/.test(oracle)) return "Protection";
  if (type.includes("creature")) return "Creature";
  if (type.includes("artifact")) return "Artifact";
  if (type.includes("enchantment")) return "Enchantment";
  if (type.includes("planeswalker")) return "Planeswalker";
  if (type.includes("instant")) return "Instant";
  if (type.includes("sorcery")) return "Sorcery";
  return "Other";
}
