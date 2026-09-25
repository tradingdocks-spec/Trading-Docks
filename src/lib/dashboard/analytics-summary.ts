import { summarizeInventoryValues, trustedInventoryValue } from "../intelligence-provenance.ts";
export type AnalyticsInventoryRow = {
  quantity: number | null;
  inventory_value: number | null;
  data: Record<string, unknown> | null;
  updated_at: string | null;
};

export type AnalyticsInventorySummary = {
  units: number;
  value: number | null;
  unpricedRows: number;
  skus: number;
  addedLast30Days: null;
};

export function summarizeAnalyticsInventory(
  rows: AnalyticsInventoryRow[],
  _nowMs = Date.now(),
): AnalyticsInventorySummary {
  // Retained parameter for callers; inventory edits cannot establish acquisition.
  void _nowMs;

  return {
    ...summarizeInventoryValues(rows.map(trustedInventoryValue)),
    units: rows.reduce((sum, row) => sum + (Number(row.quantity ?? row.data?.quantity ?? 0) || 0), 0),
    skus: rows.length,
    addedLast30Days: null,
  };
}
