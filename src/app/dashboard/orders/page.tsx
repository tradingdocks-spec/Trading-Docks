import { UniversalOrdersCenter, type OrderRecord } from "@/components/dashboard/orders/UniversalOrdersCenter";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let orders: OrderRecord[] = [];

  if (user) {
    const { data } = await supabase
      .from("marketplace_orders")
      .select("*, marketplace_order_items(*)")
      .eq("user_id", user.id)
      .order("ordered_at", { ascending: false })
      .limit(500);
    orders = (data ?? []) as unknown as OrderRecord[];
  }

  return <UniversalOrdersCenter initialOrders={orders} />;
}
