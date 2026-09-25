/** Strict money parsing: blank, malformed and negative values are unavailable. */
export function availableMoney(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && (!value.trim() || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function totalInventoryValue(unitMarketValue: unknown, quantity: number): number | null {
  const unit = availableMoney(unitMarketValue);
  if (unit === null || !Number.isInteger(quantity) || quantity < 0) return null;
  const total = Math.round(unit * quantity * 100) / 100;
  return Number.isFinite(total) ? total : null;
}

/** Untagged legacy rows are not silently reinterpreted or rewritten. */
export function trustedInventoryValue(row: { inventory_value?: unknown; data?: unknown }): number | null {
  const data = row.data && typeof row.data === "object" ? row.data as Record<string, unknown> : {};
  return data.inventoryValueSemantics === "total_row_v1" ? availableMoney(row.inventory_value) : null;
}

export function summarizeInventoryValues(values: readonly (number | null)[]) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  const knownSubtotal = Math.round(known.reduce((sum, value) => sum + value, 0) * 100) / 100;
  return {
    value: known.length ? knownSubtotal : null,
    knownSubtotal,
    unpricedRows: values.length - known.length,
    coverage: values.length ? known.length / values.length : 0,
    status: known.length === values.length && values.length > 0 ? "CALCULATED" as const : "INSUFFICIENT_DATA" as const,
  };
}
