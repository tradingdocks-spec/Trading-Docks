export type InventoryAttentionType =
  | "missing_price"
  | "missing_cost_basis"
  | "missing_storage_location"
  | "unknown_condition"
  | "unknown_finish"
  | "inventory_setup_required";

export type InventoryAttentionSeverity = "high" | "medium" | "low";

export type InventoryAttentionEntityType = "inventory_item" | "inventory";

export type InventoryAttentionItem = {
  id: string;
  type: InventoryAttentionType;
  severity: InventoryAttentionSeverity;
  title: string;
  description: string;
  reason: string;
  entityType: InventoryAttentionEntityType;
  entityId: string | null;
  inventoryItemId: string | null;
  cardId: string | null;
  itemName: string;
  quantity: number;
  value: number | null;
  metadata: Record<string, string | number | boolean | null>;
  recommendedAction: string;
  actionHref: string;
  createdAt: string;
  source: "inventory_items";
};

export type InventoryAttentionGroup = {
  type: InventoryAttentionType;
  severity: InventoryAttentionSeverity;
  title: string;
  description: string;
  reason: string;
  count: number;
  quantity: number;
  value: number | null;
  recommendedAction: string;
  actionHref: string;
  representativeItems: InventoryAttentionItem[];
};

export type InventoryAttentionSummary = {
  userId: string;
  workspaceId: string | null;
  totalInventoryRows: number;
  sampledRows: number;
  sampledQuantity: number;
  knownMarketValue: number | null;
  knownPriceRows: number;
  missingPriceRows: number;
  missingCostBasisRows: number;
  unassignedRows: number;
  unknownConditionRows: number;
  unknownFinishRows: number;
  storageCoveragePercent: number;
  priceCoveragePercent: number;
  totalIssues: number;
  highPriorityIssues: number;
  categoryCounts: {
    pricing: number;
    financials: number;
    organization: number;
    dataQuality: number;
    setup: number;
  };
  groups: InventoryAttentionGroup[];
  topActions: InventoryAttentionGroup[];
  generatedAt: string;
  sampleLimited: boolean;
};

export type InventoryAttentionRow = {
  id?: string | null;
  card_name?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  inventory_value?: number | string | null;
  location_id?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
};

type QueryBuilder<T> = PromiseLike<{ data: T[] | null; count?: number | null; error?: { message?: string } | null }> & {
  eq: (column: string, value: string) => QueryBuilder<T>;
  is: (column: string, value: null) => QueryBuilder<T>;
  or: (filters: string) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
};

export type InventoryAttentionSupabaseClient = {
  from: <T = Record<string, unknown>>(table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder<T>;
  };
};

export const INVENTORY_ATTENTION_SAMPLE_SIZE = 500;
export const INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT = 5;

export type InventoryAttentionExactCounts = {
  missingPriceRows: number;
  missingCostBasisRows: number;
  unassignedRows: number;
  unknownConditionRows: number;
  unknownFinishRows: number;
};

export async function loadInventoryAttentionSummary({
  supabase,
  userId,
  workspaceId = null,
  now = new Date(),
  sampleSize = INVENTORY_ATTENTION_SAMPLE_SIZE,
}: {
  supabase: InventoryAttentionSupabaseClient;
  userId: string;
  workspaceId?: string | null;
  now?: Date;
  sampleSize?: number;
}) {
  const boundedSample = Math.max(1, Math.min(sampleSize, INVENTORY_ATTENTION_SAMPLE_SIZE));
  const [totalResult, countsResult, rowsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    loadExactIssueCounts(supabase, userId),
    supabase
      .from<InventoryAttentionRow>("inventory_items")
      .select("id,card_name,sku,quantity,inventory_value,location_id,scryfall_id,set_code,collector_number,updated_at,data")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(boundedSample),
  ]);

  const total = await totalResult;
  const rows = await rowsResult;
  if (total.error) throw new Error(`Inventory attention count failed: ${total.error.message ?? "Unknown Supabase error"}`);
  if (rows.error) throw new Error(`Inventory attention inventory failed: ${rows.error.message ?? "Unknown Supabase error"}`);

  return buildInventoryAttentionSummary({
    userId,
    workspaceId,
    rows: rows.data ?? [],
    totalInventoryRows: total.count ?? (rows.data ?? []).length,
    exactCounts: countsResult,
    now,
  });
}

export function buildInventoryAttentionSummary({
  userId,
  workspaceId = null,
  rows,
  totalInventoryRows = rows.length,
  exactCounts,
  now = new Date(),
}: {
  userId: string;
  workspaceId?: string | null;
  rows: InventoryAttentionRow[];
  totalInventoryRows?: number;
  exactCounts?: InventoryAttentionExactCounts;
  now?: Date;
}): InventoryAttentionSummary {
  let sampledQuantity = 0;
  let knownMarketValue = 0;
  let knownPriceRows = 0;
  let missingPriceRows = 0;
  let missingCostBasisRows = 0;
  let unassignedRows = 0;
  let unknownConditionRows = 0;
  let unknownFinishRows = 0;
  const items: InventoryAttentionItem[] = [];
  const createdAt = now.toISOString();

  if (totalInventoryRows === 0) {
    items.push(setupItem({ createdAt }));
  }

  for (const row of rows) {
    const payload = recordValue(row.data);
    const quantity = positiveNumber(row.quantity) ?? positiveNumber(payload.quantity) ?? 0;
    const value = positiveNumber(row.inventory_value) ?? positiveNumber(payload.value) ?? null;
    const costBasis = knownCostBasisValue(payload);
    const locationId = stringValue(row.location_id) ?? stringValue(payload.locationId);
    const condition = payload.condition;
    const finish = payload.finish ?? payload.variant ?? payload.treatment ?? row.data?.finish;
    const itemName = stringValue(payload.name) ?? stringValue(row.card_name) ?? "Unnamed inventory item";
    const itemId = stringValue(row.id);
    const base = {
      row,
      itemId,
      itemName,
      quantity,
      value,
      createdAt,
    };

    sampledQuantity += quantity;
    if (value !== null) {
      knownMarketValue += value;
      knownPriceRows += 1;
    } else {
      missingPriceRows += 1;
      items.push(issueItem({ ...base, type: "missing_price" }));
    }

    if (costBasis === null) {
      missingCostBasisRows += 1;
      items.push(issueItem({ ...base, type: "missing_cost_basis" }));
    }

    if (!locationId) {
      unassignedRows += 1;
      items.push(issueItem({ ...base, type: "missing_storage_location" }));
    }

    if (isUnknownValue(condition)) {
      unknownConditionRows += 1;
      items.push(issueItem({ ...base, type: "unknown_condition" }));
    }

    if (isUnknownValue(finish)) {
      unknownFinishRows += 1;
      items.push(issueItem({ ...base, type: "unknown_finish" }));
    }
  }

  const sampledRows = rows.length;
  const counts = exactCounts ?? {
    missingPriceRows,
    missingCostBasisRows,
    unassignedRows,
    unknownConditionRows,
    unknownFinishRows,
  };
  const groups = withExactGroupCounts(groupAttentionItems(items), counts);
  const highPriorityIssues = groups
    .filter((group) => group.severity === "high")
    .reduce((sum, group) => sum + group.count, 0);

  return {
    userId,
    workspaceId,
    totalInventoryRows,
    sampledRows,
    sampledQuantity,
    knownMarketValue: knownPriceRows > 0 ? knownMarketValue : null,
    knownPriceRows,
    missingPriceRows: counts.missingPriceRows,
    missingCostBasisRows: counts.missingCostBasisRows,
    unassignedRows: counts.unassignedRows,
    unknownConditionRows: counts.unknownConditionRows,
    unknownFinishRows: counts.unknownFinishRows,
    storageCoveragePercent: totalInventoryRows > 0 ? ((totalInventoryRows - counts.unassignedRows) / totalInventoryRows) * 100 : 0,
    priceCoveragePercent: totalInventoryRows > 0 ? ((totalInventoryRows - counts.missingPriceRows) / totalInventoryRows) * 100 : 0,
    totalIssues: groups.reduce((sum, group) => sum + group.count, 0),
    highPriorityIssues,
    categoryCounts: {
      pricing: countType(groups, "missing_price"),
      financials: countType(groups, "missing_cost_basis"),
      organization: countType(groups, "missing_storage_location"),
      dataQuality: countType(groups, "unknown_condition") + countType(groups, "unknown_finish"),
      setup: countType(groups, "inventory_setup_required"),
    },
    groups,
    topActions: groups.slice(0, 3),
    generatedAt: createdAt,
    sampleLimited: totalInventoryRows > sampledRows,
  };
}

async function loadExactIssueCounts(
  supabase: InventoryAttentionSupabaseClient,
  userId: string,
): Promise<InventoryAttentionExactCounts> {
  const countQuery = (label: string, query: QueryBuilder<unknown>) => Promise.resolve(query).then((result) => {
    if (result.error) throw new Error(`Inventory attention ${label} count failed: ${result.error.message ?? "Unknown Supabase error"}`);
    return result.count ?? 0;
  });

  const [missingPriceRows, missingCostBasisRows, unassignedRows, unknownConditionRows, unknownFinishRows] = await Promise.all([
    countQuery(
      "missing price",
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("and(or(inventory_value.is.null,inventory_value.eq.0),or(data->>value.is.null,data->>value.eq.0,data->>value.eq.))"),
    ),
    countQuery(
      "missing cost basis",
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("and(data->>unitCost.is.null,data->>costBasis.is.null,data->>purchasePrice.is.null,data->>totalCost.is.null,data->>totalCostBasis.is.null)"),
    ),
    countQuery(
      "missing storage",
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("and(location_id.is.null,data->>locationId.is.null)"),
    ),
    countQuery(
      "unknown condition",
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("data->>condition.is.null,data->>condition.eq.unknown,data->>condition.eq.n/a,data->>condition.eq."),
    ),
    countQuery(
      "unknown finish",
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .or("and(or(data->>finish.is.null,data->>finish.eq.unknown,data->>finish.eq.n/a,data->>finish.eq.),or(data->>variant.is.null,data->>variant.eq.unknown,data->>variant.eq.n/a,data->>variant.eq.),or(data->>treatment.is.null,data->>treatment.eq.unknown,data->>treatment.eq.n/a,data->>treatment.eq.))"),
    ),
  ]);

  return {
    missingPriceRows,
    missingCostBasisRows,
    unassignedRows,
    unknownConditionRows,
    unknownFinishRows,
  };
}

export function inventoryAttentionHref(type: InventoryAttentionType) {
  switch (type) {
    case "missing_price":
      return "/dashboard/inventory?attention=missing_price";
    case "missing_cost_basis":
      return "/dashboard/inventory?attention=missing_cost_basis";
    case "missing_storage_location":
      return "/dashboard/inventory?attention=missing_storage_location";
    case "unknown_condition":
      return "/dashboard/inventory?attention=unknown_condition";
    case "unknown_finish":
      return "/dashboard/inventory?attention=unknown_finish";
    case "inventory_setup_required":
      return "/dashboard/inventory";
  }
}

export function inventoryAttentionLabel(type: InventoryAttentionType) {
  switch (type) {
    case "missing_price":
      return "Missing prices";
    case "missing_cost_basis":
      return "Missing cost basis";
    case "missing_storage_location":
      return "Missing storage locations";
    case "unknown_condition":
      return "Unknown condition";
    case "unknown_finish":
      return "Unknown finish";
    case "inventory_setup_required":
      return "Inventory setup required";
  }
}

function groupAttentionItems(items: InventoryAttentionItem[]) {
  const groups = new Map<InventoryAttentionType, InventoryAttentionGroup>();
  for (const item of items.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))) {
    const current = groups.get(item.type);
    if (current) {
      current.count += 1;
      current.quantity += item.quantity;
      current.value = current.value === null || item.value === null ? current.value : current.value + item.value;
      if (current.representativeItems.length < INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT) {
        current.representativeItems.push(item);
      }
    } else {
      groups.set(item.type, {
        type: item.type,
        severity: item.severity,
        title: item.title,
        description: item.description,
        reason: item.reason,
        count: 1,
        quantity: item.quantity,
        value: item.value,
        recommendedAction: item.recommendedAction,
        actionHref: item.actionHref,
        representativeItems: [item],
      });
    }
  }

  return [...groups.values()].sort((a, b) => {
    const severity = severityRank(b.severity) - severityRank(a.severity);
    if (severity !== 0) return severity;
    return b.count - a.count;
  });
}

function withExactGroupCounts(
  groups: InventoryAttentionGroup[],
  counts: InventoryAttentionExactCounts,
) {
  const byType = new Map(groups.map((group) => [group.type, group]));
  const exactEntries: Array<[Exclude<InventoryAttentionType, "inventory_setup_required">, number]> = [
    ["missing_price", counts.missingPriceRows],
    ["missing_cost_basis", counts.missingCostBasisRows],
    ["missing_storage_location", counts.unassignedRows],
    ["unknown_condition", counts.unknownConditionRows],
    ["unknown_finish", counts.unknownFinishRows],
  ];

  for (const [type, count] of exactEntries) {
    const current = byType.get(type);
    if (current) {
      current.count = count;
    } else if (count > 0) {
      const rule = issueRule(type);
      byType.set(type, {
        type,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        reason: rule.reason,
        count,
        quantity: 0,
        value: null,
        recommendedAction: rule.action,
        actionHref: inventoryAttentionHref(type),
        representativeItems: [],
      });
    }
  }

  if ([...byType.values()].length === 0 && counts.missingPriceRows + counts.missingCostBasisRows + counts.unassignedRows + counts.unknownConditionRows + counts.unknownFinishRows === 0) {
    return groups;
  }

  return [...byType.values()]
    .filter((group) => group.type === "inventory_setup_required" || group.count > 0)
    .sort((a, b) => {
      const severity = severityRank(b.severity) - severityRank(a.severity);
      if (severity !== 0) return severity;
      return b.count - a.count;
    });
}

function issueItem(input: {
  row: InventoryAttentionRow;
  itemId: string | null;
  itemName: string;
  quantity: number;
  value: number | null;
  createdAt: string;
  type: Exclude<InventoryAttentionType, "inventory_setup_required">;
}): InventoryAttentionItem {
  const rule = issueRule(input.type);
  return {
    id: `${input.type}:${input.itemId ?? input.itemName}`,
    type: input.type,
    severity: rule.severity,
    title: rule.title,
    description: rule.description,
    reason: rule.reason,
    entityType: "inventory_item",
    entityId: input.itemId,
    inventoryItemId: input.itemId,
    cardId: stringValue(input.row.scryfall_id),
    itemName: input.itemName,
    quantity: input.quantity,
    value: input.value,
    metadata: {
      setCode: stringValue(input.row.set_code),
      collectorNumber: stringValue(input.row.collector_number),
      sku: stringValue(input.row.sku),
    },
    recommendedAction: rule.action,
    actionHref: inventoryAttentionHref(input.type),
    createdAt: input.createdAt,
    source: "inventory_items",
  };
}

function setupItem({ createdAt }: { createdAt: string }): InventoryAttentionItem {
  return {
    id: "inventory_setup_required",
    type: "inventory_setup_required",
    severity: "low",
    title: "Inventory setup required",
    description: "No inventory rows exist for this account yet.",
    reason: "Trading Docks cannot produce collection, storage, value, or card-workspace intelligence until inventory exists.",
    entityType: "inventory",
    entityId: null,
    inventoryItemId: null,
    cardId: null,
    itemName: "Inventory",
    quantity: 0,
    value: null,
    metadata: {},
    recommendedAction: "Add or import inventory",
    actionHref: inventoryAttentionHref("inventory_setup_required"),
    createdAt,
    source: "inventory_items",
  };
}

function issueRule(type: Exclude<InventoryAttentionType, "inventory_setup_required">) {
  switch (type) {
    case "missing_price":
      return {
        severity: "high" as const,
        title: "Missing price",
        description: "Inventory records without a usable market value weaken portfolio value, offers, and listing decisions.",
        reason: "inventory_value and data.value are absent or zero.",
        action: "Review pricing",
      };
    case "missing_cost_basis":
      return {
        severity: "medium" as const,
        title: "Missing cost basis",
        description: "Inventory records without acquisition cost cannot produce trustworthy realized profit or ROI.",
        reason: "data.unitCost, data.costBasis, data.purchasePrice, data.totalCost, and data.totalCostBasis are missing.",
        action: "Add acquisition cost",
      };
    case "missing_storage_location":
      return {
        severity: "medium" as const,
        title: "Missing storage location",
        description: "Inventory records without a physical location are harder to find, move, or fulfill.",
        reason: "location_id and data.locationId are missing.",
        action: "Assign storage",
      };
    case "unknown_condition":
      return {
        severity: "medium" as const,
        title: "Unknown condition",
        description: "Condition is required for reliable valuation, trade matching, and marketplace exports.",
        reason: "data.condition is missing or unknown.",
        action: "Set condition",
      };
    case "unknown_finish":
      return {
        severity: "medium" as const,
        title: "Unknown finish",
        description: "Finish/variant is required for exact-printing pricing and export accuracy.",
        reason: "data.finish, variant, or treatment is missing or unknown.",
        action: "Set finish",
      };
  }
}

function countType(groups: InventoryAttentionGroup[], type: InventoryAttentionType) {
  return groups.find((group) => group.type === type)?.count ?? 0;
}

function severityRank(severity: InventoryAttentionSeverity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUnknownValue(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return !normalized || normalized === "unknown" || normalized === "n/a";
}

function knownCostBasisValue(payload: Record<string, unknown>) {
  return positiveNumber(payload.unitCost)
    ?? positiveNumber(payload.costBasis)
    ?? positiveNumber(payload.purchasePrice)
    ?? positiveNumber(payload.totalCost)
    ?? positiveNumber(payload.totalCostBasis);
}
