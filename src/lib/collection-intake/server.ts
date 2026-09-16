import {
  calculateCollectionValuation,
  inferReviewState,
  normalizeNullableMoney,
  normalizeQuantity,
  normalizeScenario,
  type CollectionIntake,
  type CollectionIntakeItem,
  type CollectionIntakeScenarioKey,
} from "./domain.ts";

type SupabaseError = { code?: string; message?: string; details?: string; hint?: string };

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SupabaseClientLike = {
  from: (table: string) => QueryBuilderLike;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<SupabaseResult<unknown>>;
};

type QueryBuilderLike = PromiseLike<SupabaseResult<unknown>> & {
  select: (columns: string) => QueryBuilderLike;
  insert: (values: unknown) => QueryBuilderLike;
  update: (values: unknown) => QueryBuilderLike;
  delete: () => QueryBuilderLike;
  eq: (column: string, value: string) => QueryBuilderLike;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilderLike;
  limit: (count: number) => QueryBuilderLike;
  single: () => PromiseLike<SupabaseResult<unknown>>;
};

export type CollectionIntakeLoadResult = {
  intakes: CollectionIntake[];
  schemaAvailable: boolean;
  warning: string | null;
};

export type SaveCollectionIntakeInput = {
  id?: string;
  title: string;
  sellerName?: string;
  sellerContact?: string;
  scenarioKey?: CollectionIntakeScenarioKey;
  customScenario?: Record<string, unknown>;
  actualOffer?: number | null;
  notes?: string;
  status?: string;
  items: Array<Partial<CollectionIntakeItem>>;
};

export type CompleteCollectionIntakeInput = {
  intakeId: string;
  actualOffer: number;
  idempotencyKey?: string | null;
};

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown) {
  const normalized = normalizeNullableMoney(value);
  return normalized === null ? null : normalized;
}

function bigintNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function isMissingSchemaError(error: SupabaseError | null) {
  if (!error) return false;
  return error.code === "42P01" ||
    error.code === "PGRST205" ||
    /collection_intakes|collection_intake_items|collection_purchases|complete_collection_intake/i.test(error.message ?? "");
}

export function collectionIntakeFromRow(row: Record<string, unknown>): CollectionIntake {
  const items = Array.isArray(row.collection_intake_items)
    ? row.collection_intake_items.map((item) => collectionIntakeItemFromRow(objectRecord(item)))
    : [];
  return {
    id: stringValue(row.id),
    status: normalizeStatus(row.status),
    title: stringValue(row.title) || "Collection intake",
    sellerName: stringValue(row.seller_name),
    sellerContact: stringValue(row.seller_contact),
    scenarioKey: normalizeScenarioKey(row.scenario_key),
    customScenario: objectRecord(row.scenario),
    actualOffer: numberOrNull(row.actual_offer),
    items,
    notes: stringValue(row.notes),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

export function collectionIntakeItemFromRow(row: Record<string, unknown>): CollectionIntakeItem {
  return {
    id: stringValue(row.id),
    cardName: stringValue(row.card_name),
    gameId: stringValue(row.game_id) || "magic",
    productType: normalizeProductType(row.product_type),
    setCode: nullableString(row.set_code),
    collectorNumber: nullableString(row.collector_number),
    scryfallId: nullableString(row.scryfall_id),
    tcgplayerProductId: bigintNumberOrNull(row.tcgplayer_product_id),
    tcgplayerSkuId: bigintNumberOrNull(row.tcgplayer_sku_id),
    condition: nullableString(row.condition),
    finish: nullableString(row.finish),
    language: stringValue(row.language) || "English",
    quantity: normalizeQuantity(row.quantity),
    unitMarketValue: numberOrNull(row.unit_market_value),
    reviewState: normalizeReviewState(row.review_state),
    notes: stringValue(row.notes),
  };
}

export async function loadCollectionIntakes({
  supabase,
  userId,
  workspaceId,
  limit = 25,
}: {
  supabase: unknown;
  userId: string;
  workspaceId: string | null;
  limit?: number;
}): Promise<CollectionIntakeLoadResult> {
  const client = supabase as SupabaseClientLike;
  let query = client
    .from("collection_intakes")
    .select(`
      id,status,title,seller_name,seller_contact,scenario_key,scenario,actual_offer,notes,created_at,updated_at,
      collection_intake_items(
        id,card_name,game_id,product_type,set_code,collector_number,scryfall_id,tcgplayer_product_id,tcgplayer_sku_id,
        condition,finish,language,quantity,unit_market_value,review_state,notes,created_at
      )
    `)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  query = workspaceId ? query.eq("workspace_id", workspaceId) : query.eq("user_id", userId);
  const { data, error } = await query as SupabaseResult<unknown>;
  if (isMissingSchemaError(error)) {
    return {
      intakes: [],
      schemaAvailable: false,
      warning: "Collection Intake schema is not configured for this environment.",
    };
  }
  if (error) {
    return {
      intakes: [],
      schemaAvailable: true,
      warning: error.message ?? "Collection intakes could not be loaded.",
    };
  }
  return {
    intakes: Array.isArray(data) ? data.map((row) => collectionIntakeFromRow(objectRecord(row))) : [],
    schemaAvailable: true,
    warning: null,
  };
}

export async function saveCollectionIntake({
  supabase,
  userId,
  workspaceId,
  input,
}: {
  supabase: unknown;
  userId: string;
  workspaceId: string | null;
  input: SaveCollectionIntakeInput;
}) {
  const client = supabase as SupabaseClientLike;
  const items = input.items.map(normalizeInputItem).filter((item) => item.quantity > 0);
  const scenarioKey = normalizeScenarioKey(input.scenarioKey);
  const scenario = normalizeScenario(scenarioKey, input.customScenario);
  const valuation = calculateCollectionValuation({
    items,
    scenario,
    actualOffer: input.actualOffer,
  });
  const status = input.status === "offer_ready" || input.status === "evaluating" || input.status === "declined" || input.status === "archived"
    ? input.status
    : valuation.blockingReviewCount > 0
      ? "evaluating"
      : "offer_ready";
  const row = {
    user_id: userId,
    workspace_id: workspaceId,
    title: input.title?.trim() || "Collection intake",
    seller_name: input.sellerName?.trim() ?? "",
    seller_contact: input.sellerContact?.trim() ?? "",
    status,
    scenario_key: scenarioKey,
    scenario,
    valuation,
    actual_offer: input.actualOffer ?? null,
    notes: input.notes?.trim() ?? "",
    updated_at: new Date().toISOString(),
  };

  const intakeResult = input.id
    ? await client
      .from("collection_intakes")
      .update(row)
      .eq("user_id", userId)
      .eq("id", input.id)
      .select("id")
      .single() as SupabaseResult<unknown>
    : await client
      .from("collection_intakes")
      .insert(row)
      .select("id")
      .single() as SupabaseResult<unknown>;

  if (intakeResult.error) return { data: null, error: intakeResult.error };
  const intakeId = stringValue(objectRecord(intakeResult.data).id);
  if (!intakeId) return { data: null, error: { message: "Collection intake was saved without a returned id." } };

  const deleteResult = await client
    .from("collection_intake_items")
    .delete()
    .eq("user_id", userId)
    .eq("intake_id", intakeId) as SupabaseResult<unknown>;
  if (deleteResult.error) return { data: null, error: deleteResult.error };

  if (items.length) {
    const itemRows = items.map((item) => ({
      intake_id: intakeId,
      user_id: userId,
      workspace_id: workspaceId,
      card_name: item.cardName,
      game_id: item.gameId,
      product_type: item.productType,
      set_code: item.setCode,
      collector_number: item.collectorNumber,
      scryfall_id: item.scryfallId,
      tcgplayer_product_id: item.tcgplayerProductId,
      tcgplayer_sku_id: item.tcgplayerSkuId,
      condition: item.condition,
      finish: item.finish,
      language: item.language,
      quantity: item.quantity,
      unit_market_value: item.unitMarketValue,
      review_state: item.reviewState,
      notes: item.notes,
      metadata: {},
    }));
    const itemResult = await client
      .from("collection_intake_items")
      .insert(itemRows)
      .select("id") as SupabaseResult<unknown>;
    if (itemResult.error) return { data: null, error: itemResult.error };
  }

  return {
    data: { intakeId, valuation, itemCount: items.length },
    error: null,
  };
}

export async function completeCollectionIntake({
  supabase,
  input,
}: {
  supabase: unknown;
  input: CompleteCollectionIntakeInput;
}) {
  const client = supabase as SupabaseClientLike;
  return client.rpc("complete_collection_intake", {
    p_intake_id: input.intakeId,
    p_actual_offer: input.actualOffer,
    p_idempotency_key: input.idempotencyKey ?? `collection-intake:${input.intakeId}`,
  }) as PromiseLike<SupabaseResult<unknown>>;
}

function normalizeInputItem(input: Partial<CollectionIntakeItem>): CollectionIntakeItem {
  const item: CollectionIntakeItem = {
    id: input.id || crypto.randomUUID(),
    cardName: input.cardName?.trim() ?? "",
    gameId: input.gameId?.trim() || "magic",
    productType: input.productType === "sealed" || input.productType === "bulk" ? input.productType : "card",
    setCode: input.setCode?.trim() || null,
    collectorNumber: input.collectorNumber?.trim() || null,
    scryfallId: input.scryfallId?.trim() || null,
    tcgplayerProductId: bigintNumberOrNull(input.tcgplayerProductId),
    tcgplayerSkuId: bigintNumberOrNull(input.tcgplayerSkuId),
    condition: input.condition?.trim() || null,
    finish: input.finish?.trim() || null,
    language: input.language?.trim() || "English",
    quantity: normalizeQuantity(input.quantity || 1),
    unitMarketValue: normalizeNullableMoney(input.unitMarketValue),
    reviewState: normalizeReviewState(input.reviewState),
    notes: input.notes?.trim() ?? "",
  };
  item.reviewState = input.reviewState && input.reviewState !== "ready"
    ? normalizeReviewState(input.reviewState)
    : inferReviewState(item);
  return item;
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "");
  if (["draft", "evaluating", "offer_ready", "purchased", "declined", "archived"].includes(raw)) {
    return raw as CollectionIntake["status"];
  }
  return "draft";
}

function normalizeScenarioKey(value: unknown): CollectionIntakeScenarioKey {
  const raw = String(value ?? "");
  if (raw === "conservative" || raw === "standard" || raw === "aggressive" || raw === "custom") return raw;
  return "standard";
}

function normalizeReviewState(value: unknown) {
  const raw = String(value ?? "");
  if (
    raw === "ready" ||
    raw === "unresolved_identity" ||
    raw === "ambiguous_printing" ||
    raw === "unknown_condition" ||
    raw === "unknown_finish" ||
    raw === "missing_price" ||
    raw === "high_value_confirmation"
  ) return raw;
  return "ready";
}

function normalizeProductType(value: unknown): "card" | "sealed" | "bulk" {
  const raw = String(value ?? "");
  if (raw === "sealed" || raw === "bulk") return raw;
  return "card";
}
