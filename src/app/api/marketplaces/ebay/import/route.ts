import { NextResponse } from "next/server";

import { ebayJson, getEbayAccess } from "@/lib/marketplaces/ebay";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 200;
const OFFER_CONCURRENCY = 12;
const STALE_RUN_MINUTES = 5;

type Amount = { value?: string; currency?: string };
type InventoryItem = {
  sku: string;
  condition?: string;
  availability?: { shipToLocationAvailability?: { quantity?: number } };
  product?: {
    title?: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
    brand?: string;
    mpn?: string;
  };
};
type Offer = {
  offerId?: string;
  listing?: { listingId?: string };
  sku?: string;
  status?: string;
  pricingSummary?: { price?: Amount };
  availableQuantity?: number;
};
type ImportedInventoryRow = {
  id: string;
  sku?: string | null;
  card_name?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  data?: unknown;
};
type SavedOrderRow = {
  id: string;
};
type Order = {
  orderId: string;
  creationDate?: string;
  lastModifiedDate?: string;
  orderPaymentStatus?: string;
  orderFulfillmentStatus?: string;
  cancelStatus?: { cancelState?: string };
  buyer?: { username?: string };
  pricingSummary?: {
    priceSubtotal?: Amount;
    deliveryCost?: Amount;
    tax?: Amount;
    total?: Amount;
  };
  lineItems?: Array<{
    lineItemId: string;
    legacyItemId?: string;
    sku?: string;
    title?: string;
    quantity?: number;
    lineItemCost?: Amount;
  }>;
};

type Page<T> = {
  total?: number;
  inventoryItems?: T[];
  orders?: T[];
};

const number = (value?: string) => value == null ? null : Number(value);
const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

async function mapConcurrent<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

async function getAllPages<T>(
  apiBase: string,
  accessToken: string,
  endpoint: string,
  key: "inventoryItems" | "orders",
  extra = "",
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const page = await ebayJson<Page<T>>(
      apiBase,
      accessToken,
      `${endpoint}${separator}limit=${PAGE_SIZE}&offset=${offset}${extra}`,
    );
    const batch = (page[key] ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE || rows.length >= (page.total ?? rows.length)) break;
  }
  return rows;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to import eBay data." }, { status: 401 });

  const { admin, accessToken, apiBase } = await getEbayAccess(user.id);

  // A serverless timeout cannot execute the catch block. Recover runs left behind by
  // an interrupted invocation so the account is never permanently sync-locked.
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
  await admin.from("marketplace_sync_runs").update({
    status: "failed",
    summary: { error: "The previous import was interrupted and was automatically unlocked." },
    completed_at: new Date().toISOString(),
  }).eq("user_id", user.id).eq("marketplace_id", "ebay")
    .in("status", ["queued", "processing"]).lt("created_at", staleBefore);

  const { data: activeRun } = await admin.from("marketplace_sync_runs")
    .select("id,created_at").eq("user_id", user.id).eq("marketplace_id", "ebay")
    .in("status", ["queued", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (activeRun) {
    return NextResponse.json({ error: "An eBay import is already running." }, { status: 409 });
  }

  const { data: run, error: runError } = await admin.from("marketplace_sync_runs").insert({
    user_id: user.id,
    marketplace_id: "ebay",
    sync_type: "read_only_import",
    status: "processing",
    summary: { mode: "read_only", started_at: new Date().toISOString() },
  }).select("id").single();
  if (runError || !run) return NextResponse.json({ error: runError?.message ?? "Could not start import." }, { status: 500 });

  try {
    const [{ data: inventory }, inventoryResult, ordersResult] = await Promise.all([
      admin.from("inventory_items").select("id,sku,card_name,set_code,collector_number,data").eq("user_id", user.id),
      getAllPages<InventoryItem>(apiBase, accessToken, "/sell/inventory/v1/inventory_item", "inventoryItems")
        .then((rows) => ({ rows, warning: null as string | null }))
        .catch((error: unknown) => ({
          rows: [] as InventoryItem[],
          warning: error instanceof Error ? error.message : "eBay inventory details were temporarily unavailable.",
        })),
      getAllPages<Order>(apiBase, accessToken, "/sell/fulfillment/v1/order", "orders", "&fieldGroups=TAX_BREAKDOWN")
        .then((rows) => ({ rows, warning: null as string | null }))
        .catch((error: unknown) => ({
          rows: [] as Order[],
          warning: error instanceof Error ? error.message : "eBay orders were temporarily unavailable.",
        })),
    ]);
    const ebayInventory = inventoryResult.rows;
    const ebayOrders = ordersResult.rows;
    const warnings = [inventoryResult.warning, ordersResult.warning].filter((warning): warning is string => Boolean(warning));
    if (inventoryResult.warning && ordersResult.warning) {
      throw new Error(`eBay could not return inventory or orders. ${warnings.join(" ")}`);
    }

    const inventoryRows = (inventory ?? []) as ImportedInventoryRow[];
    const bySku = new Map(inventoryRows.filter((item) => item.sku).map((item) => [normalize(item.sku ?? undefined), item]));
    const byIdentity = new Map(inventoryRows.map((item) => [
      [normalize(item.card_name), normalize(item.set_code), normalize(item.collector_number)].join("|"), item,
    ]));
    let matched = 0;
    let suggested = 0;
    let unmatched = 0;
    let listingCount = 0;

    const inventoryWithOffers = await mapConcurrent(ebayInventory, OFFER_CONCURRENCY, async (item) => {
      const offers = await ebayJson<{ offers?: Offer[] }>(
        apiBase, accessToken, `/sell/inventory/v1/offer?sku=${encodeURIComponent(item.sku)}&limit=100`,
      );
      return { item, offers: offers.offers ?? [] };
    });

    const listingRows: Array<Record<string, unknown>> = [];
    for (const { item, offers } of inventoryWithOffers) {
      const aspects = item.product?.aspects ?? {};
      const identity = [
        normalize(item.product?.title),
        normalize(aspects.Set?.[0] ?? aspects["Set Name"]?.[0]),
        normalize(aspects["Card Number"]?.[0] ?? aspects["Collector Number"]?.[0]),
      ].join("|");
      const exact = bySku.get(normalize(item.sku));
      const candidate = exact ?? byIdentity.get(identity);
      const matchStatus = exact ? "matched" : candidate ? "suggested" : "unmatched";
      if (matchStatus === "matched") matched += 1;
      else if (matchStatus === "suggested") suggested += 1;
      else unmatched += 1;

      for (const offer of offers.length ? offers : [{}]) {
        const externalId = offer.listing?.listingId ?? offer.offerId ?? `sku:${item.sku}`;
        listingRows.push({
          user_id: user.id,
          marketplace_id: "ebay",
          inventory_item_id: candidate?.id ?? null,
          trading_docks_sku: candidate?.sku ?? item.sku,
          external_listing_id: externalId,
          external_offer_id: offer.offerId ?? null,
          external_sku: item.sku,
          match_status: matchStatus,
          last_seen_quantity: offer.availableQuantity ?? item.availability?.shipToLocationAvailability?.quantity ?? 0,
          last_seen_price: number(offer.pricingSummary?.price?.value),
          raw_snapshot: { inventoryItem: item, offer },
          last_seen_at: new Date().toISOString(),
        });
        listingCount += 1;
      }
    }

    if (listingRows.length) {
      const { error } = await admin.from("marketplace_listing_mappings")
        .upsert(listingRows, { onConflict: "user_id,marketplace_id,external_listing_id" });
      if (error) throw error;
    }

    let orderCount = 0;
    let orderItemCount = 0;
    const orderRows = ebayOrders.map((order) => {
      const summary = order.pricingSummary;
      return {
        user_id: user.id,
        marketplace_id: "ebay",
        external_order_id: order.orderId,
        order_status: order.cancelStatus?.cancelState ?? "ACTIVE",
        payment_status: order.orderPaymentStatus ?? null,
        fulfillment_status: order.orderFulfillmentStatus ?? null,
        currency: summary?.total?.currency ?? summary?.priceSubtotal?.currency ?? "USD",
        subtotal: number(summary?.priceSubtotal?.value),
        shipping: number(summary?.deliveryCost?.value),
        tax: number(summary?.tax?.value),
        total: number(summary?.total?.value),
        buyer_alias: order.buyer?.username ?? null,
        ordered_at: order.creationDate ?? null,
        last_modified_at: order.lastModifiedDate ?? null,
        raw_snapshot: order,
        updated_at: new Date().toISOString(),
      };
    });
    const savedOrders: Array<SavedOrderRow & { external_order_id: string }> = [];
    if (orderRows.length) {
      const { data, error } = await admin.from("marketplace_orders")
        .upsert(orderRows, { onConflict: "user_id,marketplace_id,external_order_id" })
        .select("id,external_order_id");
      if (error || !data) throw error ?? new Error("Could not save imported orders.");
      savedOrders.push(...(data as Array<SavedOrderRow & { external_order_id: string }>));
    }
    orderCount = savedOrders.length;
    const savedOrderIds = new Map(savedOrders.map((order) => [order.external_order_id, order.id]));
    const orderItemRows: Array<Record<string, unknown>> = [];

    for (const order of ebayOrders) {
      const savedOrderId = savedOrderIds.get(order.orderId);
      if (!savedOrderId) continue;
      for (const line of order.lineItems ?? []) {
        const candidate = line.sku ? bySku.get(normalize(line.sku)) : undefined;
        const status = candidate ? "matched" : "unmatched";
        orderItemRows.push({
          user_id: user.id,
          marketplace_order_id: savedOrderId,
          external_line_item_id: line.lineItemId,
          external_listing_id: line.legacyItemId ?? null,
          external_sku: line.sku ?? null,
          title: line.title ?? "",
          quantity: line.quantity ?? 1,
          unit_price: number(line.lineItemCost?.value),
          currency: line.lineItemCost?.currency ?? "USD",
          inventory_item_id: candidate?.id ?? null,
          match_status: status,
          raw_snapshot: line,
          updated_at: new Date().toISOString(),
        });
        orderItemCount += 1;
      }
    }
    if (orderItemRows.length) {
      const { error } = await admin.from("marketplace_order_items")
        .upsert(orderItemRows, { onConflict: "user_id,marketplace_order_id,external_line_item_id" });
      if (error) throw error;
    }

    const summary = {
      listings: listingCount,
      orders: orderCount,
      order_items: orderItemCount,
      matched,
      suggested,
      unmatched,
      warnings,
    };
    await Promise.all([
      admin.from("marketplace_sync_runs").update({
        status: "completed",
        records_seen: listingCount + orderCount,
        records_changed: 0,
        summary,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id),
      admin.from("marketplace_connections").update({
        last_sync_at: new Date().toISOString(),
        health: warnings.length ? "attention" : "healthy",
        next_sync_at: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("marketplace_id", "ebay"),
    ]);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "eBay import failed.";
    await admin.from("marketplace_sync_runs").update({
      status: "failed",
      summary: { error: message },
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    await admin.from("marketplace_connections").update({
      health: "attention",
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).eq("marketplace_id", "ebay");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
