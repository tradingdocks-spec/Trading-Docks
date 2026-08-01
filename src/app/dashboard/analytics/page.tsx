import { AnalyticsCommandCenter } from "@/components/dashboard/analytics/AnalyticsCommandCenter";
import { getEffectivePlan } from "@/lib/effective-plan";
import { createClient } from "@/lib/supabase/server";

type InventoryRow = {
  quantity: number | null;
  inventory_value: number | null;
  data: Record<string, unknown> | null;
  updated_at: string | null;
};

export default async function AnalyticsPage() {
  const [plan, supabase] = await Promise.all([getEffectivePlan(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  let inventory = { units: 0, value: 0, skus: 0, addedLast30Days: 0 };
  if (user) {
    const { data } = await supabase
      .from("inventory_items")
      .select("quantity,inventory_value,data,updated_at")
      .eq("user_id", user.id);

    const rows = (data ?? []) as InventoryRow[];
    inventory = rows.reduce(
      (summary, row) => {
        const quantity = Number(row.quantity ?? row.data?.quantity ?? 0) || 0;
        const storedValue = Number(row.inventory_value ?? row.data?.value ?? 0) || 0;
        summary.units += quantity;
        summary.value += storedValue;
        summary.skus += 1;
        return summary;
      },
      { units: 0, value: 0, skus: 0, addedLast30Days: 0 },
    );
  }

  return <AnalyticsCommandCenter plan={plan} inventory={inventory} />;
}
