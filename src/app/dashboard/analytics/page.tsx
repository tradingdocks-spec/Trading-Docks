import { summarizeFinancialAcquisitions, type AcquisitionRow, type AcquisitionSummary } from "@/lib/purchase-history/acquisition-summary";
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

  let inventory = summarizeAnalyticsInventory([]);
  let acquisitions: AcquisitionSummary | null = null;
  if (user) {
    const inventoryRows: AnalyticsInventoryRow[] = [];
    let inventoryFailed = false;
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("inventory_items").select("quantity,inventory_value,data,updated_at")
        .eq("user_id", user.id).eq("workspace_id", access.workspaceId ?? "00000000-0000-0000-0000-000000000000").order("id").range(offset, offset + 499);
      if (result.error) { inventoryFailed = true; break; }
      inventoryRows.push(...result.data);
      if (result.data.length < 500) break;
    }
    if (!inventoryFailed) inventory = summarizeAnalyticsInventory(inventoryRows);
    const purchases: AcquisitionRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("purchase_ledger").select("id,status,purchased_at,received_at,total_cost,unit_count")
        .eq("user_id", user.id).eq("workspace_id", access.workspaceId ?? "00000000-0000-0000-0000-000000000000").order("id").range(offset, offset + 499);
      if (result.error) break; // Unavailable is not a zero-dollar acquisition period.
      purchases.push(...result.data);
      if (result.data.length < 500) { acquisitions = summarizeFinancialAcquisitions(purchases); break; }
    }
  }

  return (
    <AnalyticsCommandCenter
      plan={plan}
      inventory={inventory}
      acquisitions={acquisitions}
      fullPlatformAccess={hasTrustedFullPlatformAccess(access)}
      platformRole={access.platformRole}
    />
  );
}
