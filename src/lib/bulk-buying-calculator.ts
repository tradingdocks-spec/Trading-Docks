export type BulkRateBasis = "each" | "per100" | "per1000";

export type BulkOfferRow = {
  category: string;
  quantity: number | string | null | undefined;
  rate: number | string | null | undefined;
  basis: BulkRateBasis;
};

export type BulkAdjustment = {
  mode: "amount" | "percent";
  value: number | string | null | undefined;
  label?: string;
};

export type BulkOfferSummary = {
  totalCards: number;
  subtotal: number;
  adjustmentAmount: number;
  finalOffer: number;
  averagePerCard: number;
  categoryCount: number;
};

export type BulkRatePreset = {
  category: string;
  rate: number;
  basis: BulkRateBasis;
};

export const BULK_RATE_PRESETS: BulkRatePreset[] = [
  { category: "Commons / Uncommons", rate: 10, basis: "per1000" },
  { category: "Bulk Rares", rate: 0.1, basis: "each" },
  { category: "Bulk Mythics", rate: 0.25, basis: "each" },
  { category: "Basic Lands", rate: 4, basis: "per1000" },
  { category: "Foils", rate: 0.05, basis: "each" },
];

export function parseBulkNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeNonNegativeBulkValue(
  value: number | string | null | undefined,
) {
  return Math.max(0, parseBulkNumber(value));
}

export function calculateBulkRowOffer(row: BulkOfferRow) {
  const quantity = sanitizeNonNegativeBulkValue(row.quantity);
  const rate = sanitizeNonNegativeBulkValue(row.rate);

  if (quantity === 0 || rate === 0) {
    return 0;
  }

  if (row.basis === "per100") {
    return (quantity / 100) * rate;
  }

  if (row.basis === "per1000") {
    return (quantity / 1000) * rate;
  }

  return quantity * rate;
}

export function calculateBulkAdjustment(
  subtotal: number,
  adjustment?: BulkAdjustment,
) {
  if (!adjustment) {
    return 0;
  }

  const value = parseBulkNumber(adjustment.value);
  if (value === 0) {
    return 0;
  }

  if (adjustment.mode === "percent") {
    return subtotal * (value / 100);
  }

  return value;
}

export function summarizeBulkOffer(
  rows: BulkOfferRow[],
  adjustment?: BulkAdjustment,
): BulkOfferSummary {
  const subtotal = rows.reduce(
    (total, row) => total + calculateBulkRowOffer(row),
    0,
  );
  const totalCards = rows.reduce(
    (total, row) => total + sanitizeNonNegativeBulkValue(row.quantity),
    0,
  );
  const categoryCount = rows.filter(
    (row) => row.category.trim().length > 0 && calculateBulkRowOffer(row) > 0,
  ).length;
  const adjustmentAmount = calculateBulkAdjustment(subtotal, adjustment);
  const finalOffer = Math.max(0, subtotal + adjustmentAmount);

  return {
    totalCards,
    subtotal,
    adjustmentAmount,
    finalOffer,
    averagePerCard: totalCards > 0 ? finalOffer / totalCards : 0,
    categoryCount,
  };
}
