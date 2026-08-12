import type { PlatformAccessContext } from "@/lib/platform/client-access";
import {
  normalizeCount,
  normalizeMoney,
  normalizePaymentMethod,
  normalizePurchaseSource,
  normalizePurchaseStatus,
  type NewPurchaseInput,
  type PurchaseHistoryFilters,
  type PurchaseLedgerLine,
  type PurchaseLedgerRecord,
} from "./ledger.ts";

type SupabaseResult<T> = {
  data: T | null;
  error: { code?: string; message?: string; details?: string; hint?: string } | null;
};

type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => QueryBuilderLike;
    insert: (values: unknown) => QueryBuilderLike;
  };
};

type QueryBuilderLike = PromiseLike<SupabaseResult<unknown>> & {
  eq: (column: string, value: string) => QueryBuilderLike;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilderLike;
  limit: (count: number) => QueryBuilderLike;
  select: (columns: string) => QueryBuilderLike;
  single: () => PromiseLike<SupabaseResult<unknown>>;
};

export type PurchaseHistoryLoadResult = {
  records: PurchaseLedgerRecord[];
  schemaAvailable: boolean;
  warning: string | null;
};

function isMissingSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" ||
    error.code === "PGRST205" ||
    /purchase_ledger/i.test(error.message ?? "") && /not exist|schema cache/i.test(error.message ?? "");
}

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

function normalizeProductType(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sealed" || raw === "sealed_product" || raw === "unopened") return "sealed";
  if (raw === "card" || raw === "single" || raw === "singles") return "card";
  return null;
}

function timestampValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value
    : new Date().toISOString();
}

function lineFromRow(row: Record<string, unknown>): PurchaseLedgerLine {
  const details = objectRecord(row.details);
  return {
    id: stringValue(row.id),
    purchaseId: stringValue(row.purchase_id),
    lineType: stringValue(row.line_type) || "line",
    description: stringValue(row.description),
    quantity: normalizeCount(row.quantity),
    unitCount: normalizeCount(row.unit_count),
    unitCost: normalizeMoney(row.unit_cost),
    totalCost: normalizeMoney(row.total_cost),
    inventoryItemId: nullableString(row.inventory_item_id),
    gameId: nullableString(details.gameId ?? details.game_id),
    productType: normalizeProductType(details.productType ?? details.product_type),
    variant: nullableString(details.variant),
    language: nullableString(details.language),
    details,
  };
}

export function purchaseRecordFromRow(row: Record<string, unknown>): PurchaseLedgerRecord {
  const rawLines = Array.isArray(row.purchase_ledger_lines)
    ? row.purchase_ledger_lines
    : [];
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    workspaceId: nullableString(row.workspace_id),
    sourceType: normalizePurchaseSource(row.source_type),
    sellerName: stringValue(row.seller_name),
    sellerCustomerId: nullableString(row.seller_customer_id),
    vendorId: nullableString(row.vendor_id),
    status: normalizePurchaseStatus(row.status),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    subtotal: normalizeMoney(row.subtotal),
    adjustment: normalizeMoney(row.adjustment),
    totalCost: normalizeMoney(row.total_cost),
    itemCount: normalizeCount(row.item_count),
    unitCount: normalizeCount(row.unit_count),
    createdBy: stringValue(row.created_by),
    purchasedAt: timestampValue(row.purchased_at),
    receivedAt: nullableString(row.received_at),
    notes: stringValue(row.notes),
    details: objectRecord(row.details),
    lines: rawLines.map((line) => lineFromRow(objectRecord(line))),
  };
}

export async function loadPurchaseHistory(
  supabase: unknown,
  access: PlatformAccessContext,
  _filters: PurchaseHistoryFilters = {},
): Promise<PurchaseHistoryLoadResult> {
  const client = supabase as SupabaseClientLike;
  let query = client
    .from("purchase_ledger")
    .select(`
      id,user_id,workspace_id,source_type,seller_name,seller_customer_id,vendor_id,
      status,payment_method,subtotal,adjustment,total_cost,item_count,unit_count,
      created_by,purchased_at,received_at,notes,details,
      purchase_ledger_lines(
        id,purchase_id,line_type,description,quantity,unit_count,unit_cost,total_cost,
        inventory_item_id,details
      )
    `)
    .order("purchased_at", { ascending: false })
    .limit(250);

  if (access.workspaceId) {
    query = query.eq("workspace_id", access.workspaceId);
  } else if (access.userId) {
    query = query.eq("user_id", access.userId);
  }

  const { data, error } = await query as SupabaseResult<unknown>;
  if (isMissingSchemaError(error)) {
    return {
      records: [],
      schemaAvailable: false,
      warning: "The canonical Purchase History schema has not been applied to this Supabase project yet.",
    };
  }
  if (error) {
    return {
      records: [],
      schemaAvailable: true,
      warning: error.message ?? "Purchase History could not be loaded.",
    };
  }

  return {
    records: Array.isArray(data)
      ? data.map((row) => purchaseRecordFromRow(objectRecord(row)))
      : [],
    schemaAvailable: true,
    warning: null,
  };
}

export async function createPurchaseLedgerRecord({
  supabase,
  access,
  userId,
  purchase,
}: {
  supabase: unknown;
  access: PlatformAccessContext;
  userId: string;
  purchase: NewPurchaseInput;
}) {
  const client = supabase as SupabaseClientLike;
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("purchase_ledger")
    .insert({
      user_id: userId,
      workspace_id: access.workspaceId,
      source_type: purchase.sourceType,
      seller_name: purchase.sellerName ?? "",
      seller_customer_id: purchase.sellerCustomerId ?? null,
      vendor_id: purchase.vendorId ?? null,
      status: purchase.status ?? "pending",
      payment_method: purchase.paymentMethod ?? "unknown",
      subtotal: normalizeMoney(purchase.subtotal),
      adjustment: normalizeMoney(purchase.adjustment),
      total_cost: normalizeMoney(purchase.totalCost),
      item_count: normalizeCount(purchase.itemCount),
      unit_count: normalizeCount(purchase.unitCount),
      created_by: userId,
      purchased_at: purchase.purchasedAt ?? now,
      received_at: purchase.receivedAt ?? null,
      notes: purchase.notes ?? "",
      details: purchase.details ?? {},
    })
    .select("id")
    .single() as SupabaseResult<unknown>;

  if (error) return { data: null, error };
  const purchaseId = stringValue(objectRecord(data).id);
  if (!purchaseId) {
    return { data: null, error: { message: "Purchase record was created without a returned id." } };
  }

  const lines = purchase.lines.map((line) => {
    const details = {
      ...(line.details ?? {}),
      ...(line.gameId ? { gameId: line.gameId, game_id: line.gameId } : {}),
      ...(line.productType ? { productType: line.productType, product_type: line.productType } : {}),
      ...(line.variant ? { variant: line.variant } : {}),
      ...(line.language ? { language: line.language } : {}),
    };
    return {
      purchase_id: purchaseId,
      line_type: line.lineType,
      description: line.description,
      quantity: normalizeCount(line.quantity),
      unit_count: normalizeCount(line.unitCount),
      unit_cost: normalizeMoney(line.unitCost),
      total_cost: normalizeMoney(line.totalCost),
      inventory_item_id: line.inventoryItemId ?? null,
      details,
    };
  });

  const lineResult = await client
    .from("purchase_ledger_lines")
    .insert(lines)
    .select("id") as SupabaseResult<unknown>;

  if (lineResult.error) return { data: null, error: lineResult.error };
  return { data: { id: purchaseId }, error: null };
}
