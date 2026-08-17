import { NextRequest, NextResponse } from "next/server";

import { COMMANDER_SPELLBOOK_PROVIDER } from "@/lib/deck-architect/combo-provider";
import type { ComboRecommendation } from "@/lib/deck-architect/types";

type InputCard = { name?: string; quantity?: number; board?: string };
type InventoryItem = { name?: string; quantity?: number; location?: string };

export async function POST(request: NextRequest) {
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
  const deckNames = cards
    .filter((card) => card.board !== "sideboard" && card.board !== "maybeboard" && card.name)
    .flatMap((card) => Array(Math.max(1, Number(card.quantity) || 1)).fill(card.name as string));
  const inventoryNames = inventory
    .filter((item) => item.name && Number(item.quantity) > 0)
    .flatMap((item) => Array(Math.max(1, Number(item.quantity) || 1)).fill(item.name as string));
  const report = await COMMANDER_SPELLBOOK_PROVIDER.findCombosForDeck(deckNames, inventoryNames);
  const inventoryByName = inventory.reduce((map, item) => {
    if (!item.name || Number(item.quantity) <= 0) return map;
    const key = item.name.trim().toLowerCase();
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map<string, InventoryItem[]>());

  return NextResponse.json({
    available: report.available,
    complete: report.complete.map((combo) => toRouteCombo(combo, cards, inventoryByName)),
    oneCardAway: report.nearCombos
      .filter((combo) => combo.missingPieces.length === 1)
      .map((combo) => toRouteCombo(combo, cards, inventoryByName)),
    summary: {
      complete: report.summary.complete,
      oneCardAway: report.nearCombos.filter((combo) => combo.missingPieces.length === 1).length,
      ownedMissingPieces: report.nearCombos.filter((combo) => combo.missingPieces.length === 1 && inventoryByName.has(combo.missingPieces[0]?.toLowerCase() ?? "")).length,
      bracketSensitive: report.summary.winLineCount,
    },
    source: "Commander Spellbook",
    message: report.message,
  });
}

function toRouteCombo(
  combo: ComboRecommendation,
  cards: InputCard[],
  inventoryByName: Map<string, InventoryItem[]>,
) {
  const deckNames = new Set(cards.filter((card) => card.name).map((card) => (card.name as string).trim().toLowerCase()));
  return {
    id: combo.id,
    cards: combo.cards.map((card) => {
      const inventoryMatches = inventoryByName.get(card.name.trim().toLowerCase()) ?? [];
      return {
        name: card.name,
        image: card.imageUri ?? undefined,
        inDeck: deckNames.has(card.name.trim().toLowerCase()),
        isCommander: card.mustBeCommander,
        ownedQuantity: inventoryMatches.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        inventoryLocations: Array.from(new Set(inventoryMatches.map((item) => item.location?.trim()).filter((location): location is string => Boolean(location)))),
        price: null,
      };
    }),
    missingCards: combo.cards.filter((card) => !deckNames.has(card.name.trim().toLowerCase())),
    produces: combo.results,
    prerequisites: combo.prerequisites,
    steps: combo.steps,
    manaNeeded: "",
    popularity: combo.popularity,
    bracketTag: combo.winCondition ? "G" : "",
    estimatedComboValue: null,
    spellbookUrl: combo.spellbookUrl,
  };
}
