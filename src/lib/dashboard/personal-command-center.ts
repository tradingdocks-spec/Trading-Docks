import type { PlatformAccessContext } from "../../../mobile/services/platform-access.ts";

export type PersonalInventoryRow = {
  id?: string | null;
  card_name?: string | null;
  quantity?: number | string | null;
  inventory_value?: number | string | null;
  location_id?: string | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
};

export type PersonalCommandAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  severity: "attention" | "neutral";
  evidence: string[];
};

export type PersonalCommandCenterSummary = {
  userId: string;
  workspaceId: string | null;
  totalInventoryRows: number;
  sampledRows: number;
  sampledQuantity: number;
  knownMarketValue: number | null;
  knownPriceRows: number;
  missingPriceRows: number;
  unassignedRows: number;
  unknownConditionRows: number;
  unknownFinishRows: number;
  storageCoveragePercent: number;
  priceCoveragePercent: number;
  generatedAt: string;
  sampleLimited: boolean;
  headline: string;
  brief: string;
  actions: PersonalCommandAction[];
};

type QueryBuilder<T> = PromiseLike<{ data: T[] | null; count?: number | null; error?: { message?: string } | null }> & {
  eq: (column: string, value: string) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
};

export type PersonalCommandSupabaseClient = {
  from: <T = Record<string, unknown>>(table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder<T>;
  };
};

export const PERSONAL_COMMAND_CENTER_SAMPLE_SIZE = 500;

export async function loadPersonalCommandCenter({
  supabase,
  access,
  now = new Date(),
}: {
  supabase: PersonalCommandSupabaseClient;
  access: PlatformAccessContext;
  now?: Date;
}) {
  if (!access.userId) return null;

  const [totalResult, rowsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.userId),
    supabase
      .from<PersonalInventoryRow>("inventory_items")
      .select("id,card_name,quantity,inventory_value,location_id,updated_at,data")
      .eq("user_id", access.userId)
      .order("updated_at", { ascending: false })
      .limit(PERSONAL_COMMAND_CENTER_SAMPLE_SIZE),
  ]);

  const total = await totalResult;
  const rows = await rowsResult;
  if (total.error) throw new Error(`Personal command center count failed: ${total.error.message ?? "Unknown Supabase error"}`);
  if (rows.error) throw new Error(`Personal command center inventory failed: ${rows.error.message ?? "Unknown Supabase error"}`);

  return buildPersonalCommandCenterSummary({
    access,
    rows: rows.data ?? [],
    totalInventoryRows: total.count ?? (rows.data ?? []).length,
    now,
  });
}

export function buildPersonalCommandCenterSummary({
  access,
  rows,
  totalInventoryRows = rows.length,
  now = new Date(),
}: {
  access: Pick<PlatformAccessContext, "userId" | "workspaceId">;
  rows: PersonalInventoryRow[];
  totalInventoryRows?: number;
  now?: Date;
}): PersonalCommandCenterSummary {
  let sampledQuantity = 0;
  let knownMarketValue = 0;
  let knownPriceRows = 0;
  let missingPriceRows = 0;
  let unassignedRows = 0;
  let unknownConditionRows = 0;
  let unknownFinishRows = 0;

  for (const row of rows) {
    const payload = recordValue(row.data);
    const quantity = positiveNumber(row.quantity) ?? positiveNumber(payload.quantity) ?? 0;
    sampledQuantity += quantity;

    const value = positiveNumber(row.inventory_value) ?? positiveNumber(payload.value) ?? null;
    if (value !== null) {
      knownMarketValue += value;
      knownPriceRows += 1;
    } else {
      missingPriceRows += 1;
    }

    const locationId = stringValue(row.location_id) ?? stringValue(payload.locationId);
    if (!locationId) unassignedRows += 1;

    if (isUnknownValue(payload.condition)) unknownConditionRows += 1;
    if (isUnknownValue(payload.finish ?? payload.variant ?? payload.treatment)) unknownFinishRows += 1;
  }

  const sampledRows = rows.length;
  const storageCoveragePercent = sampledRows > 0 ? ((sampledRows - unassignedRows) / sampledRows) * 100 : 0;
  const priceCoveragePercent = sampledRows > 0 ? (knownPriceRows / sampledRows) * 100 : 0;
  const sampleLimited = totalInventoryRows > sampledRows;
  const actions = buildPersonalActions({
    totalInventoryRows,
    sampledRows,
    missingPriceRows,
    unassignedRows,
    unknownConditionRows,
    unknownFinishRows,
  });

  return {
    userId: access.userId ?? "",
    workspaceId: access.workspaceId ?? null,
    totalInventoryRows,
    sampledRows,
    sampledQuantity,
    knownMarketValue: knownPriceRows > 0 ? knownMarketValue : null,
    knownPriceRows,
    missingPriceRows,
    unassignedRows,
    unknownConditionRows,
    unknownFinishRows,
    storageCoveragePercent,
    priceCoveragePercent,
    generatedAt: now.toISOString(),
    sampleLimited,
    headline: buildPersonalHeadline({ totalInventoryRows, sampledQuantity, knownMarketValue: knownPriceRows > 0 ? knownMarketValue : null }),
    brief: buildPersonalBrief({
      totalInventoryRows,
      sampledRows,
      sampleLimited,
      storageCoveragePercent,
      priceCoveragePercent,
      unassignedRows,
      missingPriceRows,
    }),
    actions,
  };
}

function buildPersonalActions(input: {
  totalInventoryRows: number;
  sampledRows: number;
  missingPriceRows: number;
  unassignedRows: number;
  unknownConditionRows: number;
  unknownFinishRows: number;
}): PersonalCommandAction[] {
  if (input.totalInventoryRows === 0) {
    return [
      {
        id: "add-inventory",
        label: "Add or import cards",
        detail: "Create the ownership baseline with exact printing, quantity, condition, finish, and storage.",
        href: "/dashboard/inventory",
        severity: "neutral",
        evidence: ["inventory_items count is zero for the authenticated user"],
      },
      {
        id: "scan-card",
        label: "Scan a card",
        detail: "Use scanner-assisted intake when you want to identify and add cards one at a time.",
        href: "/dashboard/scan/automatic",
        severity: "neutral",
        evidence: ["no inventory rows are available for command-center analysis"],
      },
    ];
  }

  const actions: PersonalCommandAction[] = [];
  if (input.unassignedRows > 0) {
    actions.push({
      id: "assign-storage",
      label: "Assign storage",
      detail: `${input.unassignedRows.toLocaleString()} sampled ${input.unassignedRows === 1 ? "record has" : "records have"} no physical location.`,
      href: "/dashboard/inventory?view=storage",
      severity: "attention",
      evidence: ["inventory_items.location_id or data.locationId is missing"],
    });
  }
  if (input.missingPriceRows > 0) {
    actions.push({
      id: "review-missing-prices",
      label: "Review missing prices",
      detail: `${input.missingPriceRows.toLocaleString()} sampled ${input.missingPriceRows === 1 ? "record is" : "records are"} missing usable market value.`,
      href: "/dashboard/inventory?view=missing_price",
      severity: "attention",
      evidence: ["inventory_value and data.value are absent or zero"],
    });
  }
  if (input.unknownConditionRows > 0 || input.unknownFinishRows > 0) {
    actions.push({
      id: "complete-card-details",
      label: "Complete card details",
      detail: "Condition or finish is unknown on recent inventory, which weakens price and trade decisions.",
      href: "/dashboard/inventory",
      severity: "neutral",
      evidence: ["inventory_items.data.condition, finish, variant, or treatment is missing"],
    });
  }
  actions.push({
    id: "open-collection",
    label: "Open Collection",
    detail: "Review the live collection table with server-side search, storage, trade, and wishlist controls.",
    href: "/dashboard/inventory",
    severity: "neutral",
    evidence: [`${input.sampledRows.toLocaleString()} inventory rows sampled for command-center state`],
  });

  return actions.slice(0, 4);
}

function buildPersonalHeadline(input: {
  totalInventoryRows: number;
  sampledQuantity: number;
  knownMarketValue: number | null;
}) {
  if (input.totalInventoryRows === 0) {
    return "Your operating picture starts with owned inventory.";
  }
  const value = input.knownMarketValue === null ? "value coverage pending" : `${money(input.knownMarketValue)} known value`;
  return `${input.sampledQuantity.toLocaleString()} cards sampled · ${value}.`;
}

function buildPersonalBrief(input: {
  totalInventoryRows: number;
  sampledRows: number;
  sampleLimited: boolean;
  storageCoveragePercent: number;
  priceCoveragePercent: number;
  unassignedRows: number;
  missingPriceRows: number;
}) {
  if (input.totalInventoryRows === 0) {
    return "Trading Docks does not show demo collection activity. Add cards, import a CSV, or scan inventory to activate storage, value, deck, and portfolio intelligence.";
  }

  const scope = input.sampleLimited
    ? `${input.sampledRows.toLocaleString()} recent rows sampled from ${input.totalInventoryRows.toLocaleString()} inventory records`
    : `${input.totalInventoryRows.toLocaleString()} inventory records analyzed`;
  return [
    scope,
    `${Math.round(input.storageCoveragePercent)}% storage coverage`,
    `${Math.round(input.priceCoveragePercent)}% price coverage`,
    input.unassignedRows > 0 ? `${input.unassignedRows.toLocaleString()} sampled ${input.unassignedRows === 1 ? "record needs" : "records need"} a location` : "Storage is covered in the sample",
    input.missingPriceRows > 0 ? `${input.missingPriceRows.toLocaleString()} sampled ${input.missingPriceRows === 1 ? "record needs" : "records need"} pricing` : "Pricing is covered in the sample",
  ].join(". ") + ".";
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

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
