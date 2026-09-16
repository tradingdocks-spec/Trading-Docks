export type CostBasisCompleteness = "known" | "partial" | "unknown";

export type InventoryCostBasisLotInput = {
  quantity: number | string | null | undefined;
  unitCost?: number | string | null;
  totalCost?: number | string | null;
};

export type InventoryCostBasis = {
  quantity: number;
  knownQuantity: number;
  knownTotalCost: number | null;
  weightedAverageUnitCost: number | null;
  coverageRatio: number;
  completeness: CostBasisCompleteness;
  coverageLabel: string;
};

export type InventoryPositionFinancials = InventoryCostBasis & {
  marketValue: number | null;
  unrealizedGain: number | null;
};

export type SaleFinancialsInput = {
  grossSale: number | string | null | undefined;
  taxCollected?: number | string | null;
  discounts?: number | string | null;
  marketplaceFees?: number | string | null;
  paymentFees?: number | string | null;
  buyerShipping?: number | string | null;
  sellerShipping?: number | string | null;
  suppliesCost?: number | string | null;
  refunds?: number | string | null;
  otherExpenses?: number | string | null;
  allocatedCostBasis?: number | string | null;
  costBasisKnown?: boolean;
};

export type RealizedProfitResult = {
  sellerRevenue: number;
  netProceeds: number;
  allocatedCostBasis: number | null;
  realizedProfit: number | null;
  margin: number | null;
  roi: number | null;
  completeness: "known" | "cost_basis_missing" | "estimated";
  missingFields: string[];
};

export function resolveInventoryCostBasis(lots: InventoryCostBasisLotInput[]): InventoryCostBasis {
  let quantity = 0;
  let knownQuantity = 0;
  let knownTotalCost = 0;

  for (const lot of lots) {
    const lotQuantity = nonNegativeNumber(lot.quantity) ?? 0;
    quantity += lotQuantity;
    if (lotQuantity <= 0) continue;

    const totalCost = nonNegativeNumber(lot.totalCost);
    const unitCost = nonNegativeNumber(lot.unitCost);
    if (totalCost !== null) {
      knownQuantity += lotQuantity;
      knownTotalCost += totalCost;
    } else if (unitCost !== null) {
      knownQuantity += lotQuantity;
      knownTotalCost += unitCost * lotQuantity;
    }
  }

  const completeness: CostBasisCompleteness = knownQuantity === 0
    ? "unknown"
    : knownQuantity === quantity
      ? "known"
      : "partial";
  const knownTotal = knownQuantity > 0 ? roundMoney(knownTotalCost) : null;
  return {
    quantity,
    knownQuantity,
    knownTotalCost: knownTotal,
    weightedAverageUnitCost: knownQuantity > 0 ? roundMoney(knownTotalCost / knownQuantity) : null,
    coverageRatio: quantity > 0 ? knownQuantity / quantity : 0,
    completeness,
    coverageLabel: costCoverageLabel(knownQuantity, quantity),
  };
}

export function resolveInventoryPositionFinancials({
  lots,
  marketValue,
}: {
  lots: InventoryCostBasisLotInput[];
  marketValue: number | string | null | undefined;
}): InventoryPositionFinancials {
  const basis = resolveInventoryCostBasis(lots);
  const value = nonNegativeNumber(marketValue);
  return {
    ...basis,
    marketValue: value,
    unrealizedGain: value !== null && basis.knownTotalCost !== null
      ? roundMoney(value - basis.knownTotalCost)
      : null,
  };
}

export function calculateRealizedProfit(input: SaleFinancialsInput): RealizedProfitResult {
  const grossSale = moneyOrZero(input.grossSale);
  const taxCollected = moneyOrZero(input.taxCollected);
  const refunds = moneyOrZero(input.refunds);
  const discounts = moneyOrZero(input.discounts);
  const marketplaceFees = moneyOrZero(input.marketplaceFees);
  const paymentFees = moneyOrZero(input.paymentFees);
  const sellerShipping = moneyOrZero(input.sellerShipping);
  const suppliesCost = moneyOrZero(input.suppliesCost);
  const otherExpenses = moneyOrZero(input.otherExpenses);
  const sellerRevenue = Math.max(0, grossSale - taxCollected);
  const netProceeds = roundMoney(
    sellerRevenue -
    discounts -
    marketplaceFees -
    paymentFees -
    sellerShipping -
    suppliesCost -
    refunds -
    otherExpenses,
  );
  const allocatedCostBasis = nonNegativeNumber(input.allocatedCostBasis);
  const costBasisKnown = input.costBasisKnown ?? allocatedCostBasis !== null;
  const missingFields = costBasisKnown ? [] : ["allocatedCostBasis"];
  const realizedProfit = costBasisKnown && allocatedCostBasis !== null
    ? roundMoney(netProceeds - allocatedCostBasis)
    : null;

  return {
    sellerRevenue: roundMoney(sellerRevenue),
    netProceeds,
    allocatedCostBasis: costBasisKnown ? allocatedCostBasis : null,
    realizedProfit,
    margin: realizedProfit !== null && sellerRevenue > 0 ? realizedProfit / sellerRevenue : null,
    roi: realizedProfit !== null && allocatedCostBasis !== null && allocatedCostBasis > 0
      ? realizedProfit / allocatedCostBasis
      : null,
    completeness: costBasisKnown ? "known" : "cost_basis_missing",
    missingFields,
  };
}

export function costCoverageLabel(knownQuantity: number, quantity: number) {
  if (quantity <= 0) return "No inventory quantity";
  if (knownQuantity <= 0) return "Cost basis missing";
  if (knownQuantity === quantity) return "Cost basis known for all copies";
  return `Known cost basis for ${knownQuantity.toLocaleString()} of ${quantity.toLocaleString()} copies`;
}

export function nonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function moneyOrZero(value: unknown) {
  return nonNegativeNumber(value) ?? 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
