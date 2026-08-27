import {
  hasCapability,
  hasTrustedFullPlatformAccess,
  type PlatformAccessContext,
} from "../../../mobile/services/platform-access.ts";
import {
  normalizeChannelId,
  canonicalOrderTimestamp,
  summarizeCanonicalOrders,
  type CanonicalChannelId,
  type CanonicalOrder,
} from "../orders/order-metrics.ts";
import {
  loadCanonicalOrders,
  type CanonicalOrderSupabaseClient,
} from "../orders/order-repository.ts";
import {
  buildActivityFeed,
  buildChannelInsights,
  buildDocksBrief,
  buildExecutiveBrief,
  buildOpportunities,
  buildPeriodDeltas,
  buildRankedActions,
  buildTradingDocksSignals,
  calculateInventoryAttribution,
  calculateInventoryCapital,
  calculateProfitConfidence,
  type BusinessActivity,
  type BusinessOpportunity,
  type ChannelPerformanceInsight,
  type ExecutiveBrief,
  type InventoryAttribution,
  type InventoryCapital,
  type InventoryCapitalRow,
  type ListingRow,
  type PeriodDelta,
  type ProfitConfidence,
  type RankedBusinessAction,
  type SyncRunRow,
  type TradingDocksSignal,
} from "./intelligence/business-intelligence.ts";

export type BusinessDateRange = "today" | "week" | "7d" | "30d" | "90d" | "12m" | "month";

export type BusinessChannelSummary = ChannelPerformanceInsight;

export type BusinessNextAction = RankedBusinessAction;

export type BusinessRevenueSeriesPoint = {
  key: string;
  label: string;
  axisLabel: string;
  start: string;
  end: string;
  revenue: number;
  profitEstimate: number | null;
  orders: number;
  profitCoverageRatio: number;
};

export type BusinessCommandCenterSummary = {
  range: BusinessDateRange;
  rangeLabel: string;
  workspaceId: string | null;
  userId: string;
  hasSellerAccess: boolean;
  hasStoreAccess: boolean;
  hasFullPlatformAccess: boolean;
  grossSales: number;
  previousGrossSales: number;
  salesChangePercent: number | null;
  orderCount: number;
  previousOrderCount: number;
  itemsSold: number;
  averageOrderValue: number | null;
  realizedProfit: number | null;
  profitCoverageRatio: number;
  profitKnownUnits: number;
  profitTotalUnits: number;
  openFulfillmentCount: number;
  listingIssues: number;
  syncIssues: number;
  repricingReviewCount: number;
  customerCount: number | null;
  employeeCount: number | null;
  vendorCount: number | null;
  supplyAlertCount: number | null;
  connectedChannelCount: number;
  channelBreakdown: BusinessChannelSummary[];
  executiveBrief: ExecutiveBrief;
  docksBrief: string;
  profitConfidence: ProfitConfidence;
  revenueSeries: BusinessRevenueSeriesPoint[];
  inventoryAttribution: InventoryAttribution;
  inventoryCapital: InventoryCapital;
  signals: TradingDocksSignal[];
  periodDeltas: PeriodDelta[];
  opportunities: BusinessOpportunity[];
  activityFeed: BusinessActivity[];
  nextActions: BusinessNextAction[];
  generatedAt: string;
};

type QueryResult<T> = PromiseLike<{ data: T[] | null; count?: number | null; error?: unknown }>;

type QueryBuilder<T> = QueryResult<T> & {
  eq: (column: string, value: string) => QueryBuilder<T>;
  gte: (column: string, value: string) => QueryBuilder<T>;
  lt: (column: string, value: string) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  in: (column: string, values: string[]) => QueryBuilder<T>;
};

export type DashboardSupabaseClient = CanonicalOrderSupabaseClient & {
  from: <T = Record<string, unknown>>(table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder<T>;
  };
};

type MarketplaceOrderRow = CanonicalOrder;

type MarketplaceConnectionRow = {
  marketplace_id?: string | null;
  status?: string | null;
};

type MarketplaceSyncRunRow = SyncRunRow;

type BusinessSummaryInput = {
  access: PlatformAccessContext;
  range?: BusinessDateRange;
  now?: Date;
  orders: MarketplaceOrderRow[];
  previousOrders?: MarketplaceOrderRow[];
  connections?: MarketplaceConnectionRow[];
  syncRuns?: MarketplaceSyncRunRow[];
  inventoryRows?: InventoryCapitalRow[];
  listingRows?: ListingRow[];
  customerCount?: number | null;
  employeeCount?: number | null;
  vendorCount?: number | null;
  supplyAlertCount?: number | null;
  repricingReviewCount?: number | null;
};

export function canViewBusinessCommandCenter(access: PlatformAccessContext) {
  return hasTrustedFullPlatformAccess(access) || hasCapability(access, "orders.manage");
}

export function canViewStoreOperations(access: PlatformAccessContext) {
  return hasTrustedFullPlatformAccess(access) || hasCapability(access, "employees.manage");
}

export async function loadBusinessCommandCenter({
  supabase,
  access,
  range = "week",
  now = new Date(),
}: {
  supabase: DashboardSupabaseClient;
  access: PlatformAccessContext;
  range?: BusinessDateRange;
  now?: Date;
}) {
  if (!access.userId || !canViewBusinessCommandCenter(access)) {
    return null;
  }

  const window = getBusinessDateWindow(range, now);
  const previous = previousDateWindow(window);
  const storeAccess = canViewStoreOperations(access);

  const [
    ordersResult,
    previousOrdersResult,
    connectionsResult,
    syncRunsResult,
    customersResult,
    employeesResult,
    vendorsResult,
    supplyResult,
    repricingResult,
    inventoryResult,
    listingsResult,
  ] = await Promise.all([
    loadCanonicalOrders({
      supabase,
      userId: access.userId,
      workspaceId: access.workspaceId,
      range: window,
      surface: "business-command-center",
    }),
    loadCanonicalOrders({
      supabase,
      userId: access.userId,
      workspaceId: access.workspaceId,
      range: previous,
      surface: "business-command-center",
    }),
    supabase
      .from<MarketplaceConnectionRow>("marketplace_connections")
      .select("marketplace_id,status")
      .eq("user_id", access.userId),
    supabase
      .from<MarketplaceSyncRunRow>("marketplace_sync_runs")
      .select("marketplace_id,status,created_at")
      .eq("user_id", access.userId)
      .gte("created_at", window.start.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    access.workspaceId
      ? supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", access.workspaceId)
      : Promise.resolve({ data: null, count: null }),
    storeAccess && access.workspaceId
      ? supabase
          .from("workspace_employees")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", access.workspaceId)
      : Promise.resolve({ data: null, count: null }),
    storeAccess && access.workspaceId
      ? supabase
          .from("vendors")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", access.workspaceId)
      : Promise.resolve({ data: null, count: null }),
    storeAccess && access.workspaceId
      ? supabase
          .from("supplies")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", access.workspaceId)
      : Promise.resolve({ data: null, count: null }),
    access.workspaceId
      ? supabase
          .from("inventory_price_reviews")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", access.workspaceId)
          .eq("status", "needs_review")
      : Promise.resolve({ data: null, count: null }),
    supabase
      .from<InventoryCapitalRow>("inventory_items")
      .select("id,quantity,inventory_value,updated_at")
      .eq("user_id", access.userId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from<ListingRow>("marketplace_listing_mappings")
      .select("marketplace_id,inventory_item_id,match_status,last_seen_quantity,last_seen_price,last_seen_at")
      .eq("user_id", access.userId)
      .limit(1000),
  ]);

  return buildBusinessCommandCenterSummary({
    access,
    range,
    now,
    orders: ordersResult.orders,
    previousOrders: previousOrdersResult.orders,
    connections: connectionsResult.data ?? [],
    syncRuns: syncRunsResult.data ?? [],
    inventoryRows: inventoryResult.data ?? [],
    listingRows: listingsResult.data ?? [],
    customerCount: customersResult.count ?? null,
    employeeCount: employeesResult.count ?? null,
    vendorCount: vendorsResult.count ?? null,
    supplyAlertCount: supplyResult.count ?? null,
    repricingReviewCount: repricingResult.count ?? null,
  });
}

export function buildBusinessCommandCenterSummary({
  access,
  range = "week",
  now = new Date(),
  orders,
  previousOrders = [],
  connections = [],
  syncRuns = [],
  inventoryRows = [],
  listingRows = [],
  customerCount = null,
  employeeCount = null,
  vendorCount = null,
  supplyAlertCount = null,
  repricingReviewCount = null,
}: BusinessSummaryInput): BusinessCommandCenterSummary {
  const hasSellerAccess = canViewBusinessCommandCenter(access);
  const hasStoreAccess = canViewStoreOperations(access);
  const connectedIds = [
    connections
      .filter((connection) => normalizeStatus(connection.status) === "ready")
      .map((connection) => normalizeChannelId(connection.marketplace_id))
      .filter((id): id is CanonicalChannelId => Boolean(id)),
  ][0];
  const orderMetrics = summarizeCanonicalOrders(orders, connectedIds);
  const previousOrderMetrics = summarizeCanonicalOrders(previousOrders, connectedIds);
  const syncIssues = syncRuns.filter((run) => normalizeStatus(run.status) === "failed").length;
  const connectedChannelCount = orderMetrics.channels.filter((channel) => channel.connected).length;
  const inventoryAttribution = calculateInventoryAttribution(orders);
  const previousInventoryAttribution = calculateInventoryAttribution(previousOrders);
  const profitConfidence = calculateProfitConfidence(orders, inventoryAttribution);
  const revenueSeries = buildRevenueSeries({ orders, range, now });
  const inventoryCapital = calculateInventoryCapital({ inventoryRows, listingRows, now });
  const channelBreakdown = buildChannelInsights({
    current: orderMetrics.channels,
    previous: previousOrderMetrics.channels,
    syncRuns,
  });
  const periodDeltas = buildPeriodDeltas({
    grossSales: orderMetrics.grossSales,
    previousGrossSales: previousOrderMetrics.grossSales,
    orderCount: orderMetrics.orderCount,
    previousOrderCount: previousOrderMetrics.orderCount,
    averageOrderValue: orderMetrics.averageOrderValue,
    previousAverageOrderValue: previousOrderMetrics.averageOrderValue,
    unmatchedLineCount: inventoryAttribution.unmatchedLineCount,
    previousUnmatchedLineCount: previousInventoryAttribution.unmatchedLineCount,
    realizedProfit: orderMetrics.realizedProfit,
    previousRealizedProfit: previousOrderMetrics.realizedProfit,
  });
  const signals = buildTradingDocksSignals({
    openFulfillmentCount: orderMetrics.openFulfillmentCount,
    listingIssues: orderMetrics.listingIssues,
    repricingReviewCount: repricingReviewCount ?? 0,
    syncIssues,
    inventoryCapital,
    inventoryAttribution,
    orders,
  });
  const nextActions = buildRankedActions({
    signals,
    connectedChannelCount,
    hasStoreAccess,
    employeeCount,
    vendorCount,
    supplyAlertCount,
  });
  const executiveBrief = buildExecutiveBrief({
    rangeLabel: rangeLabel(range, now),
    grossSales: orderMetrics.grossSales,
    previousGrossSales: previousOrderMetrics.grossSales,
    salesChangePercent: percentageChange(previousOrderMetrics.grossSales, orderMetrics.grossSales),
    orderCount: orderMetrics.orderCount,
    previousOrderCount: previousOrderMetrics.orderCount,
    averageOrderValue: orderMetrics.averageOrderValue,
    previousAverageOrderValue: previousOrderMetrics.averageOrderValue,
    connectedChannelCount,
  });

  return {
    range,
    rangeLabel: rangeLabel(range, now),
    workspaceId: access.workspaceId,
    userId: access.userId ?? "",
    hasSellerAccess,
    hasStoreAccess,
    hasFullPlatformAccess: hasTrustedFullPlatformAccess(access),
    grossSales: orderMetrics.grossSales,
    previousGrossSales: previousOrderMetrics.grossSales,
    salesChangePercent: percentageChange(previousOrderMetrics.grossSales, orderMetrics.grossSales),
    orderCount: orderMetrics.orderCount,
    previousOrderCount: previousOrderMetrics.orderCount,
    itemsSold: orderMetrics.unitsSold,
    averageOrderValue: orderMetrics.averageOrderValue,
    realizedProfit: orderMetrics.realizedProfit,
    profitCoverageRatio: orderMetrics.profitCoverageRatio,
    profitKnownUnits: orderMetrics.profitKnownUnits,
    profitTotalUnits: orderMetrics.profitTotalUnits,
    openFulfillmentCount: orderMetrics.openFulfillmentCount,
    listingIssues: orderMetrics.listingIssues,
    syncIssues,
    repricingReviewCount: repricingReviewCount ?? 0,
    customerCount,
    employeeCount: hasStoreAccess ? employeeCount : null,
    vendorCount: hasStoreAccess ? vendorCount : null,
    supplyAlertCount: hasStoreAccess ? supplyAlertCount : null,
    connectedChannelCount,
    channelBreakdown,
    executiveBrief,
    docksBrief: buildDocksBrief({
      rangeLabel: rangeLabel(range, now),
      grossSales: orderMetrics.grossSales,
      orderCount: orderMetrics.orderCount,
      salesChangePercent: percentageChange(previousOrderMetrics.grossSales, orderMetrics.grossSales),
      averageOrderValue: orderMetrics.averageOrderValue,
      previousAverageOrderValue: previousOrderMetrics.averageOrderValue,
      openFulfillmentCount: orderMetrics.openFulfillmentCount,
      inventoryAttribution,
      channelInsights: channelBreakdown,
      signals,
    }),
    profitConfidence,
    revenueSeries,
    inventoryAttribution,
    inventoryCapital,
    signals,
    periodDeltas,
    opportunities: buildOpportunities({ signals, orders }),
    activityFeed: buildActivityFeed({ orders, syncRuns }),
    nextActions,
    generatedAt: now.toISOString(),
  };
}

export function getBusinessDateWindow(range: BusinessDateRange, now: Date) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (range === "90d") {
    start.setDate(start.getDate() - 89);
    start.setHours(0, 0, 0, 0);
  } else if (range === "12m") {
    start.setMonth(start.getMonth() - 11, 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    const day = start.getDay();
    const daysSinceMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function previousDateWindow(window: { start: Date; end: Date }) {
  const duration = window.end.getTime() - window.start.getTime();
  return {
    start: new Date(window.start.getTime() - duration),
    end: new Date(window.start),
  };
}

function rangeLabel(range: BusinessDateRange, now: Date) {
  if (range === "today") return "Today";
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  if (range === "12m") return "Last 12 months";
  if (range === "month") {
    return now.toLocaleString("en-US", { month: "long" });
  }
  return "This week";
}

function buildRevenueSeries({
  orders,
  range,
  now,
}: {
  orders: MarketplaceOrderRow[];
  range: BusinessDateRange;
  now: Date;
}): BusinessRevenueSeriesPoint[] {
  const buckets = buildSeriesBuckets(range, now);
  return buckets.map((bucket) => {
    const bucketOrders = orders.filter((order) => {
      const timestamp = canonicalOrderTimestamp(order);
      return Boolean(timestamp && timestamp >= bucket.start && timestamp < bucket.end);
    });
    const metrics = summarizeCanonicalOrders(bucketOrders);
    return {
      key: bucket.key,
      label: bucket.label,
      axisLabel: bucket.axisLabel,
      start: bucket.start.toISOString(),
      end: bucket.end.toISOString(),
      revenue: metrics.grossSales,
      profitEstimate: metrics.realizedProfit,
      orders: metrics.orderCount,
      profitCoverageRatio: metrics.profitCoverageRatio,
    };
  });
}

function buildSeriesBuckets(range: BusinessDateRange, now: Date) {
  if (range === "12m") {
    const first = getBusinessDateWindow("12m", now).start;
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(first);
      start.setMonth(first.getMonth() + index, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(start.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      return {
        key: start.toISOString().slice(0, 7),
        label: start.toLocaleString("en-US", { month: "short", year: "numeric" }),
        axisLabel: start.toLocaleString("en-US", { month: "short" }),
        start,
        end,
      };
    });
  }

  if (range === "90d") {
    const first = getBusinessDateWindow("90d", now).start;
    return Array.from({ length: 13 }, (_, index) => {
      const start = new Date(first);
      start.setDate(first.getDate() + index * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
      const clampedEnd = index === 12 ? getBusinessDateWindow("90d", now).end : end;
      return {
        key: start.toISOString().slice(0, 10),
        label: `${start.toLocaleString("en-US", { month: "short", day: "numeric" })} week`,
        axisLabel: index % 2 === 0 ? start.toLocaleString("en-US", { month: "short", day: "numeric" }) : "",
        start,
        end: clampedEnd,
      };
    });
  }

  const window = getBusinessDateWindow(range, now);
  const dayCount = Math.max(1, Math.round((window.end.getTime() - window.start.getTime()) / 86_400_000));
  return Array.from({ length: dayCount }, (_, index) => {
    const start = new Date(window.start);
    start.setDate(window.start.getDate() + index);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return {
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleString("en-US", { month: "short", day: "numeric" }),
      axisLabel: shouldLabelDailyAxis(range, index, dayCount)
        ? start.toLocaleString("en-US", { month: "short", day: "numeric" })
        : "",
      start,
      end: index === dayCount - 1 ? window.end : end,
    };
  });
}

function shouldLabelDailyAxis(range: BusinessDateRange, index: number, dayCount: number) {
  if (range === "today") return index === 0;
  if (range === "7d" || range === "week") return true;
  if (range === "month" || range === "30d") return index === 0 || index === dayCount - 1 || index % 7 === 0;
  return false;
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase().replace(/_/g, "-")
    : "";
}

function percentageChange(previous: number, current: number) {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}
