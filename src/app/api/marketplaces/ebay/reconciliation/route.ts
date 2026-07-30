import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view eBay data." }, { status: 401 });

  const admin = createAdminClient();
  const [connection, listings, orders, runs] = await Promise.all([
    admin.from("marketplace_connections")
      .select("status,health,last_sync_at,sync_mode")
      .eq("user_id", user.id).eq("marketplace_id", "ebay").maybeSingle(),
    admin.from("marketplace_listing_mappings")
      .select("id,inventory_item_id,trading_docks_sku,external_listing_id,external_offer_id,external_sku,match_status,last_seen_quantity,last_seen_price,raw_snapshot,last_seen_at")
      .eq("user_id", user.id).eq("marketplace_id", "ebay")
      .order("last_seen_at", { ascending: false }).limit(250),
    admin.from("marketplace_orders")
      .select("id,external_order_id,order_status,payment_status,fulfillment_status,currency,total,buyer_alias,ordered_at,last_modified_at,marketplace_order_items(id,title,quantity,external_sku,match_status)")
      .eq("user_id", user.id).eq("marketplace_id", "ebay")
      .order("ordered_at", { ascending: false }).limit(100),
    admin.from("marketplace_sync_runs")
      .select("id,status,records_seen,records_changed,summary,created_at,completed_at")
      .eq("user_id", user.id).eq("marketplace_id", "ebay")
      .order("created_at", { ascending: false }).limit(10),
  ]);

  const error = connection.error ?? listings.error ?? orders.error ?? runs.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    connection: connection.data,
    listings: listings.data ?? [],
    orders: orders.data ?? [],
    runs: runs.data ?? [],
  });
}
