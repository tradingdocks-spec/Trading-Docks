import {
  filterOrdersByCanonicalDateRange,
  normalizeChannelId,
  summarizeCanonicalOrders,
  type CanonicalChannelId,
  type CanonicalOrder,
} from "./order-metrics.ts";

export type CanonicalOrderDateRange = {
  start: Date;
  end: Date;
};

export type CanonicalOrderQueryDiagnostics = {
  surface: "orders-center" | "business-command-center";
  userId: string;
  workspaceId: string | null;
  table: "marketplace_orders";
  selectedColumns: string;
  startTimestamp: string | null;
  endTimestamp: string | null;
  timezone: "server-local-calendar";
  tenantPredicate: "user_id";
  statusFilters: [];
  channelFilters: [];
  rawRowsReturned: number;
  rowsAfterDateRange: number;
  rowsMissingOrderedAt: number;
  rowsUsingCreatedAtFallback: number;
  sampleOrder: {
    id: string | null;
    workspace_id: null;
    channel: CanonicalChannelId | null;
    ordered_at: string | null;
    created_at: string | null;
    total: number | string | null | undefined;
    status: string | null | undefined;
  } | null;
};

type QueryBuilder<T> = PromiseLike<{ data: T[] | null; count?: number | null; error?: { message?: string } | null }> & {
  eq: (column: string, value: string) => QueryBuilder<T>;
  gte: (column: string, value: string) => QueryBuilder<T>;
  lt: (column: string, value: string) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  in: (column: string, values: string[]) => QueryBuilder<T>;
};

export type CanonicalOrderSupabaseClient = {
  from: <T = Record<string, unknown>>(table: string) => {
    select: (columns: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder<T>;
  };
};

export const CANONICAL_ORDER_SELECT =
  "*, marketplace_order_items(*)";

export async function loadCanonicalOrders({
  supabase,
  userId,
  workspaceId,
  range = null,
  surface,
  limit = 1000,
}: {
  supabase: CanonicalOrderSupabaseClient;
  userId: string;
  workspaceId: string | null;
  range?: CanonicalOrderDateRange | null;
  surface: CanonicalOrderQueryDiagnostics["surface"];
  limit?: number;
}) {
  const result = await supabase
    .from<CanonicalOrder>("marketplace_orders")
    .select(CANONICAL_ORDER_SELECT)
    .eq("user_id", userId)
    .order("ordered_at", { ascending: false })
    .limit(limit);

  if (result.error) {
    throw new Error(result.error.message ?? "Could not load marketplace orders.");
  }

  const rawOrders = result.data ?? [];
  const orders = filterOrdersByCanonicalDateRange(rawOrders, range);
  const diagnostics = buildCanonicalOrderDiagnostics({
    surface,
    userId,
    workspaceId,
    range,
    rawOrders,
    filteredOrders: orders,
  });

  if (process.env.NODE_ENV === "production" || process.env.TD_ORDER_RECONCILIATION_DEBUG === "1") {
    console.info("Trading Docks canonical order query", diagnostics);
  }

  return {
    orders,
    rawOrders,
    diagnostics,
    metrics: summarizeCanonicalOrders(orders),
  };
}

function buildCanonicalOrderDiagnostics({
  surface,
  userId,
  workspaceId,
  range,
  rawOrders,
  filteredOrders,
}: {
  surface: CanonicalOrderQueryDiagnostics["surface"];
  userId: string;
  workspaceId: string | null;
  range: CanonicalOrderDateRange | null;
  rawOrders: CanonicalOrder[];
  filteredOrders: CanonicalOrder[];
}): CanonicalOrderQueryDiagnostics {
  const sample = filteredOrders[0] ?? rawOrders[0] ?? null;

  return {
    surface,
    userId,
    workspaceId,
    table: "marketplace_orders",
    selectedColumns: CANONICAL_ORDER_SELECT,
    startTimestamp: range?.start.toISOString() ?? null,
    endTimestamp: range?.end.toISOString() ?? null,
    timezone: "server-local-calendar",
    tenantPredicate: "user_id",
    statusFilters: [],
    channelFilters: [],
    rawRowsReturned: rawOrders.length,
    rowsAfterDateRange: filteredOrders.length,
    rowsMissingOrderedAt: rawOrders.filter((order) => !order.ordered_at).length,
    rowsUsingCreatedAtFallback: rawOrders.filter((order) => !order.ordered_at && order.created_at).length,
    sampleOrder: sample
      ? {
          id: sample.id ?? null,
          workspace_id: null,
          channel: normalizeChannelId(sample.marketplace_id),
          ordered_at: sample.ordered_at ?? null,
          created_at: sample.created_at ?? null,
          total: sample.total,
          status: sample.normalized_status ?? sample.order_status,
        }
      : null,
  };
}
