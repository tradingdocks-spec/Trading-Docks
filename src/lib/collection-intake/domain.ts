export type CollectionIntakeStatus =
  | "draft"
  | "evaluating"
  | "offer_ready"
  | "purchased"
  | "declined"
  | "archived";

export type CollectionIntakeItemReviewState =
  | "ready"
  | "unresolved_identity"
  | "ambiguous_printing"
  | "unknown_condition"
  | "unknown_finish"
  | "missing_price"
  | "high_value_confirmation";

export type CollectionIntakeScenarioKey =
  | "conservative"
  | "standard"
  | "aggressive"
  | "custom";

export type CollectionIntakeItem = {
  id: string;
  cardName: string;
  gameId: string;
  productType: "card" | "sealed" | "bulk";
  setCode: string | null;
  collectorNumber: string | null;
  scryfallId: string | null;
  tcgplayerProductId: number | null;
  tcgplayerSkuId: number | null;
  condition: string | null;
  finish: string | null;
  language: string;
  quantity: number;
  unitMarketValue: number | null;
  reviewState: CollectionIntakeItemReviewState;
  notes: string;
};

export type CollectionIntake = {
  id: string;
  status: CollectionIntakeStatus;
  title: string;
  sellerName: string;
  sellerContact: string;
  scenarioKey: CollectionIntakeScenarioKey;
  customScenario?: Partial<CollectionOfferScenario>;
  actualOffer: number | null;
  items: CollectionIntakeItem[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionOfferScenario = {
  key: CollectionIntakeScenarioKey;
  label: string;
  realizationPercent: number;
  sellingCostPercent: number;
  perItemCost: number;
  desiredProfitPercent: number;
  bulkDiscountPercent: number;
};

export type CollectionValueTier = {
  key: "high" | "mid" | "low" | "bulk" | "unpriced";
  label: string;
  quantity: number;
  marketValue: number;
  shareOfMarketValue: number;
};

export type CollectionReviewCounts = Record<CollectionIntakeItemReviewState, number>;

export type CollectionValuation = {
  totalQuantity: number;
  uniqueLines: number;
  marketValue: number;
  sellableValue: number;
  sellingCosts: number;
  desiredProfit: number;
  calculatedMaxOffer: number;
  actualOffer: number;
  expectedProfit: number;
  roiPercent: number | null;
  marginPercent: number | null;
  offerPercentOfMarket: number | null;
  pricedQuantity: number;
  unpricedQuantity: number;
  pricingCoveragePercent: number;
  topCardSharePercent: number;
  lowValueSharePercent: number;
  tiers: CollectionValueTier[];
  reviewCounts: CollectionReviewCounts;
  blockingReviewCount: number;
  warningReviewCount: number;
};

export type CollectionPurchaseAllocation = {
  itemId: string;
  quantity: number;
  unitMarketValue: number | null;
  allocatedTotalCost: number;
  allocatedUnitCost: number;
};

export type CollectionPurchase = {
  intakeId: string;
  purchaseId: string;
  totalPaid: number;
  allocations: CollectionPurchaseAllocation[];
  roundingAdjustment: number;
};

export const COLLECTION_INTAKE_SCENARIOS: Record<Exclude<CollectionIntakeScenarioKey, "custom">, CollectionOfferScenario> = {
  conservative: {
    key: "conservative",
    label: "Conservative",
    realizationPercent: 62,
    sellingCostPercent: 16,
    perItemCost: 0.45,
    desiredProfitPercent: 30,
    bulkDiscountPercent: 12,
  },
  standard: {
    key: "standard",
    label: "Standard",
    realizationPercent: 72,
    sellingCostPercent: 13,
    perItemCost: 0.32,
    desiredProfitPercent: 24,
    bulkDiscountPercent: 7,
  },
  aggressive: {
    key: "aggressive",
    label: "Aggressive",
    realizationPercent: 82,
    sellingCostPercent: 11,
    perItemCost: 0.2,
    desiredProfitPercent: 18,
    bulkDiscountPercent: 3,
  },
};

const REVIEW_STATES: CollectionIntakeItemReviewState[] = [
  "ready",
  "unresolved_identity",
  "ambiguous_printing",
  "unknown_condition",
  "unknown_finish",
  "missing_price",
  "high_value_confirmation",
];

const BLOCKING_STATES = new Set<CollectionIntakeItemReviewState>([
  "unresolved_identity",
  "ambiguous_printing",
  "unknown_condition",
  "unknown_finish",
  "high_value_confirmation",
]);

const WARNING_STATES = new Set<CollectionIntakeItemReviewState>(["missing_price"]);

export function normalizeMoney(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100) / 100) : 0;
}

export function normalizeNullableMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = normalizeMoney(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeQuantity(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function normalizeScenario(
  key: CollectionIntakeScenarioKey,
  custom?: Partial<CollectionOfferScenario>,
): CollectionOfferScenario {
  if (key !== "custom") return COLLECTION_INTAKE_SCENARIOS[key];
  return {
    ...COLLECTION_INTAKE_SCENARIOS.standard,
    ...custom,
    key: "custom",
    label: custom?.label?.trim() || "Custom",
    realizationPercent: normalizeBoundedPercent(custom?.realizationPercent, 0, 100, 72),
    sellingCostPercent: normalizeBoundedPercent(custom?.sellingCostPercent, 0, 100, 13),
    desiredProfitPercent: normalizeBoundedPercent(custom?.desiredProfitPercent, 0, 100, 24),
    bulkDiscountPercent: normalizeBoundedPercent(custom?.bulkDiscountPercent, 0, 100, 7),
    perItemCost: normalizeMoney(custom?.perItemCost),
  };
}

export function inferReviewState(item: Partial<CollectionIntakeItem>): CollectionIntakeItemReviewState {
  if (!item.cardName?.trim()) return "unresolved_identity";
  if (!item.setCode && !item.collectorNumber && !item.scryfallId && !item.tcgplayerProductId) return "ambiguous_printing";
  if (!item.condition?.trim() && item.productType !== "bulk") return "unknown_condition";
  if (!item.finish?.trim() && item.productType !== "bulk") return "unknown_finish";
  const marketValue = normalizeNullableMoney(item.unitMarketValue);
  if (marketValue === null || marketValue <= 0) return "missing_price";
  if (marketValue >= 100) return "high_value_confirmation";
  return "ready";
}

export function calculateCollectionValuation({
  items,
  scenario,
  actualOffer,
}: {
  items: CollectionIntakeItem[];
  scenario: CollectionOfferScenario;
  actualOffer?: number | null;
}): CollectionValuation {
  const normalizedItems = items.map((item) => ({
    ...item,
    quantity: normalizeQuantity(item.quantity),
    unitMarketValue: normalizeNullableMoney(item.unitMarketValue),
  }));
  const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const marketValue = roundMoney(normalizedItems.reduce(
    (sum, item) => sum + (item.unitMarketValue ?? 0) * item.quantity,
    0,
  ));
  const pricedQuantity = normalizedItems.reduce(
    (sum, item) => sum + ((item.unitMarketValue ?? 0) > 0 ? item.quantity : 0),
    0,
  );
  const unpricedQuantity = Math.max(0, totalQuantity - pricedQuantity);
  const effectiveMarketValue = roundMoney(marketValue * (1 - scenario.bulkDiscountPercent / 100));
  const sellableValue = roundMoney(effectiveMarketValue * (scenario.realizationPercent / 100));
  const sellingCosts = roundMoney(sellableValue * (scenario.sellingCostPercent / 100) + totalQuantity * scenario.perItemCost);
  const desiredProfit = roundMoney(sellableValue * (scenario.desiredProfitPercent / 100));
  const calculatedMaxOffer = Math.max(0, roundMoney(sellableValue - sellingCosts - desiredProfit));
  const normalizedOffer = actualOffer === null || actualOffer === undefined
    ? calculatedMaxOffer
    : normalizeMoney(actualOffer);
  const expectedProfit = roundMoney(sellableValue - sellingCosts - normalizedOffer);

  const reviewCounts = REVIEW_STATES.reduce((counts, state) => {
    counts[state] = 0;
    return counts;
  }, {} as CollectionReviewCounts);
  for (const item of normalizedItems) {
    reviewCounts[item.reviewState] = (reviewCounts[item.reviewState] ?? 0) + 1;
  }

  const tiers = buildValueTiers(normalizedItems, marketValue);
  const topLineValue = normalizedItems.reduce((max, item) => Math.max(max, (item.unitMarketValue ?? 0) * item.quantity), 0);
  const lowValue = tiers.find((tier) => tier.key === "low")?.marketValue ?? 0;
  const bulkValue = tiers.find((tier) => tier.key === "bulk")?.marketValue ?? 0;

  return {
    totalQuantity,
    uniqueLines: normalizedItems.length,
    marketValue,
    sellableValue,
    sellingCosts,
    desiredProfit,
    calculatedMaxOffer,
    actualOffer: normalizedOffer,
    expectedProfit,
    roiPercent: normalizedOffer > 0 ? roundPercent((expectedProfit / normalizedOffer) * 100) : null,
    marginPercent: sellableValue > 0 ? roundPercent((expectedProfit / sellableValue) * 100) : null,
    offerPercentOfMarket: marketValue > 0 ? roundPercent((normalizedOffer / marketValue) * 100) : null,
    pricedQuantity,
    unpricedQuantity,
    pricingCoveragePercent: totalQuantity > 0 ? roundPercent((pricedQuantity / totalQuantity) * 100) : 0,
    topCardSharePercent: marketValue > 0 ? roundPercent((topLineValue / marketValue) * 100) : 0,
    lowValueSharePercent: marketValue > 0 ? roundPercent(((lowValue + bulkValue) / marketValue) * 100) : 0,
    tiers,
    reviewCounts,
    blockingReviewCount: countStates(reviewCounts, BLOCKING_STATES),
    warningReviewCount: countStates(reviewCounts, WARNING_STATES),
  };
}

export function allocateCollectionPurchaseCost(
  items: CollectionIntakeItem[],
  totalPaid: number,
): CollectionPurchaseAllocation[] {
  const paid = normalizeMoney(totalPaid);
  const marketTotal = items.reduce(
    (sum, item) => sum + (normalizeNullableMoney(item.unitMarketValue) ?? 0) * normalizeQuantity(item.quantity),
    0,
  );
  if (paid === 0 || marketTotal <= 0) {
    return items.map((item) => ({
      itemId: item.id,
      quantity: normalizeQuantity(item.quantity),
      unitMarketValue: normalizeNullableMoney(item.unitMarketValue),
      allocatedTotalCost: 0,
      allocatedUnitCost: 0,
    }));
  }

  let allocatedSoFar = 0;
  return items.map((item, index) => {
    const quantity = normalizeQuantity(item.quantity);
    const lineValue = (normalizeNullableMoney(item.unitMarketValue) ?? 0) * quantity;
    const allocatedTotalCost = index === items.length - 1
      ? roundMoney(paid - allocatedSoFar)
      : roundMoney(paid * (lineValue / marketTotal));
    allocatedSoFar = roundMoney(allocatedSoFar + allocatedTotalCost);
    return {
      itemId: item.id,
      quantity,
      unitMarketValue: normalizeNullableMoney(item.unitMarketValue),
      allocatedTotalCost,
      allocatedUnitCost: quantity > 0 ? roundMoney(allocatedTotalCost / quantity) : 0,
    };
  });
}

function buildValueTiers(
  items: Array<CollectionIntakeItem & { unitMarketValue: number | null; quantity: number }>,
  marketValue: number,
): CollectionValueTier[] {
  const tiers: CollectionValueTier[] = [
    { key: "high", label: "$25+ review cards", quantity: 0, marketValue: 0, shareOfMarketValue: 0 },
    { key: "mid", label: "$5-$24.99 singles", quantity: 0, marketValue: 0, shareOfMarketValue: 0 },
    { key: "low", label: "$1-$4.99 singles", quantity: 0, marketValue: 0, shareOfMarketValue: 0 },
    { key: "bulk", label: "Under $1 / bulk", quantity: 0, marketValue: 0, shareOfMarketValue: 0 },
    { key: "unpriced", label: "Needs pricing", quantity: 0, marketValue: 0, shareOfMarketValue: 0 },
  ];
  for (const item of items) {
    const unit = item.unitMarketValue;
    const tier = unit === null || unit <= 0
      ? tiers[4]
      : unit >= 25
        ? tiers[0]
        : unit >= 5
          ? tiers[1]
          : unit >= 1
            ? tiers[2]
            : tiers[3];
    tier.quantity += item.quantity;
    tier.marketValue = roundMoney(tier.marketValue + (unit ?? 0) * item.quantity);
  }
  return tiers.map((tier) => ({
    ...tier,
    shareOfMarketValue: marketValue > 0 ? roundPercent((tier.marketValue / marketValue) * 100) : 0,
  }));
}

function countStates(counts: CollectionReviewCounts, states: Set<CollectionIntakeItemReviewState>) {
  return Object.entries(counts).reduce(
    (sum, [state, count]) => sum + (states.has(state as CollectionIntakeItemReviewState) ? count : 0),
    0,
  );
}

function normalizeBoundedPercent(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}
