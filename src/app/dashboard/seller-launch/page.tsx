import { redirect } from "next/navigation";

import {
  SellerLaunchCenter,
  type SellerReadinessSnapshot,
} from "@/components/dashboard/seller-launch/SellerLaunchCenter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SellerLaunchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard/seller-launch");
  }

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const workspaceId =
    typeof preferences?.active_workspace_id === "string"
      ? preferences.active_workspace_id
      : null;

  const [
    inventoryResult,
    connectionResult,
    credentialResult,
    orderResult,
    syncResult,
    customerResult,
  ] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id),
    supabase
      .from("marketplace_connections")
      .select("marketplace_id,status")
      .eq("user_id", user.id)
      .eq("status", "ready"),
    supabase
      .from("marketplace_credentials")
      .select("marketplace_id")
      .eq("user_id", user.id),
    supabase
      .from("marketplace_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("marketplace_sync_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
    workspaceId
      ? supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
      : Promise.resolve({ count: 0 }),
  ]);

  const inventoryRows = inventoryResult.data ?? [];
  const inventoryUnitCount = inventoryRows.reduce(
    (total, row) =>
      total +
      (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );

  const readyConnections = (connectionResult.data ?? [])
    .map((row) => row.marketplace_id?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const credentialConnections = (credentialResult.data ?? [])
    .map((row) => row.marketplace_id?.trim().toLowerCase())
    .filter((value): value is string =>
      value === "mana-pool" || value === "manapool",
    )
    .map(() => "mana-pool");

  const connectedMarketplaces = Array.from(
    new Set([...readyConnections, ...credentialConnections]),
  ).map(formatMarketplace);

  const snapshot: SellerReadinessSnapshot = {
    inventoryItemCount: inventoryRows.length,
    inventoryUnitCount,
    connectedMarketplaceCount: connectedMarketplaces.length,
    connectedMarketplaces,
    orderCount: orderResult.count ?? 0,
    customerCount: customerResult.count ?? 0,
    completedSyncCount: syncResult.count ?? 0,
    workspaceConfigured: Boolean(workspaceId),
    generatedAt: new Date().toISOString(),
  };

  return <SellerLaunchCenter snapshot={snapshot} />;
}

function formatMarketplace(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
