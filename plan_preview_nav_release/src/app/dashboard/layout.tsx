import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { LegacyAccountDataCleanup } from "@/components/dashboard/account/LegacyAccountDataCleanup";
import { DashboardShell } from "@/components/dashboard/shell/DashboardShell";
import { isPreviewPlan, PLAN_PREVIEW_COOKIE } from "@/lib/admin-plan-preview";
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
  const cookieStore = await cookies();
  const requestedPreview = cookieStore.get(PLAN_PREVIEW_COOKIE)?.value;
  const previewPlan = isOwner && isPreviewPlan(requestedPreview) ? requestedPreview : null;
  const accountType =
    previewPlan ??
    (typeof preferences.account_type === "string"
      ? preferences.account_type
      : "collector");

  return (
    <LegacyAccountDataCleanup userId={user.id}>
      <DashboardShell
        accountType={accountType}
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
        previewPlan={previewPlan}
      >
        {children}
      </DashboardShell>
    </LegacyAccountDataCleanup>
  );
}
