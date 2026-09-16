import { calculateRealizedProfit } from "../financials/domain.ts";

export type CanonicalChannelId =
  | "tcgplayer"
  | "ebay"
  | "shopify"
  | "manual"
  | "pos"
  | "mana-pool"
  | "other";

export type CanonicalOrderItem = {
  marketplace_order_id?: string | null;
  external_sku?: string | null;
  title?: string | null;
  quantity?: number | string | null;
  inventory_item_id?: string | null;
  match_status?: string | null;
  unit_price?: number | string | null;
  unit_cost?: number | string | null;
  marketplace_fee?: number | string | null;
  realized_profit?: number | string | null;
};

export type CanonicalOrder = {
  id?: string | null;
  marketplace_id?: string | null;
  source_type?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  normalized_status?: string | null;
  fulfillment_stage?: string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  tax?: number | string | null;
  marketplace_fees?: number | string | null;
  shipping_cost?: number | string | null;
  cost_of_goods?: number | string | null;
  refund_amount?: number | string | null;
  net_profit?: number | string | null;
  ordered_at?: string | null;
  created_at?: string | null;
  marketplace_order_items?: CanonicalOrderItem[] | null;
};

export type CanonicalChannelMetric = {
  id: CanonicalChannelId;
  label: string;
  connected: boolean;
  grossSales: number;
  orderCount: number;
  itemCount: number;
  averageOrderValue: number | null;
};

export type CanonicalOrderMetrics = {
  grossSales: number;
  orderCount: number;
  unitsSold: number;
  averageOrderValue: number | null;
  realizedProfit: number | null;
  profitCoverageRatio: number;
  profitKnownUnits: number;
  profitTotalUnits: number;
  openFulfillmentCount: number;
  listingIssues: number;
  channels: CanonicalChannelMetric[];
};

const CHANNELS: Array<{ id: CanonicalChannelId; label: string; aliases: string[] }> = [
  { id: "tcgplayer", label: "TCGplayer", aliases: ["tcgplayer", "tcg-player", "tcg_player", "tcg player"] },
  { id: "ebay", label: "eBay", aliases: ["ebay", "e-bay", "e bay"] },
  { id: "shopify", label: "Shopify", aliases: ["shopify"] },
  { id: "manual", label: "Manual / Direct", aliases: ["manual", "direct", "email"] },
  { id: "pos", label: "POS", aliases: ["pos", "in-store", "instore", "point-of-sale"] },
  { id: "mana-pool", label: "Mana Pool", aliases: ["mana-pool", "manapool", "mana pool"] },
];

export function summarizeCanonicalOrders(
  orders: CanonicalOrder[],
  connectedChannels: Iterable<string> = [],
): CanonicalOrderMetrics {
  const connectedIds = new Set(
    [...connectedChannels]
      .map((channel) => normalizeChannelId(channel))
      .filter((channel): channel is CanonicalChannelId => Boolean(channel)),
  );
  const channelMap = new Map<CanonicalChannelId, CanonicalChannelMetric>();

  for (const channel of CHANNELS) {
    channelMap.set(channel.id, {
      id: channel.id,
      label: channel.label,
      connected: connectedIds.has(channel.id),
      grossSales: 0,
      orderCount: 0,
      itemCount: 0,
      averageOrderValue: null,
    });
  }

  let grossSales = 0;
  let unitsSold = 0;
  let openFulfillmentCount = 0;
  let listingIssues = 0;
  let knownRealizedProfit = 0;
  let profitKnownUnits = 0;
  let profitTotalUnits = 0;

  for (const order of orders) {
    const status = normalizeOrderStatus(order);
    const refund = numeric(order.refund_amount);
    const orderGross = status === "cancelled" ? 0 : numeric(order.total) - refund;
    const items = order.marketplace_order_items ?? [];
    const orderUnits = items.reduce((count, item) => count + Math.max(0, numeric(item.quantity)), 0);
    const unmatched = items.some((item) => {
      const matchStatus = normalizeText(item.match_status);
      return !matchStatus || matchStatus === "unmatched" || matchStatus === "conflict";
    });
    const channelId = normalizeChannelId(order.marketplace_id) ?? normalizeChannelId(order.source_type) ?? "other";

    grossSales += orderGross;
    unitsSold += orderUnits;
    const financials = calculateOrderProfit(order, orderGross, orderUnits);
    if (financials.realizedProfit !== null) {
      knownRealizedProfit += financials.realizedProfit;
      profitKnownUnits += orderUnits;
    }
    profitTotalUnits += orderUnits;
    if (isOpenOrder(order)) openFulfillmentCount += 1;
    if (unmatched) listingIssues += 1;

    if (!channelMap.has(channelId)) {
      channelMap.set(channelId, {
        id: channelId,
        label: channelLabel(channelId),
        connected: connectedIds.has(channelId),
        grossSales: 0,
        orderCount: 0,
        itemCount: 0,
        averageOrderValue: null,
      });
    }

    const channel = channelMap.get(channelId);
    if (channel) {
      channel.connected = channel.connected || connectedIds.has(channelId) || true;
      channel.grossSales += orderGross;
      channel.orderCount += 1;
      channel.itemCount += orderUnits;
    }
  }

  const realizedProfit = profitKnownUnits > 0 ? knownRealizedProfit : null;
  const orderCount = orders.length;

  return {
    grossSales,
    orderCount,
    unitsSold,
    averageOrderValue: orderCount ? grossSales / orderCount : null,
    realizedProfit,
    profitCoverageRatio: profitTotalUnits > 0 ? profitKnownUnits / profitTotalUnits : 0,
    profitKnownUnits,
    profitTotalUnits,
    openFulfillmentCount,
    listingIssues,
    channels: [...channelMap.values()].map((channel) => ({
      ...channel,
      averageOrderValue: channel.orderCount ? channel.grossSales / channel.orderCount : null,
    })),
  };
}

export function canonicalOrderTimestamp(order: CanonicalOrder) {
  const orderedAt = parseDate(order.ordered_at);
  if (orderedAt) return orderedAt;
  return parseDate(order.created_at);
}

export function filterOrdersByCanonicalDateRange(
  orders: CanonicalOrder[],
  range: { start: Date; end: Date } | null,
) {
  if (!range) return orders;
  return orders.filter((order) => {
    const timestamp = canonicalOrderTimestamp(order);
    return Boolean(timestamp && timestamp >= range.start && timestamp < range.end);
  });
}

export function normalizeOrderStatus(order: CanonicalOrder) {
  const normalized = normalizeText(order.normalized_status);
  if (
    normalized === "new" ||
    normalized === "processing" ||
    normalized === "shipped" ||
    normalized === "delivered" ||
    normalized === "cancelled" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  const raw = `${order.order_status ?? ""} ${order.fulfillment_status ?? ""} ${order.payment_status ?? ""}`.toLowerCase();
  if (raw.includes("refund")) return "refunded";
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("deliver")) return "delivered";
  if (raw.includes("ship") || raw.includes("fulfill")) return "shipped";
  if (raw.includes("process") || raw.includes("paid")) return "processing";
  return "new";
}

export function normalizeChannelId(value: unknown): CanonicalChannelId | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  for (const channel of CHANNELS) {
    if (channel.aliases.includes(normalized)) return channel.id;
  }
  if (normalized === "api" || normalized === "csv") return "manual";
  return "other";
}

export function channelLabel(value: unknown) {
  const id = normalizeChannelId(value);
  if (!id) return "Other";
  return CHANNELS.find((channel) => channel.id === id)?.label ?? "Other";
}

function isOpenOrder(order: CanonicalOrder) {
  const status = normalizeOrderStatus(order);
  const fulfillment = normalizeText(order.fulfillment_stage);
  return status === "new" ||
    status === "processing" ||
    fulfillment === "needs-review" ||
    fulfillment === "picking" ||
    fulfillment === "packing";
}

function calculateOrderProfit(order: CanonicalOrder, orderGross: number, orderUnits: number) {
  const explicitCostOfGoods = numericOrNull(order.cost_of_goods);
  const itemCosts = (order.marketplace_order_items ?? []).reduce((sum, item) => {
    const quantity = Math.max(0, numeric(item.quantity));
    const unitCost = numericOrNull(item.unit_cost);
    return unitCost === null ? sum : sum + (unitCost * quantity);
  }, 0);
  const hasKnownCost = explicitCostOfGoods !== null && explicitCostOfGoods > 0
    ? true
    : itemCosts > 0;
  const allocatedCostBasis = explicitCostOfGoods !== null && explicitCostOfGoods > 0
    ? explicitCostOfGoods
    : itemCosts > 0
      ? itemCosts
      : null;
  const lineFees = (order.marketplace_order_items ?? []).reduce((sum, item) => sum + numeric(item.marketplace_fee), 0);
  const authoritativeNetProfit = numericOrNull(order.net_profit);
  if (hasKnownCost && authoritativeNetProfit !== null) {
    return {
      realizedProfit: authoritativeNetProfit,
    };
  }
  return calculateRealizedProfit({
    grossSale: orderGross,
    taxCollected: order.tax,
    marketplaceFees: numeric(order.marketplace_fees) + lineFees,
    sellerShipping: order.shipping_cost,
    refunds: order.refund_amount,
    allocatedCostBasis,
    costBasisKnown: hasKnownCost,
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase().replace(/[_\s]+/g, "-")
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

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
