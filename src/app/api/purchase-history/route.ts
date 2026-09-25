import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import { createPurchaseLedgerRecord } from "@/lib/purchase-history/server";
import {
  isPaymentMethod,
  isPurchaseSourceType,
  isPurchaseStatus,
  normalizeCount,
  normalizeMoney,
  validateNewPurchaseInput,
  type NewPurchaseInput,
  type PurchasePaymentMethod,
  type PurchaseSourceType,
  type PurchaseStatus,
} from "@/lib/purchase-history/ledger";

export const runtime = "nodejs";

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function sourceOrDefault(value: unknown): PurchaseSourceType {
  return isPurchaseSourceType(value) ? value : "manual_purchase";
}

function statusOrDefault(value: unknown): PurchaseStatus {
  return isPurchaseStatus(value) ? value : "pending";
}

function paymentOrDefault(value: unknown): PurchasePaymentMethod {
  return isPaymentMethod(value) ? value : "unknown";
}

function payloadToPurchaseInput(value: unknown): NewPurchaseInput {
  const payload = objectRecord(value);
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  return {
    sourceType: sourceOrDefault(payload.sourceType),
    sellerName: stringOrUndefined(payload.sellerName),
    sellerCustomerId: stringOrUndefined(payload.sellerCustomerId) ?? null,
    vendorId: stringOrUndefined(payload.vendorId) ?? null,
    status: statusOrDefault(payload.status),
    paymentMethod: paymentOrDefault(payload.paymentMethod),
    subtotal: normalizeMoney(payload.subtotal),
    adjustment: normalizeMoney(payload.adjustment),
    totalCost: normalizeMoney(payload.totalCost),
    itemCount: normalizeCount(payload.itemCount),
    unitCount: normalizeCount(payload.unitCount),
    purchasedAt: stringOrUndefined(payload.purchasedAt),
    receivedAt: stringOrUndefined(payload.receivedAt) ?? null,
    notes: stringOrUndefined(payload.notes),
    details: objectRecord(payload.details),
    lines: rawLines.map((line) => {
      const row = objectRecord(line);
      return {
        lineType: stringOrUndefined(row.lineType) ?? "line",
        description: stringOrUndefined(row.description) ?? "Purchase line",
        quantity: normalizeCount(row.quantity),
        unitCount: normalizeCount(row.unitCount),
        unitCost: normalizeMoney(row.unitCost),
        totalCost: normalizeMoney(row.totalCost),
        inventoryItemId: stringOrUndefined(row.inventoryItemId) ?? null,
        details: objectRecord(row.details),
      };
    }),
  };
}

export async function POST(request: Request) {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

  const body = await request.json().catch(() => null);
  const payload = objectRecord(body);
  if (payload.action !== "create-purchase") {
    return NextResponse.json({ error: "Unsupported Purchase History action." }, { status: 400 });
  }

  const purchase = payloadToPurchaseInput(payload.purchase);
  const validation = validateNewPurchaseInput(purchase);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Fix the purchase before saving.", details: validation.errors },
      { status: 400 },
    );
  }

  const result = await createPurchaseLedgerRecord({
    supabase: capability.supabase,
    access: capability.access,
    userId: capability.user?.id ?? "",
    purchase,
  });

  if (result.error) {
    if (result.error.code === "ACQUISITION_WORKFLOW_REQUIRED") {
      return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: 409 });
    }
    const missingSchema =
      result.error.code === "42P01" ||
      result.error.code === "PGRST205" ||
      /purchase_ledger/i.test(result.error.message ?? "");
    return NextResponse.json(
      {
        error: missingSchema
          ? "Purchase History schema is not configured for this environment."
          : "Purchase could not be saved.",
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      },
      { status: missingSchema ? 503 : 500 },
    );
  }

  return NextResponse.json({ purchaseId: result.data?.id }, { status: 201 });
}
