export type AnalyticsInventoryRow = {
  quantity: number | null;
  inventory_value: number | null;
  data: Record<string, unknown> | null;
  updated_at: string | null;
};

export type AnalyticsInventorySummary = {
  units: number;
  value: number;
  skus: number;
  addedLast30Days: null;
};

export function summarizeAnalyticsInventory(
  rows: AnalyticsInventoryRow[],
  _nowMs = Date.now(),
): AnalyticsInventorySummary {
  // Retained parameter for callers; inventory edits cannot establish acquisition.
  void _nowMs;

  return rows.reduce<AnalyticsInventorySummary>(
    (summary, row) => {
      const quantity = Number(row.quantity ?? row.data?.quantity ?? 0) || 0;
      const storedValue = Number(row.inventory_value ?? row.data?.value ?? 0) || 0;
      summary.units += quantity;
      summary.value += storedValue;
      summary.skus += 1;

      return summary;
    },
    { units: 0, value: 0, skus: 0, addedLast30Days: null },
  );
}
