import type { User } from "@supabase/supabase-js";

import { findOwnedCommanderCandidates, type CollectionGraphCard } from "./index.ts";

export type DeckArchitectCollectionSnapshot = {
  cards: CollectionGraphCard[];
  commanderCandidates: CollectionGraphCard[];
  totalRows: number;
  totalOwnedQuantity: number;
  sampleLimit: number;
  truncated: boolean;
  error: string | null;
};

const COLLECTION_SAMPLE_LIMIT = 750;

export async function loadDeckArchitectCollectionSnapshot(
  supabase: {
    from: (table: string) => any;
  },
  user: Pick<User, "id">,
): Promise<DeckArchitectCollectionSnapshot> {
  const { data, error, count } = await supabase
    .from("inventory_items")
    .select(
      "id,card_name,set_code,collector_number,quantity,inventory_value,data",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .gt("quantity", 0)
    .order("updated_at", { ascending: false })
    .limit(COLLECTION_SAMPLE_LIMIT);

  if (error) {
    return {
      cards: [],
      commanderCandidates: [],
      totalRows: 0,
      totalOwnedQuantity: 0,
      sampleLimit: COLLECTION_SAMPLE_LIMIT,
      truncated: false,
      error: error.message || "Collection snapshot unavailable.",
    };
  }

  const cards = (data ?? []).map(toCollectionGraphCard).filter(Boolean) as CollectionGraphCard[];
  const totalOwnedQuantity = cards.reduce((sum, card) => sum + card.quantityOwned, 0);
  const totalRows = count ?? cards.length;

  return {
    cards,
    commanderCandidates: findOwnedCommanderCandidates(cards),
    totalRows,
    totalOwnedQuantity,
    sampleLimit: COLLECTION_SAMPLE_LIMIT,
    truncated: totalRows > cards.length,
    error: null,
  };
}

function toCollectionGraphCard(row: unknown): CollectionGraphCard | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : {};
  const name = stringValue(data.name) ?? stringValue(record.card_name);
  const quantity = positiveInteger(record.quantity);
  if (!name || quantity <= 0) return null;

  const unitMarketPrice = numberValue(data.unitMarketValue)
    ?? numberValue(data.unit_market_value)
    ?? numberValue(data.marketPrice)
    ?? numberValue(data.price)
    ?? totalValueToUnitValue(record.inventory_value, quantity);

  return {
    inventoryId: String(record.id ?? `${name}:${record.set_code ?? ""}:${record.collector_number ?? ""}`),
    name,
    quantityOwned: quantity,
    setCode: stringValue(record.set_code) ?? stringValue(data.setCode) ?? stringValue(data.set),
    collectorNumber: stringValue(record.collector_number) ?? stringValue(data.collectorNumber),
    scryfallId: stringValue(data.scryfallId) ?? stringValue(data.scryfall_id),
    tcgplayerId: stringValue(data.tcgplayerId) ?? stringValue(data.tcgplayer_id),
    typeLine: stringValue(data.typeLine) ?? stringValue(data.type_line),
    colorIdentity: stringArray(data.colorIdentity) ?? stringArray(data.color_identity) ?? undefined,
    manaValue: numberValue(data.manaValue) ?? numberValue(data.cmc),
    condition: stringValue(data.condition),
    finish: stringValue(data.finish),
    language: stringValue(data.language),
    location: stringValue(data.location) ?? stringValue(data.locationName),
    marketPrice: unitMarketPrice,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const next = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(next) ? next : null;
}

function positiveInteger(value: unknown) {
  const next = Math.floor(numberValue(value) ?? 0);
  return Math.max(0, next);
}

function totalValueToUnitValue(value: unknown, quantity: number) {
  const totalValue = numberValue(value);
  if (totalValue === null || quantity <= 0) return null;
  return totalValue / quantity;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}
