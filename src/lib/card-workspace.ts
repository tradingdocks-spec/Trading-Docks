import {
  buildCollectionCards,
  displayCondition,
  displayFinish,
  displayPrinting,
  displayStorageLocation,
  priceLabel,
  type CollectionCard,
  type RawInventoryItem,
  type RawInventoryLocation,
  type RawTradeBinderStatus,
  type RawWishlistItem,
} from "@/lib/collector-workspace";
import {
  buildInventoryAttentionSummary,
  type InventoryAttentionItem,
  type InventoryAttentionType,
} from "@/lib/inventory/intelligence";
import {
  resolveInventoryCostBasis,
  resolveInventoryPositionFinancials,
  nonNegativeNumber,
  type CostBasisCompleteness,
} from "@/lib/financials/domain";

export type CardWorkspaceData = {
  identity: CardWorkspaceIdentity;
  printing: CardWorkspacePrinting;
  market: CardWorkspaceMarket;
  userPosition: CardWorkspacePosition;
  inventoryRecords: CardWorkspaceInventoryRecord[];
  attention: {
    count: number;
    issues: InventoryAttentionItem[];
  };
  selling: {
    listedQuantity: number;
    listings: CardWorkspaceListing[];
  };
  decks: CardWorkspaceDeckReference[];
  otherPrintings: CardWorkspaceOtherPrinting[];
  history: CardWorkspaceHistory;
  actions: CardWorkspaceAction[];
  queryStrategy: {
    inventoryRowsLoaded: number;
    inventoryRowsTotal: number;
    relatedPrintingsLoaded: number;
  };
};

export type CardWorkspaceIdentity = {
  inventoryItemId: string;
  cardName: string;
  gameId: string;
  gameLabel: string;
  productType: "card" | "sealed";
  imageUrl: string | null;
};

export type CardWorkspacePrinting = {
  scryfallId: string | null;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  language: string | null;
  finish: string;
  display: string;
  variant: string | null;
  tcgplayerProductId: number | null;
  tcgplayerSkuId: number | null;
};

export type CardWorkspaceMarket = {
  unitPrice: number | null;
  totalValue: number | null;
  valueSource: "inventory" | "unavailable";
  valueLabel: string;
  timestamp: string | null;
};

export type CardWorkspacePosition = {
  quantityOwned: number;
  lotCount: number;
  ownedLabel: string;
  averageKnownCost: number | null;
  knownCostQuantity: number;
  totalCostBasis: number | null;
  costBasisLabel: string;
  costBasisCoverageLabel: string;
  unrealizedGain: number | null;
  costBasisCompleteness: CostBasisCompleteness;
  costBasisCoverageRatio: number;
};

export type CardWorkspaceInventoryRecord = {
  id: string;
  cardName: string;
  quantity: number;
  condition: string;
  finish: string;
  location: string;
  unitValue: number | null;
  totalValue: number | null;
  knownUnitCost: number | null;
  knownTotalCost: number | null;
  updatedAt: string | null;
  attentionTypes: InventoryAttentionType[];
  editHref: string;
  inventoryFilterHref: string;
};

export type CardWorkspaceHistory = {
  available: boolean;
  events: CardWorkspaceInventoryEvent[];
  unavailableReason: string | null;
};

export type CardWorkspaceInventoryEvent = {
  id: string;
  eventType: string;
  quantityBefore: number | null;
  quantityChange: number | null;
  quantityAfter: number | null;
  previousValue: string | null;
  nextValue: string | null;
  previousLocationId: string | null;
  nextLocationId: string | null;
  source: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type CardWorkspaceListing = {
  id: string;
  marketplace: string;
  status: string;
  quantity: number | null;
  price: number | null;
};

export type CardWorkspaceDeckReference = {
  id: string;
  name: string;
  quantity: number;
  href: string;
};

export type CardWorkspaceOtherPrinting = {
  id: string;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  imageUrl: string | null;
  price: number | null;
  href: string | null;
};

export type CardWorkspaceAction = {
  label: string;
  href: string;
  priority: "primary" | "secondary" | "tertiary";
};

type SupabaseLike = {
  from: (table: string) => any;
};

const RELATED_INVENTORY_LIMIT = 50;
const RELATED_DECK_LIMIT = 25;
const RELATED_PRINTING_LIMIT = 8;

export async function getCardWorkspaceData({
  supabase,
  userId,
  inventoryItemId,
}: {
  supabase: SupabaseLike;
  userId: string;
  inventoryItemId: string;
}): Promise<CardWorkspaceData | null> {
  const { data: anchor, error: anchorError } = await supabase
    .from("inventory_items")
    .select(inventorySelect())
    .eq("user_id", userId)
    .eq("id", inventoryItemId)
    .maybeSingle();

  if (anchorError) throw new Error(`Card workspace identity failed: ${anchorError.message ?? "Unknown Supabase error"}`);
  if (!anchor) return null;

  const relatedQuery = relatedInventoryQuery(supabase, userId, anchor as RawInventoryItem);
  const [{ data: inventoryRows, error: inventoryError }, { data: locations }, { data: tradeStatuses }, { data: wishlist }, { data: listings }, { data: decks }, history] = await Promise.all([
    relatedQuery.limit(RELATED_INVENTORY_LIMIT),
    supabase.from("inventory_locations").select("id,name,location_type,data").eq("user_id", userId).limit(200),
    supabase.from("binder_card_trade_status").select("inventory_item_id,status").eq("user_id", userId).limit(1000),
    supabase.from("collector_wishlist").select("card_name,set_code,target_condition,target_finish").eq("user_id", userId).limit(1000),
    supabase.from("marketplace_listing_mappings").select("id,inventory_item_id,marketplace_id,match_status,last_seen_quantity,last_seen_price").eq("user_id", userId).eq("inventory_item_id", inventoryItemId).limit(20),
    supabase.from("deck_vault_decks").select("deck_key,name,deck_data").eq("user_id", userId).not("deck_data", "is", null).limit(RELATED_DECK_LIMIT),
    loadInventoryHistory(supabase, userId, inventoryItemId),
  ]);

  if (inventoryError) throw new Error(`Card workspace inventory failed: ${inventoryError.message ?? "Unknown Supabase error"}`);

  const rawInventoryRows = ((inventoryRows?.length ? inventoryRows : [anchor]) ?? []) as RawInventoryItem[];
  const cards = buildCollectionCards({
    items: rawInventoryRows,
    locations: (locations ?? []) as RawInventoryLocation[],
    tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
    wishlist: (wishlist ?? []) as RawWishlistItem[],
  });
  const anchorCard = cards.find((card) => card.id === inventoryItemId) ?? cards[0];
  if (!anchorCard) return null;

  const attentionSummary = buildInventoryAttentionSummary({
    userId,
    rows: rawInventoryRows,
    totalInventoryRows: rawInventoryRows.length,
  });
  const attentionByItemId = new Map<string, InventoryAttentionItem[]>();
  for (const group of attentionSummary.groups) {
    for (const item of group.representativeItems) {
      if (!item.inventoryItemId) continue;
      const current = attentionByItemId.get(item.inventoryItemId) ?? [];
      current.push(item);
      attentionByItemId.set(item.inventoryItemId, current);
    }
  }

  const rawById = new Map(rawInventoryRows.map((row) => [row.id, row]));
  const inventoryRecords = cards.map((card) => buildInventoryRecord(card, rawById.get(card.id), attentionByItemId.get(card.id) ?? []));
  const position = buildPosition(inventoryRecords);
  const market = buildMarket(anchorCard, position.quantityOwned);
  const deckReferences = buildDeckReferences(decks ?? [], anchorCard);
  const otherPrintings = await loadOtherPrintings(anchorCard);

  return {
    identity: {
      inventoryItemId,
      cardName: anchorCard.cardName,
      gameId: anchorCard.gameId,
      gameLabel: anchorCard.gameLabel,
      productType: anchorCard.productType,
      imageUrl: anchorCard.printing.imageUrl ?? null,
    },
    printing: {
      scryfallId: anchorCard.printing.scryfallId ?? null,
      setCode: anchorCard.printing.setCode ?? null,
      setName: anchorCard.printing.setName ?? null,
      collectorNumber: anchorCard.printing.collectorNumber ?? null,
      language: anchorCard.printing.language ?? null,
      finish: displayFinish(anchorCard.printing.finish),
      display: displayPrinting(anchorCard.printing),
      variant: anchorCard.printing.variant ?? null,
      tcgplayerProductId: numberValue((anchor as RawInventoryItem).tcgplayer_product_id),
      tcgplayerSkuId: numberValue((anchor as RawInventoryItem).tcgplayer_sku_id),
    },
    market,
    userPosition: position,
    inventoryRecords,
    attention: {
      count: inventoryRecords.reduce((sum, record) => sum + record.attentionTypes.length, 0),
      issues: [...attentionByItemId.values()].flat(),
    },
    selling: {
      listedQuantity: (listings ?? []).reduce((sum: number, row: any) => sum + (numberValue(row.last_seen_quantity) ?? 0), 0),
      listings: (listings ?? []).map((row: any) => ({
        id: String(row.id),
        marketplace: String(row.marketplace_id ?? "Marketplace"),
        status: String(row.match_status ?? "unknown"),
        quantity: numberValue(row.last_seen_quantity),
        price: numberValue(row.last_seen_price),
      })),
    },
    decks: deckReferences,
    otherPrintings,
    history,
    actions: buildActions(inventoryItemId, anchorCard.cardName),
    queryStrategy: {
      inventoryRowsLoaded: rawInventoryRows.length,
      inventoryRowsTotal: rawInventoryRows.length,
      relatedPrintingsLoaded: otherPrintings.length,
    },
  };
}

function inventorySelect() {
  return "id,card_name,sku,location_id,game_id,product_type,provider_category_id,provider_product_id,provider_sku_id,tcgplayer_product_id,tcgplayer_sku_id,variant,language,scryfall_id,set_code,collector_number,quantity,inventory_value,updated_at,data";
}

function relatedInventoryQuery(supabase: SupabaseLike, userId: string, anchor: RawInventoryItem) {
  let query = supabase.from("inventory_items").select(inventorySelect()).eq("user_id", userId);
  if (anchor.scryfall_id) return query.eq("scryfall_id", anchor.scryfall_id);
  if (anchor.set_code && anchor.collector_number && anchor.card_name) {
    return query.eq("card_name", anchor.card_name).eq("set_code", anchor.set_code).eq("collector_number", anchor.collector_number);
  }
  return query.eq("card_name", anchor.card_name ?? "");
}

function buildInventoryRecord(card: CollectionCard, raw: RawInventoryItem | undefined, issues: InventoryAttentionItem[]): CardWorkspaceInventoryRecord {
  const quantity = card.quantityOwned;
  const totalValue = card.marketPrice.amount === null ? null : card.marketPrice.amount * quantity;
  const costBasis = resolveInventoryCostBasis([{
    quantity,
    unitCost: knownCost(raw),
    totalCost: knownTotalCost(raw),
  }]);
  const knownUnitCostValue = costBasis.weightedAverageUnitCost;
  return {
    id: card.id,
    cardName: card.cardName,
    quantity,
    condition: displayCondition(card.condition),
    finish: displayFinish(card.printing.finish),
    location: displayStorageLocation(card),
    unitValue: card.marketPrice.amount,
    totalValue,
    knownUnitCost: knownUnitCostValue,
    knownTotalCost: costBasis.knownTotalCost,
    updatedAt: card.updatedAt ?? null,
    attentionTypes: issues.map((issue) => issue.type),
    editHref: `/dashboard/inventory/${encodeURIComponent(card.id)}`,
    inventoryFilterHref: `/dashboard/inventory?query=${encodeURIComponent(card.cardName)}`,
  };
}

function buildPosition(records: CardWorkspaceInventoryRecord[]): CardWorkspacePosition {
  const quantityOwned = records.reduce((sum, record) => sum + record.quantity, 0);
  const totalValue = records.reduce((sum, record) => sum + (record.totalValue ?? 0), 0);
  const hasValue = records.some((record) => record.totalValue !== null);
  const financials = resolveInventoryPositionFinancials({
    lots: records.map((record) => ({
      quantity: record.quantity,
      unitCost: record.knownUnitCost,
      totalCost: record.knownTotalCost,
    })),
    marketValue: hasValue ? totalValue : null,
  });
  const averageKnownCost = financials.weightedAverageUnitCost;
  return {
    quantityOwned,
    lotCount: records.length,
    ownedLabel: quantityOwned > 0 ? `You own ${quantityOwned.toLocaleString()} ${quantityOwned === 1 ? "copy" : "copies"}` : "Not in collection",
    averageKnownCost,
    knownCostQuantity: financials.knownQuantity,
    totalCostBasis: financials.knownTotalCost,
    costBasisLabel: averageKnownCost === null ? "Cost basis unavailable" : `${money(averageKnownCost)} weighted average cost`,
    costBasisCoverageLabel: financials.coverageLabel,
    unrealizedGain: financials.unrealizedGain,
    costBasisCompleteness: financials.completeness,
    costBasisCoverageRatio: financials.coverageRatio,
  };
}

function buildMarket(card: CollectionCard, quantityOwned: number): CardWorkspaceMarket {
  const unitPrice = card.marketPrice.amount;
  return {
    unitPrice,
    totalValue: unitPrice === null ? null : unitPrice * quantityOwned,
    valueSource: unitPrice === null ? "unavailable" : "inventory",
    valueLabel: priceLabel(card),
    timestamp: card.marketPrice.updatedAt ?? null,
  };
}

function buildDeckReferences(rows: any[], card: CollectionCard): CardWorkspaceDeckReference[] {
  const normalizedName = normalizeText(card.cardName);
  const result: CardWorkspaceDeckReference[] = [];
  for (const row of rows) {
    const deck = row.deck_data;
    const cards = Array.isArray(deck?.cards) ? deck.cards : [];
    const matches = cards.filter((entry: any) => normalizeText(entry?.name) === normalizedName);
    const quantity = matches.reduce((sum: number, entry: any) => sum + (numberValue(entry?.quantity) ?? 1), 0);
    if (quantity <= 0) continue;
    const id = String(row.deck_key ?? deck?.id ?? row.id ?? "");
    result.push({
      id,
      name: String(row.name ?? deck?.name ?? "Untitled deck"),
      quantity,
      href: `/dashboard/deck-vault/${encodeURIComponent(id)}`,
    });
  }
  return result.slice(0, 6);
}

async function loadOtherPrintings(card: CollectionCard): Promise<CardWorkspaceOtherPrinting[]> {
  if (card.gameId !== "magic" || !card.cardName) return [];
  const params = new URLSearchParams({
    q: `!"${card.cardName.replaceAll('"', '\\"')}"`,
    unique: "prints",
    order: "released",
  });
  try {
    const response = await fetch(`https://api.scryfall.com/cards/search?${params.toString()}`, {
      headers: { accept: "application/json", "user-agent": "TradingDocks/1.0" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: any[] };
    return (payload.data ?? [])
      .filter((printing) => printing.id !== card.printing.scryfallId)
      .slice(0, RELATED_PRINTING_LIMIT)
      .map((printing) => ({
        id: String(printing.id),
        name: String(printing.name ?? card.cardName),
        setCode: typeof printing.set === "string" ? printing.set.toUpperCase() : null,
        setName: typeof printing.set_name === "string" ? printing.set_name : null,
        collectorNumber: typeof printing.collector_number === "string" ? printing.collector_number : null,
        imageUrl: printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal ?? null,
        price: numberValue(printing.prices?.usd) ?? numberValue(printing.prices?.usd_foil),
        href: typeof printing.scryfall_uri === "string" ? printing.scryfall_uri : null,
      }));
  } catch {
    return [];
  }
}

function buildActions(inventoryItemId: string, cardName: string): CardWorkspaceAction[] {
  return [
    { label: "Edit inventory record", href: `/dashboard/inventory/${encodeURIComponent(inventoryItemId)}`, priority: "primary" },
    { label: "Open Collection filter", href: `/dashboard/inventory?query=${encodeURIComponent(cardName)}`, priority: "secondary" },
    { label: "Open Deck Builder", href: "/dashboard/deck-builder", priority: "tertiary" },
  ];
}

function knownCost(row: RawInventoryItem | undefined) {
  const data = row?.data ?? {};
  return nonNegativeNumber(data.unitCost) ?? nonNegativeNumber(data.costBasis) ?? nonNegativeNumber(data.purchasePrice) ?? null;
}

function knownTotalCost(row: RawInventoryItem | undefined) {
  const data = row?.data ?? {};
  return nonNegativeNumber(data.totalCost) ?? nonNegativeNumber(data.totalCostBasis) ?? null;
}

async function loadInventoryHistory(
  supabase: SupabaseLike,
  userId: string,
  inventoryItemId: string,
): Promise<CardWorkspaceHistory> {
  try {
    const { data, error } = await supabase
      .from("inventory_events")
      .select("id,event_type,quantity_before,quantity_change,quantity_after,previous_value,next_value,previous_location_id,next_location_id,source,metadata,occurred_at")
      .eq("user_id", userId)
      .eq("inventory_item_id", inventoryItemId)
      .order("occurred_at", { ascending: false })
      .limit(12);
    if (error) {
      const message = error.message ?? "";
      if (/inventory_events|schema cache|does not exist/i.test(message)) {
        return { available: false, events: [], unavailableReason: "Inventory history ledger is not enabled yet." };
      }
      throw new Error(message || "Inventory history failed.");
    }
    return {
      available: true,
      unavailableReason: null,
      events: (data ?? []).map((row: any) => ({
        id: String(row.id),
        eventType: String(row.event_type ?? "inventory_event"),
        quantityBefore: numberValue(row.quantity_before),
        quantityChange: numberValue(row.quantity_change),
        quantityAfter: numberValue(row.quantity_after),
        previousValue: typeof row.previous_value === "string" ? row.previous_value : null,
        nextValue: typeof row.next_value === "string" ? row.next_value : null,
        previousLocationId: typeof row.previous_location_id === "string" ? row.previous_location_id : null,
        nextLocationId: typeof row.next_location_id === "string" ? row.next_location_id : null,
        source: String(row.source ?? "application"),
        metadata: isRecord(row.metadata) ? row.metadata : {},
        occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : new Date().toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof Error && /inventory_events|schema cache|does not exist/i.test(error.message)) {
      return { available: false, events: [], unavailableReason: "Inventory history ledger is not enabled yet." };
    }
    throw error;
  }
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function money(value: number | null) {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
