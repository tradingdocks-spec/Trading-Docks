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
  addedLast30Days: number;
};

export function summarizeAnalyticsInventory(
  rows: AnalyticsInventoryRow[],
  nowMs = Date.now(),
): AnalyticsInventorySummary {
  const recentThreshold = nowMs - 30 * 86_400_000;

  return rows.reduce<AnalyticsInventorySummary>(
    (summary, row) => {
      const quantity = Number(row.quantity ?? row.data?.quantity ?? 0) || 0;
      const storedValue = Number(row.inventory_value ?? row.data?.value ?? 0) || 0;
      summary.units += quantity;
      summary.value += storedValue;
      summary.skus += 1;

      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (updatedAt >= recentThreshold) summary.addedLast30Days += quantity;
      return summary;
    },
    { units: 0, value: 0, skus: 0, addedLast30Days: 0 },
  );
}
