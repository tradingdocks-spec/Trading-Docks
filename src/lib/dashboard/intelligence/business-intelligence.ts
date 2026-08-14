import {
  channelLabel,
  normalizeChannelId,
  type CanonicalChannelId,
  type CanonicalChannelMetric,
  type CanonicalOrder,
} from "../../orders/order-metrics.ts";

export type TradingDocksSignalPriority = "critical" | "high" | "medium" | "info";

export type TradingDocksSignal = {
  id: string;
  type:
    | "fulfillment"
    | "inventory-attribution"
    | "pricing-opportunity"
    | "stale-inventory"
    | "fast-mover"
    | "sync"
    | "restock";
  priority: TradingDocksSignalPriority;
  title: string;
  description: string;
  metric: string;
  impact: string;
  actionLabel: string;
  actionHref: string;
  evidence: string[];
};

export type BusinessActionPriority = "critical" | "high" | "medium" | "low";

export type RankedBusinessAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  severity: BusinessActionPriority;
  score: number;
  category: "operational" | "data-quality" | "pricing" | "setup";
};

export type ProfitConfidence = {
  level: "High" | "Medium" | "Low";
  coveragePercent: number;
  matchedSoldUnits: number;
  totalSoldUnits: number;
  reason: string;
};

export type InventoryAttribution = {
  coveragePercent: number;
  matchedOrderCount: number;
  totalOrderCount: number;
  matchedLineCount: number;
  totalLineCount: number;
  unmatchedLineCount: number;
  reason: string;
};

export type InventoryCapital = {
  totalValue: number;
  listedValue: number;
  unlistedValue: number;
  staleValue: number;
  staleItemCount: number;
  staleThresholdDays: number;
  coveragePercent: number;
};

export type PeriodDelta = {
  id: "revenue" | "orders" | "aov" | "unmatched" | "profit";
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
  format: "money" | "count" | "percent";
};

export type ExecutiveBrief = {
  headline: string;
  metricsLine: string;
  explanation: string | null;
};

export type BusinessOpportunity = {
  id: string;
  type: "pricing" | "restock" | "data-quality" | "fulfillment";
  label: string;
  title: string;
  detail: string;
  metric: string;
  href: string;
};

export type BusinessActivity = {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
};

export type ChannelPerformanceInsight = CanonicalChannelMetric & {
  revenueSharePercent: number;
  previousGrossSales: number;
  previousOrderCount: number;
  previousAverageOrderValue: number | null;
  salesChangePercent: number | null;
  orderChangePercent: number | null;
  aovChangePercent: number | null;
  lastSyncAt: string | null;
};

export type InventoryCapitalRow = {
  id?: string | null;
  quantity?: number | string | null;
  inventory_value?: number | string | null;
  updated_at?: string | null;
};

export type ListingRow = {
  marketplace_id?: string | null;
  inventory_item_id?: string | null;
  match_status?: string | null;
  last_seen_quantity?: number | string | null;
  last_seen_price?: number | string | null;
  last_seen_at?: string | null;
};

export type SyncRunRow = {
  marketplace_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export const STALE_INVENTORY_THRESHOLD_DAYS = 90;

export function buildExecutiveBrief(input: {
  rangeLabel: string;
  grossSales: number;
  previousGrossSales: number;
  salesChangePercent: number | null;
  orderCount: number;
  previousOrderCount: number;
  averageOrderValue: number | null;
  previousAverageOrderValue: number | null;
  connectedChannelCount: number;
}) {
  const salesChange = input.salesChangePercent;
  const orderDelta = input.orderCount - input.previousOrderCount;
  const aovDelta = numeric(input.averageOrderValue) - numeric(input.previousAverageOrderValue);
  const metricsLine = `${money(input.grossSales)} revenue · ${input.orderCount.toLocaleString()} orders · ${input.averageOrderValue === null ? "AOV unavailable" : `${money(input.averageOrderValue)} AOV`} · ${input.connectedChannelCount.toLocaleString()} active ${input.connectedChannelCount === 1 ? "channel" : "channels"}`;

  if (input.orderCount === 0 && input.grossSales === 0) {
    return {
      headline: input.connectedChannelCount
        ? `No orders imported ${input.rangeLabel.toLowerCase()}.`
        : "Connect sales data to activate Business Command Center.",
      metricsLine,
      explanation: input.connectedChannelCount
        ? "Connected channels are ready, but no orders landed in this date range."
        : "Trading Docks does not show demo revenue or fabricated operating activity.",
    };
  }

  if (salesChange !== null && salesChange < 0 && orderDelta > 0 && aovDelta < 0) {
    return {
      headline: `Sales softened ${Math.abs(salesChange).toFixed(1)}%, but order volume increased.`,
      metricsLine,
      explanation: "Lower average order value, not lower order volume, drove the revenue decline.",
    };
  }

  if (salesChange !== null && salesChange > 0 && orderDelta >= 0) {
    return {
      headline: `Sales increased ${salesChange.toFixed(1)}% with ${orderDelta >= 0 ? "stable or higher" : "lower"} order volume.`,
      metricsLine,
      explanation: input.averageOrderValue !== null && input.previousAverageOrderValue !== null && aovDelta > 0
        ? "Average order value improved alongside revenue."
        : "Revenue moved up during the selected period.",
    };
  }

  if (salesChange !== null && salesChange < 0) {
    return {
      headline: `Sales decreased ${Math.abs(salesChange).toFixed(1)}% versus the prior period.`,
      metricsLine,
      explanation: "The current range underperformed the comparable previous range.",
    };
  }

  return {
    headline: `${money(input.grossSales)} sold ${input.rangeLabel.toLowerCase()}.`,
    metricsLine,
    explanation: input.previousGrossSales > 0 ? "Performance is broadly in line with the prior period." : null,
  };
}

export function buildDocksBrief(input: {
  rangeLabel: string;
  grossSales: number;
  orderCount: number;
  salesChangePercent: number | null;
  averageOrderValue: number | null;
  previousAverageOrderValue: number | null;
  openFulfillmentCount: number;
  inventoryAttribution: InventoryAttribution;
  channelInsights: ChannelPerformanceInsight[];
  signals: TradingDocksSignal[];
}) {
  if (input.orderCount === 0 && input.grossSales === 0) {
    return "No sales have been imported for this range. Connect or import marketplace orders to activate revenue, attribution, fulfillment, and pricing intelligence.";
  }

  const leading = input.channelInsights
    .filter((channel) => channel.connected && channel.grossSales > 0)
    .sort((a, b) => b.grossSales - a.grossSales)[0];
  const movement = input.salesChangePercent === null
    ? "Prior-period comparison will appear once comparable sales exist"
    : `Revenue ${input.salesChangePercent >= 0 ? "increased" : "decreased"} ${Math.abs(input.salesChangePercent).toFixed(1)}%`;
  const fulfillment = input.openFulfillmentCount > 0
    ? `${input.openFulfillmentCount.toLocaleString()} ${input.openFulfillmentCount === 1 ? "order needs" : "orders need"} fulfillment`
    : "Fulfillment is clear";
  const attribution = input.inventoryAttribution.totalOrderCount > 0
    ? `${Math.round(input.inventoryAttribution.coveragePercent)}% inventory attribution`
    : "Inventory attribution starts after orders import";
  const signal = input.signals[0]?.title;

  return [
    `${input.orderCount.toLocaleString()} orders generated ${money(input.grossSales)} during ${input.rangeLabel.toLowerCase()}.`,
    movement,
    `${fulfillment}.`,
    `${attribution}.`,
    leading ? `${leading.label} is the leading sales channel.` : null,
    signal ? `Top signal: ${signal}.` : null,
  ].filter(Boolean).join(" ");
}

export function calculateInventoryAttribution(orders: CanonicalOrder[]): InventoryAttribution {
  let matchedOrderCount = 0;
  let totalLineCount = 0;
  let matchedLineCount = 0;
  let unmatchedLineCount = 0;

  for (const order of orders) {
    const lines = order.marketplace_order_items ?? [];
    const hasLines = lines.length > 0;
    const orderMatched = hasLines && lines.every((line) => isMatchedLine(line));
    if (orderMatched) matchedOrderCount += 1;
    totalLineCount += lines.length;
    for (const line of lines) {
      if (isMatchedLine(line)) {
        matchedLineCount += 1;
      } else {
        unmatchedLineCount += 1;
      }
    }
  }

  const totalOrderCount = orders.length;
  const coveragePercent = totalLineCount > 0 ? (matchedLineCount / totalLineCount) * 100 : 0;
  const reason = totalOrderCount === 0
    ? "No orders are available for inventory attribution."
    : `${matchedOrderCount.toLocaleString()} of ${totalOrderCount.toLocaleString()} orders have complete inventory attribution.`;

  return {
    coveragePercent,
    matchedOrderCount,
    totalOrderCount,
    matchedLineCount,
    totalLineCount,
    unmatchedLineCount,
    reason,
  };
}

export function calculateProfitConfidence(orders: CanonicalOrder[], attribution: InventoryAttribution): ProfitConfidence {
  const totalSoldUnits = orders.reduce((sum, order) => sum + (order.marketplace_order_items ?? []).reduce((lineSum, line) => lineSum + Math.max(0, numeric(line.quantity)), 0), 0);
  const matchedSoldUnits = orders.reduce((sum, order) => sum + (order.marketplace_order_items ?? []).reduce((lineSum, line) => lineSum + (isMatchedLine(line) ? Math.max(0, numeric(line.quantity)) : 0), 0), 0);
  const coveragePercent = totalSoldUnits > 0 ? (matchedSoldUnits / totalSoldUnits) * 100 : attribution.coveragePercent;
  const level: ProfitConfidence["level"] = coveragePercent >= 80 ? "High" : coveragePercent >= 40 ? "Medium" : "Low";

  return {
    level,
    coveragePercent,
    matchedSoldUnits,
    totalSoldUnits,
    reason: totalSoldUnits > 0
      ? `${Math.round(coveragePercent)}% of sold units are matched to inventory cost basis.`
      : "No sold units are available for cost-basis confidence.",
  };
}

export function calculateInventoryCapital(input: {
  inventoryRows: InventoryCapitalRow[];
  listingRows: ListingRow[];
  now: Date;
  staleThresholdDays?: number;
}): InventoryCapital {
  const staleThresholdDays = input.staleThresholdDays ?? STALE_INVENTORY_THRESHOLD_DAYS;
  const cutoff = input.now.getTime() - staleThresholdDays * 24 * 60 * 60 * 1000;
  const listedIds = new Set(
    input.listingRows
      .filter((row) => normalizeStatus(row.match_status) === "matched")
      .map((row) => row.inventory_item_id)
      .filter((id): id is string => Boolean(id)),
  );
  let totalValue = 0;
  let listedValue = 0;
  let staleValue = 0;
  let staleItemCount = 0;
  let valuedRows = 0;

  for (const row of input.inventoryRows) {
    const value = Math.max(0, numeric(row.inventory_value));
    totalValue += value;
    if (value > 0) valuedRows += 1;
    if (row.id && listedIds.has(row.id)) listedValue += value;
    const updated = parseDate(row.updated_at);
    if (value > 0 && updated && updated.getTime() < cutoff) {
      staleValue += value;
      staleItemCount += 1;
    }
  }

  return {
    totalValue,
    listedValue,
    unlistedValue: Math.max(0, totalValue - listedValue),
    staleValue,
    staleItemCount,
    staleThresholdDays,
    coveragePercent: input.inventoryRows.length ? (valuedRows / input.inventoryRows.length) * 100 : 0,
  };
}

export function buildChannelInsights(input: {
  current: CanonicalChannelMetric[];
  previous: CanonicalChannelMetric[];
  syncRuns: SyncRunRow[];
}) {
  const totalSales = input.current.reduce((sum, channel) => sum + channel.grossSales, 0);
  return input.current.map((channel): ChannelPerformanceInsight => {
    const previous = input.previous.find((item) => item.id === channel.id);
    const lastSyncAt = input.syncRuns
      .filter((run) => normalizeChannelId(run.marketplace_id) === channel.id)
      .map((run) => run.created_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    return {
      ...channel,
      revenueSharePercent: totalSales > 0 ? (channel.grossSales / totalSales) * 100 : 0,
      previousGrossSales: previous?.grossSales ?? 0,
      previousOrderCount: previous?.orderCount ?? 0,
      previousAverageOrderValue: previous?.averageOrderValue ?? null,
      salesChangePercent: percentageChange(previous?.grossSales ?? 0, channel.grossSales),
      orderChangePercent: percentageChange(previous?.orderCount ?? 0, channel.orderCount),
      aovChangePercent: percentageChange(previous?.averageOrderValue ?? 0, channel.averageOrderValue ?? 0),
      lastSyncAt,
    };
  });
}

export function buildPeriodDeltas(input: {
  grossSales: number;
  previousGrossSales: number;
  orderCount: number;
  previousOrderCount: number;
  averageOrderValue: number | null;
  previousAverageOrderValue: number | null;
  unmatchedLineCount: number;
  previousUnmatchedLineCount: number;
  realizedProfit: number | null;
  previousRealizedProfit: number | null;
}): PeriodDelta[] {
  return [
    delta("revenue", "Revenue", input.grossSales, input.previousGrossSales, "money"),
    delta("orders", "Orders", input.orderCount, input.previousOrderCount, "count"),
    delta("aov", "AOV", input.averageOrderValue, input.previousAverageOrderValue, "money"),
    delta("unmatched", "Unmatched lines", input.unmatchedLineCount, input.previousUnmatchedLineCount, "count"),
    delta("profit", "Profit estimate", input.realizedProfit, input.previousRealizedProfit, "money"),
  ];
}

export function buildTradingDocksSignals(input: {
  openFulfillmentCount: number;
  listingIssues: number;
  repricingReviewCount: number;
  syncIssues: number;
  inventoryCapital: InventoryCapital;
  inventoryAttribution: InventoryAttribution;
  orders: CanonicalOrder[];
}): TradingDocksSignal[] {
  const signals: TradingDocksSignal[] = [];
  if (input.syncIssues > 0) {
    signals.push({
      id: "sync-issues",
      type: "sync",
      priority: "critical",
      title: "Marketplace sync needs attention",
      description: `${input.syncIssues.toLocaleString()} failed sync ${input.syncIssues === 1 ? "run is" : "runs are"} blocking fresh channel intelligence.`,
      metric: input.syncIssues.toLocaleString(),
      impact: "Sales and listing signals may be stale until sync is healthy.",
      actionLabel: "Review marketplace sync",
      actionHref: "/dashboard/marketplaces",
      evidence: ["marketplace_sync_runs.status = failed"],
    });
  }
  if (input.openFulfillmentCount > 0) {
    signals.push({
      id: "open-fulfillment",
      type: "fulfillment",
      priority: input.openFulfillmentCount >= 10 ? "high" : "medium",
      title: "Orders need fulfillment",
      description: `${input.openFulfillmentCount.toLocaleString()} ${input.openFulfillmentCount === 1 ? "order needs" : "orders need"} packing, picking, or review.`,
      metric: input.openFulfillmentCount.toLocaleString(),
      impact: "Open fulfillment delays cash conversion and customer experience.",
      actionLabel: "Review fulfillment",
      actionHref: "/dashboard/orders",
      evidence: ["canonical order status is new, processing, picking, packing, or needs review"],
    });
  }
  if (input.inventoryAttribution.unmatchedLineCount > 0) {
    signals.push({
      id: "inventory-attribution-gap",
      type: "inventory-attribution",
      priority: input.inventoryAttribution.coveragePercent < 50 ? "high" : "medium",
      title: "Inventory attribution gap",
      description: `${input.inventoryAttribution.unmatchedLineCount.toLocaleString()} sold ${input.inventoryAttribution.unmatchedLineCount === 1 ? "line needs" : "lines need"} inventory matching.`,
      metric: `${Math.round(input.inventoryAttribution.coveragePercent)}% matched`,
      impact: "Matching sold items unlocks accurate COGS, inventory movement, and realized profit.",
      actionLabel: "Match order items",
      actionHref: "/dashboard/orders",
      evidence: ["marketplace_order_items.match_status is unmatched or conflict"],
    });
  }
  if (input.repricingReviewCount > 0) {
    signals.push({
      id: "pricing-opportunity",
      type: "pricing-opportunity",
      priority: input.repricingReviewCount >= 20 ? "high" : "medium",
      title: "Pricing opportunities ready",
      description: `${input.repricingReviewCount.toLocaleString()} inventory ${input.repricingReviewCount === 1 ? "price needs" : "prices need"} review before labels or listings are refreshed.`,
      metric: input.repricingReviewCount.toLocaleString(),
      impact: "Pricing reviews protect margin and reduce stale listing drift.",
      actionLabel: "Review pricing",
      actionHref: "/dashboard/label-studio",
      evidence: ["inventory_price_reviews.status = needs_review"],
    });
  }
  if (input.inventoryCapital.staleValue > 0) {
    signals.push({
      id: "capital-at-risk",
      type: "stale-inventory",
      priority: input.inventoryCapital.staleValue >= 1000 ? "high" : "medium",
      title: "Capital at risk",
      description: `${money(input.inventoryCapital.staleValue)} in inventory has been inactive for ${input.inventoryCapital.staleThresholdDays}+ days.`,
      metric: money(input.inventoryCapital.staleValue),
      impact: "Stale capital lowers inventory velocity and hides cash tied up on shelves.",
      actionLabel: "Review stale inventory",
      actionHref: "/dashboard/inventory",
      evidence: [`inventory_items.updated_at older than ${input.inventoryCapital.staleThresholdDays} days`],
    });
  }

  for (const mover of fastMovers(input.orders).slice(0, 2)) {
    signals.push({
      id: `fast-mover-${mover.key}`,
      type: "fast-mover",
      priority: "info",
      title: "Fast mover detected",
      description: `${mover.label} sold ${mover.quantity.toLocaleString()} times in this range.`,
      metric: `${mover.quantity.toLocaleString()} sold`,
      impact: "Repeat sales can inform restock and buying targets.",
      actionLabel: "Open orders",
      actionHref: "/dashboard/orders",
      evidence: ["marketplace_order_items quantity grouped by title/SKU"],
    });
  }

  return signals.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority)).slice(0, 6);
}

export function buildRankedActions(input: {
  signals: TradingDocksSignal[];
  connectedChannelCount: number;
  hasStoreAccess: boolean;
  employeeCount: number | null;
  vendorCount: number | null;
  supplyAlertCount: number | null;
}) {
  const signalActions: RankedBusinessAction[] = input.signals.map((signal) => ({
    id: signal.id,
    label: signal.actionLabel,
    detail: signal.impact,
    href: signal.actionHref,
    severity: signal.priority === "critical" ? "critical" : signal.priority === "high" ? "high" : signal.priority === "medium" ? "medium" : "low",
    score: priorityRank(signal.priority) * 10000 + numeric(signal.metric.replace(/[^0-9.-]/g, "")),
    category: signal.type === "pricing-opportunity" || signal.type === "stale-inventory" ? "pricing" : signal.type === "inventory-attribution" ? "data-quality" : "operational",
  }));
  const setupActions: RankedBusinessAction[] = [];
  if (input.connectedChannelCount === 0) {
    setupActions.push({
      id: "connect-marketplace",
      label: "Connect a sales channel",
      detail: "Connect TCGplayer, eBay, Mana Pool, or another channel to populate live sales.",
      href: "/dashboard/marketplaces",
      severity: "medium",
      score: 240,
      category: "setup",
    });
  }
  if (input.hasStoreAccess && !input.employeeCount) {
    setupActions.push({
      id: "team-setup",
      label: "Set up store staff",
      detail: "Add employees when you are ready to delegate shared store operations.",
      href: "/dashboard/employees",
      severity: "low",
      score: 80,
      category: "setup",
    });
  }
  if (input.hasStoreAccess && !input.vendorCount) {
    setupActions.push({
      id: "vendor-setup",
      label: "Add vendor relationships",
      detail: "Track vendor terms, purchase orders, and replenishment sources.",
      href: "/dashboard/vendors",
      severity: "low",
      score: 70,
      category: "setup",
    });
  }
  if (input.hasStoreAccess && input.supplyAlertCount === 0) {
    setupActions.push({
      id: "supply-alerts",
      label: "Configure supply alerts",
      detail: "Track sleeves, labels, shipping materials, and store operating supplies.",
      href: "/dashboard/supplies",
      severity: "low",
      score: 60,
      category: "setup",
    });
  }
  return [...signalActions, ...setupActions].sort((a, b) => b.score - a.score).slice(0, 6);
}

export function buildOpportunities(input: {
  signals: TradingDocksSignal[];
  orders: CanonicalOrder[];
}) {
  const opportunities: BusinessOpportunity[] = [];
  for (const signal of input.signals) {
    if (signal.type === "pricing-opportunity" || signal.type === "stale-inventory" || signal.type === "inventory-attribution" || signal.type === "fulfillment") {
      opportunities.push({
        id: signal.id,
        type: signal.type === "pricing-opportunity" ? "pricing" : signal.type === "stale-inventory" ? "restock" : signal.type === "inventory-attribution" ? "data-quality" : "fulfillment",
        label: signal.type.replace(/-/g, " ").toUpperCase(),
        title: signal.title,
        detail: signal.description,
        metric: signal.metric,
        href: signal.actionHref,
      });
    }
  }
  for (const mover of fastMovers(input.orders).slice(0, 1)) {
    opportunities.push({
      id: `restock-${mover.key}`,
      type: "restock",
      label: "RESTOCK SIGNAL",
      title: mover.label,
      detail: "Repeat sales indicate possible replenishment demand.",
      metric: `${mover.quantity.toLocaleString()} sold`,
      href: "/dashboard/orders",
    });
  }
  return opportunities.slice(0, 5);
}

export function buildActivityFeed(input: {
  orders: CanonicalOrder[];
  syncRuns: SyncRunRow[];
}) {
  const activities: BusinessActivity[] = [];
  for (const order of input.orders.slice(0, 4)) {
    const timestamp = order.ordered_at ?? order.created_at;
    if (!timestamp) continue;
    activities.push({
      id: `order-${order.id ?? timestamp}`,
      label: "Order imported",
      detail: `${channelLabel(order.marketplace_id ?? order.source_type)} · ${money(numeric(order.total))}`,
      occurredAt: timestamp,
    });
  }
  for (const run of input.syncRuns.slice(0, 3)) {
    if (!run.created_at) continue;
    activities.push({
      id: `sync-${run.marketplace_id ?? "channel"}-${run.created_at}`,
      label: normalizeStatus(run.status) === "failed" ? "Marketplace sync failed" : "Marketplace sync completed",
      detail: channelLabel(run.marketplace_id),
      occurredAt: run.created_at,
    });
  }
  return activities
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 5);
}

function delta(
  id: PeriodDelta["id"],
  label: string,
  current: number | null,
  previous: number | null,
  format: PeriodDelta["format"],
): PeriodDelta {
  const hasBoth = current !== null && previous !== null;
  return {
    id,
    label,
    current,
    previous,
    delta: hasBoth ? current - previous : null,
    deltaPercent: hasBoth ? percentageChange(previous, current) : null,
    format,
  };
}

function fastMovers(orders: CanonicalOrder[]) {
  const map = new Map<string, { key: string; label: string; quantity: number }>();
  for (const order of orders) {
    for (const line of order.marketplace_order_items ?? []) {
      const raw = typeof line.external_sku === "string" && line.external_sku.trim()
        ? line.external_sku
        : typeof line.title === "string" && line.title.trim()
          ? line.title
          : null;
      if (!raw) continue;
      const key = raw.toLowerCase();
      const current = map.get(key) ?? { key, label: raw, quantity: 0 };
      current.quantity += Math.max(0, numeric(line.quantity));
      map.set(key, current);
    }
  }
  return [...map.values()].filter((item) => item.quantity >= 2).sort((a, b) => b.quantity - a.quantity);
}

function isMatchedLine(line: { match_status?: string | null; inventory_item_id?: string | null }) {
  return normalizeStatus(line.match_status) === "matched" && Boolean(line.inventory_item_id);
}

function priorityRank(priority: TradingDocksSignalPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase().replace(/[_\s]+/g, "-")
    : "";
}

function percentageChange(previous: number | null, current: number | null) {
  if (previous === null || current === null) return null;
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
