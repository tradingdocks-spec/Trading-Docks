import type { PlatformAccessContext } from "../../../mobile/services/platform-access.ts";
import {
  buildInventoryAttentionSummary,
  loadInventoryAttentionSummary,
  INVENTORY_ATTENTION_SAMPLE_SIZE,
  type InventoryAttentionRow,
  type InventoryAttentionSupabaseClient,
} from "../inventory/intelligence.ts";

export type PersonalInventoryRow = InventoryAttentionRow;

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

export type PersonalCommandSupabaseClient = InventoryAttentionSupabaseClient;

export const PERSONAL_COMMAND_CENTER_SAMPLE_SIZE = INVENTORY_ATTENTION_SAMPLE_SIZE;

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

  const attention = await loadInventoryAttentionSummary({
    supabase,
    userId: access.userId,
    workspaceId: access.workspaceId,
    now,
  });

  return fromInventoryAttentionSummary(attention);
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
  return fromInventoryAttentionSummary(buildInventoryAttentionSummary({
    userId: access.userId ?? "",
    workspaceId: access.workspaceId ?? null,
    rows,
    totalInventoryRows,
    now,
  }));
}

function fromInventoryAttentionSummary(summary: ReturnType<typeof buildInventoryAttentionSummary>): PersonalCommandCenterSummary {
  return {
    userId: summary.userId,
    workspaceId: summary.workspaceId,
    totalInventoryRows: summary.totalInventoryRows,
    sampledRows: summary.sampledRows,
    sampledQuantity: summary.sampledQuantity,
    knownMarketValue: summary.knownMarketValue,
    knownPriceRows: summary.knownPriceRows,
    missingPriceRows: summary.missingPriceRows,
    unassignedRows: summary.unassignedRows,
    unknownConditionRows: summary.unknownConditionRows,
    unknownFinishRows: summary.unknownFinishRows,
    storageCoveragePercent: summary.storageCoveragePercent,
    priceCoveragePercent: summary.priceCoveragePercent,
    generatedAt: summary.generatedAt,
    sampleLimited: summary.sampleLimited,
    headline: buildPersonalHeadline({
      totalInventoryRows: summary.totalInventoryRows,
      sampledQuantity: summary.sampledQuantity,
      knownMarketValue: summary.knownMarketValue,
    }),
    brief: buildPersonalBrief(summary),
    actions: summary.topActions.length
      ? summary.topActions.map((group) => ({
          id: group.type,
          label: group.recommendedAction,
          detail: group.count === 1 ? group.description : `${group.count.toLocaleString()} sampled records: ${group.description}`,
          href: group.actionHref,
          severity: group.severity === "high" || group.severity === "medium" ? "attention" : "neutral",
          evidence: group.representativeItems.flatMap((item) => item.reason).slice(0, 3),
        }))
      : [
          {
            id: "open-collection",
            label: "Open Collection",
            detail: "Review the live collection table with server-side search, storage, trade, and wishlist controls.",
            href: "/dashboard/inventory",
            severity: "neutral",
            evidence: [`${summary.sampledRows.toLocaleString()} inventory rows sampled for command-center state`],
          },
        ],
  };
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

function buildPersonalBrief(summary: ReturnType<typeof buildInventoryAttentionSummary>) {
  if (summary.totalInventoryRows === 0) {
    return "Trading Docks does not show demo collection activity. Add cards, import a CSV, or scan inventory to activate storage, value, deck, and portfolio intelligence.";
  }

  const scope = summary.sampleLimited
    ? `${summary.sampledRows.toLocaleString()} recent rows sampled from ${summary.totalInventoryRows.toLocaleString()} inventory records`
    : `${summary.totalInventoryRows.toLocaleString()} inventory records analyzed`;
  return [
    scope,
    `${Math.round(summary.storageCoveragePercent)}% storage coverage`,
    `${Math.round(summary.priceCoveragePercent)}% price coverage`,
    summary.unassignedRows > 0 ? `${summary.unassignedRows.toLocaleString()} sampled ${summary.unassignedRows === 1 ? "record needs" : "records need"} a location` : "Storage is covered in the sample",
    summary.missingPriceRows > 0 ? `${summary.missingPriceRows.toLocaleString()} sampled ${summary.missingPriceRows === 1 ? "record needs" : "records need"} pricing` : "Pricing is covered in the sample",
  ].join(". ") + ".";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
