import { UniversalOrdersCenter, type OrderRecord } from "@/components/dashboard/orders/UniversalOrdersCenter";
import {
  loadCanonicalOrders,
  type CanonicalOrderSupabaseClient,
} from "@/lib/orders/order-repository";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";
import { resolveOrderItemPhysicalLocation } from "@/lib/orders/pick-domain";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orders: OrderRecord[] = [];
  let connectedChannels: string[] = [];

  if (user) {
    const access = await resolvePlatformAccessForUser(supabase, user);
    const [
      orderResult,
      { data: connectionData },
      { data: credentialData },
    ] = await Promise.all([
      loadCanonicalOrders({
        supabase: supabase as unknown as CanonicalOrderSupabaseClient,
        userId: user.id,
        workspaceId: access.workspaceId,
        range: null,
        surface: "orders-center",
        limit: 500,
      }),
      supabase
        .from("marketplace_connections")
        .select("marketplace_id,status")
        .eq("user_id", user.id)
        .eq("status", "ready"),
      supabase
        .from("marketplace_credentials")
        .select("marketplace_id")
        .eq("user_id", user.id),
    ]);

    orders = orderResult.orders as unknown as OrderRecord[];
    const [{ data: inventoryRows }, { data: locationRows }] = await Promise.all([
      supabase.from("inventory_items").select("id,card_name,set_code,collector_number,location_id,quantity,data").eq("user_id", user.id).limit(5000),
      supabase.from("inventory_locations").select("id,name,location_type,data").eq("user_id", user.id).limit(500),
    ]);
    orders = orders.map((order) => ({
      ...order,
      marketplace_order_items: (order.marketplace_order_items ?? []).map((item) => ({
        ...item,
        physical_location: resolveOrderItemPhysicalLocation(item, inventoryRows ?? [], locationRows ?? []),
      })),
    }));

    const readyConnectionIds = (connectionData ?? [])
      .map((connection) => connection.marketplace_id?.toLowerCase())
      .filter((value): value is string => Boolean(value));

    // A saved Mana Pool seller credential is a self-service connection. This
    // fallback also repairs the UI for credentials saved before the connection
    // row began using status=ready.
    const savedCredentialIds = (credentialData ?? [])
      .map((credential) => credential.marketplace_id?.toLowerCase())
      .filter(
        (value): value is string =>
          value === "mana-pool" || value === "manapool",
      )
      .map(() => "mana-pool");

    connectedChannels = Array.from(
      new Set([...readyConnectionIds, ...savedCredentialIds]),
    );
  }

  return (
    <UniversalOrdersCenter
      initialOrders={orders}
      connectedChannels={connectedChannels}
    />
  );
}
