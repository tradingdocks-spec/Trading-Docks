import { redirect } from "next/navigation";

import {
  SellerMissionControl,
  type MissionControlSnapshot,
} from "@/components/dashboard/mission-control/SellerMissionControl";
import { ModularWorkspace } from "@/components/dashboard/workspace/ModularWorkspace";
import { getEffectivePlan } from "@/lib/effective-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard");

  const { data } = await supabase
    .from("user_preferences")
    .select("preferences,active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const preferences =
    data?.preferences &&
    typeof data.preferences === "object" &&
    !Array.isArray(data.preferences)
      ? data.preferences
      : {};
  const effectivePlan = await getEffectivePlan();

  if (preferences.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  if (effectivePlan === "seller" || effectivePlan === "store") {
    const settings =
      preferences.settings &&
      typeof preferences.settings === "object" &&
      !Array.isArray(preferences.settings)
        ? (preferences.settings as Record<string, unknown>)
        : {};

    const businessName =
      typeof settings.businessName === "string"
        ? settings.businessName.trim()
        : "";
    const ownerName =
      typeof settings.fullName === "string" && settings.fullName.trim()
        ? settings.fullName.trim()
        : user.email?.split("@")[0] ?? "Seller";

    const workspaceId =
      typeof data?.active_workspace_id === "string"
        ? data.active_workspace_id
        : null;

    const since = new Date();
    since.setDate(since.getDate() - 30);

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
        .select("id,total,net_profit,normalized_status,ordered_at")
        .eq("user_id", user.id)
        .gte("ordered_at", since.toISOString())
        .order("ordered_at", { ascending: false })
        .limit(1000),
      supabase
        .from("marketplace_sync_runs")
        .select("id,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      workspaceId
        ? supabase
            .from("crm_customers")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
        : Promise.resolve({ count: 0 }),
    ]);

    const inventoryRows = inventoryResult.data ?? [];
    const inventoryUnits = inventoryRows.reduce(
      (total, row) =>
        total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );

    const readyConnections = (connectionResult.data ?? [])
      .map((row) => row.marketplace_id?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    const credentialConnections = (credentialResult.data ?? [])
      .map((row) => row.marketplace_id?.trim().toLowerCase())
      .filter(
        (value): value is string =>
          value === "mana-pool" || value === "manapool",
      )
      .map(() => "mana-pool");

    const connectedMarketplaces = Array.from(
      new Set([...readyConnections, ...credentialConnections]),
    ).map(formatMarketplace);

    const orders = orderResult.data ?? [];
    const revenue = orders.reduce(
      (total, order) =>
        total + (typeof order.total === "number" ? order.total : 0),
      0,
    );
    const profit = orders.reduce(
      (total, order) =>
        total +
        (typeof order.net_profit === "number" ? order.net_profit : 0),
      0,
    );
    const openOrderCount = orders.filter((order) =>
      ["new", "processing"].includes(
        String(order.normalized_status ?? "new").toLowerCase(),
      ),
    ).length;

    const syncs = syncResult.data ?? [];
    const completedSyncCount = syncs.filter(
      (sync) => sync.status === "completed",
    ).length;
    const failedSyncCount = syncs.filter(
      (sync) => sync.status === "failed",
    ).length;
    const lastSyncAt =
      syncs.find((sync) => sync.status === "completed")?.created_at ?? null;

    const requiredChecks = [
      Boolean(workspaceId),
      inventoryUnits > 0,
      connectedMarketplaces.length > 0,
      orders.length > 0,
    ];
    const readinessComplete = requiredChecks.filter(Boolean).length;
    const readinessTotal = requiredChecks.length;

    const snapshot: MissionControlSnapshot = {
      businessName,
      ownerName,
      inventoryUnits,
      inventoryRecords: inventoryRows.length,
      connectedMarketplaces,
      orderCount: orders.length,
      openOrderCount,
      revenue,
      profit,
      customerCount: customerResult.count ?? 0,
      completedSyncCount,
      failedSyncCount,
      lastSyncAt,
      readinessScore: Math.round(
        (readinessComplete / readinessTotal) * 100,
      ),
      readinessComplete,
      readinessTotal,
      generatedAt: new Date().toISOString(),
    };

    return <SellerMissionControl snapshot={snapshot} />;
  }

  return (
    <ModularWorkspace
      accountType={effectivePlan}
      inventoryModules={
        Array.isArray(preferences.inventory_modules)
          ? preferences.inventory_modules.filter(
              (item: unknown): item is string => typeof item === "string",
            )
          : []
      }
      initialLayouts={
        preferences.dashboard_layouts &&
        typeof preferences.dashboard_layouts === "object"
          ? preferences.dashboard_layouts
          : undefined
      }
    />
  );
}

function formatMarketplace(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
