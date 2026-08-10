export type AccountUsage = {
  cardUnits: number;
  uniqueInventoryRows: number;
  updatedAt: string | null;
  source: "inventory_items" | "account_card_usage" | "none";
};

export type InventoryUsageRow = {
  user_id?: string | null;
  id?: string | null;
  quantity?: number | string | null;
  updated_at?: string | null;
};

export type CachedAccountUsageRow = {
  user_id?: string | null;
  card_units?: number | string | null;
  unique_inventory_rows?: number | string | null;
  updated_at?: string | null;
};

export function buildInventoryUsageByUser(rows: InventoryUsageRow[]) {
  const usage = new Map<string, AccountUsage>();

  for (const row of rows) {
    if (!row.user_id) continue;
    const current = usage.get(row.user_id) ?? {
      cardUnits: 0,
      uniqueInventoryRows: 0,
      updatedAt: null,
      source: "inventory_items" as const,
    };

    current.cardUnits += positiveQuantity(row.quantity);
    current.uniqueInventoryRows += 1;
    current.updatedAt = newestTimestamp(current.updatedAt, row.updated_at ?? null);
    usage.set(row.user_id, current);
  }

  return usage;
}

export function cachedAccountUsage(row: CachedAccountUsageRow | undefined): AccountUsage {
  if (!row) {
    return {
      cardUnits: 0,
      uniqueInventoryRows: 0,
      updatedAt: null,
      source: "none",
    };
  }

  return {
    cardUnits: positiveQuantity(row.card_units),
    uniqueInventoryRows: Math.max(0, Math.floor(numericValue(row.unique_inventory_rows))),
    updatedAt: row.updated_at ?? null,
    source: "account_card_usage",
  };
}

export function resolveAccountUsage({
  userId,
  inventoryUsage,
  cachedUsage,
}: {
  userId: string;
  inventoryUsage: Map<string, AccountUsage>;
  cachedUsage?: CachedAccountUsageRow;
}) {
  return inventoryUsage.get(userId) ?? cachedAccountUsage(cachedUsage);
}

function newestTimestamp(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function positiveQuantity(value: unknown) {
  return Math.max(0, numericValue(value));
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
