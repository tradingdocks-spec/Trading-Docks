import { AnalyticsCommandCenter } from "@/components/dashboard/analytics/AnalyticsCommandCenter";
import {
  summarizeAnalyticsInventory,
  type AnalyticsInventoryRow,
} from "@/lib/dashboard/analytics-summary";
import { getEffectivePlan } from "@/lib/effective-plan";
import {
  hasTrustedFullPlatformAccess,
} from "../../../../mobile/services/platform-access.ts";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  const [plan, supabase] = await Promise.all([getEffectivePlan(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();
  const access = await resolvePlatformAccessForUser(supabase, user);

  let inventory = { units: 0, value: 0, skus: 0, addedLast30Days: 0 };
  if (user) {
    const { data } = await supabase
      .from("inventory_items")
      .select("quantity,inventory_value,data,updated_at")
      .eq("user_id", user.id);

    inventory = summarizeAnalyticsInventory((data ?? []) as AnalyticsInventoryRow[]);
  }

  return (
    <AnalyticsCommandCenter
      plan={plan}
      inventory={inventory}
      fullPlatformAccess={hasTrustedFullPlatformAccess(access)}
      platformRole={access.platformRole}
    />
  );
}
