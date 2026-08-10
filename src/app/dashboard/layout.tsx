import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { LegacyAccountDataCleanup } from "@/components/dashboard/account/LegacyAccountDataCleanup";
import { TieredDashboardShell } from "@/components/dashboard/shell/TieredDashboardShell";
import { resolveServerAccess } from "@/lib/identity/server-access";
import { toClientSafeAccess } from "@/lib/platform/client-access";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/effective-plan";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  const preferences =
    data?.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)
      ? data.preferences
      : {};
  const access = await resolveServerAccess(supabase, user);
  const platformAccess = await resolvePlatformAccessForUser(supabase, user);
  const effectivePlan = await getEffectivePlan();

  return (
    <LegacyAccountDataCleanup userId={user.id}>
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
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : user.email?.split("@")[0] ?? "Collector"
        }
        isOwner={access.isAdmin}
        clientAccess={toClientSafeAccess(platformAccess)}
      >
        {children}
      </TieredDashboardShell>
    </LegacyAccountDataCleanup>
  );
}
