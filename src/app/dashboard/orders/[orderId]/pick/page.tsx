import { notFound, redirect } from "next/navigation";

import { OrderPickWorkspace } from "@/components/dashboard/orders/OrderPickWorkspace";
import type { OrderRecord } from "@/components/dashboard/orders/UniversalOrdersCenter";
import { loadCanonicalOrders } from "@/lib/orders/order-repository";
import { resolveOrderItemPhysicalLocation } from "@/lib/orders/pick-domain";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";

export default async function OrderPickPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/dashboard/orders/${encodeURIComponent(orderId)}/pick`);
  const access = await resolvePlatformAccessForUser(supabase, user);
  const [{ orders }, { data: inventoryRows }, { data: locationRows }] = await Promise.all([
    loadCanonicalOrders({ supabase: supabase as never, userId: user.id, workspaceId: access.workspaceId, surface: "orders-center", limit: 500 }),
    supabase.from("inventory_items").select("id,card_name,set_code,collector_number,location_id,quantity,data").eq("user_id", user.id).limit(5000),
    supabase.from("inventory_locations").select("id,name,location_type,data").eq("user_id", user.id).limit(500),
  ]);
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order) notFound();
  const enriched = {
    ...(order as unknown as OrderRecord),
    marketplace_order_items: (order.marketplace_order_items ?? []).map((item) => ({
      ...item,
      physical_location: resolveOrderItemPhysicalLocation(item, inventoryRows ?? [], locationRows ?? []),
    })) as OrderRecord["marketplace_order_items"],
  } satisfies OrderRecord;
  return <OrderPickWorkspace order={enriched} />;
}
