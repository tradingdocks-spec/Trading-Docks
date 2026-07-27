import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { LegacyAccountDataCleanup } from "@/components/dashboard/account/LegacyAccountDataCleanup";
import { DashboardShell } from "@/components/dashboard/shell/DashboardShell";
import { createClient } from "@/lib/supabase/server";

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
  const isOwner =
    user.email?.trim().toLowerCase() === "tradingdocks@gmail.com";

  return (
    <LegacyAccountDataCleanup userId={user.id}>
      <DashboardShell
        accountType={typeof preferences.account_type === "string" ? preferences.account_type : "collector"}
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
        isOwner={isOwner}
      >
        {children}
      </DashboardShell>
    </LegacyAccountDataCleanup>
  );
}
