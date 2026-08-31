import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import {
  buildInventoryMutationEvent,
  recordInventoryEvent,
} from "@/lib/inventory/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChaosSortCommitItem = {
  id: string;
  cardName: string;
  gameId: string;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  finish: string | null;
  condition: string | null;
  quantity: number;
  marketPrice: number | null;
  existingOwnedQuantity: number;
  destinationLocationId: string | null;
  destinationLabel: string;
  recognitionState: "high_confidence" | "review" | "unknown";
  humanState: "pending" | "confirmed" | "edited" | "unknown" | "removed";
  sourceFileName: string;
  sourceFileHash: string;
  sourceImageUrl: string | null;
  evidence: string[];
  notes: string;
  duplicateOfItemId: string | null;
};

type CommitPayload = {
  batch: {
    id: string;
    batchCode: string;
    title: string;
    destinationLocationId: string | null;
    destinationLabel: string;
    acquisitionCost: number | null;
    status: string;
    sourceCount: number;
    duplicateCount: number;
    estimatedMarketValue: number;
    createdAt: string;
    updatedAt: string;
  };
  items: ChaosSortCommitItem[];
  rules: Array<Record<string, unknown>>;
};

type SupabaseClientLike = {
  from: (table: string) => {
    insert: (payload: unknown, options?: Record<string, unknown>) => PromiseLike<{ error?: { message?: string; code?: string } | null }>;
    upsert: (payload: unknown, options?: Record<string, unknown>) => PromiseLike<{ error?: { message?: string; code?: string } | null }>;
    select: (columns: string) => {
      maybeSingle: () => PromiseLike<{ data: unknown; error?: { message?: string; code?: string } | null }>;
      single: () => PromiseLike<{ data: unknown; error?: { message?: string; code?: string } | null }>;
    };
  };
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const userId = capability.user?.id ?? "";
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as CommitPayload | null;
  if (!payload?.batch || !Array.isArray(payload.items) || !payload.items.length) {
    return NextResponse.json({ error: "Chaos Sort requires at least one reviewed item before commit." }, { status: 400 });
  }

  const auditResult = await recordBatchAudit(capability.supabase as SupabaseClientLike, userId, payload);
  const inventoryResult = await commitInventory(capability.supabase as SupabaseClientLike, userId, payload);

  if (!inventoryResult.ok) {
    return NextResponse.json(
      {
        error: inventoryResult.error,
        auditSchemaAvailable: auditResult.schemaAvailable,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    batchId: payload.batch.id,
    committedCount: inventoryResult.committedCount,
    auditSchemaAvailable: auditResult.schemaAvailable,
  });
}

async function recordBatchAudit(
  supabase: SupabaseClientLike,
  userId: string,
  payload: CommitPayload,
) {
  const batchRow = {
    id: payload.batch.id,
    user_id: userId,
    batch_code: payload.batch.batchCode,
    title: payload.batch.title,
    status: payload.batch.status,
    source_count: payload.batch.sourceCount,
    duplicate_count: payload.batch.duplicateCount,
    estimated_market_value: payload.batch.estimatedMarketValue,
    acquisition_cost: payload.batch.acquisitionCost,
    destination_location_id: payload.batch.destinationLocationId,
    destination_label: payload.batch.destinationLabel,
    sort_plan: payload.rules,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };

  const batchResult = await supabase.from("chaos_sort_batches").insert(batchRow);
  if (batchResult.error && isMissingChaosSortSchema(batchResult.error)) {
    return { schemaAvailable: false };
  }
  if (batchResult.error) {
    throw new Error(batchResult.error.message ?? "Chaos Sort batch could not be recorded.");
  }

  const itemRows = payload.items.map((item, index) => ({
    id: item.id,
    batch_id: payload.batch.id,
    user_id: userId,
    source_file_name: item.sourceFileName,
    source_file_hash: item.sourceFileHash,
    source_image_url: item.sourceImageUrl,
    recognition_state: item.recognitionState,
    human_state: item.humanState,
    card_name: item.cardName,
    game_id: item.gameId,
    set_code: item.setCode,
    collector_number: item.collectorNumber,
    rarity: item.rarity,
    finish: item.finish,
    condition: item.condition,
    quantity: item.quantity,
    market_price: item.marketPrice,
    existing_owned_quantity: item.existingOwnedQuantity,
    destination_location_id: item.destinationLocationId,
    destination_label: item.destinationLabel,
    source_index: index + 1,
    evidence: item.evidence,
    notes: item.notes,
    duplicate_of_item_id: item.duplicateOfItemId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const itemResult = await supabase.from("chaos_sort_items").insert(itemRows);
  if (itemResult.error && isMissingChaosSortSchema(itemResult.error)) {
    return { schemaAvailable: false };
  }
  if (itemResult.error) {
    throw new Error(itemResult.error.message ?? "Chaos Sort items could not be recorded.");
  }

  const ruleRows = payload.rules.map((rule, index) => ({
    id: String(rule.id ?? `rule-${index + 1}`),
    batch_id: payload.batch.id,
    user_id: userId,
    rule_key: String(rule.id ?? `rule-${index + 1}`),
    label: String(rule.label ?? `Rule ${index + 1}`),
    target_pile: String(rule.targetPile ?? "review"),
    priority: Number(rule.priority ?? index),
    pass: Number(rule.pass ?? 1),
    enabled: Boolean(rule.enabled ?? true),
    criteria: rule.criteria ?? {},
    description: String(rule.description ?? ""),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const ruleResult = await supabase.from("chaos_sort_rules").insert(ruleRows);
  if (ruleResult.error && isMissingChaosSortSchema(ruleResult.error)) {
    return { schemaAvailable: false };
  }
  if (ruleResult.error) {
    throw new Error(ruleResult.error.message ?? "Chaos Sort rules could not be recorded.");
  }

  return { schemaAvailable: true };
}

async function commitInventory(
  supabase: SupabaseClientLike,
  userId: string,
  payload: CommitPayload,
): Promise<{ ok: true; committedCount: number } | { ok: false; error: string }> {
  const batchLabel = `${payload.batch.batchCode}:${payload.batch.title}`;
  let committedCount = 0;
  for (const item of payload.items) {
    if (item.humanState === "removed" || item.recognitionState === "unknown" || item.humanState === "unknown") {
      continue;
    }
    const inventoryId = `chaos-${payload.batch.batchCode}-${item.id.slice(0, 8)}`;
    const now = new Date().toISOString();
    const existingValue = Math.max(0, Number(item.marketPrice ?? 0));

    const upsertResult = await supabase.from("inventory_items").upsert({
      id: inventoryId,
      user_id: userId,
      card_name: item.cardName,
      sku: `CHAOS-${payload.batch.batchCode}`,
      location_id: item.destinationLocationId,
      scryfall_id: null,
      set_code: item.setCode,
      collector_number: item.collectorNumber,
      quantity: Math.max(0, Math.floor(item.quantity)),
      inventory_value: roundMoney(existingValue * Math.max(0, Math.floor(item.quantity))),
      data: {
        source: "chaos_sort",
        batch_id: payload.batch.id,
        batch_code: payload.batch.batchCode,
        batch_label: batchLabel,
        source_file_name: item.sourceFileName,
        source_file_hash: item.sourceFileHash,
        recognition_state: item.recognitionState,
        human_state: item.humanState,
        game_id: item.gameId,
        rarity: item.rarity,
        finish: item.finish,
        condition: item.condition,
        market_price: item.marketPrice,
        existing_owned_quantity: item.existingOwnedQuantity,
        destination_label: item.destinationLabel,
        evidence: item.evidence,
        notes: item.notes,
      },
      updated_at: now,
      created_at: now,
    }, { onConflict: "user_id,id" });
    if (upsertResult.error) {
      return { ok: false, error: upsertResult.error.message ?? "Chaos Sort inventory write failed." };
    }

    const event = buildInventoryMutationEvent({
      userId,
      inventoryItemId: inventoryId,
      eventType: "inventory_created",
      afterQuantity: Math.max(0, Math.floor(item.quantity)),
      source: "scanner",
      idempotencyKey: `chaos-sort:${payload.batch.id}:${item.id}`,
      metadata: {
        source: "chaos_sort",
        batch_id: payload.batch.id,
        batch_code: payload.batch.batchCode,
        destination_label: item.destinationLabel,
        recognition_state: item.recognitionState,
      },
    });
    const eventResult = await recordInventoryEvent(supabase as any, {
      ...event,
      next_location_id: item.destinationLocationId,
      next_value: item.cardName,
      card_name: item.cardName,
      set_code: item.setCode,
      collector_number: item.collectorNumber,
      finish: item.finish,
      condition: item.condition,
      game_id: item.gameId,
      metadata: {
        source: "chaos_sort",
        batch_id: payload.batch.id,
      },
    });
    if (!eventResult.recorded && eventResult.reason !== "schema_unavailable") {
      return { ok: false, error: "Chaos Sort inventory event could not be recorded." };
    }
    committedCount += 1;
  }

  return { ok: true as const, committedCount };
}

function isMissingChaosSortSchema(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || /chaos_sort_batches|chaos_sort_items|chaos_sort_rules/i.test(error?.message ?? "");
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}
