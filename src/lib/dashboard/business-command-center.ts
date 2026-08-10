import {
  hasCapability,
  hasTrustedFullPlatformAccess,
  type PlatformAccessContext,
} from "../../../mobile/services/platform-access.ts";

export type BusinessDateRange = "today" | "week" | "month";

export type BusinessChannelId =
  | "tcgplayer"
  | "ebay"
  | "shopify"
  | "manual"
  | "pos"
  | "mana-pool"
  | "other";

export type BusinessChannelSummary = {
  id: BusinessChannelId;
  label: string;
  connected: boolean;
  grossSales: number;
  orderCount: number;
  itemCount: number;
  averageOrderValue: number | null;
};

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

export type DashboardSupabaseClient = {
  from: <T = Record<string, unknown>>(table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder<T>;
  };
};

type MarketplaceOrderRow = {
  id?: string | null;
  marketplace_id?: string | null;
  source_type?: string | null;
  total?: number | string | null;
  net_profit?: number | string | null;
  normalized_status?: string | null;
  fulfillment_stage?: string | null;
  ordered_at?: string | null;
};

type MarketplaceOrderItemRow = {
  marketplace_order_id?: string | null;
  quantity?: number | string | null;
  match_status?: string | null;
};

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
  orderItems?: MarketplaceOrderItemRow[];
  connections?: MarketplaceConnectionRow[];
  syncRuns?: MarketplaceSyncRunRow[];
  customerCount?: number | null;
  employeeCount?: number | null;
  vendorCount?: number | null;
  supplyAlertCount?: number | null;
  repricingReviewCount?: number | null;
};

const CHANNELS: Array<{ id: BusinessChannelId; label: string; aliases: string[] }> = [
  { id: "tcgplayer", label: "TCGplayer", aliases: ["tcgplayer", "tcg-player"] },
  { id: "ebay", label: "eBay", aliases: ["ebay"] },
  { id: "shopify", label: "Shopify", aliases: ["shopify"] },
  { id: "manual", label: "Manual / Direct", aliases: ["manual", "direct", "email"] },
  { id: "pos", label: "POS", aliases: ["pos"] },
  { id: "mana-pool", label: "Mana Pool", aliases: ["mana-pool", "manapool"] },
];

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

  const window = dateWindow(range, now);
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
    supabase
      .from<MarketplaceOrderRow>("marketplace_orders")
      .select("id,marketplace_id,source_type,total,net_profit,normalized_status,fulfillment_stage,ordered_at")
      .eq("user_id", access.userId)
      .gte("ordered_at", window.start.toISOString())
      .lt("ordered_at", window.end.toISOString())
      .order("ordered_at", { ascending: false })
      .limit(1000),
    supabase
      .from<MarketplaceOrderRow>("marketplace_orders")
      .select("id,marketplace_id,source_type,total,net_profit,normalized_status,fulfillment_stage,ordered_at")
      .eq("user_id", access.userId)
      .gte("ordered_at", previous.start.toISOString())
      .lt("ordered_at", previous.end.toISOString())
      .limit(1000),
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

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id).filter((id): id is string => Boolean(id));
  const itemResult = orderIds.length
    ? await supabase
        .from<MarketplaceOrderItemRow>("marketplace_order_items")
        .select("marketplace_order_id,quantity,match_status")
        .eq("user_id", access.userId)
        .in("marketplace_order_id", orderIds)
    : { data: [] };

  return buildBusinessCommandCenterSummary({
    access,
    range,
    now,
    orders,
    previousOrders: previousOrdersResult.data ?? [],
    orderItems: itemResult.data ?? [],
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
  orderItems = [],
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
  const connectedIds = new Set(
    connections
      .filter((connection) => normalizeStatus(connection.status) === "ready")
      .map((connection) => channelIdFor(connection.marketplace_id))
      .filter((id): id is BusinessChannelId => Boolean(id)),
  );
  const itemCountsByOrder = orderItems.reduce((map, item) => {
    const orderId = typeof item.marketplace_order_id === "string" ? item.marketplace_order_id : null;
    if (!orderId) return map;
    map.set(orderId, (map.get(orderId) ?? 0) + Math.max(0, numeric(item.quantity)));
    return map;
  }, new Map<string, number>());
  const grossSales = sumMoney(orders.map((order) => order.total));
  const previousGrossSales = sumMoney(previousOrders.map((order) => order.total));
  const realizedProfitValues = orders.map((order) => numericOrNull(order.net_profit));
  const realizedProfit = realizedProfitValues.some((value) => value !== null)
    ? realizedProfitValues.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
  const orderCount = orders.length;
  const itemsSold = orders.reduce((count, order) => count + (order.id ? itemCountsByOrder.get(order.id) ?? 0 : 0), 0);
  const openFulfillmentCount = orders.filter(isOpenOrder).length;
  const listingIssues = orderItems.filter((item) => {
    const status = normalizeStatus(item.match_status);
    return !status || status === "unmatched" || status === "conflict";
  }).length;
  const syncIssues = syncRuns.filter((run) => normalizeStatus(run.status) === "failed").length;
  const channelBreakdown = buildChannelBreakdown(orders, itemCountsByOrder, connectedIds);
  const connectedChannelCount = channelBreakdown.filter((channel) => channel.connected).length;

  return {
    range,
    rangeLabel: rangeLabel(range, now),
    workspaceId: access.workspaceId,
    userId: access.userId ?? "",
    hasSellerAccess,
    hasStoreAccess,
    hasFullPlatformAccess: hasTrustedFullPlatformAccess(access),
    grossSales,
    previousGrossSales,
    salesChangePercent: percentageChange(previousGrossSales, grossSales),
    orderCount,
    previousOrderCount: previousOrders.length,
    itemsSold,
    averageOrderValue: orderCount ? grossSales / orderCount : null,
    realizedProfit,
    openFulfillmentCount,
    listingIssues,
    syncIssues,
    repricingReviewCount: repricingReviewCount ?? 0,
    customerCount,
    employeeCount: hasStoreAccess ? employeeCount : null,
    vendorCount: hasStoreAccess ? vendorCount : null,
    supplyAlertCount: hasStoreAccess ? supplyAlertCount : null,
    connectedChannelCount,
    channelBreakdown,
    nextActions: buildNextActions({
      connectedChannelCount,
      openFulfillmentCount,
      listingIssues,
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

function buildChannelBreakdown(
  orders: MarketplaceOrderRow[],
  itemCountsByOrder: Map<string, number>,
  connectedIds: Set<BusinessChannelId>,
) {
  const summaries = new Map<BusinessChannelId, BusinessChannelSummary>();
  for (const channel of CHANNELS) {
    summaries.set(channel.id, {
      id: channel.id,
      label: channel.label,
      connected: connectedIds.has(channel.id),
      grossSales: 0,
      orderCount: 0,
      itemCount: 0,
      averageOrderValue: null,
    });
  }

  for (const order of orders) {
    const id = channelIdFor(order.marketplace_id) ?? channelIdFor(order.source_type) ?? "other";
    if (!summaries.has(id)) {
      summaries.set(id, {
        id,
        label: "Other",
        connected: connectedIds.has(id),
        grossSales: 0,
        orderCount: 0,
        itemCount: 0,
        averageOrderValue: null,
      });
    }
    const summary = summaries.get(id);
    if (!summary) continue;
    summary.grossSales += numeric(order.total);
    summary.orderCount += 1;
    summary.itemCount += order.id ? itemCountsByOrder.get(order.id) ?? 0 : 0;
    summary.connected = summary.connected || connectedIds.has(id) || summary.orderCount > 0;
  }

  return [...summaries.values()].map((summary) => ({
    ...summary,
    averageOrderValue: summary.orderCount ? summary.grossSales / summary.orderCount : null,
  }));
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

function dateWindow(range: BusinessDateRange, now: Date) {
  const end = new Date(now);
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
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

function channelIdFor(value: unknown): BusinessChannelId | null {
  const normalized = normalizeStatus(value);
  if (!normalized) return null;
  for (const channel of CHANNELS) {
    if (channel.aliases.includes(normalized)) return channel.id;
  }
  if (normalized === "api" || normalized === "csv" || normalized === "email") return "manual";
  return "other";
}

function isOpenOrder(order: MarketplaceOrderRow) {
  const status = normalizeStatus(order.normalized_status);
  const fulfillment = normalizeStatus(order.fulfillment_stage);
  return status === "new" ||
    status === "processing" ||
    fulfillment === "needs_review" ||
    fulfillment === "picking" ||
    fulfillment === "packing";
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase().replace(/_/g, "-")
    : "";
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return numeric(value);
}

function sumMoney(values: unknown[]): number {
  return values.reduce<number>((total, value) => total + numeric(value), 0);
}

function percentageChange(previous: number, current: number) {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}
