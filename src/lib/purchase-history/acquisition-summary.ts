export type AcquisitionRow = {
  id: string; status: string; purchased_at: string | null; received_at: string | null;
  total_cost: number | string | null; unit_count: number | null;
};
export type AcquisitionSummary = {
  status: "CALCULATED" | "INSUFFICIENT_DATA";
  purchasedUnits: number; acquisitionCost: number | null; receivedUnits: number;
  purchaseCount: number; unattributedCount: number; observedAt: string;
};

/** Financial commitments and physical receipts are separate cohorts. Row edits
 * and market valuations are deliberately not inputs to this calculation. */
export function summarizeFinancialAcquisitions(rows: AcquisitionRow[], now = new Date()): AcquisitionSummary {
  const start = now.getTime() - 30 * 86_400_000;
  const inPeriod = (date: string | null) => date !== null && Date.parse(date) >= start && Date.parse(date) <= now.getTime();
  let purchasedUnits = 0, costMinor = 0, receivedUnits = 0, purchaseCount = 0, unattributedCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!["completed", "received"].includes(row.status)) continue;
    if (!row.purchased_at || !Number.isFinite(Date.parse(row.purchased_at))) { unattributedCount++; continue; }
    if (inPeriod(row.purchased_at)) {
      const cost = row.total_cost === null ? NaN : Number(row.total_cost);
      if (!Number.isFinite(cost) || cost < 0 || !Number.isInteger(row.unit_count) || (row.unit_count ?? -1) < 0) { unattributedCount++; continue; }
      purchaseCount++; purchasedUnits += row.unit_count!; costMinor += Math.round(cost * 100);
    }
    if (row.status === "received" && inPeriod(row.received_at) && Number.isInteger(row.unit_count) && (row.unit_count ?? -1) >= 0) receivedUnits += row.unit_count!;
  }
  return { status: unattributedCount ? "INSUFFICIENT_DATA" : "CALCULATED", purchasedUnits,
    acquisitionCost: unattributedCount ? null : costMinor / 100, receivedUnits, purchaseCount, unattributedCount, observedAt: now.toISOString() };
}
