import {
  summarizeBulkOffer,
  type BulkAdjustment,
  type BulkOfferRow,
  type BulkOfferSummary,
} from "../bulk-buying-calculator.ts";

export type PurchaseSourceType =
  | "bulk_buying"
  | "collection_buying"
  | "sealed_buying"
  | "buylist_intake"
  | "vendor_purchase"
  | "card_show_buy"
  | "trade_in"
  | "manual_purchase";

export type PurchaseStatus =
  | "pending"
  | "completed"
  | "received"
  | "cancelled";

export type PurchasePaymentMethod =
  | "cash"
  | "card"
  | "store_credit"
  | "trade_value"
  | "bank_transfer"
  | "check"
  | "other"
  | "unknown";

export type PurchaseLedgerLine = {
  id: string;
  purchaseId: string;
  lineType: string;
  description: string;
  quantity: number;
  unitCount: number;
  unitCost: number;
  totalCost: number;
  inventoryItemId: string | null;
  details: Record<string, unknown>;
};

export type PurchaseLedgerRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  sourceType: PurchaseSourceType;
  sellerName: string;
  sellerCustomerId: string | null;
  vendorId: string | null;
  status: PurchaseStatus;
  paymentMethod: PurchasePaymentMethod;
  subtotal: number;
  adjustment: number;
  totalCost: number;
  itemCount: number;
  unitCount: number;
  createdBy: string;
  purchasedAt: string;
  receivedAt: string | null;
  notes: string;
  details: Record<string, unknown>;
  lines: PurchaseLedgerLine[];
};

export type PurchaseHistoryFilters = {
  tab?: "all" | PurchaseStatus;
  sourceType?: PurchaseSourceType | "all";
  paymentMethod?: PurchasePaymentMethod | "all";
  query?: string;
  from?: string;
  to?: string;
};

export type PurchaseHistoryMetrics = {
  spentToday: number;
  spentThisWeek: number;
  pendingIntakeCount: number;
  inventoryAcquiredUnits: number;
  averageAcquisitionCost: number;
  vendorSpend: number;
  customerBuySpend: number;
  storeCreditIssued: number;
};

export type NewPurchaseLineInput = {
  lineType: string;
  description: string;
  quantity: number;
  unitCount: number;
  unitCost: number;
  totalCost: number;
  inventoryItemId?: string | null;
  details?: Record<string, unknown>;
};

export type NewPurchaseInput = {
  sourceType: PurchaseSourceType;
  sellerName?: string;
  sellerCustomerId?: string | null;
  vendorId?: string | null;
  status?: PurchaseStatus;
  paymentMethod?: PurchasePaymentMethod;
  subtotal: number;
  adjustment?: number;
  totalCost: number;
  itemCount: number;
  unitCount: number;
  purchasedAt?: string;
  receivedAt?: string | null;
  notes?: string;
  details?: Record<string, unknown>;
  lines: NewPurchaseLineInput[];
};

export const PURCHASE_SOURCE_LABELS: Record<PurchaseSourceType, string> = {
  bulk_buying: "Bulk Buying",
  collection_buying: "Collection Buying",
  sealed_buying: "Sealed Buying",
  buylist_intake: "Buylist Intake",
  vendor_purchase: "Vendor Purchase",
  card_show_buy: "Card Show Buy",
  trade_in: "Trade-in",
  manual_purchase: "Manual Purchase",
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  received: "Received",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PurchasePaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  store_credit: "Store credit",
  trade_value: "Trade value",
  bank_transfer: "Bank transfer",
  check: "Check",
  other: "Other",
  unknown: "Unknown",
};

export function isPurchaseSourceType(value: unknown): value is PurchaseSourceType {
  return typeof value === "string" && value in PURCHASE_SOURCE_LABELS;
}

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return typeof value === "string" && value in PURCHASE_STATUS_LABELS;
}

export function isPaymentMethod(value: unknown): value is PurchasePaymentMethod {
  return typeof value === "string" && value in PAYMENT_METHOD_LABELS;
}

export function normalizePurchaseSource(value: unknown): PurchaseSourceType {
  return isPurchaseSourceType(value) ? value : "manual_purchase";
}

export function normalizePurchaseStatus(value: unknown): PurchaseStatus {
  return isPurchaseStatus(value) ? value : "pending";
}

export function normalizePaymentMethod(value: unknown): PurchasePaymentMethod {
  return isPaymentMethod(value) ? value : "unknown";
}

export function normalizeMoney(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function normalizeCount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function filterPurchaseHistory(
  records: PurchaseLedgerRecord[],
  filters: PurchaseHistoryFilters = {},
) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const from = filters.from ? Date.parse(filters.from) : null;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999`) : null;

  return records.filter((record) => {
    if (filters.tab && filters.tab !== "all" && record.status !== filters.tab) return false;
    if (filters.sourceType && filters.sourceType !== "all" && record.sourceType !== filters.sourceType) return false;
    if (filters.paymentMethod && filters.paymentMethod !== "all" && record.paymentMethod !== filters.paymentMethod) return false;

    const purchasedAt = Date.parse(record.purchasedAt);
    if (from && purchasedAt < from) return false;
    if (to && purchasedAt > to) return false;

    if (!query) return true;
    const haystack = [
      record.sellerName,
      record.createdBy,
      record.notes,
      PURCHASE_SOURCE_LABELS[record.sourceType],
      PAYMENT_METHOD_LABELS[record.paymentMethod],
      ...record.lines.map((line) => line.description),
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

export function summarizePurchaseHistory(
  records: PurchaseLedgerRecord[],
  now = new Date(),
): PurchaseHistoryMetrics {
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diffToMonday = (day + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const activeRecords = records.filter((record) => record.status !== "cancelled");
  const totalCost = activeRecords.reduce((sum, record) => sum + record.totalCost, 0);
  const unitCount = activeRecords.reduce((sum, record) => sum + record.unitCount, 0);

  return {
    spentToday: activeRecords
      .filter((record) => record.purchasedAt.slice(0, 10) === today)
      .reduce((sum, record) => sum + record.totalCost, 0),
    spentThisWeek: activeRecords
      .filter((record) => Date.parse(record.purchasedAt) >= startOfWeek.getTime())
      .reduce((sum, record) => sum + record.totalCost, 0),
    pendingIntakeCount: records.filter((record) => record.status === "pending").length,
    inventoryAcquiredUnits: unitCount,
    averageAcquisitionCost: unitCount > 0 ? totalCost / unitCount : 0,
    vendorSpend: activeRecords
      .filter((record) => record.sourceType === "vendor_purchase" || Boolean(record.vendorId))
      .reduce((sum, record) => sum + record.totalCost, 0),
    customerBuySpend: activeRecords
      .filter((record) => record.sourceType !== "vendor_purchase")
      .reduce((sum, record) => sum + record.totalCost, 0),
    storeCreditIssued: activeRecords
      .filter((record) => record.paymentMethod === "store_credit")
      .reduce((sum, record) => sum + record.totalCost, 0),
  };
}

export function createBulkPurchaseInput({
  rows,
  adjustment,
  sellerName,
  paymentMethod,
  status,
  notes,
  purchasedAt,
}: {
  rows: BulkOfferRow[];
  adjustment?: BulkAdjustment;
  sellerName?: string;
  paymentMethod?: PurchasePaymentMethod;
  status?: PurchaseStatus;
  notes?: string;
  purchasedAt?: string;
}): NewPurchaseInput {
  const summary: BulkOfferSummary = summarizeBulkOffer(rows, adjustment);
  const lines = rows
    .map((row): NewPurchaseLineInput => {
      const quantity = normalizeCount(row.quantity);
      const rate = normalizeMoney(row.rate);
      const totalCost = normalizeMoney(
        quantity > 0 && rate > 0
          ? summarizeBulkOffer([row]).finalOffer
          : 0,
      );
      return {
        lineType: "bulk_category",
        description: row.category.trim() || "Uncategorized bulk",
        quantity: 1,
        unitCount: quantity,
        unitCost: rate,
        totalCost,
        details: {
          category: row.category.trim(),
          rate,
          basis: row.basis,
        },
      };
    })
    .filter((line) => line.unitCount > 0 && line.totalCost > 0);

  return {
    sourceType: "bulk_buying",
    sellerName: sellerName?.trim() || "Unspecified seller",
    status: status ?? "pending",
    paymentMethod: paymentMethod ?? "unknown",
    subtotal: normalizeMoney(summary.subtotal),
    adjustment: normalizeMoney(summary.adjustmentAmount),
    totalCost: normalizeMoney(summary.finalOffer),
    itemCount: lines.length,
    unitCount: normalizeCount(summary.totalCards),
    purchasedAt,
    notes,
    details: {
      adjustment: adjustment ?? null,
      calculatorSummary: summary,
    },
    lines,
  };
}

export function validateNewPurchaseInput(input: NewPurchaseInput) {
  const errors: string[] = [];
  if (!isPurchaseSourceType(input.sourceType)) errors.push("Choose a valid purchase source.");
  if (input.totalCost < 0) errors.push("Total cost cannot be negative.");
  if (input.itemCount < 0 || input.unitCount < 0) errors.push("Item and unit counts cannot be negative.");
  if (!input.lines.length) errors.push("Add at least one purchase line.");
  for (const line of input.lines) {
    if (line.totalCost < 0 || line.quantity < 0 || line.unitCount < 0) {
      errors.push("Purchase lines cannot contain negative quantities or costs.");
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}
