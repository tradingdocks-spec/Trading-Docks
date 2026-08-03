import { UniversalOrdersCenter, type OrderRecord } from "@/components/dashboard/orders/UniversalOrdersCenter";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orders: OrderRecord[] = [];
  let connectedChannels: string[] = [];

  if (user) {
    const [
      { data: orderData },
      { data: connectionData },
      { data: credentialData },
    ] = await Promise.all([
      supabase
        .from("marketplace_orders")
        .select("*, marketplace_order_items(*)")
        .eq("user_id", user.id)
        .order("ordered_at", { ascending: false })
        .limit(500),
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

    orders = (orderData ?? []) as unknown as OrderRecord[];

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
