import {
  hasCapability,
  hasTrustedFullPlatformAccess,
  type PlatformAccessContext,
} from "../../../mobile/services/platform-access.ts";
import {
  normalizeChannelId,
  summarizeCanonicalOrders,
  type CanonicalChannelId,
  type CanonicalChannelMetric,
  type CanonicalOrder,
} from "../orders/order-metrics.ts";
import {
  loadCanonicalOrders,
  type CanonicalOrderSupabaseClient,
} from "../orders/order-repository.ts";

export type BusinessDateRange = "today" | "week" | "month";

export type BusinessChannelId = CanonicalChannelId;

export type BusinessChannelSummary = CanonicalChannelMetric;

export type BusinessNextAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  severity: "high" | "medium" | "low";
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

type MarketplaceSyncRunRow = {
  marketplace_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type BusinessSummaryInput = {
  access: PlatformAccessContext;
  range?: BusinessDateRange;
  now?: Date;
  orders: MarketplaceOrderRow[];
  previousOrders?: MarketplaceOrderRow[];
  connections?: MarketplaceConnectionRow[];
  syncRuns?: MarketplaceSyncRunRow[];
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
  ]);

  return buildBusinessCommandCenterSummary({
    access,
    range,
    now,
    orders: ordersResult.orders,
    previousOrders: previousOrdersResult.orders,
    connections: connectionsResult.data ?? [],
    syncRuns: syncRunsResult.data ?? [],
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
      .filter((id): id is BusinessChannelId => Boolean(id)),
  ][0];
  const orderMetrics = summarizeCanonicalOrders(orders, connectedIds);
  const previousOrderMetrics = summarizeCanonicalOrders(previousOrders, connectedIds);
  const syncIssues = syncRuns.filter((run) => normalizeStatus(run.status) === "failed").length;
  const connectedChannelCount = orderMetrics.channels.filter((channel) => channel.connected).length;

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
    openFulfillmentCount: orderMetrics.openFulfillmentCount,
    listingIssues: orderMetrics.listingIssues,
    syncIssues,
    repricingReviewCount: repricingReviewCount ?? 0,
    customerCount,
    employeeCount: hasStoreAccess ? employeeCount : null,
    vendorCount: hasStoreAccess ? vendorCount : null,
    supplyAlertCount: hasStoreAccess ? supplyAlertCount : null,
    connectedChannelCount,
    channelBreakdown: orderMetrics.channels,
    nextActions: buildNextActions({
      connectedChannelCount,
      openFulfillmentCount: orderMetrics.openFulfillmentCount,
      listingIssues: orderMetrics.listingIssues,
      syncIssues,
      repricingReviewCount: repricingReviewCount ?? 0,
      hasStoreAccess,
      employeeCount,
      vendorCount,
      supplyAlertCount,
    }),
    generatedAt: now.toISOString(),
  };
}

function buildNextActions(input: {
  connectedChannelCount: number;
  openFulfillmentCount: number;
  listingIssues: number;
  syncIssues: number;
  repricingReviewCount: number;
  hasStoreAccess: boolean;
  employeeCount: number | null;
  vendorCount: number | null;
  supplyAlertCount: number | null;
}) {
  const actions: BusinessNextAction[] = [];
  if (input.syncIssues > 0) {
    actions.push({
      id: "sync-issues",
      label: "Review marketplace sync issues",
      detail: `${input.syncIssues} failed sync ${input.syncIssues === 1 ? "run" : "runs"} need attention.`,
      href: "/dashboard/marketplaces",
      severity: "high",
    });
  }
  if (input.openFulfillmentCount > 0) {
    actions.push({
      id: "open-fulfillment",
      label: "Fulfill open orders",
      detail: `${input.openFulfillmentCount} order${input.openFulfillmentCount === 1 ? "" : "s"} awaiting fulfillment or review.`,
      href: "/dashboard/orders",
      severity: "high",
    });
  }
  if (input.listingIssues > 0) {
    actions.push({
      id: "listing-issues",
      label: "Match order items to inventory",
      detail: `${input.listingIssues} sold item${input.listingIssues === 1 ? "" : "s"} need matching or conflict review.`,
      href: "/dashboard/orders",
      severity: "medium",
    });
  }
  if (input.repricingReviewCount > 0) {
    actions.push({
      id: "repricing-review",
      label: "Review repricing queue",
      detail: `${input.repricingReviewCount} inventory price ${input.repricingReviewCount === 1 ? "change" : "changes"} ready for review.`,
      href: "/dashboard/label-studio",
      severity: "medium",
    });
  }
  if (input.connectedChannelCount === 0) {
    actions.push({
      id: "connect-marketplace",
      label: "Connect a sales channel",
      detail: "Connect TCGplayer, eBay, Mana Pool, or another channel to populate live sales.",
      href: "/dashboard/marketplaces",
      severity: "medium",
    });
  }
  if (input.hasStoreAccess && !input.employeeCount) {
    actions.push({
      id: "team-setup",
      label: "Set up store staff",
      detail: "Add employees when you are ready to delegate shared store operations.",
      href: "/dashboard/employees",
      severity: "low",
    });
  }
  if (input.hasStoreAccess && !input.vendorCount) {
    actions.push({
      id: "vendor-setup",
      label: "Add vendor relationships",
      detail: "Track vendor terms, purchase orders, and replenishment sources.",
      href: "/dashboard/vendors",
      severity: "low",
    });
  }
  if (input.hasStoreAccess && input.supplyAlertCount === 0) {
    actions.push({
      id: "supply-alerts",
      label: "Configure supply alerts",
      detail: "Track sleeves, labels, shipping materials, and store operating supplies.",
      href: "/dashboard/supplies",
      severity: "low",
    });
  }

  return actions.slice(0, 5);
}

export function getBusinessDateWindow(range: BusinessDateRange, now: Date) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (range === "today") {
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
  if (range === "month") {
    return now.toLocaleString("en-US", { month: "long" });
  }
  return "This week";
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
