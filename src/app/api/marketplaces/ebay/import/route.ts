import { NextResponse } from "next/server";

import { ebayJson, getEbayAccess } from "@/lib/marketplaces/ebay";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

const number = (value?: string) => value == null ? null : Number(value);
const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to import eBay data." }, { status: 401 });

  const { admin, accessToken, apiBase } = await getEbayAccess(user.id);
  const { data: activeRun } = await admin.from("marketplace_sync_runs")
    .select("id").eq("user_id", user.id).eq("marketplace_id", "ebay")
    .in("status", ["queued", "processing"]).maybeSingle();
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
    const [{ data: inventory }, inventoryResponse, ordersResponse] = await Promise.all([
      admin.from("inventory_items").select("id,sku,card_name,set_code,collector_number,data").eq("user_id", user.id),
      ebayJson<{ inventoryItems?: InventoryItem[]; total?: number }>(
        apiBase, accessToken, "/sell/inventory/v1/inventory_item?limit=200&offset=0",
      ),
      ebayJson<{ orders?: Order[]; total?: number }>(
        apiBase, accessToken, "/sell/fulfillment/v1/order?limit=200&offset=0&fieldGroups=TAX_BREAKDOWN",
      ),
    ]);

    const inventoryRows = (inventory ?? []) as ImportedInventoryRow[];
    const bySku = new Map(inventoryRows.filter((item) => item.sku).map((item) => [normalize(item.sku ?? undefined), item]));
    const byIdentity = new Map(inventoryRows.map((item) => [
      [normalize(item.card_name), normalize(item.set_code), normalize(item.collector_number)].join("|"), item,
    ]));
    let matched = 0;
    let suggested = 0;
    let unmatched = 0;
    let listingCount = 0;

    for (const item of inventoryResponse.inventoryItems ?? []) {
      const offers = await ebayJson<{ offers?: Offer[] }>(
        apiBase, accessToken, `/sell/inventory/v1/offer?sku=${encodeURIComponent(item.sku)}&limit=100`,
      );
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

      for (const offer of offers.offers?.length ? offers.offers : [{}]) {
        const externalId = offer.listing?.listingId ?? offer.offerId ?? `sku:${item.sku}`;
        const { error } = await admin.from("marketplace_listing_mappings").upsert({
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
        }, { onConflict: "user_id,marketplace_id,external_listing_id" });
        if (error) throw error;
        listingCount += 1;
      }
    }

    let orderCount = 0;
    let orderItemCount = 0;
    for (const order of ordersResponse.orders ?? []) {
      const summary = order.pricingSummary;
      const { data: savedOrder, error } = await admin.from("marketplace_orders").upsert({
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
      }, { onConflict: "user_id,marketplace_id,external_order_id" }).select("id").single();
      if (error || !savedOrder) throw error ?? new Error("Could not save an imported order.");
      const savedOrderRow = savedOrder as SavedOrderRow;
      orderCount += 1;

      for (const line of order.lineItems ?? []) {
        const candidate = line.sku ? bySku.get(normalize(line.sku)) : undefined;
        const status = candidate ? "matched" : "unmatched";
        const { error: lineError } = await admin.from("marketplace_order_items").upsert({
          user_id: user.id,
          marketplace_order_id: savedOrderRow.id,
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
        }, { onConflict: "user_id,marketplace_order_id,external_line_item_id" });
        if (lineError) throw lineError;
        orderItemCount += 1;
      }
    }

    const summary = { listings: listingCount, orders: orderCount, order_items: orderItemCount, matched, suggested, unmatched };
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
        health: "healthy",
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
