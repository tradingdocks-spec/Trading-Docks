import { UniversalOrdersCenter, type OrderRecord } from "@/components/dashboard/orders/UniversalOrdersCenter";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let orders: OrderRecord[] = [];
  let emailIssues = 0;

  if (user) {
    const { data } = await supabase
      .from("marketplace_orders")
      .select("*, marketplace_order_items(*)")
      .eq("user_id", user.id)
      .order("ordered_at", { ascending: false })
      .limit(500);
    orders = (data ?? []) as unknown as OrderRecord[];
    const { count } = await supabase
      .from("inbound_email_messages")
      .select("id", { count: "exact", head: true })
      .in("processing_status", ["needs_review", "failed", "unsupported"]);
    emailIssues = count ?? 0;
  }

  return <UniversalOrdersCenter initialOrders={orders} initialEmailIssues={emailIssues} />;
}
