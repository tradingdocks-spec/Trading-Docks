import { NextResponse } from "next/server";

import { inventoryMutationIdempotencyKey } from "@/lib/inventory/events";
import { requireApiCapability } from "@/lib/platform/server-access";

const MAX_BULK_REMOVE_ROWS = 1000;

type BulkRemoveRequest = {
  inventoryItemIds?: unknown;
  reason?: unknown;
  operationId?: unknown;
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const { supabase, user } = capability;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as BulkRemoveRequest | null;
  const ids = normalizeIds(body?.inventoryItemIds);
  if (!ids.length) return NextResponse.json({ error: "Choose inventory records to remove." }, { status: 400 });
  if (ids.length > MAX_BULK_REMOVE_ROWS) {
    return NextResponse.json({ error: `Remove at most ${MAX_BULK_REMOVE_ROWS.toLocaleString()} visible records at a time.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id,user_id,quantity,inventory_value")
    .eq("user_id", user.id)
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: "One or more selected inventory records are not available to this account." }, { status: 403 });
  }

  const operationId = stringValue(body?.operationId) || globalThis.crypto.randomUUID();
  const reason = stringValue(body?.reason) || "Bulk remove from collection";
  let removedQuantity = 0;
  let removedValue = 0;

  for (const row of rows) {
    const quantity = Math.max(0, Number(row.quantity ?? 0));
    if (!quantity) continue;
    const { error: removeError } = await supabase.rpc("remove_inventory_lot_quantity", {
      p_inventory_item_id: row.id,
      p_quantity: quantity,
      p_reason: reason,
      p_idempotency_key: inventoryMutationIdempotencyKey({
        source: "collector_workspace",
        inventoryItemId: row.id,
        mutationType: "remove_quantity",
        value: `bulk:${operationId}:${quantity}`,
        timestamp: operationId,
      }),
      p_source: "collector_workspace",
    });
    if (removeError) {
      return NextResponse.json({ error: removeError.message, inventoryItemId: row.id }, { status: 500 });
    }
    removedQuantity += quantity;
    removedValue += Number(row.inventory_value ?? 0) || 0;
  }

  return NextResponse.json({
    ok: true,
    removedRecords: rows.length,
    removedQuantity,
    estimatedMarketValue: removedValue,
    eventTypes: ["quantity_removed"],
  });
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
