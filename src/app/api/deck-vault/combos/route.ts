import { NextRequest, NextResponse } from "next/server";

type InputCard = { name?: string; quantity?: number; board?: string };
type InventoryItem = { name?: string; quantity?: number; location?: string };
type SpellbookCard = {
  card?: { name?: string; imageUriFrontNormal?: string | null };
  quantity?: number;
  mustBeCommander?: boolean;
};
type SpellbookVariant = {
  id?: string;
  status?: string;
  uses?: SpellbookCard[];
  produces?: Array<{ feature?: { name?: string } }>;
  requires?: Array<{ template?: { name?: string } }>;
  description?: string;
  easyPrerequisites?: string;
  notablePrerequisites?: string;
  manaNeeded?: string;
  popularity?: number | null;
  bracketTag?: string;
  prices?: { tcgplayer?: string | null };
  legalities?: { commander?: boolean; pauperCommander?: boolean };
};

const SPELLBOOK_URL = "https://backend.commanderspellbook.com/find-my-combos?limit=24&groupByCombo=true";

function key(value: string) {
  return value.trim().toLocaleLowerCase();
}

function parseMoney(value: string | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const format = String(body.format ?? "EDH");
    if (format !== "EDH" && format !== "Pauper EDH") {
      return NextResponse.json({
        available: false,
        complete: [],
        oneCardAway: [],
        summary: { complete: 0, oneCardAway: 0, ownedMissingPieces: 0, bracketSensitive: 0 },
        source: "Commander Spellbook",
        message: "Combo Intelligence is currently optimized for Commander decks.",
      });
    }

    const cards = (Array.isArray(body.cards) ? body.cards : []) as InputCard[];
    const inventory = (Array.isArray(body.inventory) ? body.inventory : []) as InventoryItem[];
    const commanders = cards.filter((card) => card.board === "commander" && card.name);
    const main = cards.filter((card) => card.board !== "commander" && card.board !== "sideboard" && card.board !== "maybeboard" && card.name);

    const response = await fetch(SPELLBOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        main: main.map((card) => ({ card: card.name, quantity: Math.max(1, Number(card.quantity) || 1) })),
        commanders: commanders.map((card) => ({ card: card.name, quantity: 1 })),
      }),
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 900 },
    });

    if (!response.ok) throw new Error(`Commander Spellbook returned ${response.status}`);
    const payload = await response.json();
    const results = payload?.results ?? {};
    const deckNames = new Set(cards.filter((card) => card.name).map((card) => key(card.name as string)));
    const commanderNames = new Set(commanders.map((card) => key(card.name as string)));
    const inventoryByName = new Map<string, InventoryItem[]>();
    for (const item of inventory) {
      if (!item.name || Number(item.quantity) <= 0) continue;
      const name = key(item.name);
      inventoryByName.set(name, [...(inventoryByName.get(name) ?? []), item]);
    }

    const normalize = (variant: SpellbookVariant) => {
      const comboCards = (variant.uses ?? []).flatMap((use) => {
        const name = use.card?.name?.trim();
        if (!name) return [];
        const inventoryMatches = inventoryByName.get(key(name)) ?? [];
        return [{
          name,
          image: use.card?.imageUriFrontNormal ?? undefined,
          inDeck: deckNames.has(key(name)),
          isCommander: Boolean(use.mustBeCommander) || commanderNames.has(key(name)),
          ownedQuantity: inventoryMatches.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
          inventoryLocations: Array.from(new Set(inventoryMatches.map((item) => item.location?.trim()).filter((location): location is string => Boolean(location)))),
          price: null,
        }];
      });
      const prerequisiteText = [variant.easyPrerequisites, variant.notablePrerequisites]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
      return {
        id: variant.id ?? comboCards.map((card) => card.name).join("-"),
        cards: comboCards,
        missingCards: comboCards.filter((card) => !card.inDeck),
        produces: (variant.produces ?? []).map((item) => item.feature?.name?.trim()).filter((value): value is string => Boolean(value)),
        prerequisites: prerequisiteText,
        steps: (variant.description ?? "").split(/\n+/).map((step) => step.trim()).filter(Boolean),
        manaNeeded: variant.manaNeeded ?? "",
        popularity: variant.popularity ?? null,
        bracketTag: variant.bracketTag ?? "",
        estimatedComboValue: parseMoney(variant.prices?.tcgplayer),
        spellbookUrl: `https://commanderspellbook.com/combo/${encodeURIComponent(variant.id ?? "")}`,
      };
    };

    const legalForFormat = (variant: SpellbookVariant) =>
      variant.status === "OK" && (format === "Pauper EDH" ? variant.legalities?.pauperCommander : variant.legalities?.commander);
    const unique = (variants: SpellbookVariant[]) => Array.from(new Map(variants.filter(legalForFormat).map((variant) => [variant.id, normalize(variant)])).values());
    const complete = unique(results.included ?? []).slice(0, 12);
    const oneCardAway = unique(results.almostIncluded ?? []).filter((combo) => combo.missingCards.length === 1).slice(0, 12);
    const ownedMissingPieces = oneCardAway.filter((combo) => combo.missingCards[0]?.ownedQuantity > 0).length;
    const bracketSensitive = [...complete, ...oneCardAway].filter((combo) => ["G", "R"].includes(combo.bracketTag)).length;

    return NextResponse.json({
      available: true,
      complete,
      oneCardAway,
      summary: { complete: complete.length, oneCardAway: oneCardAway.length, ownedMissingPieces, bracketSensitive },
      source: "Commander Spellbook",
    });
  } catch (error) {
    console.error("Commander combo analysis error", error);
    return NextResponse.json({
      available: false,
      complete: [],
      oneCardAway: [],
      summary: { complete: 0, oneCardAway: 0, ownedMissingPieces: 0, bracketSensitive: 0 },
      source: "Commander Spellbook",
      message: "Combo data is temporarily unavailable. Your deck and other intelligence tools are unaffected.",
    });
  }
}
