import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { LegacyAccountDataCleanup } from "@/components/dashboard/account/LegacyAccountDataCleanup";
import { TieredDashboardShell } from "@/components/dashboard/shell/TieredDashboardShell";
import { resolveCurrentPlatformAccess } from "@/lib/platform/server-access";
import { getEffectivePlan } from "@/lib/effective-plan";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const platform = await resolveCurrentPlatformAccess();
  if (!platform.user) redirect("/sign-in?next=/dashboard");
  const isOwner = platform.access.canAccessCommandCenter;
  const { data } = await platform.supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", platform.user.id)
    .maybeSingle();
  const preferences =
    data?.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)
      ? (data.preferences as Record<string, unknown>)
      : {};
  const effectivePlan = await getEffectivePlan();

  return (
    <LegacyAccountDataCleanup userId={platform.user.id}>
      <TieredDashboardShell
        accountType={effectivePlan}
        inventoryModules={
          Array.isArray(preferences.inventory_modules)
            ? preferences.inventory_modules.filter(
                (item: unknown): item is string => typeof item === "string",
              )
            : []
        }
        userName={
          typeof platform.user.user_metadata?.full_name === "string"
            ? platform.user.user_metadata.full_name
            : platform.user.email?.split("@")[0] ?? "Collector"
        }
        isOwner={isOwner}
      >
        {children}
      </TieredDashboardShell>
    </LegacyAccountDataCleanup>
  );
}
