export type ChaosSortRecognitionState = "high_confidence" | "review" | "unknown";

export type ChaosSortProcessingState = "pending" | "processing" | "ready" | "failed";

export type ChaosSortHumanState = "pending" | "confirmed" | "edited" | "unknown" | "removed";

export type ChaosSortPile =
  | "high_value"
  | "mid_value"
  | "bulk_rare"
  | "bulk_cu"
  | "foil"
  | "review"
  | "unknown";

export type ChaosSortRuleCriteria = {
  minMarket?: number;
  maxMarket?: number;
  rarityIn?: string[];
  finishIn?: string[];
  gameIdIn?: string[];
  setCodeIn?: string[];
  confidenceIn?: ChaosSortRecognitionState[];
  ownedStateIn?: Array<"new" | "owned">;
};

export type ChaosSortRule = {
  id: string;
  label: string;
  targetPile: ChaosSortPile;
  priority: number;
  pass: 1 | 2;
  enabled: boolean;
  criteria: ChaosSortRuleCriteria;
  description: string;
};

export type ChaosSortItem = {
  id: string;
  batchId: string;
  sourceFileName: string;
  sourceFileHash: string;
  sourceImageUrl: string | null;
  processingState: ChaosSortProcessingState;
  recognitionState: ChaosSortRecognitionState;
  humanState: ChaosSortHumanState;
  cardName: string;
  scryfallId: string | null;
  gameId: string;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  finish: string | null;
  condition: string | null;
  quantity: number;
  marketPrice: number | null;
  existingOwnedQuantity: number;
  destinationLocationId: string | null;
  destinationLabel: string;
  sortPile: ChaosSortPile;
  sortPass: 1 | 2;
  confidence: number;
  evidence: string[];
  notes: string;
  duplicateOfItemId: string | null;
  sortRuleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChaosSortBatch = {
  id: string;
  batchCode: string;
  title: string;
  status: "draft" | "review" | "sorting" | "committed" | "failed";
  sourceCount: number;
  duplicateCount: number;
  identifiedCount: number;
  confirmedCount: number;
  needsReviewCount: number;
  unknownCount: number;
  estimatedMarketValue: number;
  acquisitionCost: number | null;
  destinationLocationId: string | null;
  destinationLabel: string;
  createdAt: string;
  updatedAt: string;
  items: ChaosSortItem[];
  rules: ChaosSortRule[];
};

export type ChaosSortPileSummary = {
  pile: ChaosSortPile;
  label: string;
  count: number;
  marketValue: number;
  secondPassBuckets: Array<{ label: string; count: number }>;
};

export type ChaosSortBatchSummary = {
  totalImages: number;
  identified: number;
  confirmed: number;
  needsReview: number;
  unknown: number;
  estimatedMarketValue: number;
  existingInventoryMatches: number;
  newInventoryPositions: number;
  duplicateInventoryPositions: number;
};

export type ChaosSortPlanItem = {
  itemId: string;
  pile: ChaosSortPile;
  pass: 1 | 2;
  label: string;
  secondPassLabel: string | null;
  ruleId: string | null;
  marketValue: number;
};

export type ChaosSortPlan = {
  items: ChaosSortPlanItem[];
  piles: ChaosSortPileSummary[];
};

const DEFAULT_RULES: ChaosSortRule[] = [
  {
    id: "review",
    label: "Review",
    targetPile: "review",
    priority: 0,
    pass: 1,
    enabled: true,
    criteria: { confidenceIn: ["review", "unknown"] },
    description: "Cards that need human verification stay out of the physical sort until they are confirmed.",
  },
  {
    id: "foil",
    label: "Foil",
    targetPile: "foil",
    priority: 100,
    pass: 1,
    enabled: true,
    criteria: { finishIn: ["foil", "etched", "showcase", "borderless", "extended art", "extended_art"] },
    description: "Foils and premium treatments are routed into the premium pile first.",
  },
  {
    id: "high-value",
    label: "High Value",
    targetPile: "high_value",
    priority: 200,
    pass: 1,
    enabled: true,
    criteria: { minMarket: 5 },
    description: "Cards at or above the high-value threshold go into the first pile.",
  },
  {
    id: "mid-value",
    label: "Mid Value",
    targetPile: "mid_value",
    priority: 300,
    pass: 1,
    enabled: true,
    criteria: { minMarket: 1, maxMarket: 4.99 },
    description: "Cards between one and five dollars move to the mid-value pile.",
  },
  {
    id: "bulk-rare",
    label: "Bulk Rare",
    targetPile: "bulk_rare",
    priority: 400,
    pass: 1,
    enabled: true,
    criteria: { maxMarket: 0.99, rarityIn: ["rare", "mythic"] },
    description: "Low-value rares and mythics are separated before general bulk.",
  },
  {
    id: "bulk-cu",
    label: "Bulk C/U",
    targetPile: "bulk_cu",
    priority: 500,
    pass: 1,
    enabled: true,
    criteria: { maxMarket: 0.99, rarityIn: ["common", "uncommon"] },
    description: "Low-value commons and uncommons go into the main bulk pile.",
  },
  {
    id: "unknown",
    label: "Unknown",
    targetPile: "unknown",
    priority: 900,
    pass: 1,
    enabled: true,
    criteria: { confidenceIn: ["unknown"] },
    description: "Anything without enough evidence stays isolated.",
  },
];

export function buildDefaultChaosSortRules(): ChaosSortRule[] {
  return DEFAULT_RULES.map((rule) => ({
    ...rule,
    criteria: {
      ...rule.criteria,
      rarityIn: rule.criteria.rarityIn ? [...rule.criteria.rarityIn] : undefined,
      finishIn: rule.criteria.finishIn ? [...rule.criteria.finishIn] : undefined,
      gameIdIn: rule.criteria.gameIdIn ? [...rule.criteria.gameIdIn] : undefined,
      setCodeIn: rule.criteria.setCodeIn ? [...rule.criteria.setCodeIn] : undefined,
      confidenceIn: rule.criteria.confidenceIn ? [...rule.criteria.confidenceIn] : undefined,
      ownedStateIn: rule.criteria.ownedStateIn ? [...rule.criteria.ownedStateIn] : undefined,
    },
  }));
}

export function createChaosSortBatchCode(sequence: number) {
  return `CS-${String(Math.max(0, Math.floor(sequence))).padStart(6, "0")}`;
}

export function classifyChaosSortRecognition(input: {
  processingState: ChaosSortProcessingState;
  confidence: number;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
}) {
  if (input.processingState === "failed") return "unknown" as const;
  if (input.processingState !== "ready") return "review" as const;
  if (!input.cardName.trim()) return "unknown" as const;
  if (input.confidence >= 0.8 && input.setCode && input.collectorNumber) return "high_confidence" as const;
  if (input.confidence >= 0.45) return "review" as const;
  return "unknown" as const;
}

export function makeChaosSortFileHash(file: File): Promise<string> {
  return file.arrayBuffer().then(async (buffer) => {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  });
}

export function chaosSortItemKey(item: ChaosSortItem) {
  return [
    item.gameId,
    item.cardName.trim().toLowerCase(),
    item.setCode?.trim().toLowerCase() ?? "",
    item.collectorNumber?.trim().toLowerCase() ?? "",
    item.finish?.trim().toLowerCase() ?? "",
    item.condition?.trim().toLowerCase() ?? "",
  ].join("|");
}

export function buildChaosSortPlan(items: ChaosSortItem[], rules = buildDefaultChaosSortRules()): ChaosSortPlan {
  const filteredRules = [...rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));

  const planItems = items.map((item) => {
    const rule = filteredRules.find((candidate) => matchesChaosSortRule(item, candidate)) ?? null;
    const pile = rule?.targetPile ?? fallbackPileForItem(item);
    const pass: 1 | 2 = pile === "review" || pile === "unknown" ? 1 : 1;
    return {
      itemId: item.id,
      pile,
      pass,
      label: pileLabel(pile),
      secondPassLabel: secondPassLabelForItem(item, pile),
      ruleId: rule?.id ?? null,
      marketValue: item.marketPrice ?? 0,
    } satisfies ChaosSortPlanItem;
  });

  const piles = summarizePlanPiles(planItems);
  return { items: planItems, piles };
}

export function summarizeChaosSortBatch(batch: ChaosSortBatch): ChaosSortBatchSummary {
  const identified = batch.items.filter((item) => item.recognitionState !== "unknown").length;
  const confirmed = batch.items.filter((item) => item.humanState === "confirmed").length;
  const needsReview = batch.items.filter((item) => item.recognitionState === "review" || item.humanState === "pending").length;
  const unknown = batch.items.filter((item) => item.recognitionState === "unknown").length;
  const estimatedMarketValue = roundMoney(batch.items.reduce((sum, item) => sum + (item.marketPrice ?? 0) * item.quantity, 0));
  const existingInventoryMatches = batch.items.filter((item) => item.existingOwnedQuantity > 0).length;
  const newInventoryPositions = batch.items.filter((item) => item.existingOwnedQuantity <= 0 && item.humanState !== "removed").length;
  const duplicateInventoryPositions = batch.items.filter((item) => item.duplicateOfItemId !== null).length;

  return {
    totalImages: batch.items.length,
    identified,
    confirmed,
    needsReview,
    unknown,
    estimatedMarketValue,
    existingInventoryMatches,
    newInventoryPositions,
    duplicateInventoryPositions,
  };
}

export function matchesChaosSortRule(item: ChaosSortItem, rule: ChaosSortRule) {
  const { criteria } = rule;
  if (criteria.minMarket !== undefined && (item.marketPrice ?? -Infinity) < criteria.minMarket) return false;
  if (criteria.maxMarket !== undefined && (item.marketPrice ?? Infinity) > criteria.maxMarket) return false;
  if (criteria.rarityIn && criteria.rarityIn.length > 0 && !criteria.rarityIn.includes((item.rarity ?? "").toLowerCase())) return false;
  if (criteria.finishIn && criteria.finishIn.length > 0 && !criteria.finishIn.includes((item.finish ?? "").toLowerCase())) return false;
  if (criteria.gameIdIn && criteria.gameIdIn.length > 0 && !criteria.gameIdIn.includes(item.gameId.toLowerCase())) return false;
  if (criteria.setCodeIn && criteria.setCodeIn.length > 0) {
    const normalizedSet = item.setCode?.toLowerCase() ?? "";
    if (!criteria.setCodeIn.map((value) => value.toLowerCase()).includes(normalizedSet)) return false;
  }
  if (criteria.confidenceIn && criteria.confidenceIn.length > 0 && !criteria.confidenceIn.includes(item.recognitionState)) return false;
  if (criteria.ownedStateIn && criteria.ownedStateIn.length > 0) {
    const ownedState = item.existingOwnedQuantity > 0 ? "owned" : "new";
    if (!criteria.ownedStateIn.includes(ownedState)) return false;
  }
  return true;
}

function fallbackPileForItem(item: ChaosSortItem): ChaosSortPile {
  if (item.recognitionState === "unknown") return "unknown";
  const market = item.marketPrice ?? 0;
  if ((item.finish ?? "").toLowerCase() === "foil" || (item.finish ?? "").toLowerCase() === "etched") return "foil";
  if (market >= 5) return "high_value";
  if (market >= 1) return "mid_value";
  if (["rare", "mythic"].includes((item.rarity ?? "").toLowerCase())) return "bulk_rare";
  return "bulk_cu";
}

function secondPassLabelForItem(item: ChaosSortItem, pile: ChaosSortPile) {
  if (pile === "review" || pile === "unknown") return null;
  if (item.setCode) return `SET ${item.setCode}`;
  if (item.destinationLocationId) return item.destinationLabel;
  return null;
}

function summarizePlanPiles(items: ChaosSortPlanItem[]): ChaosSortPileSummary[] {
  const pileOrder: ChaosSortPile[] = ["high_value", "mid_value", "bulk_rare", "bulk_cu", "foil", "review", "unknown"];
  return pileOrder.map((pile) => {
    const pileItems = items.filter((item) => item.pile === pile);
    const buckets = new Map<string, number>();
    for (const item of pileItems) {
      const label = item.secondPassLabel ?? "Direct sort";
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }
    return {
      pile,
      label: pileLabel(pile),
      count: pileItems.length,
      marketValue: roundMoney(pileItems.reduce((sum, item) => sum + item.marketValue * 1, 0)),
      secondPassBuckets: [...buckets.entries()].map(([label, count]) => ({ label, count })),
    };
  }).filter((pile) => pile.count > 0);
}

function pileLabel(pile: ChaosSortPile) {
  switch (pile) {
    case "high_value":
      return "High Value";
    case "mid_value":
      return "Mid Value";
    case "bulk_rare":
      return "Bulk Rare";
    case "bulk_cu":
      return "Bulk C/U";
    case "foil":
      return "Foil";
    case "review":
      return "Review";
    case "unknown":
      return "Unknown";
    default:
      return pile;
  }
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}
